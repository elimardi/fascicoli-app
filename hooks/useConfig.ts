/**
 * @file hooks/useConfig.ts
 * Hook per la schermata Impostazioni.
 * Gestisce lo stato del form di configurazione webservice,
 * la validazione in tempo reale e il test di connessione.
 */

import { useState, useEffect, useCallback } from 'react';
import { useConfigStore } from '@/store/config.store';
import { WS_DEFAULT_TIMEOUT_MS } from '@/constants';
import type { ConfigWebserviceDTO, TestConnessioneResult } from '@/types';

// ─────────────────────────────────────────────
// TIPI
// ─────────────────────────────────────────────

export interface UseConfigResult {
  // ── Valori form ──
  formValues: ConfigWebserviceDTO;
  fieldErrors: Partial<Record<keyof ConfigWebserviceDTO, string>>;
  isDirty: boolean;

  // ── Stato ──
  isSaving: boolean;
  isTesting: boolean;
  testResult: TestConnessioneResult | null;
  isConfigured: boolean;

  // ── Azioni form ──
  setField: <K extends keyof ConfigWebserviceDTO>(
    field: K,
    value: ConfigWebserviceDTO[K]
  ) => void;
  salva: () => Promise<boolean>;
  elimina: () => Promise<void>;
  eseguiTest: () => Promise<void>;
  resetForm: () => void;
}

// ─────────────────────────────────────────────
// HOOK
// ─────────────────────────────────────────────

/**
 * Gestisce il form di configurazione webservice con validazione
 * in tempo reale e feedback per il test di connessione.
 *
 * @returns `UseConfigResult` con valori, errori e azioni del form
 *
 * @example
 * const { formValues, setField, salva, eseguiTest, testResult } = useConfig();
 */
export function useConfig(): UseConfigResult {
  const config       = useConfigStore((s) => s.config);
  const isConfigured = useConfigStore((s) => s.isConfigured);
  const loadingConfig = useConfigStore((s) => s.loadingConfig);
  const loadingTest  = useConfigStore((s) => s.loadingTest);
  const testResult   = useConfigStore((s) => s.testResult);
  const salvaConfigFn   = useConfigStore((s) => s.salvaConfig);
  const eliminaConfigFn = useConfigStore((s) => s.eliminaConfig);
  const testFn          = useConfigStore((s) => s.testConnessione);
  const validateFn      = useConfigStore((s) => s.validateDTO);

  // ── Stato form locale ──
  const defaultValues: ConfigWebserviceDTO = {
    base_url:   '',
    auth_token: '',
    timeout_ms: WS_DEFAULT_TIMEOUT_MS,
  };

  const [formValues, setFormValues] = useState<ConfigWebserviceDTO>(defaultValues);
  const [fieldErrors, setFieldErrors] = useState<
    Partial<Record<keyof ConfigWebserviceDTO, string>>
  >({});
  const [isDirty, setIsDirty] = useState(false);

  // ── Popola il form con la config esistente ──
  useEffect(() => {
    if (config) {
      setFormValues({
        base_url:   config.base_url,
        auth_token: config.auth_token,
        timeout_ms: config.timeout_ms,
      });
      setIsDirty(false);
    }
  }, [config]);

  // ─────────────────────────────────────────
  // VALIDAZIONE IN TEMPO REALE
  // ─────────────────────────────────────────

  /**
   * Aggiorna un campo del form e valida in tempo reale.
   * Marca il form come "dirty" al primo cambiamento.
   */
  const setField = useCallback(
    <K extends keyof ConfigWebserviceDTO>(
      field: K,
      value: ConfigWebserviceDTO[K]
    ) => {
      setFormValues((prev) => {
        const next = { ...prev, [field]: value };

        // Validazione campo per campo
        const errors: Partial<Record<keyof ConfigWebserviceDTO, string>> = {};

        if (field === 'base_url') {
          const url = String(value).trim();
          if (!url) {
            errors.base_url = 'URL obbligatorio.';
          } else {
            try {
              const parsed = new URL(url);
              if (!['http:', 'https:'].includes(parsed.protocol)) {
                errors.base_url = 'Usa http:// o https://';
              }
            } catch {
              errors.base_url = 'URL non valido.';
            }
          }
        }

        if (field === 'auth_token') {
          if (!String(value).trim()) {
            errors.auth_token = 'Token obbligatorio.';
          }
        }

        if (field === 'timeout_ms') {
          const ms = Number(value);
          if (ms < 1000 || ms > 120_000) {
            errors.timeout_ms = 'Tra 1000 e 120000 ms.';
          }
        }

        setFieldErrors((prev) => ({ ...prev, ...errors }));
        return next;
      });
      setIsDirty(true);
    },
    []
  );

  // ─────────────────────────────────────────
  // SALVATAGGIO
  // ─────────────────────────────────────────

  /**
   * Valida e salva la configurazione.
   * Restituisce `true` se salvato con successo, `false` altrimenti.
   */
  const salva = useCallback(async (): Promise<boolean> => {
    const globalError = validateFn(formValues);
    if (globalError) {
      setFieldErrors({ base_url: globalError });
      return false;
    }

    try {
      await salvaConfigFn(formValues);
      setIsDirty(false);
      setFieldErrors({});
      return true;
    } catch {
      return false;
    }
  }, [formValues, salvaConfigFn, validateFn]);

  // ─────────────────────────────────────────
  // ELIMINAZIONE
  // ─────────────────────────────────────────

  /**
   * Elimina la configurazione e resetta il form ai valori default.
   */
  const elimina = useCallback(async () => {
    await eliminaConfigFn();
    setFormValues(defaultValues);
    setFieldErrors({});
    setIsDirty(false);
  }, [eliminaConfigFn]);

  // ─────────────────────────────────────────
  // TEST CONNESSIONE
  // ─────────────────────────────────────────

  /**
   * Salva prima la configurazione (se dirty) poi esegue il test.
   * Se il salvataggio fallisce non esegue il test.
   */
  const eseguiTest = useCallback(async () => {
    if (isDirty) {
      const saved = await salva();
      if (!saved) return;
    }
    await testFn();
  }, [isDirty, salva, testFn]);

  // ─────────────────────────────────────────
  // RESET
  // ─────────────────────────────────────────

  /**
   * Ripristina il form ai valori dell'ultima configurazione salvata.
   */
  const resetForm = useCallback(() => {
    if (config) {
      setFormValues({
        base_url:   config.base_url,
        auth_token: config.auth_token,
        timeout_ms: config.timeout_ms,
      });
    } else {
      setFormValues(defaultValues);
    }
    setFieldErrors({});
    setIsDirty(false);
  }, [config]);

  return {
    formValues,
    fieldErrors,
    isDirty,
    isSaving:     loadingConfig === 'loading',
    isTesting:    loadingTest   === 'loading',
    testResult,
    isConfigured,
    setField,
    salva,
    elimina,
    eseguiTest,
    resetForm,
  };
}
