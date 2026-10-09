import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { SQLiteAdapter } from './sqliteAdapter.js';
import { FirebaseAdapter } from './firebaseAdapter.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let dbInstance = null;

export async function initDatabase() {
  const mode = process.env.DB_MODE || 'sqlite';
  console.log(`[Database] Initializing database in '${mode}' mode...`);

  if (mode === 'firebase') {
    dbInstance = new FirebaseAdapter();
  } else {
    let dbPath = process.env.SQLITE_DB_PATH || './data/mineguard.db';
    if (!path.isAbsolute(dbPath)) {
      // Locate the existing database file whether launched from repo root or server folder
      const serverDataPath = path.resolve(__dirname, '../../data', path.basename(dbPath));
      const cwdDataPath = path.resolve(process.cwd(), dbPath);
      if (fs.existsSync(serverDataPath)) {
        dbPath = serverDataPath;
      } else if (fs.existsSync(cwdDataPath)) {
        dbPath = cwdDataPath;
      } else {
        dbPath = serverDataPath;
      }
    }
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
