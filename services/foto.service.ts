/**
 * @file services/foto.service.ts
 * Gestione foto con la NUOVA API expo-file-system (SDK 54+)
 * Corretta costruzione del percorso per Directory e File.
 */

import { File, Directory, Paths } from 'expo-file-system';
import { getDb } from './db';
import { FOTO_DIRECTORY } from '@/constants';
import type { Foto, FotoRow, CreaFotoDTO } from '@/types';

// ─────────────────────────────────────────────
// MAPPING
// ─────────────────────────────────────────────

function rowToFoto(row: FotoRow): Foto {
  return {
    id:               row.id,
    fascicolo_id:     row.fascicolo_id,
    percorso_locale:  row.percorso_locale,
    nome_file:        row.nome_file,
    dimensione_bytes: row.dimensione_bytes,
    data_scatto:      row.data_scatto,
    ordinamento:      row.ordinamento,
  };
}

// ─────────────────────────────────────────────
// DIRECTORY HELPERS (nuova API corretta)
// ─────────────────────────────────────────────

/**
 * Restituisce (e crea se necessario) la directory per le foto di un fascicolo.
 */
async function getOrCreateFotoDirectory(fascicoloId: number): Promise<Directory> {
  // Costruzione corretta del percorso: prima Paths.document, poi le sottocartelle come argomenti separati
  const dir = new Directory(Paths.document, FOTO_DIRECTORY, String(fascicoloId));

  // Crea la directory (e tutte le parenti se necessario)
  if (!dir.exists) {
    dir.create({ intermediates: true });
  }

  return dir;
}

/**
 * Genera nome file univoco.
 */
function generaNomeFile(): string {
  const ts = Date.now();
  const rand = Math.floor(Math.random() * 9000 + 1000);
  return `foto_${ts}_${rand}.jpg`;
}

// ─────────────────────────────────────────────
// COPIA FOTO
// ─────────────────────────────────────────────

/**
 * Copia una foto temporanea nella directory permanente del fascicolo.
 */
export async function copiaFotoInDirectory(
  percorsoSorgente: string,
  fascicoloId: number
): Promise<{ percorso: string; dimensione_bytes: number; nome_file: string }> {
  const dir = await getOrCreateFotoDirectory(fascicoloId);
  const nomeFile = generaNomeFile();

  // Crea l'oggetto File nella directory
  const destinazione = new File(dir, nomeFile);   // <-- modo corretto: passa Directory + nome file

  const srcFile = new File(percorsoSorgente);

  // Copia il file
  srcFile.copy(destinazione);

  // Ottieni dimensione
  const info = await destinazione.info();

  return {
    percorso:        destinazione.uri,
    dimensione_bytes: info.size ?? 0,
    nome_file:        nomeFile,
  };
}

// ─────────────────────────────────────────────
// ELIMINAZIONE
// ─────────────────────────────────────────────

export async function eliminaFileFisico(percorso: string): Promise<void> {
  try {
    const file = new File(percorso);
    file.delete();
  } catch (error) {
    console.warn('[foto.service] Impossibile eliminare file:', percorso, error);
  }
}

export async function eliminaDirectoryFascicolo(fascicoloId: number): Promise<void> {
  try {
    const dir = new Directory(Paths.document, FOTO_DIRECTORY, String(fascicoloId));
    dir.delete();
  } catch (error) {
    console.warn('[foto.service] Impossibile eliminare directory fascicolo:', error);
  }
}

// ─────────────────────────────────────────────
// READ (invariate)
// ─────────────────────────────────────────────

export async function getFotoByFascicolo(fascicoloId: number): Promise<Foto[]> {
  const db = getDb();
  const rows = await db.getAllAsync<FotoRow>(
    `SELECT * FROM foto WHERE fascicolo_id = ? ORDER BY ordinamento ASC`,
    fascicoloId
  );
  return rows.map(rowToFoto);
}

export async function getFotoById(id: number): Promise<Foto | null> {
  const db = getDb();
  const row = await db.getFirstAsync<FotoRow>('SELECT * FROM foto WHERE id = ?', id);
  return row ? rowToFoto(row) : null;
}

export async function contaFoto(fascicoloId: number): Promise<number> {
  const db = getDb();
  const row = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM foto WHERE fascicolo_id = ?',
    fascicoloId
  );
  return row?.count ?? 0;
}

// ─────────────────────────────────────────────
// CREATE FOTO
// ─────────────────────────────────────────────

export async function aggiungiFoto(
  fascicoloId: number,
  percorsoTemp: string,
  dataScatto?: string
): Promise<Foto> {
  const db = getDb();

  // Prossimo ordinamento
  const maxOrd = await db.getFirstAsync<{ max_ord: number | null }>(
    'SELECT MAX(ordinamento) as max_ord FROM foto WHERE fascicolo_id = ?',
    fascicoloId
  );
  const nextOrdinamento = (maxOrd?.max_ord ?? -1) + 1;

  // Copia file
  const { percorso, dimensione_bytes, nome_file } = await copiaFotoInDirectory(
    percorsoTemp,
    fascicoloId
  );

  // Inserisci nel DB
  const dto: CreaFotoDTO = {
    fascicolo_id:    fascicoloId,
    percorso_locale: percorso,
    nome_file,
    dimensione_bytes,
    data_scatto:     dataScatto ?? new Date().toISOString(),
    ordinamento:     nextOrdinamento,
  };

  const result = await db.runAsync(
    `INSERT INTO foto (fascicolo_id, percorso_locale, nome_file, dimensione_bytes, data_scatto, ordinamento)
     VALUES (?, ?, ?, ?, ?, ?)`,
    dto.fascicolo_id,
    dto.percorso_locale,
    dto.nome_file,
    dto.dimensione_bytes ?? null,
    dto.data_scatto ?? null,
    dto.ordinamento
  );

  const created = await getFotoById(result.lastInsertRowId);
  if (!created) throw new Error('Foto inserita ma non recuperabile.');

  return created;
}

// ─────────────────────────────────────────────
// DELETE + RIORDINAMENTO (invariati)
// ─────────────────────────────────────────────

export async function eliminaFoto(fotoId: number): Promise<void> {
  const db = getDb();
  const foto = await getFotoById(fotoId);
  if (!foto) throw new Error(`Foto ${fotoId} non trovata.`);

  await eliminaFileFisico(foto.percorso_locale);
  await db.runAsync('DELETE FROM foto WHERE id = ?', fotoId);
  await normalizzaOrdinamento(foto.fascicolo_id);
}

export async function aggiornOrdinamento(
  fascicoloId: number,
  fotoOrdinate: Foto[]
): Promise<void> {
  const db = getDb();
  await db.withTransactionAsync(async () => {
    for (let i = 0; i < fotoOrdinate.length; i++) {
      await db.runAsync(
        'UPDATE foto SET ordinamento = ? WHERE id = ? AND fascicolo_id = ?',
        i,
        fotoOrdinate[i].id,
        fascicoloId
      );
    }
  });
}

async function normalizzaOrdinamento(fascicoloId: number): Promise<void> {
  const db = getDb();
  const rows = await db.getAllAsync<{ id: number }>(
    'SELECT id FROM foto WHERE fascicolo_id = ? ORDER BY ordinamento ASC',
    fascicoloId
  );

  await db.withTransactionAsync(async () => {
    for (let i = 0; i < rows.length; i++) {
      await db.runAsync('UPDATE foto SET ordinamento = ? WHERE id = ?', i, rows[i].id);
    }
  });
}

// ─────────────────────────────────────────────
// EXPORT
// ─────────────────────────────────────────────

export { FOTO_QUALITY, FOTO_MAX_SIZE } from '@/constants';