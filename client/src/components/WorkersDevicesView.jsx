import React, { useState } from 'react';
import { 
  Users, HardHat, Plus, Edit2, Trash2, Shield, 
  Battery, Wifi, Phone, AlertCircle, ExternalLink,
  Cpu, Radio
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { api } from '../services/api';

export default function WorkersDevicesView({ onSelectWorker }) {
  const { workersLatest, refreshData } = useApp();
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingWorker, setEditingWorker] = useState(null);
  const [formData, setFormData] = useState({
    id: '',
    name: '',
    helmet_id: '',
    zone: 'Zone A - Shaft 3',
    phone: '',
    emergency_contact: ''
  });

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      if (editingWorker) {
        await api.updateWorker(editingWorker.id, formData);
      } else {
        await api.createWorker(formData);
      }
      setShowAddModal(false);
      setEditingWorker(null);
      refreshData();
    } catch (err) {
      console.error('Failed to save worker:', err);
    }
  };

  const handleDelete = async (id, e) => {
    e.stopPropagation();
    if (!window.confirm(`Are you sure you want to de-register worker ${id}?`)) return;
    try {
      await api.deleteWorker(id);
      refreshData();
    } catch (err) {
      console.error('Failed to delete worker:', err);
    }
  };

  const openEdit = (w, e) => {
    e.stopPropagation();
    setEditingWorker(w);
    setFormData({
      id: w.id,
      name: w.name,
      helmet_id: w.helmet_id,
      zone: w.zone,
      phone: w.phone || '',
      emergency_contact: w.emergency_contact || ''
    });
    setShowAddModal(true);
  };

  return (
    <div className="space-y-5">
      
      {/* 1. Breadcrumb Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-[#E9EBEC] gap-2">
        <div className="flex items-center space-x-2">
          <h1 className="text-base font-semibold text-[#495057]">
            Miners &amp; smart helmet provisioning
          </h1>
          <span className="badge-soft-info text-[11px]">
            {workersLatest.length} registered
          </span>
        </div>

        <button
          onClick={() => {
            setEditingWorker(null);
            setFormData({ id: `W00${workersLatest.length + 1}`, name: '', helmet_id: `DEMO-H00${workersLatest.length + 1}`, zone: 'Zone A - Shaft 3', phone: '', emergency_contact: '' });
            setShowAddModal(true);
          }}
          className="px-3.5 py-2 bg-[#176B87] hover:bg-[#12566D] text-white rounded text-xs font-medium shadow-sm transition-colors flex items-center space-x-1.5"
        >
          <Plus className="h-4 w-4" />
          <span>Provision new helmet</span>
        </button>
      </div>

      {/* 3. Workers & Devices Table (Velzon Table) */}
      <div className="velzon-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-[#878A99]">
            <thead className="bg-[#F8FAFC] text-[#495057] font-semibold text-xs border-b border-[#E9EBEC]">
              <tr>
                <th className="p-3.5">Helmet unit</th>
                <th className="p-3.5">Worker ID</th>
                <th className="p-3.5">Helmet ID</th>
                <th className="p-3.5">Assigned drift</th>
                <th className="p-3.5">Telemetry mode</th>
                <th className="p-3.5">Battery status</th>
                <th className="p-3.5">Link status</th>
                <th className="p-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E9EBEC]">
              {workersLatest.map(({ worker, status, reading, age_seconds }) => {
                const isOnline = status === 'online';
                const isLive = worker.id === 'W006' || worker.helmet_id === 'H-ESP32-LIVE';

                return (
                  <tr 
                    key={worker.id}
                    onClick={() => onSelectWorker(worker.id)}
                    className="hover:bg-[#F8FAFB] cursor-pointer transition-colors"
                  >
                    <td className="p-3.5 font-semibold text-[#212529] flex items-center space-x-2.5">
                      <div className={`w-8 h-8 rounded-md flex items-center justify-center font-bold text-xs shadow-2xs ${
                        isLive ? 'bg-[#176B87] text-white' : isOnline ? 'bg-[#0AB39C] text-white' : 'bg-[#F3F6F9] text-[#878A99] border border-[#E9EBEC]'
                      }`}>
                        <HardHat className="h-4 w-4" />
                      </div>
                      <div>
                        <div className="flex items-center space-x-1.5">
                          <span>{worker.name}</span>
                          {isLive && (
                            <span className="badge-soft-info text-[9px]">
                              HARDWARE
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-[#878A99] font-mono">{worker.phone || 'Dispatch link'}</div>
                      </div>
                    </td>
                    <td className="p-3.5 font-mono text-[#495057] font-bold">
                      {worker.id}
                    </td>
                    <td className="p-3.5 font-mono text-[#878A99]">
                      {worker.helmet_id}
                    </td>
                    <td className="p-3.5 font-medium text-[#495057]">
                      {worker.zone}
                    </td>
                    <td className="p-3.5">
                      <span className={isLive ? 'badge-soft-info' : 'badge-soft-dark'}>
                        {isLive ? 'Live ESP32 Wi-Fi' : 'Simulated Sensor'}
                      </span>
                    </td>
                    <td className="p-3.5">
                      <div className="flex items-center space-x-1.5 font-mono">
                        <Battery className={`h-3.5 w-3.5 ${
                          !isOnline ? 'text-[#878A99]' : (reading?.battery || 90) < 25 ? 'text-[#F06548]' : 'text-[#0AB39C]'
                        }`} />
                        <span>{isOnline && reading?.battery ? `${reading.battery}%` : '—'}</span>
                      </div>
                    </td>
                    <td className="p-3.5">
                      <div className="flex items-center space-x-1.5">
                        <span className={isOnline ? 'badge-soft-success' : 'badge-soft-dark'}>
                          {isOnline ? 'ONLINE' : 'STANDBY'}
                        </span>
                        {isOnline && age_seconds !== null && (
                          <span className="text-[10px] text-[#878A99] font-mono">
                            {age_seconds}s ago
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="p-3.5 text-right space-x-1">
                      <button
                        onClick={(e) => openEdit(worker, e)}
                        className="p-1.5 hover:bg-[#F3F6F9] rounded text-[#878A99] hover:text-[#176B87] transition-colors"
                        title="Edit Worker"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={(e) => handleDelete(worker.id, e)}
                        className="p-1.5 hover:bg-[#FDEEEB] rounded text-[#878A99] hover:text-[#F06548] transition-colors"
                        title="De-register"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* 4. Provisioning Modal (Velzon Modal Style) */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-lg border border-[#E9EBEC] shadow-dropdown w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-5 py-4 border-b border-[#E9EBEC] flex items-center justify-between bg-[#F8FAFC]">
              <h3 className="font-bold text-sm text-[#495057] uppercase tracking-wide">
                {editingWorker ? 'Edit Miner Assignment' : 'Provision New Smart Helmet'}
              </h3>
              <button 
                onClick={() => setShowAddModal(false)}
                className="text-[#878A99] hover:text-[#212529] text-base leading-none"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSave} className="p-5 space-y-3.5 text-xs">
              <div>
                <label className="block text-[#495057] font-semibold mb-1">Worker ID</label>
                <input
                  type="text"
                  disabled={!!editingWorker}
                  value={formData.id}
                  onChange={(e) => setFormData({ ...formData, id: e.target.value })}
                  className="w-full px-3 py-2 rounded border border-[#E9EBEC] bg-[#F8FAFC] focus:bg-white focus:outline-none focus:border-[#176B87] font-mono text-xs"
                  required
                />
              </div>

              <div>
                <label className="block text-[#495057] font-semibold mb-1">Worker Full Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. John Doe"
                  className="w-full px-3 py-2 rounded border border-[#E9EBEC] focus:outline-none focus:border-[#176B87] text-xs"
                  required
                />
              </div>

              <div>
                <label className="block text-[#495057] font-semibold mb-1">Paired Helmet Device ID</label>
                <input
                  type="text"
                  value={formData.helmet_id}
                  onChange={(e) => setFormData({ ...formData, helmet_id: e.target.value })}
                  placeholder="e.g. DEMO-H005"
                  className="w-full px-3 py-2 rounded border border-[#E9EBEC] focus:outline-none focus:border-[#176B87] font-mono text-xs"
                  required
                />
              </div>

              <div>
                <label className="block text-[#495057] font-semibold mb-1">Assigned Shaft / Zone</label>
                <select
                  value={formData.zone}
                  onChange={(e) => setFormData({ ...formData, zone: e.target.value })}
                  className="w-full px-3 py-2 rounded border border-[#E9EBEC] bg-white focus:outline-none focus:border-[#176B87] text-xs"
                >
                  <option value="Zone A - Shaft 3">Zone A - Shaft 3</option>
                  <option value="Zone B - Drift 1">Zone B - Drift 1</option>
                  <option value="Zone B - Conveyor 2">Zone B - Conveyor 2</option>
                  <option value="Zone C - Extraction Face">Zone C - Extraction Face</option>
                  <option value="Zone D - Sub-station">Zone D - Sub-station</option>
                </select>
              </div>

              <div>
                <label className="block text-[#495057] font-semibold mb-1">Radio / Phone Dispatch</label>
                <input
                  type="text"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="e.g. Ch-4 Radio (Ext 204)"
                  className="w-full px-3 py-2 rounded border border-[#E9EBEC] focus:outline-none focus:border-[#176B87] text-xs"
                />
              </div>

              <div className="pt-3 border-t border-[#E9EBEC] flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-3.5 py-2 rounded border border-[#E9EBEC] hover:bg-[#F3F6F9] text-[#495057] text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded bg-[#176B87] hover:bg-[#12566D] text-white text-xs font-semibold shadow-sm"
                >
                  {editingWorker ? 'Save Changes' : 'Register Unit'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
