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
import { validateCreaDTO } from '@/services/fascicoli.service';
import { FormField, LoadingButton } from '@/components';
import { TOAST_MESSAGES } from '@/constants';

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
        style={styles.scroll}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + 32 },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* ── Intestazione ── */}
        <View style={styles.intestazione}>
          <Text style={styles.intestazioneTitolo}>Nuovo fascicolo</Text>
          <Text style={styles.intestazioneSottotitolo}>
            Dai un nome al fascicolo — potrai aggiungere le foto subito dopo.
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
            placeholder="Es. Sopralluogo via Roma, 15 marzo"
            autoCapitalize="sentences"
            autoCorrect
            returnKeyType="next"
            onSubmitEditing={() => descrizioneRef.current?.focus()}
            maxLength={200}
          />

          <FormField
            ref={descrizioneRef}
            label="Descrizione"
            value={descrizione}
            onChangeText={setDescrizione}
            placeholder="Note aggiuntive sul fascicolo (opzionale)"
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
              <Text style={styles.anteprimaFascicoloTitolo} numberOfLines={1}>
                {titolo.trim()}
              </Text>
              {descrizione.trim() ? (
                <Text style={styles.anteprimaDescrizione} numberOfLines={2}>
                  {descrizione.trim()}
                </Text>
              ) : null}
              <View style={styles.anteprimaFooter}>
                <View style={styles.anteprimaChip}>
                  <Text style={styles.anteprimaChipText}>0 foto</Text>
                </View>
                <View style={styles.anteprimaBadge}>
                  <View style={styles.anteprimaBadgeDot} />
                  <Text style={styles.anteprimaBadgeText}>Bozza</Text>
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
    backgroundColor: '#F9FAFB',
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
    fontSize:     24,
    fontWeight:   '700',
    color:        '#111827',
    marginBottom: 6,
  },
  intestazioneSottotitolo: {
    fontSize:   15,
    color:      '#6B7280',
    lineHeight: 22,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius:    12,
    padding:         16,
    borderWidth:     1,
    borderColor:     '#F3F4F6',
  },
  anteprima: {
    gap: 8,
  },
  anteprimaTitolo: {
    fontSize:   12,
    fontWeight: '600',
    color:      '#9CA3AF',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    paddingHorizontal: 2,
  },
  anteprimaCard: {
    backgroundColor: '#FFFFFF',
    borderRadius:    12,
    padding:         14,
    borderWidth:     1,
    borderColor:     '#E5E7EB',
  },
  anteprimaFascicoloTitolo: {
    fontSize:     16,
    fontWeight:   '600',
    color:        '#111827',
    marginBottom: 4,
  },
  anteprimaDescrizione: {
    fontSize:     13,
    color:        '#6B7280',
    lineHeight:   18,
    marginBottom: 10,
  },
  anteprimaFooter: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
    marginTop:      8,
  },
  anteprimaChip: {
    backgroundColor:   '#F3F4F6',
    borderRadius:      6,
    paddingHorizontal: 8,
    paddingVertical:   3,
  },
  anteprimaChipText: {
    fontSize:   12,
    color:      '#374151',
    fontWeight: '500',
  },
  anteprimaBadge: {
    flexDirection:     'row',
    alignItems:        'center',
    backgroundColor:   '#FEF3C7',
    borderRadius:      20,
    borderWidth:       1,
    borderColor:       '#F59E0B',
    paddingHorizontal: 8,
    paddingVertical:   3,
    gap:               5,
  },
  anteprimaBadgeDot: {
    width:           6,
    height:          6,
    borderRadius:    3,
    backgroundColor: '#F59E0B',
  },
  anteprimaBadgeText: {
    fontSize:   11,
    color:      '#92400E',
    fontWeight: '600',
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
    color:      '#6B7280',
    fontWeight: '500',
  },
});
