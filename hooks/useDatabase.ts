/**
 * @file hooks/useDatabase.ts
 * Hook per l'inizializzazione del database SQLite e il caricamento
 * della configurazione all'avvio dell'app.
 * Deve essere chiamato una sola volta nel root layout (_layout.tsx).
 */

import { useEffect, useState, useCallback } from 'react';
import { initDatabase } from '@/services/db';
import { useConfigStore } from '@/store/config.store';
import { useFascicoliStore } from '@/store/fascicoli.store';

// ─────────────────────────────────────────────
// TIPI
// ─────────────────────────────────────────────

export interface UseDatabaseResult {
  /** true quando DB è pronto e dati iniziali sono caricati */
  isReady: boolean;
  /** Messaggio di errore se l'inizializzazione fallisce */
  error: string | null;
  /** Forza una reinizializzazione (utile in caso di errore) */
  retry: () => void;
}

// ─────────────────────────────────────────────
// HOOK
// ─────────────────────────────────────────────

/**
 * Inizializza il database SQLite ed esegue il caricamento
 * iniziale dei dati (configurazione webservice, lista fascicoli).
 * Gestisce gli stati loading/error per il splash screen.
 *
 * @returns `UseDatabaseResult` con stato di readiness e funzione retry
 *
 * @example
 * // In app/_layout.tsx
 * const { isReady, error, retry } = useDatabase();
 * if (!isReady) return <SplashScreen />;
 * if (error) return <ErrorScreen onRetry={retry} />;
 */
export function useDatabase(): UseDatabaseResult {
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  const caricaConfig = useConfigStore((s) => s.caricaConfig);
  const caricaFascicoli = useFascicoliStore((s) => s.caricaFascicoli);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      setIsReady(false);
      setError(null);

      try {
        // 1. Inizializza DB e applica migrations pendenti
        await initDatabase();

        if (cancelled) return;

        // 2. Carica configurazione webservice in parallelo con i fascicoli
        await Promise.all([
          caricaConfig(),
          caricaFascicoli(),
        ]);

        if (cancelled) return;

        setIsReady(true);
      } catch (err) {
        if (cancelled) return;
        const msg = err instanceof Error
          ? err.message
          : 'Errore inizializzazione database.';
        console.error('[useDatabase] Errore init:', err);
        setError(msg);
      }
    }

    init();

    return () => {
      cancelled = true;
    };
  }, [retryCount, caricaConfig, caricaFascicoli]);

  const retry = useCallback(() => {
    setRetryCount((c) => c + 1);
  }, []);

  return { isReady, error, retry };
}
