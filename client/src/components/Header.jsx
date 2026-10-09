import React, { useState, useEffect } from 'react';
import { 
  Search, Shield, AlertTriangle, Users, HardHat, 
  Settings, Activity, Radio, Bell, LogOut, Command, 
  Wifi, WifiOff, Volume2, VolumeX, Moon, Sun, ArrowRight, X, Waves
} from 'lucide-react';
import { useApp } from '../context/AppContext';

export default function Header({ currentTab, setCurrentTab, onOpenCommandPalette }) {
  const { 
    isConnected, 
    isServerWaking, 
    activeAlerts, 
    soundEnabled, 
    setSoundEnabled, 
    user,
    workersLatest,
    setSelectedWorkerId
  } = useApp();

  const criticalCount = activeAlerts.filter(a => a.severity === 'CRITICAL').length;
  const warningCount = activeAlerts.filter(a => a.severity === 'WARNING').length;

  return (
    <header className="sticky top-0 z-40 w-full glass-header border-b border-slate-200/80 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          
          {/* Logo & Brand */}
          <div className="flex items-center space-x-3 cursor-pointer" onClick={() => setCurrentTab('overview')}>
            <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center shadow-glow-primary text-white">
              <HardHat className="h-6 w-6 stroke-[2.2]" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-extrabold text-xl tracking-tight bg-gradient-to-r from-slate-900 via-blue-900 to-indigo-900 bg-clip-text text-transparent">
                  MineGuard
                </span>
                <span className="px-2 py-0.5 text-[10px] font-semibold tracking-wider uppercase bg-blue-100 text-blue-800 rounded-full border border-blue-200">
                  PROTOTYPE
                </span>
              </div>
              <p className="text-[11px] text-slate-500 font-medium hidden sm:block">
                Smart Helmet IoT Telemetry
              </p>
            </div>
          </div>

          {/* Navigation Tabs */}
          <nav className="hidden md:flex items-center space-x-1 bg-slate-100/80 p-1 rounded-xl border border-slate-200/60">
            <button
              onClick={() => setCurrentTab('overview')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 flex items-center space-x-1.5 ${
                currentTab === 'overview'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
              }`}
            >
              <Activity className="h-4 w-4" />
              <span>Overview</span>
            </button>

            <button
              onClick={() => setCurrentTab('fixed-zone')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 flex items-center space-x-1.5 ${
                currentTab === 'fixed-zone'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
              }`}
            >
              <Waves className="h-4 w-4" />
              <span>Fixed Zone Monitoring</span>
            </button>

            <button
              onClick={() => setCurrentTab('workers')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 flex items-center space-x-1.5 ${
                currentTab === 'workers' || currentTab === 'worker-detail'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
              }`}
            >
              <Users className="h-4 w-4" />
              <span>Miners & Helmets</span>
            </button>

            <button
              onClick={() => setCurrentTab('alerts')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 flex items-center space-x-1.5 relative ${
                currentTab === 'alerts'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
              }`}
            >
              <AlertTriangle className="h-4 w-4" />
              <span>Alerts</span>
              {activeAlerts.length > 0 && (
                <span className={`ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                  criticalCount > 0 ? 'bg-rose-500 text-white animate-pulse' : 'bg-amber-500 text-white'
                }`}>
                  {activeAlerts.length}
                </span>
              )}
            </button>

            <button
              onClick={() => setCurrentTab('analytics')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 flex items-center space-x-1.5 ${
                currentTab === 'analytics'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
              }`}
            >
              <Radio className="h-4 w-4" />
              <span>Analytics & Trends</span>
            </button>

            <button
              onClick={() => setCurrentTab('settings')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 flex items-center space-x-1.5 ${
                currentTab === 'settings'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
              }`}
            >
              <Settings className="h-4 w-4" />
              <span>Settings</span>
            </button>
          </nav>

          {/* Quick Actions & Live Indicator */}
          <div className="flex items-center space-x-2 sm:space-x-3">
            
            {/* Command Palette Trigger */}
            <button
              onClick={onOpenCommandPalette}
              className="hidden lg:flex items-center space-x-2 text-xs text-slate-500 bg-slate-100 hover:bg-slate-200/80 px-2.5 py-1.5 rounded-lg border border-slate-200 transition-colors"
              title="Quick Search & Navigation (Ctrl+K)"
            >
              <Search className="h-3.5 w-3.5 text-slate-400" />
              <span>Search...</span>
              <kbd className="px-1.5 py-0.5 text-[10px] bg-white border border-slate-300 rounded text-slate-500 font-mono">⌘K</kbd>
            </button>

            {/* Audio Toggle */}
            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              className={`p-2 rounded-xl border transition-all ${
                soundEnabled 
                  ? 'bg-blue-50 border-blue-200 text-blue-600 hover:bg-blue-100' 
                  : 'bg-slate-100 border-slate-200 text-slate-400 hover:bg-slate-200'
              }`}
              title={soundEnabled ? 'Emergency Siren Sound: Enabled' : 'Emergency Siren Sound: Muted'}
            >
              {soundEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
            </button>

            {/* Live Socket Status Dot */}
            <div className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${
              isConnected 
                ? 'bg-emerald-50 border-emerald-200 text-emerald-700' 
                : isServerWaking
                ? 'bg-amber-50 border-amber-200 text-amber-700 animate-pulse'
                : 'bg-rose-50 border-rose-200 text-rose-700'
            }`}>
              <span className={`h-2 w-2 rounded-full ${
                isConnected 
                  ? 'bg-emerald-500 shadow-glow-safe animate-pulse' 
                  : isServerWaking
                  ? 'bg-amber-500'
                  : 'bg-rose-500'
              }`} />
              <span className="hidden sm:inline">
                {isConnected ? 'Live Telemetry' : isServerWaking ? 'Waking Server...' : 'Offline'}
              </span>
            </div>

            {/* Safety Officer Avatar */}
            <div className="flex items-center space-x-2 pl-2 border-l border-slate-200">
              <div className="h-8 w-8 rounded-full bg-slate-800 text-white font-bold text-xs flex items-center justify-center ring-2 ring-blue-500/20">
                SO
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* Mobile navigation bar */}
      <div className="md:hidden flex items-center justify-around border-t border-slate-200 bg-white/95 px-2 py-1.5 text-xs">
        <button onClick={() => setCurrentTab('overview')} className={`p-1.5 flex flex-col items-center ${currentTab === 'overview' ? 'text-blue-600 font-bold' : 'text-slate-500'}`}>
          <Activity className="h-4 w-4" />
          <span>Overview</span>
        </button>
        <button onClick={() => setCurrentTab('workers')} className={`p-1.5 flex flex-col items-center ${currentTab === 'workers' ? 'text-blue-600 font-bold' : 'text-slate-500'}`}>
          <Users className="h-4 w-4" />
          <span>Miners</span>
        </button>
        <button onClick={() => setCurrentTab('alerts')} className={`p-1.5 flex flex-col items-center relative ${currentTab === 'alerts' ? 'text-blue-600 font-bold' : 'text-slate-500'}`}>
          <AlertTriangle className="h-4 w-4" />
          <span>Alerts</span>
          {activeAlerts.length > 0 && (
            <span className="absolute top-1 right-2 h-2 w-2 rounded-full bg-rose-500" />
          )}
        </button>
        <button onClick={() => setCurrentTab('analytics')} className={`p-1.5 flex flex-col items-center ${currentTab === 'analytics' ? 'text-blue-600 font-bold' : 'text-slate-500'}`}>
          <Radio className="h-4 w-4" />
          <span>Analytics</span>
        </button>
        <button onClick={() => setCurrentTab('settings')} className={`p-1.5 flex flex-col items-center ${currentTab === 'settings' ? 'text-blue-600 font-bold' : 'text-slate-500'}`}>
          <Settings className="h-4 w-4" />
          <span>Settings</span>
        </button>
      </div>
    </header>
  );
}
