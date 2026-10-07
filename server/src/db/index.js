import { SQLiteAdapter } from './sqliteAdapter.js';
import { FirebaseAdapter } from './firebaseAdapter.js';

let dbInstance = null;

export async function initDatabase() {
  const mode = process.env.DB_MODE || 'sqlite';
  console.log(`[Database] Initializing database in '${mode}' mode...`);

  if (mode === 'firebase') {
    dbInstance = new FirebaseAdapter();
  } else {
    const dbPath = process.env.SQLITE_DB_PATH || './data/mineguard.db';
    dbInstance = new SQLiteAdapter(dbPath);
  }

  await dbInstance.init();
  console.log(`[Database] Database initialized successfully (${mode}).`);
  return dbInstance;
}

export function getDatabase() {
  if (!dbInstance) {
    throw new Error('Database not initialized. Call initDatabase() first.');
  }
  return dbInstance;
}
