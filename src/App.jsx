import React, { useState } from 'react';
import { useApp } from './context/AppContext';
import Header from './components/Header';
import Overview from './components/Overview';
import WorkerDetail from './components/WorkerDetail';
import AlertsView from './components/AlertsView';
import AnalyticsView from './components/AnalyticsView';
import WorkersDevicesView from './components/WorkersDevicesView';
import SettingsView from './components/SettingsView';
import CommandPalette from './components/CommandPalette';
import FullscreenSosOverlay from './components/FullscreenSosOverlay';
import ToastContainer from './components/ToastContainer';
import { HardHat, AlertCircle, RefreshCw } from 'lucide-react';

export default function App() {
  const [currentTab, setCurrentTab] = useState('overview'); // 'overview' | 'workers' | 'worker-detail' | 'alerts' | 'analytics' | 'settings'
  const [selectedWorkerId, setSelectedWorkerId] = useState('W001');
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const { isServerWaking, refreshData } = useApp();

  const handleSelectWorker = (id) => {
    setSelectedWorkerId(id);
    setCurrentTab('worker-detail');
  };

  return (
    <div className="min-h-screen bg-[#F5F7FB] flex flex-col selection:bg-blue-100 selection:text-blue-900">
      
      {/* Top Glass Header */}
      <Header
        currentTab={currentTab}
        setCurrentTab={setCurrentTab}
        onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
      />

      {/* Render Server Cold Start / Waking Banner if applicable */}
      {isServerWaking && (
        <div className="bg-amber-500 text-white px-4 py-2 text-center text-xs font-bold flex items-center justify-center space-x-2 animate-pulse">
          <RefreshCw className="h-4 w-4 animate-spin" />
          <span>Waking up cloud server container... Retrying live telemetry connection.</span>
        </div>
      )}

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {currentTab === 'overview' && (
          <Overview
            onSelectWorker={handleSelectWorker}
            onNavigateAlerts={() => setCurrentTab('alerts')}
          />
        )}

        {currentTab === 'worker-detail' && (
          <WorkerDetail
            workerId={selectedWorkerId}
            onBack={() => setCurrentTab('overview')}
          />
        )}

        {currentTab === 'alerts' && <AlertsView />}

        {currentTab === 'analytics' && <AnalyticsView />}

        {currentTab === 'workers' && (
          <WorkersDevicesView onSelectWorker={handleSelectWorker} />
        )}

        {currentTab === 'settings' && <SettingsView />}
      </main>

      {/* Footer */}
      <footer className="mt-auto border-t border-slate-200/80 bg-white/60 py-4 text-center text-[11px] text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center space-x-2">
            <span className="font-bold text-slate-700">MineGuard IoT Framework</span>
            <span>•</span>
            <span>Prototype safety system for deep coal mining telemetry</span>
          </div>
          <div className="text-slate-400">
            ESP32 Wi-Fi &amp; LoRa SX1278 Gateway Ready
          </div>
        </div>
      </footer>

      {/* Overlays & Dialogs */}
      <FullscreenSosOverlay />
      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        onNavigateTab={(tab) => setCurrentTab(tab)}
        onSelectWorker={handleSelectWorker}
      />
      <ToastContainer />

    </div>
  );
}
