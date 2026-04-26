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
  ScrollView,
  StyleSheet,
  RefreshControl,
  TextInput,
  Alert,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { useLocalSearchParams, useRouter, useNavigation } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import { useFascicolo } from '@/hooks/useFascicolo';
import { validateCodiceDocumento } from '@/services/fascicoli.service';
import { StatusBadge, FotoGrid, LoadingButton } from '@/components';
import { TOAST_MESSAGES } from '@/constants';
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

  const borderColor = isErrore ? '#FCA5A5' : '#6EE7B7';
  const bgColor     = isErrore ? '#FFF5F5' : '#F0FDF4';
  const labelColor  = isErrore ? '#991B1B' : '#065F46';

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
    eliminaFoto,
    riordina,
    invia,
  } = useFascicolo(fascicoloId);

  // ── Stato locale per il form di invio ──
  const [codiceDocumento,  setCodiceDocumento]  = useState('');
  const [erroreCodice,     setErroreCodice]     = useState<string | null>(null);
  const [isRefreshing,     setIsRefreshing]     = useState(false);

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
        <ActivityIndicator size="large" color="#6366F1" />
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
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={[
        styles.content,
        { paddingBottom: insets.bottom + 32 },
      ]}
      refreshControl={
        <RefreshControl
          refreshing={isRefreshing}
          onRefresh={handleRefresh}
          tintColor="#6366F1"
          colors={['#6366F1']}
        />
      }
      showsVerticalScrollIndicator={false}
    >
      {/* ── Header fascicolo ── */}
      <View style={styles.header}>
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

        {loadingFoto && foto.length === 0 ? (
          <View style={styles.fotoLoading}>
            <ActivityIndicator size="small" color="#6366F1" />
          </View>
        ) : (
          <FotoGrid
            foto={foto}
            onFotoPress={() => {}}
            onFotoLongPress={handleEliminaFoto}
            onReorder={handleReorder}
          />
        )}

        {/* Hint drag-and-drop */}
        {foto.length > 1 && isBozza && (
          <Text style={styles.hintText}>
            Tieni premuto una foto per riordinarla
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
              Codice documento <Text style={styles.obbligatorio}>*</Text>
            </Text>
            <TextInput
              style={[
                styles.codiceInput,
                erroreCodice ? styles.codiceInputError : null,
                !canInvio ? styles.codiceInputDisabled : null,
              ]}
              value={codiceDocumento}
              onChangeText={handleCodiceChange}
              placeholder="Es. 2024/DOC/001"
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
                onPress={() => {}}
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
          <Text style={styles.infoLabel}>Codice documento inviato</Text>
          <Text style={styles.infoValore}>{fascicolo.codice_documento}</Text>
        </View>
      )}
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
    color:     '#6B7280',
    textAlign: 'center',
  },
  header: {
    backgroundColor: '#FFFFFF',
    borderRadius:    12,
    padding:         16,
    borderWidth:     1,
    borderColor:     '#F3F4F6',
    gap:             8,
  },
  headerTop: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
  },
  dataCreazione: {
    fontSize: 12,
    color:    '#9CA3AF',
  },
  descrizione: {
    fontSize:   14,
    color:      '#6B7280',
    lineHeight: 20,
  },
  sezione: {
    backgroundColor: '#FFFFFF',
    borderRadius:    12,
    padding:         16,
    borderWidth:     1,
    borderColor:     '#F3F4F6',
    gap:             12,
  },
  sezioneHeader: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
  },
  sezioneTitolo: {
    fontSize:   15,
    fontWeight: '600',
    color:      '#111827',
  },
  aggiungiFotoBtn: {
    backgroundColor:   '#EEF2FF',
    borderRadius:      8,
    paddingHorizontal: 12,
    paddingVertical:   6,
    borderWidth:       1,
    borderColor:       '#C7D2FE',
  },
  aggiungiFotoBtnText: {
    fontSize:   13,
    fontWeight: '600',
    color:      '#4F46E5',
  },
  fotoLoading: {
    paddingVertical: 24,
    alignItems:      'center',
  },
  hintText: {
    fontSize:  12,
    color:     '#9CA3AF',
    textAlign: 'center',
    marginTop: -4,
  },
  avvisoBanner: {
    backgroundColor: '#FEF3C7',
    borderRadius:    8,
    padding:         12,
    borderWidth:     1,
    borderColor:     '#FCD34D',
  },
  avvisoBannerText: {
    fontSize:   13,
    color:      '#92400E',
    lineHeight: 18,
  },
  codiceContainer: {
    gap: 6,
  },
  codiceLabel: {
    fontSize:   14,
    fontWeight: '500',
    color:      '#374151',
  },
  obbligatorio: {
    color: '#EF4444',
  },
  codiceInput: {
    backgroundColor:   '#FFFFFF',
    borderWidth:       1,
    borderColor:       '#D1D5DB',
    borderRadius:      10,
    paddingHorizontal: 14,
    paddingVertical:   11,
    fontSize:          15,
    color:             '#111827',
    fontWeight:        '500',
    letterSpacing:     0.5,
  },
  codiceInputError: {
    borderColor:     '#EF4444',
    backgroundColor: '#FFF5F5',
  },
  codiceInputDisabled: {
    backgroundColor: '#F9FAFB',
    color:           '#9CA3AF',
  },
  codiceErrore: {
    fontSize:   12,
    color:      '#EF4444',
    fontWeight: '500',
  },
  codiceHelper: {
    fontSize:  12,
    color:     '#9CA3AF',
    lineHeight: 16,
  },
  inviaButton: {
    width: '100%',
  },
  erroreInvioText: {
    fontSize:   13,
    color:      '#EF4444',
    textAlign:  'center',
    lineHeight: 18,
  },
  retrySect: {
    gap:       8,
    marginTop: -4,
  },
  retryInfo: {
    fontSize:  13,
    color:     '#6B7280',
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
    fontSize: 13,
    color:    '#6B7280',
  },
  infoValore: {
    fontSize:   14,
    fontWeight: '600',
    color:      '#111827',
  },
});

const esitoStyles = StyleSheet.create({
  card: {
    borderRadius: 10,
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
    fontSize:   12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  data: {
    fontSize: 11,
    color:    '#9CA3AF',
  },
  jsonScroll: {
    maxHeight: 200,
  },
  jsonText: {
    fontFamily:   'monospace',
    fontSize:     12,
    color:        '#374151',
    lineHeight:   18,
    padding:      12,
  },
});
