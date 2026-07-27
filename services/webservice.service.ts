/**
 * @file services/webservice.service.ts
 * Gestione delle chiamate HTTP al webservice esterno.
 *
 * Flusso di autenticazione a due step:
 * 1. POST {auth_endpoint} con { therm_token, grant_type: "therm_token" }
 *    → risposta: { access_token, token_type, expires_in }
 * 2. PUT {invio_endpoint} con header "Authorization: Bearer {access_token}"
 *    e body JSON:
 *    {
 *      "DocumentoVendita": "2026/DV/000001",
 *      "JSON": {
 *        "DocumentiDigitale": [
 *          {
 *            "bytes": "<base64>",
 *            "nome_file": "Foto1.jpg",
 *            "descrizione": "<da Impostazioni, opzionale>",
 *            "catalogo": "<da Impostazioni, opzionale>"
 *          }, ...
 *        ]
 *      }
 *    }
 *
 * L'access token viene cachato in DB e riutilizzato fino alla scadenza
 * (con margine di sicurezza). In caso di 401 viene invalidato e la
 * richiesta viene ritentata una sola volta con un token nuovo.
 */

import axios, { AxiosError, type AxiosInstance } from 'axios';
import { File } from 'expo-file-system';
import {
  getConfigOrThrow,
  getTokenCache,
  salvaTokenCache,
  invalidaTokenCache,
} from './config.service';
import { segnaFascicoloInviato, segnaFascicoloErrore } from './fascicoli.service';
import { getFotoByFascicolo } from './foto.service';
import { validateCodiceDocumento } from './fascicoli.service';
import { TOKEN_EXPIRY_MARGIN_MS } from '@/constants';
import type {
  ConfigWebservice,
  Fascicolo,
  InvioResult,
  TestConnessioneResult,
  TokenResponse,
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
 * @param baseUrl     - URL base del webservice
 * @param timeoutMs   - Timeout in millisecondi
 * @param bearerToken - Access token per l'header Authorization (opzionale:
 *                      l'endpoint di autenticazione non lo richiede)
 * @returns           Istanza Axios configurata
 */
function createAxiosInstance(
  baseUrl: string,
  timeoutMs: number,
  bearerToken?: string
): AxiosInstance {
  return axios.create({
    baseURL: baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`,
    timeout: timeoutMs,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...(bearerToken ? { Authorization: `Bearer ${bearerToken}` } : {}),
    },
  });
}

// ─────────────────────────────────────────────
// AUTENTICAZIONE OAUTH — step 1
// ─────────────────────────────────────────────

/**
 * Richiede un nuovo access token all'endpoint di autenticazione.
 *
 * @param config - Configurazione webservice corrente
 * @returns      Promise con la risposta token del server
 * @throws       Error se il server non restituisce un access_token valido
 *
 * @example
 * // POST http://10.0.0.10:10101/panth01/api/authenticate/oauth/token
 * // { "therm_token": "qJFasDuvmM", "grant_type": "therm_token" }
 */
async function richiediAccessToken(
  config: ConfigWebservice
): Promise<TokenResponse> {
  const axiosInstance = createAxiosInstance(config.base_url, config.timeout_ms);

  const response = await axiosInstance.post<TokenResponse>(
    config.auth_endpoint,
    {
      therm_token: config.therm_token,
      grant_type:  'therm_token',
    }
  );

  const data = response.data;
  if (!data || typeof data.access_token !== 'string' || !data.access_token) {
    throw new Error(
      'Autenticazione fallita: il server non ha restituito un access_token valido.'
    );
  }

  return {
    access_token: data.access_token,
    token_type:   data.token_type ?? 'Bearer',
    expires_in:   typeof data.expires_in === 'number' ? data.expires_in : 3600,
  };
}

/**
 * Restituisce un access token valido, riutilizzando la cache quando possibile.
 *
 * - Se in cache c'è un token non scaduto (con margine di sicurezza), lo riusa.
 * - Altrimenti ne richiede uno nuovo e aggiorna la cache.
 *
 * @param config       - Configurazione webservice corrente
 * @param forceRefresh - Se true ignora la cache (usato dopo un 401)
 * @returns            Promise con l'access token
 */
async function getAccessToken(
  config: ConfigWebservice,
  forceRefresh = false
): Promise<string> {
  if (!forceRefresh) {
    const cached = await getTokenCache();
    if (cached && cached.expires_at - TOKEN_EXPIRY_MARGIN_MS > Date.now()) {
      return cached.access_token;
    }
  }

  const token = await richiediAccessToken(config);
  const expiresAt = Date.now() + token.expires_in * 1000;
  await salvaTokenCache(token.access_token, expiresAt);

  return token.access_token;
}

// ─────────────────────────────────────────────
// HELPERS — lettura file binari
// ─────────────────────────────────────────────

/**
 * Legge un file foto dal filesystem e lo converte in base64.
 *
 * @param percorso - Percorso assoluto del file
 * @returns        Stringa base64 del contenuto del file
 * @throws         Error se il file non esiste o la lettura fallisce
 */
async function leggiFileBase64(percorso: string): Promise<string> {
  const file = new File(percorso);
  if (!file.exists) {
    throw new Error(`File non trovato: ${percorso}`);
  }

  return file.base64();
}

// ─────────────────────────────────────────────
// HELPERS — payload JSON documenti digitali
// ─────────────────────────────────────────────

/** Singolo documento digitale nel payload di invio. */
interface DocumentoDigitale {
  bytes: string;
  nome_file: string;
  /** Descrizione configurata in Impostazioni — omessa se non valorizzata */
  descrizione?: string;
  /** Catalogo configurato in Impostazioni — omesso se non valorizzato */
  catalogo?: string;
}

/** Payload completo dell'endpoint di invio documenti. */
interface InvioDocumentiPayload {
  DocumentoVendita: string;
  JSON: {
    DocumentiDigitale: DocumentoDigitale[];
  };
}

/**
 * Costruisce il payload JSON atteso dall'endpoint di invio.
 *
 * @param documentoVendita - Codice documento (es. "2026/DV/000001")
 * @param documenti        - Foto in base64 con relativo nome file
 * @returns                Payload tipizzato pronto per la PUT
 */
function costruisciPayloadDocumenti(
  documentoVendita: string,
  documenti: DocumentoDigitale[]
): InvioDocumentiPayload {
  return {
    DocumentoVendita: documentoVendita,
    JSON: {
      DocumentiDigitale: documenti,
    },
  };
}

// ─────────────────────────────────────────────
// HELPERS — gestione errori Axios
// ─────────────────────────────────────────────

/**
 * Estrae un messaggio di errore leggibile da un errore Axios.
 *
 * @param error - Errore catturato nel catch
 * @returns     Messaggio di errore human-readable
 */
function estraiMessaggioErrore(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const axiosErr = error as AxiosError<WebserviceResponse>;

    if (axiosErr.response) {
      const status = axiosErr.response.status;
      const serverMsg =
        axiosErr.response.data?.error ??
        axiosErr.response.data?.message ??
        axiosErr.message;
      if (status === 401 || status === 403) {
        return `Autenticazione rifiutata (${status}): verifica il therm token nelle Impostazioni.`;
      }
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

/** True se l'errore è una risposta HTTP 401 (token scaduto/revocato). */
function isUnauthorized(error: unknown): boolean {
  return axios.isAxiosError(error) && error.response?.status === 401;
}

// ─────────────────────────────────────────────
// EXPORT PRINCIPALE — INVIO FASCICOLO
// ─────────────────────────────────────────────

/**
 * Invia un fascicolo al webservice esterno.
 *
 * Flusso:
 * 1. Valida il codice documento
 * 2. Legge la configurazione webservice dal DB (o lancia errore)
 * 3. Recupera le foto del fascicolo dal DB e le legge in base64
 * 4. Ottiene un access token (cache o nuova autenticazione)
 * 5. Esegue la PUT sull'endpoint di invio con payload JSON
 * 6. Su 401: invalida il token, si riautentica e ritenta una volta
 * 7. In caso di successo (2xx): salva esito + segna "inviato"
 * 8. In caso di errore: salva messaggio + segna "errore"
 *
 * @param fascicolo       - Fascicolo da inviare (deve avere stato 'bozza')
 * @param codiceDocumento - Codice documento di vendita (es. "2026/DV/000001")
 * @returns               `InvioResult` con esito e messaggio toast
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
  let config: ConfigWebservice;
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

  // ── Lettura file binari ──
  const documenti: DocumentoDigitale[] = [];

  // Attributi comuni presi dalla configurazione: vengono inclusi solo se
  // valorizzati, così con i campi vuoti il payload resta identico a prima.
  const attributiFoto: Pick<DocumentoDigitale, 'descrizione' | 'catalogo'> = {
    ...(config.descrizione_foto.trim()
      ? { descrizione: config.descrizione_foto.trim() }
      : {}),
    ...(config.catalogo_foto.trim()
      ? { catalogo: config.catalogo_foto.trim() }
      : {}),
  };

  for (const f of foto) {
    try {
      const base64 = await leggiFileBase64(f.percorso_locale);
      documenti.push({ bytes: base64, nome_file: f.nome_file, ...attributiFoto });
    } catch {
      const msg = `File foto mancante: ${f.nome_file}. Rimuovila e riprova.`;
      await segnaFascicoloErrore(fascicolo.id, serializzaEsito({ errore: msg }));
      return { success: false, esitoJson: serializzaEsito({ errore: msg }), messaggio: msg };
    }
  }

  const payload = costruisciPayloadDocumenti(codiceDocumento.trim(), documenti);

  // Salva subito il codice documento sul fascicolo (anche se l'invio poi
  // fallisce): così un eventuale "Riprova invio" lo trova precompilato.
  try {
    const db = (await import('./db')).getDb();
    await db.runAsync(
      'UPDATE fascicoli SET codice_documento = ? WHERE id = ?',
      codiceDocumento.trim(),
      fascicolo.id
    );
  } catch {
    // Non critico
  }

  // ── 4–6. Autenticazione + PUT con retry su 401 ──
  let response;
  try {
    response = await eseguiPutConRetry(config, payload);
  } catch (error) {
    const msg = estraiMessaggioErrore(error);
    const esitoJson = serializzaEsito({
      errore:    msg,
      timestamp: new Date().toISOString(),
      ...(axios.isAxiosError(error) && error.response
        ? {
            status: error.response.status,
            data:   error.response.data,
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

  // ── 7. Successo 2xx ──
  const esitoJson = serializzaEsito(response.data);
  await segnaFascicoloInviato(fascicolo.id, esitoJson);

  return {
    success:   true,
    esitoJson,
    messaggio: 'Fascicolo inviato al gestionale con successo.',
  };
}

/**
 * Esegue la PUT dei documenti gestendo il ciclo di vita del token:
 * primo tentativo con token (eventualmente cachato); se il server
 * risponde 401 il token viene invalidato e la richiesta ritentata
 * una sola volta con un token appena emesso.
 *
 * @param config  - Configurazione webservice
 * @param payload - Payload JSON dei documenti
 * @returns       Risposta Axios in caso di successo
 * @throws        Errore Axios/generico se anche il retry fallisce
 */
async function eseguiPutConRetry(
  config: ConfigWebservice,
  payload: InvioDocumentiPayload
) {
  let token = await getAccessToken(config);

  try {
    const axiosInstance = createAxiosInstance(config.base_url, config.timeout_ms, token);
    return await axiosInstance.put<WebserviceResponse>(config.invio_endpoint, payload);
  } catch (error) {
    if (!isUnauthorized(error)) {
      throw error;
    }

    // Token scaduto o revocato: nuovo token e un solo retry
    await invalidaTokenCache();
    token = await getAccessToken(config, true);

    const axiosInstance = createAxiosInstance(config.base_url, config.timeout_ms, token);
    return await axiosInstance.put<WebserviceResponse>(config.invio_endpoint, payload);
  }
}

// ─────────────────────────────────────────────
// TEST CONNESSIONE
// ─────────────────────────────────────────────

/**
 * Esegue un test di connessione al webservice tentando una
 * autenticazione reale sull'endpoint OAuth configurato.
 * È il test più significativo possibile: verifica URL, rete,
 * endpoint e validità del therm token in un colpo solo.
 *
 * @returns Promise con `TestConnessioneResult`
 *
 * @example
 * const result = await testConnessione();
 * // { success: true, latenza_ms: 142, messaggio: 'Autenticazione riuscita (142 ms)' }
 */
export async function testConnessione(): Promise<TestConnessioneResult> {
  let config: ConfigWebservice;
  try {
    config = await getConfigOrThrow();
  } catch (error) {
    return {
      success:    false,
      latenza_ms: null,
      messaggio:  error instanceof Error ? error.message : 'Configurazione mancante.',
    };
  }

  const startTime = Date.now();

  try {
    const token = await richiediAccessToken({
      ...config,
      timeout_ms: Math.min(config.timeout_ms, 10_000), // Cap a 10s per il test
    });

    // Aggiorna la cache: il token appena emesso è riutilizzabile
    await salvaTokenCache(
      token.access_token,
      Date.now() + token.expires_in * 1000
    );

    const latenza = Date.now() - startTime;
    return {
      success:    true,
      latenza_ms: latenza,
      messaggio:  `Autenticazione riuscita (${latenza} ms) — token valido ${token.expires_in}s`,
    };
  } catch (error) {
    return {
      success:    false,
      latenza_ms: null,
      messaggio:  estraiMessaggioErrore(error),
    };
  }
}
