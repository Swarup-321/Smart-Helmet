import React from 'react';
import { ShieldAlert, Check, X, AlertTriangle, HardHat, Phone, MapPin } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { api } from '../services/api';

export default function FullscreenSosOverlay() {
  const { criticalSosAlert, setCriticalSosAlert, refreshData, workersLatest } = useApp();

  if (!criticalSosAlert) return null;

  const workerInfo = workersLatest.find(w => w.worker?.id === criticalSosAlert.worker_id);
  const worker = workerInfo?.worker || {};
  const reading = workerInfo?.reading || {};

  const handleAcknowledge = async () => {
    try {
      await api.acknowledgeAlert(criticalSosAlert.id, 'Safety Officer');
      setCriticalSosAlert(null);
      refreshData();
    } catch (err) {
      console.error('Failed to ack SOS:', err);
      setCriticalSosAlert(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-rose-950/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-glow-danger border-4 border-rose-500 space-y-6 text-slate-800 animate-bounce-short">
        
        {/* Header Banner */}
        <div className="text-center space-y-2">
          <div className="h-16 w-16 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto animate-pulse">
            <ShieldAlert className="h-10 w-10" />
          </div>
          <span className="px-3 py-1 bg-rose-600 text-white rounded-full text-xs font-black uppercase tracking-widest animate-pulse inline-block">
            {criticalSosAlert.type === 'SOS' ? 'EMERGENCY SOS TRIGGERED' : 'CRITICAL SAFETY INCIDENT'}
          </span>
          <h2 className="text-2xl font-black tracking-tight text-slate-900">
            {worker.name || criticalSosAlert.worker_id} Requires Immediate Help!
          </h2>
          <p className="text-xs text-slate-600">
            {criticalSosAlert.message}
          </p>
        </div>

        {/* Worker Vitals Matrix */}
        <div className="bg-rose-50/60 rounded-2xl p-4 border border-rose-200 grid grid-cols-3 gap-2 text-center text-xs">
          <div className="bg-white p-2.5 rounded-xl shadow-soft">
            <span className="text-[10px] uppercase font-bold text-slate-400">Heart Rate</span>
            <div className="text-base font-black text-rose-600 mt-0.5">
              {reading.heart_rate ? `${reading.heart_rate} BPM` : '78 BPM'}
            </div>
          </div>
          <div className="bg-white p-2.5 rounded-xl shadow-soft">
            <span className="text-[10px] uppercase font-bold text-slate-400">SpO2 Blood</span>
            <div className="text-base font-black text-blue-600 mt-0.5">
              {reading.spo2 ? `${reading.spo2}%` : '98%'}
            </div>
          </div>
          <div className="bg-white p-2.5 rounded-xl shadow-soft">
            <span className="text-[10px] uppercase font-bold text-slate-400">Shaft Temp</span>
            <div className="text-base font-black text-amber-600 mt-0.5">
              {reading.temperature ? `${reading.temperature}°C` : '28.4°C'}
            </div>
          </div>
        </div>

        {/* Miner Location & Contact */}
        <div className="space-y-2 text-xs text-slate-600">
          <div className="flex items-center space-x-2">
            <MapPin className="h-4 w-4 text-rose-500" />
            <span>Designated Mine Location: <strong className="text-slate-800">{worker.zone || 'Shaft 3'}</strong></span>
          </div>
          <div className="flex items-center space-x-2">
            <HardHat className="h-4 w-4 text-blue-500" />
            <span>Helmet Serial: <strong className="text-slate-800">{worker.helmet_id || 'H001'}</strong> (Worker ID: {criticalSosAlert.worker_id})</span>
          </div>
          <div className="flex items-center space-x-2">
            <Phone className="h-4 w-4 text-emerald-500" />
            <span>Emergency Dispatch Contact: <strong className="text-slate-800">{worker.emergency_contact || '+91 98765 43211'}</strong></span>
          </div>
        </div>

        {/* Acknowledge Button */}
        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          <button
            onClick={handleAcknowledge}
            className="w-full py-3.5 bg-rose-600 hover:bg-rose-700 text-white rounded-2xl font-black text-sm shadow-glow-danger transition-all flex items-center justify-center space-x-2"
          >
            <Check className="h-5 w-5 stroke-[2.5]" />
            <span>ACKNOWLEDGE & DISPATCH RESCUE TEAM</span>
          </button>
        </div>

      </div>
    </div>
  );
}
