import React, { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../services/api';

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('mineguard_user');
    return saved ? JSON.parse(saved) : { email: 'admin@mineguard.local', role: 'admin', name: 'Safety Officer' };
  });

  const [workersLatest, setWorkersLatest] = useState([]);
  const [activeAlerts, setActiveAlerts] = useState([]);
  const [summaryStats, setSummaryStats] = useState(null);
  const [thresholds, setThresholds] = useState([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isServerWaking, setIsServerWaking] = useState(false);
  const [selectedWorkerId, setSelectedWorkerId] = useState(null);
  const [criticalSosAlert, setCriticalSosAlert] = useState(null);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [unitCelsius, setUnitCelsius] = useState(true);
  const [demoMode, setDemoMode] = useState(true);
  const [toasts, setToasts] = useState([]);

  // Audio beep effect for critical alerts
  const playAlertSound = () => {
    if (!soundEnabled) return;
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, audioCtx.currentTime); // A5 note
      gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.5);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.5);
    } catch (e) {}
  };

  const addToast = (toast) => {
    const id = Date.now() + Math.random().toString(36).substring(2, 6);
    setToasts(prev => [...prev, { id, ...toast }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 6000);
  };

  const removeToast = (id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  // Initial Data Fetch
  const refreshData = async () => {
    try {
      setIsServerWaking(false);
      const [latestRes, alertsRes, statsRes, threshRes] = await Promise.all([
        api.getLatestReadings().catch(() => []),
        api.getAlerts({ status: 'unresolved' }).catch(() => []),
        api.getSummaryStats().catch(() => null),
        api.getThresholds().catch(() => [])
      ]);

      setWorkersLatest(latestRes);
      setActiveAlerts(alertsRes);
      setSummaryStats(statsRes);
      setThresholds(threshRes);
    } catch (err) {
      if (err.status === -1) {
        setIsServerWaking(true);
      }
    }
  };

  useEffect(() => {
    refreshData();

    // Setup Socket.IO real-time stream
    const socket = api.initSocket(
      // On live reading
      (reading) => {
        setWorkersLatest(prev => {
          const index = prev.findIndex(item => item.worker?.id === reading.worker_id);
          const updatedItem = {
            worker: index >= 0 ? prev[index].worker : { id: reading.worker_id, name: reading.worker_id, zone: 'Mine' },
            status: 'online',
            age_seconds: 0,
            reading
          };
          if (index >= 0) {
            const next = [...prev];
            next[index] = updatedItem;
            return next;
          }
          return [...prev, updatedItem];
        });
      },
      // On live alert
      (alert) => {
        setActiveAlerts(prev => [alert, ...prev.filter(a => a.id !== alert.id)]);
        playAlertSound();

        addToast({
          type: alert.severity.toLowerCase(),
          title: `${alert.severity}: ${alert.type} Alert`,
          message: alert.message,
          worker_id: alert.worker_id
        });

        if (alert.type === 'SOS' || alert.type === 'FALL' || alert.severity === 'CRITICAL') {
          setCriticalSosAlert(alert);
        }
      },
      // On worker add/update/delete
      () => {
        refreshData();
      }
    );

    socket.on('connect', () => {
      setIsConnected(true);
      setIsServerWaking(false);
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
    });

    socket.on('connect_error', () => {
      setIsConnected(false);
    });

    // Periodic polling as fallback
    const interval = setInterval(refreshData, 10000);

    return () => {
      clearInterval(interval);
      api.disconnectSocket();
    };
  }, [soundEnabled]);

  const value = {
    user,
    setUser,
    workersLatest,
    activeAlerts,
    summaryStats,
    thresholds,
    isConnected,
    isServerWaking,
    selectedWorkerId,
    setSelectedWorkerId,
    criticalSosAlert,
    setCriticalSosAlert,
    soundEnabled,
    setSoundEnabled,
    unitCelsius,
    setUnitCelsius,
    demoMode,
    setDemoMode,
    toasts,
    addToast,
    removeToast,
    refreshData,
    playAlertSound
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within AppProvider');
  return context;
}
