/**
 * @file store/config.store.ts
 * Store Zustand per la configurazione del webservice esterno.
 * Mantiene in memoria la configurazione corrente e il risultato
 * dell'ultimo test di connessione, sincronizzandosi con SQLite.
 */

import { create } from 'zustand';
import {
  getConfig,
  salvaConfig,
  eliminaConfig,
  isConfigured,
  validateConfigDTO,
} from '@/services/config.service';
import { testConnessione } from '@/services/webservice.service';
import type {
  ConfigWebservice,
  ConfigWebserviceDTO,
  LoadingState,
  TestConnessioneResult,
} from '@/types';

// ─────────────────────────────────────────────
// TIPI DELLO STORE
// ─────────────────────────────────────────────

interface ConfigState {
  // ── Dati ──
  config: ConfigWebservice | null;
  isConfigured: boolean;
  testResult: TestConnessioneResult | null;

  // ── Loading states ──
  loadingConfig: LoadingState;
  loadingTest: LoadingState;

  // ── Errori ──
  erroreConfig: string | null;

  // ── Azioni ──
  caricaConfig: () => Promise<void>;
  salvaConfig: (dto: ConfigWebserviceDTO) => Promise<void>;
  eliminaConfig: () => Promise<void>;
  testConnessione: () => Promise<TestConnessioneResult>;
  resetTestResult: () => void;
  resetErrore: () => void;

  // ── Validazione (sincrona, per i form) ──
  validateDTO: (dto: ConfigWebserviceDTO) => string | null;
}

// ─────────────────────────────────────────────
// STORE
// ─────────────────────────────────────────────

export const useConfigStore = create<ConfigState>((set, get) => ({
  // ── Stato iniziale ──
  config:        null,
  isConfigured:  false,
  testResult:    null,
  loadingConfig: 'idle',
  loadingTest:   'idle',
  erroreConfig:  null,

  // ─────────────────────────────────────────
  // LETTURA
  // ─────────────────────────────────────────

  /**
   * Carica la configurazione corrente dal DB SQLite.
   * Aggiorna `config` e `isConfigured` nello store.
   * Chiamata all'avvio dell'app e dopo ogni salvataggio.
   */
  caricaConfig: async () => {
    set({ loadingConfig: 'loading', erroreConfig: null });
    try {
      const config = await getConfig();
      const configured = await isConfigured();
      set({
        config,
        isConfigured:  configured,
        loadingConfig: 'success',
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Errore caricamento configurazione.';
      set({ loadingConfig: 'error', erroreConfig: msg });
    }
  },

  // ─────────────────────────────────────────
  // SCRITTURA
  // ─────────────────────────────────────────

  /**
   * Salva la configurazione webservice nel DB e aggiorna lo store.
   * Esegue la validazione prima della scrittura.
   *
   * @param dto - Dati della configurazione da salvare
   * @throws    Error con messaggio leggibile in caso di validazione o DB falliti
   */
  salvaConfig: async (dto: ConfigWebserviceDTO) => {
    // Validazione sincrona prima di toccare il DB
    const validErr = validateConfigDTO(dto);
    if (validErr) {
      set({ erroreConfig: validErr });
      throw new Error(validErr);
    }

    set({ loadingConfig: 'loading', erroreConfig: null });
    try {
      const saved = await salvaConfig(dto);
      set({
        config:        saved,
        isConfigured:  true,
        loadingConfig: 'success',
        testResult:    null, // Reset del test precedente dopo cambio config
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Errore salvataggio configurazione.';
      set({ loadingConfig: 'error', erroreConfig: msg });
      throw new Error(msg);
    }
  },

  /**
   * Elimina la configurazione dal DB e resetta lo store.
   */
  eliminaConfig: async () => {
    set({ loadingConfig: 'loading', erroreConfig: null });
    try {
      await eliminaConfig();
      set({
        config:        null,
        isConfigured:  false,
        loadingConfig: 'success',
        testResult:    null,
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Errore eliminazione configurazione.';
      set({ loadingConfig: 'error', erroreConfig: msg });
      throw new Error(msg);
    }
  },

  // ─────────────────────────────────────────
  // TEST CONNESSIONE
  // ─────────────────────────────────────────

  /**
   * Esegue il test di connessione al webservice e salva il risultato.
   * Aggiorna `testResult` con latenza e messaggio per la UI.
   *
   * @returns Promise con `TestConnessioneResult`
   */
  testConnessione: async (): Promise<TestConnessioneResult> => {
    set({ loadingTest: 'loading', testResult: null });
    try {
      const result = await testConnessione();
      set({
        testResult:  result,
        loadingTest: result.success ? 'success' : 'error',
      });
      return result;
    } catch (error) {
      const result: TestConnessioneResult = {
        success:    false,
        latenza_ms: null,
        messaggio:  error instanceof Error ? error.message : 'Errore test connessione.',
      };
      set({ testResult: result, loadingTest: 'error' });
      return result;
    }
  },

  // ─────────────────────────────────────────
  // VALIDAZIONE SINCRONA
  // ─────────────────────────────────────────

  /**
   * Valida un DTO senza toccare il DB.
   * Usato dai form per feedback in tempo reale.
   *
   * @param dto - DTO da validare
   * @returns   Messaggio di errore o `null` se valido
   */
  validateDTO: (dto: ConfigWebserviceDTO): string | null => {
    return validateConfigDTO(dto);
  },

  // ─────────────────────────────────────────
  // RESET
  // ─────────────────────────────────────────

  /** Azzera il risultato del test di connessione. */
  resetTestResult: () => set({ testResult: null, loadingTest: 'idle' }),

  /** Azzera il messaggio di errore della configurazione. */
  resetErrore: () => set({ erroreConfig: null }),
}));
