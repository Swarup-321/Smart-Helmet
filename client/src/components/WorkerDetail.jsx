import React, { useState, useEffect } from 'react';
import { 
  ArrowLeft, Heart, Thermometer, Flame, Droplet, Sun, 
  Battery, Wifi, Phone, ShieldCheck, AlertTriangle, TrendingUp, 
  Download, Clock, Activity, CheckCircle2, ChevronRight, Gauge, Waves
} from 'lucide-react';
import { api } from '../services/api';
import { useApp } from '../context/AppContext';
import { 
  LineChart, Line, AreaChart, Area, XAxis, YAxis, 
  CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine 
} from 'recharts';

export default function WorkerDetail({ workerId, onBack }) {
  const { workersLatest, unitCelsius } = useApp();
  const [worker, setWorker] = useState(null);
  const [history, setHistory] = useState([]);
  const [trendAnalysis, setTrendAnalysis] = useState(null);
  const [range, setRange] = useState('1h'); // 'live' | '1h' | '24h' | '7d'
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('gas'); // 'gas' | 'vitals' | 'ambient'

  // Find latest worker live state from Context
  const latestEntry = workersLatest.find(w => w.worker?.id === workerId);
  const liveReading = latestEntry?.reading || {};
  const isOnline = latestEntry?.status === 'online';

  useEffect(() => {
    async function loadWorkerData() {
      setLoading(true);
      try {
        const [workerRes, historyRes, trendRes] = await Promise.all([
          api.getWorker(workerId).catch(() => null),
          api.getReadingHistory({ worker_id: workerId, limit: range === '1h' ? 60 : range === '24h' ? 288 : 100 }).catch(() => []),
          api.getTrends(workerId, 'mq2_mv', 40).catch(() => null)
        ]);

        setWorker(workerRes || latestEntry?.worker || { id: workerId, name: workerId, zone: 'Mine' });
        setHistory(historyRes);
        setTrendAnalysis(trendRes);
      } catch (err) {
        console.error('Failed to load worker detail:', err);
      } finally {
        setLoading(false);
      }
    }

    loadWorkerData();
    const interval = setInterval(loadWorkerData, 6000);
    return () => clearInterval(interval);
  }, [workerId, range]);

  // Compute Safety Score (0 - 100)
  const computeHealthScore = () => {
    let score = 100;
    const gas = Math.max(liveReading.mq2_mv || 0, liveReading.mq5_mv || 0);
    if (gas > 2500) score -= 40;
    else if (gas > 2000) score -= 20;

    if (liveReading.heart_rate) {
      if (liveReading.heart_rate > 120 || liveReading.heart_rate < 50) score -= 30;
      else if (liveReading.heart_rate > 105) score -= 10;
    }

    if (liveReading.spo2 && liveReading.spo2 < 92) score -= 25;
    if (liveReading.temperature && liveReading.temperature > 38) score -= 15;
    if (liveReading.battery && liveReading.battery < 20) score -= 10;

    return Math.max(10, score);
  };

  const healthScore = computeHealthScore();

  // Format chart time
  const chartData = history.map(r => ({
    time: new Date(r.ts || r.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    mq2_mv: r.mq2_mv,
    mq5_mv: r.mq5_mv,
    heart_rate: r.heart_rate,
    spo2: r.spo2,
    temperature: r.temperature,
    humidity: r.humidity,
    battery: r.battery,
    ldr_raw: r.ldr_raw
  }));

  return (
    <div className="space-y-6">
      
      {/* 1. Header & Navigation Back */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <button
            onClick={onBack}
            className="p-2 bg-white rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 transition-colors shadow-sm"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-xl font-black text-slate-800 tracking-tight">
                {worker?.name || workerId}
              </h2>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                isOnline ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' : 'bg-slate-200 text-slate-600'
              }`}>
                {isOnline ? 'ONLINE' : 'OFFLINE'}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Helmet ID: <span className="font-mono font-bold text-slate-700">{worker?.helmet_id || 'H001'}</span> • Zone: <span className="font-semibold text-slate-700">{worker?.zone}</span>
            </p>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center space-x-2">
          <a
            href={api.getExportCsvUrl(workerId)}
            target="_blank"
            rel="noreferrer"
            className="px-3 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-xl flex items-center space-x-1.5 shadow-sm transition-all"
          >
            <Download className="h-4 w-4 text-slate-500" />
            <span>Export CSV</span>
          </a>
        </div>
      </div>

      {/* 2. Worker Profile & Safety Score Summary Card */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        
        {/* Profile & Emergency Contact */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-soft">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
            Miner Information
          </h4>
          <div className="space-y-2.5 text-xs">
            <div className="flex justify-between py-1 border-b border-slate-100">
              <span className="text-slate-500">Worker ID</span>
              <span className="font-mono font-bold text-slate-800">{worker?.id}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-100">
              <span className="text-slate-500">Assigned Zone</span>
              <span className="font-semibold text-slate-800">{worker?.zone}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-100">
              <span className="text-slate-500">Miner Phone</span>
              <span className="font-semibold text-slate-800">{worker?.phone || 'N/A'}</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-slate-500">Emergency Contact</span>
              <span className="font-semibold text-rose-600 text-right">{worker?.emergency_contact || 'N/A'}</span>
            </div>
          </div>
        </div>

        {/* Safety & Vitals Index Gauge */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-soft flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Safety & Health Score
              </h4>
              <ShieldCheck className={`h-5 w-5 ${healthScore >= 80 ? 'text-emerald-500' : 'text-amber-500'}`} />
            </div>
            <div className="flex items-baseline space-x-2 mt-2">
              <span className={`text-4xl font-black ${
                healthScore >= 80 ? 'text-emerald-600' : healthScore >= 50 ? 'text-amber-600' : 'text-rose-600'
              }`}>
                {healthScore}
              </span>
              <span className="text-xs text-slate-400 font-semibold">/ 100 Index</span>
            </div>
            <p className="text-xs text-slate-500 mt-2">
              {healthScore >= 80 
                ? 'Nominal vitals and standard atmospheric gas levels.' 
                : healthScore >= 50 
                ? 'Moderate hazard warning detected. Monitor worker closely.'
                : 'CRITICAL ALERT: Vitals or gas levels in dangerous zone!'}
            </p>
          </div>
          
          <div className="w-full bg-slate-100 rounded-full h-2.5 mt-3 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                healthScore >= 80 ? 'bg-emerald-500' : healthScore >= 50 ? 'bg-amber-500' : 'bg-rose-500'
              }`}
              style={{ width: `${healthScore}%` }}
            />
          </div>
        </div>

        {/* Trend Analysis Predictive Card */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-soft flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Predictive Trend Insight
              </h4>
              <TrendingUp className="h-5 w-5 text-indigo-500" />
            </div>
            <div className="mt-1">
              <div className="flex items-center space-x-2">
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                  trendAnalysis?.direction === 'rising' ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'
                }`}>
                  Trend: {trendAnalysis?.direction || 'Stable'}
                </span>
                <span className="text-xs text-slate-500 font-mono">
                  Slope: {trendAnalysis?.slope || 0}
                </span>
              </div>
              <p className="text-xs text-slate-700 font-medium mt-2 leading-relaxed">
                {trendAnalysis?.insight || 'Analyzing real-time sensor trajectories and calculating moving averages...'}
              </p>
            </div>
          </div>

          <div className="text-[11px] text-slate-400 pt-2 border-t border-slate-100">
            {trendAnalysis?.time_to_warning_min 
              ? `Estimated ${trendAnalysis.time_to_warning_min} min to warning threshold`
              : 'Gas dynamics within safe predictive envelope'}
          </div>
        </div>

      </div>

      {/* 3. Live Gauge Meters Matrix */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        
        {/* Gas Meter (MQ-2) */}
        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-soft text-center">
          <Flame className="h-5 w-5 text-orange-500 mx-auto mb-1" />
          <span className="text-xs text-slate-500 font-medium">Gas Index (MQ-2)</span>
          <div className="text-xl font-extrabold text-slate-800 mt-1">
            {liveReading.mq2_mv ? `${liveReading.mq2_mv} mV` : 'Not connected'}
          </div>
          <span className="text-[10px] text-slate-400">Raw: {liveReading.mq2_raw || 'N/A'}</span>
        </div>

        {/* Gas Meter (MQ-5) */}
        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-soft text-center">
          <Flame className="h-5 w-5 text-amber-500 mx-auto mb-1" />
          <span className="text-xs text-slate-500 font-medium">Gas Index (MQ-5)</span>
          <div className="text-xl font-extrabold text-slate-800 mt-1">
            {liveReading.mq5_mv ? `${liveReading.mq5_mv} mV` : 'Not connected'}
          </div>
          <span className="text-[10px] text-slate-400">Raw: {liveReading.mq5_raw || 'N/A'}</span>
        </div>

        {/* Heart Rate */}
        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-soft text-center">
          <Heart className="h-5 w-5 text-rose-500 mx-auto mb-1 animate-pulse" />
          <span className="text-xs text-slate-500 font-medium">Heart Rate</span>
          <div className="text-xl font-extrabold text-slate-800 mt-1">
            {liveReading.heart_rate ? `${liveReading.heart_rate} BPM` : 'Not connected'}
          </div>
          <span className="text-[10px] text-emerald-600 font-medium">Nominal: 60-100</span>
        </div>

        {/* HW-072 Vibration Activity */}
        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-soft text-center">
          <Waves className={`h-5 w-5 mx-auto mb-1 ${
            liveReading.vibration_level === 'CRITICAL' ? 'text-rose-500 animate-bounce' :
            liveReading.vibration_level === 'HIGH' ? 'text-orange-500' :
            liveReading.vibration_level === 'MODERATE' ? 'text-amber-500' :
            'text-indigo-500'
          }`} />
          <span className="text-xs text-slate-500 font-medium">Vibration Activity</span>
          <div className="text-lg font-extrabold text-slate-800 mt-1">
            {liveReading.vibration_level ? (
              <span className={`px-2 py-0.5 rounded-lg text-xs font-mono font-black ${
                liveReading.vibration_level === 'CRITICAL' ? 'bg-rose-100 text-rose-700' :
                liveReading.vibration_level === 'HIGH' ? 'bg-orange-100 text-orange-700' :
                liveReading.vibration_level === 'MODERATE' ? 'bg-amber-100 text-amber-800' :
                liveReading.vibration_level === 'LOW' ? 'bg-blue-100 text-blue-700' :
                'bg-emerald-100 text-emerald-700'
              }`}>
                {liveReading.vibration_level} ({liveReading.vibration_events || 0} ev)
              </span>
            ) : 'NORMAL (0 ev)'}
          </div>
          <span className="text-[10px] text-slate-400 font-mono mt-1 block">HW-072 Piezo</span>
        </div>

        {/* Temperature & Humidity */}
        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-soft text-center">
          <Thermometer className="h-5 w-5 text-amber-500 mx-auto mb-1" />
          <span className="text-xs text-slate-500 font-medium">Temp / Humidity</span>
          <div className="text-xl font-extrabold text-slate-800 mt-1">
            {liveReading.temperature !== undefined 
              ? (unitCelsius ? `${liveReading.temperature}°C` : `${((liveReading.temperature * 9/5) + 32).toFixed(1)}°F`)
              : 'N/A'}
          </div>
          <span className="text-[10px] text-slate-400">{liveReading.humidity ? `${liveReading.humidity}% RH` : 'N/A'}</span>
        </div>

      </div>

      {/* 4. Interactive Telemetry Charts with Range Selector */}
      <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-soft space-y-4">
        
        {/* Controls */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          
          {/* Metric Selector Tabs */}
          <div className="flex items-center space-x-1.5 bg-slate-100 p-1 rounded-xl text-xs font-semibold">
            <button
              onClick={() => setActiveTab('gas')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                activeTab === 'gas' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Gas Telemetry (MQ-2 vs MQ-5)
            </button>
            <button
              onClick={() => setActiveTab('vitals')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                activeTab === 'vitals' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Biometric Vitals (HR & SpO2)
            </button>
            <button
              onClick={() => setActiveTab('ambient')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                activeTab === 'ambient' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Ambient Climate & Battery
            </button>
          </div>

          {/* Time Range Selector */}
          <div className="flex items-center space-x-1 bg-slate-100 p-1 rounded-lg text-xs">
            {['live', '1h', '24h'].map(r => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={`px-2.5 py-1 rounded text-[11px] font-semibold uppercase ${
                  range === r ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                {r}
              </button>
            ))}
          </div>

        </div>

        {/* Chart View */}
        <div className="h-72 w-full pt-2">
          <ResponsiveContainer width="100%" height="100%">
            {activeTab === 'gas' ? (
              <LineChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                <XAxis dataKey="time" stroke="#94A3B8" fontSize={11} />
                <YAxis stroke="#94A3B8" fontSize={11} domain={[800, 3000]} />
                <Tooltip contentStyle={{ backgroundColor: '#FFFFFF', borderRadius: '12px', border: '1px solid #E2E8F0', fontSize: '12px' }} />
                <ReferenceLine y={2000} stroke="#F59E0B" strokeDasharray="4 4" label={{ value: 'Warning (2000mV)', fill: '#F59E0B', fontSize: 10 }} />
                <ReferenceLine y={2500} stroke="#EF4444" strokeDasharray="4 4" label={{ value: 'Critical (2500mV)', fill: '#EF4444', fontSize: 10 }} />
                <Line type="monotone" dataKey="mq2_mv" name="MQ-2 Gas (mV)" stroke="#3B82F6" strokeWidth={2.5} dot={false} />
                <Line type="monotone" dataKey="mq5_mv" name="MQ-5 Gas (mV)" stroke="#10B981" strokeWidth={2} dot={false} />
              </LineChart>
            ) : activeTab === 'vitals' ? (
              <LineChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                <XAxis dataKey="time" stroke="#94A3B8" fontSize={11} />
                <YAxis stroke="#94A3B8" fontSize={11} domain={[40, 140]} />
                <Tooltip contentStyle={{ backgroundColor: '#FFFFFF', borderRadius: '12px', border: '1px solid #E2E8F0', fontSize: '12px' }} />
                <ReferenceLine y={120} stroke="#EF4444" strokeDasharray="4 4" label={{ value: 'High HR Max (120)', fill: '#EF4444', fontSize: 10 }} />
                <Line type="monotone" dataKey="heart_rate" name="Heart Rate (BPM)" stroke="#F43F5E" strokeWidth={2.5} dot={false} />
                <Line type="monotone" dataKey="spo2" name="SpO2 (%)" stroke="#06B6D4" strokeWidth={2} dot={false} />
              </LineChart>
            ) : (
              <LineChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                <XAxis dataKey="time" stroke="#94A3B8" fontSize={11} />
                <YAxis stroke="#94A3B8" fontSize={11} />
                <Tooltip contentStyle={{ backgroundColor: '#FFFFFF', borderRadius: '12px', border: '1px solid #E2E8F0', fontSize: '12px' }} />
                <Line type="monotone" dataKey="temperature" name="Temp (°C)" stroke="#F59E0B" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="humidity" name="Humidity (%)" stroke="#3B82F6" strokeWidth={1.5} dot={false} />
                <Line type="monotone" dataKey="battery" name="Battery (%)" stroke="#10B981" strokeWidth={2} dot={false} />
              </LineChart>
            )}
          </ResponsiveContainer>
        </div>

        <div className="text-[11px] text-slate-400 italic pt-2 border-t border-slate-100 flex items-center justify-between">
          <span>Footnote: Prototype – uncalibrated electrical sensor signals for research/demo purposes only.</span>
          <span>Sampling Rate: 2.0s</span>
        </div>

      </div>

    </div>
  );
}
