import { initDatabase, getDatabase } from '../db/index.js';

async function main() {
  await initDatabase();
  const db = getDatabase();
  const alerts = await db.all("SELECT id, worker_id, type, severity, message, resolved_at FROM alerts");
  console.log('Total alerts in DB:', alerts.length);
  for (const a of alerts) {
    console.log(a.id, '|', a.worker_id, '|', a.type, '|', a.severity, '|', a.resolved_at ? 'RESOLVED' : 'ACTIVE', '|', a.message);
  }
  process.exit(0);
}

main();
