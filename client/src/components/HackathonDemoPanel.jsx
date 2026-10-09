import React, { useState, useEffect, useRef } from 'react';
import { 
  Play, Pause, RotateCcw, ShieldAlert, 
  Flame, TrendingUp, Radio, Activity,
  ChevronDown, ChevronUp, Heart, Gauge, Thermometer, ShieldCheck
} from 'lucide-react';
import { 
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine 
} from 'recharts';
import { useApp } from '../context/AppContext';

/**
 * MineGuard Hackathon Demo Mode
 * Styled strictly against the MineGuard design system template
 */
export default function HackathonDemoPanel() {
  const { injectDemoAlert, resolveDemoAlert, clearDemoAlerts, addToast, playAlertSound } = useApp();
  const [isRunning, setIsRunning] = useState(false);
  const [currentStep, setCurrentStep] = useState(0); // 0 to 40 seconds
  const [isExpanded, setIsExpanded] = useState(true);
  
  // Historical data points for the live chart
  const [chartHistory, setChartHistory] = useState([
    { second: 0, gasMv: 1240, riskProb: 5 }
  ]);

  const timerRef = useRef(null);
  const alertInjectedRef = useRef(false);
  const alertResolvedRef = useRef(false);
  const TOTAL_DURATION = 40; // 40 seconds total scenario

  // Deterministic values generator based on timeline second (0 to 40)
  const getScenarioValues = (sec) => {
    let stage = 'Normal';
    let stageNum = 1;
    let gasMv = 1240;
    let riskProb = 5.2;
    let stageDescription = 'Baseline atmospheric telemetry in extraction drift. Nominal ventilation active.';
    let hr = 74;
    let temp = 27.8;

    if (sec <= 10) {
      // 1. NORMAL STAGE (0 - 10s)
      stage = 'Normal baseline';
      stageNum = 1;
      gasMv = Math.round(1230 + Math.sin(sec) * 15);
      riskProb = +(4.2 + (sec / 10) * 3).toFixed(1);
      stageDescription = 'Baseline atmospheric telemetry in extraction drift. Nominal ventilation active.';
      hr = 74;
      temp = 27.8;
    } else if (sec <= 22) {
      // 2. GAS RISING STAGE (11 - 22s)
      stage = 'Gas levels rising';
      stageNum = 2;
      const progress = (sec - 10) / 12; // 0 to 1
      gasMv = Math.round(1245 + progress * (2200 - 1245));
      riskProb = +(7.2 + progress * (78.0 - 7.2)).toFixed(1);
      stageDescription = 'Simulated methane pocket desorbing from coal face. Multi-sample electrical rise detected.';
      hr = Math.round(74 + progress * 14);
      temp = +(27.8 + progress * 0.8).toFixed(1);
    } else if (sec <= 32) {
      // 3. SIMULATED RISK ALERT (23 - 32s)
      stage = 'Simulated alert';
      stageNum = 3;
      const peakOffset = Math.sin((sec - 23) * 0.7) * 45;
      gasMv = Math.round(2480 + peakOffset);
      riskProb = +(88.5 + (peakOffset / 45) * 4.5).toFixed(1);
      stageDescription = 'Gas index exceeds safety limit (2450+ mV). Automated early warning protocol activated.';
      hr = 94;
      temp = 28.9;
    } else {
      // 4. RECOVERY STAGE (33 - 40s)
      stage = 'Ventilation recovery';
      stageNum = 4;
      const progress = (sec - 32) / 8; // 0 to 1
      gasMv = Math.round(2480 - progress * (2480 - 1240));
      riskProb = +(88.5 - progress * (88.5 - 5.0)).toFixed(1);
      stageDescription = 'Mine auxiliary fans engaged. Gas concentration returning towards safe baseline.';
      hr = Math.round(94 - progress * 18);
      temp = +(28.9 - progress * 1.1).toFixed(1);
    }

    return {
      sec,
      stage,
      stageNum,
      gasMv,
      riskProb,
      stageDescription,
      hr,
      temp,
      pressure: +(1013.2 - (gasMv > 2000 ? 1.8 : 0)).toFixed(1)
    };
  };

  const currentValues = getScenarioValues(currentStep);

  // Timer loop
  useEffect(() => {
    if (isRunning) {
      timerRef.current = setInterval(() => {
        setCurrentStep((prev) => {
          if (prev >= TOTAL_DURATION) {
            setIsRunning(false);
            clearInterval(timerRef.current);
            if (addToast) {
              addToast({
                type: 'success',
                title: 'Scenario Complete',
                message: '40s deterministic risk cycle finished. System purged and nominal.'
              });
            }
            return TOTAL_DURATION;
          }
          return prev + 1;
        });
      }, 1000);
    } else {
      clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [isRunning, addToast]);

  // Sync state actions based on second
  useEffect(() => {
    const v = getScenarioValues(currentStep);

    // Update historical chart data
    setChartHistory((prev) => {
      const exists = prev.some((p) => p.second === currentStep);
      if (exists) return prev;
      return [...prev, { second: currentStep, gasMv: v.gasMv, riskProb: v.riskProb }];
    });

    // Reset flags if step rewound below triggers
    if (currentStep < 23) {
      alertInjectedRef.current = false;
    }
    if (currentStep < 33) {
      alertResolvedRef.current = false;
    }

    // Stage 3 entry: inject simulated alert strictly once
    if (currentStep === 23 && !alertInjectedRef.current && injectDemoAlert) {
      alertInjectedRef.current = true;
      injectDemoAlert({
        id: 'DEMO-ALERT-STAGE3',
        worker_id: 'DEMO-MINER-01',
        worker_name: 'Demo Helmet #1 (Simulated test)',
        type: 'GAS_SURGE',
        severity: 'CRITICAL',
        message: 'Critical Gas Surge Anomaly: MQ-2 reading exceeded 2450 mV in Sector 4B.',
        ts: new Date().toISOString(),
        is_demo: true,
        acknowledged: false
      });
      if (playAlertSound) playAlertSound();
    }

    // Stage 4 recovery: auto-resolve alert strictly once
    if (currentStep === 33 && !alertResolvedRef.current && resolveDemoAlert) {
      alertResolvedRef.current = true;
      resolveDemoAlert('DEMO-ALERT-STAGE3');
      if (addToast) {
        addToast({
          type: 'info',
          title: 'Ventilation Engaged',
          message: 'Auxiliary fans activated. Dissipating gas levels back to baseline.'
        });
      }
    }
  }, [currentStep, injectDemoAlert, resolveDemoAlert, playAlertSound, addToast]);

  const handleStart = () => {
    if (currentStep >= TOTAL_DURATION) {
      setCurrentStep(0);
      alertInjectedRef.current = false;
      alertResolvedRef.current = false;
      setChartHistory([{ second: 0, gasMv: 1240, riskProb: 5 }]);
    }
    setIsRunning(true);
  };

  const handleStop = () => {
    setIsRunning(false);
  };

  const handleReset = () => {
    setIsRunning(false);
    setCurrentStep(0);
    alertInjectedRef.current = false;
    alertResolvedRef.current = false;
    if (clearDemoAlerts) clearDemoAlerts();
    setChartHistory([{ second: 0, gasMv: 1240, riskProb: 5 }]);
  };

  const progressPercent = Math.min(100, Math.round((currentStep / TOTAL_DURATION) * 100));

  return (
    <section className="mg-card mg-row" style={{ display: 'block' }}>
      {/* 1. Card Header */}
      <div className="mg-card-header">
        <div>
          <div className="mg-card-title flex items-center">
            Demo mode — simulate risky levels 
            <span className="mg-badge mg-badge-info" style={{ marginLeft: '8px', verticalAlign: 'middle' }}>
              Simulated bench
            </span>
          </div>
          <div className="mg-card-sub">
            Deterministic 40 s scenario: Normal (0 s) → Gas rising (11 s) → Simulated alert (23 s) → Recovery (33 s)
          </div>
        </div>

        {/* Action Controls */}
        <div className="mg-card-tools">
          {!isRunning ? (
            <button onClick={handleStart} className="mg-btn mg-btn-success">
              <Play className="mg-i" />
              <span>{currentStep === 0 ? 'Start risk scenario' : 'Resume scenario'}</span>
            </button>
          ) : (
            <button onClick={handleStop} className="mg-btn mg-btn-danger">
              <Pause className="mg-i" />
              <span>Stop scenario</span>
            </button>
          )}

          <button onClick={handleReset} className="mg-btn">
            <RotateCcw className="mg-i" />
            <span>Reset</span>
          </button>

          <span className="mg-badge mg-badge-neutral">
            Physical helmet: ESP32 armed
          </span>

          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="mg-btn mg-btn-ghost p-1"
            title={isExpanded ? 'Collapse' : 'Expand'}
          >
            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* 2. Expanded Panel Content */}
      {isExpanded && (
        <div className="mg-card-body">
          {/* Progress Timeline Header */}
          <div className="mg-flex mg-between" style={{ marginBottom: '8px' }}>
            <span className="mg-label">
              Timeline: <span className="mg-mono" style={{ color: 'var(--mg-heading)' }}>{currentStep}s / {TOTAL_DURATION}s ({progressPercent}%)</span>
            </span>
            <span className="mg-label">
              Simulated state isolated to Demo Helmet #1 (Sector 4B)
            </span>
          </div>

          {/* Progress Bar */}
          <div className="mg-progress" style={{ marginBottom: '16px' }}>
            <span style={{ width: `${progressPercent}%` }}></span>
          </div>

          {/* 4 Steps Stepper */}
          <div className="mg-steps">
            {[
              { num: 1, name: 'Normal baseline', range: '0 s – 10 s' },
              { num: 2, name: 'Gas levels rising', range: '11 s – 22 s' },
              { num: 3, name: 'Simulated alert', range: '23 s – 32 s' },
              { num: 4, name: 'Ventilation recovery', range: '33 s – 40 s' },
            ].map((st) => (
              <div 
                key={st.num}
                className={`mg-step ${currentValues.stageNum === st.num ? 'is-active' : ''}`}
                onClick={() => {
                  if (st.num === 1) setCurrentStep(0);
                  if (st.num === 2) setCurrentStep(12);
                  if (st.num === 3) setCurrentStep(24);
                  if (st.num === 4) setCurrentStep(34);
                }}
              >
                <div className="mg-step-name">
                  <span className="mg-step-no">{st.num}</span>
                  {st.name}
                </div>
                <div className="mg-step-time">{st.range}</div>
              </div>
            ))}
          </div>

          {/* Critical Hazard Alert Banner (Active during Stage 3) */}
          {currentValues.stageNum === 3 && (
            <div className="mg-banner mg-banner-danger mg-mt-3" role="alert" style={{ marginBottom: '16px' }}>
              <ShieldAlert className="mg-i mg-banner-icon" />
              <div className="mg-banner-body">
                <div className="mg-banner-title">Critical hazard threshold exceeded</div>
                <div className="mg-banner-text">
                  MQ-2 concentration surge: {currentValues.gasMv} mV &gt; 2450 mV. Early warning ventilation protocol active.
                </div>
              </div>
              <span className="mg-badge mg-badge-solid-danger">Stage 3 of 4</span>
            </div>
          )}

          {/* 2-Column Unit Readout & Chart */}
          <div className="mg-row mg-cols-5-7 mg-mt-3" style={{ marginBottom: 0 }}>
            
            {/* Unit Helmet Readout */}
            <div className="mg-unit">
              <div className="mg-unit-head">
                <div className="mg-unit-id">
                  <div className="mg-unit-name">Demo Helmet #1 (simulated test)</div>
                  <div className="mg-unit-meta">
                    <span className="mg-mono">DEMO-MINER-01</span> · Sector 4B
                  </div>
                </div>
                <span className={
                  currentValues.stageNum === 3 ? 'mg-badge mg-badge-danger' :
                  currentValues.stageNum === 2 ? 'mg-badge mg-badge-warning' :
                  'mg-badge mg-badge-success'
                }>
                  {currentValues.stage}
                </span>
              </div>

              <div style={{ padding: '0 16px 16px' }}>
                <div className="mg-readings">
                  <div className="mg-reading">
                    <div className="mg-reading-label">Heart rate</div>
                    <div className="mg-reading-value mg-num">
                      {currentValues.hr}<span className="mg-reading-unit">bpm</span>
                    </div>
                  </div>
                  <div className="mg-reading">
                    <div className="mg-reading-label">Temperature</div>
                    <div className="mg-reading-value mg-num">
                      {currentValues.temp}<span className="mg-reading-unit">°C</span>
                    </div>
                  </div>
                  <div className="mg-reading">
                    <div className="mg-reading-label">Pressure</div>
                    <div className="mg-reading-value mg-num">
                      {currentValues.pressure}<span className="mg-reading-unit">hPa</span>
                    </div>
                  </div>
                </div>

                <div className="mg-mt-3">
                  <div className="mg-flex mg-between">
                    <span className="mg-label">MQ-2 gas sensor</span>
                    <span className="mg-mono" style={{ color: 'var(--mg-heading)', fontWeight: 600 }}>
                      {currentValues.gasMv} mV
                    </span>
                  </div>
                  <div className={`mg-progress mg-mt-2 ${
                    currentValues.gasMv >= 2400 ? 'is-crit' : currentValues.gasMv >= 2000 ? 'is-warn' : 'is-ok'
                  }`}>
                    <span style={{ width: `${Math.min(100, Math.round((currentValues.gasMv / 2800) * 100))}%` }}></span>
                  </div>
                  <div className="mg-flex mg-between mg-mt-2 mg-text-muted" style={{ fontSize: 'var(--mg-fs-xs)' }}>
                    <span>Baseline 1200 mV</span>
                    <span>Warning 2000 mV</span>
                    <span>Critical 2500 mV</span>
                  </div>
                </div>

                <div className="mg-inset mg-flex mg-between mg-mt-3">
                  <div>
                    <div className="mg-label">Illustrative risk score</div>
                    <div className="mg-kpi-value mg-num" style={{ fontSize: '20px' }}>
                      {currentValues.riskProb}<span className="mg-kpi-unit">%</span>
                    </div>
                  </div>
                  <span className={
                    currentValues.riskProb >= 75 ? 'mg-badge mg-badge-danger' :
                    currentValues.riskProb >= 35 ? 'mg-badge mg-badge-warning' :
                    'mg-badge mg-badge-success'
                  }>
                    {currentValues.riskProb >= 75 ? 'Critical' : currentValues.riskProb >= 35 ? 'Elevated' : 'Nominal'}
                  </span>
                </div>
              </div>
            </div>

            {/* Simulated Curve Chart */}
            <div className="mg-unit flex flex-col justify-between">
              <div>
                <div className="mg-unit-head">
                  <div className="mg-unit-id">
                    <div className="mg-unit-name">Simulated gas dynamics curve (0–40 s)</div>
                    <div className="mg-unit-meta">{currentValues.stageDescription}</div>
                  </div>
                  <span className="mg-label mg-mono">t = {currentStep} s</span>
                </div>

                <div style={{ padding: '0 16px 8px' }}>
                  <div className="h-44 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={chartHistory}>
                        <defs>
                          <linearGradient id="mgChartGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="var(--mg-primary)" stopOpacity={0.25}/>
                            <stop offset="95%" stopColor="var(--mg-primary)" stopOpacity={0.0}/>
                          </linearGradient>
                        </defs>
                        <XAxis 
                          dataKey="second" 
                          stroke="var(--mg-muted)" 
                          fontSize={10} 
                          tickFormatter={(v) => `${v}s`}
                          domain={[0, 40]}
                        />
                        <YAxis 
                          stroke="var(--mg-muted)" 
                          fontSize={10} 
                          domain={[1000, 2700]} 
                          tickFormatter={(v) => `${v}`}
                        />
                        <Tooltip 
                          contentStyle={{ backgroundColor: '#FFFFFF', borderColor: 'var(--mg-border)', borderRadius: '4px', fontSize: '11px', boxShadow: 'var(--mg-shadow)' }}
                          formatter={(val, name) => [
                            name === 'gasMv' ? `${val} mV` : `${val}%`,
                            name === 'gasMv' ? 'Gas index' : 'Risk probability'
                          ]}
                          labelFormatter={(lbl) => `Time: ${lbl}s`}
                        />
                        <ReferenceLine y={2000} stroke="var(--mg-warning)" strokeDasharray="3 3" label={{ value: 'Warning', fill: 'var(--mg-warning-text)', fontSize: 9 }} />
                        <ReferenceLine y={2450} stroke="var(--mg-danger)" strokeDasharray="3 3" label={{ value: 'Critical', fill: 'var(--mg-danger)', fontSize: 9 }} />
                        <Area 
                          type="monotone" 
                          dataKey="gasMv" 
                          stroke="var(--mg-primary)" 
                          strokeWidth={2}
                          fillOpacity={1} 
                          fill="url(#mgChartGrad)" 
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              <div className="mg-unit-foot">
                <span>Stage 1 Nominal → 2 Gas surge → 3 Alert → 4 Purge</span>
                <span className="font-medium text-[#405189]">Deterministic model</span>
              </div>
            </div>

          </div>
        </div>
      )}
    </section>
  );
}
