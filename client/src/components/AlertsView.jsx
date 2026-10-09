import React, { useState, useEffect } from 'react';
import { 
  AlertTriangle, CheckCircle2, ShieldAlert, Filter, 
  Search, Check, Trash2, Clock, HardHat, RefreshCw, BarChart2, PieChart
} from 'lucide-react';
import { api } from '../services/api';
import { useApp } from '../context/AppContext';
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, 
  PieChart as RechartsPie, Pie, Cell, Legend, CartesianGrid 
} from 'recharts';

export default function AlertsView() {
  const { activeAlerts, refreshData, acknowledgeDemoAlert, resolveDemoAlert } = useApp();
  const [alerts, setAlerts] = useState([]);
  const [filterSeverity, setFilterSeverity] = useState('ALL');
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [filterType, setFilterType] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAlerts, setSelectedAlerts] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchAlertHistory = async () => {
    setLoading(true);
    try {
      const data = await api.getAlerts({ limit: 300 });
      setAlerts(data);
    } catch (err) {
      console.error('Failed to fetch alerts:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAlertHistory();
  }, [activeAlerts]);

  // Merge server alerts with active in-memory demo alerts
  const demoAlerts = activeAlerts.filter(a => a.is_demo || a.worker_id === 'DEMO-MINER-01');
  const allAlerts = [
    ...demoAlerts,
    ...alerts.filter(a => !demoAlerts.some(da => da.id === a.id))
  ];

  // Filtering Logic
  const filtered = allAlerts.filter(a => {
    if (filterSeverity !== 'ALL' && a.severity !== filterSeverity) return false;
    if (filterType !== 'ALL' && a.type !== filterType) return false;
    if (filterStatus === 'ACTIVE' && (a.resolved_at || a.acknowledged)) return false;
    if (filterStatus === 'ACKNOWLEDGED' && (!a.acknowledged || a.resolved_at)) return false;
    if (filterStatus === 'RESOLVED' && !a.resolved_at) return false;

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchMsg = a.message?.toLowerCase().includes(q);
      const matchWorker = (a.worker_name || a.worker_id)?.toLowerCase().includes(q);
      if (!matchMsg && !matchWorker) return false;
    }
    return true;
  });

  const handleAcknowledge = async (id) => {
    const isDemo = demoAlerts.some(da => da.id === id);
    if (isDemo) {
      if (acknowledgeDemoAlert) acknowledgeDemoAlert(id);
      return;
    }
    try {
      await api.acknowledgeAlert(id, 'Safety Officer');
      fetchAlertHistory();
      refreshData();
    } catch (err) {
      console.error('Ack error:', err);
    }
  };

  const handleResolve = async (id) => {
    const isDemo = demoAlerts.some(da => da.id === id);
    if (isDemo) {
      if (resolveDemoAlert) resolveDemoAlert(id);
      return;
    }
    try {
      await api.resolveAlert(id);
      fetchAlertHistory();
      refreshData();
    } catch (err) {
      console.error('Resolve error:', err);
    }
  };

  const handleBulkAcknowledge = async () => {
    if (selectedAlerts.length === 0) return;
    try {
      const demoSelected = selectedAlerts.filter(id => demoAlerts.some(da => da.id === id));
      const serverSelected = selectedAlerts.filter(id => !demoAlerts.some(da => da.id === id));

      if (acknowledgeDemoAlert) {
        demoSelected.forEach(id => acknowledgeDemoAlert(id));
      }
      if (serverSelected.length > 0) {
        await api.bulkAcknowledgeAlerts(serverSelected, 'Safety Officer');
      }
      setSelectedAlerts([]);
      fetchAlertHistory();
      refreshData();
    } catch (err) {
      console.error('Bulk ack error:', err);
    }
  };

  const toggleSelect = (id) => {
    if (selectedAlerts.includes(id)) {
      setSelectedAlerts(selectedAlerts.filter(i => i !== id));
    } else {
      setSelectedAlerts([...selectedAlerts, id]);
    }
  };

  // Pie Chart Data: Alert Types breakdown
  const typeCounts = allAlerts.reduce((acc, a) => {
    acc[a.type] = (acc[a.type] || 0) + 1;
    return acc;
  }, {});

  const pieData = Object.entries(typeCounts).map(([name, value]) => ({ name, value }));
  const PIE_COLORS = ['#F06548', '#F7B84B', '#176B87', '#299CDB', '#0AB39C', '#878A99'];

  // Bar Chart Data: Severity distribution
  const severityCounts = [
    { severity: 'CRITICAL', count: allAlerts.filter(a => a.severity === 'CRITICAL').length },
    { severity: 'WARNING', count: allAlerts.filter(a => a.severity === 'WARNING').length },
    { severity: 'INFO', count: allAlerts.filter(a => a.severity === 'INFO').length }
  ];

  return (
    <div className="space-y-5">
      
      {/* 1. Breadcrumb Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-[#E9EBEC] gap-2">
        <div className="flex items-center space-x-2">
          <h1 className="text-base font-semibold text-[#495057]">
            Incident &amp; alarm audit log
          </h1>
          <span className="badge-soft-danger text-[11px]">
            {allAlerts.filter(a => !a.resolved_at).length} unresolved
          </span>
        </div>

        <div className="flex items-center space-x-2">
          {selectedAlerts.length > 0 && (
            <button
              onClick={handleBulkAcknowledge}
              className="px-3 py-1.5 bg-[#176B87] hover:bg-[#12566D] text-white text-xs font-medium rounded shadow-sm transition-colors flex items-center space-x-1.5"
            >
              <Check className="h-3.5 w-3.5" />
              <span>Acknowledge ({selectedAlerts.length})</span>
            </button>
          )}

          <button
            onClick={fetchAlertHistory}
            className="p-2 bg-white border border-[#E9EBEC] hover:bg-[#F3F6F9] text-[#878A99] rounded transition-colors"
            title="Refresh alert list"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin text-[#176B87]' : ''}`} />
          </button>
        </div>
      </div>

      {/* 2. Visual Analytics Summary: Classification & Severity Distribution (Velzon Cards) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        
        {/* Donut: Alert Types Breakdown */}
        <div className="velzon-card">
          <div className="velzon-card-header">
            <div className="flex items-center space-x-2">
              <PieChart className="h-4 w-4 text-[#176B87]" />
              <h2 className="velzon-card-title">
                Alert classification by type
              </h2>
            </div>
          </div>
          <div className="velzon-card-body h-48 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <RechartsPie>
                <Pie
                  data={pieData.length > 0 ? pieData : [{ name: 'None', value: 1 }]}
                  cx="50%"
                  cy="50%"
                  innerRadius={45}
                  outerRadius={70}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend iconSize={8} wrapperStyle={{ fontSize: '11px', fontFamily: 'Inter, sans-serif' }} />
              </RechartsPie>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Bar: Severity Distribution */}
        <div className="velzon-card">
          <div className="velzon-card-header">
            <div className="flex items-center space-x-2">
              <BarChart2 className="h-4 w-4 text-[#176B87]" />
              <h2 className="velzon-card-title">
                Severity frequency distribution
              </h2>
            </div>
          </div>
          <div className="velzon-card-body h-48 w-full pt-1">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={severityCounts} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F3F6F9" />
                <XAxis dataKey="severity" stroke="#878A99" fontSize={11} fontStyle="mono" />
                <YAxis stroke="#878A99" fontSize={11} allowDecimals={false} fontStyle="mono" />
                <Tooltip contentStyle={{ backgroundColor: '#FFFFFF', borderRadius: '6px', border: '1px solid #E9EBEC', fontSize: '12px' }} />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {severityCounts.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={entry.severity === 'CRITICAL' ? '#F06548' : entry.severity === 'WARNING' ? '#F7B84B' : '#299CDB'} 
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>

      {/* 3. Filter Bar (Velzon Card) */}
      <div className="velzon-card p-3 flex flex-col md:flex-row items-center justify-between gap-3">
        {/* Search */}
        <div className="relative w-full md:w-72">
          <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-[#878A99]" />
          <input
            type="text"
            placeholder="Search alerts, miners or messages..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-xs rounded border border-[#E9EBEC] bg-[#F8FAFC] focus:bg-white focus:outline-none focus:border-[#176B87] transition-colors"
          />
        </div>

        {/* Filter Controls */}
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto text-xs">
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-2.5 py-1.5 rounded border border-[#E9EBEC] bg-white text-[#495057] focus:outline-none text-xs"
          >
            <option value="ALL">All Status</option>
            <option value="ACTIVE">Active (Unacknowledged)</option>
            <option value="ACKNOWLEDGED">Acknowledged</option>
            <option value="RESOLVED">Resolved</option>
          </select>

          <select
            value={filterSeverity}
            onChange={(e) => setFilterSeverity(e.target.value)}
            className="px-2.5 py-1.5 rounded border border-[#E9EBEC] bg-white text-[#495057] focus:outline-none text-xs"
          >
            <option value="ALL">All Severities</option>
            <option value="CRITICAL">Critical</option>
            <option value="WARNING">Warning</option>
            <option value="INFO">Info</option>
          </select>

          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="px-2.5 py-1.5 rounded border border-[#E9EBEC] bg-white text-[#495057] focus:outline-none text-xs"
          >
            <option value="ALL">All Types</option>
            <option value="GAS">Gas Index</option>
            <option value="SOS">SOS Emergency</option>
            <option value="FALL">Fall Detection</option>
            <option value="HEALTH">Biometrics</option>
            <option value="TREND">Predictive Trend</option>
            <option value="OFFLINE">Offline Status</option>
            <option value="BATTERY">Battery Low</option>
          </select>
        </div>
      </div>

      {/* 4. Alerts Audit Table (Velzon Table) */}
      <div className="velzon-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-[#878A99]">
            <thead className="bg-[#F3F6F9] text-[#495057] font-semibold uppercase text-[11px] tracking-wider border-b border-[#E9EBEC]">
              <tr>
                <th className="p-3.5 w-10">
                  <input
                    type="checkbox"
                    checked={selectedAlerts.length > 0 && selectedAlerts.length === filtered.length}
                    onChange={(e) => {
                      if (e.target.checked) setSelectedAlerts(filtered.map(a => a.id));
                      else setSelectedAlerts([]);
                    }}
                    className="rounded border-[#E9EBEC] text-[#176B87] focus:ring-[#176B87]"
                  />
                </th>
                <th className="p-3.5">Severity &amp; Type</th>
                <th className="p-3.5">Unit &amp; Zone</th>
                <th className="p-3.5">Event Description</th>
                <th className="p-3.5">Timestamp</th>
                <th className="p-3.5">Status</th>
                <th className="p-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E9EBEC]">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan="7" className="p-8 text-center text-[#878A99]">
                    No alert records match the selected filters.
                  </td>
                </tr>
              ) : (
                filtered.map(alert => (
                  <tr key={alert.id} className="hover:bg-[#F8FAFB] transition-colors">
                    <td className="p-3.5">
                      <input
                        type="checkbox"
                        checked={selectedAlerts.includes(alert.id)}
                        onChange={() => toggleSelect(alert.id)}
                        className="rounded border-[#E9EBEC] text-[#176B87] focus:ring-[#176B87]"
                      />
                    </td>
                    <td className="p-3.5 whitespace-nowrap">
                      <span className={
                        alert.severity === 'CRITICAL'
                          ? 'badge-soft-danger'
                          : alert.severity === 'WARNING'
                          ? 'badge-soft-warning'
                          : 'badge-soft-info'
                      }>
                        {alert.severity} • {alert.type}
                      </span>
                    </td>
                    <td className="p-3.5 whitespace-nowrap">
                      <div className="flex items-center space-x-1.5">
                        <span className="font-semibold text-[#212529]">{alert.worker_name || alert.worker_id}</span>
                        {alert.is_demo && (
                          <span className="badge-soft-warning text-[9px]">
                            DEMO
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-[#878A99]">{alert.worker_zone || 'Sector 4'}</div>
                    </td>
                    <td className="p-3.5 font-medium text-[#495057] max-w-sm">
                      {alert.message}
                    </td>
                    <td className="p-3.5 whitespace-nowrap text-[#878A99] text-[11px]">
                      {new Date(alert.ts).toLocaleString()}
                    </td>
                    <td className="p-3.5 whitespace-nowrap">
                      {alert.resolved_at ? (
                        <span className="badge-soft-success flex items-center space-x-1 w-fit">
                          <CheckCircle2 className="h-3 w-3" />
                          <span>Resolved</span>
                        </span>
                      ) : alert.acknowledged ? (
                        <span className="badge-soft-info flex items-center space-x-1 w-fit">
                          <Check className="h-3 w-3" />
                          <span>Ack by {alert.acknowledged_by}</span>
                        </span>
                      ) : (
                        <span className="badge-soft-danger flex items-center space-x-1 w-fit animate-pulse">
                          <AlertTriangle className="h-3 w-3" />
                          <span>Unacknowledged</span>
                        </span>
                      )}
                    </td>
                    <td className="p-3.5 whitespace-nowrap text-right space-x-1.5">
                      {!alert.acknowledged && !alert.resolved_at && (
                        <button
                          onClick={() => handleAcknowledge(alert.id)}
                          className="px-2.5 py-1 bg-white hover:bg-[#F3F6F9] text-[#495057] border border-[#E9EBEC] font-semibold rounded text-xs transition-colors shadow-2xs"
                        >
                          Ack
                        </button>
                      )}
                      {!alert.resolved_at && (
                        <button
                          onClick={() => handleResolve(alert.id)}
                          className="px-2.5 py-1 bg-[#E6F8F5] hover:bg-[#D5EFE3] text-[#0AB39C] border border-[#B9ECE3] font-semibold rounded text-xs transition-colors shadow-2xs"
                        >
                          Resolve
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
