import React, { useState, useEffect } from 'react';
import { 
  Search, HardHat, Activity, AlertTriangle, Settings, 
  Radio, X, ArrowRight, ShieldAlert, Heart
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
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-start justify-center pt-20 p-4">
      <div className="bg-white rounded-lg max-w-xl w-full shadow-dropdown border border-[#E9EBEC] overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        
        {/* Search Input (Velzon Header) */}
        <div className="flex items-center px-4 py-3 border-b border-[#E9EBEC] bg-[#F8FAFC]">
          <Search className="h-4 w-4 text-[#878A99] mr-3" />
          <input
            type="text"
            autoFocus
            placeholder="Search helmets, zones, commands, or telemetry alarms..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full text-xs font-sans font-medium text-[#212529] placeholder:text-[#878A99] focus:outline-none bg-transparent"
          />
          <button onClick={onClose} className="p-1 rounded text-[#878A99] hover:text-[#212529]">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Results List */}
        <div className="max-h-80 overflow-y-auto p-2 divide-y divide-[#F3F6F9] text-xs">
          
          {/* Quick Navigation Section */}
          <div className="p-1.5">
            <div className="text-[10px] font-bold uppercase tracking-wider text-[#878A99] mb-1 px-2">
              NAVIGATION
            </div>
            <div className="space-y-0.5">
              <button
                onClick={() => { onNavigateTab('overview'); onClose(); }}
                className="w-full flex items-center justify-between p-2 rounded hover:bg-[#F3F6F9] text-left text-[#495057] transition-colors"
              >
                <div className="flex items-center space-x-2">
                  <Activity className="h-3.5 w-3.5 text-[#176B87]" />
                  <span>Operations Overview</span>
                </div>
                <ArrowRight className="h-3 w-3 text-[#878A99]" />
              </button>
              <button
                onClick={() => { onNavigateTab('workers'); onClose(); }}
                className="w-full flex items-center justify-between p-2 rounded hover:bg-[#F3F6F9] text-left text-[#495057] transition-colors"
              >
                <div className="flex items-center space-x-2">
                  <HardHat className="h-3.5 w-3.5 text-[#176B87]" />
                  <span>Miners &amp; Smart Helmets Provisioning</span>
                </div>
                <ArrowRight className="h-3 w-3 text-[#878A99]" />
              </button>
              <button
                onClick={() => { onNavigateTab('alerts'); onClose(); }}
                className="w-full flex items-center justify-between p-2 rounded hover:bg-[#F3F6F9] text-left text-[#495057] transition-colors"
              >
                <div className="flex items-center space-x-2">
                  <ShieldAlert className="h-3.5 w-3.5 text-[#F06548]" />
                  <span>Incident &amp; Alarm Log</span>
                </div>
                <ArrowRight className="h-3 w-3 text-[#878A99]" />
              </button>
              <button
                onClick={() => { onNavigateTab('settings'); onClose(); }}
                className="w-full flex items-center justify-between p-2 rounded hover:bg-[#F3F6F9] text-left text-[#495057] transition-colors"
              >
                <div className="flex items-center space-x-2">
                  <Settings className="h-3.5 w-3.5 text-[#176B87]" />
                  <span>Gateway Settings &amp; Safety Thresholds</span>
                </div>
                <ArrowRight className="h-3 w-3 text-[#878A99]" />
              </button>
            </div>
          </div>

          {/* Miners List Results */}
          {filteredWorkers.length > 0 && (
            <div className="p-1.5">
              <div className="text-[10px] font-bold uppercase tracking-wider text-[#878A99] mb-1 px-2">
                MINERS &amp; HELMETS
              </div>
              <div className="space-y-0.5">
                {filteredWorkers.map(w => (
                  <button
                    key={w.worker.id}
                    onClick={() => { onSelectWorker(w.worker.id); onClose(); }}
                    className="w-full flex items-center justify-between p-2 rounded hover:bg-[#F3F6F9] text-left text-[#495057] transition-colors"
                  >
                    <div className="flex items-center space-x-2 min-w-0">
                      <HardHat className="h-3.5 w-3.5 text-[#176B87] flex-shrink-0" />
                      <span className="font-semibold truncate">{w.worker.name}</span>
                      <span className="text-[10px] text-[#878A99] font-mono">{w.worker.id} • {w.worker.zone}</span>
                    </div>
                    <span className={w.status === 'online' ? 'badge-soft-success text-[10px]' : 'badge-soft-dark text-[10px]'}>
                      {w.status}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Active Incidents Results */}
          {filteredAlerts.length > 0 && (
            <div className="p-1.5">
              <div className="text-[10px] font-bold uppercase tracking-wider text-[#878A99] mb-1 px-2">
                ACTIVE SAFETY ALERTS
              </div>
              <div className="space-y-0.5">
                {filteredAlerts.map(a => (
                  <div
                    key={a.id}
                    onClick={() => { onNavigateTab('alerts'); onClose(); }}
                    className="p-2 rounded hover:bg-[#F3F6F9] cursor-pointer flex items-center justify-between text-[#495057]"
                  >
                    <div className="flex items-center space-x-2 min-w-0">
                      <AlertTriangle className="h-3.5 w-3.5 text-[#F06548] flex-shrink-0" />
                      <span className="truncate">{a.message}</span>
                    </div>
                    <span className={a.severity === 'CRITICAL' ? 'badge-soft-danger text-[9px]' : 'badge-soft-warning text-[9px]'}>
                      {a.severity}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="px-4 py-2.5 bg-[#F8FAFC] border-t border-[#E9EBEC] text-[11px] text-[#878A99] flex items-center justify-between">
          <span>Tip: Use <kbd className="px-1 py-0.5 bg-white border border-[#E9EBEC] rounded font-mono">↑</kbd> <kbd className="px-1 py-0.5 bg-white border border-[#E9EBEC] rounded font-mono">↓</kbd> to navigate</span>
          <span>Press <kbd className="px-1 py-0.5 bg-white border border-[#E9EBEC] rounded font-mono">ESC</kbd> to close</span>
        </div>

      </div>
    </div>
  );
}
