import React, { useState } from 'react';
import { 
  Plus, HardHat, Wifi, Battery, Edit, Trash2, 
  Copy, Check, Code, Shield, Radio, RefreshCw, X
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { api } from '../services/api';

export default function WorkersDevicesView({ onSelectWorker }) {
  const { workersLatest, refreshData } = useApp();
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingWorker, setEditingWorker] = useState(null);
  const [copiedKey, setCopiedKey] = useState(false);
  const [formData, setFormData] = useState({
    id: '',
    name: '',
    helmet_id: '',
    zone: 'Zone A - Shaft 3',
    phone: '',
    emergency_contact: ''
  });

  const apiKey = 'mineguard_device_secret_key_2026';

  const handleCopyKey = () => {
    navigator.clipboard.writeText(apiKey);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  const handleSaveWorker = async (e) => {
    e.preventDefault();
    try {
      if (editingWorker) {
        await api.updateWorker(editingWorker.id, formData);
      } else {
        await api.createWorker(formData);
      }
      setShowAddModal(false);
      setEditingWorker(null);
      setFormData({ id: '', name: '', helmet_id: '', zone: 'Zone A - Shaft 3', phone: '', emergency_contact: '' });
      refreshData();
    } catch (err) {
      console.error('Failed to save worker:', err);
    }
  };

  const handleDelete = async (id, e) => {
    e.stopPropagation();
    if (confirm(`Are you sure you want to remove worker ${id}?`)) {
      try {
        await api.deleteWorker(id);
        refreshData();
      } catch (err) {
        console.error('Failed to delete worker:', err);
      }
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
    <div className="space-y-6">
      
      {/* 1. Header & Register Action */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-800 tracking-tight flex items-center space-x-2">
            <span>Miners & Smart Helmet Provisioning</span>
            <span className="px-2.5 py-0.5 bg-blue-100 text-blue-800 rounded-full text-xs font-bold">
              {workersLatest.length} Registered
            </span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage helmet pairing IDs, designated mine zones, and emergency contact details
          </p>
        </div>

        <button
          onClick={() => {
            setEditingWorker(null);
            setFormData({ id: `W00${workersLatest.length + 1}`, name: '', helmet_id: `H00${workersLatest.length + 1}`, zone: 'Zone A - Shaft 3', phone: '', emergency_contact: '' });
            setShowAddModal(true);
          }}
          className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-glow-primary transition-all flex items-center space-x-1.5"
        >
          <Plus className="h-4 w-4" />
          <span>Register Miner / Helmet</span>
        </button>
      </div>

      {/* 2. Device Integration & API Secret Key Snippet */}
      <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-soft">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2">
              <Code className="h-5 w-5 text-indigo-600" />
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                ESP32 Device Authentication (x-api-key)
              </h4>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Include this secret header in your ESP32 Wi-Fi HTTP client firmware to authenticate POST telemetry packets.
            </p>
          </div>

          <div className="flex items-center space-x-2 w-full lg:w-auto">
            <code className="px-3 py-2 bg-slate-100 border border-slate-200 rounded-xl font-mono text-xs text-slate-800 font-bold select-all flex-1 lg:flex-none">
              {apiKey}
            </code>
            <button
              onClick={handleCopyKey}
              className="p-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold shadow-sm transition-colors flex items-center space-x-1"
            >
              {copiedKey ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4 text-slate-500" />}
            </button>
          </div>
        </div>
      </div>

      {/* 3. Workers & Devices Table */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-soft overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-slate-50 text-slate-700 font-bold uppercase text-[10px] tracking-wider border-b border-slate-100">
              <tr>
                <th className="p-4">Miner Name</th>
                <th className="p-4">Worker ID</th>
                <th className="p-4">Helmet ID</th>
                <th className="p-4">Assigned Zone</th>
                <th className="p-4">Telemetry Protocol</th>
                <th className="p-4">Helmet Battery</th>
                <th className="p-4">Signal RSSI</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {workersLatest.map(({ worker, status, reading, age_seconds }) => {
                const isOnline = status === 'online';
                return (
                  <tr 
                    key={worker.id}
                    onClick={() => onSelectWorker(worker.id)}
                    className="hover:bg-slate-50 cursor-pointer transition-colors"
                  >
                    <td className="p-4 font-bold text-slate-900 flex items-center space-x-2.5">
                      <div className={`h-8 w-8 rounded-lg flex items-center justify-center font-bold text-xs ${
                        isOnline ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-600'
                      }`}>
                        <HardHat className="h-4 w-4" />
                      </div>
                      <div>
                        <div>{worker.name}</div>
                        <div className="text-[10px] text-slate-400 font-normal">{worker.phone || 'No phone'}</div>
                      </div>
                    </td>
                    <td className="p-4 font-mono font-bold text-slate-800">{worker.id}</td>
                    <td className="p-4 font-mono font-semibold text-slate-700">{worker.helmet_id}</td>
                    <td className="p-4 font-medium text-slate-700">{worker.zone}</td>
                    <td className="p-4">
                      <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-mono text-[10px] uppercase font-bold">
                        {reading?.communication || 'Wi-Fi (HTTPS)'}
                      </span>
                    </td>
                    <td className="p-4">
                      {reading?.battery !== undefined ? (
                        <div className="flex items-center space-x-1.5 font-bold text-slate-700">
                          <Battery className={`h-4 w-4 ${reading.battery < 20 ? 'text-rose-500' : 'text-emerald-500'}`} />
                          <span>{reading.battery}%</span>
                        </div>
                      ) : (
                        <span className="text-slate-400">N/A</span>
                      )}
                    </td>
                    <td className="p-4 font-mono text-slate-600">
                      {reading?.rssi ? `${reading.rssi} dBm` : '-65 dBm'}
                    </td>
                    <td className="p-4 text-right space-x-2">
                      <button
                        onClick={(e) => openEdit(worker, e)}
                        className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-600 hover:text-blue-600 transition-colors"
                        title="Edit Worker"
                      >
                        <Edit className="h-4 w-4" />
                      </button>
                      <button
                        onClick={(e) => handleDelete(worker.id, e)}
                        className="p-1.5 hover:bg-rose-50 rounded-lg text-slate-600 hover:text-rose-600 transition-colors"
                        title="Remove Worker"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* 4. Registration / Edit Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-card space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-base font-bold text-slate-800">
                {editingWorker ? 'Edit Miner Details' : 'Register New Miner'}
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSaveWorker} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Worker ID</label>
                <input
                  type="text"
                  required
                  disabled={!!editingWorker}
                  value={formData.id}
                  onChange={(e) => setFormData({ ...formData, id: e.target.value })}
                  placeholder="e.g. W006"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Miner Full Name</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. Anand Sharma"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Helmet ID</label>
                  <input
                    type="text"
                    required
                    value={formData.helmet_id}
                    onChange={(e) => setFormData({ ...formData, helmet_id: e.target.value })}
                    placeholder="e.g. H006"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Assigned Zone</label>
                  <select
                    value={formData.zone}
                    onChange={(e) => setFormData({ ...formData, zone: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none"
                  >
                    <option>Zone A - Shaft 3</option>
                    <option>Zone B - Drift 1</option>
                    <option>Zone C - Extraction Face</option>
                    <option>Zone B - Conveyor 2</option>
                    <option>Main Access Gate</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Miner Phone</label>
                <input
                  type="text"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="+91 98765 00000"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Emergency Contact</label>
                <input
                  type="text"
                  value={formData.emergency_contact}
                  onChange={(e) => setFormData({ ...formData, emergency_contact: e.target.value })}
                  placeholder="e.g. Relative Name (+91 98765 11111)"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-sm"
                >
                  Save Miner
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
