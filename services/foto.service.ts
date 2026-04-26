/**
 * @file services/foto.service.ts
 * Gestione completa delle foto: operazioni CRUD su SQLite
 * e gestione dei file fisici tramite expo-file-system.
 *
 * Struttura directory permanente:
 *   {documentDirectory}/fascicoli_foto/{fascicoloId}/{nomeFile}
 *
 * Le foto vengono sempre copiate dalla posizione temporanea
 * (cache camera / image picker) alla directory permanente prima
 * di essere registrate nel database.
 */

import * as FileSystem from 'expo-file-system';
import { getDb } from './db';
import { FOTO_DIRECTORY, FOTO_QUALITY, FOTO_MAX_SIZE } from '@/constants';
import type { Foto, FotoRow, CreaFotoDTO } from '@/types';

// ─────────────────────────────────────────────
// MAPPING — row raw → tipo dominio
// ─────────────────────────────────────────────

/**
 * Converte una riga raw SQLite in un oggetto `Foto` tipizzato.
 *
 * @param row - Riga grezza da expo-sqlite
 * @returns   Oggetto `Foto` del dominio
 */
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
// FILESYSTEM HELPERS
// ─────────────────────────────────────────────

/**
 * Restituisce il percorso della directory permanente per le foto
 * di un fascicolo specifico.
 * La directory viene creata se non esiste già.
 *
 * @param fascicoloId - ID del fascicolo proprietario
 * @returns           Percorso assoluto della directory
 */
export async function getOrCreateFotoDirectory(
  fascicoloId: number
): Promise<string> {
  const baseDir = `${FileSystem.documentDirectory}${FOTO_DIRECTORY}/${fascicoloId}/`;

  const info = await FileSystem.getInfoAsync(baseDir);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(baseDir, { intermediates: true });
  }

  return baseDir;
}

/**
 * Genera un nome file univoco per una nuova foto.
 * Formato: `foto_{timestamp}_{random4}.jpg`
 *
 * @returns Nome file univoco con estensione .jpg
 */
function generaNomeFile(): string {
  const ts = Date.now();
  const rand = Math.floor(Math.random() * 9000 + 1000);
  return `foto_${ts}_${rand}.jpg`;
}

/**
 * Copia un file dalla posizione sorgente (temporanea) alla
 * directory permanente del fascicolo.
 * Restituisce il percorso permanente e la dimensione in bytes.
 *
 * @param percorsoSorgente - URI del file temporaneo (camera/picker)
 * @param fascicoloId      - ID del fascicolo di destinazione
 * @returns                Oggetto con `percorso` e `dimensione_bytes`
 * @throws                 Error se la copia fallisce
 */
export async function copiaFotoInDirectory(
  percorsoSorgente: string,
  fascicoloId: number
): Promise<{ percorso: string; dimensione_bytes: number; nome_file: string }> {
  const dir = await getOrCreateFotoDirectory(fascicoloId);
  const nomeFile = generaNomeFile();
  const percorsoDest = `${dir}${nomeFile}`;

  try {
    await FileSystem.copyAsync({
      from: percorsoSorgente,
      to:   percorsoDest,
    });

    // Legge la dimensione del file appena copiato
    const info = await FileSystem.getInfoAsync(percorsoDest, { size: true });
    const dimensione = info.exists && 'size' in info ? (info.size ?? 0) : 0;

    return {
      percorso:        percorsoDest,
      dimensione_bytes: dimensione,
      nome_file:        nomeFile,
    };
  } catch (error) {
    // Pulizia: se la copia è parzialmente riuscita, elimina il file
    try {
      await FileSystem.deleteAsync(percorsoDest, { idempotent: true });
    } catch {
      // Ignora errori di cleanup
    }
    throw new Error(
      `Impossibile copiare la foto: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}

/**
 * Elimina fisicamente un file foto dal filesystem.
 * Usa `idempotent: true` per non lanciare errori se il file
 * non esiste già (es. cancellazione parziale precedente).
 *
 * @param percorso - Percorso assoluto del file da eliminare
 */
export async function eliminaFileFisico(percorso: string): Promise<void> {
  try {
    await FileSystem.deleteAsync(percorso, { idempotent: true });
  } catch (error) {
    // Log ma non rilancia: un file mancante non deve bloccare
    // l'eliminazione del record DB
    console.warn('[foto.service] Impossibile eliminare file fisico:', percorso, error);
  }
}

/**
 * Elimina tutti i file fisici delle foto di un fascicolo
 * e la directory contenitore.
 * Chiamata prima di `eliminaFascicolo()` per pulizia completa.
 *
 * @param fascicoloId - ID del fascicolo di cui eliminare i file
 */
export async function eliminaDirectoryFascicolo(
  fascicoloId: number
): Promise<void> {
  const dir = `${FileSystem.documentDirectory}${FOTO_DIRECTORY}/${fascicoloId}/`;
  try {
    await FileSystem.deleteAsync(dir, { idempotent: true });
  } catch (error) {
    console.warn(
      '[foto.service] Impossibile eliminare directory fascicolo:',
      dir,
      error
    );
  }
}

/**
 * Elimina tutti i file fisici delle foto di un fascicolo
 * leggendo i percorsi dal database prima della cancellazione.
 * Usato in combinazione con `eliminaFascicolo()`.
 *
 * @param fascicoloId - ID del fascicolo
 */
export async function eliminaFileFotoDiFascicolo(
  fascicoloId: number
): Promise<void> {
  try {
    // Usa la directory intera per pulizia più affidabile
    await eliminaDirectoryFascicolo(fascicoloId);
  } catch (error) {
    console.warn('[foto.service] Errore eliminazione file fascicolo:', error);
  }
}

// ─────────────────────────────────────────────
// READ
// ─────────────────────────────────────────────

/**
 * Recupera tutte le foto di un fascicolo, ordinate per il campo
 * `ordinamento` crescente (rispecchia l'ordine drag-and-drop).
 *
 * @param fascicoloId - ID del fascicolo
 * @returns           Promise con array di `Foto` ordinato
 * @throws            Error in caso di errore SQLite
 *
 * @example
 * const foto = await getFotoByFascicolo(42);
 * // [{ id: 1, ordinamento: 0, ... }, { id: 3, ordinamento: 1, ... }]
 */
export async function getFotoByFascicolo(fascicoloId: number): Promise<Foto[]> {
  try {
    const db = getDb();
    const rows = await db.getAllAsync<FotoRow>(
      `SELECT * FROM foto
       WHERE fascicolo_id = ?
       ORDER BY ordinamento ASC`,
      fascicoloId
    );
    return rows.map(rowToFoto);
  } catch (error) {
    console.error('[foto.service] Errore getFotoByFascicolo:', error);
    throw new Error(
      `Impossibile recuperare le foto del fascicolo ${fascicoloId}: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}

/**
 * Recupera una singola foto tramite ID.
 * Restituisce `null` se non esiste.
 *
 * @param id - ID della foto
 * @returns   Promise con la `Foto` o `null`
 */
export async function getFotoById(id: number): Promise<Foto | null> {
  try {
    const db = getDb();
    const row = await db.getFirstAsync<FotoRow>(
      'SELECT * FROM foto WHERE id = ?',
      id
    );
    return row ? rowToFoto(row) : null;
  } catch (error) {
    console.error('[foto.service] Errore getFotoById:', error);
    throw new Error(
      `Impossibile recuperare la foto ${id}: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}

/**
 * Restituisce il conteggio delle foto associate a un fascicolo.
 *
 * @param fascicoloId - ID del fascicolo
 * @returns           Promise con il numero di foto
 */
export async function contaFoto(fascicoloId: number): Promise<number> {
  try {
    const db = getDb();
    const row = await db.getFirstAsync<{ count: number }>(
      'SELECT COUNT(*) as count FROM foto WHERE fascicolo_id = ?',
      fascicoloId
    );
    return row?.count ?? 0;
  } catch (error) {
    console.error('[foto.service] Errore contaFoto:', error);
    throw new Error(
      `Impossibile contare le foto: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}

// ─────────────────────────────────────────────
// CREATE
// ─────────────────────────────────────────────

/**
 * Aggiunge una nuova foto a un fascicolo.
 * Copia il file dalla posizione temporanea alla directory
 * permanente, poi registra il record in SQLite.
 *
 * @param fascicoloId      - ID del fascicolo di destinazione
 * @param percorsoTemp     - URI temporaneo della foto (camera/picker)
 * @param dataScatto       - Data/ora dello scatto (ISO 8601), opzionale
 * @returns                Promise con la `Foto` creata
 * @throws                 Error se la copia o l'inserimento falliscono
 *
 * @example
 * const foto = await aggiungiFoto(
 *   42,
 *   result.assets[0].uri,
 *   new Date().toISOString()
 * );
 */
export async function aggiungiFoto(
  fascicoloId: number,
  percorsoTemp: string,
  dataScatto?: string
): Promise<Foto> {
  // 1. Determina il prossimo valore di ordinamento
  const db = getDb();
  const maxOrd = await db.getFirstAsync<{ max_ord: number | null }>(
    'SELECT MAX(ordinamento) as max_ord FROM foto WHERE fascicolo_id = ?',
    fascicoloId
  );
  const nextOrdinamento = (maxOrd?.max_ord ?? -1) + 1;

  // 2. Copia il file nella directory permanente
  const { percorso, dimensione_bytes, nome_file } =
    await copiaFotoInDirectory(percorsoTemp, fascicoloId);

  // 3. Inserisce il record nel database
  try {
    const dto: CreaFotoDTO = {
      fascicolo_id:    fascicoloId,
      percorso_locale: percorso,
      nome_file,
      dimensione_bytes,
      data_scatto:     dataScatto ?? new Date().toISOString(),
      ordinamento:     nextOrdinamento,
    };

    const result = await db.runAsync(
      `INSERT INTO foto
         (fascicolo_id, percorso_locale, nome_file, dimensione_bytes, data_scatto, ordinamento)
       VALUES (?, ?, ?, ?, ?, ?)`,
      dto.fascicolo_id,
      dto.percorso_locale,
      dto.nome_file,
      dto.dimensione_bytes ?? null,
      dto.data_scatto ?? null,
      dto.ordinamento
    );

    const created = await getFotoById(result.lastInsertRowId);
    if (!created) {
      throw new Error('Foto inserita ma non recuperabile — stato inconsistente.');
    }

    return created;
  } catch (error) {
    // Se l'inserimento DB fallisce, elimina il file già copiato
    await eliminaFileFisico(percorso);
    console.error('[foto.service] Errore aggiungiFoto:', error);
    throw new Error(
      `Impossibile aggiungere la foto: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}

// ─────────────────────────────────────────────
// DELETE
// ─────────────────────────────────────────────

/**
 * Elimina una foto: prima il file fisico, poi il record SQLite.
 * Se il file fisico non esiste, procede comunque con l'eliminazione DB.
 *
 * @param fotoId - ID della foto da eliminare
 * @throws       Error se la foto non esiste nel DB
 *
 * @example
 * await eliminaFoto(foto.id);
 */
export async function eliminaFoto(fotoId: number): Promise<void> {
  try {
    const db = getDb();

    // Recupera il percorso prima di eliminare il record
    const foto = await getFotoById(fotoId);
    if (!foto) {
      throw new Error(`Foto ${fotoId} non trovata.`);
    }

    // Elimina il file fisico (idempotente)
    await eliminaFileFisico(foto.percorso_locale);

    // Elimina il record dal database
    await db.runAsync('DELETE FROM foto WHERE id = ?', fotoId);

    // Ricalcola ordinamento per evitare gap nella sequenza
    await normalizzaOrdinamento(foto.fascicolo_id);
  } catch (error) {
    console.error('[foto.service] Errore eliminaFoto:', error);
    throw new Error(
      `Impossibile eliminare la foto ${fotoId}: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}

// ─────────────────────────────────────────────
// RIORDINAMENTO
// ─────────────────────────────────────────────

/**
 * Aggiorna l'ordinamento di tutte le foto di un fascicolo
 * in base all'array ricevuto (tipicamente dopo drag-and-drop).
 * Usa una transazione per garantire l'atomicità dell'operazione.
 *
 * @param fascicoloId - ID del fascicolo
 * @param fotoOrdinate - Array di foto nell'ordine desiderato
 * @throws             Error in caso di errore SQLite
 *
 * @example
 * // Dopo il drag-and-drop nel componente FotoGrid:
 * await aggiornOrdinamento(42, fotosRiordinate);
 */
export async function aggiornOrdinamento(
  fascicoloId: number,
  fotoOrdinate: Foto[]
): Promise<void> {
  try {
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
  } catch (error) {
    console.error('[foto.service] Errore aggiornOrdinamento:', error);
    throw new Error(
      `Impossibile aggiornare l'ordinamento: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}

/**
 * Ricalcola i valori di ordinamento per eliminare gap
 * (es. dopo la cancellazione di una foto intermedia).
 * Le foto vengono riassegnate con valori 0, 1, 2, ...
 *
 * @param fascicoloId - ID del fascicolo da normalizzare
 */
async function normalizzaOrdinamento(fascicoloId: number): Promise<void> {
  try {
    const db = getDb();
    const rows = await db.getAllAsync<{ id: number }>(
      'SELECT id FROM foto WHERE fascicolo_id = ? ORDER BY ordinamento ASC',
      fascicoloId
    );

    await db.withTransactionAsync(async () => {
      for (let i = 0; i < rows.length; i++) {
        await db.runAsync(
          'UPDATE foto SET ordinamento = ? WHERE id = ?',
          i,
          rows[i].id
        );
      }
    });
  } catch (error) {
    // Non critico: un gap nell'ordinamento non rompe la UI
    console.warn('[foto.service] Errore normalizzaOrdinamento:', error);
  }
}

// ─────────────────────────────────────────────
// VERIFICA INTEGRITÀ
// ─────────────────────────────────────────────

/**
 * Verifica che tutti i file fisici referenziati nel DB esistano
 * ancora nel filesystem. Restituisce le foto con file mancante.
 * Utile per debug e recovery dopo crash.
 *
 * @param fascicoloId - ID del fascicolo da verificare
 * @returns           Array di foto con file mancante
 */
export async function verificaIntegritaFile(
  fascicoloId: number
): Promise<Foto[]> {
  const foto = await getFotoByFascicolo(fascicoloId);
  const mancanti: Foto[] = [];

  for (const f of foto) {
    const info = await FileSystem.getInfoAsync(f.percorso_locale);
    if (!info.exists) {
      mancanti.push(f);
    }
  }

  return mancanti;
}

// ─────────────────────────────────────────────
// EXPORT COSTANTI UTILI
// ─────────────────────────────────────────────

/** Qualità JPEG usata per le foto (re-export per i componenti camera) */
export { FOTO_QUALITY, FOTO_MAX_SIZE };
