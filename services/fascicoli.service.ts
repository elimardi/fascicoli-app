/**
 * @file services/fascicoli.service.ts
 * CRUD completo per i fascicoli fotografici.
 * Tutte le operazioni leggono/scrivono sulla tabella `fascicoli`
 * tramite l'istanza singleton del database (getDb).
 */

import { getDb } from './db';
import type {
  Fascicolo,
  FascicoloRow,
  CreaFascicoloDTO,
  AggiorneFascicoloDTO,
  StatoFascicolo,
} from '@/types';

// ─────────────────────────────────────────────
// MAPPING — row raw → tipo dominio
// ─────────────────────────────────────────────

/**
 * Converte una riga raw SQLite in un oggetto `Fascicolo` tipizzato.
 * Esegue il cast esplicito di `stato` al tipo union `StatoFascicolo`.
 *
 * @param row - Riga grezza da expo-sqlite
 * @returns   Oggetto `Fascicolo` del dominio
 */
function rowToFascicolo(row: FascicoloRow): Fascicolo {
  return {
    id:               row.id,
    titolo:           row.titolo,
    descrizione:      row.descrizione,
    stato:            row.stato as StatoFascicolo,
    codice_documento: row.codice_documento,
    esito_risposta:   row.esito_risposta,
    data_creazione:   row.data_creazione,
    data_invio:       row.data_invio,
  };
}

// ─────────────────────────────────────────────
// TIPO ESTESO — fascicolo con conteggio foto
// ─────────────────────────────────────────────

/**
 * Fascicolo arricchito con il conteggio delle foto associate.
 * Usato nella schermata lista per le card.
 */
export interface FascicoloConFoto extends Fascicolo {
  numero_foto: number;
}

/** Riga raw con il campo aggiuntivo `numero_foto` */
interface FascicoloConFotoRow extends FascicoloRow {
  numero_foto: number;
}

// ─────────────────────────────────────────────
// READ
// ─────────────────────────────────────────────

/**
 * Recupera tutti i fascicoli ordinati per data di creazione decrescente,
 * arricchiti con il conteggio delle foto associate.
 * Usato dalla schermata lista principale.
 *
 * @returns Promise con array di `FascicoloConFoto`
 * @throws  Error in caso di errore SQLite
 *
 * @example
 * const fascicoli = await getAllFascicoli();
 * // [{ id: 3, titolo: '...', numero_foto: 5, ... }, ...]
 */
export async function getAllFascicoli(): Promise<FascicoloConFoto[]> {
  try {
    const db = getDb();
    const rows = await db.getAllAsync<FascicoloConFotoRow>(
      `SELECT
         f.*,
         COUNT(p.id) AS numero_foto
       FROM fascicoli f
       LEFT JOIN foto p ON p.fascicolo_id = f.id
       GROUP BY f.id
       ORDER BY f.data_creazione DESC`
    );
    return rows.map((row) => ({
      ...rowToFascicolo(row),
      numero_foto: row.numero_foto,
    }));
  } catch (error) {
    console.error('[fascicoli.service] Errore getAllFascicoli:', error);
    throw new Error(
      `Impossibile recuperare i fascicoli: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}

/**
 * Recupera un singolo fascicolo tramite il suo ID.
 * Restituisce `null` se non esiste.
 *
 * @param id - ID del fascicolo
 * @returns   Promise con il `Fascicolo` o `null`
 * @throws    Error in caso di errore SQLite
 *
 * @example
 * const fascicolo = await getFascicoloById(42);
 * if (!fascicolo) { /* non trovato *\/ }
 */
export async function getFascicoloById(id: number): Promise<Fascicolo | null> {
  try {
    const db = getDb();
    const row = await db.getFirstAsync<FascicoloRow>(
      'SELECT * FROM fascicoli WHERE id = ?',
      id
    );
    return row ? rowToFascicolo(row) : null;
  } catch (error) {
    console.error('[fascicoli.service] Errore getFascicoloById:', error);
    throw new Error(
      `Impossibile recuperare il fascicolo ${id}: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}

/**
 * Recupera i fascicoli filtrati per stato.
 *
 * @param stato - Stato da filtrare ('bozza' | 'inviato' | 'errore')
 * @returns      Promise con array di `Fascicolo`
 * @throws       Error in caso di errore SQLite
 */
export async function getFascicoliByStato(
  stato: StatoFascicolo
): Promise<Fascicolo[]> {
  try {
    const db = getDb();
    const rows = await db.getAllAsync<FascicoloRow>(
      `SELECT * FROM fascicoli
       WHERE stato = ?
       ORDER BY data_creazione DESC`,
      stato
    );
    return rows.map(rowToFascicolo);
  } catch (error) {
    console.error('[fascicoli.service] Errore getFascicoliByStato:', error);
    throw new Error(
      `Impossibile filtrare i fascicoli per stato "${stato}": ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}

// ─────────────────────────────────────────────
// CREATE
// ─────────────────────────────────────────────

/**
 * Crea un nuovo fascicolo con stato iniziale `bozza`.
 * Restituisce il fascicolo completo appena creato, incluso l'ID generato.
 *
 * @param dto - Dati del nuovo fascicolo (titolo obbligatorio, descrizione opzionale)
 * @returns   Promise con il `Fascicolo` creato
 * @throws    Error se il titolo è vuoto o in caso di errore SQLite
 *
 * @example
 * const fascicolo = await creaFascicolo({ titolo: 'Sopralluogo via Roma' });
 * router.push(`/fascicolo/${fascicolo.id}`);
 */
export async function creaFascicolo(dto: CreaFascicoloDTO): Promise<Fascicolo> {
  const validationError = validateCreaDTO(dto);
  if (validationError) {
    throw new Error(validationError);
  }

  try {
    const db = getDb();
    const result = await db.runAsync(
      `INSERT INTO fascicoli (titolo, descrizione, stato, data_creazione)
       VALUES (?, ?, 'bozza', datetime('now'))`,
      dto.titolo.trim(),
      dto.descrizione?.trim() ?? null
    );

    const created = await getFascicoloById(result.lastInsertRowId);
    if (!created) {
      throw new Error('Fascicolo inserito ma non recuperabile — stato inconsistente.');
    }

    return created;
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('Fascicolo')) {
      throw error;
    }
    console.error('[fascicoli.service] Errore creaFascicolo:', error);
    throw new Error(
      `Impossibile creare il fascicolo: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}

// ─────────────────────────────────────────────
// UPDATE
// ─────────────────────────────────────────────

/**
 * Aggiorna i campi di un fascicolo esistente.
 * Aggiorna solo i campi presenti nel DTO (partial update).
 * Restituisce il fascicolo aggiornato.
 *
 * @param id  - ID del fascicolo da aggiornare
 * @param dto - Campi da aggiornare (tutti opzionali)
 * @returns   Promise con il `Fascicolo` aggiornato
 * @throws    Error se il fascicolo non esiste o in caso di errore SQLite
 *
 * @example
 * await aggoirnaFascicolo(42, { stato: 'inviato', data_invio: new Date().toISOString() });
 */
export async function aggiornFascicolo(
  id: number,
  dto: AggiorneFascicoloDTO
): Promise<Fascicolo> {
  try {
    const db = getDb();

    // Costruisce dinamicamente la SET clause con solo i campi presenti
    const fields: string[] = [];
    const values: (string | number | null)[] = [];

    if (dto.titolo !== undefined) {
      fields.push('titolo = ?');
      values.push(dto.titolo.trim());
    }
    if (dto.descrizione !== undefined) {
      fields.push('descrizione = ?');
      values.push(dto.descrizione?.trim() ?? null);
    }
    if (dto.stato !== undefined) {
      fields.push('stato = ?');
      values.push(dto.stato);
    }
    if (dto.codice_documento !== undefined) {
      fields.push('codice_documento = ?');
      values.push(dto.codice_documento?.trim() ?? null);
    }
    if (dto.esito_risposta !== undefined) {
      fields.push('esito_risposta = ?');
      values.push(dto.esito_risposta);
    }
    if (dto.data_invio !== undefined) {
      fields.push('data_invio = ?');
      values.push(dto.data_invio);
    }

    if (fields.length === 0) {
      // Nessun campo da aggiornare: restituisce il fascicolo invariato
      const existing = await getFascicoloById(id);
      if (!existing) throw new Error(`Fascicolo ${id} non trovato.`);
      return existing;
    }

    values.push(id); // WHERE id = ?
    await db.runAsync(
      `UPDATE fascicoli SET ${fields.join(', ')} WHERE id = ?`,
      ...values
    );

    const updated = await getFascicoloById(id);
    if (!updated) {
      throw new Error(`Fascicolo ${id} non trovato dopo l'aggiornamento.`);
    }

    return updated;
  } catch (error) {
    console.error('[fascicoli.service] Errore aggiornFascicolo:', error);
    throw new Error(
      `Impossibile aggiornare il fascicolo ${id}: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}

/**
 * Imposta il fascicolo come `inviato`, salvando la risposta JSON
 * del webservice e la data di invio.
 * Shortcut per `aggiornFascicolo` con i campi tipici post-invio.
 *
 * @param id           - ID del fascicolo
 * @param esitoJson    - Risposta JSON serializzata del webservice
 * @returns            Promise con il `Fascicolo` aggiornato
 */
export async function segnaFascicoloInviato(
  id: number,
  esitoJson: string
): Promise<Fascicolo> {
  return aggiornFascicolo(id, {
    stato:          'inviato',
    esito_risposta: esitoJson,
    data_invio:     new Date().toISOString(),
  });
}

/**
 * Imposta il fascicolo come `errore`, salvando il messaggio di errore.
 *
 * @param id           - ID del fascicolo
 * @param esitoJson    - Messaggio/JSON di errore serializzato
 * @returns            Promise con il `Fascicolo` aggiornato
 */
export async function segnaFascicoloErrore(
  id: number,
  esitoJson: string
): Promise<Fascicolo> {
  return aggiornFascicolo(id, {
    stato:          'errore',
    esito_risposta: esitoJson,
    data_invio:     new Date().toISOString(),
  });
}

// ─────────────────────────────────────────────
// DELETE
// ─────────────────────────────────────────────

/**
 * Elimina un fascicolo dal database.
 * Grazie al `ON DELETE CASCADE` sulle foto, tutte le righe
 * associate nella tabella `foto` vengono eliminate automaticamente.
 * I file fisici devono essere eliminati separatamente tramite
 * `foto.service.ts` prima di chiamare questa funzione.
 *
 * @param id - ID del fascicolo da eliminare
 * @throws   Error se il fascicolo non esiste o in caso di errore SQLite
 *
 * @example
 * // Prima elimina i file fisici
 * await eliminaFileFotoDiFascicolo(fascicoloId);
 * // Poi elimina il record DB (CASCADE sulle foto)
 * await eliminaFascicolo(fascicoloId);
 */
export async function eliminaFascicolo(id: number): Promise<void> {
  try {
    const db = getDb();
    const result = await db.runAsync(
      'DELETE FROM fascicoli WHERE id = ?',
      id
    );

    if (result.changes === 0) {
      throw new Error(`Fascicolo ${id} non trovato.`);
    }
  } catch (error) {
    console.error('[fascicoli.service] Errore eliminaFascicolo:', error);
    throw new Error(
      `Impossibile eliminare il fascicolo ${id}: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}

// ─────────────────────────────────────────────
// STATISTICHE
// ─────────────────────────────────────────────

/**
 * Restituisce il conteggio dei fascicoli per ciascuno stato.
 * Usato dalla schermata lista per eventuali badge/summary.
 *
 * @returns Promise con i conteggi per stato
 */
export async function getConteggiPerStato(): Promise<
  Record<StatoFascicolo, number>
> {
  try {
    const db = getDb();
    const rows = await db.getAllAsync<{ stato: string; count: number }>(
      `SELECT stato, COUNT(*) as count
       FROM fascicoli
       GROUP BY stato`
    );

    const result: Record<StatoFascicolo, number> = {
      bozza:   0,
      inviato: 0,
      errore:  0,
    };

    for (const row of rows) {
      if (row.stato === 'bozza' || row.stato === 'inviato' || row.stato === 'errore') {
        result[row.stato] = row.count;
      }
    }

    return result;
  } catch (error) {
    console.error('[fascicoli.service] Errore getConteggiPerStato:', error);
    throw new Error(
      `Impossibile recuperare i conteggi: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}

// ─────────────────────────────────────────────
// VALIDAZIONE
// ─────────────────────────────────────────────

/**
 * Valida un `CreaFascicoloDTO`.
 * Restituisce una stringa di errore leggibile, o `null` se valido.
 *
 * @param dto - DTO da validare
 * @returns   Messaggio di errore o `null`
 */
export function validateCreaDTO(dto: CreaFascicoloDTO): string | null {
  if (!dto.titolo || dto.titolo.trim().length === 0) {
    return 'Il titolo del fascicolo è obbligatorio.';
  }
  if (dto.titolo.trim().length > 200) {
    return 'Il titolo non può superare i 200 caratteri.';
  }
  if (dto.descrizione && dto.descrizione.trim().length > 1000) {
    return 'La descrizione non può superare i 1000 caratteri.';
  }
  return null;
}

/**
 * Valida il codice documento prima dell'invio al webservice.
 * Restituisce una stringa di errore leggibile, o `null` se valido.
 *
 * @param codice - Codice documento inserito dall'utente
 * @returns       Messaggio di errore o `null`
 */
export function validateCodiceDocumento(codice: string): string | null {
  if (!codice || codice.trim().length === 0) {
    return 'Il codice documento è obbligatorio per l\'invio.';
  }
  if (codice.trim().length > 100) {
    return 'Il codice documento non può superare i 100 caratteri.';
  }
  return null;
}
