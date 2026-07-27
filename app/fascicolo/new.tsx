/**
 * @file app/fascicolo/new.tsx
 * Schermata di creazione di un nuovo fascicolo fotografico.
 * Si apre come modal su iOS, come schermata push su Android.
 * Dopo la creazione reindirizza automaticamente al dettaglio.
 */

import React, { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import { useFascicoliStore } from '@/store/fascicoli.store';
import { useKeyboardScroll } from '@/hooks/useKeyboardScroll';
import { validateCreaDTO } from '@/services/fascicoli.service';
import { FormField, LoadingButton } from '@/components';
import { TOAST_MESSAGES } from '@/constants';
import { Colors, Radius, overline, SPINE_WIDTH } from '@/constants/theme';
import { STATO_COLORS } from '@/constants';

// ─────────────────────────────────────────────
// SCHERMATA
// ─────────────────────────────────────────────

export default function NuovoFascicoloScreen() {
  const router  = useRouter();
  const insets  = useSafeAreaInsets();

  const creaFascicoloFn = useFascicoliStore((s) => s.creaFascicolo);

  // ── Stato form ──
  const [titolo,       setTitolo]       = useState('');
  const [descrizione,  setDescrizione]  = useState('');
  const [erroreTitolo, setErroreTitolo] = useState<string | null>(null);
  const [isLoading,    setIsLoading]    = useState(false);

  const descrizioneRef = useRef<TextInput>(null);
  const { scrollRef, keyboardHeight, scrollToFocusedInput } = useKeyboardScroll();

  // ─────────────────────────────────────────
  // VALIDAZIONE IN TEMPO REALE
  // ─────────────────────────────────────────

  const handleTitoloChange = useCallback((value: string) => {
    setTitolo(value);
    if (erroreTitolo) {
      // Azzera l'errore appena l'utente riprende a scrivere
      const err = validateCreaDTO({ titolo: value });
      setErroreTitolo(err);
    }
  }, [erroreTitolo]);

  // ─────────────────────────────────────────
  // SUBMIT
  // ─────────────────────────────────────────

  const handleCrea = useCallback(async () => {
    // Validazione finale
    const err = validateCreaDTO({ titolo, descrizione });
    if (err) {
      setErroreTitolo(err);
      return;
    }

    setIsLoading(true);
    try {
      const fascicolo = await creaFascicoloFn({
        titolo:      titolo.trim(),
        descrizione: descrizione.trim() || undefined,
      });

      Toast.show({
        type:  'success',
        text1: TOAST_MESSAGES.FASCICOLO_CREATO,
        text2: fascicolo.titolo,
      });

      // Redirect al dettaglio — sostituisce la schermata modal
      // così il back button non riporta al form vuoto
      router.replace(`/fascicolo/${fascicolo.id}`);
    } catch (error) {
      Toast.show({
        type:  'error',
        text1: 'Errore creazione',
        text2: error instanceof Error ? error.message : TOAST_MESSAGES.ERRORE_GENERICO,
      });
    } finally {
      setIsLoading(false);
    }
  }, [titolo, descrizione, creaFascicoloFn, router]);

  const handleAnnulla = useCallback(() => {
    router.back();
  }, [router]);

  const isFormValido = titolo.trim().length > 0 && !isLoading;

  // ─────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
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
        {/* ── Intestazione ── */}
        <View style={styles.intestazione}>
          <Text style={styles.intestazioneTitolo}>Nuovo fascicolo</Text>
          <Text style={styles.intestazioneSottotitolo}>
            Identifica la spedizione da fotografare — le foto del packing le
            aggiungi subito dopo.
          </Text>
        </View>

        {/* ── Card form ── */}
        <View style={styles.card}>
          <FormField
            label="Titolo"
            required
            value={titolo}
            onChangeText={handleTitoloChange}
            error={erroreTitolo ?? undefined}
            placeholder="Es. Spedizione nr. 2026-00123"
            autoCapitalize="sentences"
            autoCorrect={false}
            returnKeyType="next"
            onFocus={scrollToFocusedInput}
            onSubmitEditing={() => descrizioneRef.current?.focus()}
            maxLength={200}
          />

          <FormField
            ref={descrizioneRef}
            label="Descrizione"
            value={descrizione}
            onChangeText={setDescrizione}
            placeholder="Note sul packing: colli, pallet, cliente... (opzionale)"
            onFocus={scrollToFocusedInput}
            multiline
            numberOfLines={4}
            maxLength={1000}
            helper={`${descrizione.length}/1000 caratteri`}
            returnKeyType="done"
          />
        </View>

        {/* ── Anteprima info ── */}
        {titolo.trim().length > 0 && (
          <View style={styles.anteprima}>
            <Text style={styles.anteprimaTitolo}>Anteprima</Text>
            <View style={styles.anteprimaCard}>
              <View style={styles.anteprimaSpine} />
              <View style={styles.anteprimaBody}>
                <Text style={styles.anteprimaFascicoloTitolo} numberOfLines={1}>
                  {titolo.trim()}
                </Text>
                {descrizione.trim() ? (
                  <Text style={styles.anteprimaDescrizione} numberOfLines={2}>
                    {descrizione.trim()}
                  </Text>
                ) : null}
                <View style={styles.anteprimaMeta}>
                  <Text style={styles.anteprimaMetaText}>0 foto</Text>
                  <View style={styles.anteprimaMetaDot} />
                  <Text style={styles.anteprimaMetaText}>
                    {new Date().toLocaleDateString('it-IT', {
                      day:   '2-digit',
                      month: '2-digit',
                      year:  'numeric',
                    })}
                  </Text>
                </View>
              </View>
            </View>
          </View>
        )}

        {/* ── Azioni ── */}
        <View style={styles.azioni}>
          <LoadingButton
            label="Crea fascicolo"
            loadingLabel="Creazione..."
            onPress={handleCrea}
            loading={isLoading}
            disabled={!isFormValido}
            variant="primary"
            size="lg"
            style={styles.btnCrea}
          />
          <TouchableOpacity
            style={styles.btnAnnulla}
            onPress={handleAnnulla}
            disabled={isLoading}
          >
            <Text style={styles.btnAnnullaText}>Annulla</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ─────────────────────────────────────────────
// STILI
// ─────────────────────────────────────────────

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  scroll: {
    flex: 1,
  },
  content: {
    padding: 16,
    gap:     16,
  },
  intestazione: {
    paddingTop:    8,
    paddingBottom: 4,
  },
  intestazioneTitolo: {
    fontSize:      24,
    fontWeight:    '700',
    letterSpacing: -0.5,
    color:         Colors.ink,
    marginBottom:  6,
  },
  intestazioneSottotitolo: {
    fontSize:   15,
    color:      Colors.inkMuted,
    lineHeight: 22,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius:    Radius.lg,
    padding:         16,
    borderWidth:     1,
    borderColor:     Colors.hairline,
  },
  anteprima: {
    gap: 8,
  },
  anteprimaTitolo: {
    ...overline,
    paddingHorizontal: 2,
  },
  anteprimaCard: {
    flexDirection:   'row',
    alignItems:      'center',
    backgroundColor: Colors.surface,
    borderRadius:    Radius.lg - 2,
    borderWidth:     1,
    borderColor:     Colors.hairline,
    overflow:        'hidden',
  },
  anteprimaFascicoloTitolo: {
    fontSize:      16,
    fontWeight:    '700',
    letterSpacing: -0.2,
    color:         Colors.ink,
  },
  anteprimaDescrizione: {
    fontSize:   13,
    color:      Colors.inkMuted,
    lineHeight: 18,
  },
  anteprimaSpine: {
    width:           SPINE_WIDTH,
    alignSelf:       'stretch',
    backgroundColor: STATO_COLORS.bozza.spine,
  },
  anteprimaBody: {
    flex:            1,
    paddingVertical: 14,
    paddingHorizontal: 14,
    gap:             5,
  },
  anteprimaMeta: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           7,
    marginTop:     2,
  },
  anteprimaMetaText: {
    fontSize:    12,
    color:       Colors.inkFaint,
    fontWeight:  '600',
    fontVariant: ['tabular-nums'],
  },
  anteprimaMetaDot: {
    width:           3,
    height:          3,
    borderRadius:    2,
    backgroundColor: Colors.hairlineStrong,
  },
  azioni: {
    gap:       10,
    marginTop: 4,
  },
  btnCrea: {
    width: '100%',
  },
  btnAnnulla: {
    alignItems:      'center',
    paddingVertical: 12,
  },
  btnAnnullaText: {
    fontSize:   15,
    color:      Colors.inkMuted,
    fontWeight: '500',
  },
});
