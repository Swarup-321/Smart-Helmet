import React, { useState, useEffect } from 'react';
import { 
  Menu, Search, RefreshCw, Volume2, VolumeX, 
  Clock, Bell
} from 'lucide-react';
import { useApp } from '../context/AppContext';

export default function TopBar({ 
  currentTab, 
  onOpenCommandPalette, 
  onToggleMobileMenu,
  onToggleCollapse
}) {
  const { 
    refreshData, 
    soundEnabled, 
    setSoundEnabled, 
    isConnected,
    isServerWaking,
    activeAlerts,
    user 
  } = useApp();

  const [timeStr, setTimeStr] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTimeStr(now.toLocaleTimeString('en-US', { hour12: false }));
    };
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    await refreshData();
    setTimeout(() => setIsRefreshing(false), 500);
  };

  const unresolvedAlertCount = activeAlerts.filter(a => !a.resolved_at).length;

  return (
    <header className="mg-topbar select-none">
      {/* Mobile-only toggle */}
      <button 
        className="mg-icon-btn mg-hide-desktop" 
        onClick={onToggleMobileMenu || onToggleCollapse}
        aria-label="Menu"
      >
        <Menu className="mg-i" />
      </button>

      {/* Template search bar */}
      <label 
        className="mg-search cursor-pointer"
        onClick={onOpenCommandPalette}
      >
        <Search className="mg-i" />
        <input 
          type="search" 
          placeholder="Search units, zones, incidents…" 
          readOnly 
          className="cursor-pointer"
        />
        <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] bg-white border border-[#D8E0E8] rounded font-mono text-[#878A99] shadow-2xs">
          ⌘K
        </kbd>
      </label>

      {/* Spacer */}
      <div className="mg-topbar-spacer" />

      {/* Utilities: Clock */}
      <div className="hidden lg:flex items-center space-x-1.5 text-xs text-[#495057] px-2.5 py-1.5 bg-[#F3F3F9] rounded border border-[#E9EBEC] font-mono">
        <Clock className="h-3.5 w-3.5 text-[#878A99]" />
        <span className="tabular-nums font-semibold">{timeStr || '00:00:00'}</span>
        <span className="text-[10px] text-[#878A99]">SYS</span>
      </div>

      {/* Siren mute/unmute */}
      <button
        onClick={() => setSoundEnabled(!soundEnabled)}
        className="mg-icon-btn"
        title={soundEnabled ? 'Incident Siren: Active' : 'Incident Siren: Muted'}
      >
        {soundEnabled ? <Volume2 className="mg-i text-[#405189]" /> : <VolumeX className="mg-i text-[#878A99]" />}
      </button>

      {/* Manual refresh */}
      <button
        onClick={handleManualRefresh}
        disabled={isRefreshing}
        className="mg-icon-btn"
        title="Refresh live telemetry"
      >
        <RefreshCw className={`mg-i ${isRefreshing ? 'animate-spin text-[#405189]' : 'text-[#878A99]'}`} />
      </button>

      {/* Gateway Live Badge */}
      <span className={`mg-badge ${isConnected ? 'mg-badge-success' : 'mg-badge-warning'}`}>
        <span 
          className={`mg-status ${isConnected ? 'mg-status-ok' : 'mg-status-warn'}`} 
          style={{ fontSize: 'inherit' }}
        >
          {isConnected ? 'Live' : 'Connecting'}
        </span>
      </span>

      {/* Notification Bell with count */}
      <button className="mg-icon-btn" aria-label="Alerts">
        <Bell className="mg-i" />
        {unresolvedAlertCount > 0 && (
          <span className="mg-dot-count">{unresolvedAlertCount}</span>
        )}
      </button>

      {/* Shift supervisor profile */}
      <div className="mg-user">
        <div className="mg-avatar">SS</div>
        <div>
          <div className="mg-user-name">{user?.name || 'Shift supervisor'}</div>
          <div className="mg-user-role">Sector 4</div>
        </div>
      </div>
    </header>
  );
}
