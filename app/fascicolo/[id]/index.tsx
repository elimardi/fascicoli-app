/**
 * @file app/fascicolo/[id]/index.tsx
 * Schermata dettaglio fascicolo — la schermata più ricca dell'app.
 * Features:
 * - Header con titolo, stato e data creazione
 * - Griglia foto 2 colonne con drag-and-drop e long-press eliminazione
 * - Pulsante "Aggiungi foto" → navigazione alla fotocamera
 * - Sezione "Invio" (solo stato bozza): input codice documento + pulsante invio
 * - Sezione "Esito" (stato inviato/errore): JSON formattato + data invio
 * - Pull-to-refresh
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  RefreshControl,
  TextInput,
  Alert,
  ActivityIndicator,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter, useNavigation } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import { useFascicolo } from '@/hooks/useFascicolo';
import { useKeyboardScroll } from '@/hooks/useKeyboardScroll';
import { validateCodiceDocumento } from '@/services/fascicoli.service';
import { StatusBadge, FotoGrid, LoadingButton } from '@/components';
import { TOAST_MESSAGES, STATO_COLORS } from '@/constants';
import {
  Colors,
  Radius,
  MONO_FONT,
  SPINE_WIDTH,
  overline,
  sectionCard,
} from '@/constants/theme';
import type { Foto } from '@/types';

// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────

function formatDataOra(iso: string): string {
  try {
    return new Date(iso).toLocaleString('it-IT', {
      day:    '2-digit',
      month:  '2-digit',
      year:   'numeric',
      hour:   '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

// ─────────────────────────────────────────────
// SOTTO-COMPONENTI
// ─────────────────────────────────────────────

interface EsitoCardProps {
  esitoJson: string;
  dataInvio: string | null;
  isErrore:  boolean;
}

/**
 * Card che mostra la risposta JSON del webservice formattata.
 */
function EsitoCard({ esitoJson, dataInvio, isErrore }: EsitoCardProps) {
  // Prova a fare il pretty-print del JSON
  let formatted = esitoJson;
  try {
    const parsed = JSON.parse(esitoJson);
    formatted = JSON.stringify(parsed, null, 2);
  } catch {
    // Lascia il testo così com'è se non è JSON valido
  }

  const borderColor = isErrore ? Colors.dangerBorder : Colors.successBorder;
  const bgColor     = isErrore ? Colors.dangerTint    : Colors.successTint;
  const labelColor  = isErrore ? Colors.dangerText    : Colors.successText;

  return (
    <View style={[esitoStyles.card, { borderColor, backgroundColor: bgColor }]}>
      <View style={esitoStyles.header}>
        <Text style={[esitoStyles.label, { color: labelColor }]}>
          {isErrore ? 'Errore webservice' : 'Risposta webservice'}
        </Text>
        {dataInvio && (
          <Text style={esitoStyles.data}>{formatDataOra(dataInvio)}</Text>
        )}
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator
        style={esitoStyles.jsonScroll}
      >
        <Text style={esitoStyles.jsonText} selectable>
          {formatted}
        </Text>
      </ScrollView>
    </View>
  );
}

// ─────────────────────────────────────────────
// SCHERMATA PRINCIPALE
// ─────────────────────────────────────────────

export default function DettaglioFascicoloScreen() {
  const { id }    = useLocalSearchParams<{ id: string }>();
  const router    = useRouter();
  const navigation = useNavigation();
  const insets    = useSafeAreaInsets();

  const fascicoloId = Number(id);

  const {
    fascicolo,
    foto,
    loadingDettaglio,
    loadingFoto,
    loadingInvio,
    erroreDettaglio,
    erroreInvio,
    refresh,
    aggiorna,
    eliminaFoto,
    riordina,
    invia,
  } = useFascicolo(fascicoloId);

  // ── Stato locale per il form di invio ──
  const [codiceDocumento,  setCodiceDocumento]  = useState('');
  const [erroreCodice,     setErroreCodice]     = useState<string | null>(null);
  const [isRefreshing,     setIsRefreshing]     = useState(false);
  const [riordinoAttivo,   setRiordinoAttivo]   = useState(false);
  const [fotoAperta,       setFotoAperta]       = useState<Foto | null>(null);

  // Gestione tastiera: scroll dell'input attivo sopra la tastiera
  const { scrollRef, keyboardHeight, scrollToFocusedInput } = useKeyboardScroll();

  // ── Aggiorna il titolo dell'header quando il fascicolo è caricato ──
  useEffect(() => {
    if (fascicolo?.titolo) {
      navigation.setOptions({ title: fascicolo.titolo });
    }
  }, [fascicolo?.titolo, navigation]);

  // ── Pre-popola il codice documento se già salvato ──
  useEffect(() => {
    if (fascicolo?.codice_documento && !codiceDocumento) {
      setCodiceDocumento(fascicolo.codice_documento);
    }
  }, [fascicolo?.codice_documento]);

  // ── Esce dalla modalità riordino se non più applicabile ──
  useEffect(() => {
    if (riordinoAttivo && (foto.length < 2 || fascicolo?.stato !== 'bozza')) {
      setRiordinoAttivo(false);
    }
  }, [riordinoAttivo, foto.length, fascicolo?.stato]);

  // ─────────────────────────────────────────
  // HANDLERS
  // ─────────────────────────────────────────

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await refresh();
    setIsRefreshing(false);
  }, [refresh]);

  const handleAggiungiFoto = useCallback(() => {
    router.push(`/fascicolo/${fascicoloId}/camera`);
  }, [router, fascicoloId]);

  const handleEliminaFoto = useCallback(
    async (fotoItem: Foto) => {
      try {
        await eliminaFoto(fotoItem.id);
        Toast.show({ type: 'success', text1: TOAST_MESSAGES.FOTO_ELIMINATA });
      } catch (error) {
        Toast.show({
          type:  'error',
          text1: 'Errore eliminazione foto',
          text2: error instanceof Error ? error.message : TOAST_MESSAGES.ERRORE_GENERICO,
        });
      }
    },
    [eliminaFoto]
  );

  const handleReorder = useCallback(
    async (fotoOrdinate: Foto[]) => {
      try {
        await riordina(fotoOrdinate);
      } catch {
        Toast.show({ type: 'error', text1: 'Errore riordinamento foto' });
      }
    },
    [riordina]
  );

  const handleCodiceChange = useCallback((value: string) => {
    setCodiceDocumento(value);
    if (erroreCodice) {
      setErroreCodice(validateCodiceDocumento(value));
    }
  }, [erroreCodice]);

  /**
   * Riporta un fascicolo in errore allo stato bozza, così ricompare
   * la sezione di invio (con il codice documento già precompilato)
   * e l'utente può correggere e reinviare.
   */
  const handleRiprovaInvio = useCallback(() => {
    Alert.alert(
      'Riprova invio',
      'Il fascicolo tornerà in bozza: potrai correggere i dati e inviarlo di nuovo.',
      [
        { text: 'Annulla', style: 'cancel' },
        {
          text: 'Riprova',
          onPress: async () => {
            try {
              await aggiorna({ stato: 'bozza' });
              await refresh();
            } catch {
              Toast.show({ type: 'error', text1: 'Impossibile ripristinare il fascicolo' });
            }
          },
        },
      ]
    );
  }, [aggiorna, refresh]);

  const handleInvia = useCallback(async () => {
    // Validazione codice documento
    const err = validateCodiceDocumento(codiceDocumento);
    if (err) {
      setErroreCodice(err);
      return;
    }
    setErroreCodice(null);

    if (!fascicolo) return;

    // Conferma invio
    Alert.alert(
      'Invia al gestionale',
      `Inviare il fascicolo "${fascicolo.titolo}" con ${foto.length} foto?\n\nCodice documento: ${codiceDocumento.trim()}`,
      [
        { text: 'Annulla', style: 'cancel' },
        {
          text:    'Invia',
          onPress: async () => {
            const result = await invia(codiceDocumento.trim());
            if (result.success) {
              Toast.show({
                type:  'success',
                text1: TOAST_MESSAGES.FASCICOLO_INVIATO,
                text2: fascicolo.titolo,
              });
            } else {
              Toast.show({
                type:  'error',
                text1: 'Invio fallito',
                text2: result.messaggio,
              });
            }
          },
        },
      ]
    );
  }, [codiceDocumento, fascicolo, foto.length, invia]);

  // ─────────────────────────────────────────
  // STATI DI CARICAMENTO / ERRORE
  // ─────────────────────────────────────────

  if (loadingDettaglio && !fascicolo) {
    return (
      <View style={styles.centrato}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  if (erroreDettaglio && !fascicolo) {
    return (
      <View style={styles.centrato}>
        <Text style={styles.erroreText}>{erroreDettaglio}</Text>
        <LoadingButton
          label="Riprova"
          onPress={refresh}
          variant="primary"
          size="md"
          style={{ marginTop: 16 }}
        />
      </View>
    );
  }

  if (!fascicolo) return null;

  const isBozza   = fascicolo.stato === 'bozza';
  const hasEsito  = fascicolo.esito_risposta !== null;
  const isErrore  = fascicolo.stato === 'errore';
  const canInvio  = isBozza && foto.length > 0;

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
      refreshControl={
        <RefreshControl
          refreshing={isRefreshing}
          onRefresh={handleRefresh}
          tintColor={Colors.primary}
          colors={[Colors.primary]}
        />
      }
      showsVerticalScrollIndicator={false}
    >
      {/* ── Header fascicolo ── */}
      <View style={styles.header}>
        <View
          style={[
            styles.headerSpine,
            { backgroundColor: STATO_COLORS[fascicolo.stato].spine },
          ]}
        />
        <View style={styles.headerTop}>
          <StatusBadge stato={fascicolo.stato} size="md" />
          <Text style={styles.dataCreazione}>
            {formatDataOra(fascicolo.data_creazione)}
          </Text>
        </View>
        {fascicolo.descrizione ? (
          <Text style={styles.descrizione}>{fascicolo.descrizione}</Text>
        ) : null}
      </View>

      {/* ── Sezione: Foto ── */}
      <View style={styles.sezione}>
        <View style={styles.sezioneHeader}>
          <Text style={styles.sezioneTitolo}>
            Foto{foto.length > 0 ? ` (${foto.length})` : ''}
          </Text>
          <View style={styles.sezioneAzioni}>
            {isBozza && foto.length > 1 && (
              <TouchableOpacity
                style={[
                  styles.riordinaBtn,
                  riordinoAttivo && styles.riordinaBtnAttivo,
                ]}
                onPress={() => setRiordinoAttivo((v) => !v)}
                activeOpacity={0.75}
              >
                <Text
                  style={[
                    styles.riordinaBtnText,
                    riordinoAttivo && styles.riordinaBtnTextAttivo,
                  ]}
                >
                  {riordinoAttivo ? 'Fatto' : 'Riordina'}
                </Text>
              </TouchableOpacity>
            )}
            {isBozza && (
              <TouchableOpacity
                style={styles.aggiungiFotoBtn}
                onPress={handleAggiungiFoto}
                activeOpacity={0.75}
              >
                <Text style={styles.aggiungiFotoBtnText}>+ Aggiungi foto</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {loadingFoto && foto.length === 0 ? (
          <View style={styles.fotoLoading}>
            <ActivityIndicator size="small" color={Colors.primary} />
          </View>
        ) : (
          <FotoGrid
            foto={foto}
            onFotoPress={setFotoAperta}
            onFotoLongPress={handleEliminaFoto}
            onReorder={handleReorder}
            riordinoAttivo={riordinoAttivo && isBozza}
          />
        )}

        {/* Hint interazioni foto */}
        {foto.length > 0 && isBozza && (
          <Text style={styles.hintText}>
            {riordinoAttivo
              ? 'Usa le frecce per spostare le foto, poi tocca "Fatto".'
              : foto.length > 1
                ? 'Tieni premuto una foto per eliminarla · "Riordina" per cambiare l\'ordine'
                : 'Tieni premuto la foto per eliminarla'}
          </Text>
        )}
      </View>

      {/* ── Sezione: Invio (solo stato bozza) ── */}
      {isBozza && (
        <View style={styles.sezione}>
          <Text style={styles.sezioneTitolo}>Invio al gestionale</Text>

          {foto.length === 0 && (
            <View style={styles.avvisoBanner}>
              <Text style={styles.avvisoBannerText}>
                Aggiungi almeno una foto prima di inviare il fascicolo.
              </Text>
            </View>
          )}

          {/* Input codice documento */}
          <View style={styles.codiceContainer}>
            <Text style={styles.codiceLabel}>
              Documento di vendita <Text style={styles.obbligatorio}>*</Text>
            </Text>
            <TextInput
              style={[
                styles.codiceInput,
                erroreCodice ? styles.codiceInputError : null,
                !canInvio ? styles.codiceInputDisabled : null,
              ]}
              value={codiceDocumento}
              onChangeText={handleCodiceChange}
              onFocus={scrollToFocusedInput}
              placeholder="Es. 2026/DV/000001"
              placeholderTextColor="#9CA3AF"
              autoCapitalize="characters"
              autoCorrect={false}
              editable={!loadingInvio}
              returnKeyType="done"
              onSubmitEditing={handleInvia}
              maxLength={100}
            />
            {erroreCodice ? (
              <Text style={styles.codiceErrore}>{erroreCodice}</Text>
            ) : (
              <Text style={styles.codiceHelper}>
                Il codice verrà inviato insieme alle foto al gestionale.
              </Text>
            )}
          </View>

          <LoadingButton
            label={`Invia al gestionale (${foto.length} foto)`}
            loadingLabel="Invio in corso..."
            onPress={handleInvia}
            loading={loadingInvio}
            disabled={!canInvio || !codiceDocumento.trim()}
            variant="primary"
            size="lg"
            style={styles.inviaButton}
          />

          {erroreInvio && (
            <Text style={styles.erroreInvioText}>{erroreInvio}</Text>
          )}
        </View>
      )}

      {/* ── Sezione: Esito (stato inviato o errore) ── */}
      {hasEsito && fascicolo.esito_risposta && (
        <View style={styles.sezione}>
          <Text style={styles.sezioneTitolo}>
            {isErrore ? 'Dettaglio errore' : 'Esito invio'}
          </Text>
          <EsitoCard
            esitoJson={fascicolo.esito_risposta}
            dataInvio={fascicolo.data_invio}
            isErrore={isErrore}
          />

          {/* Pulsante ritenta se in errore */}
          {isErrore && (
            <View style={styles.retrySect}>
              <Text style={styles.retryInfo}>
                Correggi il problema e riprova l'invio.
              </Text>
              <LoadingButton
                label="Riprova invio"
                onPress={handleRiprovaInvio}
                variant="secondary"
                size="md"
                style={styles.retryButton}
              />
            </View>
          )}
        </View>
      )}

      {/* ── Sezione: Codice documento salvato (stato inviato) ── */}
      {fascicolo.stato === 'inviato' && fascicolo.codice_documento && (
        <View style={[styles.sezione, styles.infoSezione]}>
          <Text style={styles.infoLabel}>Codice documento</Text>
          <Text style={styles.infoValore} numberOfLines={1}>
            {fascicolo.codice_documento}
          </Text>
        </View>
      )}
    </ScrollView>

    {/* ── Visore foto a tutto schermo ── */}
    <Modal
      visible={fotoAperta !== null}
      transparent={false}
      animationType="fade"
      statusBarTranslucent
      onRequestClose={() => setFotoAperta(null)}
    >
      <View style={visoreStyles.sfondo}>
        {/* Il tocco sull'immagine chiude, come nelle gallerie di sistema */}
        <TouchableOpacity
          style={visoreStyles.area}
          activeOpacity={1}
          onPress={() => setFotoAperta(null)}
        >
          {fotoAperta && (
            <Image
              source={{ uri: fotoAperta.percorso_locale }}
              style={visoreStyles.immagine}
              resizeMode="contain"
            />
          )}
        </TouchableOpacity>

        <View style={[visoreStyles.barra, { paddingTop: insets.top + 8 }]}>
          <Text style={visoreStyles.contatore}>
            {fotoAperta
              ? `${foto.findIndex((f) => f.id === fotoAperta.id) + 1} di ${foto.length}`
              : ''}
          </Text>
          <TouchableOpacity
            onPress={() => setFotoAperta(null)}
            style={visoreStyles.chiudi}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Text style={visoreStyles.chiudiTesto}>Chiudi</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
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
    padding: 16,
    gap:     12,
  },
  centrato: {
    flex:           1,
    alignItems:     'center',
    justifyContent: 'center',
    padding:        32,
  },
  erroreText: {
    fontSize:  15,
    color:     Colors.inkMuted,
    textAlign: 'center',
  },
  header: {
    ...sectionCard,
    gap:         8,
    paddingLeft: 16 + SPINE_WIDTH,
    overflow:    'hidden',
  },
  headerSpine: {
    position: 'absolute',
    left:     0,
    top:      0,
    bottom:   0,
    width:    SPINE_WIDTH,
  },
  headerTop: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
  },
  dataCreazione: {
    fontSize:    12,
    color:       Colors.inkFaint,
    fontWeight:  '600',
    fontVariant: ['tabular-nums'],
  },
  descrizione: {
    fontSize:   14,
    color:      Colors.inkSoft,
    lineHeight: 20,
  },
  sezione: {
    ...sectionCard,
    gap: 12,
  },
  sezioneHeader: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
  },
  sezioneTitolo: {
    ...overline,
  },
  sezioneAzioni: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           8,
  },
  riordinaBtn: {
    backgroundColor:   Colors.surface,
    borderRadius:      Radius.sm,
    paddingHorizontal: 12,
    paddingVertical:   6,
    borderWidth:       1,
    borderColor:       Colors.hairlineStrong,
  },
  riordinaBtnAttivo: {
    backgroundColor: Colors.primary,
    borderColor:     Colors.primary,
  },
  riordinaBtnText: {
    fontSize:   13,
    fontWeight: '700',
    color:      Colors.inkSoft,
  },
  riordinaBtnTextAttivo: {
    color: '#FFFFFF',
  },
  aggiungiFotoBtn: {
    backgroundColor:   Colors.primaryTint,
    borderRadius:      Radius.sm,
    paddingHorizontal: 12,
    paddingVertical:   6,
    borderWidth:       1,
    borderColor:       Colors.primaryBorder,
  },
  aggiungiFotoBtnText: {
    fontSize:   13,
    fontWeight: '700',
    color:      Colors.primary,
  },
  fotoLoading: {
    paddingVertical: 24,
    alignItems:      'center',
  },
  hintText: {
    fontSize:  12,
    color:     Colors.inkFaint,
    textAlign: 'center',
    marginTop: -4,
  },
  avvisoBanner: {
    backgroundColor: Colors.warningTint,
    borderRadius:    Radius.sm,
    padding:         12,
    borderWidth:     1,
    borderColor:     Colors.warningBorder,
  },
  avvisoBannerText: {
    fontSize:   13,
    color:      Colors.warningText,
    lineHeight: 18,
  },
  codiceContainer: {
    gap: 6,
  },
  codiceLabel: {
    ...overline,
    fontSize:      10.5,
    letterSpacing: 0.9,
  },
  obbligatorio: {
    color: Colors.danger,
  },
  codiceInput: {
    backgroundColor:   Colors.surface,
    borderWidth:       1.5,
    borderColor:       Colors.hairlineStrong,
    borderRadius:      Radius.md,
    paddingHorizontal: 14,
    paddingVertical:   12,
    fontSize:          15,
    color:             Colors.ink,
    fontFamily:        MONO_FONT,
    letterSpacing:     0.5,
  },
  codiceInputError: {
    borderColor:     Colors.danger,
    backgroundColor: Colors.dangerTint,
  },
  codiceInputDisabled: {
    backgroundColor: Colors.surfaceSunken,
    color:           Colors.inkFaint,
  },
  codiceErrore: {
    fontSize:   12,
    color:      Colors.dangerText,
    fontWeight: '600',
  },
  codiceHelper: {
    fontSize:   12,
    color:      Colors.inkFaint,
    lineHeight: 16,
  },
  inviaButton: {
    width: '100%',
  },
  erroreInvioText: {
    fontSize:   13,
    color:      Colors.dangerText,
    textAlign:  'center',
    lineHeight: 18,
  },
  retrySect: {
    gap:       10,
    marginTop: -2,
  },
  retryInfo: {
    fontSize:   13,
    color:      Colors.inkMuted,
    lineHeight: 18,
  },
  retryButton: {
    alignSelf: 'flex-start',
  },
  infoSezione: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
  },
  infoLabel: {
    ...overline,
    fontSize:      10.5,
    letterSpacing: 0.9,
    // Senza flexShrink i due testi non cedono spazio e la riga trabocca:
    // l'etichetta si accorcia, il codice resta sempre leggibile per intero.
    flexShrink:    1,
    marginRight:   12,
  },
  infoValore: {
    fontSize:      14,
    fontWeight:    '700',
    color:         Colors.ink,
    fontFamily:    MONO_FONT,
    letterSpacing: 0.4,
    flexShrink:    0,
  },
});

const esitoStyles = StyleSheet.create({
  card: {
    borderRadius: Radius.md,
    borderWidth:  1,
    overflow:     'hidden',
  },
  header: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
    paddingHorizontal: 12,
    paddingVertical:   10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.06)',
  },
  label: {
    fontSize:      11,
    fontWeight:    '700',
    textTransform: 'uppercase',
    letterSpacing: 0.9,
  },
  data: {
    fontSize:    11,
    color:       Colors.inkFaint,
    fontWeight:  '600',
    fontVariant: ['tabular-nums'],
  },
  jsonScroll: {
    maxHeight: 200,
  },
  jsonText: {
    fontFamily: MONO_FONT,
    fontSize:   12,
    color:      Colors.inkSoft,
    lineHeight: 18,
    padding:    12,
  },
});

// ─────────────────────────────────────────────
// STILI VISORE FOTO
// ─────────────────────────────────────────────

const visoreStyles = StyleSheet.create({
  sfondo: {
    flex:            1,
    backgroundColor: '#000000',
  },
  area: {
    flex:           1,
    justifyContent: 'center',
    alignItems:     'center',
  },
  immagine: {
    width:  '100%',
    height: '100%',
  },
  // Sovrapposta all'immagine: i tocchi sulla barra non chiudono il visore,
  // così il pulsante resta cliccabile senza chiusure accidentali
  barra: {
    position:        'absolute',
    top:             0,
    left:            0,
    right:           0,
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'space-between',
    paddingHorizontal: 16,
    paddingBottom:   12,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  contatore: {
    color:         '#FFFFFF',
    fontSize:      13,
    fontWeight:    '700',
    letterSpacing: 0.5,
  },
  chiudi: {
    paddingHorizontal: 14,
    paddingVertical:   7,
    borderRadius:      Radius.md,
    backgroundColor:   'rgba(255,255,255,0.16)',
  },
  chiudiTesto: {
    color:      '#FFFFFF',
    fontSize:   14,
    fontWeight: '700',
  },
});
