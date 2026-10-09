import React, { useState } from 'react';
import { 
  BarChart2, Flame, Thermometer, Wind, 
  TrendingUp, Activity, Filter, Calendar, Download, 
  Printer, ArrowUpRight, ArrowDownRight, Clock, ShieldCheck, AlertTriangle
} from 'lucide-react';
import { 
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, 
  Tooltip, ResponsiveContainer, ZAxis, ReferenceLine 
} from 'recharts';

export default function AnalyticsView() {
  const [selectedShift, setSelectedShift] = useState('Morning (06:00 - 14:00)');
  const [selectedGasType, setSelectedGasType] = useState('MQ-2');

  // Multi-Worker Gas Correlation Data (Temperature vs Gas Level)
  const correlationData = [
    { temp: 24.2, gas: 1180, hr: 68, worker: 'W001' },
    { temp: 24.8, gas: 1220, hr: 72, worker: 'W001' },
    { temp: 25.1, gas: 1260, hr: 74, worker: 'W002' },
    { temp: 25.5, gas: 1310, hr: 76, worker: 'W002' },
    { temp: 26.0, gas: 1390, hr: 80, worker: 'W003' },
    { temp: 26.4, gas: 1450, hr: 82, worker: 'W004' },
    { temp: 27.2, gas: 1680, hr: 88, worker: 'W003' },
    { temp: 27.8, gas: 1820, hr: 92, worker: 'W003' },
    { temp: 28.3, gas: 1980, hr: 96, worker: 'W003' },
    { temp: 28.9, gas: 2150, hr: 104, worker: 'W003' }, // Elevated
    { temp: 29.4, gas: 2340, hr: 110, worker: 'W003' }, // High
    { temp: 25.8, gas: 1240, hr: 75, worker: 'W006' },
  ];

  // 7-Day Atmospheric Heatmap Data (Days x 4-Hour Time Blocks)
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const timeBlocks = ['00-04h', '04-08h', '08-12h', '12-16h', '16-20h', '20-24h'];
  
  // Synthetic calibrated matrix values (mV)
  const heatmapMatrix = [
    [1180, 1200, 1450, 1620, 1380, 1220], // Mon
    [1190, 1210, 1510, 1780, 1420, 1230], // Tue
    [1220, 1240, 1680, 2150, 1640, 1280], // Wed (High surge)
    [1210, 1230, 1540, 1890, 1490, 1250], // Thu
    [1200, 1220, 1480, 1710, 1410, 1240], // Fri
    [1160, 1180, 1320, 1450, 1310, 1190], // Sat (Reduced activity)
    [1150, 1170, 1290, 1380, 1280, 1180], // Sun
  ];

  const getHeatmapColor = (val) => {
    if (val >= 2000) return 'bg-[#F06548] text-white font-bold'; // Critical/High
    if (val >= 1600) return 'bg-[#F7B84B] text-[#182B3A] font-semibold'; // Elevated
    if (val >= 1400) return 'bg-[#E8F2F5] text-[#176B87]'; // Moderate
    return 'bg-[#F3F6F8] text-[#878A99]'; // Nominal
  };

  // Top Risk Leaderboard using updated demo helmets
  const riskLeaderboard = [
    { rank: 1, id: 'W003', helmet: 'DEMO-H003', name: 'Demo Helmet #3', zone: 'Zone C - Extraction Face', avgGas: '2180 mV', incidents: 3, riskScore: 88, status: 'ELEVATED' },
    { rank: 2, id: 'W001', helmet: 'DEMO-H001', name: 'Demo Helmet #1', zone: 'Zone A - Shaft 3', avgGas: '1480 mV', incidents: 1, riskScore: 35, status: 'NORMAL' },
    { rank: 3, id: 'W002', helmet: 'DEMO-H002', name: 'Demo Helmet #2', zone: 'Zone B - Drift 1', avgGas: '1440 mV', incidents: 1, riskScore: 30, status: 'NORMAL' },
    { rank: 4, id: 'W004', helmet: 'DEMO-H004', name: 'Demo Helmet #4', zone: 'Zone B - Conveyor 2', avgGas: '1360 mV', incidents: 0, riskScore: 18, status: 'NORMAL' },
    { rank: 5, id: 'W006', helmet: 'H-ESP32-LIVE', name: 'Physical Smart Helmet', zone: 'Zone A - Main Drift', avgGas: '—', incidents: null, riskScore: null, status: 'STANDBY' },
  ];

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-5 print:space-y-4">
      
      {/* 1. Velzon Breadcrumb Header Row */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-3 border-b border-[#E9EBEC] gap-3 print:hidden">
        <div className="flex items-center gap-2">
          <h4 className="text-sm sm:text-base font-bold text-[#495057] uppercase tracking-wide">
            Environmental Trends &amp; Shift Analytics
          </h4>
          <span className="badge-soft-info">
            SHIFT AUDIT
          </span>
        </div>

        <div className="flex items-center space-x-2">
          <select
            value={selectedShift}
            onChange={(e) => setSelectedShift(e.target.value)}
            className="px-3 py-1.5 rounded border border-[#E9EBEC] bg-white text-xs font-semibold text-[#495057] focus:outline-none focus:border-[#176B87]"
          >
            <option>Morning (06:00 - 14:00)</option>
            <option>Afternoon (14:00 - 22:00)</option>
            <option>Night Shift (22:00 - 06:00)</option>
          </select>

          <button
            onClick={handlePrint}
            className="px-3.5 py-1.5 bg-[#176B87] hover:bg-[#12566D] text-white rounded text-xs font-semibold shadow-sm transition-all flex items-center space-x-1.5"
          >
            <Printer className="h-3.5 w-3.5" />
            <span>Export Shift Report</span>
          </button>
        </div>
      </div>

      {/* Printable Shift Header */}
      <div className="hidden print:block border-b border-[#E9EBEC] pb-4 mb-4">
        <h1 className="text-xl font-bold text-[#212529]">MineGuard • Shift Safety Summary Audit</h1>
        <p className="text-xs text-[#878A99] font-mono">Date: {new Date().toLocaleDateString()} • Shift: {selectedShift} • Sector: Underground Mine Sector 4</p>
      </div>

      {/* 2. Heatmap & Correlation Grid (Velzon Cards) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        
        {/* Gas Exposure Heatmap Matrix (7 cols) */}
        <div className="lg:col-span-7 velzon-card">
          <div className="velzon-card-header">
            <div className="flex items-center space-x-2">
              <Flame className="h-4 w-4 text-[#176B87]" />
              <h2 className="velzon-card-title">
                Atmospheric gas density matrix (hour vs day)
              </h2>
            </div>
            <span className="text-[11px] text-[#878A99]">7-day window aggregate</span>
          </div>

          <div className="velzon-card-body">
            {/* Matrix Grid */}
            <div className="overflow-x-auto">
              <table className="w-full text-center text-xs border-collapse">
                <thead>
                  <tr>
                    <th className="p-2 text-left font-mono text-[10px] text-[#878A99] uppercase">Day</th>
                    {timeBlocks.map(t => (
                      <th key={t} className="p-2 font-mono text-[10px] text-[#878A99] uppercase">{t}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E9EBEC]">
                  {days.map((day, dIdx) => (
                    <tr key={day}>
                      <td className="p-2 text-left font-bold text-[#495057] text-xs">{day}</td>
                      {heatmapMatrix[dIdx].map((val, tIdx) => (
                        <td key={tIdx} className="p-1">
                          <div 
                            className={`p-2 rounded text-[11px] font-mono transition-transform hover:scale-105 ${getHeatmapColor(val)}`}
                            title={`${day} ${timeBlocks[tIdx]}: ${val} mV`}
                          >
                            {val}
                          </div>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Heatmap Legend */}
            <div className="mt-4 pt-3 border-t border-[#E9EBEC] flex items-center justify-between text-[11px] text-[#878A99]">
              <div className="flex items-center space-x-3">
                <span className="flex items-center space-x-1">
                  <span className="w-3 h-3 rounded bg-[#F3F6F8] border border-[#E9EBEC]" />
                  <span>&lt; 1400 mV (Nominal)</span>
                </span>
                <span className="flex items-center space-x-1">
                  <span className="w-3 h-3 rounded bg-[#E8F2F5] border border-[#C5DFE7]" />
                  <span>1400 - 1600 mV</span>
                </span>
                <span className="flex items-center space-x-1">
                  <span className="w-3 h-3 rounded bg-[#F7B84B]" />
                  <span>1600 - 2000 mV (Elevated)</span>
                </span>
                <span className="flex items-center space-x-1">
                  <span className="w-3 h-3 rounded bg-[#F06548]" />
                  <span>&gt; 2000 mV (Critical)</span>
                </span>
              </div>
              <span className="font-mono text-[10px]">Sensor: MQ-2 mV</span>
            </div>
          </div>
        </div>

        {/* Scatter: Temperature vs Gas Concentration Correlation (5 cols) */}
        <div className="lg:col-span-5 velzon-card">
          <div className="velzon-card-header">
            <div className="flex items-center space-x-2">
              <Thermometer className="h-4 w-4 text-[#176B87]" />
              <h2 className="velzon-card-title">
                Thermal vs gas concentration correlation
              </h2>
            </div>
            <span className="badge-soft-info">r = +0.84</span>
          </div>

          <div className="velzon-card-body">
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart margin={{ top: 10, right: 10, bottom: 10, left: -10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F3F6F9" />
                  <XAxis 
                    type="number" 
                    dataKey="temp" 
                    name="Temperature" 
                    unit="°C" 
                    domain={[23, 31]} 
                    stroke="#878A99" 
                    fontSize={10} 
                    fontStyle="mono" 
                  />
                  <YAxis 
                    type="number" 
                    dataKey="gas" 
                    name="Gas Level" 
                    unit="mV" 
                    domain={[1000, 2600]} 
                    stroke="#878A99" 
                    fontSize={10} 
                    fontStyle="mono" 
                  />
                  <Tooltip 
                    cursor={{ strokeDasharray: '3 3' }}
                    contentStyle={{ backgroundColor: '#FFFFFF', borderColor: '#E9EBEC', borderRadius: '6px', fontSize: '11px' }}
                  />
                  <ReferenceLine y={2000} stroke="#F7B84B" strokeDasharray="3 3" />
                  <Scatter name="Miners Telemetry" data={correlationData} fill="#176B87" />
                </ScatterChart>
              </ResponsiveContainer>
            </div>

            <div className="mt-4 pt-3 border-t border-[#E9EBEC] flex items-center justify-between text-xs text-[#878A99]">
              <span>Ventilation regression curve: <strong className="text-[#495057]">Positive Drift</strong></span>
              <span className="font-mono text-[11px]">Points: 12 Samples</span>
            </div>
          </div>
        </div>

      </div>

      {/* 3. Hazard Ranking & Shift Leaderboard Table (Velzon Table) */}
      <div className="velzon-card overflow-hidden">
        <div className="velzon-card-header">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="h-4 w-4 text-[#F7B84B]" />
            <h2 className="velzon-card-title">
              Shift hazard exposure leaderboard
            </h2>
          </div>
          <span className="text-xs text-[#878A99]">Ranked by cumulative gas exposure risk score</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-[#878A99]">
            <thead className="bg-[#F3F6F9] text-[#495057] font-semibold uppercase text-[11px] tracking-wider border-b border-[#E9EBEC]">
              <tr>
                <th className="p-3.5 w-12 text-center">Rank</th>
                <th className="p-3.5">Miner / Helmet</th>
                <th className="p-3.5">Deployment Drift</th>
                <th className="p-3.5">Mean Gas (MQ-2)</th>
                <th className="p-3.5 text-center">Shift Incidents</th>
                <th className="p-3.5">Risk Exposure Index</th>
                <th className="p-3.5 text-right">Exposure Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E9EBEC]">
              {riskLeaderboard.map((item) => (
                <tr key={item.id} className="hover:bg-[#F8FAFB] transition-colors">
                  <td className="p-3.5 text-center font-bold text-[#495057]">
                    #{item.rank}
                  </td>
                  <td className="p-3.5 font-semibold text-[#212529]">
                    <div>{item.name}</div>
                    <div className="text-[10px] text-[#878A99] font-mono">{item.id} • {item.helmet}</div>
                  </td>
                  <td className="p-3.5 font-medium text-[#495057]">
                    {item.zone}
                  </td>
                  <td className="p-3.5 font-mono text-[#495057] font-bold">
                    {item.avgGas}
                  </td>
                  <td className="p-3.5 text-center font-mono font-bold">
                    <span className={item.incidents > 0 ? 'text-[#F06548]' : 'text-[#878A99]'}>
                      {item.incidents !== null ? item.incidents : '—'}
                    </span>
                  </td>
                  <td className="p-3.5">
                    {item.riskScore !== null ? (
                      <div className="flex items-center space-x-2">
                        <div className="w-24 bg-[#E9EBEC] rounded-full h-1.5 overflow-hidden">
                          <div 
                            className={`h-full ${
                              item.riskScore > 70 ? 'bg-[#F06548]' : item.riskScore > 30 ? 'bg-[#F7B84B]' : 'bg-[#0AB39C]'
                            }`}
                            style={{ width: `${item.riskScore}%` }}
                          />
                        </div>
                        <span className="font-mono text-xs font-bold text-[#495057]">{item.riskScore}</span>
                      </div>
                    ) : (
                      <span className="text-[#878A99] font-mono">—</span>
                    )}
                  </td>
                  <td className="p-3.5 text-right">
                    <span className={
                      item.status === 'ELEVATED' ? 'badge-soft-danger' :
                      item.status === 'NORMAL' ? 'badge-soft-success' :
                      'badge-soft-dark'
                    }>
                      {item.status}
                    </span>
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
