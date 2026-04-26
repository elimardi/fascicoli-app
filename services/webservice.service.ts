/**
 * @file services/webservice.service.ts
 * Gestione delle chiamate HTTP al webservice esterno.
 * Costruisce il payload multipart/form-data con le foto binarie,
 * gestisce autenticazione Bearer, timeout configurabile e
 * salva l'esito (successo o errore) nel database locale.
 */

import axios, { AxiosError, type AxiosInstance } from 'axios';
import * as FileSystem from 'expo-file-system';
import { getConfigOrThrow } from './config.service';
import { segnaFascicoloInviato, segnaFascicoloErrore } from './fascicoli.service';
import { getFotoByFascicolo } from './foto.service';
import { validateCodiceDocumento } from './fascicoli.service';
import type {
  Fascicolo,
  InvioResult,
  TestConnessioneResult,
  WebserviceResponse,
} from '@/types';

// ─────────────────────────────────────────────
// AXIOS INSTANCE FACTORY
// ─────────────────────────────────────────────

/**
 * Crea un'istanza Axios configurata con i parametri del webservice.
 * L'istanza viene ricreata ad ogni invio per rispecchiare la
 * configurazione più recente (l'utente potrebbe averla cambiata).
 *
 * @param baseUrl   - URL base del webservice
 * @param token     - Token Bearer per l'autenticazione
 * @param timeoutMs - Timeout in millisecondi
 * @returns         Istanza Axios configurata
 */
function createAxiosInstance(
  baseUrl: string,
  token: string,
  timeoutMs: number
): AxiosInstance {
  return axios.create({
    baseURL: baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`,
    timeout: timeoutMs,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
  });
}

// ─────────────────────────────────────────────
// HELPERS — lettura file binari
// ─────────────────────────────────────────────

/**
 * Legge un file foto dal filesystem e lo converte in base64.
 * Usato per costruire il payload multipart senza dipendere
 * da FormData nativo (non sempre disponibile in React Native).
 *
 * @param percorso - Percorso assoluto del file
 * @returns        Stringa base64 del contenuto del file
 * @throws         Error se il file non esiste o la lettura fallisce
 */
async function leggiFileBase64(percorso: string): Promise<string> {
  const info = await FileSystem.getInfoAsync(percorso);
  if (!info.exists) {
    throw new Error(`File non trovato: ${percorso}`);
  }

  const base64 = await FileSystem.readAsStringAsync(percorso, {
    encoding: FileSystem.EncodingType.Base64,
  });

  return base64;
}

/**
 * Costruisce il boundary per il multipart/form-data.
 * Genera un valore univoco ad ogni invocazione.
 *
 * @returns Stringa boundary
 */
function generaBoundary(): string {
  return `----FascicoliBoundary${Date.now()}${Math.random().toString(36).slice(2)}`;
}

/**
 * Costruisce manualmente il body multipart/form-data.
 * React Native non supporta il FormData nativo con file binari
 * in tutti i contesti — questa implementazione è più affidabile.
 *
 * @param codiceDocumento - Campo testuale del form
 * @param fotoBase64List  - Array di { base64, nomeFile } per ogni foto
 * @param boundary        - Boundary del multipart
 * @returns               Body come stringa raw del multipart
 */
function costruisciMultipartBody(
  codiceDocumento: string,
  fotoBase64List: Array<{ base64: string; nomeFile: string }>,
  boundary: string
): string {
  const CRLF = '\r\n';
  let body = '';

  // Campo testuale: codice_documento
  body += `--${boundary}${CRLF}`;
  body += `Content-Disposition: form-data; name="codice_documento"${CRLF}`;
  body += CRLF;
  body += `${codiceDocumento}${CRLF}`;

  // Campi file: foto[]
  for (const { base64, nomeFile } of fotoBase64List) {
    body += `--${boundary}${CRLF}`;
    body += `Content-Disposition: form-data; name="foto[]"; filename="${nomeFile}"${CRLF}`;
    body += `Content-Type: image/jpeg${CRLF}`;
    body += `Content-Transfer-Encoding: base64${CRLF}`;
    body += CRLF;
    body += `${base64}${CRLF}`;
  }

  // Chiusura multipart
  body += `--${boundary}--${CRLF}`;

  return body;
}

// ─────────────────────────────────────────────
// HELPERS — gestione errori Axios
// ─────────────────────────────────────────────

/**
 * Estrae un messaggio di errore leggibile da un errore Axios.
 * Gestisce i tre casi principali: risposta HTTP, timeout/rete, setup.
 *
 * @param error - Errore catturato nel catch
 * @returns     Messaggio di errore human-readable
 */
function estraiMessaggioErrore(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const axiosErr = error as AxiosError<WebserviceResponse>;

    if (axiosErr.response) {
      // Il server ha risposto con status 4xx/5xx
      const status = axiosErr.response.status;
      const serverMsg =
        axiosErr.response.data?.error ??
        axiosErr.response.data?.message ??
        axiosErr.message;
      return `Errore server (${status}): ${serverMsg}`;
    }

    if (axiosErr.code === 'ECONNABORTED') {
      return 'Timeout: il webservice non ha risposto nel tempo limite.';
    }

    if (axiosErr.code === 'ERR_NETWORK' || !axiosErr.response) {
      return 'Nessuna connessione al webservice. Verifica URL e rete.';
    }

    return `Errore di rete: ${axiosErr.message}`;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return 'Errore sconosciuto durante l\'invio.';
}

/**
 * Serializza in modo sicuro un oggetto in JSON.
 * Se la serializzazione fallisce (riferimenti circolari, ecc.)
 * restituisce una stringa di fallback.
 *
 * @param data - Dato da serializzare
 * @returns    Stringa JSON o stringa di errore
 */
function serializzaEsito(data: unknown): string {
  try {
    return JSON.stringify(data, null, 2);
  } catch {
    return JSON.stringify({ errore: 'Impossibile serializzare la risposta.' });
  }
}

// ─────────────────────────────────────────────
// EXPORT PRINCIPALE — INVIO FASCICOLO
// ─────────────────────────────────────────────

/**
 * Invia un fascicolo al webservice esterno come multipart/form-data.
 *
 * Flusso:
 * 1. Legge la configurazione webservice dal DB (o lancia errore)
 * 2. Valida il codice documento
 * 3. Recupera le foto del fascicolo dal DB
 * 4. Legge i file binari dal filesystem (base64)
 * 5. Costruisce il payload multipart
 * 6. Esegue la POST con Axios
 * 7. In caso di successo (2xx): salva esito + segna "inviato"
 * 8. In caso di errore: salva messaggio + segna "errore"
 *
 * @param fascicolo       - Fascicolo da inviare (deve avere stato 'bozza')
 * @param codiceDocumento - Codice documento inserito dall'utente
 * @returns               `InvioResult` con esito e messaggio toast
 *
 * @example
 * const result = await inviaFascicolo(fascicolo, '2024/DOC/001');
 * if (result.success) {
 *   Toast.show({ type: 'success', text1: result.messaggio });
 * }
 */
export async function inviaFascicolo(
  fascicolo: Fascicolo,
  codiceDocumento: string
): Promise<InvioResult> {
  // ── 1. Validazione codice documento ──
  const validErr = validateCodiceDocumento(codiceDocumento);
  if (validErr) {
    return {
      success:   false,
      esitoJson: serializzaEsito({ errore: validErr }),
      messaggio: validErr,
    };
  }

  // ── 2. Configurazione webservice ──
  let config;
  try {
    config = await getConfigOrThrow();
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Configurazione mancante.';
    return {
      success:   false,
      esitoJson: serializzaEsito({ errore: msg }),
      messaggio: msg,
    };
  }

  // ── 3. Recupero foto dal DB ──
  let foto;
  try {
    foto = await getFotoByFascicolo(fascicolo.id);
  } catch (error) {
    const msg = `Impossibile leggere le foto: ${
      error instanceof Error ? error.message : String(error)
    }`;
    await segnaFascicoloErrore(fascicolo.id, serializzaEsito({ errore: msg }));
    return { success: false, esitoJson: serializzaEsito({ errore: msg }), messaggio: msg };
  }

  if (foto.length === 0) {
    const msg = 'Il fascicolo non contiene foto. Aggiungine almeno una prima di inviare.';
    return {
      success:   false,
      esitoJson: serializzaEsito({ errore: msg }),
      messaggio: msg,
    };
  }

  // ── 4. Lettura file binari ──
  const fotoBase64List: Array<{ base64: string; nomeFile: string }> = [];

  for (const f of foto) {
    try {
      const base64 = await leggiFileBase64(f.percorso_locale);
      fotoBase64List.push({ base64, nomeFile: f.nome_file });
    } catch (error) {
      const msg = `File foto mancante: ${f.nome_file}. Rimuovila e riprova.`;
      await segnaFascicoloErrore(fascicolo.id, serializzaEsito({ errore: msg }));
      return { success: false, esitoJson: serializzaEsito({ errore: msg }), messaggio: msg };
    }
  }

  // ── 5. Costruzione payload multipart ──
  const boundary = generaBoundary();
  const body = costruisciMultipartBody(
    codiceDocumento.trim(),
    fotoBase64List,
    boundary
  );

  // ── 6. Chiamata HTTP ──
  const axiosInstance = createAxiosInstance(
    config.base_url,
    config.auth_token,
    config.timeout_ms
  );

  try {
    const response = await axiosInstance.post<WebserviceResponse>(
      'fascicoli',
      body,
      {
        headers: {
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
        },
      }
    );

    // ── 7. Successo 2xx ──
    const esitoJson = serializzaEsito(response.data);
    await segnaFascicoloInviato(fascicolo.id, esitoJson);

    // Salva anche il codice documento sul fascicolo
    try {
      const db = (await import('./db')).getDb();
      await db.runAsync(
        'UPDATE fascicoli SET codice_documento = ? WHERE id = ?',
        codiceDocumento.trim(),
        fascicolo.id
      );
    } catch {
      // Non critico se il salvataggio del codice fallisce
    }

    return {
      success:   true,
      esitoJson,
      messaggio: 'Fascicolo inviato al gestionale con successo.',
    };
  } catch (error) {
    // ── 8. Errore HTTP o di rete ──
    const msg = estraiMessaggioErrore(error);
    const esitoJson = serializzaEsito({
      errore:    msg,
      timestamp: new Date().toISOString(),
      ...(axios.isAxiosError(error) && error.response
        ? {
            status:   error.response.status,
            data:     error.response.data,
          }
        : {}),
    });

    await segnaFascicoloErrore(fascicolo.id, esitoJson);

    return {
      success:   false,
      esitoJson,
      messaggio: msg,
    };
  }
}

// ─────────────────────────────────────────────
// TEST CONNESSIONE
// ─────────────────────────────────────────────

/**
 * Esegue un test di connessione al webservice (GET ping).
 * Misura la latenza e restituisce il risultato per la UI
 * della schermata Impostazioni.
 *
 * Tenta prima GET su `{base_url}/ping`, poi su `{base_url}/`
 * come fallback per webservice che non espongono /ping.
 *
 * @returns Promise con `TestConnessioneResult`
 *
 * @example
 * const result = await testConnessione();
 * // { success: true, latenza_ms: 142, messaggio: 'Connessione riuscita (142 ms)' }
 */
export async function testConnessione(): Promise<TestConnessioneResult> {
  let config;
  try {
    config = await getConfigOrThrow();
  } catch (error) {
    return {
      success:    false,
      latenza_ms: null,
      messaggio:  error instanceof Error ? error.message : 'Configurazione mancante.',
    };
  }

  const axiosInstance = createAxiosInstance(
    config.base_url,
    config.auth_token,
    Math.min(config.timeout_ms, 10_000) // Cap a 10s per il ping
  );

  const startTime = Date.now();

  // Prova prima /ping, poi / come fallback
  const endpoints = ['ping', ''];

  for (const endpoint of endpoints) {
    try {
      await axiosInstance.get(endpoint);
      const latenza = Date.now() - startTime;
      return {
        success:    true,
        latenza_ms: latenza,
        messaggio:  `Connessione riuscita (${latenza} ms)`,
      };
    } catch (error) {
      if (axios.isAxiosError(error)) {
        // Status 4xx = server raggiungibile ma endpoint non trovato
        // Lo consideriamo comunque una connessione riuscita
        if (error.response && error.response.status < 500) {
          const latenza = Date.now() - startTime;
          return {
            success:    true,
            latenza_ms: latenza,
            messaggio:  `Server raggiungibile (${latenza} ms) — status ${error.response.status}`,
          };
        }

        // Timeout o rete irraggiungibile: non tentare il fallback
        if (
          error.code === 'ECONNABORTED' ||
          error.code === 'ERR_NETWORK' ||
          !error.response
        ) {
          const msg = estraiMessaggioErrore(error);
          return {
            success:    false,
            latenza_ms: null,
            messaggio:  msg,
          };
        }
      }
      // 5xx o altro: prova il prossimo endpoint
    }
  }

  return {
    success:    false,
    latenza_ms: null,
    messaggio:  'Impossibile raggiungere il webservice. Verifica URL e token.',
  };
}
