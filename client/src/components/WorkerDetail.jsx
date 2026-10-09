import React, { useState, useEffect } from 'react';
import { 
  ArrowLeft, Heart, Flame, Thermometer, Battery, 
  Wind, ShieldAlert, CheckCircle2, AlertTriangle, Download,
  Clock, HardHat, Gauge, TrendingUp, Sliders, Activity, Radio
} from 'lucide-react';
import { 
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, 
  CartesianGrid, ReferenceLine, LineChart, Line 
} from 'recharts';
import { api } from '../services/api';
import { useApp } from '../context/AppContext';

export default function WorkerDetail({ workerId, onBack }) {
  const { workersLatest, activeAlerts, unitCelsius } = useApp();
  const [history, setHistory] = useState([]);
  const [activeTab, setActiveTab] = useState('gas'); // 'gas' | 'vitals' | 'ambient'
  const [range, setRange] = useState('live'); // 'live' | '1h' | '24h'
  const [loading, setLoading] = useState(false);

  // Find latest state for this specific worker
  const currentWorkerItem = workersLatest.find(w => w.worker?.id === workerId);
  const worker = currentWorkerItem?.worker || { id: workerId, name: `Worker ${workerId}`, helmet_id: 'H001', zone: 'Sector 4' };
  const liveReading = currentWorkerItem?.reading || {};
  const isOnline = currentWorkerItem?.status === 'online';

  useEffect(() => {
    let isMounted = true;
    const fetchHistory = async () => {
      setLoading(true);
      try {
        const data = await api.getHistory({ worker_id: workerId, limit: 120 });
        if (isMounted) setHistory(data.reverse()); // Chronological order
      } catch (err) {
        console.error('History fetch failed:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    fetchHistory();
    const interval = setInterval(fetchHistory, 8000);
    return () => { isMounted = false; clearInterval(interval); };
  }, [workerId, range]);

  // Compute safety status indicators
  const workerAlerts = activeAlerts.filter(a => a.worker_id === workerId && !a.resolved_at);
  const hasCritical = workerAlerts.some(a => a.severity === 'CRITICAL');
  const hasWarning = workerAlerts.some(a => a.severity === 'WARNING');

  // Compute composite safety index (0 to 100)
  const computeHealthScore = () => {
    let score = 96;
    const gas = Math.max(liveReading.mq2_mv || 0, liveReading.mq5_mv || 0);
    if (gas > 2500) score -= 45;
    else if (gas > 2000) score -= 25;
    if (liveReading.heart_rate) {
      if (liveReading.heart_rate > 120 || liveReading.heart_rate < 50) score -= 30;
      else if (liveReading.heart_rate > 100) score -= 15;
    }
    if (liveReading.spo2 && liveReading.spo2 < 92) score -= 35;
    if (liveReading.temperature && liveReading.temperature > 35) score -= 20;
    if (liveReading.fall) score -= 50;
    if (liveReading.sos) score -= 50;
    return Math.max(0, Math.min(100, score));
  };

  const healthScore = isOnline ? computeHealthScore() : null;

  // Simple predictive linear slope calculation for gas
  const calculateSlope = () => {
    if (!isOnline || history.length < 5) return { slope: null, direction: 'stable', time_to_warning_min: null };
    const recent = history.slice(-10);
    const firstVal = recent[0].mq2_mv || 0;
    const lastVal = recent[recent.length - 1].mq2_mv || 0;
    const diff = lastVal - firstVal;
    const slope = (diff / recent.length).toFixed(2);
    const direction = diff > 80 ? 'rising' : diff < -80 ? 'falling' : 'stable';
    let time_to_warning_min = null;
    if (direction === 'rising' && lastVal < 2000) {
      const remaining = 2000 - lastVal;
      time_to_warning_min = Math.max(1, Math.round(remaining / (Math.max(1, diff / recent.length) * 6)));
    }
    return { slope, direction, time_to_warning_min };
  };

  const trendAnalysis = calculateSlope();

  // Format history for Recharts
  const chartData = history.map((r, i) => ({
    time: new Date(r.timestamp || r.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    mq2_mv: r.mq2_mv || 0,
    mq5_mv: r.mq5_mv || 0,
    heart_rate: r.heart_rate || 0,
    spo2: r.spo2 || 98,
    temperature: r.temperature || 26,
    humidity: r.humidity || 50,
    battery: r.battery || 95,
    pressure: r.pressure || 1013,
    ldr_raw: r.ldr_raw
  }));

  return (
    <div className="space-y-5">
      
      {/* 1. Velzon Breadcrumb Header Row */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-3 border-b border-[#E9EBEC] gap-3">
        <div className="flex items-center space-x-3">
          <button
            onClick={onBack}
            className="p-2 bg-white rounded border border-[#E9EBEC] hover:bg-[#F3F6F9] text-[#878A99] hover:text-[#212529] transition-colors shadow-2xs"
            title="Back to Fleet Overview"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-base font-semibold text-[#495057]">
                {worker?.name || workerId}
              </h1>
              <span className={isOnline ? 'badge-soft-success text-xs font-medium' : 'badge-soft-dark text-xs'}>
                {isOnline ? 'Online' : 'Standby'}
              </span>
            </div>
            <p className="text-xs text-[#878A99] mt-0.5">
              Helmet: <span className="font-medium text-[#212529] font-mono">{worker?.helmet_id || 'H001'}</span> • Worker ID: <span className="font-medium text-[#212529] font-mono">{worker?.id}</span> • Sector: <span className="font-medium text-[#212529]">{worker?.zone}</span>
            </p>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center space-x-2">
          <a
            href={api.getExportCsvUrl(workerId)}
            target="_blank"
            rel="noreferrer"
            className="px-3 py-1.5 bg-white border border-[#E9EBEC] hover:bg-[#F3F6F9] text-[#495057] text-xs font-semibold rounded flex items-center space-x-1.5 shadow-2xs transition-all"
          >
            <Download className="h-3.5 w-3.5 text-[#878A99]" />
            <span>Export CSV Telemetry</span>
          </a>
        </div>
      </div>

      {/* 2. Worker Profile & Safety Score Summary Cards (Velzon Cards) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        
        {/* Device Assignment & Contact */}
        <div className="velzon-card p-4">
          <h2 className="text-xs font-semibold text-[#495057] mb-3 flex items-center gap-1.5">
            <HardHat className="h-3.5 w-3.5 text-[#176B87]" />
            <span>Deployment parameters</span>
          </h2>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between py-1 border-b border-[#F3F6F9]">
              <span className="text-[#878A99]">Worker ID</span>
              <span className="font-mono font-medium text-[#212529]">{worker?.id}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-[#F3F6F9]">
              <span className="text-[#878A99]">Sector zone</span>
              <span className="font-medium text-[#212529]">{worker?.zone}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-[#F3F6F9]">
              <span className="text-[#878A99]">Radio channel</span>
              <span className="font-mono text-[#212529]">{worker?.phone || 'CH-04'}</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-[#878A99]">Emergency contact</span>
              <span className="font-mono text-[#F06548] text-right">{worker?.emergency_contact || '+91 98765 43211'}</span>
            </div>
          </div>
        </div>

        {/* Real-Time Safety Health Index */}
        <div className="velzon-card p-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-xs font-semibold text-[#495057] flex items-center gap-1.5">
                <ShieldAlert className="h-3.5 w-3.5 text-[#176B87]" />
                <span>Health safety index</span>
              </h2>
              {isOnline && healthScore !== null ? (
                <span className={
                  healthScore >= 80 ? 'badge-soft-success' :
                  healthScore >= 50 ? 'badge-soft-warning' :
                  'badge-soft-danger'
                }>
                  {healthScore >= 80 ? 'OPTIMAL' : healthScore >= 50 ? 'ELEVATED RISK' : 'CRITICAL'}
                </span>
              ) : (
                <span className="badge-soft-dark">STANDBY</span>
              )}
            </div>
            <div className="flex items-baseline space-x-2 my-2">
              <span className="text-3xl font-bold font-mono text-[#212529]">
                {isOnline && healthScore !== null ? healthScore : '—'}
              </span>
              <span className="text-xs text-[#878A99]">/ 100 Safety Units</span>
            </div>
            <p className="text-xs text-[#878A99]">
              {isOnline 
                ? 'Composite biometric calculation balancing heart rate, toxic gas exposure, and ambient temperature.' 
                : 'Awaiting device telemetry packets to calculate biometric safety score.'}
            </p>
          </div>

          <div className="w-full bg-[#E9EBEC] rounded-full h-1.5 mt-3 overflow-hidden">
            <div 
              className={`h-full transition-all duration-500 ${
                !isOnline ? 'bg-[#878A99]' : healthScore >= 80 ? 'bg-[#0AB39C]' : healthScore >= 50 ? 'bg-[#F7B84B]' : 'bg-[#F06548]'
              }`}
              style={{ width: isOnline && healthScore !== null ? `${healthScore}%` : '0%' }}
            />
          </div>
        </div>

        {/* Predictive Trend Envelope */}
        <div className="velzon-card p-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-xs font-semibold text-[#495057] flex items-center gap-1.5">
                <TrendingUp className="h-3.5 w-3.5 text-[#176B87]" />
                <span>Sensor dynamics</span>
              </h2>
              <span className={!isOnline ? 'badge-soft-dark' : trendAnalysis?.direction === 'rising' ? 'badge-soft-danger' : 'badge-soft-success'}>
                {!isOnline ? 'STANDBY' : trendAnalysis?.direction === 'rising' ? 'RISING' : 'STABLE'}
              </span>
            </div>
            <div className="mt-2">
              <div className="text-xs text-[#878A99] flex items-center justify-between">
                <span>Slope rate:</span>
                <span className="font-mono font-medium text-[#212529]">
                  {isOnline && trendAnalysis?.slope !== null ? `${trendAnalysis.slope} mV/s` : '—'}
                </span>
              </div>
              <p className="text-xs text-[#878A99] mt-2 leading-relaxed">
                {!isOnline 
                  ? 'Awaiting telemetry packets from hardware or simulator node.' 
                  : (trendAnalysis?.insight || 'Continuous temporal sliding window tracking combustible gas concentration gradient.')}
              </p>
            </div>
          </div>

          <div className="text-[11px] text-[#878A99] pt-2 border-t border-[#E9EBEC] flex items-center justify-between">
            <span>Predictive envelope:</span>
            <span className="font-medium text-[#212529]">
              {!isOnline ? '—' : trendAnalysis?.time_to_warning_min ? `~${trendAnalysis.time_to_warning_min} min to warning` : 'Safe'}
            </span>
          </div>
        </div>

      </div>

      {/* 3. Live Gauge Meters Matrix (Velzon Counter Cards) */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        
        {/* Gas Meter (MQ-2) */}
        <div className="velzon-card p-4">
          <div className="flex items-center justify-between text-[#878A99] mb-1">
            <span className="text-xs font-medium">MQ-2 gas</span>
            <Flame className="h-4 w-4 text-[#176B87]" />
          </div>
          <div className="text-xl font-mono font-semibold text-[#212529] mt-1">
            {isOnline && liveReading.mq2_mv ? `${liveReading.mq2_mv} mV` : '—'}
          </div>
          <div className="text-[11px] text-[#878A99] mt-1">Raw ADC: {isOnline && liveReading.mq2_raw ? liveReading.mq2_raw : '—'}</div>
        </div>

        {/* Gas Meter (MQ-5) */}
        <div className="velzon-card p-4">
          <div className="flex items-center justify-between text-[#878A99] mb-1">
            <span className="text-xs font-medium">MQ-5 methane/LPG</span>
            <Flame className="h-4 w-4 text-[#176B87]" />
          </div>
          <div className="text-xl font-mono font-semibold text-[#212529] mt-1">
            {isOnline && liveReading.mq5_mv ? `${liveReading.mq5_mv} mV` : '—'}
          </div>
          <div className="text-[11px] text-[#878A99] mt-1">Raw ADC: {isOnline && liveReading.mq5_raw ? liveReading.mq5_raw : '—'}</div>
        </div>

        {/* Heart Rate */}
        <div className="velzon-card p-4">
          <div className="flex items-center justify-between text-[#878A99] mb-1">
            <span className="text-xs font-medium">Heart rate</span>
            <Heart className="h-4 w-4 text-[#F06548]" />
          </div>
          <div className="text-xl font-mono font-semibold text-[#212529] mt-1">
            {isOnline && liveReading.heart_rate ? `${liveReading.heart_rate} bpm` : '—'}
          </div>
          <div className="text-[11px] text-[#0AB39C] mt-1 font-medium">SpO2: {isOnline && liveReading.spo2 ? `${liveReading.spo2}%` : '—'}</div>
        </div>

        {/* Atmospheric Pressure */}
        <div className="velzon-card p-4">
          <div className="flex items-center justify-between text-[#878A99] mb-1">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Atm. Pressure</span>
            <Gauge className="h-4 w-4 text-[#176B87]" />
          </div>
          <div className="text-xl font-mono font-bold text-[#212529] mt-1">
            {isOnline && liveReading.pressure ? `${liveReading.pressure} hPa` : '—'}
          </div>
          <div className="text-[10px] font-mono text-[#878A99] mt-1">Range: 960–1060 hPa</div>
        </div>

        {/* Temperature & Humidity */}
        <div className="velzon-card p-4">
          <div className="flex items-center justify-between text-[#878A99] mb-1">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Temperature / RH</span>
            <Thermometer className="h-4 w-4 text-[#E7B64A]" />
          </div>
          <div className="text-xl font-mono font-bold text-[#212529] mt-1">
            {isOnline && liveReading.temperature !== undefined 
              ? (unitCelsius ? `${liveReading.temperature}°C` : `${((liveReading.temperature * 9/5) + 32).toFixed(1)}°F`)
              : '—'}
          </div>
          <div className="text-[10px] font-mono text-[#878A99] mt-1">
            RH: {isOnline && liveReading.humidity ? `${liveReading.humidity}%` : '—'} • Bat: {isOnline && liveReading.battery ? `${liveReading.battery}%` : '—'}
          </div>
        </div>

      </div>

      {/* 4. Interactive Telemetry Charts (Velzon Card) */}
      <div className="velzon-card">
        <div className="velzon-card-header">
          {/* Metric Selector Tabs */}
          <div className="flex items-center space-x-1 bg-[#F3F6F9] p-1 rounded-md text-xs font-semibold border border-[#E9EBEC]">
            <button
              onClick={() => setActiveTab('gas')}
              className={`px-3 py-1.5 rounded transition-all ${
                activeTab === 'gas' ? 'bg-white text-[#176B87] shadow-2xs border border-[#E9EBEC]' : 'text-[#878A99] hover:text-[#495057]'
              }`}
            >
              GAS DYNAMICS (MQ-2 / MQ-5)
            </button>
            <button
              onClick={() => setActiveTab('vitals')}
              className={`px-3 py-1.5 rounded transition-all ${
                activeTab === 'vitals' ? 'bg-white text-[#176B87] shadow-2xs border border-[#E9EBEC]' : 'text-[#878A99] hover:text-[#495057]'
              }`}
            >
              BIOMETRIC VITALS (HR &amp; SPO2)
            </button>
            <button
              onClick={() => setActiveTab('ambient')}
              className={`px-3 py-1.5 rounded transition-all ${
                activeTab === 'ambient' ? 'bg-white text-[#176B87] shadow-2xs border border-[#E9EBEC]' : 'text-[#878A99] hover:text-[#495057]'
              }`}
            >
              AMBIENT CLIMATE &amp; BATTERY
            </button>
          </div>

          {/* Time Range Selector */}
          <div className="flex items-center space-x-1 bg-[#F3F6F9] p-1 rounded-md text-xs border border-[#E9EBEC]">
            {['live', '1h', '24h'].map(r => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={`px-2.5 py-1 rounded text-[11px] font-mono font-semibold uppercase ${
                  range === r ? 'bg-white text-[#176B87] shadow-2xs border border-[#E9EBEC]' : 'text-[#878A99] hover:text-[#495057]'
                }`}
              >
                {r}
              </button>
            ))}
          </div>
        </div>

        <div className="velzon-card-body">
          {loading && chartData.length === 0 ? (
            <div className="h-64 flex items-center justify-center text-xs text-[#878A99]">
              Loading telemetry history from database...
            </div>
          ) : chartData.length === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center text-xs text-[#878A99] space-y-1">
              <span className="font-mono text-sm font-semibold text-[#495057]">— No Telemetry Packets —</span>
              <span>Device is currently in standby mode. Data will stream live once online.</span>
            </div>
          ) : (
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                {activeTab === 'gas' ? (
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="gasGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#176B87" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#176B87" stopOpacity={0.0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F3F6F9" />
                    <XAxis dataKey="time" stroke="#878A99" fontSize={10} fontStyle="mono" />
                    <YAxis stroke="#878A99" fontSize={10} domain={[800, 3200]} fontStyle="mono" />
                    <Tooltip contentStyle={{ backgroundColor: '#FFFFFF', borderColor: '#E9EBEC', borderRadius: '6px', fontSize: '11px' }} />
                    <ReferenceLine y={2000} stroke="#F7B84B" strokeDasharray="3 3" label={{ value: 'Warn: 2000mV', fill: '#B7791F', fontSize: 10 }} />
                    <ReferenceLine y={2500} stroke="#F06548" strokeDasharray="3 3" label={{ value: 'Crit: 2500mV', fill: '#F06548', fontSize: 10 }} />
                    <Area type="monotone" dataKey="mq2_mv" name="MQ-2 Combustible" stroke="#176B87" strokeWidth={2} fillOpacity={1} fill="url(#gasGrad)" />
                    <Area type="monotone" dataKey="mq5_mv" name="MQ-5 Methane" stroke="#0AB39C" strokeWidth={1.5} fill="none" />
                  </AreaChart>
                ) : activeTab === 'vitals' ? (
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F3F6F9" />
                    <XAxis dataKey="time" stroke="#878A99" fontSize={10} fontStyle="mono" />
                    <YAxis yAxisId="left" stroke="#F06548" domain={[40, 160]} fontSize={10} fontStyle="mono" />
                    <YAxis yAxisId="right" orientation="right" stroke="#0AB39C" domain={[85, 100]} fontSize={10} fontStyle="mono" />
                    <Tooltip contentStyle={{ backgroundColor: '#FFFFFF', borderColor: '#E9EBEC', borderRadius: '6px', fontSize: '11px' }} />
                    <Line yAxisId="left" type="monotone" dataKey="heart_rate" name="Heart Rate (BPM)" stroke="#F06548" strokeWidth={2} dot={false} />
                    <Line yAxisId="right" type="monotone" dataKey="spo2" name="SpO2 (%)" stroke="#0AB39C" strokeWidth={1.5} dot={false} />
                  </LineChart>
                ) : (
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F3F6F9" />
                    <XAxis dataKey="time" stroke="#878A99" fontSize={10} fontStyle="mono" />
                    <YAxis stroke="#878A99" fontSize={10} fontStyle="mono" />
                    <Tooltip contentStyle={{ backgroundColor: '#FFFFFF', borderColor: '#E9EBEC', borderRadius: '6px', fontSize: '11px' }} />
                    <Line type="monotone" dataKey="temperature" name="Temp (°C)" stroke="#E7B64A" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="humidity" name="Humidity (%)" stroke="#299CDB" strokeWidth={1.5} dot={false} />
                    <Line type="monotone" dataKey="battery" name="Battery (%)" stroke="#0AB39C" strokeWidth={1} strokeDasharray="3 3" dot={false} />
                  </LineChart>
                )}
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
