import React, { useState } from 'react';
import { 
  BarChart2, Flame, TrendingUp, ShieldAlert, 
  FileText, Download, Printer, Users, Thermometer, Compass, Calendar
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { 
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, 
  Tooltip, ResponsiveContainer, BarChart, Bar, Cell 
} from 'recharts';

export default function AnalyticsView() {
  const { workersLatest, unitCelsius } = useApp();
  const [selectedShift, setSelectedShift] = useState('Morning (06:00 - 14:00)');

  // Scatter plot data: Temperature vs Gas correlation
  const scatterData = [
    { temp: 26.5, gas: 1250, worker: 'W005 (Gate)' },
    { temp: 27.8, gas: 1390, worker: 'W004 (Conveyor 2)' },
    { temp: 28.2, gas: 1450, worker: 'W001 (Shaft 3)' },
    { temp: 29.5, gas: 1520, worker: 'W002 (Drift 1)' },
    { temp: 31.0, gas: 2150, worker: 'W003 (Extraction Face)' },
    { temp: 31.8, gas: 2380, worker: 'W003 (Peak)' },
    { temp: 27.1, gas: 1300, worker: 'W001 (Baseline)' },
  ];

  // Gas heatmap matrix (Hour of Day vs Day of Week simulated)
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const hours = ['06:00', '08:00', '10:00', '12:00', '14:00', '16:00', '18:00'];

  const getHeatmapColor = (dIdx, hIdx) => {
    // Simulated elevated risk on Thu/Fri afternoons
    if ((dIdx === 3 || dIdx === 4) && (hIdx >= 3 && hIdx <= 5)) {
      return 'bg-rose-500 text-white';
    } else if (hIdx >= 2 && hIdx <= 4) {
      return 'bg-amber-400 text-slate-900';
    }
    return 'bg-emerald-100 text-emerald-900';
  };

  // Top Risk Leaderboard
  const riskLeaderboard = [
    { rank: 1, id: 'W003', name: 'Amit Patel', zone: 'Zone C - Extraction Face', avgGas: '2180 mV', incidents: 3, riskScore: 88 },
    { rank: 2, id: 'W001', name: 'Rajesh Kumar', zone: 'Zone A - Shaft 3', avgGas: '1480 mV', incidents: 1, riskScore: 35 },
    { rank: 3, id: 'W002', name: 'Vikram Singh', zone: 'Zone B - Drift 1', avgGas: '1440 mV', incidents: 1, riskScore: 30 },
    { rank: 4, id: 'W004', name: 'Suresh Raina', zone: 'Zone B - Conveyor 2', avgGas: '1360 mV', incidents: 0, riskScore: 18 },
    { rank: 5, id: 'W005', name: 'Dinesh Karthik', zone: 'Main Access Gate', avgGas: '1240 mV', incidents: 0, riskScore: 12 },
  ];

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6 print:space-y-4">
      
      {/* 1. Header & Shift Report Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 print:hidden">
        <div>
          <h2 className="text-xl font-black text-slate-800 tracking-tight flex items-center space-x-2">
            <span>Environmental Trends & Shift Analytics</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Deep-dive gas heatmaps, temperature correlations, and safety risk leaderboards
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <select
            value={selectedShift}
            onChange={(e) => setSelectedShift(e.target.value)}
            className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700 shadow-sm"
          >
            <option>Morning (06:00 - 14:00)</option>
            <option>Afternoon (14:00 - 22:00)</option>
            <option>Night Shift (22:00 - 06:00)</option>
          </select>

          <button
            onClick={handlePrint}
            className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all flex items-center space-x-1.5"
          >
            <Printer className="h-4 w-4" />
            <span>Print Shift Safety Report</span>
          </button>
        </div>
      </div>

      {/* Printable Shift Header */}
      <div className="hidden print:block border-b pb-4 mb-4">
        <h1 className="text-2xl font-black text-slate-900">MineGuard • Shift Safety Summary Audit</h1>
        <p className="text-xs text-slate-500">Date: {new Date().toLocaleDateString()} • Shift: {selectedShift} • Sector: Coal Mine 4</p>
      </div>

      {/* 2. Heatmap & Correlation Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Gas Exposure Heatmap Matrix (7 cols) */}
        <div className="lg:col-span-7 bg-white p-5 rounded-2xl border border-slate-100 shadow-soft">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center space-x-2">
              <Flame className="h-5 w-5 text-orange-500" />
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                Atmospheric Gas Density Heatmap (Hour vs Day)
              </h4>
            </div>
            <span className="text-[10px] text-slate-400 font-semibold">Weekly Aggregation</span>
          </div>
          <p className="text-xs text-slate-500 mb-4">
            Identifies peak gas buildup periods to schedule ventilation fan cycles
          </p>

          {/* Matrix Grid */}
          <div className="overflow-x-auto">
            <table className="w-full text-center text-xs">
              <thead>
                <tr>
                  <th className="p-1.5 text-[10px] text-slate-400 font-bold"></th>
                  {hours.map(h => (
                    <th key={h} className="p-1.5 text-[10px] text-slate-500 font-semibold">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {days.map((d, dIdx) => (
                  <tr key={d}>
                    <td className="p-1.5 text-[10px] font-bold text-slate-600 text-left">{d}</td>
                    {hours.map((h, hIdx) => (
                      <td key={h} className="p-1">
                        <div className={`h-7 rounded-lg flex items-center justify-center font-bold text-[10px] transition-transform hover:scale-105 ${getHeatmapColor(dIdx, hIdx)}`}>
                          {getHeatmapColor(dIdx, hIdx).includes('rose') ? '2.4k' : getHeatmapColor(dIdx, hIdx).includes('amber') ? '1.8k' : '1.3k'}
                        </div>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between text-[11px] text-slate-400 pt-3 mt-2 border-t border-slate-100">
            <div className="flex items-center space-x-3">
              <span className="flex items-center space-x-1">
                <span className="h-2.5 w-2.5 rounded bg-emerald-100 border border-emerald-300" />
                <span>&lt; 1500 mV (Low)</span>
              </span>
              <span className="flex items-center space-x-1">
                <span className="h-2.5 w-2.5 rounded bg-amber-400" />
                <span>1500 - 2000 mV (Elevated)</span>
              </span>
              <span className="flex items-center space-x-1">
                <span className="h-2.5 w-2.5 rounded bg-rose-500 text-white" />
                <span>&gt; 2000 mV (Ventilation Req)</span>
              </span>
            </div>
          </div>
        </div>

        {/* Temperature vs Gas Index Correlation Scatter (5 cols) */}
        <div className="lg:col-span-5 bg-white p-5 rounded-2xl border border-slate-100 shadow-soft flex flex-col justify-between">
          <div>
            <div className="flex items-center space-x-2 mb-2">
              <Thermometer className="h-5 w-5 text-amber-500" />
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                Temperature vs Gas Correlation
              </h4>
            </div>
            <p className="text-xs text-slate-500 mb-3">
              Scatter plot correlating thermal drift with combustible gas releases
            </p>

            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart margin={{ top: 10, right: 10, bottom: 0, left: -10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                  <XAxis type="number" dataKey="temp" name="Temperature" unit="°C" domain={[24, 34]} stroke="#94A3B8" fontSize={11} />
                  <YAxis type="number" dataKey="gas" name="Gas Level" unit=" mV" domain={[1000, 2600]} stroke="#94A3B8" fontSize={11} />
                  <Tooltip cursor={{ strokeDasharray: '3 3' }} contentStyle={{ backgroundColor: '#FFFFFF', borderRadius: '12px', fontSize: '11px' }} />
                  <Scatter name="Miners" data={scatterData} fill="#6366F1" />
                </ScatterChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="text-[11px] text-slate-500 pt-2 border-t border-slate-100">
            <span>Positive correlation r = +0.78 between depth temperature and gas pockets.</span>
          </div>
        </div>

      </div>

      {/* 3. Top-Risk Worker Leaderboard & Shift Summary */}
      <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-soft space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <ShieldAlert className="h-5 w-5 text-rose-500" />
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">
              Shift Hazard Exposure Leaderboard
            </h4>
          </div>
          <span className="text-xs font-semibold text-slate-500">Based on cumulative sensor dwell time</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-slate-50 text-slate-700 font-bold uppercase text-[10px] tracking-wider border-b border-slate-100">
              <tr>
                <th className="p-3">Rank</th>
                <th className="p-3">Miner Name & ID</th>
                <th className="p-3">Extraction Zone</th>
                <th className="p-3">Avg Gas Exposure</th>
                <th className="p-3">Incident Flags</th>
                <th className="p-3">Cumulative Risk Index</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {riskLeaderboard.map(item => (
                <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                  <td className="p-3 font-bold text-slate-800">#{item.rank}</td>
                  <td className="p-3 font-bold text-slate-900">{item.name} <span className="text-slate-400 font-normal">({item.id})</span></td>
                  <td className="p-3 font-medium text-slate-600">{item.zone}</td>
                  <td className="p-3 font-mono font-semibold text-slate-800">{item.avgGas}</td>
                  <td className="p-3">
                    {item.incidents > 0 ? (
                      <span className="px-2 py-0.5 bg-rose-100 text-rose-800 rounded font-bold text-[10px]">
                        {item.incidents} Alarmed
                      </span>
                    ) : (
                      <span className="text-slate-400 font-medium">0 Clean</span>
                    )}
                  </td>
                  <td className="p-3">
                    <div className="flex items-center space-x-2">
                      <div className="w-24 bg-slate-100 rounded-full h-2 overflow-hidden">
                        <div
                          className={`h-full rounded-full ${item.riskScore >= 70 ? 'bg-rose-500' : item.riskScore >= 30 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                          style={{ width: `${item.riskScore}%` }}
                        />
                      </div>
                      <span className="font-bold text-xs">{item.riskScore}/100</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
