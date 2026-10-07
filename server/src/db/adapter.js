export interface StorageAdapter {
  init(): Promise<void>;
  
  // Workers
  getWorkers(): Promise<any[]>;
  getWorker(id: string): Promise<any | null>;
  createWorker(worker: any): Promise<any>;
  updateWorker(id: string, updates: any): Promise<any>;
  deleteWorker(id: string): Promise<boolean>;

  // Latest Worker Reading Cache / Persistence
  getLatestReadings(): Promise<any[]>;
  getLatestReading(worker_id: string): Promise<any | null>;
  saveLatestReading(worker_id: string, reading: any): Promise<void>;

  // History Readings
  saveReadingHistory(reading: any): Promise<any>;
  saveReadingHistoryBatch(readings: any[]): Promise<void>;
  getReadingHistory(params: { worker_id?: string; from?: string; to?: string; limit?: number }): Promise<any[]>;

  // Alerts
  createAlert(alert: any): Promise<any>;
  getAlerts(params?: { status?: string; severity?: string; worker_id?: string; limit?: number }): Promise<any[]>;
  getAlert(id: string): Promise<any | null>;
  acknowledgeAlert(id: string, acknowledgedBy: string): Promise<any>;
  bulkAcknowledgeAlerts(ids: string[], acknowledgedBy: string): Promise<number>;
  resolveAlert(id: string): Promise<any>;
  getRecentUnresolvedAlert(worker_id: string, type: string, cooldownSec: number): Promise<any | null>;

  // Thresholds
  getThresholds(): Promise<any[]>;
  getThreshold(key: string): Promise<any | null>;
  updateThreshold(key: string, updates: { warning?: number; critical?: number; enabled?: boolean | number }): Promise<any>;

  // Users & Auth
  getUserByEmail(email: string): Promise<any | null>;
  getUserById(id: string): Promise<any | null>;
  createUser(user: any): Promise<any>;

  // Stats & Analytics
  getStatsSummary(): Promise<any>;
}
