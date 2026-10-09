import React, { useState, useEffect, useMemo } from 'react';
import { 
  Activity, ShieldAlert, AlertTriangle, Radio, TrendingUp, TrendingDown, 
  Clock, Gauge, Zap, Waves, CheckCircle2, AlertOctagon, RefreshCw, 
  MapPin, Layers, ArrowUpRight, ArrowDownRight, Compass, Shield
} from 'lucide-react';
import { 
  ResponsiveContainer, AreaChart, Area, BarChart, Bar, 
  PieChart, Pie, Cell, Tooltip, XAxis, YAxis, CartesianGrid, ReferenceLine 
} from 'recharts';
import { useApp } from '../context/AppContext';
import { api } from '../services/api';

export default function FixedZoneMonitoring() {
  const { workersLatest = [] } = useApp() || {};

  const availableZones = [
    { id: 'Live Physical Device (HW-072)', label: 'Live Physical Device (SW-420 Sensor - W006)' },
    { id: 'Zone C - Extraction Face', label: 'Zone C - Extraction Face (Simulated Heavy Face)' },
    { id: 'Zone A - Shaft 3', label: 'Zone A - Shaft 3 (Simulated Shaft Pillar)' },
    { id: 'Zone B - Drift 1', label: 'Zone B - Drift 1 (Simulated Drift Support)' },
    { id: 'Zone B - Conveyor 2', label: 'Zone B - Conveyor 2 (Simulated Transfer Head)' },
    { id: 'Main Access Gate', label: 'Main Access Gate (Simulated Portal)' }
  ];

  const [selectedZone, setSelectedZone] = useState('Live Physical Device (HW-072)');
  const [zoneData, setZoneData] = useState({
    zone_id: 'Live Physical Device (HW-072)',
    is_physical_device: true,
    current_status: 'NORMAL',
    vibration_detected: false,
    vibration_events_current_window: 0,
    events_last_10s: 0,
    events_last_1m: 0,
    last_detected_ts: 'No vibration detected yet',
    warning_level: 'SAFE',
    zone_stability: 'Stable',
    total_events_today: 0,
    risk_score: 0,
    risk_label: 'SAFE',
    trend: {
      previous_10min_events: 0,
      current_10min_events: 0,
      percentage_change: 0,
      direction: 'stable',
      message: 'Physical sensor standing by (nominal)'
    },
    early_warning: {
      active: false,
      stage: 'NORMAL',
      message: 'Live hardware sensor monitoring active on GPIO 26.'
    },
    severity_distribution: [
      { name: 'Normal', level: 'NORMAL', count: 0, percentage: 100, color: '#10B981' },
      { name: 'Low', level: 'LOW', count: 0, percentage: 0, color: '#3B82F6' },
      { name: 'Moderate', level: 'MODERATE', count: 0, percentage: 0, color: '#F59E0B' },
      { name: 'High', level: 'HIGH', count: 0, percentage: 0, color: '#F97316' },
      { name: 'Critical', level: 'CRITICAL', count: 0, percentage: 0, color: '#EF4444' }
    ],
    realtime_activity_points: [],
    recent_timeline: []
  });
  const [loading, setLoading] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState(new Date());

  const fetchZoneData = async () => {
    try {
      const data = await api.getZoneMonitoring(selectedZone);
      if (data) {
        setZoneData(data);
        setLastRefreshed(new Date());
      }
    } catch (err) {
      console.error('Failed to fetch zone monitoring data:', err);
    }
  };

  useEffect(() => {
    fetchZoneData();
    const interval = setInterval(fetchZoneData, 4000); // 4s telemetry sync
    return () => clearInterval(interval);
  }, [selectedZone]);

  const isPhysicalStation = selectedZone === 'Live Physical Device (HW-072)' || selectedZone === 'W006';

  // Sync with live socket readings matching physical device or selected zone
  const liveReading = useMemo(() => {
    if (!workersLatest || workersLatest.length === 0) return null;
    if (isPhysicalStation) {
      const liveDevice = workersLatest.find(w => 
        w.worker?.id === 'W006' || w.reading?.helmet_id === 'H-ESP32-LIVE' || w.worker?.id === 'W001'
      );
      return liveDevice?.reading || null;
    }
    const match = workersLatest.find(w => 
      w.worker?.zone === selectedZone || w.reading?.zone_id === selectedZone
    );
    return match?.reading || null;
  }, [workersLatest, selectedZone, isPhysicalStation]);

  // Priority: live Socket.IO reading > zone-monitoring API response
  const currentStatus = liveReading?.vibration_level || zoneData?.current_status || 'NORMAL';
  const currentEvents = liveReading?.vibration_events != null ? liveReading.vibration_events : (zoneData?.events_last_10s ?? 0);
  const currentVibDetected = liveReading ? Boolean(liveReading.vibration_detected || liveReading.vibration_events > 0) : Boolean(zoneData?.vibration_detected);
  const currentVibStatus = liveReading?.vibration_status || (zoneData?.current_status === 'NORMAL' ? 'SAFE' : zoneData?.current_status) || 'SAFE';
  const riskScore = zoneData?.risk_score !== undefined ? zoneData.risk_score : 0;
  const stability = zoneData?.zone_stability || 'Stable';

  // Computed safe chart points for physical standby / live stream
  const chartPoints = useMemo(() => {
    const points = zoneData?.realtime_activity_points || [];
    if (points.length > 0) return points;
    const now = new Date();
    return Array.from({ length: 8 }, (_, i) => {
      const d = new Date(now.getTime() - (7 - i) * 10000);
      return {
        timestamp: d.toISOString(),
        timeStr: d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        events: 0,
        level: 'NORMAL',
        risk_score: 0
      };
    });
  }, [zoneData?.realtime_activity_points]);

  // Computed safe pie data (avoids 0/0 NaN radius in Recharts)
  const pieData = useMemo(() => {
    const list = zoneData?.severity_distribution || [];
    const totalCount = list.reduce((acc, curr) => acc + (curr.count || 0), 0);
    if (totalCount === 0) {
      return [{ name: 'Safe / Standby', level: 'NORMAL', count: 1, percentage: 100, color: '#10B981' }];
    }
    return list.filter(item => (item.count || 0) > 0);
  }, [zoneData?.severity_distribution]);

  // Light-theme status configurations
  const getStatusConfig = (status) => {
    switch (status?.toUpperCase()) {
      case 'CRITICAL':
        return {
          cardBg: 'bg-rose-50/60 border-rose-300',
          badge: 'bg-rose-600 text-white',
          text: 'text-rose-700',
          iconColor: 'text-rose-600',
          icon: AlertOctagon,
          label: 'CRITICAL VIBRATION',
          desc: 'High-frequency continuous structural/ground vibration detected. Immediate inspection required.'
        };
      case 'HIGH':
        return {
          cardBg: 'bg-orange-50/60 border-orange-300',
          badge: 'bg-orange-600 text-white',
          text: 'text-orange-700',
          iconColor: 'text-orange-600',
          icon: AlertTriangle,
          label: 'HIGH VIBRATION',
          desc: 'Elevated ground movement / vibration density exceeding normal baseline parameters.'
        };
      case 'MODERATE':
        return {
          cardBg: 'bg-amber-50/60 border-amber-300',
          badge: 'bg-amber-500 text-slate-950 font-bold',
          text: 'text-amber-800',
          iconColor: 'text-amber-600',
          icon: Waves,
          label: 'MODERATE VIBRATION',
          desc: 'Moderate mechanical activity or transient drilling vibration detected in zone.'
        };
      case 'LOW':
        return {
          cardBg: 'bg-blue-50/60 border-blue-200',
          badge: 'bg-blue-600 text-white',
          text: 'text-blue-700',
          iconColor: 'text-blue-600',
          icon: Activity,
          label: 'LOW VIBRATION',
          desc: 'Minor ambient vibrations detected. Routine personnel or airflow oscillation.'
        };
      case 'NORMAL':
      default:
        return {
          cardBg: 'bg-emerald-50/60 border-emerald-200',
          badge: 'bg-emerald-600 text-white',
          text: 'text-emerald-700',
          iconColor: 'text-emerald-600',
          icon: CheckCircle2,
          label: 'NORMAL / STABLE',
          desc: 'Ground vibration within baseline safety threshold (0-2 events / 10s window).'
        };
    }
  };

  const statusConfig = getStatusConfig(currentStatus);
  const StatusIcon = statusConfig.icon;

  const getStabilityBadge = (stab) => {
    switch (stab) {
      case 'Critical':
        return { color: 'bg-rose-100 text-rose-800 border-rose-300', label: 'CRITICAL' };
      case 'Unstable':
        return { color: 'bg-orange-100 text-orange-800 border-orange-300', label: 'UNSTABLE' };
      case 'Watch':
        return { color: 'bg-amber-100 text-amber-800 border-amber-300', label: 'WATCH' };
      case 'Stable':
      default:
        return { color: 'bg-emerald-100 text-emerald-800 border-emerald-300', label: 'STABLE' };
    }
  };

  const stabilityBadge = getStabilityBadge(stability);

  // Custom Chart Tooltip for Light Theme
  const CustomChartTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-slate-900 text-white p-3 rounded-xl shadow-xl text-xs">
          <p className="font-mono text-slate-400 mb-1">{label || payload[0]?.payload?.timeStr}</p>
          <div className="flex items-center space-x-2 text-indigo-300">
            <span className="w-2 h-2 rounded-full bg-indigo-400"></span>
            <span className="font-medium">Vibration Events:</span>
            <span className="font-mono font-bold text-white">{payload[0].value}</span>
          </div>
          {payload[1] && (
            <div className="flex items-center space-x-2 text-rose-300 mt-1">
              <span className="w-2 h-2 rounded-full bg-rose-400"></span>
              <span className="font-medium">Risk Score:</span>
              <span className="font-mono font-bold text-white">{payload[1].value}/100</span>
            </div>
          )}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6">

      {/* ========================================================= */}
      {/* 1. TOP HEADER & FIXED ZONE SELECTOR                       */}
      {/* ========================================================= */}
      <div className="bg-white rounded-2xl border border-slate-100 p-5 sm:p-6 shadow-soft">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          
          <div className="flex items-center space-x-3.5">
            <div className="h-11 w-11 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-md">
              <Waves className="h-6 w-6 stroke-[2.2]" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                  FIXED ZONE MONITORING
                </h1>
              </div>
              <p className="text-xs sm:text-sm font-medium text-slate-500">
                Real-Time Ground / Structural Vibration Safety Analysis
              </p>
            </div>
          </div>

          {/* Monitoring Station Selector */}
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="flex items-center space-x-2 bg-slate-50 border border-slate-200 px-3.5 py-2 rounded-xl">
              <MapPin className="h-4 w-4 text-blue-600" />
              <span className="text-xs text-slate-500 font-semibold">Station:</span>
              <select
                value={selectedZone}
                onChange={(e) => setSelectedZone(e.target.value)}
                className="bg-transparent text-xs font-bold text-slate-800 focus:outline-none cursor-pointer"
              >
                {availableZones.map(z => (
                  <option key={z.id} value={z.id} className="bg-white text-slate-800">
                    {z.label}
                  </option>
                ))}
              </select>
            </div>

      <div className="flex items-center space-x-2 bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl text-xs font-semibold text-slate-600">
              <span className={`h-2 w-2 rounded-full ${liveReading ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}`}></span>
              <span>{isPhysicalStation ? 'SW-420 Live' : 'Simulated'}</span>
              <span className="text-slate-400 font-mono text-[11px]">
                ({lastRefreshed.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })})
              </span>
            </div>
          </div>

        </div>
      </div>

      {/* ========================================================= */}
      {/* SW-420 LIVE SENSOR CARD — Physical Device Only             */}
      {/* ========================================================= */}
      {isPhysicalStation && (
        <div className={`rounded-2xl border p-5 shadow-soft ${
          currentStatus === 'CRITICAL' ? 'bg-rose-50 border-rose-300' :
          currentStatus === 'HIGH'     ? 'bg-orange-50 border-orange-300' :
          currentStatus === 'MODERATE' ? 'bg-amber-50 border-amber-200' :
          currentStatus === 'LOW'      ? 'bg-blue-50 border-blue-200' :
          'bg-emerald-50 border-emerald-200'
        }`}>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center space-x-3">
              <div className={`h-10 w-10 rounded-xl flex items-center justify-center shadow ${
                currentStatus === 'CRITICAL' ? 'bg-rose-600' :
                currentStatus === 'HIGH'     ? 'bg-orange-500' :
                currentStatus === 'MODERATE' ? 'bg-amber-500' :
                currentStatus === 'LOW'      ? 'bg-blue-500' :
                'bg-emerald-600'
              }`}>
                <Waves className="h-5 w-5 text-white" />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <span className="text-sm font-extrabold text-slate-900 uppercase tracking-wide">SW-420 Vibration Sensor</span>
                  <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full font-mono">GPIO 26 • W006</span>
                  {liveReading && (
                    <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  )}
                </div>
                <p className="text-xs text-slate-500 mt-0.5">Digital vibration / impact event detector — live telemetry</p>
              </div>
            </div>

            {/* Live Data Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
              {/* Detection */}
              <div className="bg-white/80 border border-slate-200 rounded-xl px-3 py-2">
                <div className="text-[10px] text-slate-500 font-semibold uppercase mb-1">Detection</div>
                <div className={`text-xs font-black uppercase ${
                  currentVibDetected ? 'text-rose-600' : 'text-emerald-600'
                }`}>
                  {currentVibDetected ? 'DETECTED' : 'NOT DETECTED'}
                </div>
              </div>
              {/* Events/10s */}
              <div className="bg-white/80 border border-slate-200 rounded-xl px-3 py-2">
                <div className="text-[10px] text-slate-500 font-semibold uppercase mb-1">Events / 10 sec</div>
                <div className={`text-lg font-black font-mono ${
                  currentEvents >= 21 ? 'text-rose-600' :
                  currentEvents >= 11 ? 'text-orange-600' :
                  currentEvents >= 6  ? 'text-amber-600' :
                  currentEvents >= 3  ? 'text-blue-600' :
                  'text-emerald-600'
                }`}>
                  {currentEvents}
                </div>
              </div>
              {/* Level */}
              <div className="bg-white/80 border border-slate-200 rounded-xl px-3 py-2">
                <div className="text-[10px] text-slate-500 font-semibold uppercase mb-1">Level</div>
                <div className={`text-xs font-black uppercase ${
                  currentStatus === 'CRITICAL' ? 'text-rose-600' :
                  currentStatus === 'HIGH'     ? 'text-orange-600' :
                  currentStatus === 'MODERATE' ? 'text-amber-600' :
                  currentStatus === 'LOW'      ? 'text-blue-600' :
                  'text-emerald-600'
                }`}>{currentStatus}</div>
              </div>
              {/* Status */}
              <div className="bg-white/80 border border-slate-200 rounded-xl px-3 py-2">
                <div className="text-[10px] text-slate-500 font-semibold uppercase mb-1">Status</div>
                <div className={`text-xs font-black uppercase ${
                  currentVibStatus === 'CRITICAL' ? 'text-rose-600' :
                  currentVibStatus === 'WARNING'  ? 'text-orange-600' :
                  currentVibStatus === 'MONITOR'  ? 'text-amber-600' :
                  currentVibStatus === 'NORMAL'   ? 'text-blue-600' :
                  'text-emerald-600'
                }`}>{currentVibStatus}</div>
              </div>
            </div>
          </div>

          {/* Data source label */}
          <div className="mt-3 pt-2.5 border-t border-slate-200/60 flex items-center justify-between text-[11px] text-slate-400">
            <span>Source: <span className="font-mono font-semibold text-slate-600">{liveReading ? 'Live Socket.IO' : 'REST API / Zone Monitor'}</span></span>
            <span>Worker: <span className="font-mono font-semibold text-slate-600">W006 • H-ESP32-LIVE</span></span>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* Big Live Status Card (7 cols) */}
        <div className={`lg:col-span-7 bg-white rounded-2xl p-6 border ${statusConfig.cardBg} shadow-soft flex flex-col justify-between`}>
          <div>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2 text-xs font-bold uppercase tracking-wider text-slate-600">
                <StatusIcon className={`h-4 w-4 ${statusConfig.iconColor}`} />
                <span>CURRENT VIBRATION STATUS</span>
              </div>
              <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${statusConfig.badge}`}>
                {statusConfig.label}
              </span>
            </div>

            <div className="mt-4 flex flex-col sm:flex-row sm:items-baseline gap-2 sm:gap-4">
              <div className={`text-4xl sm:text-5xl font-black tracking-tight ${statusConfig.text}`}>
                {currentStatus}
              </div>
              <div className="text-sm font-semibold text-slate-600">
                <span className="text-slate-900 font-mono text-lg font-extrabold">{currentEvents}</span> events in current 10s window
              </div>
            </div>

            <p className="mt-3 text-xs sm:text-sm text-slate-600 leading-relaxed max-w-xl">
              {statusConfig.desc}
            </p>
          </div>

          {/* Bottom quick metrics */}
          <div className="mt-6 pt-4 border-t border-slate-200/60 grid grid-cols-3 gap-3 text-center">
            <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
              <span className="text-[10px] text-slate-500 uppercase font-semibold">10s Events</span>
              <div className="text-lg font-black text-slate-900 font-mono mt-0.5">{zoneData?.events_last_10s ?? currentEvents}</div>
            </div>
            <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
              <span className="text-[10px] text-slate-500 uppercase font-semibold">1-Min Total</span>
              <div className="text-lg font-black text-blue-600 font-mono mt-0.5">{zoneData?.events_last_1m ?? 0}</div>
            </div>
            <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
              <span className="text-[10px] text-slate-500 uppercase font-semibold">Today Total</span>
              <div className="text-lg font-black text-indigo-600 font-mono mt-0.5">{zoneData?.total_events_today ?? 0}</div>
            </div>
          </div>

        </div>

        {/* Zone Vibration Risk Score Card (5 cols) */}
        <div className="lg:col-span-5 bg-white border border-slate-100 rounded-2xl p-6 shadow-soft flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-2 text-xs font-bold uppercase tracking-wider text-slate-600">
                <Gauge className="h-4 w-4 text-blue-600" />
                <span>ZONE VIBRATION RISK SCORE</span>
              </div>
              <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase border ${stabilityBadge.color}`}>
                {stabilityBadge.label}
              </span>
            </div>

            <div className="flex items-center justify-between mt-2">
              <div>
                <div className="text-4xl sm:text-5xl font-black text-slate-900 font-mono flex items-baseline">
                  <span>{riskScore}</span>
                  <span className="text-base text-slate-400 font-normal ml-1">/100</span>
                </div>
                <div className="mt-1">
                  <span className={`px-2.5 py-0.5 rounded-md text-xs font-bold uppercase ${
                    riskScore >= 76 ? 'bg-rose-100 text-rose-700' :
                    riskScore >= 51 ? 'bg-orange-100 text-orange-700' :
                    riskScore >= 26 ? 'bg-amber-100 text-amber-800' :
                    'bg-emerald-100 text-emerald-700'
                  }`}>
                    {zoneData?.risk_label || 'SAFE'} RISK
                  </span>
                </div>
              </div>

              {/* Score Circular Progress Gauge */}
              <div className="w-24 h-24 relative flex items-center justify-center">
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                  <path
                    className="text-slate-100"
                    strokeWidth="3.5"
                    stroke="currentColor"
                    fill="none"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                  <path
                    className={
                      riskScore >= 76 ? 'text-rose-500' :
                      riskScore >= 51 ? 'text-orange-500' :
                      riskScore >= 26 ? 'text-amber-500' :
                      'text-emerald-500'
                    }
                    strokeDasharray={`${riskScore}, 100`}
                    strokeWidth="3.5"
                    strokeLinecap="round"
                    stroke="currentColor"
                    fill="none"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <Zap className={`h-5 w-5 ${
                    riskScore >= 76 ? 'text-rose-500' :
                    riskScore >= 51 ? 'text-orange-500' :
                    riskScore >= 26 ? 'text-amber-500' :
                    'text-emerald-500'
                  }`} />
                </div>
              </div>
            </div>

            {/* Score Brackets */}
            <div className="mt-4 grid grid-cols-4 gap-1.5 text-[10px] text-center font-bold font-mono">
              <div className={`p-1 rounded ${riskScore <= 25 ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-50 text-slate-500'}`}>0-25 SAFE</div>
              <div className={`p-1 rounded ${riskScore > 25 && riskScore <= 50 ? 'bg-amber-100 text-amber-800' : 'bg-slate-50 text-slate-500'}`}>26-50 MON</div>
              <div className={`p-1 rounded ${riskScore > 50 && riskScore <= 75 ? 'bg-orange-100 text-orange-800' : 'bg-slate-50 text-slate-500'}`}>51-75 WARN</div>
              <div className={`p-1 rounded ${riskScore > 75 ? 'bg-rose-100 text-rose-800' : 'bg-slate-50 text-slate-500'}`}>76-100 CRIT</div>
            </div>
          </div>

          <p className="text-[11px] text-slate-400 mt-4 border-t border-slate-100 pt-2.5">
            * Vibration risk index computed from event density, frequency, and temporal trends.
          </p>
        </div>

      </div>

      {/* ========================================================= */}
      {/* 3. 8 KEY METRICS GRID                                     */}
      {/* ========================================================= */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3 sm:gap-4">

        {/* 1. Current Status */}
        <div className="bg-white border border-slate-100 p-3.5 rounded-2xl shadow-soft text-center flex flex-col justify-between">
          <span className="text-[10px] font-bold text-slate-500 uppercase">1. Status</span>
          <div className="text-xs font-black text-slate-900 mt-1 truncate">{currentStatus}</div>
          <span className="text-[9px] text-slate-400 mt-0.5">Live</span>
        </div>

        {/* 2. Vibration Event Count */}
        <div className="bg-white border border-slate-100 p-3.5 rounded-2xl shadow-soft text-center flex flex-col justify-between">
          <span className="text-[10px] font-bold text-slate-500 uppercase">2. Current Events</span>
          <div className="text-base font-black text-blue-600 font-mono mt-1">{currentEvents}</div>
          <span className="text-[9px] text-slate-400 mt-0.5">events</span>
        </div>

        {/* 3. Events in Last 10s */}
        <div className="bg-white border border-slate-100 p-3.5 rounded-2xl shadow-soft text-center flex flex-col justify-between">
          <span className="text-[10px] font-bold text-slate-500 uppercase">3. Last 10s</span>
          <div className="text-base font-black text-indigo-600 font-mono mt-1">{zoneData?.events_last_10s ?? currentEvents}</div>
          <span className="text-[9px] text-slate-400 mt-0.5">window</span>
        </div>

        {/* 4. Events in Last 1 Min */}
        <div className="bg-white border border-slate-100 p-3.5 rounded-2xl shadow-soft text-center flex flex-col justify-between">
          <span className="text-[10px] font-bold text-slate-500 uppercase">4. Last 1 Min</span>
          <div className="text-base font-black text-slate-800 font-mono mt-1">{zoneData?.events_last_1m ?? 0}</div>
          <span className="text-[9px] text-slate-400 mt-0.5">cumulative</span>
        </div>

        {/* 5. Last Detected Vibration */}
        <div className="bg-white border border-slate-100 p-3.5 rounded-2xl shadow-soft text-center flex flex-col justify-between">
          <span className="text-[10px] font-bold text-slate-500 uppercase">5. Last Pulse</span>
          <div className="text-xs font-bold text-slate-800 font-mono mt-1 truncate">
            {zoneData?.last_detected_ts ? new Date(zoneData.last_detected_ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : 'None'}
          </div>
          <span className="text-[9px] text-slate-400 mt-0.5">time</span>
        </div>

        {/* 6. Warning Level */}
        <div className="bg-white border border-slate-100 p-3.5 rounded-2xl shadow-soft text-center flex flex-col justify-between">
          <span className="text-[10px] font-bold text-slate-500 uppercase">6. Warning Level</span>
          <div className={`text-xs font-black uppercase mt-1 ${
            riskScore >= 76 ? 'text-rose-600' :
            riskScore >= 51 ? 'text-orange-600' :
            riskScore >= 26 ? 'text-amber-600' :
            'text-emerald-600'
          }`}>
            {zoneData?.warning_level || 'SAFE'}
          </div>
          <span className="text-[9px] text-slate-400 mt-0.5">level</span>
        </div>

        {/* 7. Zone Safety Status */}
        <div className="bg-white border border-slate-100 p-3.5 rounded-2xl shadow-soft text-center flex flex-col justify-between">
          <span className="text-[10px] font-bold text-slate-500 uppercase">7. Zone Safety</span>
          <div className="text-xs font-extrabold text-slate-900 mt-1 truncate">{stability}</div>
          <span className="text-[9px] text-slate-400 mt-0.5">stability</span>
        </div>

        {/* 8. Total Events Today */}
        <div className="bg-white border border-slate-100 p-3.5 rounded-2xl shadow-soft text-center flex flex-col justify-between">
          <span className="text-[10px] font-bold text-slate-500 uppercase">8. Today Total</span>
          <div className="text-base font-black text-rose-600 font-mono mt-1">{zoneData?.total_events_today ?? 0}</div>
          <span className="text-[9px] text-slate-400 mt-0.5">events</span>
        </div>

      </div>

      {/* ========================================================= */}
      {/* 4. EARLY WARNING FEATURE & HAZARD PROGRESSION LADDER      */}
      {/* ========================================================= */}
      <div className={`rounded-2xl p-5 border shadow-soft ${
        zoneData?.early_warning?.active 
          ? 'bg-rose-50/80 border-rose-200' 
          : 'bg-white border-slate-100'
      }`}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          
          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              <ShieldAlert className={`h-5 w-5 ${zoneData?.early_warning?.active ? 'text-rose-600 animate-pulse' : 'text-blue-600'}`} />
              <h3 className="text-sm font-extrabold uppercase tracking-wide text-slate-900">
                Early Warning &amp; Hazard Progression
              </h3>
            </div>
            <p className="text-xs text-slate-600">
              {zoneData?.early_warning?.message || 'Zone vibration stability within safe limits.'}
            </p>
          </div>

          {/* 5-Step Hazard Progression */}
          <div className="flex items-center space-x-1 sm:space-x-2 text-[10px] sm:text-xs font-bold font-mono overflow-x-auto py-1">
            {[
              { step: 'NORMAL', label: '1. Normal', color: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
              { step: 'Increasing Activity', label: '2. Increasing', color: 'bg-blue-100 text-blue-800 border-blue-300' },
              { step: 'Warning', label: '3. Warning', color: 'bg-amber-100 text-amber-800 border-amber-300' },
              { step: 'High Vibration', label: '4. High Vib', color: 'bg-orange-100 text-orange-800 border-orange-300' },
              { step: 'Critical Zone', label: '5. Critical', color: 'bg-rose-100 text-rose-800 border-rose-300' }
            ].map((st) => {
              const currentStage = zoneData?.early_warning?.stage || 'NORMAL';
              const isCurrent = currentStage === st.step;
              return (
                <div
                  key={st.step}
                  className={`px-2.5 py-1.5 rounded-xl border transition-all ${
                    isCurrent
                      ? `${st.color} shadow-sm font-black ring-2 ring-blue-500/20`
                      : 'bg-slate-50 text-slate-400 border-slate-200'
                  }`}
                >
                  {st.label}
                </div>
              );
            })}
          </div>

        </div>
      </div>

      {/* ========================================================= */}
      {/* 5. VIBRATION TREND ANALYSIS                               */}
      {/* ========================================================= */}
      <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-soft">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5 pb-4 border-b border-slate-100">
          <div>
            <h3 className="text-sm font-extrabold uppercase tracking-wide text-slate-900 flex items-center space-x-2">
              <TrendingUp className="h-4 w-4 text-blue-600" />
              <span>Vibration Trend Analysis</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Moving comparison between previous and current 10-minute monitoring windows
            </p>
          </div>

          <div className={`flex items-center space-x-2 px-3 py-1.5 rounded-xl border text-xs font-bold ${
            zoneData?.trend?.direction === 'increasing' ? 'bg-rose-50 text-rose-700 border-rose-200' :
            zoneData?.trend?.direction === 'decreasing' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
            'bg-slate-50 text-slate-700 border-slate-200'
          }`}>
            {zoneData?.trend?.direction === 'increasing' ? <ArrowUpRight className="h-4 w-4 text-rose-600" /> :
             zoneData?.trend?.direction === 'decreasing' ? <ArrowDownRight className="h-4 w-4 text-emerald-600" /> :
             <Activity className="h-4 w-4 text-slate-500" />}
            <span>{zoneData?.trend?.message || 'Vibration activity is stable'}</span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          
          <div className="bg-slate-50/80 border border-slate-100 p-4 rounded-xl">
            <span className="text-xs text-slate-500 font-semibold uppercase">Previous 10-Min Window</span>
            <div className="text-2xl font-black text-slate-700 font-mono mt-1">
              {zoneData?.trend?.previous_10min_events ?? 0} <span className="text-xs font-normal text-slate-400">events</span>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">Historical baseline reference</p>
          </div>

          <div className="bg-slate-50/80 border border-slate-100 p-4 rounded-xl">
            <span className="text-xs text-slate-500 font-semibold uppercase">Current 10-Min Window</span>
            <div className="text-2xl font-black text-blue-600 font-mono mt-1">
              {zoneData?.trend?.current_10min_events ?? 0} <span className="text-xs font-normal text-slate-400">events</span>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">Active cumulative events</p>
          </div>

          <div className="bg-slate-50/80 border border-slate-100 p-4 rounded-xl">
            <span className="text-xs text-slate-500 font-semibold uppercase">Trend Delta</span>
            <div className="text-2xl font-black font-mono mt-1 flex items-center space-x-1.5">
              <span className={zoneData?.trend?.percentage_change > 0 ? 'text-rose-600' : 'text-emerald-600'}>
                {zoneData?.trend?.percentage_change > 0 ? `+${zoneData?.trend?.percentage_change}%` : `${zoneData?.trend?.percentage_change || 0}%`}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">Activity rate acceleration</p>
          </div>

        </div>
      </div>

      {/* ========================================================= */}
      {/* 6. CHARTS & VISUALIZATION (REALTIME GRAPH & FREQUENCY)     */}
      {/* ========================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* Chart A: Real-Time Vibration Activity Graph (7 cols) */}
        <div className="lg:col-span-7 bg-white border border-slate-100 rounded-2xl p-6 shadow-soft">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-extrabold uppercase tracking-wide text-slate-900 flex items-center space-x-2">
                <Activity className="h-4 w-4 text-blue-600" />
                <span>A. Real-Time Vibration Activity Graph</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Vibration events and activity timeline
              </p>
            </div>
            <span className="text-[11px] font-mono text-slate-500 bg-slate-100 px-2.5 py-1 rounded-lg">
              Live Stream
            </span>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartPoints}>
                <defs>
                  <linearGradient id="vibLightGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#3B82F6" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                <XAxis dataKey="timeStr" stroke="#94A3B8" fontSize={10} tickLine={false} />
                <YAxis stroke="#94A3B8" fontSize={10} tickLine={false} domain={[0, 'auto']} />
                <Tooltip content={<CustomChartTooltip />} />
                <ReferenceLine y={11} stroke="#F97316" strokeDasharray="3 3" label={{ value: 'High (11)', fill: '#F97316', fontSize: 9 }} />
                <ReferenceLine y={21} stroke="#EF4444" strokeDasharray="3 3" label={{ value: 'Critical (21)', fill: '#EF4444', fontSize: 9 }} />
                <Area type="monotone" dataKey="events" stroke="#2563EB" strokeWidth={2.5} fillOpacity={1} fill="url(#vibLightGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart B: Vibration Event Frequency Chart (5 cols) */}
        <div className="lg:col-span-5 bg-white border border-slate-100 rounded-2xl p-6 shadow-soft">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-extrabold uppercase tracking-wide text-slate-900 flex items-center space-x-2">
                <BarChart className="h-4 w-4 text-indigo-600" />
                <span>B. Event Frequency Chart</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Events per 10-second monitoring window
              </p>
            </div>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartPoints.slice(-12)}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                <XAxis dataKey="timeStr" stroke="#94A3B8" fontSize={9} tickLine={false} />
                <YAxis stroke="#94A3B8" fontSize={10} tickLine={false} />
                <Tooltip content={<CustomChartTooltip />} />
                <Bar dataKey="events" radius={[6, 6, 0, 0]}>
                  {chartPoints.slice(-12).map((entry, index) => {
                    let color = '#10B981';
                    if (entry.events >= 21) color = '#EF4444';
                    else if (entry.events >= 11) color = '#F97316';
                    else if (entry.events >= 6) color = '#F59E0B';
                    else if (entry.events >= 3) color = '#3B82F6';
                    return <Cell key={`cell-${index}`} fill={color} />;
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>

      {/* ========================================================= */}
      {/* 7. SEVERITY DISTRIBUTION & RECENT EVENTS TIMELINE          */}
      {/* ========================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* Chart C: Severity Distribution (5 cols) */}
        <div className="lg:col-span-5 bg-white border border-slate-100 rounded-2xl p-6 shadow-soft flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-extrabold uppercase tracking-wide text-slate-900 flex items-center space-x-2 mb-1">
              <PieChart className="h-4 w-4 text-indigo-600" />
              <span>C. Vibration Severity Distribution</span>
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Historical proportional breakdown by severity level
            </p>

            <div className="h-48 w-full flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    dataKey="count"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={75}
                    paddingAngle={3}
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`slice-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value, name) => [`${value} readings`, name]} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Legend Table */}
          <div className="grid grid-cols-5 gap-1.5 text-center text-[10px] font-mono font-bold mt-2">
            {(zoneData?.severity_distribution || []).map(item => (
              <div key={item.level} className="bg-slate-50 p-1.5 rounded-xl border border-slate-100">
                <div className="h-2 w-2 rounded-full mx-auto mb-1" style={{ backgroundColor: item.color }}></div>
                <div className="text-slate-500">{item.name}</div>
                <div className="text-slate-900 mt-0.5">{item.percentage}%</div>
              </div>
            ))}
          </div>

        </div>

        {/* List D: Timeline of Recent Vibration Events (7 cols) */}
        <div className="lg:col-span-7 bg-white border border-slate-100 rounded-2xl p-6 shadow-soft">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-extrabold uppercase tracking-wide text-slate-900 flex items-center space-x-2">
                <Clock className="h-4 w-4 text-blue-600" />
                <span>D. Timeline of Recent Vibration Events</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Chronological ledger of detected vibration spikes
              </p>
            </div>
            <span className="text-[11px] text-slate-400 font-mono">
              Last {zoneData?.recent_timeline?.length || 0} events
            </span>
          </div>

          <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
            {(!zoneData?.recent_timeline || zoneData.recent_timeline.length === 0) ? (
              <div className="text-center py-8 text-slate-400 text-xs font-medium space-y-1">
                <p className="font-semibold text-slate-600">
                  {isPhysicalStation 
                    ? '🟢 Physical HW-072 sensor connected on GPIO 26.' 
                    : 'No abnormal vibration events recorded yet.'}
                </p>
                <p className="text-[11px] text-slate-400">
                  {isPhysicalStation 
                    ? 'Standing by for live vibration/impact triggers from physical hardware.' 
                    : 'Operating within baseline stability thresholds.'}
                </p>
              </div>
            ) : (
              zoneData.recent_timeline.map((evt, idx) => {
                let badgeColor = 'bg-emerald-50 text-emerald-700 border-emerald-200';
                if (evt.level === 'CRITICAL') badgeColor = 'bg-rose-600 text-white border-rose-600 animate-pulse';
                else if (evt.level === 'HIGH') badgeColor = 'bg-orange-500 text-white border-orange-500';
                else if (evt.level === 'MODERATE') badgeColor = 'bg-amber-100 text-amber-800 border-amber-300';
                else if (evt.level === 'LOW') badgeColor = 'bg-blue-100 text-blue-800 border-blue-200';

                return (
                  <div
                    key={evt.id || idx}
                    className="flex items-center justify-between p-3 rounded-xl bg-slate-50/80 border border-slate-100 hover:bg-slate-100/70 transition-colors text-xs"
                  >
                    <div className="flex items-center space-x-3">
                      <span className="font-mono text-slate-500 font-bold">{evt.timeStr}</span>
                      <span className="text-slate-300">→</span>
                      <span className={`px-2.5 py-0.5 rounded-lg font-bold uppercase text-[10px] border ${badgeColor}`}>
                        {evt.level}
                      </span>
                    </div>

                    <div className="flex items-center space-x-3">
                      <span className="font-mono text-slate-700">
                        <strong className="text-slate-900">{evt.events}</strong> events / 10s
                      </span>
                      <span className="text-[11px] text-slate-400 hidden sm:inline">
                        {evt.zone}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>

        </div>

      </div>

    </div>
  );
}
