/**
 * @file store/fascicoli.store.ts
 * Store Zustand per la gestione reattiva di fascicoli e foto.
 * Funge da layer di caching in-memory sopra i service SQLite:
 * le schermate leggono dallo store, i service scrivono su DB,
 * lo store si sincronizza dopo ogni operazione.
 */

import { create } from 'zustand';
import {
  getAllFascicoli,
  getFascicoloById,
  creaFascicolo,
  aggiornFascicolo,
  eliminaFascicolo,
  segnaFascicoloInviato,
  segnaFascicoloErrore,
  type FascicoloConFoto,
} from '@/services/fascicoli.service';
import {
  getFotoByFascicolo,
  aggiungiFoto,
  eliminaFoto,
  aggiornOrdinamento,
  eliminaFileFotoDiFascicolo,
} from '@/services/foto.service';
import { inviaFascicolo } from '@/services/webservice.service';
import type {
  Fascicolo,
  Foto,
  CreaFascicoloDTO,
  AggiorneFascicoloDTO,
  LoadingState,
  InvioResult,
} from '@/types';

// ─────────────────────────────────────────────
// TIPI DELLO STORE
// ─────────────────────────────────────────────

interface FascicoliState {
  // ── Dati ──
  fascicoli: FascicoloConFoto[];
  fascicoloCorrente: Fascicolo | null;
  fotoCorrente: Foto[];

  // ── Loading states granulari ──
  loadingLista: LoadingState;
  loadingDettaglio: LoadingState;
  loadingInvio: LoadingState;
  loadingFoto: LoadingState;

  // ── Errori ──
  erroreLista: string | null;
  erroreDettaglio: string | null;
  erroreInvio: string | null;
  erroreFoto: string | null;

  // ── Azioni: Lista ──
  caricaFascicoli: () => Promise<void>;

  // ── Azioni: Dettaglio ──
  caricaFascicolo: (id: number) => Promise<void>;
  caricaFoto: (fascicoloId: number) => Promise<void>;

  // ── Azioni: CRUD Fascicoli ──
  creaFascicolo: (dto: CreaFascicoloDTO) => Promise<Fascicolo>;
  aggiornFascicolo: (id: number, dto: AggiorneFascicoloDTO) => Promise<void>;
  eliminaFascicolo: (id: number) => Promise<void>;

  // ── Azioni: Foto ──
  aggiungiFoto: (fascicoloId: number, percorsoTemp: string, dataScatto?: string) => Promise<Foto>;
  eliminaFoto: (fotoId: number) => Promise<void>;
  riordinaFoto: (fascicoloId: number, fotoOrdinate: Foto[]) => Promise<void>;

  // ── Azioni: Invio ──
  inviaFascicolo: (fascicolo: Fascicolo, codiceDocumento: string) => Promise<InvioResult>;

  // ── Azioni: Reset ──
  resetErrori: () => void;
  resetFascicoloCorrente: () => void;
}

// ─────────────────────────────────────────────
// STORE
// ─────────────────────────────────────────────

export const useFascicoliStore = create<FascicoliState>((set, get) => ({
  // ── Stato iniziale ──
  fascicoli:           [],
  fascicoloCorrente:   null,
  fotoCorrente:        [],
  loadingLista:        'idle',
  loadingDettaglio:    'idle',
  loadingInvio:        'idle',
  loadingFoto:         'idle',
  erroreLista:         null,
  erroreDettaglio:     null,
  erroreInvio:         null,
  erroreFoto:          null,

  // ─────────────────────────────────────────
  // LISTA FASCICOLI
  // ─────────────────────────────────────────

  /**
   * Carica tutti i fascicoli con conteggio foto dal DB.
   * Aggiorna `fascicoli` nello store.
   */
  caricaFascicoli: async () => {
    set({ loadingLista: 'loading', erroreLista: null });
    try {
      const fascicoli = await getAllFascicoli();
      set({ fascicoli, loadingLista: 'success' });
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Errore caricamento fascicoli.';
      set({ loadingLista: 'error', erroreLista: msg });
    }
  },

  // ─────────────────────────────────────────
  // DETTAGLIO FASCICOLO
  // ─────────────────────────────────────────

  /**
   * Carica un singolo fascicolo per la schermata dettaglio.
   * Aggiorna `fascicoloCorrente`.
   */
  caricaFascicolo: async (id: number) => {
    set({ loadingDettaglio: 'loading', erroreDettaglio: null });
    try {
      const fascicolo = await getFascicoloById(id);
      if (!fascicolo) {
        throw new Error(`Fascicolo ${id} non trovato.`);
      }
      set({ fascicoloCorrente: fascicolo, loadingDettaglio: 'success' });
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Errore caricamento fascicolo.';
      set({ loadingDettaglio: 'error', erroreDettaglio: msg });
    }
  },

  /**
   * Carica le foto di un fascicolo per la griglia.
   * Aggiorna `fotoCorrente`.
   */
  caricaFoto: async (fascicoloId: number) => {
    set({ loadingFoto: 'loading', erroreFoto: null });
    try {
      const foto = await getFotoByFascicolo(fascicoloId);
      set({ fotoCorrente: foto, loadingFoto: 'success' });
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Errore caricamento foto.';
      set({ loadingFoto: 'error', erroreFoto: msg });
    }
  },

  // ─────────────────────────────────────────
  // CRUD FASCICOLI
  // ─────────────────────────────────────────

  /**
   * Crea un nuovo fascicolo e aggiorna la lista nello store.
   * Restituisce il fascicolo creato per il redirect immediato.
   */
  creaFascicolo: async (dto: CreaFascicoloDTO) => {
    const fascicolo = await creaFascicolo(dto);
    // Aggiorna la lista in background senza bloccare il redirect
    get().caricaFascicoli().catch(console.error);
    return fascicolo;
  },

  /**
   * Aggiorna i campi di un fascicolo e risincronizza store e lista.
   */
  aggiornFascicolo: async (id: number, dto: AggiorneFascicoloDTO) => {
    const updated = await aggiornFascicolo(id, dto);
    // Aggiorna fascicoloCorrente se è quello modificato
    if (get().fascicoloCorrente?.id === id) {
      set({ fascicoloCorrente: updated });
    }
    // Risincronizza la lista
    get().caricaFascicoli().catch(console.error);
  },

  /**
   * Elimina un fascicolo: prima i file fisici, poi il record DB,
   * poi aggiorna la lista nello store.
   */
  eliminaFascicolo: async (id: number) => {
    // 1. Elimina file fisici (directory intera del fascicolo)
    await eliminaFileFotoDiFascicolo(id);
    // 2. Elimina record DB (CASCADE sulle foto)
    await eliminaFascicolo(id);
    // 3. Aggiorna store
    set((state) => ({
      fascicoli: state.fascicoli.filter((f) => f.id !== id),
      fascicoloCorrente:
        state.fascicoloCorrente?.id === id ? null : state.fascicoloCorrente,
    }));
  },

  // ─────────────────────────────────────────
  // GESTIONE FOTO
  // ─────────────────────────────────────────

  /**
   * Aggiunge una foto al fascicolo corrente.
   * Aggiorna `fotoCorrente` e il conteggio nella lista.
   */
  aggiungiFoto: async (
    fascicoloId: number,
    percorsoTemp: string,
    dataScatto?: string
  ) => {
    set({ loadingFoto: 'loading', erroreFoto: null });
    try {
      const foto = await aggiungiFoto(fascicoloId, percorsoTemp, dataScatto);
      set((state) => ({
        fotoCorrente: [...state.fotoCorrente, foto],
        loadingFoto: 'success',
        // Aggiorna il conteggio foto nella lista
        fascicoli: state.fascicoli.map((f) =>
          f.id === fascicoloId
            ? { ...f, numero_foto: f.numero_foto + 1 }
            : f
        ),
      }));
      return foto;
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Errore aggiunta foto.';
      set({ loadingFoto: 'error', erroreFoto: msg });
      throw error;
    }
  },

  /**
   * Elimina una foto dal fascicolo corrente.
   * Aggiorna `fotoCorrente` e il conteggio nella lista.
   */
  eliminaFoto: async (fotoId: number) => {
    set({ loadingFoto: 'loading', erroreFoto: null });
    try {
      const fotoTarget = get().fotoCorrente.find((f) => f.id === fotoId);
      await eliminaFoto(fotoId);
      set((state) => ({
        fotoCorrente: state.fotoCorrente.filter((f) => f.id !== fotoId),
        loadingFoto: 'success',
        fascicoli: fotoTarget
          ? state.fascicoli.map((f) =>
              f.id === fotoTarget.fascicolo_id
                ? { ...f, numero_foto: Math.max(0, f.numero_foto - 1) }
                : f
            )
          : state.fascicoli,
      }));
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Errore eliminazione foto.';
      set({ loadingFoto: 'error', erroreFoto: msg });
      throw error;
    }
  },

  /**
   * Riordina le foto dopo il drag-and-drop.
   * Aggiorna `fotoCorrente` ottimisticamente prima della scrittura DB.
   */
  riordinaFoto: async (fascicoloId: number, fotoOrdinate: Foto[]) => {
    // Aggiornamento ottimistico: UI risponde immediatamente
    set({ fotoCorrente: fotoOrdinate });
    try {
      await aggiornOrdinamento(fascicoloId, fotoOrdinate);
    } catch (error) {
      // In caso di errore DB, ricarica dal DB per ripristinare
      const foto = await getFotoByFascicolo(fascicoloId);
      set({ fotoCorrente: foto });
      throw error;
    }
  },

  // ─────────────────────────────────────────
  // INVIO AL WEBSERVICE
  // ─────────────────────────────────────────

  /**
   * Invia il fascicolo al webservice esterno.
   * Aggiorna lo stato del fascicolo in store al termine,
   * sia in caso di successo che di errore.
   */
  inviaFascicolo: async (
    fascicolo: Fascicolo,
    codiceDocumento: string
  ): Promise<InvioResult> => {
    set({ loadingInvio: 'loading', erroreInvio: null });
    try {
      const result = await inviaFascicolo(fascicolo, codiceDocumento);

      // Ricarica il fascicolo aggiornato dallo store
      await get().caricaFascicolo(fascicolo.id);
      await get().caricaFascicoli();

      set({
        loadingInvio: result.success ? 'success' : 'error',
        erroreInvio:  result.success ? null : result.messaggio,
      });

      return result;
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Errore durante l\'invio.';
      set({ loadingInvio: 'error', erroreInvio: msg });
      return {
        success:   false,
        esitoJson: JSON.stringify({ errore: msg }),
        messaggio: msg,
      };
    }
  },

  // ─────────────────────────────────────────
  // RESET
  // ─────────────────────────────────────────

  /** Azzera tutti i messaggi di errore. */
  resetErrori: () =>
    set({
      erroreLista:     null,
      erroreDettaglio: null,
      erroreInvio:     null,
      erroreFoto:      null,
    }),

  /** Pulisce il fascicolo corrente e le foto (es. alla navigazione back). */
  resetFascicoloCorrente: () =>
    set({
      fascicoloCorrente: null,
      fotoCorrente:      [],
      loadingDettaglio:  'idle',
      loadingFoto:       'idle',
      erroreDettaglio:   null,
      erroreFoto:        null,
    }),
}));
