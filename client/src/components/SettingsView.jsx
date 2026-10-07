import React, { useState, useEffect } from 'react';
import { 
  Sliders, Save, RefreshCw, Bell, Volume2, 
  Database, Shield, CheckCircle2, Zap, Clock
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { api } from '../services/api';

export default function SettingsView() {
  const { 
    thresholds, 
    refreshData, 
    soundEnabled, 
    setSoundEnabled, 
    unitCelsius, 
    setUnitCelsius, 
    demoMode, 
    setDemoMode,
    addToast
  } = useApp();

  const [thresholdList, setThresholdList] = useState([]);
  const [historyInterval, setHistoryInterval] = useState(10);
  const [offlineTimeout, setOfflineTimeout] = useState(30);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setThresholdList(thresholds);
    api.getSystemConfig().then(cfg => {
      if (cfg.history_interval_sec) setHistoryInterval(cfg.history_interval_sec);
      if (cfg.offline_timeout_sec) setOfflineTimeout(cfg.offline_timeout_sec);
    }).catch(() => {});
  }, [thresholds]);

  const handleThresholdChange = (key, field, value) => {
    setThresholdList(prev => prev.map(t => {
      if (t.key === key) {
        return { ...t, [field]: value };
      }
      return t;
    }));
  };

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await Promise.all([
        api.updateThresholds(thresholdList),
        api.updateSystemConfig({
          history_interval_sec: historyInterval,
          offline_timeout_sec: offlineTimeout
        })
      ]);
      addToast({
        type: 'success',
        title: 'Settings Saved',
        message: 'Thresholds and operational parameters successfully updated in database.'
      });
      refreshData();
    } catch (err) {
      console.error('Failed to save settings:', err);
      addToast({
        type: 'danger',
        title: 'Error Saving Settings',
        message: err.message || 'Failed to update system settings'
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      
      {/* Header */}
      <div>
        <h2 className="text-xl font-black text-slate-800 tracking-tight flex items-center space-x-2">
          <span>Safety Thresholds & System Preferences</span>
        </h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Configure real-time alert trigger parameters, persistence intervals, and dashboard telemetry units
        </p>
      </div>

      <form onSubmit={handleSaveSettings} className="space-y-6">
        
        {/* 1. Alarm & Warning Thresholds */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-soft space-y-4">
          <div className="flex items-center space-x-2">
            <Sliders className="h-5 w-5 text-blue-600" />
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">
              Sensor Alarm Rules & Trigger Levels
            </h4>
          </div>

          <div className="space-y-3 divide-y divide-slate-100 text-xs">
            {thresholdList.map(t => (
              <div key={t.key} className="pt-3 first:pt-0 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <span className="font-bold text-slate-800 uppercase tracking-wide text-[11px]">
                    {t.key.replace(/_/g, ' ')}
                  </span>
                  <p className="text-[11px] text-slate-400">
                    {t.key === 'gas_index' && 'MQ-2 / MQ-5 voltage divider reading (mV)'}
                    {t.key === 'heart_rate_high' && 'Tachycardia alert boundary (BPM)'}
                    {t.key === 'heart_rate_low' && 'Bradycardia alert boundary (BPM)'}
                    {t.key === 'spo2' && 'Blood oxygen saturation critical low limit (%)'}
                    {t.key === 'temperature' && 'Shaft ambient temperature maximum (°C)'}
                    {t.key === 'humidity' && 'Shaft relative humidity maximum (% RH)'}
                    {t.key === 'battery' && 'Low helmet battery warning (%)'}
                    {t.key === 'offline_timeout' && 'No packet receipt offline threshold (sec)'}
                  </p>
                </div>

                <div className="flex items-center space-x-3">
                  <div className="flex items-center space-x-1.5">
                    <span className="text-slate-500 font-medium">Warn:</span>
                    <input
                      type="number"
                      value={t.warning ?? ''}
                      onChange={(e) => handleThresholdChange(t.key, 'warning', Number(e.target.value))}
                      className="w-20 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-right font-mono font-bold text-slate-800 focus:bg-white"
                    />
                  </div>

                  <div className="flex items-center space-x-1.5">
                    <span className="text-slate-500 font-medium">Crit:</span>
                    <input
                      type="number"
                      value={t.critical ?? ''}
                      onChange={(e) => handleThresholdChange(t.key, 'critical', Number(e.target.value))}
                      className="w-20 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-right font-mono font-bold text-rose-600 focus:bg-white"
                    />
                  </div>

                  <label className="flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={!!t.enabled}
                      onChange={(e) => handleThresholdChange(t.key, 'enabled', e.target.checked)}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                  </label>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 2. Write Budget & Telemetry Pipeline Rules */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-soft space-y-4">
          <div className="flex items-center space-x-2">
            <Database className="h-5 w-5 text-indigo-600" />
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">
              Database Write Budget & Storage Optimization
            </h4>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                History Persistence Interval (Seconds)
              </label>
              <input
                type="number"
                min="2"
                max="300"
                value={historyInterval}
                onChange={(e) => setHistoryInterval(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 font-mono font-bold text-slate-800"
              />
              <p className="text-[11px] text-slate-400 mt-1">
                Only records history periodically or on triggered alert to preserve Firestore free tier quota.
              </p>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Worker Offline Timeout (Seconds)
              </label>
              <input
                type="number"
                min="5"
                max="600"
                value={offlineTimeout}
                onChange={(e) => setOfflineTimeout(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 font-mono font-bold text-slate-800"
              />
              <p className="text-[11px] text-slate-400 mt-1">
                Workers without telemetry packets for this duration transition to grey OFFLINE state.
              </p>
            </div>
          </div>
        </div>

        {/* 3. Audio & Unit Preferences */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-soft space-y-4">
          <div className="flex items-center space-x-2">
            <Volume2 className="h-5 w-5 text-emerald-600" />
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">
              User Interface & Audio Preferences
            </h4>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            
            {/* Audio Toggle */}
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
              <div>
                <span className="font-bold text-slate-800">Emergency Audio</span>
                <p className="text-[11px] text-slate-400">Beep on critical alerts</p>
              </div>
              <input
                type="checkbox"
                checked={soundEnabled}
                onChange={(e) => setSoundEnabled(e.target.checked)}
                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-4 w-4"
              />
            </div>

            {/* Units */}
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
              <div>
                <span className="font-bold text-slate-800">Temperature Unit</span>
                <p className="text-[11px] text-slate-400">{unitCelsius ? 'Celsius (°C)' : 'Fahrenheit (°F)'}</p>
              </div>
              <button
                type="button"
                onClick={() => setUnitCelsius(!unitCelsius)}
                className="px-2.5 py-1 bg-white border border-slate-200 rounded-lg font-bold text-xs shadow-sm"
              >
                {unitCelsius ? '°C' : '°F'}
              </button>
            </div>

            {/* Mode */}
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
              <div>
                <span className="font-bold text-slate-800">Telemetry Source</span>
                <p className="text-[11px] text-slate-400">{demoMode ? 'Live / Simulator' : 'Hardware Only'}</p>
              </div>
              <span className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded font-bold text-[10px]">
                Active
              </span>
            </div>

          </div>
        </div>

        {/* Save button */}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs shadow-glow-primary transition-all flex items-center space-x-1.5"
          >
            <Save className="h-4 w-4" />
            <span>{saving ? 'Saving...' : 'Save System Settings'}</span>
          </button>
        </div>

      </form>
    </div>
  );
}
