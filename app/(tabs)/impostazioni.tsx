/**
 * @file app/(tabs)/impostazioni.tsx
 * Schermata Impostazioni — configurazione del webservice esterno.
 * Features:
 * - Branding: nome società e logo (mostrati nell'header dell'app)
 * - Form con URL base, therm token, endpoint auth e invio, timeout
 * - Validazione in tempo reale per campo
 * - Pulsante "Test connessione" (autenticazione OAuth reale) con badge latenza
 * - Salvataggio con feedback toast
 * - Indicatore stato connessione (verde/rosso/grigio)
 */

import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  Image,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import { useConfig } from '@/hooks/useConfig';
import { useKeyboardScroll } from '@/hooks/useKeyboardScroll';
import { FormField, LoadingButton } from '@/components';
import {
  leggiInfoVersione,
  updateIdBreve,
  controllaEScarica,
  riavviaConNuovaVersione,
} from '@/services/updates.service';
import {
  TOAST_MESSAGES,
  DESCRIZIONE_FOTO_MAX_LEN,
  CATALOGO_FOTO_MAX_LEN,
} from '@/constants';
import { Colors, Radius, overline, sectionCard } from '@/constants/theme';

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
  const color = success === null ? '#9CA3AF' : success ? Colors.success : Colors.danger;
  const bg    = success === null ? '#F3F4F6' : success ? Colors.successBorder : Colors.dangerBorder;
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
  const { scrollRef, keyboardHeight, scrollToFocusedInput } = useKeyboardScroll();

  // ── Aggiornamenti OTA ──
  // Le costanti native non cambiano durante la sessione: si leggono una volta
  const infoVersione = useMemo(() => leggiInfoVersione(), []);
  const [isControllandoUpdate, setIsControllandoUpdate] = useState(false);

  const handleControllaUpdate = useCallback(async () => {
    setIsControllandoUpdate(true);
    const esito = await controllaEScarica();
    setIsControllandoUpdate(false);

    switch (esito.tipo) {
      case 'scaricato':
        Alert.alert(
          'Aggiornamento pronto',
          'È stata scaricata una nuova versione. Vuoi riavviare l\'app per applicarla?',
          [
            { text: 'Più tardi', style: 'cancel' },
            {
              text:    'Riavvia',
              onPress: () => {
                // Dopo reloadAsync non è sicuro eseguire altro codice
                riavviaConNuovaVersione().catch(() =>
                  Toast.show({
                    type:  'error',
                    text1: 'Riavvio non riuscito',
                    text2: 'Chiudi e riapri l\'app manualmente.',
                  })
                );
              },
            },
          ]
        );
        break;

      case 'aggiornato':
        Toast.show({ type: 'info', text1: 'Sei già alla versione più recente' });
        break;

      case 'disattivato':
        Toast.show({
          type:  'info',
          text1: 'Aggiornamenti non disponibili',
          text2: 'Funziona solo nell\'app installata.',
        });
        break;

      case 'errore':
        Toast.show({
          type:  'error',
          text1: 'Controllo non riuscito',
          text2: esito.messaggio,
        });
        break;
    }
  }, []);

  const {
    formValues,
    fieldErrors,
    isDirty,
    isSaving,
    isTesting,
    testResult,
    isConfigured,
    setField,
    scegliLogo,
    rimuoviLogo,
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
    <KeyboardAvoidingView
      style={styles.scroll}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}
    >
    <ScrollView
      ref={scrollRef}
      style={styles.scroll}
      contentContainerStyle={[
        styles.content,
        { paddingBottom: insets.bottom + 32 + keyboardHeight },
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
              { color: isConfigured ? Colors.success : '#9CA3AF' },
            ]}>
              {isConfigured ? 'Configurato' : 'Non configurato'}
            </Text>
          </View>
          <View style={[
            styles.statoDot,
            { backgroundColor: isConfigured ? Colors.success : '#D1D5DB' },
          ]} />
        </View>
      </View>

      {/* ── Sezione: Società (branding) ── */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Società</Text>

        <FormField
          onFocus={scrollToFocusedInput}
          label="Nome società"
          value={formValues.nome_societa}
          onChangeText={(v) => setField('nome_societa', v)}
          error={fieldErrors.nome_societa}
          helper="Mostrato nell'intestazione dell'app"
          autoCorrect={false}
          returnKeyType="next"
          placeholder="Es. Rossi S.r.l."
        />

        <View style={logoStyles.row}>
          <View style={logoStyles.previewBox}>
            {formValues.logo_base64 ? (
              <Image
                source={{ uri: `data:image/png;base64,${formValues.logo_base64}` }}
                style={logoStyles.preview}
                resizeMode="contain"
              />
            ) : (
              <Text style={logoStyles.previewPlaceholder}>Nessun{'\n'}logo</Text>
            )}
          </View>

          <View style={logoStyles.actions}>
            <TouchableOpacity style={logoStyles.actionButton} onPress={scegliLogo}>
              <Text style={logoStyles.actionText}>
                {formValues.logo_base64 ? 'Cambia logo' : 'Scegli logo'}
              </Text>
            </TouchableOpacity>
            {formValues.logo_base64 ? (
              <TouchableOpacity
                style={[logoStyles.actionButton, logoStyles.actionButtonDanger]}
                onPress={rimuoviLogo}
              >
                <Text style={[logoStyles.actionText, logoStyles.actionTextDanger]}>
                  Rimuovi
                </Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </View>
        {fieldErrors.logo_base64 ? (
          <Text style={styles.errorText}>{fieldErrors.logo_base64}</Text>
        ) : null}
      </View>

      {/* ── Sezione: Form configurazione ── */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Connessione</Text>

        <FormField
          onFocus={scrollToFocusedInput}
          label="URL base"
          required
          value={formValues.base_url}
          onChangeText={(v) => setField('base_url', v)}
          error={fieldErrors.base_url}
          helper="Es. http://10.0.0.10:10101/panth01/api"
          keyboardType="url"
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="next"
          placeholder="https://"
        />

        <FormField
          onFocus={scrollToFocusedInput}
          label="Therm token"
          required
          value={formValues.therm_token}
          onChangeText={(v) => setField('therm_token', v)}
          error={fieldErrors.therm_token}
          helper="Usato per richiedere l'access token OAuth"
          autoCapitalize="none"
          autoCorrect={false}
          secureTextEntry={false}
          multiline={false}
          placeholder="xxxxxxxxxx"
        />
      </View>

      {/* ── Sezione: Endpoint ── */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Endpoint</Text>

        <FormField
          onFocus={scrollToFocusedInput}
          label="Endpoint autenticazione"
          required
          value={formValues.auth_endpoint}
          onChangeText={(v) => setField('auth_endpoint', v)}
          error={fieldErrors.auth_endpoint}
          helper="Path relativo all'URL base — POST { therm_token, grant_type }"
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="next"
          placeholder="authenticate/oauth/token"
        />

        <FormField
          onFocus={scrollToFocusedInput}
          label="Endpoint invio documenti"
          required
          value={formValues.invio_endpoint}
          onChangeText={(v) => setField('invio_endpoint', v)}
          error={fieldErrors.invio_endpoint}
          helper="Path relativo all'URL base — PUT con Bearer token"
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="YUploadDocDgtMultipli"
        />
      </View>

      {/* ── Sezione: Attributi foto ── */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Attributi foto</Text>

        <FormField
          onFocus={scrollToFocusedInput}
          label="Descrizione foto"
          value={formValues.descrizione_foto}
          onChangeText={(v) => setField('descrizione_foto', v)}
          error={fieldErrors.descrizione_foto}
          helper={`Allegata a ogni foto inviata — max ${DESCRIZIONE_FOTO_MAX_LEN} caratteri`}
          maxLength={DESCRIZIONE_FOTO_MAX_LEN}
          autoCorrect={false}
          returnKeyType="next"
          placeholder="Es. Foto sopralluogo"
        />

        <FormField
          onFocus={scrollToFocusedInput}
          label="Catalogo foto"
          value={formValues.catalogo_foto}
          onChangeText={(v) => setField('catalogo_foto', v)}
          error={fieldErrors.catalogo_foto}
          helper={`Catalogo di destinazione nel gestionale — max ${CATALOGO_FOTO_MAX_LEN} caratteri`}
          maxLength={CATALOGO_FOTO_MAX_LEN}
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="Es. DOCUMENTI_VENDITA"
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

      {/* ── Sezione: Aggiornamenti ── */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Aggiornamenti</Text>

        <View style={styles.updateRiga}>
          <Text style={styles.updateLabel}>Versione</Text>
          <Text style={styles.updateValore}>{infoVersione.versioneApp}</Text>
        </View>

        <View style={styles.updateRiga}>
          <Text style={styles.updateLabel}>Origine</Text>
          <Text style={styles.updateValore}>
            {!infoVersione.attivo
              ? 'Sviluppo'
              : infoVersione.daBuild
                ? 'Build installato'
                : `Aggiornamento ${updateIdBreve(infoVersione.updateId)}`}
          </Text>
        </View>

        {infoVersione.attivo && infoVersione.canale && (
          <View style={styles.updateRiga}>
            <Text style={styles.updateLabel}>Canale</Text>
            <Text style={styles.updateValore}>{infoVersione.canale}</Text>
          </View>
        )}

        {infoVersione.attivo ? (
          <LoadingButton
            label="Cerca aggiornamenti"
            loadingLabel="Controllo in corso..."
            onPress={handleControllaUpdate}
            loading={isControllandoUpdate}
            variant="secondary"
            size="md"
            style={styles.updateButton}
          />
        ) : (
          <Text style={styles.updateNota}>
            Gli aggiornamenti sono disponibili solo nell'app installata.
            In Expo Go il codice arriva sempre dal server di sviluppo.
          </Text>
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
    </KeyboardAvoidingView>
  );
}

// ─────────────────────────────────────────────
// STILI
// ─────────────────────────────────────────────

const styles = StyleSheet.create({
  scroll: {
    flex:            1,
    backgroundColor: Colors.bg,
  },
  content: {
    paddingTop: 16,
    gap:        12,
  },
  section: {
    ...sectionCard,
    marginHorizontal: 16,
  },
  sectionTitle: {
    ...overline,
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
    fontSize: 13,
    color:    Colors.inkMuted,
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
    fontSize:   14,
    color:      Colors.inkSoft,
    fontWeight: '600',
  },
  timeoutValore: {
    fontSize:    13,
    color:       Colors.inkMuted,
    fontVariant: ['tabular-nums'],
  },
  presetRow: {
    flexDirection: 'row',
    gap:           8,
  },
  presetButton: {
    flex: 1,
  },
  errorText: {
    marginTop:  6,
    fontSize:   12,
    fontWeight: '600',
    color:      Colors.dangerText,
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
  updateRiga: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
    marginBottom:   10,
  },
  updateLabel: {
    fontSize:   14,
    color:      Colors.inkMuted,
    flexShrink: 1,
    marginRight: 12,
  },
  updateValore: {
    fontSize:   14,
    fontWeight: '600',
    color:      Colors.ink,
    flexShrink: 0,
  },
  updateButton: {
    marginTop: 6,
  },
  updateNota: {
    fontSize:   13,
    lineHeight: 19,
    color:      Colors.inkMuted,
  },
  footer: {
    marginHorizontal: 16,
    marginTop:        4,
  },
  footerText: {
    fontSize:   12,
    color:      Colors.inkFaint,
    textAlign:  'center',
    lineHeight: 18,
  },
});

const logoStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           14,
    marginTop:     4,
  },
  previewBox: {
    width:           76,
    height:          76,
    borderRadius:    Radius.lg,
    borderWidth:     1,
    borderColor:     Colors.hairline,
    backgroundColor: Colors.surfaceSunken,
    alignItems:      'center',
    justifyContent:  'center',
    overflow:        'hidden',
  },
  preview: {
    width:  '100%',
    height: '100%',
  },
  previewPlaceholder: {
    ...overline,
    fontSize:  9.5,
    textAlign: 'center',
    color:     Colors.inkFaint,
  },
  actions: {
    flex: 1,
    gap:  8,
  },
  actionButton: {
    borderWidth:     1,
    borderColor:     Colors.primaryBorder,
    backgroundColor: Colors.primaryTint,
    borderRadius:    Radius.sm,
    paddingVertical: 10,
    alignItems:      'center',
  },
  actionButtonDanger: {
    borderColor:     Colors.dangerBorder,
    backgroundColor: Colors.dangerTint,
  },
  actionText: {
    fontSize:   14,
    fontWeight: '700',
    color:      Colors.primary,
  },
  actionTextDanger: {
    color: Colors.dangerText,
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
    fontWeight: '600',
    lineHeight: 18,
  },
  latenza: {
    fontSize:    12,
    color:       Colors.inkMuted,
    fontVariant: ['tabular-nums'],
  },
});
