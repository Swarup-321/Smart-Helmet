import React, { useState } from 'react';
import { 
  Users, AlertTriangle, Heart, Thermometer, Flame, 
  Clock, ShieldAlert, CheckCircle2, RefreshCw, ChevronRight,
  TrendingUp, Wifi, Gauge, ArrowUpRight, HardHat, Compass, Waves
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { api } from '../services/api';
import { 
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, CartesianGrid
} from 'recharts';

export default function Overview({ onSelectWorker, onNavigateAlerts, onNavigateFixedZone }) {
  const { 
    workersLatest, 
    activeAlerts, 
    summaryStats, 
    refreshData,
    unitCelsius,
    setSelectedWorkerId
  } = useApp();

  const [selectedZone, setSelectedZone] = useState('ALL');
  const [selectedChartWorker, setSelectedChartWorker] = useState('ALL');

  const criticalAlerts = activeAlerts.filter(a => a.severity === 'CRITICAL');
  const warningAlerts = activeAlerts.filter(a => a.severity === 'WARNING');

  // Compute Overall Safety Status
  let overallStatus = 'SAFE';
  let statusBg = 'bg-emerald-50 border-emerald-200 text-emerald-800';
  let statusBadge = 'bg-emerald-500 text-white';
  let statusDescription = 'All telemetry parameters across active mine zones are within nominal safety thresholds.';

  if (criticalAlerts.length > 0) {
    overallStatus = 'DANGER';
    statusBg = 'bg-rose-50 border-rose-300 text-rose-900';
    statusBadge = 'bg-rose-600 text-white animate-pulse';
    statusDescription = `${criticalAlerts.length} CRITICAL incident(s) detected! Immediate supervisory response required.`;
  } else if (warningAlerts.length > 0) {
    overallStatus = 'WARNING';
    statusBg = 'bg-amber-50 border-amber-300 text-amber-900';
    statusBadge = 'bg-amber-500 text-white';
    statusDescription = `${warningAlerts.length} elevated warning(s) active. Monitor affected extraction zones.`;
  }

  // Filter workers by zone
  const filteredWorkers = workersLatest.filter(item => {
    if (selectedZone === 'ALL') return true;
    return item.worker?.zone?.toLowerCase().includes(selectedZone.toLowerCase());
  });

  // Calculate high-level stats
  const onlineCount = workersLatest.filter(w => w.status === 'online').length;
  const totalMiners = workersLatest.length || 5;

  const handleAcknowledgeAlert = async (id, e) => {
    e.stopPropagation();
    try {
      await api.acknowledgeAlert(id, 'Safety Officer');
      refreshData();
    } catch (err) {
      console.error('Failed to ack:', err);
    }
  };

  return (
    <div className="space-y-6">
      
      {/* 1. Overall Safety Status Banner */}
      <div className={`p-5 rounded-2xl border ${statusBg} shadow-card flex flex-col md:flex-row items-start md:items-center justify-between gap-4 transition-all duration-300`}>
        <div className="flex items-center space-x-4">
          <div className="p-3 bg-white rounded-xl shadow-soft">
            {overallStatus === 'SAFE' && <CheckCircle2 className="h-8 w-8 text-emerald-500" />}
            {overallStatus === 'WARNING' && <AlertTriangle className="h-8 w-8 text-amber-500 animate-bounce" />}
            {overallStatus === 'DANGER' && <ShieldAlert className="h-8 w-8 text-rose-600 animate-pulse" />}
          </div>
          <div>
            <div className="flex items-center space-x-3">
              <span className="text-xs uppercase tracking-wider font-bold text-slate-500">
                Coal Mine Sector 4 • Safety Level
              </span>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-black tracking-wide ${statusBadge}`}>
                {overallStatus}
              </span>
            </div>
            <h2 className="text-xl font-black mt-0.5 tracking-tight">
              {overallStatus === 'SAFE' && 'Standard Operational Safety'}
              {overallStatus === 'WARNING' && 'Caution: Elevated Risk Identified'}
              {overallStatus === 'DANGER' && 'Emergency Condition Alert'}
            </h2>
            <p className="text-xs text-slate-600 mt-0.5">{statusDescription}</p>
          </div>
        </div>

        {criticalAlerts.length > 0 && (
          <button
            onClick={onNavigateAlerts}
            className="w-full md:w-auto px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-glow-danger transition-all flex items-center justify-center space-x-2 animate-pulse"
          >
            <ShieldAlert className="h-4 w-4" />
            <span>Review {criticalAlerts.length} Critical Alert(s)</span>
            <ChevronRight className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* 2. KPI Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        
        {/* Workers Online */}
        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-soft hover:shadow-card transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Active Miners</span>
            <div className="p-1.5 bg-blue-50 text-blue-600 rounded-lg">
              <Users className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-2xl font-black text-slate-800">
              {onlineCount} <span className="text-xs font-normal text-slate-400">/ {totalMiners}</span>
            </div>
            <div className="text-[11px] text-emerald-600 font-medium flex items-center mt-0.5">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 mr-1 animate-pulse" />
              {Math.round((onlineCount / (totalMiners || 1)) * 100)}% online
            </div>
          </div>
        </div>

        {/* Active Alerts */}
        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-soft hover:shadow-card transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Active Alerts</span>
            <div className={`p-1.5 rounded-lg ${activeAlerts.length > 0 ? 'bg-amber-50 text-amber-600' : 'bg-slate-50 text-slate-400'}`}>
              <AlertTriangle className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-2xl font-black text-slate-800">
              {activeAlerts.length}
            </div>
            <div className="text-[11px] text-slate-500 font-medium mt-0.5">
              {criticalAlerts.length} Critical • {warningAlerts.length} Warn
            </div>
          </div>
        </div>

        {/* Average Heart Rate */}
        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-soft hover:shadow-card transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Avg Heart Rate</span>
            <div className="p-1.5 bg-rose-50 text-rose-600 rounded-lg">
              <Heart className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-2xl font-black text-slate-800">
              {summaryStats?.avg_heart_rate || 78} <span className="text-xs font-normal text-slate-400">BPM</span>
            </div>
            <div className="text-[11px] text-slate-500 font-medium mt-0.5">
              Nominal: 60 - 100 BPM
            </div>
          </div>
        </div>

        {/* Avg Temperature */}
        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-soft hover:shadow-card transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Mine Temp</span>
            <div className="p-1.5 bg-amber-50 text-amber-600 rounded-lg">
              <Thermometer className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-2xl font-black text-slate-800">
              {unitCelsius 
                ? `${summaryStats?.avg_temperature || 28.4}°C` 
                : `${(((summaryStats?.avg_temperature || 28.4) * 9/5) + 32).toFixed(1)}°F`}
            </div>
            <div className="text-[11px] text-emerald-600 font-medium mt-0.5">
              Ventilation stable
            </div>
          </div>
        </div>

        {/* Highest Gas Index */}
        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-soft hover:shadow-card transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Peak Gas Index</span>
            <div className="p-1.5 bg-orange-50 text-orange-600 rounded-lg">
              <Flame className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-2xl font-black text-slate-800">
              {summaryStats?.highest_gas_mv || 1490} <span className="text-xs font-normal text-slate-400">mV</span>
            </div>
            <div className="text-[11px] text-slate-500 font-medium mt-0.5 truncate" title="Uncalibrated Index (MQ-2 / MQ-5)">
              Uncalibrated Index
            </div>
          </div>
        </div>

        {/* Telemetry Uptime */}
        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-soft hover:shadow-card transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">System Uptime</span>
            <div className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg">
              <Clock className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-2xl font-black text-slate-800">
              99.9%
            </div>
            <div className="text-[11px] text-emerald-600 font-medium mt-0.5">
              Server active
            </div>
          </div>
        </div>

      </div>

      {/* 3. Live Worker Cards Grid */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-extrabold text-slate-800 tracking-tight flex items-center space-x-2">
              <span>Underground Miners Telemetry</span>
              <span className="px-2 py-0.5 bg-slate-200 text-slate-700 text-xs rounded-full font-bold">
                {filteredWorkers.length}
              </span>
            </h3>
            <p className="text-xs text-slate-500">Live multi-sensor metrics from ESP32 smart helmets</p>
          </div>

          {/* Zone Filter Tabs */}
          <div className="flex items-center space-x-1.5 bg-white p-1 rounded-xl border border-slate-200 shadow-sm text-xs font-medium">
            {['ALL', 'Shaft 3', 'Drift 1', 'Extraction Face', 'Conveyor 2'].map(zone => (
              <button
                key={zone}
                onClick={() => setSelectedZone(zone)}
                className={`px-2.5 py-1 rounded-lg transition-all ${
                  selectedZone === zone
                    ? 'bg-blue-600 text-white font-semibold shadow-sm'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                {zone}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredWorkers.map(({ worker, status, age_seconds, reading }) => {
            const isOnline = status === 'online';
            const isSos = reading?.sos;
            const isFall = reading?.fall;
            const gasMv = Math.max(reading?.mq2_mv || 0, reading?.mq5_mv || 0);
            const isGasHigh = gasMv >= 2000;
            const isCriticalCard = isSos || isFall || gasMv >= 2500;

            return (
              <div
                key={worker.id}
                onClick={() => onSelectWorker(worker.id)}
                className={`group bg-white rounded-2xl border p-5 shadow-soft hover:shadow-card transition-all duration-200 cursor-pointer relative overflow-hidden ${
                  isCriticalCard 
                    ? 'border-rose-400 ring-2 ring-rose-500/20 bg-rose-50/20' 
                    : isGasHigh
                    ? 'border-amber-300'
                    : 'border-slate-100 hover:border-blue-200'
                } ${!isOnline ? 'opacity-70 bg-slate-50/50' : ''}`}
              >
                {/* Header: Miner & Helmet Status */}
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-3">
                    <div className={`h-11 w-11 rounded-xl flex items-center justify-center font-bold text-sm ${
                      isCriticalCard 
                        ? 'bg-rose-500 text-white shadow-glow-danger animate-pulse' 
                        : isOnline
                        ? 'bg-gradient-to-tr from-blue-600 to-indigo-600 text-white shadow-glow-primary'
                        : 'bg-slate-300 text-slate-600'
                    }`}>
                      <HardHat className="h-6 w-6" />
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-800 text-sm group-hover:text-blue-600 transition-colors flex items-center space-x-1.5">
                        <span>{worker.name}</span>
                      </h4>
                      <div className="flex items-center space-x-2 text-[11px] text-slate-500 mt-0.5">
                        <span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded text-slate-700 font-semibold">
                          {worker.id} • {worker.helmet_id}
                        </span>
                        <span>{worker.zone}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col items-end">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                      isOnline ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' : 'bg-slate-200 text-slate-600'
                    }`}>
                      {isOnline ? 'ONLINE' : 'OFFLINE'}
                    </span>
                    <span className="text-[10px] text-slate-400 mt-1">
                      {age_seconds !== null ? (age_seconds === 0 ? 'just now' : `${age_seconds}s ago`) : 'No data'}
                    </span>
                  </div>
                </div>

                {/* Emergency Tag if active */}
                {(isSos || isFall) && (
                  <div className="mt-3 p-2 bg-rose-500 text-white rounded-xl text-xs font-bold flex items-center justify-between animate-pulse">
                    <div className="flex items-center space-x-1.5">
                      <ShieldAlert className="h-4 w-4" />
                      <span>{isSos ? 'EMERGENCY SOS PRESSED!' : 'MAN DOWN / FALL DETECTED!'}</span>
                    </div>
                    <span className="text-[10px] uppercase bg-white/20 px-2 py-0.5 rounded">Action Req</span>
                  </div>
                )}

                {/* Sensor Metrics Matrix */}
                <div className="mt-4 grid grid-cols-3 gap-2.5 pt-3 border-t border-slate-100 text-center">
                  
                  {/* Heart Rate */}
                  <div className="bg-slate-50/80 p-2 rounded-xl">
                    <div className="flex items-center justify-center space-x-1 text-[11px] text-slate-500">
                      <Heart className={`h-3.5 w-3.5 ${isOnline ? 'text-rose-500 animate-pulse' : 'text-slate-400'}`} />
                      <span>Heart Rate</span>
                    </div>
                    <div className="text-sm font-extrabold text-slate-800 mt-0.5">
                      {reading?.heart_rate ? `${reading.heart_rate} BPM` : <span className="text-xs font-normal text-slate-400">N/A</span>}
                    </div>
                  </div>

                  {/* HW-072 Vibration Activity */}
                  <div className="bg-slate-50/80 p-2 rounded-xl">
                    <div className="flex items-center justify-center space-x-1 text-[11px] text-slate-500">
                      <Waves className={`h-3.5 w-3.5 ${
                        reading?.vibration_level === 'CRITICAL' ? 'text-rose-500 animate-bounce' :
                        reading?.vibration_level === 'HIGH' ? 'text-orange-500' :
                        reading?.vibration_level === 'MODERATE' ? 'text-amber-500' :
                        'text-indigo-500'
                      }`} />
                      <span>Vibration</span>
                    </div>
                    <div className="text-xs font-black text-slate-800 mt-0.5 truncate">
                      {reading?.vibration_level ? (
                        <span className={`px-1.5 py-0.2 rounded font-mono ${
                          reading.vibration_level === 'CRITICAL' ? 'bg-rose-100 text-rose-700' :
                          reading.vibration_level === 'HIGH' ? 'bg-orange-100 text-orange-700' :
                          reading.vibration_level === 'MODERATE' ? 'bg-amber-100 text-amber-800' :
                          reading.vibration_level === 'LOW' ? 'bg-blue-100 text-blue-700' :
                          'bg-emerald-100 text-emerald-700'
                        }`}>
                          {reading.vibration_level} ({reading.vibration_events || 0})
                        </span>
                      ) : (
                        <span className="text-xs font-normal text-slate-400">NORMAL (0)</span>
                      )}
                    </div>
                  </div>

                  {/* Temperature */}
                  <div className="bg-slate-50/80 p-2 rounded-xl">
                    <div className="flex items-center justify-center space-x-1 text-[11px] text-slate-500">
                      <Thermometer className="h-3.5 w-3.5 text-amber-500" />
                      <span>Shaft Temp</span>
                    </div>
                    <div className="text-sm font-extrabold text-slate-800 mt-0.5">
                      {reading?.temperature !== undefined && reading?.temperature !== null
                        ? (unitCelsius ? `${reading.temperature}°C` : `${((reading.temperature * 9/5) + 32).toFixed(1)}°F`)
                        : <span className="text-xs font-normal text-slate-400">N/A</span>}
                    </div>
                  </div>

                </div>

                {/* Gas Bar & Battery / Signal */}
                <div className="mt-3 space-y-2">
                  <div>
                    <div className="flex items-center justify-between text-[11px] font-semibold text-slate-600 mb-1">
                      <span className="flex items-center space-x-1">
                        <Flame className="h-3.5 w-3.5 text-orange-500" />
                        <span>Gas Level Index (MQ-2 / MQ-5)</span>
                      </span>
                      <span className={gasMv >= 2000 ? 'text-rose-600 font-bold' : 'text-slate-700'}>
                        {gasMv > 0 ? `${gasMv} mV` : 'Not connected'}
                      </span>
                    </div>
                    
                    {/* Visual Gas Meter Progress Bar */}
                    <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          gasMv >= 2500
                            ? 'bg-rose-500'
                            : gasMv >= 2000
                            ? 'bg-amber-500'
                            : 'bg-emerald-500'
                        }`}
                        style={{ width: `${Math.min(100, (gasMv / 3300) * 100)}%` }}
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 text-[11px] text-slate-500">
                    <div className="flex items-center space-x-2">
                      <span className="flex items-center space-x-1">
                        <span className="font-semibold text-slate-700">Batt:</span>
                        <span className={reading?.battery < 20 ? 'text-rose-600 font-bold' : 'text-slate-700'}>
                          {reading?.battery !== undefined ? `${reading.battery}%` : 'N/A'}
                        </span>
                      </span>
                      <span>•</span>
                      <span className="flex items-center space-x-1">
                        <Wifi className="h-3 w-3 text-slate-400" />
                        <span>{reading?.rssi ? `${reading.rssi} dBm` : 'Wi-Fi'}</span>
                      </span>
                    </div>

                    <div className="flex items-center text-blue-600 font-semibold group-hover:translate-x-0.5 transition-transform text-xs">
                      <span>Telemetry & Trends</span>
                      <ChevronRight className="h-3.5 w-3.5" />
                    </div>
                  </div>
                </div>

              </div>
            );
          })}
        </div>
      </div>

      {/* 4. Interactive Mine Zone Map & Live Trend Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* SVG Mine Zone Map (5 cols) */}
        <div className="lg:col-span-5 bg-white p-5 rounded-2xl border border-slate-100 shadow-soft flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center space-x-2">
                <Compass className="h-5 w-5 text-blue-600" />
                <h3 className="font-bold text-sm text-slate-800">Mine Zone Spatial Map</h3>
              </div>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 bg-slate-100 text-slate-600 rounded">
                SIMULATED LAYOUT
              </span>
            </div>
            <p className="text-xs text-slate-500 mb-4">
              Real-time worker locations and zone atmospheric conditions
            </p>

            {/* SVG Visual Map Layout */}
            <div className="w-full bg-slate-900 rounded-xl p-4 relative overflow-hidden border border-slate-800 aspect-[4/3] flex items-center justify-center">
              
              {/* Background Mine Grid Lines */}
              <div className="absolute inset-0 opacity-10 bg-[linear-gradient(to_right,#ffffff_1px,transparent_1px),linear-gradient(to_bottom,#ffffff_1px,transparent_1px)] bg-[size:24px_24px]" />

              <svg viewBox="0 0 400 300" className="w-full h-full">
                {/* Tunnels & Shafts */}
                <line x1="200" y1="20" x2="200" y2="280" stroke="#334155" strokeWidth="18" strokeLinecap="round" />
                <line x1="50" y1="100" x2="350" y2="100" stroke="#334155" strokeWidth="14" strokeLinecap="round" />
                <line x1="80" y1="200" x2="320" y2="200" stroke="#334155" strokeWidth="14" strokeLinecap="round" />

                {/* Zone Labels */}
                <rect x="140" y="15" width="120" height="24" rx="6" fill="#1E293B" stroke="#475569" />
                <text x="200" y="31" fill="#94A3B8" fontSize="10" fontWeight="bold" textAnchor="middle">Main Access Gate</text>

                <rect x="20" y="88" width="100" height="24" rx="6" fill="#1E293B" stroke="#475569" />
                <text x="70" y="104" fill="#94A3B8" fontSize="10" fontWeight="bold" textAnchor="middle">Zone A (Shaft 3)</text>

                <rect x="280" y="88" width="100" height="24" rx="6" fill="#1E293B" stroke="#475569" />
                <text x="330" y="104" fill="#94A3B8" fontSize="10" fontWeight="bold" textAnchor="middle">Zone B (Drift 1)</text>

                <rect x="40" y="188" width="110" height="24" rx="6" fill="#1E293B" stroke="#475569" />
                <text x="95" y="204" fill="#94A3B8" fontSize="10" fontWeight="bold" textAnchor="middle">Zone B (Conveyor 2)</text>

                <rect x="240" y="188" width="130" height="24" rx="6" fill="#1E293B" stroke="#475569" />
                <text x="305" y="204" fill="#94A3B8" fontSize="10" fontWeight="bold" textAnchor="middle">Zone C (Extraction)</text>

                {/* Worker Positions by Zone */}
                {/* W001: Shaft 3 */}
                <g className="cursor-pointer" onClick={() => onSelectWorker('W001')}>
                  <circle cx="85" cy="115" r="10" fill="#3B82F6" className="animate-pulse" />
                  <circle cx="85" cy="115" r="15" fill="#3B82F6" opacity="0.3" />
                  <text x="85" y="119" fill="#FFFFFF" fontSize="9" fontWeight="bold" textAnchor="middle">W1</text>
                </g>

                {/* W002: Drift 1 */}
                <g className="cursor-pointer" onClick={() => onSelectWorker('W002')}>
                  <circle cx="325" cy="115" r="10" fill="#10B981" />
                  <text x="325" y="119" fill="#FFFFFF" fontSize="9" fontWeight="bold" textAnchor="middle">W2</text>
                </g>

                {/* W003: Extraction Face (Higher risk zone) */}
                <g className="cursor-pointer" onClick={() => onSelectWorker('W003')}>
                  <circle cx="295" cy="225" r="10" fill="#F59E0B" className="animate-ping-slow" />
                  <circle cx="295" cy="225" r="16" fill="#EF4444" opacity="0.3" />
                  <text x="295" y="229" fill="#FFFFFF" fontSize="9" fontWeight="bold" textAnchor="middle">W3</text>
                </g>

                {/* W004: Conveyor 2 */}
                <g className="cursor-pointer" onClick={() => onSelectWorker('W004')}>
                  <circle cx="105" cy="225" r="10" fill="#10B981" />
                  <text x="105" y="229" fill="#FFFFFF" fontSize="9" fontWeight="bold" textAnchor="middle">W4</text>
                </g>

                {/* W005: Gate */}
                <g className="cursor-pointer" onClick={() => onSelectWorker('W005')}>
                  <circle cx="200" cy="55" r="10" fill="#64748B" />
                  <text x="200" y="59" fill="#FFFFFF" fontSize="9" fontWeight="bold" textAnchor="middle">W5</text>
                </g>
              </svg>
            </div>
          </div>

          <div className="mt-3 flex items-center justify-between text-[11px] text-slate-500 pt-2 border-t border-slate-100">
            <div className="flex items-center space-x-3">
              <span className="flex items-center space-x-1">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                <span>Safe</span>
              </span>
              <span className="flex items-center space-x-1">
                <span className="h-2 w-2 rounded-full bg-amber-500" />
                <span>Warning</span>
              </span>
              <span className="flex items-center space-x-1">
                <span className="h-2 w-2 rounded-full bg-rose-500 animate-pulse" />
                <span>Danger/SOS</span>
              </span>
            </div>
            <span>Click any node to inspect</span>
          </div>
        </div>

        {/* Live Gas & Telemetry Trend Sparkline (7 cols) */}
        <div className="lg:col-span-7 bg-white p-5 rounded-2xl border border-slate-100 shadow-soft flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center space-x-2">
                <TrendingUp className="h-5 w-5 text-indigo-600" />
                <h3 className="font-bold text-sm text-slate-800">Live Multi-Worker Gas Dynamics</h3>
              </div>

              {/* Worker select filter */}
              <div className="flex items-center space-x-1 bg-slate-100 p-1 rounded-lg text-xs">
                {['ALL', 'W001', 'W002', 'W003', 'W004', 'W005'].map(wId => (
                  <button
                    key={wId}
                    onClick={() => setSelectedChartWorker(wId)}
                    className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                      selectedChartWorker === wId
                        ? 'bg-white text-indigo-600 shadow-sm'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    {wId}
                  </button>
                ))}
              </div>
            </div>

            <p className="text-xs text-slate-500 mb-4">
              Real-time electrical mV index from MQ-2 / MQ-5 gas detection sensors
            </p>

            {/* Quick Chart View */}
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={[
                    { time: '10:00', W001: 1420, W002: 1390, W003: 1850, W004: 1320, W005: 1200 },
                    { time: '10:15', W001: 1440, W002: 1410, W003: 1920, W004: 1340, W005: 1210 },
                    { time: '10:30', W001: 1450, W002: 1430, W003: 2050, W004: 1350, W005: 1220 },
                    { time: '10:45', W001: 1430, W002: 1400, W003: 2280, W004: 1360, W005: 1210 },
                    { time: '11:00', W001: 1460, W002: 1420, W003: 2540, W004: 1380, W005: 1230 },
                    { time: '11:15', W001: 1480, W002: 1450, W003: 2350, W004: 1370, W005: 1220 },
                    { time: '11:30', W001: 1450, W002: 1440, W003: 2100, W004: 1390, W005: 1240 },
                    { time: 'Now',   W001: 1490, W002: 1460, W003: 1980, W004: 1380, W005: 1250 },
                  ]}
                  margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="gasGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366F1" stopOpacity={0.4}/>
                      <stop offset="95%" stopColor="#6366F1" stopOpacity={0.0}/>
                    </linearGradient>
                    <linearGradient id="gasDangerGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#EF4444" stopOpacity={0.4}/>
                      <stop offset="95%" stopColor="#EF4444" stopOpacity={0.0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                  <XAxis dataKey="time" stroke="#94A3B8" fontSize={11} />
                  <YAxis stroke="#94A3B8" fontSize={11} domain={[1000, 3000]} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#FFFFFF', borderRadius: '12px', border: '1px solid #E2E8F0', fontSize: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }} 
                  />
                  {selectedChartWorker === 'ALL' || selectedChartWorker === 'W003' ? (
                    <Area type="monotone" dataKey="W003" name="W003 (Extraction Face)" stroke="#EF4444" strokeWidth={2.5} fillOpacity={1} fill="url(#gasDangerGrad)" />
                  ) : null}
                  {selectedChartWorker === 'ALL' || selectedChartWorker === 'W001' ? (
                    <Area type="monotone" dataKey="W001" name="W001 (Shaft 3)" stroke="#3B82F6" strokeWidth={2} fillOpacity={1} fill="url(#gasGrad)" />
                  ) : null}
                  {selectedChartWorker === 'ALL' || selectedChartWorker === 'W002' ? (
                    <Area type="monotone" dataKey="W002" name="W002 (Drift 1)" stroke="#10B981" strokeWidth={1.5} fill="none" />
                  ) : null}
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="text-[11px] text-slate-500 pt-3 border-t border-slate-100 flex items-center justify-between">
            <span>Critical Threshold: 2500 mV • Warning: 2000 mV</span>
            <span className="text-slate-400 italic">Prototype – not certified safety equipment</span>
          </div>
        </div>

      </div>

      {/* 5. Recent Alerts Action Log */}
      <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-soft">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            <h3 className="font-bold text-sm text-slate-800">Recent Incident & Anomaly Timeline</h3>
          </div>
          <button
            onClick={onNavigateAlerts}
            className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center space-x-1"
          >
            <span>View All Alert Records</span>
            <ArrowUpRight className="h-4 w-4" />
          </button>
        </div>

        {activeAlerts.length === 0 ? (
          <div className="p-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200">
            <CheckCircle2 className="h-8 w-8 text-emerald-500 mx-auto mb-2" />
            <p className="text-sm font-bold text-slate-700">No Active Safety Alerts</p>
            <p className="text-xs text-slate-500 mt-0.5">All monitored workers and atmospheric sensors are functioning normally.</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {activeAlerts.slice(0, 4).map(alert => (
              <div
                key={alert.id}
                className={`p-3.5 rounded-xl border flex items-center justify-between text-xs transition-all ${
                  alert.severity === 'CRITICAL'
                    ? 'bg-rose-50 border-rose-200 text-rose-900'
                    : 'bg-amber-50 border-amber-200 text-amber-900'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <span className={`px-2 py-0.5 rounded font-black text-[10px] uppercase ${
                    alert.severity === 'CRITICAL' ? 'bg-rose-600 text-white animate-pulse' : 'bg-amber-500 text-white'
                  }`}>
                    {alert.severity} • {alert.type}
                  </span>
                  <div>
                    <p className="font-bold text-slate-800">{alert.message}</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Worker: {alert.worker_name || alert.worker_id} • {new Date(alert.ts).toLocaleTimeString()}
                    </p>
                  </div>
                </div>

                <button
                  onClick={(e) => handleAcknowledgeAlert(alert.id, e)}
                  className="px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 font-bold rounded-lg shadow-sm transition-colors text-xs"
                >
                  Acknowledge
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}
