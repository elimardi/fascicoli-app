/**
 * @file services/config.service.ts
 * Gestione della configurazione del webservice esterno.
 * La tabella `config_webservice` contiene sempre al massimo una riga (id = 1).
 * Tutte le operazioni usano UPSERT per garantire questa invariante.
 */

import { getDb } from './db';
import type { ConfigWebservice, ConfigWebserviceDTO, ConfigRow } from '@/types';

// ─────────────────────────────────────────────
// MAPPING — row raw → tipo dominio
// ─────────────────────────────────────────────

/**
 * Converte una riga raw di SQLite nell'interfaccia `ConfigWebservice`.
 *
 * @param row - Riga grezza restituita da expo-sqlite
 * @returns   Oggetto `ConfigWebservice` tipizzato
 */
function rowToConfig(row: ConfigRow): ConfigWebservice {
  return {
    id:         row.id,
    base_url:   row.base_url,
    auth_token: row.auth_token,
    timeout_ms: row.timeout_ms,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

// ─────────────────────────────────────────────
// READ
// ─────────────────────────────────────────────

/**
 * Recupera la configurazione webservice corrente dal database.
 * Restituisce `null` se non è ancora stata salvata alcuna configurazione.
 *
 * @returns Promise con la configurazione o `null`
 * @throws  Error in caso di errore di lettura SQLite
 *
 * @example
 * const config = await getConfig();
 * if (!config) {
 *   // Nessuna configurazione salvata: mostrare form vuoto
 * }
 */
export async function getConfig(): Promise<ConfigWebservice | null> {
  try {
    const db = getDb();
    const row = await db.getFirstAsync<ConfigRow>(
      'SELECT * FROM config_webservice WHERE id = 1'
    );
    return row ? rowToConfig(row) : null;
  } catch (error) {
    console.error('[config.service] Errore getConfig:', error);
    throw new Error(
      `Impossibile leggere la configurazione: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}

// ─────────────────────────────────────────────
// WRITE — UPSERT
// ─────────────────────────────────────────────

/**
 * Salva o aggiorna la configurazione webservice.
 * Usa INSERT OR REPLACE per garantire l'unicità della riga con id = 1.
 * Il campo `updated_at` viene sempre aggiornato all'ora corrente.
 *
 * @param dto - Dati della configurazione da salvare
 * @returns   Promise con la configurazione appena salvata
 * @throws    Error se la validazione fallisce o SQLite restituisce errore
 *
 * @example
 * const config = await salvaConfig({
 *   base_url:   'https://gestionale.example.com/api',
 *   auth_token: 'Bearer eyJ...',
 *   timeout_ms: 15000,
 * });
 */
export async function salvaConfig(
  dto: ConfigWebserviceDTO
): Promise<ConfigWebservice> {
  // Validazione base — i controlli approfonditi sono nel form UI
  const validationError = validateConfigDTO(dto);
  if (validationError) {
    throw new Error(validationError);
  }

  try {
    const db = getDb();

    await db.runAsync(
      `INSERT INTO config_webservice (id, base_url, auth_token, timeout_ms, updated_at)
       VALUES (1, ?, ?, ?, datetime('now'))
       ON CONFLICT(id) DO UPDATE SET
         base_url   = excluded.base_url,
         auth_token = excluded.auth_token,
         timeout_ms = excluded.timeout_ms,
         updated_at = datetime('now')`,
      dto.base_url.trim(),
      dto.auth_token.trim(),
      dto.timeout_ms
    );

    // Recupera la riga appena scritta per restituire i campi generati (created_at, updated_at)
    const saved = await getConfig();
    if (!saved) {
      throw new Error('Configurazione salvata ma non recuperabile — stato inconsistente.');
    }

    return saved;
  } catch (error) {
    // Rilancia solo se non è già un nostro errore
    if (error instanceof Error && error.message.startsWith('[config.service]')) {
      throw error;
    }
    console.error('[config.service] Errore salvaConfig:', error);
    throw new Error(
      `Impossibile salvare la configurazione: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}

// ─────────────────────────────────────────────
// DELETE
// ─────────────────────────────────────────────

/**
 * Elimina la configurazione webservice salvata.
 * Dopo questa operazione `getConfig()` restituirà `null`.
 *
 * @throws Error in caso di errore SQLite
 */
export async function eliminaConfig(): Promise<void> {
  try {
    const db = getDb();
    await db.runAsync('DELETE FROM config_webservice WHERE id = 1');
  } catch (error) {
    console.error('[config.service] Errore eliminaConfig:', error);
    throw new Error(
      `Impossibile eliminare la configurazione: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}

// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────

/**
 * Verifica se una configurazione valida è presente nel database.
 * "Valida" significa: base_url non vuota e auth_token non vuoto.
 *
 * @returns Promise<boolean>
 */
export async function isConfigured(): Promise<boolean> {
  try {
    const config = await getConfig();
    return (
      config !== null &&
      config.base_url.trim().length > 0 &&
      config.auth_token.trim().length > 0
    );
  } catch {
    return false;
  }
}

/**
 * Valida un `ConfigWebserviceDTO` prima di salvarlo.
 * Restituisce una stringa di errore leggibile, o `null` se valido.
 *
 * @param dto - DTO da validare
 * @returns   Messaggio di errore o `null`
 */
export function validateConfigDTO(dto: ConfigWebserviceDTO): string | null {
  if (!dto.base_url || dto.base_url.trim().length === 0) {
    return 'URL base obbligatorio.';
  }

  try {
    const url = new URL(dto.base_url.trim());
    if (!['http:', 'https:'].includes(url.protocol)) {
      return 'URL base deve usare il protocollo http o https.';
    }
  } catch {
    return 'URL base non valido. Inserire un URL completo (es. https://esempio.com/api).';
  }

  if (!dto.auth_token || dto.auth_token.trim().length === 0) {
    return 'Token di autenticazione obbligatorio.';
  }

  if (dto.timeout_ms < 1000 || dto.timeout_ms > 120_000) {
    return 'Timeout deve essere compreso tra 1000 ms e 120000 ms.';
  }

  return null;
}

/**
 * Restituisce la configurazione corrente o lancia un errore descrittivo
 * se non è ancora stata configurata. Usato dai service che necessitano
 * della configurazione per operare (es. webservice.service.ts).
 *
 * @returns Promise con la configurazione garantita non-null
 * @throws  Error con messaggio human-readable se non configurato
 */
export async function getConfigOrThrow(): Promise<ConfigWebservice> {
  const config = await getConfig();
  if (!config) {
    throw new Error(
      'Webservice non configurato. Vai in Impostazioni e inserisci URL e token.'
    );
  }
  if (!config.base_url.trim()) {
    throw new Error(
      'URL del webservice mancante. Controlla le Impostazioni.'
    );
  }
  if (!config.auth_token.trim()) {
    throw new Error(
      'Token di autenticazione mancante. Controlla le Impostazioni.'
    );
  }
  return config;
}
