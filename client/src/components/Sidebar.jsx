import React from 'react';
import { 
  LayoutDashboard, HardHat, ShieldAlert, TrendingUp, 
  Settings, ChevronLeft, ChevronRight, Menu
} from 'lucide-react';
import MineGuardLogo from './MineGuardLogo';
import { useApp } from '../context/AppContext';

export default function Sidebar({ 
  currentTab, 
  setCurrentTab, 
  isCollapsed, 
  setIsCollapsed,
  mobileOpen,
  setMobileOpen
}) {
  const { isConnected, isServerWaking, activeAlerts, user } = useApp();

  const criticalAlerts = activeAlerts.filter(a => a.severity === 'CRITICAL' && !a.resolved_at).length;
  const unresolvedAlerts = activeAlerts.filter(a => !a.resolved_at).length;

  const handleNavClick = (tabId) => {
    setCurrentTab(tabId);
    if (setMobileOpen) setMobileOpen(false);
  };

  const navSections = [
    {
      group: 'Monitoring',
      items: [
        { id: 'overview', label: 'Overview', icon: LayoutDashboard },
        { id: 'workers', label: 'Fleet & helmets', icon: HardHat, subTab: 'worker-detail' },
      ]
    },
    {
      group: 'Safety',
      items: [
        { 
          id: 'alerts', 
          label: 'Incidents', 
          icon: ShieldAlert, 
          badge: unresolvedAlerts, 
          isCritical: criticalAlerts > 0 
        },
        { id: 'analytics', label: 'Analytics', icon: TrendingUp },
      ]
    },
    {
      group: 'System',
      items: [
        { id: 'settings', label: 'Settings', icon: Settings },
      ]
    }
  ];

  return (
    <>
      {/* Mobile Backdrop */}
      {mobileOpen && (
        <div 
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-xs lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Template-aligned Sidebar */}
      <aside
        className={`mg-sidebar select-none ${
          isCollapsed ? 'w-[70px]' : 'w-[250px]'
        } ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Brand Header with In-Sidebar Burger Toggle */}
        <div className={`mg-brand ${isCollapsed ? 'justify-center px-2' : 'justify-between px-4'}`}>
          {!isCollapsed ? (
            <>
              <div className="flex items-center min-w-0 pr-2">
                <MineGuardLogo collapsed={false} />
              </div>
              <button
                onClick={() => {
                  if (mobileOpen && setMobileOpen) setMobileOpen(false);
                  else setIsCollapsed(true);
                }}
                className="p-1.5 rounded text-[#abb9e8] hover:text-white hover:bg-white/10 transition-colors focus:outline-none flex-shrink-0 cursor-pointer"
                title="Collapse sidebar"
                aria-label="Collapse sidebar"
              >
                <Menu className="h-5 w-5" />
              </button>
            </>
          ) : (
            <button
              onClick={() => setIsCollapsed(false)}
              className="p-2 rounded text-[#abb9e8] hover:text-white hover:bg-white/10 transition-colors focus:outline-none flex items-center justify-center cursor-pointer"
              title="Expand sidebar"
              aria-label="Expand sidebar"
            >
              <Menu className="h-5 w-5" />
            </button>
          )}
        </div>

        {/* Navigation List */}
        <div className="flex-1 overflow-y-auto">
          <ul className="mg-nav">
            {navSections.map((section, idx) => (
              <React.Fragment key={section.group || idx}>
                {!isCollapsed && (
                  <li className="mg-nav-caption">
                    {section.group}
                  </li>
                )}

                {section.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = currentTab === item.id || (item.subTab && currentTab === item.subTab);

                  return (
                    <li key={item.id}>
                      <button
                        onClick={() => handleNavClick(item.id)}
                        title={isCollapsed ? item.label : undefined}
                        className={`mg-nav-link ${isActive ? 'is-active' : ''} ${isCollapsed ? 'justify-center px-0' : ''}`}
                      >
                        <Icon className="h-4.5 w-4.5 flex-shrink-0" strokeWidth={2} />
                        
                        {!isCollapsed && (
                          <span className="truncate flex-1">{item.label}</span>
                        )}

                        {!isCollapsed && item.badge > 0 && (
                          <span className={`mg-badge ${item.isCritical ? 'mg-badge-solid-danger animate-pulse' : 'mg-badge-warning'}`}>
                            {item.badge}
                          </span>
                        )}

                        {isCollapsed && item.badge > 0 && (
                          <div className={`absolute top-2 right-2 w-2 h-2 rounded-full ${
                            item.isCritical ? 'bg-[#F06548] animate-ping' : 'bg-[#F7B84B]'
                          }`} />
                        )}
                      </button>
                    </li>
                  );
                })}
              </React.Fragment>
            ))}
          </ul>
        </div>

        {/* Bottom Gateway Connection Status & Profile */}
        <div className="p-3 border-t border-white/10 space-y-2 flex-shrink-0">
          {!isCollapsed ? (
            <>
              <div className="px-2 py-1 flex items-center justify-between text-xs text-[#abb9e8]">
                <div className="flex items-center space-x-2">
                  <span className={`w-2 h-2 rounded-full ${
                    isConnected ? 'bg-[#0AB39C]' : isServerWaking ? 'bg-[#F7B84B] animate-pulse' : 'bg-slate-400'
                  }`} />
                  <span className="font-medium text-white/90">Gateway link</span>
                </div>
                <span className="text-[11px] text-[#abb9e8]/80 font-mono">
                  {isConnected ? 'Port 5000' : 'Reconnecting'}
                </span>
              </div>

              <div className="flex items-center justify-between pt-1 border-t border-white/10">
                <div className="flex items-center space-x-2.5 min-w-0">
                  <div className="mg-avatar w-7 h-7 text-xs bg-white/20 text-white font-bold flex-shrink-0">
                    SS
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-medium text-white truncate">
                      {user?.name || 'Shift supervisor'}
                    </div>
                    <div className="text-[10px] text-[#abb9e8] truncate">
                      Sector 4 console
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => setIsCollapsed(true)}
                  className="p-1 rounded hover:bg-white/10 text-[#abb9e8] hover:text-white transition-colors cursor-pointer"
                  title="Collapse sidebar"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center space-y-2">
              <div className={`w-2.5 h-2.5 rounded-full ${isConnected ? 'bg-[#0AB39C]' : 'bg-[#F7B84B] animate-pulse'}`} title={isConnected ? 'Gateway Online' : 'Connecting'} />
              <button
                onClick={() => setIsCollapsed(false)}
                className="p-1.5 rounded hover:bg-white/10 text-[#abb9e8] hover:text-white transition-colors cursor-pointer"
                title="Expand sidebar"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
