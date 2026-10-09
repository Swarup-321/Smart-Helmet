import { initDatabase, getDatabase } from '../db/index.js';

async function main() {
  try {
    await initDatabase();
    const db = getDatabase();
    if (db.run) {
      const res = await db.run(
        "DELETE FROM alerts WHERE type = 'OFFLINE' AND message LIKE '%helmet signal timed out%'"
      );
      console.log('Successfully deleted timed out offline alerts:', res?.changes);
    }
    process.exit(0);
  } catch (err) {
    console.error('Error clearing stale alerts:', err);
    process.exit(1);
  }
}

main();
