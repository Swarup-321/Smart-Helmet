import { initDatabase, getDatabase } from './index.js';

async function main() {
  await initDatabase();
  const adapter = getDatabase();
  await adapter.run("DELETE FROM workers WHERE id = 'W005'");
  const updates = [
    { id: 'W001', name: 'Demo Helmet #1', helmet_id: 'DEMO-H001', zone: 'Zone A - Shaft 3' },
    { id: 'W002', name: 'Demo Helmet #2', helmet_id: 'DEMO-H002', zone: 'Zone B - Drift 1' },
    { id: 'W003', name: 'Demo Helmet #3', helmet_id: 'DEMO-H003', zone: 'Zone C - Extraction Face' },
    { id: 'W004', name: 'Demo Helmet #4', helmet_id: 'DEMO-H004', zone: 'Zone B - Conveyor 2' },
    { id: 'W006', name: 'Physical Smart Helmet (Live)', helmet_id: 'H-ESP32-LIVE', zone: 'Zone A - Shaft 3' }
  ];
  for (const u of updates) {
    await adapter.run(
      'INSERT OR REPLACE INTO workers (id, name, helmet_id, zone, phone, emergency_contact, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [u.id, u.name, u.helmet_id, u.zone, '+91 98765 43210', 'Dispatch (+91 112)', new Date().toISOString()]
    );
  }
  const workers = await adapter.all('SELECT id, name, helmet_id, zone FROM workers');
  console.log('Updated workers:');
  console.table(workers);
  process.exit(0);
}

main().catch(console.error);
