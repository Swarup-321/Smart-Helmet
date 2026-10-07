import { io } from 'socket.io-client';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

class ApiService {
  constructor() {
    this.token = localStorage.getItem('mineguard_token') || null;
    this.socket = null;
  }

  setToken(token) {
    this.token = token;
    if (token) {
      localStorage.setItem('mineguard_token', token);
    } else {
      localStorage.removeItem('mineguard_token');
    }
  }

  getToken() {
    return this.token;
  }

  async request(endpoint, options = {}) {
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const url = `${API_BASE_URL}${endpoint}`;
    
    try {
      const response = await fetch(url, { ...options, headers });
      if (response.status === 401 && !endpoint.includes('/auth/login')) {
        // Token expired or invalid
        this.setToken(null);
        window.dispatchEvent(new CustomEvent('mineguard:unauthorized'));
      }
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const error = new Error(errorData.error || `HTTP error ${response.status}`);
        error.status = response.status;
        error.details = errorData;
        throw error;
      }
      
      return await response.json();
    } catch (err) {
      if (err.name === 'TypeError' && err.message.includes('fetch')) {
        const netErr = new Error('Network error: Unable to connect to MineGuard server.');
        netErr.status = -1;
        throw netErr;
      }
      throw err;
    }
  }

  // Auth
  async login(email, password) {
    const data = await this.request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
    if (data.token) {
      this.setToken(data.token);
    }
    return data;
  }

  logout() {
    this.setToken(null);
    localStorage.removeItem('mineguard_user');
  }

  // Stats & Health
  async getHealth() {
    return this.request('/healthz');
  }

  async getSummaryStats() {
    return this.request('/api/stats/summary');
  }

  // Workers
  async getWorkers() {
    return this.request('/api/workers');
  }

  async getWorker(id) {
    return this.request(`/api/workers/${id}`);
  }

  async createWorker(data) {
    return this.request('/api/workers', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  async updateWorker(id, data) {
    return this.request(`/api/workers/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  }

  async deleteWorker(id) {
    return this.request(`/api/workers/${id}`, {
      method: 'DELETE'
    });
  }

  // Telemetry & Readings
  async getLatestReadings() {
    return this.request('/api/readings/latest');
  }

  async getReadingHistory(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request(`/api/readings/history${query ? `?${query}` : ''}`);
  }

  // Trends & Analytics
  async getTrends(workerId, metric = 'mq2_mv', window = 50) {
    return this.request(`/api/trends?worker_id=${workerId || ''}&metric=${metric}&window=${window}`);
  }

  // Alerts
  async getAlerts(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request(`/api/alerts${query ? `?${query}` : ''}`);
  }

  async acknowledgeAlert(id, acknowledgedBy = 'Safety Officer') {
    return this.request(`/api/alerts/${id}/acknowledge`, {
      method: 'PATCH',
      body: JSON.stringify({ acknowledged_by: acknowledgedBy })
    });
  }

  async bulkAcknowledgeAlerts(ids, acknowledgedBy = 'Safety Officer') {
    return this.request('/api/alerts/bulk-acknowledge', {
      method: 'POST',
      body: JSON.stringify({ ids, acknowledged_by: acknowledgedBy })
    });
  }

  async resolveAlert(id) {
    return this.request(`/api/alerts/${id}/resolve`, {
      method: 'PATCH'
    });
  }

  // Thresholds
  async getThresholds() {
    return this.request('/api/thresholds');
  }

  async updateThresholds(data) {
    return this.request('/api/thresholds', {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  }

  // System Config
  async getSystemConfig() {
    return this.request('/api/config/system');
  }

  async updateSystemConfig(config) {
    return this.request('/api/config/system', {
      method: 'PUT',
      body: JSON.stringify(config)
    });
  }

  // CSV Export
  getExportCsvUrl(workerId) {
    return `${API_BASE_URL}/api/export/readings.csv${workerId ? `?worker_id=${workerId}` : ''}`;
  }

  // Socket.IO init
  initSocket(onReading, onAlert, onWorkerStatus) {
    if (this.socket) {
      this.socket.disconnect();
    }

    this.socket = io(API_BASE_URL, {
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
      timeout: 10000
    });

    if (onReading) this.socket.on('reading', onReading);
    if (onAlert) this.socket.on('alert', onAlert);
    if (onWorkerStatus) this.socket.on('worker_status', onWorkerStatus);

    return this.socket;
  }

  disconnectSocket() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }
}

export const api = new ApiService();
