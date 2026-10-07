import React, { useState, useEffect } from 'react';
import { 
  AlertTriangle, CheckCircle2, ShieldAlert, Filter, 
  Search, Check, Trash2, Clock, HardHat, RefreshCw, BarChart2, PieChart
} from 'lucide-react';
import { api } from '../services/api';
import { useApp } from '../context/AppContext';
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, 
  PieChart as RechartsPie, Pie, Cell, Legend 
} from 'recharts';

export default function AlertsView() {
  const { activeAlerts, refreshData } = useApp();
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

  // Filtering Logic
  const filtered = alerts.filter(a => {
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
    try {
      await api.acknowledgeAlert(id, 'Safety Officer');
      fetchAlertHistory();
      refreshData();
    } catch (err) {
      console.error('Ack error:', err);
    }
  };

  const handleResolve = async (id) => {
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
      await api.bulkAcknowledgeAlerts(selectedAlerts, 'Safety Officer');
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
  const typeCounts = alerts.reduce((acc, a) => {
    acc[a.type] = (acc[a.type] || 0) + 1;
    return acc;
  }, {});

  const pieData = Object.entries(typeCounts).map(([name, value]) => ({ name, value }));
  const PIE_COLORS = ['#EF4444', '#F59E0B', '#3B82F6', '#8B5CF6', '#10B981', '#64748B'];

  // Bar Chart Data: Severity distribution
  const severityCounts = [
    { severity: 'CRITICAL', count: alerts.filter(a => a.severity === 'CRITICAL').length },
    { severity: 'WARNING', count: alerts.filter(a => a.severity === 'WARNING').length },
    { severity: 'INFO', count: alerts.filter(a => a.severity === 'INFO').length }
  ];

  return (
    <div className="space-y-6">
      
      {/* 1. Header & Summary Stats */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-800 tracking-tight flex items-center space-x-2">
            <span>Safety Alerts & Incident Logs</span>
            <span className="px-2.5 py-0.5 bg-rose-100 text-rose-800 rounded-full text-xs font-bold">
              {alerts.filter(a => !a.resolved_at).length} Unresolved
            </span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Audit trail of gas threshold breaches, emergency SOS presses, and fall incidents
          </p>
        </div>

        <div className="flex items-center space-x-2">
          {selectedAlerts.length > 0 && (
            <button
              onClick={handleBulkAcknowledge}
              className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-sm transition-all flex items-center space-x-1.5"
            >
              <Check className="h-4 w-4" />
              <span>Acknowledge ({selectedAlerts.length})</span>
            </button>
          )}

          <button
            onClick={fetchAlertHistory}
            className="p-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl shadow-sm transition-colors"
            title="Refresh Alert List"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* 2. Visual Analytics Summary: Donut & Severity Distribution */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        
        {/* Donut: Alert Types Breakdown */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-soft">
          <div className="flex items-center space-x-2 mb-2">
            <PieChart className="h-5 w-5 text-indigo-500" />
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Alert Classification by Type
            </h4>
          </div>
          <div className="h-48 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <RechartsPie>
                <Pie
                  data={pieData.length > 0 ? pieData : [{ name: 'None', value: 1 }]}
                  cx="50%"
                  cy="50%"
                  innerRadius={45}
                  outerRadius={75}
                  paddingAngle={4}
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend iconSize={8} wrapperStyle={{ fontSize: '11px' }} />
              </RechartsPie>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Bar: Severity Distribution */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-soft">
          <div className="flex items-center space-x-2 mb-2">
            <BarChart2 className="h-5 w-5 text-blue-500" />
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Severity Frequency Distribution
            </h4>
          </div>
          <div className="h-48 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={severityCounts} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <XAxis dataKey="severity" stroke="#94A3B8" fontSize={11} />
                <YAxis stroke="#94A3B8" fontSize={11} allowDecimals={false} />
                <Tooltip contentStyle={{ backgroundColor: '#FFFFFF', borderRadius: '12px', border: '1px solid #E2E8F0', fontSize: '12px' }} />
                <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                  {severityCounts.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={entry.severity === 'CRITICAL' ? '#EF4444' : entry.severity === 'WARNING' ? '#F59E0B' : '#3B82F6'} 
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>

      {/* 3. Filter Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-soft flex flex-col md:flex-row items-center justify-between gap-3">
        
        {/* Search */}
        <div className="relative w-full md:w-72">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search alerts or miners..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
          />
        </div>

        {/* Filter Pills */}
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto text-xs">
          
          {/* Status Filter */}
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 font-medium text-slate-700 focus:outline-none"
          >
            <option value="ALL">All Status</option>
            <option value="ACTIVE">Active (Unacknowledged)</option>
            <option value="ACKNOWLEDGED">Acknowledged</option>
            <option value="RESOLVED">Resolved</option>
          </select>

          {/* Severity Filter */}
          <select
            value={filterSeverity}
            onChange={(e) => setFilterSeverity(e.target.value)}
            className="px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 font-medium text-slate-700 focus:outline-none"
          >
            <option value="ALL">All Severities</option>
            <option value="CRITICAL">Critical</option>
            <option value="WARNING">Warning</option>
            <option value="INFO">Info</option>
          </select>

          {/* Type Filter */}
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 font-medium text-slate-700 focus:outline-none"
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

      {/* 4. Alerts Log Table */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-soft overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-slate-50 text-slate-700 font-bold uppercase text-[10px] tracking-wider border-b border-slate-100">
              <tr>
                <th className="p-4 w-10">
                  <input
                    type="checkbox"
                    checked={selectedAlerts.length > 0 && selectedAlerts.length === filtered.length}
                    onChange={(e) => {
                      if (e.target.checked) setSelectedAlerts(filtered.map(a => a.id));
                      else setSelectedAlerts([]);
                    }}
                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                </th>
                <th className="p-4">Severity & Type</th>
                <th className="p-4">Worker & Zone</th>
                <th className="p-4">Event Description</th>
                <th className="p-4">Timestamp</th>
                <th className="p-4">Status & Ack</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan="7" className="p-8 text-center text-slate-400">
                    No alert records match the selected filters.
                  </td>
                </tr>
              ) : (
                filtered.map(alert => (
                  <tr key={alert.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="p-4">
                      <input
                        type="checkbox"
                        checked={selectedAlerts.includes(alert.id)}
                        onChange={() => toggleSelect(alert.id)}
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                    </td>
                    <td className="p-4 whitespace-nowrap">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase tracking-wide ${
                        alert.severity === 'CRITICAL'
                          ? 'bg-rose-100 text-rose-700 border border-rose-200'
                          : alert.severity === 'WARNING'
                          ? 'bg-amber-100 text-amber-700 border border-amber-200'
                          : 'bg-blue-100 text-blue-700 border border-blue-200'
                      }`}>
                        {alert.severity} • {alert.type}
                      </span>
                    </td>
                    <td className="p-4 whitespace-nowrap">
                      <div className="font-bold text-slate-800">{alert.worker_name || alert.worker_id}</div>
                      <div className="text-[10px] text-slate-400">{alert.worker_zone || 'Sector 4'}</div>
                    </td>
                    <td className="p-4 font-medium text-slate-800 max-w-xs">
                      {alert.message}
                    </td>
                    <td className="p-4 whitespace-nowrap text-slate-500 text-[11px]">
                      {new Date(alert.ts).toLocaleString()}
                    </td>
                    <td className="p-4 whitespace-nowrap">
                      {alert.resolved_at ? (
                        <span className="text-emerald-600 font-semibold flex items-center space-x-1">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          <span>Resolved</span>
                        </span>
                      ) : alert.acknowledged ? (
                        <span className="text-blue-600 font-semibold flex items-center space-x-1">
                          <Check className="h-3.5 w-3.5" />
                          <span>Ack by {alert.acknowledged_by}</span>
                        </span>
                      ) : (
                        <span className="text-rose-600 font-bold flex items-center space-x-1 animate-pulse">
                          <AlertTriangle className="h-3.5 w-3.5" />
                          <span>Unacknowledged</span>
                        </span>
                      )}
                    </td>
                    <td className="p-4 whitespace-nowrap text-right space-x-2">
                      {!alert.acknowledged && !alert.resolved_at && (
                        <button
                          onClick={() => handleAcknowledge(alert.id)}
                          className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-600 font-bold rounded-lg text-[11px] transition-colors"
                        >
                          Ack
                        </button>
                      )}
                      {!alert.resolved_at && (
                        <button
                          onClick={() => handleResolve(alert.id)}
                          className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-600 font-bold rounded-lg text-[11px] transition-colors"
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
