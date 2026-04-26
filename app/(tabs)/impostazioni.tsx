/**
 * @file app/(tabs)/impostazioni.tsx
 * Schermata Impostazioni — configurazione del webservice esterno.
 * Features:
 * - Form con URL base, token autenticazione, timeout
 * - Validazione in tempo reale per campo
 * - Pulsante "Test connessione" con badge latenza
 * - Salvataggio con feedback toast
 * - Indicatore stato connessione (verde/rosso/grigio)
 */

import React, { useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Switch,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import { useConfig } from '@/hooks/useConfig';
import { FormField, LoadingButton } from '@/components';
import { TOAST_MESSAGES, WS_DEFAULT_TIMEOUT_MS } from '@/constants';

// ─────────────────────────────────────────────
// SOTTO-COMPONENTI
// ─────────────────────────────────────────────

interface ConnessioneBadgeProps {
  success: boolean | null;
  latenza: number | null;
  messaggio: string;
}

/**
 * Badge colorato che mostra lo stato dell'ultima connessione testata.
 */
function ConnessioneBadge({ success, latenza, messaggio }: ConnessioneBadgeProps) {
  const color = success === null ? '#9CA3AF' : success ? '#10B981' : '#EF4444';
  const bg    = success === null ? '#F3F4F6' : success ? '#D1FAE5' : '#FEE2E2';
  const border = success === null ? '#E5E7EB' : success ? '#6EE7B7' : '#FCA5A5';

  return (
    <View style={[badgeStyles.container, { backgroundColor: bg, borderColor: border }]}>
      <View style={[badgeStyles.dot, { backgroundColor: color }]} />
      <View style={badgeStyles.textWrap}>
        <Text style={[badgeStyles.messaggio, { color }]} numberOfLines={2}>
          {messaggio}
        </Text>
        {latenza !== null && (
          <Text style={badgeStyles.latenza}>{latenza} ms</Text>
        )}
      </View>
    </View>
  );
}

// ─────────────────────────────────────────────
// SCHERMATA PRINCIPALE
// ─────────────────────────────────────────────

export default function ImpostazioniScreen() {
  const insets = useSafeAreaInsets();

  const {
    formValues,
    fieldErrors,
    isDirty,
    isSaving,
    isTesting,
    testResult,
    isConfigured,
    setField,
    salva,
    elimina,
    eseguiTest,
  } = useConfig();

  // ─────────────────────────────────────────
  // HANDLERS
  // ─────────────────────────────────────────

  const handleSalva = useCallback(async () => {
    const ok = await salva();
    if (ok) {
      Toast.show({
        type:  'success',
        text1: TOAST_MESSAGES.CONFIG_SALVATA,
      });
    } else {
      Toast.show({
        type:  'error',
        text1: 'Errore salvataggio',
        text2: 'Controlla i campi evidenziati.',
      });
    }
  }, [salva]);

  const handleTest = useCallback(async () => {
    await eseguiTest();
  }, [eseguiTest]);

  const handleElimina = useCallback(() => {
    Alert.alert(
      'Elimina configurazione',
      'Rimuovere la configurazione del webservice? Non potrai più inviare fascicoli fino alla prossima configurazione.',
      [
        { text: 'Annulla', style: 'cancel' },
        {
          text:    'Elimina',
          style:   'destructive',
          onPress: async () => {
            await elimina();
            Toast.show({
              type:  'info',
              text1: 'Configurazione eliminata',
            });
          },
        },
      ]
    );
  }, [elimina]);

  // ─────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={[
        styles.content,
        { paddingBottom: insets.bottom + 32 },
      ]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {/* ── Sezione: Stato configurazione ── */}
      <View style={styles.section}>
        <View style={styles.statoRow}>
          <View style={styles.statoInfo}>
            <Text style={styles.statoLabel}>Webservice</Text>
            <Text style={[
              styles.statoValore,
              { color: isConfigured ? '#10B981' : '#9CA3AF' },
            ]}>
              {isConfigured ? 'Configurato' : 'Non configurato'}
            </Text>
          </View>
          <View style={[
            styles.statoDot,
            { backgroundColor: isConfigured ? '#10B981' : '#D1D5DB' },
          ]} />
        </View>
      </View>

      {/* ── Sezione: Form configurazione ── */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Connessione</Text>

        <FormField
          label="URL base"
          required
          value={formValues.base_url}
          onChangeText={(v) => setField('base_url', v)}
          error={fieldErrors.base_url}
          helper="Es. https://gestionale.esempio.com/api"
          keyboardType="url"
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="next"
          placeholder="https://"
        />

        <FormField
          label="Token di autenticazione"
          required
          value={formValues.auth_token}
          onChangeText={(v) => setField('auth_token', v)}
          error={fieldErrors.auth_token}
          helper="Token Bearer per l'autenticazione alle API"
          autoCapitalize="none"
          autoCorrect={false}
          secureTextEntry={false}
          multiline={false}
          placeholder="eyJ..."
        />
      </View>

      {/* ── Sezione: Timeout ── */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Avanzate</Text>

        <View style={styles.timeoutRow}>
          <View style={styles.timeoutInfo}>
            <Text style={styles.timeoutLabel}>Timeout richieste</Text>
            <Text style={styles.timeoutValore}>
              {(formValues.timeout_ms / 1000).toFixed(0)} secondi
            </Text>
          </View>
        </View>

        {/* Slider timeout approssimativo con preset */}
        <View style={styles.presetRow}>
          {[5000, 15000, 30000, 60000].map((ms) => (
            <LoadingButton
              key={ms}
              label={`${ms / 1000}s`}
              onPress={() => setField('timeout_ms', ms)}
              variant={formValues.timeout_ms === ms ? 'primary' : 'secondary'}
              size="sm"
              style={styles.presetButton}
            />
          ))}
        </View>
        {fieldErrors.timeout_ms ? (
          <Text style={styles.errorText}>{fieldErrors.timeout_ms}</Text>
        ) : null}
      </View>

      {/* ── Sezione: Test connessione ── */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Test connessione</Text>

        {testResult && (
          <ConnessioneBadge
            success={testResult.success}
            latenza={testResult.latenza_ms}
            messaggio={testResult.messaggio}
          />
        )}

        <LoadingButton
          label="Testa connessione"
          loadingLabel="Test in corso..."
          onPress={handleTest}
          loading={isTesting}
          variant="secondary"
          size="md"
          style={styles.testButton}
        />
      </View>

      {/* ── Azioni principali ── */}
      <View style={styles.azioniContainer}>
        <LoadingButton
          label={isDirty ? 'Salva modifiche' : 'Configurazione salvata'}
          loadingLabel="Salvataggio..."
          onPress={handleSalva}
          loading={isSaving}
          disabled={!isDirty}
          variant="primary"
          size="lg"
          style={styles.salvaButton}
        />

        {isConfigured && (
          <LoadingButton
            label="Elimina configurazione"
            onPress={handleElimina}
            variant="ghost"
            size="md"
            style={styles.eliminaButton}
          />
        )}
      </View>

      {/* ── Footer informativo ── */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>
          La configurazione è salvata localmente sul dispositivo.
          I dati non vengono condivisi con terze parti.
        </Text>
      </View>
    </ScrollView>
  );
}

// ─────────────────────────────────────────────
// STILI
// ─────────────────────────────────────────────

const styles = StyleSheet.create({
  scroll: {
    flex:            1,
    backgroundColor: '#F9FAFB',
  },
  content: {
    paddingTop: 16,
    gap:        12,
  },
  section: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    borderRadius:    12,
    padding:         16,
    borderWidth:     1,
    borderColor:     '#F3F4F6',
  },
  sectionTitle: {
    fontSize:     13,
    fontWeight:   '600',
    color:        '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 14,
  },
  statoRow: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
  },
  statoInfo: {
    gap: 2,
  },
  statoLabel: {
    fontSize:   13,
    color:      '#6B7280',
  },
  statoValore: {
    fontSize:   16,
    fontWeight: '600',
  },
  statoDot: {
    width:        12,
    height:       12,
    borderRadius: 6,
  },
  timeoutRow: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
    marginBottom:   12,
  },
  timeoutInfo: {
    gap: 2,
  },
  timeoutLabel: {
    fontSize: 14,
    color:    '#374151',
    fontWeight: '500',
  },
  timeoutValore: {
    fontSize: 13,
    color:    '#6B7280',
  },
  presetRow: {
    flexDirection: 'row',
    gap:           8,
  },
  presetButton: {
    flex: 1,
  },
  errorText: {
    marginTop: 6,
    fontSize:  12,
    color:     '#EF4444',
  },
  testButton: {
    marginTop: 12,
  },
  azioniContainer: {
    marginHorizontal: 16,
    gap:              10,
  },
  salvaButton: {
    width: '100%',
  },
  eliminaButton: {
    width: '100%',
  },
  footer: {
    marginHorizontal: 16,
    marginTop:        4,
  },
  footerText: {
    fontSize:  12,
    color:     '#9CA3AF',
    textAlign: 'center',
    lineHeight: 18,
  },
});

const badgeStyles = StyleSheet.create({
  container: {
    flexDirection:   'row',
    alignItems:      'flex-start',
    borderRadius:    10,
    borderWidth:     1,
    padding:         12,
    marginBottom:    12,
    gap:             10,
  },
  dot: {
    width:        8,
    height:       8,
    borderRadius: 4,
    marginTop:    3,
    flexShrink:   0,
  },
  textWrap: {
    flex: 1,
    gap:  2,
  },
  messaggio: {
    fontSize:   13,
    fontWeight: '500',
    lineHeight: 18,
  },
  latenza: {
    fontSize: 12,
    color:    '#6B7280',
  },
});
