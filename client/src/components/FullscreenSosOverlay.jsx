import React from 'react';
import { ShieldAlert, Check, X, AlertTriangle, HardHat, Phone, MapPin, Radio, Activity } from 'lucide-react';
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
      await api.acknowledgeAlert(criticalSosAlert.id, 'Safety Supervisor');
      setCriticalSosAlert(null);
      refreshData();
    } catch (err) {
      console.error('Failed to ack SOS:', err);
      setCriticalSosAlert(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#182B3A]/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-lg max-w-lg w-full p-6 shadow-dropdown border border-[#FACCC3] space-y-5 text-[#495057]">
        
        {/* Header Banner */}
        <div className="text-center space-y-2">
          <div className="h-12 w-12 bg-[#FDE8E4] text-[#F06548] rounded-full border border-[#FACCC3] flex items-center justify-center mx-auto">
            <ShieldAlert className="h-6 w-6 stroke-[2.2]" />
          </div>
          <div>
            <span className="badge-soft-danger px-3 py-1 font-semibold text-[11px] uppercase tracking-wide inline-block">
              {criticalSosAlert.type === 'SOS' ? 'EMERGENCY HARDWARE SOS TRIGGERED' : 'CRITICAL SAFETY INCIDENT'}
            </span>
          </div>
          <h2 className="text-xl font-bold tracking-tight text-[#182B3A] pt-1 font-sans">
            {worker.name || criticalSosAlert.worker_id} Requires Immediate Response
          </h2>
          <p className="text-xs text-[#878A99]">
            {criticalSosAlert.message}
          </p>
        </div>

        {/* Worker Vitals Matrix */}
        <div className="bg-[#F3F6F8] rounded-md p-3 border border-[#E9EBEC] grid grid-cols-3 gap-2.5 text-center text-xs">
          <div className="bg-white p-2.5 rounded border border-[#E9EBEC] shadow-sm">
            <span className="text-[10px] uppercase font-semibold text-[#878A99] tracking-wider">Pulse Rate</span>
            <div className="text-sm font-mono font-bold text-[#F06548] mt-0.5">
              {reading.heart_rate ? `${reading.heart_rate} BPM` : '78 BPM'}
            </div>
          </div>
          <div className="bg-white p-2.5 rounded border border-[#E9EBEC] shadow-sm">
            <span className="text-[10px] uppercase font-semibold text-[#878A99] tracking-wider">SpO2 Blood</span>
            <div className="text-sm font-mono font-bold text-[#176B87] mt-0.5">
              {reading.spo2 ? `${reading.spo2}%` : '98%'}
            </div>
          </div>
          <div className="bg-white p-2.5 rounded border border-[#E9EBEC] shadow-sm">
            <span className="text-[10px] uppercase font-semibold text-[#878A99] tracking-wider">Shaft Temp</span>
            <div className="text-sm font-mono font-bold text-[#FFBE0B] mt-0.5">
              {reading.temperature ? `${reading.temperature}°C` : '28.4°C'}
            </div>
          </div>
        </div>

        {/* Miner Location & Contact */}
        <div className="space-y-2 text-xs bg-[#F3F6F8] p-3 rounded-md border border-[#E9EBEC]">
          <div className="flex items-center justify-between">
            <span className="text-[#878A99]">Assigned Sector:</span>
            <span className="font-semibold text-[#495057]">{worker.zone || 'Zone A - Main Drift'}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[#878A99]">Hardware Helmet ID:</span>
            <span className="font-mono font-semibold text-[#495057]">{worker.helmet_id || 'H-ESP32-LIVE'} ({criticalSosAlert.worker_id})</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[#878A99]">Radio / Dispatch:</span>
            <span className="font-semibold text-[#F06548]">{worker.emergency_contact || '+91 98765 43211'}</span>
          </div>
        </div>

        {/* Acknowledge Button */}
        <div className="pt-1">
          <button
            onClick={handleAcknowledge}
            className="w-full py-2.5 bg-[#F06548] hover:bg-[#d85b41] text-white rounded font-medium text-xs tracking-wide shadow-sm transition-colors flex items-center justify-center space-x-2"
          >
            <Check className="h-4 w-4 stroke-[2.5]" />
            <span>ACKNOWLEDGE ALARM & DISPATCH RESCUE TEAM</span>
          </button>
        </div>

      </div>
    </div>
  );
}
