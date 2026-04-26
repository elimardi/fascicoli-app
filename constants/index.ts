/**
 * @file constants/index.ts
 * Costanti globali dell'applicazione.
 * Centralizza valori magic string e configurazioni di default.
 */

/** Nome del database SQLite locale */
export const DB_NAME = 'fascicoli.db';

/** Versione corrente dello schema DB (incrementare ad ogni migration) */
export const DB_VERSION = 1;

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
  { bg: string; text: string; border: string; label: string }
> = {
  bozza: {
    bg: '#FEF3C7',
    text: '#92400E',
    border: '#F59E0B',
    label: 'Bozza',
  },
  inviato: {
    bg: '#D1FAE5',
    text: '#065F46',
    border: '#10B981',
    label: 'Inviato',
  },
  errore: {
    bg: '#FEE2E2',
    text: '#991B1B',
    border: '#EF4444',
    label: 'Errore',
  },
};

/** Messaggi toast standard */
export const TOAST_MESSAGES = {
  FASCICOLO_CREATO: 'Fascicolo creato con successo',
  FASCICOLO_ELIMINATO: 'Fascicolo eliminato',
  FASCICOLO_INVIATO: 'Fascicolo inviato al gestionale',
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
