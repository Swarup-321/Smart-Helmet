import React, { useState } from 'react';
import { 
  Users, AlertTriangle, Heart, Thermometer, Flame, 
  Clock, ShieldAlert, CheckCircle2, ChevronRight,
  TrendingUp, Wifi, Gauge, ArrowUpRight, HardHat, Compass,
  Radio, Server, ShieldCheck, Activity, Layers, BellRing
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { api } from '../services/api';
import { 
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, ReferenceLine
} from 'recharts';
import HackathonDemoPanel from './HackathonDemoPanel';

export default function Overview({ onSelectWorker, onNavigateAlerts }) {
  const { 
    workersLatest, 
    activeAlerts, 
    summaryStats, 
    refreshData,
    unitCelsius,
    mlPrediction,
    mlStatus
  } = useApp();

  const [selectedZone, setSelectedZone] = useState('ALL');
  const [selectedChartWorker, setSelectedChartWorker] = useState('ALL');

  // Filter true active critical & warning incidents (distinguishing resolved/acknowledged)
  const unresolvedAlerts = activeAlerts.filter(a => !a.resolved_at);
  const criticalAlerts = unresolvedAlerts.filter(a => a.severity === 'CRITICAL' && !a.acknowledged);
  const warningAlerts = unresolvedAlerts.filter(a => a.severity === 'WARNING' && !a.acknowledged);

  // Compute Overall Safety Status
  let overallStatus = 'SAFE';
  let statusBannerClass = 'mg-banner-success';
  let statusBadgeClass = 'mg-badge-success';
  let statusDescription = 'Atmospheric gas and biometrics across all active mine sectors are within normal operational limits.';

  if (criticalAlerts.length > 0) {
    overallStatus = 'CRITICAL ALARM';
    statusBannerClass = 'mg-banner-danger';
    statusBadgeClass = 'mg-badge-solid-danger';
    statusDescription = `${criticalAlerts.length} active critical hazard condition(s) require immediate supervisor intervention.`;
  } else if (warningAlerts.length > 0) {
    overallStatus = 'ELEVATED RISK';
    statusBannerClass = 'mg-banner-warning';
    statusBadgeClass = 'mg-badge-warning';
    statusDescription = `${warningAlerts.length} elevated warning state(s) detected across active mine zones.`;
  }

  // Filter workers by zone
  const filteredWorkers = workersLatest.filter(item => {
    if (selectedZone === 'ALL') return true;
    return item.worker?.zone?.toLowerCase().includes(selectedZone.toLowerCase());
  });

  const onlineCount = workersLatest.filter(w => w.status === 'online').length;
  const totalMiners = workersLatest.length || 5;

  const handleAcknowledgeAlert = async (id, e) => {
    e.stopPropagation();
    try {
      await api.acknowledgeAlert(id, 'Safety Officer');
      refreshData();
    } catch (err) {
      console.error('Failed to ack alert:', err);
    }
  };

  return (
    <div>
      
      {/* 1. Page Title & Breadcrumb Row */}
      <div className="mg-page-head">
        <div>
          <h1 className="mg-page-title">Sector 4 operations overview</h1>
        </div>
        <ol className="mg-crumbs">
          <li>MineGuard</li>
          <li>Dashboard</li>
          <li style={{ color: 'var(--mg-primary)', fontWeight: 600 }}>Overview</li>
        </ol>
      </div>

      {/* 2. Global Operational Status Alert Banner */}
      <div className={`mg-banner ${statusBannerClass}`} role="alert">
        {overallStatus === 'CRITICAL ALARM' ? (
          <ShieldAlert className="mg-i mg-banner-icon animate-pulse" />
        ) : overallStatus === 'ELEVATED RISK' ? (
          <AlertTriangle className="mg-i mg-banner-icon" />
        ) : (
          <CheckCircle2 className="mg-i mg-banner-icon" />
        )}
        <div className="mg-banner-body">
          <div className="mg-banner-title">{overallStatus === 'SAFE' ? 'Operational status: Normal' : overallStatus}</div>
          <div className="mg-banner-text">{statusDescription}</div>
        </div>
        {criticalAlerts.length > 0 && (
          <button onClick={onNavigateAlerts} className="mg-btn mg-btn-danger">
            Review {criticalAlerts.length} critical alert(s)
          </button>
        )}
      </div>

      {/* 3. KPI Counter Cards Row */}
      <div className="mg-row mg-cols-5">
        
        {/* KPI 1: Active Fleet */}
        <div className="mg-card">
          <div className="mg-kpi">
            <div className="mg-kpi-top">
              <span className="mg-kpi-label">Active fleet</span>
              <span className="mg-badge mg-badge-success">{onlineCount}/{totalMiners} online</span>
            </div>
            <div className="mg-kpi-main">
              <div>
                <div className="mg-kpi-value mg-num">
                  {onlineCount}<span className="mg-kpi-unit">/ {totalMiners}</span>
                </div>
                <div className="mg-kpi-note mg-mt-2">4 demo, 1 physical</div>
              </div>
              <div className="mg-icon-chip mg-chip-primary">
                <HardHat className="mg-i text-[20px]" />
              </div>
            </div>
          </div>
        </div>

        {/* KPI 2: Active Alarms */}
        <div className="mg-card">
          <div className="mg-kpi">
            <div className="mg-kpi-top">
              <span className="mg-kpi-label">Active alarms</span>
              <span className={unresolvedAlerts.length > 0 ? "mg-badge mg-badge-danger" : "mg-badge mg-badge-success"}>
                {unresolvedAlerts.length > 0 ? "Action required" : "Nominal"}
              </span>
            </div>
            <div className="mg-kpi-main">
              <div>
                <div className="mg-kpi-value mg-num">{unresolvedAlerts.length}</div>
                <div className="mg-kpi-note mg-mt-2">{criticalAlerts.length} critical, {warningAlerts.length} warning</div>
              </div>
              <div className="mg-icon-chip mg-chip-warning">
                <AlertTriangle className="mg-i text-[20px]" />
              </div>
            </div>
          </div>
        </div>

        {/* KPI 3: Mean Pulse */}
        <div className="mg-card">
          <div className="mg-kpi">
            <div className="mg-kpi-top">
              <span className="mg-kpi-label">Mean pulse</span>
              <span className="mg-badge mg-badge-info">60–100 bpm</span>
            </div>
            <div className="mg-kpi-main">
              <div>
                <div className="mg-kpi-value mg-num">
                  {summaryStats?.avg_heart_rate || 75}<span className="mg-kpi-unit">bpm</span>
                </div>
                <div className="mg-kpi-note mg-mt-2 mg-text-success">Biometrics nominal</div>
              </div>
              <div className="mg-icon-chip mg-chip-danger">
                <Heart className="mg-i text-[20px]" />
              </div>
            </div>
          </div>
        </div>

        {/* KPI 4: Mean Temperature */}
        <div className="mg-card">
          <div className="mg-kpi">
            <div className="mg-kpi-top">
              <span className="mg-kpi-label">Mean temperature</span>
              <span className="mg-badge mg-badge-success">Intake drift</span>
            </div>
            <div className="mg-kpi-main">
              <div>
                <div className="mg-kpi-value mg-num">
                  {unitCelsius 
                    ? `${summaryStats?.avg_temperature || 27.8}` 
                    : `${(((summaryStats?.avg_temperature || 27.8) * 9/5) + 32).toFixed(1)}`}
                  <span className="mg-kpi-unit">{unitCelsius ? '°C' : '°F'}</span>
                </div>
                <div className="mg-kpi-note mg-mt-2 mg-text-success">Ventilation active</div>
              </div>
              <div className="mg-icon-chip mg-chip-warning">
                <Thermometer className="mg-i text-[20px]" />
              </div>
            </div>
          </div>
        </div>

        {/* KPI 5: Peak Gas Index */}
        <div className="mg-card">
          <div className="mg-kpi">
            <div className="mg-kpi-top">
              <span className="mg-kpi-label">Peak gas index</span>
              <span className="mg-badge mg-badge-info">MQ-2 / MQ-5</span>
            </div>
            <div className="mg-kpi-main">
              <div>
                <div className="mg-kpi-value mg-num">
                  {summaryStats?.highest_gas_mv || 2600}<span className="mg-kpi-unit">mV</span>
                </div>
                <div className="mg-kpi-note mg-mt-2">Threshold: 2000 mV</div>
              </div>
              <div className="mg-icon-chip mg-chip-info">
                <Flame className="mg-i text-[20px]" />
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* 4. Hackathon Live Demo Mode Panel */}
      <HackathonDemoPanel />

      {/* 5. Experimental ML Gas Surge Risk Advisory Panel */}
      <section className="mg-card mg-row" style={{ display: 'block' }}>
        <div className="mg-card-header">
          <div>
            <div className="mg-card-title flex items-center">
              <TrendingUp className="mg-i text-[#405189] mr-2" />
              Experimental gas surge risk advisory
            </div>
            <div className="mg-card-sub flex items-center gap-1.5 flex-wrap">
              <span>FastAPI microservice, port 8000</span>
              {mlPrediction?.worker_id && (
                <span className="font-mono text-[#176B87] font-semibold">
                  · Target: {mlPrediction.worker_id === 'W006' ? 'Physical Smart Helmet (W006)' : `Miner ${mlPrediction.worker_id}`}
                </span>
              )}
            </div>
          </div>

          <div className="mg-flex">
            <span className="mg-label">FastAPI status</span>
            <span className={
              mlStatus === 'READY' ? 'mg-badge mg-badge-success' :
              mlStatus === 'WARMING UP' ? 'mg-badge mg-badge-warning' :
              'mg-badge mg-badge-neutral'
            }>
              {mlStatus || 'OFFLINE'}
            </span>
          </div>
        </div>

        <div className="mg-card-body">
          <div className="mg-row mg-cols-2" style={{ marginBottom: '12px' }}>
            <div className="mg-inset">
              <div className="mg-label">Evaluated surge probability</div>
              <div className="mg-kpi-value mg-num mg-mt-2">
                {mlPrediction?.risk_probability != null 
                  ? `${(mlPrediction.risk_probability * 100).toFixed(1)}%` 
                  : '--%'}
              </div>
              <div className="mg-kpi-note mg-mt-2">
                {mlPrediction?.worker_id === 'W006' 
                  ? 'Live Hardware Telemetry · ESP32 Sensor' 
                  : mlPrediction 
                    ? `Artifact: ${mlPrediction.model_version || 'v1.1'}` 
                    : 'Awaiting rolling telemetry window'}
              </div>
            </div>

            <div className="mg-inset">
              <div className="mg-label">Classification level</div>
              <div className="mg-mt-2">
                {(() => {
                  const rawLevel = mlPrediction?.risk_level || 'NORMAL';
                  const isCrit = rawLevel.includes('CRITICAL');
                  const isElev = rawLevel.includes('ELEVATED');
                  return (
                    <span className={isCrit ? 'mg-badge mg-badge-danger' : isElev ? 'mg-badge mg-badge-warning' : 'mg-badge mg-badge-success'}>
                      {isCrit ? 'Critical surge' : isElev ? 'Elevated surge' : 'Nominal'}
                    </span>
                  );
                })()}
              </div>
              <div className="mg-kpi-note mg-mt-2">
                {mlPrediction?.trend_direction ? `Trajectory: ${mlPrediction.trend_direction.toUpperCase()}` : 'Temporal evaluation contract'}
              </div>
            </div>
          </div>

          <p className="mg-label">
            Experimental ML advisory running on port 8000. Dimensionless temporal rate analysis; not an operational safety interlock.
          </p>
        </div>
      </section>

      {/* 6. Mine Fleet & Smart Helmets Section */}
      <section className="mg-card mg-row" style={{ display: 'block' }}>
        <div className="mg-card-header">
          <div>
            <div className="mg-card-title flex items-center">
              Mine fleet &amp; smart helmets 
              <span className="mg-text-muted" style={{ fontWeight: 400, fontSize: 'var(--mg-fs-sm)', marginLeft: '8px' }}>
                · {filteredWorkers.length} units deployed
              </span>
            </div>
            <div className="mg-card-sub">Real-time multi-sensor telemetry for deployed personnel</div>
          </div>

          {/* Zone Filter Tab Buttons */}
          <div className="mg-segment">
            {['ALL', 'Shaft 3', 'Drift 1', 'Extraction Face', 'Conveyor 2'].map(zone => (
              <button
                key={zone}
                onClick={() => setSelectedZone(zone)}
                className={selectedZone === zone ? 'is-active' : ''}
              >
                {zone === 'ALL' ? 'All zones' : zone}
              </button>
            ))}
          </div>
        </div>

        <div className="mg-card-body">
          <div className="mg-row mg-cols-3 mg-tight">
            {filteredWorkers.map(({ worker, status, age_seconds, reading }) => {
              const isOnline = status === 'online';
              const isSos = reading?.sos;
              const isFall = reading?.fall;
              const gasMv = Math.max(reading?.mq2_mv || 0, reading?.mq5_mv || 0);
              const isGasHigh = isOnline && gasMv >= 2000;
              const isCrit = isOnline && (isSos || isFall || gasMv >= 2500);
              const isLiveHardware = worker.id === 'W006' || worker.helmet_id === 'H-ESP32-LIVE';

              return (
                <article
                  key={worker.id}
                  onClick={() => onSelectWorker(worker.id)}
                  className={`mg-unit cursor-pointer ${isCrit ? 'is-alert' : ''}`}
                >
                  <div className="mg-unit-head">
                    <span 
                      className={`mg-icon-chip ${isCrit ? 'mg-chip-danger' : isOnline ? 'mg-chip-primary' : 'bg-[#eff0f4] text-[#878a99]'}`}
                      style={{ width: '36px', height: '36px', fontSize: '18px' }}
                    >
                      <HardHat className="mg-i" />
                    </span>
                    <div className="mg-unit-id">
                      <div className="mg-unit-name flex items-center space-x-1">
                        <span>{worker.name}</span>
                        {isLiveHardware && (
                          <span className="mg-badge mg-badge-info ml-1.5" style={{ fontSize: '10px' }}>
                            Physical
                          </span>
                        )}
                      </div>
                      <div className="mg-unit-meta">
                        {worker.zone} · <span className="mg-mono">{worker.helmet_id}</span>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div className={`mg-status ${isOnline ? 'mg-status-ok' : 'mg-status-off'}`}>
                        {isOnline ? 'Online' : 'Standby'}
                      </div>
                      <div className="mg-unit-meta">
                        {isOnline ? `${age_seconds} s ago` : 'Awaiting packet'}
                      </div>
                    </div>
                  </div>

                  <div className="mg-unit-stats">
                    <div>
                      <div className="mg-stat-label">Heart rate</div>
                      <div className="mg-stat-value mg-num">
                        {isOnline && reading?.heart_rate ? (
                          <>
                            {reading.heart_rate} <small>bpm</small>
                          </>
                        ) : (
                          <span className="mg-text-muted">—</span>
                        )}
                      </div>
                    </div>
                    <div>
                      <div className="mg-stat-label">MQ-2 gas</div>
                      <div className="mg-stat-value mg-num">
                        {isOnline && gasMv > 0 ? (
                          <>
                            {gasMv} <small>mV</small>
                          </>
                        ) : (
                          <span className="mg-text-muted">—</span>
                        )}
                      </div>
                    </div>
                    <div>
                      <div className="mg-stat-label">Temperature</div>
                      <div className="mg-stat-value mg-num">
                        {isOnline && reading?.temperature != null ? (
                          <>
                            {reading.temperature} <small>°C</small>
                          </>
                        ) : (
                          <span className="mg-text-muted">—</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="mg-unit-foot">
                    <span>
                      {isOnline 
                        ? `Battery ${reading?.battery || 88}% · ${reading?.pressure || 1013} hPa`
                        : 'Battery — · — hPa'}
                    </span>
                    <span className="text-[#405189] font-medium flex items-center">
                      Inspect ›
                    </span>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      {/* 7. 2-Column Row: Spatial Architecture Map (5) & Gas Dynamics Chart (7) */}
      <div className="mg-row mg-cols-2">
        
        {/* Left: Spatial Architecture Map */}
        <section className="mg-card flex flex-col justify-between">
          <div>
            <div className="mg-card-header">
              <div>
                <div className="mg-card-title flex items-center">
                  <Compass className="mg-i text-[#405189] mr-2" />
                  Mine zone spatial architecture
                </div>
                <div className="mg-card-sub">Click a zone or node to inspect.</div>
              </div>
              <span className="mg-badge mg-badge-info">
                Sector 4 ventilation
              </span>
            </div>

            <div className="mg-card-body pb-0">
              {/* Dynamic Telemetry-driven SVG Tunnel Model */}
              {(() => {
                const getNode = (wId) => {
                  const item = workersLatest.find(w => w.worker?.id === wId);
                  const r = item?.reading || {};
                  const gas = Math.max(r.mq2_mv || 0, r.mq5_mv || 0);
                  const isCrit = r.sos || r.fall || gas >= 2500;
                  const isWarn = !isCrit && (gas >= 2000 || (r.heart_rate && r.heart_rate > 105));
                  const isOnline = item?.status === 'online';
                  return {
                    color: isCrit ? '#f06548' : isWarn ? '#f7b84b' : isOnline ? '#0ab39c' : '#878a99',
                    gas: isOnline && gas > 0 ? `${gas} mV` : isOnline ? 'Nominal' : '—',
                    isCrit,
                    isWarn,
                    isOnline
                  };
                };

                const h1 = getNode('W001');
                const h2 = getNode('W002');
                const h3 = getNode('W003');
                const h4 = getNode('W004');
                const h5 = getNode('W006');

                return (
                  <div className="mg-map aspect-[4/3] flex items-center justify-center p-3 relative">
                    <svg viewBox="0 0 400 300" className="w-full h-full select-none">
                      {/* Main Intake Shaft (Vertical) */}
                      <line x1="200" y1="20" x2="200" y2="280" stroke="#3b4a72" strokeWidth="18" strokeLinecap="round" />
                      
                      {/* Level 1 Cross-Drifts */}
                      <line x1="50" y1="100" x2="350" y2="100" stroke="#3b4a72" strokeWidth="14" strokeLinecap="round" />
                      
                      {/* Level 2 Sub-level Drifts */}
                      <line x1="70" y1="200" x2="330" y2="200" stroke="#3b4a72" strokeWidth="14" strokeLinecap="round" />

                      {/* Ventilation Airflow Vectors */}
                      <g fill="#abb9e8" opacity="0.75" fontSize="8" fontFamily="Poppins, Arial">
                        <text x="200" y="75" textAnchor="middle">▼ 3.4 m/s Intake Airflow</text>
                        <text x="135" y="96" textAnchor="middle">◀ 2.8 m/s</text>
                        <text x="265" y="96" textAnchor="middle">2.6 m/s ▶</text>
                        <text x="135" y="196" textAnchor="middle">◀ 2.1 m/s</text>
                        <text x="265" y="196" textAnchor="middle">1.9 m/s ▶ (Return Seam)</text>
                      </g>

                      {/* Zone Regions */}
                      {/* Surface Portal / Base */}
                      <g className="cursor-pointer" onClick={() => setSelectedZone('ALL')}>
                        <rect x="135" y="12" width="130" height="24" rx="4" fill="#33426b" stroke="#51628f" />
                        <text x="200" y="27" fill="#dfe6ff" fontSize="9" fontWeight="bold" textAnchor="middle">Surface Portal / Base</text>
                      </g>

                      {/* Zone A: Shaft 3 */}
                      <g className="cursor-pointer" onClick={() => setSelectedZone('Shaft 3')}>
                        <rect x="15" y="88" width="105" height="25" rx="4" fill="#33426b" stroke="#51628f" />
                        <text x="67" y="103" fill="#ffffff" fontSize="8.5" fontWeight="bold" textAnchor="middle">Zone A (Shaft 3)</text>
                        <text x="67" y="111" fill="#abb9e8" fontSize="7" textAnchor="middle">Intake Seam · 180m</text>
                      </g>

                      {/* Zone B: Drift 1 */}
                      <g className="cursor-pointer" onClick={() => setSelectedZone('Drift 1')}>
                        <rect x="280" y="88" width="105" height="25" rx="4" fill="#33426b" stroke="#51628f" />
                        <text x="332" y="103" fill="#ffffff" fontSize="8.5" fontWeight="bold" textAnchor="middle">Zone B (Drift 1)</text>
                        <text x="332" y="111" fill="#abb9e8" fontSize="7" textAnchor="middle">Haulage Crosscut · 240m</text>
                      </g>

                      {/* Zone B: Conveyor 2 */}
                      <g className="cursor-pointer" onClick={() => setSelectedZone('Conveyor 2')}>
                        <rect x="25" y="188" width="115" height="25" rx="4" fill="#33426b" stroke="#51628f" />
                        <text x="82" y="203" fill="#ffffff" fontSize="8.5" fontWeight="bold" textAnchor="middle">Zone B (Conveyor 2)</text>
                        <text x="82" y="211" fill="#abb9e8" fontSize="7" textAnchor="middle">Belt Gallery · 240m</text>
                      </g>

                      {/* Zone C: Face */}
                      <g className="cursor-pointer" onClick={() => setSelectedZone('Extraction Face')}>
                        <rect x="270" y="188" width="115" height="25" rx="4" fill="#33426b" stroke="#51628f" />
                        <text x="327" y="203" fill="#ffffff" fontSize="8.5" fontWeight="bold" textAnchor="middle">Zone C (Face)</text>
                        <text x="327" y="211" fill="#abb9e8" fontSize="7" textAnchor="middle">Active Seam · 320m</text>
                      </g>

                      {/* Worker Telemetry Node Circles */}
                      {/* H1 (Shaft 3: W001) */}
                      <g className="cursor-pointer" onClick={() => onSelectWorker('W001')}>
                        <circle cx="67" cy="135" r="10" fill={h1.color} stroke="#FFFFFF" strokeWidth="1.5" />
                        <text x="67" y="138.5" fill="#FFFFFF" fontSize="8.5" fontWeight="bold" textAnchor="middle">H1</text>
                        <text x="67" y="154" fill="#CBD5E1" fontSize="7.5" fontFamily="Consolas, monospace" textAnchor="middle">{h1.gas}</text>
                      </g>

                      {/* H2 (Drift 1: W002) */}
                      <g className="cursor-pointer" onClick={() => onSelectWorker('W002')}>
                        <circle cx="332" cy="135" r="10" fill={h2.color} stroke="#FFFFFF" strokeWidth="1.5" />
                        <text x="332" y="138.5" fill="#FFFFFF" fontSize="8.5" fontWeight="bold" textAnchor="middle">H2</text>
                        <text x="332" y="154" fill="#CBD5E1" fontSize="7.5" fontFamily="Consolas, monospace" textAnchor="middle">{h2.gas}</text>
                      </g>

                      {/* H3 (Face: W003) */}
                      <g className="cursor-pointer" onClick={() => onSelectWorker('W003')}>
                        <circle cx="327" cy="235" r="10" fill={h3.color} stroke="#FFFFFF" strokeWidth="1.5" />
                        <text x="327" y="238.5" fill="#FFFFFF" fontSize="8.5" fontWeight="bold" textAnchor="middle">H3</text>
                        <text x="327" y="254" fill="#CBD5E1" fontSize="7.5" fontFamily="Consolas, monospace" textAnchor="middle">{h3.gas}</text>
                      </g>

                      {/* H4 (Conveyor 2: W004) */}
                      <g className="cursor-pointer" onClick={() => onSelectWorker('W004')}>
                        <circle cx="82" cy="235" r="10" fill={h4.color} stroke="#FFFFFF" strokeWidth="1.5" />
                        <text x="82" y="238.5" fill="#FFFFFF" fontSize="8.5" fontWeight="bold" textAnchor="middle">H4</text>
                        <text x="82" y="254" fill="#CBD5E1" fontSize="7.5" fontFamily="Consolas, monospace" textAnchor="middle">{h4.gas}</text>
                      </g>

                      {/* H5 (Physical Smart Helmet: W006) */}
                      <g className="cursor-pointer" onClick={() => onSelectWorker('W006')}>
                        <circle cx="200" cy="48" r="10" fill={h5.isOnline ? h5.color : '#878a99'} stroke="#ffffff" strokeWidth="1.5" />
                        <text x="200" y="51.5" fill="#FFFFFF" fontSize="8" fontWeight="bold" textAnchor="middle">H5</text>
                        <text x="200" y="66" fill={h5.isOnline ? '#0ab39c' : '#abb9e8'} fontSize="7.5" fontWeight="bold" textAnchor="middle">
                          {h5.isOnline ? h5.gas : 'Physical (Standby)'}
                        </text>
                      </g>
                    </svg>
                  </div>
                );
              })()}

              {/* Environmental Zone Quick Cards */}
              <div className="mg-row mg-cols-2 mg-tight mg-mt-3">
                <div 
                  onClick={() => setSelectedZone('Shaft 3')}
                  className="mg-inset mg-flex mg-between cursor-pointer"
                >
                  <div>
                    <div className="mg-cell-title">Zone A (Shaft 3)</div>
                    <div className="mg-cell-sub">Fresh air intake · Nominal</div>
                  </div>
                  <span className="mg-badge mg-badge-success">3.4 m/s</span>
                </div>

                <div 
                  onClick={() => setSelectedZone('Extraction Face')}
                  className="mg-inset mg-flex mg-between cursor-pointer"
                >
                  <div>
                    <div className="mg-cell-title">Zone C (Face)</div>
                    <div className="mg-cell-sub">Methane seam · Aux fan active</div>
                  </div>
                  <span className="mg-badge mg-badge-success">1.9 m/s</span>
                </div>
              </div>
            </div>
          </div>

          {/* Map Legend Footer */}
          <div className="mg-card-footer">
            <div className="mg-legend">
              <span><i style={{ background: 'var(--mg-success)' }}></i>Nominal</span>
              <span><i style={{ background: 'var(--mg-warning)' }}></i>Elevated</span>
              <span><i style={{ background: 'var(--mg-danger)' }}></i>Critical</span>
              <span><i style={{ background: 'var(--mg-primary)' }}></i>H5 (physical)</span>
            </div>
            <span>Click zone to filter</span>
          </div>
        </section>

        {/* Right: Atmospheric Gas Telemetry Chart */}
        <section className="mg-card flex flex-col justify-between">
          <div>
            <div className="mg-card-header">
              <div>
                <div className="mg-card-title flex items-center">
                  <TrendingUp className="mg-i text-[#405189] mr-2" />
                  Atmospheric gas telemetry (MQ-2)
                </div>
                <div className="mg-card-sub">Calibrated sensor index in millivolts across shaft drifts (nominal &lt; 2000 mV).</div>
              </div>

              {/* Worker Selector Pills */}
              <div className="mg-segment">
                {['ALL', 'W001', 'W002', 'W003', 'W004'].map(wId => (
                  <button
                    key={wId}
                    onClick={() => setSelectedChartWorker(wId)}
                    className={selectedChartWorker === wId ? 'is-active' : ''}
                  >
                    {wId === 'ALL' ? 'All units' : wId}
                  </button>
                ))}
              </div>
            </div>

            <div className="mg-card-body pb-0">
              <div className="h-60 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={[
                      { time: '10:00', W001: 1220, W002: 1210, W003: 1380, W004: 1200 },
                      { time: '10:15', W001: 1230, W002: 1220, W003: 1450, W004: 1210 },
                      { time: '10:30', W001: 1240, W002: 1215, W003: 1620, W004: 1205 },
                      { time: '10:45', W001: 1235, W002: 1225, W003: 1850, W004: 1215 },
                      { time: '11:00', W001: 1250, W002: 1230, W003: 2048, W004: 1220 },
                      { time: '11:15', W001: 1245, W002: 1220, W003: 1950, W004: 1210 },
                      { time: '11:30', W001: 1240, W002: 1225, W003: 1720, W004: 1205 },
                      { time: 'Now',   W001: 1245, W002: 1220, W003: 1380, W004: 1210 },
                    ]}
                    margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient id="gasChartGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--mg-primary)" stopOpacity={0.25}/>
                        <stop offset="95%" stopColor="var(--mg-primary)" stopOpacity={0.0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--mg-border-soft)" />
                    <XAxis dataKey="time" stroke="var(--mg-muted)" fontSize={10} />
                    <YAxis stroke="var(--mg-muted)" fontSize={10} domain={[1000, 2600]} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#FFFFFF', borderColor: 'var(--mg-border)', borderRadius: '4px', fontSize: '11px', boxShadow: 'var(--mg-shadow)' }} 
                    />
                    <ReferenceLine y={2000} stroke="var(--mg-warning)" strokeDasharray="3 3" label={{ value: 'Warn: 2000mV', fill: 'var(--mg-warning-text)', fontSize: 9 }} />
                    <ReferenceLine y={2500} stroke="var(--mg-danger)" strokeDasharray="3 3" label={{ value: 'Crit: 2500mV', fill: 'var(--mg-danger)', fontSize: 9 }} />
                    
                    {selectedChartWorker === 'ALL' || selectedChartWorker === 'W003' ? (
                      <Area type="monotone" dataKey="W003" name="Demo Helmet #3 (Extraction)" stroke="var(--mg-warning)" strokeWidth={2} fillOpacity={1} fill="url(#gasChartGrad)" />
                    ) : null}
                    {selectedChartWorker === 'ALL' || selectedChartWorker === 'W001' ? (
                      <Area type="monotone" dataKey="W001" name="Demo Helmet #1 (Shaft 3)" stroke="var(--mg-primary)" strokeWidth={1.75} fill="none" />
                    ) : null}
                    {selectedChartWorker === 'ALL' || selectedChartWorker === 'W002' ? (
                      <Area type="monotone" dataKey="W002" name="Demo Helmet #2 (Drift 1)" stroke="var(--mg-success)" strokeWidth={1.5} fill="none" />
                    ) : null}
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div className="mg-card-footer">
            <span>Critical limit 2500 mV · Warning 2000 mV</span>
            <span>Real-time ADC telemetry</span>
          </div>
        </section>

      </div>

      {/* 8. Recent Operational Incidents & Logs Table */}
      <section className="mg-card mg-row" style={{ display: 'block' }} id="incidents">
        <div className="mg-card-header">
          <div className="mg-card-title flex items-center">
            <AlertTriangle className="mg-i text-[#f7b84b] mr-2" />
            Operational incident audit trail
          </div>
          <button
            onClick={onNavigateAlerts}
            className="mg-btn mg-btn-soft mg-btn-sm"
          >
            <span>View all records ({activeAlerts.length})</span>
            <ArrowUpRight className="h-3.5 w-3.5 ml-1" />
          </button>
        </div>

        <div className="mg-card-body flush">
          {activeAlerts.length === 0 ? (
            <div className="p-8 text-center bg-[#f8f9fa]">
              <CheckCircle2 className="h-7 w-7 text-[#0ab39c] mx-auto mb-1.5" />
              <div className="mg-cell-title">No active safety incidents</div>
              <div className="mg-cell-sub">Atmospheric levels and biometrics are within nominal bounds.</div>
            </div>
          ) : (
            <div className="mg-table-wrap">
              <table className="mg-table">
                <thead>
                  <tr>
                    <th style={{ width: '150px' }}>Severity</th>
                    <th>Event</th>
                    <th>Unit</th>
                    <th>Time</th>
                    <th className="is-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {activeAlerts.slice(0, 5).map(alert => (
                    <tr key={alert.id}>
                      <td>
                        <span className={
                          alert.severity === 'CRITICAL' ? 'mg-badge mg-badge-danger' :
                          alert.severity === 'WARNING' ? 'mg-badge mg-badge-warning' :
                          'mg-badge mg-badge-info'
                        }>
                          {alert.severity} · {alert.type}
                        </span>
                      </td>
                      <td className="mg-cell-title">{alert.message}</td>
                      <td>
                        <span>{alert.worker_name || alert.worker_id}</span>
                        {alert.worker_id && <span className="mg-mono ml-1 text-[11px] text-[#878a99]">({alert.worker_id})</span>}
                      </td>
                      <td className="mg-num">{new Date(alert.ts).toLocaleTimeString()}</td>
                      <td className="is-right">
                        {!alert.acknowledged && !alert.resolved_at ? (
                          <button
                            onClick={(e) => handleAcknowledgeAlert(alert.id, e)}
                            className="mg-btn mg-btn-sm"
                          >
                            Acknowledge
                          </button>
                        ) : (
                          <span className="mg-badge mg-badge-neutral">Acked</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

    </div>
  );
}
