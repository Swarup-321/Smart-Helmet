import React, { useState, useEffect } from 'react';
import { 
  Search, HardHat, Activity, AlertTriangle, Settings, 
  Radio, X, ArrowRight, ShieldAlert, Heart, Waves
} from 'lucide-react';
import { useApp } from '../context/AppContext';

export default function CommandPalette({ isOpen, onClose, onNavigateTab, onSelectWorker }) {
  const { workersLatest, activeAlerts } = useApp();
  const [query, setQuery] = useState('');

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        if (isOpen) onClose();
        else window.dispatchEvent(new CustomEvent('mineguard:open-command-palette'));
      }
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const filteredWorkers = workersLatest.filter(w => 
    w.worker?.name?.toLowerCase().includes(query.toLowerCase()) ||
    w.worker?.id?.toLowerCase().includes(query.toLowerCase()) ||
    w.worker?.zone?.toLowerCase().includes(query.toLowerCase())
  );

  const filteredAlerts = activeAlerts.filter(a =>
    a.message?.toLowerCase().includes(query.toLowerCase()) ||
    a.type?.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-start justify-center pt-20 p-4">
      <div className="bg-white rounded-2xl max-w-xl w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        
        {/* Search Input */}
        <div className="flex items-center px-4 py-3.5 border-b border-slate-100">
          <Search className="h-5 w-5 text-slate-400 mr-3" />
          <input
            type="text"
            autoFocus
            placeholder="Type a command, miner name, zone, or incident..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full text-sm font-medium text-slate-800 placeholder:text-slate-400 focus:outline-none"
          />
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-slate-600">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Results List */}
        <div className="max-h-80 overflow-y-auto p-2 divide-y divide-slate-50 text-xs">
          
          {/* Quick Navigation Section */}
          <div className="p-2">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
              Quick Views
            </div>
            <div className="space-y-1">
              <button
                onClick={() => { onNavigateTab('overview'); onClose(); }}
                className="w-full p-2 rounded-xl flex items-center justify-between hover:bg-slate-50 text-slate-700 font-semibold"
              >
                <div className="flex items-center space-x-2">
                  <Activity className="h-4 w-4 text-blue-500" />
                  <span>Main Safety Overview</span>
                </div>
                <ArrowRight className="h-3.5 w-3.5 text-slate-400" />
              </button>

              <button
                onClick={() => { onNavigateTab('fixed-zone'); onClose(); }}
                className="w-full p-2 rounded-xl flex items-center justify-between hover:bg-slate-50 text-slate-700 font-semibold"
              >
                <div className="flex items-center space-x-2">
                  <Waves className="h-4 w-4 text-blue-500" />
                  <span>Fixed Zone Vibration Monitoring</span>
                </div>
                <ArrowRight className="h-3.5 w-3.5 text-slate-400" />
              </button>

              <button
                onClick={() => { onNavigateTab('alerts'); onClose(); }}
                className="w-full p-2 rounded-xl flex items-center justify-between hover:bg-slate-50 text-slate-700 font-semibold"
              >
                <div className="flex items-center space-x-2">
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                  <span>Alert Audit Log</span>
                </div>
                <ArrowRight className="h-3.5 w-3.5 text-slate-400" />
              </button>

              <button
                onClick={() => { onNavigateTab('analytics'); onClose(); }}
                className="w-full p-2 rounded-xl flex items-center justify-between hover:bg-slate-50 text-slate-700 font-semibold"
              >
                <div className="flex items-center space-x-2">
                  <Radio className="h-4 w-4 text-indigo-500" />
                  <span>Analytics & Trends</span>
                </div>
                <ArrowRight className="h-3.5 w-3.5 text-slate-400" />
              </button>
            </div>
          </div>

          {/* Miners Section */}
          {filteredWorkers.length > 0 && (
            <div className="p-2">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                Miners & Telemetry
              </div>
              <div className="space-y-1">
                {filteredWorkers.map(w => (
                  <button
                    key={w.worker.id}
                    onClick={() => { onSelectWorker(w.worker.id); onClose(); }}
                    className="w-full p-2 rounded-xl flex items-center justify-between hover:bg-slate-50 text-left"
                  >
                    <div className="flex items-center space-x-2">
                      <HardHat className="h-4 w-4 text-slate-600" />
                      <div>
                        <span className="font-bold text-slate-800">{w.worker.name}</span>
                        <span className="text-[11px] text-slate-400 ml-2">{w.worker.zone}</span>
                      </div>
                    </div>
                    <span className="font-mono text-[10px] bg-slate-100 px-2 py-0.5 rounded text-slate-600">
                      {w.worker.id}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Active Alerts */}
          {filteredAlerts.length > 0 && (
            <div className="p-2">
              <div className="text-[10px] font-bold uppercase tracking-wider text-rose-500 mb-1">
                Active Critical Incidents
              </div>
              <div className="space-y-1">
                {filteredAlerts.slice(0, 3).map(a => (
                  <button
                    key={a.id}
                    onClick={() => { onNavigateTab('alerts'); onClose(); }}
                    className="w-full p-2 rounded-xl flex items-center justify-between hover:bg-rose-50/50 text-left"
                  >
                    <div className="flex items-center space-x-2">
                      <ShieldAlert className="h-4 w-4 text-rose-600 animate-pulse" />
                      <span className="font-medium text-slate-800 truncate max-w-sm">{a.message}</span>
                    </div>
                    <span className="text-[10px] font-bold text-rose-600">{a.type}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="px-4 py-2 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
          <span>Navigate with arrows / click to open</span>
          <span>ESC to dismiss</span>
        </div>

      </div>
    </div>
  );
}
