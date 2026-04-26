/**
 * @file hooks/useFascicolo.ts
 * Hook per la schermata dettaglio fascicolo.
 * Gestisce il caricamento, il refresh e il ciclo di vita
 * del fascicolo corrente e delle sue foto.
 */

import { useEffect, useCallback, useRef } from 'react';
import { useFascicoliStore } from '@/store/fascicoli.store';
import type { Fascicolo, Foto, AggiorneFascicoloDTO, InvioResult } from '@/types';

// ─────────────────────────────────────────────
// TIPI
// ─────────────────────────────────────────────

export interface UseFascicoloResult {
  // ── Dati ──
  fascicolo: Fascicolo | null;
  foto: Foto[];

  // ── Loading states ──
  loadingDettaglio: boolean;
  loadingFoto: boolean;
  loadingInvio: boolean;

  // ── Errori ──
  erroreDettaglio: string | null;
  erroreFoto: string | null;
  erroreInvio: string | null;

  // ── Azioni ──
  refresh: () => Promise<void>;
  aggiorna: (dto: AggiorneFascicoloDTO) => Promise<void>;
  aggiungi: (percorsoTemp: string, dataScatto?: string) => Promise<Foto>;
  eliminaFoto: (fotoId: number) => Promise<void>;
  riordina: (fotoOrdinate: Foto[]) => Promise<void>;
  invia: (codiceDocumento: string) => Promise<InvioResult>;
}

// ─────────────────────────────────────────────
// HOOK
// ─────────────────────────────────────────────

/**
 * Carica e gestisce il fascicolo con l'ID specificato.
 * Esegue il caricamento iniziale al mount e pulisce lo store al dismount.
 *
 * @param fascicoloId - ID del fascicolo da gestire
 * @returns           `UseFascicoloResult` con dati e azioni
 *
 * @example
 * // In app/fascicolo/[id].tsx
 * const { fascicolo, foto, loadingDettaglio, invia } = useFascicolo(Number(id));
 */
export function useFascicolo(fascicoloId: number): UseFascicoloResult {
  // Selettori dallo store (granulari per evitare re-render inutili)
  const fascicolo       = useFascicoliStore((s) => s.fascicoloCorrente);
  const foto            = useFascicoliStore((s) => s.fotoCorrente);
  const loadingDettaglio = useFascicoliStore((s) => s.loadingDettaglio === 'loading');
  const loadingFoto     = useFascicoliStore((s) => s.loadingFoto === 'loading');
  const loadingInvio    = useFascicoliStore((s) => s.loadingInvio === 'loading');
  const erroreDettaglio = useFascicoliStore((s) => s.erroreDettaglio);
  const erroreFoto      = useFascicoliStore((s) => s.erroreFoto);
  const erroreInvio     = useFascicoliStore((s) => s.erroreInvio);

  // Azioni dallo store
  const caricaFascicolo     = useFascicoliStore((s) => s.caricaFascicolo);
  const caricaFoto          = useFascicoliStore((s) => s.caricaFoto);
  const aggiornFascicoloFn  = useFascicoliStore((s) => s.aggiornFascicolo);
  const aggiungiFotoFn      = useFascicoliStore((s) => s.aggiungiFoto);
  const eliminaFotoFn       = useFascicoliStore((s) => s.eliminaFoto);
  const riordinaFotoFn      = useFascicoliStore((s) => s.riordinaFoto);
  const inviaFascicoloFn    = useFascicoliStore((s) => s.inviaFascicolo);
  const resetFascicoloCorrente = useFascicoliStore((s) => s.resetFascicoloCorrente);

  // Ref per evitare doppio caricamento in StrictMode
  const initialLoadDone = useRef(false);

  // ── Caricamento iniziale ──
  useEffect(() => {
    if (initialLoadDone.current) return;
    initialLoadDone.current = true;

    async function load() {
      await caricaFascicolo(fascicoloId);
      await caricaFoto(fascicoloId);
    }

    load().catch(console.error);

    // Cleanup al dismount: resetta fascicolo e foto correnti
    return () => {
      resetFascicoloCorrente();
      initialLoadDone.current = false;
    };
  }, [fascicoloId, caricaFascicolo, caricaFoto, resetFascicoloCorrente]);

  // ─────────────────────────────────────────
  // AZIONI WRAPPATE
  // ─────────────────────────────────────────

  /**
   * Ricarica fascicolo e foto dal DB.
   * Usato per pull-to-refresh e dopo operazioni critiche.
   */
  const refresh = useCallback(async () => {
    await Promise.all([
      caricaFascicolo(fascicoloId),
      caricaFoto(fascicoloId),
    ]);
  }, [fascicoloId, caricaFascicolo, caricaFoto]);

  /**
   * Aggiorna i metadati del fascicolo corrente.
   */
  const aggiorna = useCallback(
    async (dto: AggiorneFascicoloDTO) => {
      await aggiornFascicoloFn(fascicoloId, dto);
    },
    [fascicoloId, aggiornFascicoloFn]
  );

  /**
   * Aggiunge una foto al fascicolo corrente.
   * Restituisce la foto creata (utile per navigazione post-scatto).
   */
  const aggiungi = useCallback(
    async (percorsoTemp: string, dataScatto?: string): Promise<Foto> => {
      return aggiungiFotoFn(fascicoloId, percorsoTemp, dataScatto);
    },
    [fascicoloId, aggiungiFotoFn]
  );

  /**
   * Elimina una foto dal fascicolo corrente per ID.
   */
  const eliminaFoto = useCallback(
    async (fotoId: number) => {
      await eliminaFotoFn(fotoId);
    },
    [eliminaFotoFn]
  );

  /**
   * Riordina le foto dopo drag-and-drop.
   */
  const riordina = useCallback(
    async (fotoOrdinate: Foto[]) => {
      await riordinaFotoFn(fascicoloId, fotoOrdinate);
    },
    [fascicoloId, riordinaFotoFn]
  );

  /**
   * Invia il fascicolo al webservice con il codice documento.
   * Richiede che `fascicolo` non sia null.
   */
  const invia = useCallback(
    async (codiceDocumento: string): Promise<InvioResult> => {
      if (!fascicolo) {
        return {
          success:   false,
          esitoJson: JSON.stringify({ errore: 'Fascicolo non caricato.' }),
          messaggio: 'Fascicolo non caricato.',
        };
      }
      return inviaFascicoloFn(fascicolo, codiceDocumento);
    },
    [fascicolo, inviaFascicoloFn]
  );

  return {
    fascicolo,
    foto,
    loadingDettaglio,
    loadingFoto,
    loadingInvio,
    erroreDettaglio,
    erroreFoto,
    erroreInvio,
    refresh,
    aggiorna,
    aggiungi,
    eliminaFoto,
    riordina,
    invia,
  };
}
