/**
 * @file services/db.ts
 * Inizializzazione SQLite con expo-sqlite v15 (SDK 54).
 * API: openDatabaseAsync, execAsync, runAsync, getFirstAsync,
 *      getAllAsync, withTransactionAsync — identica alla v13
 *      ma con New Architecture abilitata di default.
 */

import * as SQLite from 'expo-sqlite';
import { DB_NAME, DB_VERSION } from '@/constants';
import type { DbMigration } from '@/types';

let _db: SQLite.SQLiteDatabase | null = null;

export function getDb(): SQLite.SQLiteDatabase {
  if (!_db) {
    throw new Error(
      '[db] Database non inizializzato. Chiama initDatabase() prima.'
    );
  }
  return _db;
}

const MIGRATIONS: DbMigration[] = [
  {
    version: 1,
    description: 'Schema iniziale: config_webservice, fascicoli, foto',
    sql: `
      CREATE TABLE IF NOT EXISTS _migrations (
        version     INTEGER PRIMARY KEY,
        description TEXT NOT NULL,
        applied_at  DATETIME DEFAULT (datetime('now'))
      );
      CREATE TABLE IF NOT EXISTS config_webservice (
        id         INTEGER PRIMARY KEY CHECK (id = 1),
        base_url   TEXT NOT NULL DEFAULT '',
        auth_token TEXT NOT NULL DEFAULT '',
        timeout_ms INTEGER NOT NULL DEFAULT 30000,
        created_at DATETIME DEFAULT (datetime('now')),
        updated_at DATETIME DEFAULT (datetime('now'))
      );
      CREATE TABLE IF NOT EXISTS fascicoli (
        id               INTEGER PRIMARY KEY AUTOINCREMENT,
        titolo           TEXT NOT NULL,
        descrizione      TEXT,
        stato            TEXT NOT NULL DEFAULT 'bozza'
                         CHECK (stato IN ('bozza','inviato','errore')),
        codice_documento TEXT,
        esito_risposta   TEXT,
        data_creazione   DATETIME NOT NULL DEFAULT (datetime('now')),
        data_invio       DATETIME
      );
      CREATE INDEX IF NOT EXISTS idx_fascicoli_stato ON fascicoli (stato);
      CREATE TABLE IF NOT EXISTS foto (
        id               INTEGER PRIMARY KEY AUTOINCREMENT,
        fascicolo_id     INTEGER NOT NULL
                         REFERENCES fascicoli(id) ON DELETE CASCADE,
        percorso_locale  TEXT NOT NULL,
        nome_file        TEXT NOT NULL DEFAULT '',
        dimensione_bytes INTEGER,
        data_scatto      DATETIME,
        ordinamento      INTEGER NOT NULL DEFAULT 0
      );
      CREATE INDEX IF NOT EXISTS idx_foto_fascicolo_ord
        ON foto (fascicolo_id, ordinamento)
    `,
  },
];

async function getCurrentVersion(db: SQLite.SQLiteDatabase): Promise<number> {
  try {
    const row = await db.getFirstAsync<{ max_version: number | null }>(
      'SELECT MAX(version) as max_version FROM _migrations'
    );
    return row?.max_version ?? 0;
  } catch {
    return 0;
  }
}

async function applyMigration(
  db: SQLite.SQLiteDatabase,
  migration: DbMigration
): Promise<void> {
  await db.withTransactionAsync(async () => {
    const statements = migration.sql
      .split(';')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    for (const stmt of statements) {
      await db.execAsync(stmt + ';');
    }

    await db.runAsync(
      'INSERT INTO _migrations (version, description) VALUES (?, ?)',
      [migration.version, migration.description]
    );
  });
}

async function runPendingMigrations(
  db: SQLite.SQLiteDatabase,
  currentVersion: number
): Promise<void> {
  const pending = MIGRATIONS
    .filter((m) => m.version > currentVersion)
    .sort((a, b) => a.version - b.version);

  if (pending.length === 0) {
    console.log('[db] Nessuna migration pendente.');
    return;
  }

  for (const migration of pending) {
    console.log(`[db] Migration v${migration.version}...`);
    try {
      await applyMigration(db, migration);
      console.log(`[db] Migration v${migration.version} OK.`);
    } catch (err) {
      throw new Error(
        `Migration v${migration.version} fallita: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }
}

export async function initDatabase(): Promise<void> {
  if (_db) return;
  try {
    _db = await SQLite.openDatabaseAsync(DB_NAME);
    await _db.execAsync('PRAGMA journal_mode = WAL;');
    await _db.execAsync('PRAGMA foreign_keys = ON;');
    const ver = await getCurrentVersion(_db);
    console.log(`[db] Schema v${ver} → target v${DB_VERSION}`);
    await runPendingMigrations(_db, ver);
    console.log('[db] Pronto.');
  } catch (err) {
    _db = null;
    throw err;
  }
}

export async function closeDatabase(): Promise<void> {
  if (_db) {
    await _db.closeAsync();
    _db = null;
  }
}

export async function resetDatabase(): Promise<void> {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('[db] resetDatabase() non disponibile in produzione.');
  }
  await closeDatabase();
  await SQLite.deleteDatabaseAsync(DB_NAME);
}
