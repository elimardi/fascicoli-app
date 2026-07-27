/**
 * @file components/FascicoloCard.tsx
 * Card per la lista fascicoli con swipe-to-delete.
 * Firma visiva: dorso colorato a sinistra (colore dello stato),
 * come le etichette delle cartelline d'archivio.
 */

import React, { useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { StatusBadge } from './StatusBadge';
import { CONFIRM_MESSAGES, STATO_COLORS } from '@/constants';
import { Colors, Radius, SPINE_WIDTH, cardShadow } from '@/constants/theme';
import type { FascicoloCardProps } from '@/types';

// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────

/**
 * Formatta una stringa ISO 8601 in data italiana. Es. "15/03/2026"
 */
function formatData(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('it-IT', {
      day:   '2-digit',
      month: '2-digit',
      year:  'numeric',
    });
  } catch {
    return iso;
  }
}

// ─────────────────────────────────────────────
// COMPONENTE
// ─────────────────────────────────────────────

export function FascicoloCard({
  fascicolo,
  numeroFoto,
  onPress,
  onDelete,
}: FascicoloCardProps) {
  const spineColor = STATO_COLORS[fascicolo.stato].spine;

  // ── Conferma eliminazione ──
  const handleDeletePress = useCallback(() => {
    const isInviato = fascicolo.stato === 'inviato';

    Alert.alert(
      CONFIRM_MESSAGES.ELIMINA_FASCICOLO_BOZZA.title,
      isInviato
        ? CONFIRM_MESSAGES.ELIMINA_FASCICOLO_INVIATO.message
        : CONFIRM_MESSAGES.ELIMINA_FASCICOLO_BOZZA.message,
      [
        { text: 'Annulla', style: 'cancel' },
        {
          text:    'Elimina',
          style:   'destructive',
          onPress: isInviato
            ? () => {
                Alert.alert(
                  'Conferma finale',
                  'Sei sicuro? Il fascicolo inviato verrà eliminato definitivamente.',
                  [
                    { text: 'Annulla', style: 'cancel' },
                    { text: 'Elimina definitivamente', style: 'destructive', onPress: onDelete },
                  ]
                );
              }
            : onDelete,
        },
      ]
    );
  }, [fascicolo.stato, onDelete]);

  // ── Azione swipe (pulsante elimina) ──
  const renderRightActions = useCallback(
    () => (
      <TouchableOpacity
        style={styles.deleteAction}
        onPress={handleDeletePress}
        activeOpacity={0.8}
      >
        <Text style={styles.deleteActionText}>Elimina</Text>
      </TouchableOpacity>
    ),
    [handleDeletePress]
  );

  return (
    <Swipeable
      renderRightActions={renderRightActions}
      rightThreshold={60}
      overshootRight={false}
    >
      <TouchableOpacity
        style={styles.card}
        onPress={onPress}
        activeOpacity={0.72}
      >
        {/* Dorso colorato per stato */}
        <View style={[styles.spine, { backgroundColor: spineColor }]} />

        <View style={styles.body}>
          {/* Riga titolo + badge stato */}
          <View style={styles.header}>
            <Text style={styles.titolo} numberOfLines={1}>
              {fascicolo.titolo}
            </Text>
            <StatusBadge stato={fascicolo.stato} size="sm" />
          </View>

          {/* Descrizione (opzionale) */}
          {fascicolo.descrizione ? (
            <Text style={styles.descrizione} numberOfLines={1}>
              {fascicolo.descrizione}
            </Text>
          ) : null}

          {/* Riga meta: numero foto · data */}
          <View style={styles.meta}>
            <Text style={styles.metaText}>
              {numeroFoto} {numeroFoto === 1 ? 'foto' : 'foto'}
            </Text>
            <View style={styles.metaDot} />
            <Text style={styles.metaText}>
              {formatData(fascicolo.data_creazione)}
            </Text>
          </View>
        </View>

        {/* Chevron */}
        <Text style={styles.chevron}>›</Text>
      </TouchableOpacity>
    </Swipeable>
  );
}

// ─────────────────────────────────────────────
// STILI
// ─────────────────────────────────────────────

const styles = StyleSheet.create({
  card: {
    flexDirection:    'row',
    alignItems:       'center',
    backgroundColor:  Colors.surface,
    marginHorizontal: 16,
    marginVertical:   5,
    borderRadius:     Radius.lg - 2,
    borderWidth:      1,
    borderColor:      Colors.hairline,
    overflow:         'hidden',
    ...cardShadow,
  },
  spine: {
    width:        SPINE_WIDTH,
    alignSelf:    'stretch',
  },
  body: {
    flex:            1,
    paddingVertical: 14,
    paddingLeft:     14,
    paddingRight:    8,
    gap:             5,
  },
  header: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
    gap:            10,
  },
  titolo: {
    flex:          1,
    fontSize:      16,
    fontWeight:    '700',
    letterSpacing: -0.2,
    color:         Colors.ink,
  },
  descrizione: {
    fontSize:   13,
    color:      Colors.inkMuted,
    lineHeight: 18,
  },
  meta: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           7,
    marginTop:     2,
  },
  metaText: {
    fontSize:      12,
    color:         Colors.inkFaint,
    fontWeight:    '600',
    fontVariant:   ['tabular-nums'],
  },
  metaDot: {
    width:           3,
    height:          3,
    borderRadius:    2,
    backgroundColor: Colors.hairlineStrong,
  },
  chevron: {
    fontSize:     26,
    color:        Colors.inkFaint,
    fontWeight:   '300',
    paddingRight: 14,
    marginTop:    -2,
  },
  deleteAction: {
    backgroundColor: '#D92D20',
    justifyContent:  'center',
    alignItems:      'center',
    width:           88,
    marginVertical:  5,
    marginRight:     16,
    borderRadius:    Radius.lg - 2,
  },
  deleteActionText: {
    color:         '#FFFFFF',
    fontWeight:    '700',
    fontSize:      13,
    letterSpacing: 0.3,
  },
});
