/**
 * @file hooks/useConfig.ts
 * Hook per la schermata Impostazioni.
 * Gestisce lo stato del form di configurazione webservice,
 * la validazione in tempo reale, la selezione del logo società
 * e il test di connessione (autenticazione OAuth reale).
 */

import { useState, useEffect, useCallback } from 'react';
import * as ImagePicker from 'expo-image-picker';
import { useConfigStore } from '@/store/config.store';
import {
  WS_DEFAULT_TIMEOUT_MS,
  WS_DEFAULT_AUTH_ENDPOINT,
  WS_DEFAULT_INVIO_ENDPOINT,
  DESCRIZIONE_FOTO_MAX_LEN,
  CATALOGO_FOTO_MAX_LEN,
} from '@/constants';
import type {
  ConfigWebservice,
  ConfigWebserviceDTO,
  TestConnessioneResult,
} from '@/types';

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
  scegliLogo: () => Promise<void>;
  rimuoviLogo: () => void;
  salva: () => Promise<boolean>;
  elimina: () => Promise<void>;
  eseguiTest: () => Promise<void>;
  resetForm: () => void;
}

// ─────────────────────────────────────────────
// HOOK
// ─────────────────────────────────────────────

const defaultValues: ConfigWebserviceDTO = {
  base_url:         '',
  therm_token:      '',
  auth_endpoint:    WS_DEFAULT_AUTH_ENDPOINT,
  invio_endpoint:   WS_DEFAULT_INVIO_ENDPOINT,
  nome_societa:     '',
  logo_base64:      '',
  descrizione_foto: '',
  catalogo_foto:    '',
  timeout_ms:       WS_DEFAULT_TIMEOUT_MS,
};

/**
 * Proietta la configurazione salvata sui valori del form.
 * Usata sia al caricamento iniziale che dal reset, così i due
 * percorsi non possono divergere quando si aggiungono campi.
 *
 * @param config - Configurazione letta dal DB
 * @returns      DTO pronto per il form
 */
function configToFormValues(config: ConfigWebservice): ConfigWebserviceDTO {
  return {
    base_url:         config.base_url,
    therm_token:      config.therm_token,
    auth_endpoint:    config.auth_endpoint,
    invio_endpoint:   config.invio_endpoint,
    nome_societa:     config.nome_societa,
    logo_base64:      config.logo_base64,
    descrizione_foto: config.descrizione_foto,
    catalogo_foto:    config.catalogo_foto,
    timeout_ms:       config.timeout_ms,
  };
}

/**
 * Gestisce il form di configurazione webservice con validazione
 * in tempo reale e feedback per il test di connessione.
 *
 * @returns `UseConfigResult` con valori, errori e azioni del form
 */
export function useConfig(): UseConfigResult {
  const config        = useConfigStore((s) => s.config);
  const isConfigured  = useConfigStore((s) => s.isConfigured);
  const loadingConfig = useConfigStore((s) => s.loadingConfig);
  const loadingTest   = useConfigStore((s) => s.loadingTest);
  const testResult    = useConfigStore((s) => s.testResult);
  const salvaConfigFn   = useConfigStore((s) => s.salvaConfig);
  const eliminaConfigFn = useConfigStore((s) => s.eliminaConfig);
  const testFn          = useConfigStore((s) => s.testConnessione);
  const validateFn      = useConfigStore((s) => s.validateDTO);

  const [formValues, setFormValues] = useState<ConfigWebserviceDTO>(defaultValues);
  const [fieldErrors, setFieldErrors] = useState<
    Partial<Record<keyof ConfigWebserviceDTO, string>>
  >({});
  const [isDirty, setIsDirty] = useState(false);

  // ── Popola il form con la config esistente ──
  useEffect(() => {
    if (config) {
      setFormValues(configToFormValues(config));
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
        const errors: Partial<Record<keyof ConfigWebserviceDTO, string>> = {
          [field]: undefined,
        };

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

        if (field === 'therm_token' && !String(value).trim()) {
          errors.therm_token = 'Therm token obbligatorio.';
        }

        if (field === 'auth_endpoint' && !String(value).trim()) {
          errors.auth_endpoint = 'Endpoint obbligatorio.';
        }

        if (field === 'invio_endpoint' && !String(value).trim()) {
          errors.invio_endpoint = 'Endpoint obbligatorio.';
        }

        if (field === 'nome_societa' && String(value).trim().length > 60) {
          errors.nome_societa = 'Massimo 60 caratteri.';
        }

        if (
          field === 'descrizione_foto' &&
          String(value).trim().length > DESCRIZIONE_FOTO_MAX_LEN
        ) {
          errors.descrizione_foto = `Massimo ${DESCRIZIONE_FOTO_MAX_LEN} caratteri.`;
        }

        if (
          field === 'catalogo_foto' &&
          String(value).trim().length > CATALOGO_FOTO_MAX_LEN
        ) {
          errors.catalogo_foto = `Massimo ${CATALOGO_FOTO_MAX_LEN} caratteri.`;
        }

        if (field === 'timeout_ms') {
          const ms = Number(value);
          if (ms < 1000 || ms > 120_000) {
            errors.timeout_ms = 'Tra 1000 e 120000 ms.';
          }
        }

        setFieldErrors((prevErr) => ({ ...prevErr, ...errors }));
        return next;
      });
      setIsDirty(true);
    },
    []
  );

  // ─────────────────────────────────────────
  // LOGO SOCIETÀ
  // ─────────────────────────────────────────

  /**
   * Apre la libreria immagini e salva il logo scelto come base64.
   * L'immagine viene ridimensionata dal picker (quality bassa)
   * per non appesantire il DB.
   */
  const scegliLogo = useCallback(async () => {
    const permesso = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permesso.granted) {
      setFieldErrors((prev) => ({
        ...prev,
        logo_base64: 'Permesso libreria foto negato.',
      }));
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes:    ['images'],
      allowsEditing: true,
      aspect:        [1, 1],
      quality:       0.5,
      base64:        true,
    });

    if (!result.canceled && result.assets[0]?.base64) {
      setField('logo_base64', result.assets[0].base64);
    }
  }, [setField]);

  /** Rimuove il logo corrente dal form. */
  const rimuoviLogo = useCallback(() => {
    setField('logo_base64', '');
  }, [setField]);

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
   * Salva prima la configurazione (se dirty) poi esegue il test
   * di autenticazione reale sull'endpoint OAuth.
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
      setFormValues(configToFormValues(config));
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
    isSaving:  loadingConfig === 'loading',
    isTesting: loadingTest   === 'loading',
    testResult,
    isConfigured,
    setField,
    scegliLogo,
    rimuoviLogo,
    salva,
    elimina,
    eseguiTest,
    resetForm,
  };
}
