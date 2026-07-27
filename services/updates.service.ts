/**
 * @file services/updates.service.ts
 * Aggiornamenti OTA via EAS Update.
 *
 * Di suo `expo-updates` controlla già a ogni avvio e applica al lancio
 * successivo. Questo service serve al controllo manuale dalle Impostazioni,
 * utile in cantiere quando si vuole forzare l'aggiornamento senza aspettare
 * due riavvii.
 *
 * Attenzione: in Expo Go e in sviluppo la libreria è disattivata e le sue
 * funzioni sollevano eccezioni. Qui l'unico punto di verità è
 * `Updates.isEnabled`, controllato prima di ogni chiamata.
 */

import * as Updates from 'expo-updates';
import Constants from 'expo-constants';

// ─────────────────────────────────────────────
// TIPI
// ─────────────────────────────────────────────

export interface InfoVersione {
  /** false in Expo Go, in sviluppo o se la configurazione manca */
  attivo:      boolean;
  versioneApp: string;
  canale:      string | null;
  runtime:     string | null;
  /** UUID dell'update in esecuzione, null se sta girando il codice del build */
  updateId:    string | null;
  dataUpdate:  Date | null;
  /** true se il codice in esecuzione è quello incorporato nel build */
  daBuild:     boolean;
}

export type EsitoControllo =
  | { tipo: 'scaricato' }
  | { tipo: 'aggiornato' }
  | { tipo: 'disattivato' }
  | { tipo: 'errore'; messaggio: string };

// ─────────────────────────────────────────────
// LETTURA STATO
// ─────────────────────────────────────────────

/**
 * Fotografia della versione in esecuzione.
 * Non fa chiamate di rete: legge solo costanti native.
 */
export function leggiInfoVersione(): InfoVersione {
  return {
    attivo:      Updates.isEnabled,
    versioneApp: Constants.expoConfig?.version ?? '—',
    canale:      Updates.channel,
    runtime:     Updates.runtimeVersion,
    updateId:    Updates.updateId,
    dataUpdate:  Updates.createdAt,
    daBuild:     Updates.isEmbeddedLaunch,
  };
}

/** Prime 8 cifre dell'UUID: abbastanza per identificarlo nel supporto. */
export function updateIdBreve(id: string | null): string {
  return id ? id.slice(0, 8) : '—';
}

// ─────────────────────────────────────────────
// CONTROLLO E DOWNLOAD
// ─────────────────────────────────────────────

function messaggioErrore(e: unknown): string {
  if (e instanceof Error) return e.message;
  return String(e);
}

/**
 * Controlla il server, e se c'è un aggiornamento lo scarica.
 * Non riavvia: la decisione resta all'utente.
 *
 * @returns Esito da tradurre in messaggio per l'utente
 */
export async function controllaEScarica(): Promise<EsitoControllo> {
  if (!Updates.isEnabled) return { tipo: 'disattivato' };

  try {
    const controllo = await Updates.checkForUpdateAsync();
    if (!controllo.isAvailable) return { tipo: 'aggiornato' };

    const download = await Updates.fetchUpdateAsync();
    // isNew è false anche quando il server risponde con un rollback
    // all'update incorporato: in entrambi i casi non c'è nulla di nuovo.
    if (!download.isNew) return { tipo: 'aggiornato' };

    return { tipo: 'scaricato' };
  } catch (e) {
    return { tipo: 'errore', messaggio: messaggioErrore(e) };
  }
}

/**
 * Riavvia caricando l'ultima versione scaricata.
 * Da chiamare solo dopo un esito 'scaricato'.
 */
export async function riavviaConNuovaVersione(): Promise<void> {
  await Updates.reloadAsync();
}
