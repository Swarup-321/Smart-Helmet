import React, { useState } from 'react';
import { useApp } from './context/AppContext';
import Sidebar from './components/Sidebar';
import TopBar from './components/TopBar';
import Overview from './components/Overview';
import WorkerDetail from './components/WorkerDetail';
import AlertsView from './components/AlertsView';
import AnalyticsView from './components/AnalyticsView';
import WorkersDevicesView from './components/WorkersDevicesView';
import SettingsView from './components/SettingsView';
import CommandPalette from './components/CommandPalette';
import FullscreenSosOverlay from './components/FullscreenSosOverlay';
import ToastContainer from './components/ToastContainer';
import { RefreshCw } from 'lucide-react';

export default function App() {
  const [currentTab, setCurrentTab] = useState('overview'); // 'overview' | 'workers' | 'worker-detail' | 'alerts' | 'analytics' | 'settings'
  const [selectedWorkerId, setSelectedWorkerId] = useState('W001');
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const { isServerWaking } = useApp();

  const handleSelectWorker = (id) => {
    setSelectedWorkerId(id);
    setCurrentTab('worker-detail');
  };

  React.useEffect(() => {
    if (isSidebarCollapsed) {
      document.body.classList.add('mg-sidebar-collapsed');
    } else {
      document.body.classList.remove('mg-sidebar-collapsed');
    }
  }, [isSidebarCollapsed]);

  return (
    <div className="min-h-screen bg-[#F3F3F9] text-[#495057] font-sans">
      
      {/* 1. Persistent Left Navigation Sidebar */}
      <Sidebar
        currentTab={currentTab}
        setCurrentTab={setCurrentTab}
        isCollapsed={isSidebarCollapsed}
        setIsCollapsed={setIsSidebarCollapsed}
        mobileOpen={isMobileMenuOpen}
        setMobileOpen={setIsMobileMenuOpen}
      />

      {/* 2. Top Utility Bar */}
      <TopBar
        currentTab={currentTab}
        onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
        onToggleMobileMenu={() => {
          if (window.innerWidth < 1024) {
            setIsMobileMenuOpen(!isMobileMenuOpen);
          } else {
            setIsSidebarCollapsed(!isSidebarCollapsed);
          }
        }}
        onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
      />

      {/* 3. Main Workspace Shell */}
      <main className="mg-main">
        {/* Server Cold-Start Banner (if applicable) */}
        {isServerWaking && (
          <div className="bg-[#FFBE0B] text-[#182B3A] px-4 py-2 text-center text-xs font-semibold flex items-center justify-center space-x-2 border-b border-[#E9EBEC]">
            <RefreshCw className="h-3.5 w-3.5 animate-spin text-[#182B3A]" />
            <span>Telemetry Server Synchronizing... Reconnecting live WebSocket stream.</span>
          </div>
        )}

        <div className="mg-content">
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
        </div>

        {/* Template Design System Footer */}
        <footer className="mg-footer">
          <span>MineGuard · Sector 4</span>
          <span>Simulated values are labelled; model output is shown separately</span>
        </footer>
      </main>

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
