/**
 * @file types/index.ts
 * Definizioni TypeScript condivise in tutta l'applicazione.
 * Nessun `any` esplicito — strict mode attivo.
 */

// ─────────────────────────────────────────────
// ENUMERAZIONI
// ─────────────────────────────────────────────

/**
 * Stati possibili di un fascicolo.
 * - `bozza`   → creato ma non ancora inviato
 * - `inviato` → inviato con successo al webservice
 * - `errore`  → tentativo di invio fallito
 */
export type StatoFascicolo = 'bozza' | 'inviato' | 'errore';

// ─────────────────────────────────────────────
// ENTITÀ DATABASE
// ─────────────────────────────────────────────

/**
 * Rappresenta un fascicolo fotografico salvato in SQLite.
 */
export interface Fascicolo {
  id: number;
  titolo: string;
  descrizione: string | null;
  stato: StatoFascicolo;
  /** Codice documento inserito dall'utente prima dell'invio */
  codice_documento: string | null;
  /** Risposta JSON serializzata ricevuta dal webservice */
  esito_risposta: string | null;
  data_creazione: string; // ISO 8601
  data_invio: string | null; // ISO 8601
}

/**
 * Rappresenta una singola foto appartenente a un fascicolo.
 */
export interface Foto {
  id: number;
  fascicolo_id: number;
  /** Percorso assoluto nel filesystem di expo-file-system */
  percorso_locale: string;
  nome_file: string;
  dimensione_bytes: number | null;
  data_scatto: string | null; // ISO 8601
  /** Indice per il riordinamento drag-and-drop */
  ordinamento: number;
}

/**
 * Configurazione del webservice esterno (una sola riga in DB).
 */
export interface ConfigWebservice {
  id: number;
  base_url: string;
  /** Therm token usato per richiedere l'access token OAuth */
  therm_token: string;
  /** Path relativo dell'endpoint di autenticazione (es. authenticate/oauth/token) */
  auth_endpoint: string;
  /** Path relativo dell'endpoint di invio documenti (es. YUploadDocDgtMultipli) */
  invio_endpoint: string;
  /** Nome della società mostrato nell'header dell'app */
  nome_societa: string;
  /** Logo della società in base64 (data URI escluso, solo payload) */
  logo_base64: string;
  /** Descrizione applicata alle foto inviate — max 25 caratteri */
  descrizione_foto: string;
  /** Catalogo di destinazione delle foto inviate — max 50 caratteri */
  catalogo_foto: string;
  /** Timeout in millisecondi per le richieste HTTP */
  timeout_ms: number;
  created_at: string; // ISO 8601
  updated_at: string; // ISO 8601
}

/**
 * Cache del token OAuth ottenuto dall'endpoint di autenticazione.
 * Persistita in DB per sopravvivere ai riavvii dell'app.
 */
export interface TokenCache {
  access_token: string;
  /** Istante di scadenza in epoch millisecondi */
  expires_at: number;
}

/**
 * Risposta dell'endpoint di autenticazione OAuth.
 */
export interface TokenResponse {
  access_token: string;
  token_type: string;
  /** Validità del token in secondi */
  expires_in: number;
}

// ─────────────────────────────────────────────
// DTO — DATA TRANSFER OBJECTS
// ─────────────────────────────────────────────

/**
 * Payload per la creazione di un nuovo fascicolo.
 */
export interface CreaFascicoloDTO {
  titolo: string;
  descrizione?: string;
}

/**
 * Payload per l'aggiornamento parziale di un fascicolo.
 */
export interface AggiorneFascicoloDTO {
  titolo?: string;
  descrizione?: string;
  stato?: StatoFascicolo;
  codice_documento?: string;
  esito_risposta?: string;
  data_invio?: string;
}

/**
 * Payload per l'inserimento di una nuova foto.
 */
export interface CreaFotoDTO {
  fascicolo_id: number;
  percorso_locale: string;
  nome_file: string;
  dimensione_bytes?: number;
  data_scatto?: string;
  ordinamento: number;
}

/**
 * Payload per la configurazione del webservice.
 */
export interface ConfigWebserviceDTO {
  base_url: string;
  therm_token: string;
  auth_endpoint: string;
  invio_endpoint: string;
  nome_societa: string;
  logo_base64: string;
  descrizione_foto: string;
  catalogo_foto: string;
  timeout_ms: number;
}

// ─────────────────────────────────────────────
// WEBSERVICE — RICHIESTA E RISPOSTA
// ─────────────────────────────────────────────

/**
 * Payload inviato al webservice esterno.
 */
export interface InvioFascicoloPayload {
  fascicolo_id: number;
  codice_documento: string;
  foto: Foto[];
}

/**
 * Struttura generica della risposta HTTP del webservice.
 * Il campo `data` è tipizzato come `unknown` perché dipende
 * dall'implementazione del gestionale esterno.
 */
export interface WebserviceResponse {
  success: boolean;
  message?: string;
  data?: unknown;
  error?: string;
}

/**
 * Risultato interno dell'operazione di invio,
 * usato dai service e dagli store.
 */
export interface InvioResult {
  success: boolean;
  /** Risposta JSON serializzata da salvare in `esito_risposta` */
  esitoJson: string;
  /** Messaggio human-readable per il toast */
  messaggio: string;
}

// ─────────────────────────────────────────────
// TEST CONNESSIONE
// ─────────────────────────────────────────────

/**
 * Risultato del ping al webservice (schermata Impostazioni).
 */
export interface TestConnessioneResult {
  success: boolean;
  latenza_ms: number | null;
  messaggio: string;
}

// ─────────────────────────────────────────────
// STATO UI — usato negli store Zustand
// ─────────────────────────────────────────────

/**
 * Stato del loading per operazioni asincrone.
 * Permette di distinguere quale operazione è in corso.
 */
export type LoadingState =
  | 'idle'
  | 'loading'
  | 'success'
  | 'error';

/**
 * Wrapper generico per operazioni asincrone con stato.
 */
export interface AsyncState<T> {
  data: T | null;
  loading: LoadingState;
  error: string | null;
}

// ─────────────────────────────────────────────
// NAVIGAZIONE — Expo Router typed routes
// ─────────────────────────────────────────────

/**
 * Parametri delle route dinamiche dell'app.
 */
export interface RouteParams {
  '/fascicolo/[id]': { id: string };
  '/fascicolo/[id]/camera': { id: string };
}

// ─────────────────────────────────────────────
// DATABASE — tipi interni per le migrations
// ─────────────────────────────────────────────

/**
 * Record di una migration versionabile.
 */
export interface DbMigration {
  version: number;
  description: string;
  sql: string;
}

/**
 * Riga raw restituita da SQLite per i fascicoli.
 * Usata internamente da fascicoli.service.ts prima del mapping.
 */
export interface FascicoloRow {
  id: number;
  titolo: string;
  descrizione: string | null;
  stato: string;
  codice_documento: string | null;
  esito_risposta: string | null;
  data_creazione: string;
  data_invio: string | null;
}

/**
 * Riga raw restituita da SQLite per le foto.
 */
export interface FotoRow {
  id: number;
  fascicolo_id: number;
  percorso_locale: string;
  nome_file: string;
  dimensione_bytes: number | null;
  data_scatto: string | null;
  ordinamento: number;
}

/**
 * Riga raw restituita da SQLite per la configurazione.
 */
export interface ConfigRow {
  id: number;
  base_url: string;
  therm_token: string;
  auth_endpoint: string;
  invio_endpoint: string;
  nome_societa: string;
  logo_base64: string;
  descrizione_foto: string;
  catalogo_foto: string;
  cached_access_token: string | null;
  token_expires_at: number | null;
  timeout_ms: number;
  created_at: string;
  updated_at: string;
}

// ─────────────────────────────────────────────
// COMPONENTI — Props riusabili
// ─────────────────────────────────────────────

/**
 * Props per il badge di stato del fascicolo.
 */
export interface StatusBadgeProps {
  stato: StatoFascicolo;
  size?: 'sm' | 'md';
}

/**
 * Props per la card fascicolo nella lista.
 */
export interface FascicoloCardProps {
  fascicolo: Fascicolo;
  numeroFoto: number;
  onPress: () => void;
  onDelete: () => void;
}

/**
 * Props per la griglia foto nel dettaglio fascicolo.
 */
export interface FotoGridProps {
  foto: Foto[];
  onFotoPress: (foto: Foto) => void;
  onFotoLongPress: (foto: Foto) => void;
  onReorder: (fotosRiordinate: Foto[]) => void;
  /** Se true mostra i controlli di riordino (frecce) su ogni cella */
  riordinoAttivo?: boolean;
}
