/**
 * @file constants/index.ts
 * Costanti globali dell'applicazione.
 * Centralizza valori magic string e configurazioni di default.
 */

/** Nome del database SQLite locale */
export const DB_NAME = 'fascicoli.db';

/** Versione corrente dello schema DB (incrementare ad ogni migration) */
export const DB_VERSION = 4;

/** Lunghezza massima del campo "Descrizione foto" — varchar(25) */
export const DESCRIZIONE_FOTO_MAX_LEN = 25;

/** Lunghezza massima del campo "Catalogo foto" — varchar(50) */
export const CATALOGO_FOTO_MAX_LEN = 50;

/** Path relativo di default per l'endpoint di autenticazione OAuth */
export const WS_DEFAULT_AUTH_ENDPOINT = 'authenticate/oauth/token';

/** Path relativo di default per l'endpoint di invio documenti digitali */
export const WS_DEFAULT_INVIO_ENDPOINT = 'YUploadDocDgtMultipli';

/** Margine di sicurezza (ms) prima della scadenza del token per il refresh */
export const TOKEN_EXPIRY_MARGIN_MS = 60_000;

/** Dimensione massima lato lungo del logo società (px) */
export const LOGO_MAX_SIZE = 256;

/** Directory permanente per le foto dei fascicoli (expo-file-system) */
export const FOTO_DIRECTORY = 'fascicoli_foto';

/** Qualità JPEG per le foto scattate (0–1) */
export const FOTO_QUALITY = 0.85;

/** Dimensione massima lato lungo per il resize automatico (px) */
export const FOTO_MAX_SIZE = 1920;

/** Timeout di default per le richieste HTTP (ms) */
export const WS_DEFAULT_TIMEOUT_MS = 30_000;

/** Numero massimo di foto per fascicolo */
export const MAX_FOTO_PER_FASCICOLO = 50;

/** Colori semantici per i tre stati fascicolo */
export const STATO_COLORS: Record<
  'bozza' | 'inviato' | 'errore',
  { bg: string; text: string; border: string; spine: string; label: string }
> = {
  bozza: {
    bg:     '#EEF1F6',
    text:   '#3E4C63',
    border: '#8A97AD',
    spine:  '#8A97AD',
    label:  'Bozza',
  },
  inviato: {
    bg:     '#ECFDF3',
    text:   '#067647',
    border: '#17B26A',
    spine:  '#17B26A',
    label:  'Inviato',
  },
  errore: {
    bg:     '#FEF3F2',
    text:   '#B42318',
    border: '#F04438',
    spine:  '#F04438',
    label:  'Errore',
  },
};

/** Messaggi toast standard */
export const TOAST_MESSAGES = {
  FASCICOLO_CREATO: 'Fascicolo creato con successo',
  FASCICOLO_ELIMINATO: 'Fascicolo eliminato',
  FASCICOLO_INVIATO: 'Fascicolo inviato',
  FOTO_AGGIUNTA: 'Foto aggiunta al fascicolo',
  FOTO_ELIMINATA: 'Foto eliminata',
  FOTO_RIORDINATE: 'Ordine foto aggiornato',
  CONFIG_SALVATA: 'Configurazione salvata',
  ERRORE_GENERICO: 'Si è verificato un errore',
  ERRORE_RETE: 'Errore di connessione al webservice',
  CONNESSIONE_OK: 'Connessione al webservice riuscita',
  CONNESSIONE_KO: 'Impossibile raggiungere il webservice',
} as const;

/** Testi dei dialog di conferma */
export const CONFIRM_MESSAGES = {
  ELIMINA_FASCICOLO_BOZZA: {
    title: 'Elimina fascicolo',
    message: 'Eliminare il fascicolo e tutte le foto? L\'operazione non è reversibile.',
  },
  ELIMINA_FASCICOLO_INVIATO: {
    title: 'Elimina fascicolo inviato',
    message:
      'Questo fascicolo è già stato inviato al gestionale.\n\nEliminarlo rimuoverà anche tutte le foto locali. Continuare?',
  },
  ELIMINA_FOTO: {
    title: 'Elimina foto',
    message: 'Rimuovere questa foto dal fascicolo?',
  },
} as const;
