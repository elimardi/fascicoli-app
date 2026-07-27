/**
 * @file services/config.service.ts
 * Gestione della configurazione del webservice esterno.
 * La tabella `config_webservice` contiene sempre al massimo una riga (id = 1).
 * Tutte le operazioni usano UPSERT per garantire questa invariante.
 *
 * Dalla v2 gestisce anche:
 * - Branding (nome società + logo base64)
 * - Autenticazione OAuth a due step (therm_token → access_token)
 * - Cache persistente dell'access token con scadenza
 */

import { getDb } from './db';
import {
  WS_DEFAULT_AUTH_ENDPOINT,
  WS_DEFAULT_INVIO_ENDPOINT,
  DESCRIZIONE_FOTO_MAX_LEN,
  CATALOGO_FOTO_MAX_LEN,
} from '@/constants';
import type {
  ConfigWebservice,
  ConfigWebserviceDTO,
  ConfigRow,
  TokenCache,
} from '@/types';

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
    id:               row.id,
    base_url:         row.base_url,
    therm_token:      row.therm_token ?? '',
    auth_endpoint:    row.auth_endpoint || WS_DEFAULT_AUTH_ENDPOINT,
    invio_endpoint:   row.invio_endpoint || WS_DEFAULT_INVIO_ENDPOINT,
    nome_societa:     row.nome_societa ?? '',
    logo_base64:      row.logo_base64 ?? '',
    descrizione_foto: row.descrizione_foto ?? '',
    catalogo_foto:    row.catalogo_foto ?? '',
    timeout_ms:       row.timeout_ms,
    created_at:     row.created_at,
    updated_at:     row.updated_at,
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
 * Usa UPSERT per garantire l'unicità della riga con id = 1.
 * Ad ogni salvataggio la cache del token viene invalidata,
 * perché le credenziali potrebbero essere cambiate.
 *
 * @param dto - Dati della configurazione da salvare
 * @returns   Promise con la configurazione appena salvata
 * @throws    Error se la validazione fallisce o SQLite restituisce errore
 */
export async function salvaConfig(
  dto: ConfigWebserviceDTO
): Promise<ConfigWebservice> {
  const validationError = validateConfigDTO(dto);
  if (validationError) {
    throw new Error(validationError);
  }

  try {
    const db = getDb();

    await db.runAsync(
      `INSERT INTO config_webservice
         (id, base_url, therm_token, auth_endpoint, invio_endpoint,
          nome_societa, logo_base64, descrizione_foto, catalogo_foto, timeout_ms,
          cached_access_token, token_expires_at, updated_at)
       VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, datetime('now'))
       ON CONFLICT(id) DO UPDATE SET
         base_url            = excluded.base_url,
         therm_token         = excluded.therm_token,
         auth_endpoint       = excluded.auth_endpoint,
         invio_endpoint      = excluded.invio_endpoint,
         nome_societa        = excluded.nome_societa,
         logo_base64         = excluded.logo_base64,
         descrizione_foto    = excluded.descrizione_foto,
         catalogo_foto       = excluded.catalogo_foto,
         timeout_ms          = excluded.timeout_ms,
         cached_access_token = NULL,
         token_expires_at    = NULL,
         updated_at          = datetime('now')`,
      dto.base_url.trim(),
      dto.therm_token.trim(),
      dto.auth_endpoint.trim().replace(/^\/+/, ''),
      dto.invio_endpoint.trim().replace(/^\/+/, ''),
      dto.nome_societa.trim(),
      dto.logo_base64,
      // SQLite non applica i limiti di VARCHAR: tronchiamo qui come rete di sicurezza
      dto.descrizione_foto.trim().slice(0, DESCRIZIONE_FOTO_MAX_LEN),
      dto.catalogo_foto.trim().slice(0, CATALOGO_FOTO_MAX_LEN),
      dto.timeout_ms
    );

    const saved = await getConfig();
    if (!saved) {
      throw new Error('Configurazione salvata ma non recuperabile — stato inconsistente.');
    }

    return saved;
  } catch (error) {
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
// TOKEN CACHE — persistenza access token OAuth
// ─────────────────────────────────────────────

/**
 * Recupera la cache del token dal database.
 * Restituisce `null` se non c'è alcun token salvato.
 *
 * NB: la validità (scadenza) NON viene verificata qui —
 * è responsabilità del chiamante (webservice.service).
 *
 * @returns Promise con `TokenCache` o `null`
 */
export async function getTokenCache(): Promise<TokenCache | null> {
  try {
    const db = getDb();
    const row = await db.getFirstAsync<{
      cached_access_token: string | null;
      token_expires_at: number | null;
    }>(
      'SELECT cached_access_token, token_expires_at FROM config_webservice WHERE id = 1'
    );

    if (!row || !row.cached_access_token || !row.token_expires_at) {
      return null;
    }

    return {
      access_token: row.cached_access_token,
      expires_at:   row.token_expires_at,
    };
  } catch (error) {
    console.error('[config.service] Errore getTokenCache:', error);
    return null; // Cache non critica: in caso di errore si richiede un nuovo token
  }
}

/**
 * Salva l'access token ottenuto dall'endpoint di autenticazione.
 *
 * @param accessToken - Token Bearer da cachare
 * @param expiresAt   - Scadenza in epoch millisecondi
 */
export async function salvaTokenCache(
  accessToken: string,
  expiresAt: number
): Promise<void> {
  try {
    const db = getDb();
    await db.runAsync(
      'UPDATE config_webservice SET cached_access_token = ?, token_expires_at = ? WHERE id = 1',
      accessToken,
      expiresAt
    );
  } catch (error) {
    // Non critico: il token resta valido in memoria per la richiesta corrente
    console.error('[config.service] Errore salvaTokenCache:', error);
  }
}

/**
 * Invalida la cache del token (es. dopo una risposta 401).
 */
export async function invalidaTokenCache(): Promise<void> {
  try {
    const db = getDb();
    await db.runAsync(
      'UPDATE config_webservice SET cached_access_token = NULL, token_expires_at = NULL WHERE id = 1'
    );
  } catch (error) {
    console.error('[config.service] Errore invalidaTokenCache:', error);
  }
}

// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────

/**
 * Verifica se una configurazione valida è presente nel database.
 * "Valida" significa: base_url non vuota e therm_token non vuoto.
 *
 * @returns Promise<boolean>
 */
export async function isConfigured(): Promise<boolean> {
  try {
    const config = await getConfig();
    return (
      config !== null &&
      config.base_url.trim().length > 0 &&
      config.therm_token.trim().length > 0
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
    return 'URL base non valido. Inserire un URL completo (es. http://10.0.0.10:10101/panth01/api).';
  }

  if (!dto.therm_token || dto.therm_token.trim().length === 0) {
    return 'Therm token obbligatorio.';
  }

  if (!dto.auth_endpoint || dto.auth_endpoint.trim().length === 0) {
    return 'Endpoint di autenticazione obbligatorio.';
  }

  if (!dto.invio_endpoint || dto.invio_endpoint.trim().length === 0) {
    return 'Endpoint di invio documenti obbligatorio.';
  }

  if (dto.nome_societa.trim().length > 60) {
    return 'Il nome società non può superare i 60 caratteri.';
  }

  if (dto.descrizione_foto.trim().length > DESCRIZIONE_FOTO_MAX_LEN) {
    return `La descrizione foto non può superare i ${DESCRIZIONE_FOTO_MAX_LEN} caratteri.`;
  }

  if (dto.catalogo_foto.trim().length > CATALOGO_FOTO_MAX_LEN) {
    return `Il catalogo foto non può superare i ${CATALOGO_FOTO_MAX_LEN} caratteri.`;
  }

  if (dto.timeout_ms < 1000 || dto.timeout_ms > 120_000) {
    return 'Timeout deve essere compreso tra 1000 ms e 120000 ms.';
  }

  return null;
}

/**
 * Restituisce la configurazione corrente o lancia un errore descrittivo
 * se non è ancora stata configurata.
 *
 * @returns Promise con la configurazione garantita non-null
 * @throws  Error con messaggio human-readable se non configurato
 */
export async function getConfigOrThrow(): Promise<ConfigWebservice> {
  const config = await getConfig();
  if (!config) {
    throw new Error(
      'Webservice non configurato. Vai in Impostazioni e inserisci URL e therm token.'
    );
  }
  if (!config.base_url.trim()) {
    throw new Error('URL del webservice mancante. Controlla le Impostazioni.');
  }
  if (!config.therm_token.trim()) {
    throw new Error('Therm token mancante. Controlla le Impostazioni.');
  }
  return config;
}
