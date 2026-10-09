import React, { useState, useEffect } from 'react';
import { 
  Sliders, Shield, Volume2, Database, Save, 
  RefreshCw, Check, AlertTriangle, Key, Cpu, Radio, Clock
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { api } from '../services/api';

export default function SettingsView() {
  const { 
    soundEnabled, 
    setSoundEnabled, 
    unitCelsius, 
    setUnitCelsius,
    addToast,
    refreshData
  } = useApp();

  const [thresholdList, setThresholdList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Ingestion write-budget settings
  const [historyInterval, setHistoryInterval] = useState(10);
  const [offlineTimeout, setOfflineTimeout] = useState(45);

  const fetchThresholds = async () => {
    setLoading(true);
    try {
      const data = await api.getThresholds();
      setThresholdList(data || []);
    } catch (err) {
      console.error('Failed to load thresholds:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchThresholds();
  }, []);

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
      for (const t of thresholdList) {
        await api.updateThreshold(t.key, {
          warning: Number(t.warning),
          critical: Number(t.critical),
          enabled: Boolean(t.enabled)
        });
      }

      addToast({
        type: 'success',
        title: 'Settings Saved',
        message: 'Safety thresholds and gateway configuration updated successfully.'
      });
      refreshData();
    } catch (err) {
      console.error('Failed to update thresholds:', err);
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
    <div className="space-y-5 max-w-4xl">
      
      {/* 1. Velzon Breadcrumb Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-[#E9EBEC] gap-2">
        <div className="flex items-center gap-2">
          <h1 className="text-base font-semibold text-[#495057]">
            Safety thresholds &amp; gateway parameters
          </h1>
          <span className="badge-soft-info text-[11px]">
            Gateway config
          </span>
        </div>

        <div className="flex items-center space-x-1.5 text-xs text-[#878A99]">
          <span>MineGuard</span>
          <span>/</span>
          <span>Settings</span>
          <span>/</span>
          <span className="text-[#176B87] font-medium">Configuration</span>
        </div>
      </div>

      <form onSubmit={handleSaveSettings} className="space-y-5">
        
        {/* 1. Alarm & Warning Thresholds (Velzon Card) */}
        <div className="velzon-card">
          <div className="velzon-card-header">
            <div className="flex items-center space-x-2">
              <Sliders className="h-4 w-4 text-[#176B87]" />
              <h2 className="velzon-card-title">
                Sensor alarm trigger boundaries
              </h2>
            </div>
            <span className="text-xs text-[#878A99]">Hardware telemetry limits</span>
          </div>

          <div className="velzon-card-body space-y-3 divide-y divide-[#F3F6F9] text-xs">
            {thresholdList.map(t => (
              <div key={t.key} className="pt-3 first:pt-0 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <span className="font-medium text-[#212529] capitalize text-xs">
                    {t.key.replace(/_/g, ' ')}
                  </span>
                  <p className="text-[11px] text-[#878A99] font-mono">
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
                    <span className="text-[#878A99] font-mono text-[11px]">WARN:</span>
                    <input
                      type="number"
                      value={t.warning ?? ''}
                      onChange={(e) => handleThresholdChange(t.key, 'warning', Number(e.target.value))}
                      className="w-20 px-2 py-1 rounded border border-[#E9EBEC] bg-[#F8FAFC] text-right font-mono font-bold text-[#212529] focus:bg-white focus:outline-none focus:border-[#176B87]"
                    />
                  </div>

                  <div className="flex items-center space-x-1.5">
                    <span className="text-[#F06548] font-mono text-[11px]">CRIT:</span>
                    <input
                      type="number"
                      value={t.critical ?? ''}
                      onChange={(e) => handleThresholdChange(t.key, 'critical', Number(e.target.value))}
                      className="w-20 px-2 py-1 rounded border border-[#FACCC3] bg-[#FDEEEB] text-right font-mono font-bold text-[#F06548] focus:bg-white focus:outline-none focus:border-[#F06548]"
                    />
                  </div>

                  <label className="flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={!!t.enabled}
                      onChange={(e) => handleThresholdChange(t.key, 'enabled', e.target.checked)}
                      className="rounded border-[#E9EBEC] text-[#176B87] focus:ring-[#176B87] h-4 w-4"
                    />
                  </label>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 2. Gateway Storage & Sampling Budget (Velzon Card) */}
        <div className="velzon-card">
          <div className="velzon-card-header">
            <div className="flex items-center space-x-2">
              <Database className="h-4 w-4 text-[#176B87]" />
              <h2 className="velzon-card-title">
                Telemetry sampling &amp; ingestion write-budget
              </h2>
            </div>
            <span className="badge-soft-info text-[11px]">Storage policy</span>
          </div>

          <div className="velzon-card-body grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="p-3.5 bg-[#F8FAFC] rounded-md border border-[#E9EBEC] space-y-1.5">
              <label className="font-semibold text-[#495057] block">History Write Interval (Seconds)</label>
              <input
                type="number"
                value={historyInterval}
                onChange={(e) => setHistoryInterval(Number(e.target.value))}
                min="5"
                max="300"
                className="w-full px-3 py-1.5 rounded border border-[#E9EBEC] bg-white font-mono text-[#212529] focus:outline-none focus:border-[#176B87]"
              />
              <p className="text-[11px] text-[#878A99]">
                Nominal telemetry is persisted to disk every N seconds (Default: 10s write budget). Critical alerts persist immediately.
              </p>
            </div>

            <div className="p-3.5 bg-[#F8FAFC] rounded-md border border-[#E9EBEC] space-y-1.5">
              <label className="font-semibold text-[#495057] block">Offline Timeout Guard (Seconds)</label>
              <input
                type="number"
                value={offlineTimeout}
                onChange={(e) => setOfflineTimeout(Number(e.target.value))}
                min="15"
                max="600"
                className="w-full px-3 py-1.5 rounded border border-[#E9EBEC] bg-white font-mono text-[#212529] focus:outline-none focus:border-[#176B87]"
              />
              <p className="text-[11px] text-[#878A99]">
                Duration before physical hardware helmet without packet is marked offline (Default: 45s).
              </p>
            </div>
          </div>
        </div>

        {/* 3. Operator Interface Preferences (Velzon Card) */}
        <div className="velzon-card">
          <div className="velzon-card-header">
            <div className="flex items-center space-x-2">
              <Volume2 className="h-4 w-4 text-[#176B87]" />
              <h4 className="velzon-card-title">
                Supervisor Console Sound &amp; Unit Options
              </h4>
            </div>
          </div>

          <div className="velzon-card-body space-y-3.5 text-xs">
            <div className="flex items-center justify-between">
              <div>
                <span className="font-semibold text-[#495057]">Audible Alert Siren</span>
                <p className="text-[11px] text-[#878A99]">Play synthetic sound alert when Critical SOS, Fall, or Gas breach arrives</p>
              </div>
              <input
                type="checkbox"
                checked={soundEnabled}
                onChange={(e) => setSoundEnabled(e.target.checked)}
                className="rounded border-[#E9EBEC] text-[#176B87] focus:ring-[#176B87] h-4 w-4"
              />
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-[#F3F6F9]">
              <div>
                <span className="font-semibold text-[#495057]">Temperature Measurement Scale</span>
                <p className="text-[11px] text-[#878A99]">Display shaft telemetry in Celsius (°C) vs Fahrenheit (°F)</p>
              </div>
              <button
                type="button"
                onClick={() => setUnitCelsius(!unitCelsius)}
                className="px-3 py-1 bg-white border border-[#E9EBEC] hover:bg-[#F3F6F9] font-mono text-xs font-bold text-[#495057] rounded shadow-2xs"
              >
                {unitCelsius ? '°C (Celsius)' : '°F (Fahrenheit)'}
              </button>
            </div>
          </div>
        </div>

        {/* Save Bar */}
        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={saving}
            className="px-5 py-2.5 bg-[#176B87] hover:bg-[#12566D] text-white font-semibold text-xs rounded shadow-sm transition-colors flex items-center space-x-2"
          >
            <Save className="h-4 w-4" />
            <span>{saving ? 'Updating Boundaries...' : 'Save Configuration'}</span>
          </button>
        </div>

      </form>

    </div>
  );
}
