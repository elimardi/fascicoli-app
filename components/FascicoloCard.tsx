/**
 * @file components/FascicoloCard.tsx
 * Card per la lista fascicoli con swipe-to-delete.
 * Mostra titolo, descrizione, numero foto, stato e data creazione.
 * Il swipe left rivela un pulsante "Elimina" rosso.
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
import { CONFIRM_MESSAGES } from '@/constants';
import type { FascicoloCardProps } from '@/types';

// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────

/**
 * Formatta una stringa ISO 8601 in formato leggibile italiano.
 * Es. "2024-03-15T14:30:00.000Z" → "15/03/2024"
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

/**
 * Card riusabile per la lista fascicoli.
 * Implementa swipe-to-delete con Alert di conferma doppio
 * per i fascicoli già inviati.
 *
 * @example
 * <FascicoloCard
 *   fascicolo={item}
 *   numeroFoto={item.numero_foto}
 *   onPress={() => router.push(`/fascicolo/${item.id}`)}
 *   onDelete={() => handleDelete(item.id)}
 * />
 */
export function FascicoloCard({
  fascicolo,
  numeroFoto,
  onPress,
  onDelete,
}: FascicoloCardProps) {
  // ── Conferma eliminazione ──
  const handleDeletePress = useCallback(() => {
    const isInviato = fascicolo.stato === 'inviato';

    // Prima conferma — sempre mostrata
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
                // Seconda conferma solo per fascicoli inviati
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

  // ── Azione swipe destra (pulsante elimina) ──
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
        activeOpacity={0.75}
      >
        {/* Header: titolo + badge stato */}
        <View style={styles.header}>
          <Text style={styles.titolo} numberOfLines={1}>
            {fascicolo.titolo}
          </Text>
          <StatusBadge stato={fascicolo.stato} size="sm" />
        </View>

        {/* Descrizione (opzionale) */}
        {fascicolo.descrizione ? (
          <Text style={styles.descrizione} numberOfLines={2}>
            {fascicolo.descrizione}
          </Text>
        ) : null}

        {/* Footer: numero foto + data */}
        <View style={styles.footer}>
          <View style={styles.fotoChip}>
            <Text style={styles.fotoChipText}>
              {numeroFoto} {numeroFoto === 1 ? 'foto' : 'foto'}
            </Text>
          </View>
          <Text style={styles.data}>
            {formatData(fascicolo.data_creazione)}
          </Text>
        </View>
      </TouchableOpacity>
    </Swipeable>
  );
}

// ─────────────────────────────────────────────
// STILI
// ─────────────────────────────────────────────

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginVertical:   6,
    borderRadius:     12,
    padding:          16,
    borderWidth:      1,
    borderColor:      '#E5E7EB',
    // Ombra sottile iOS
    shadowColor:   '#000',
    shadowOffset:  { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius:  3,
    // Elevazione Android
    elevation: 2,
  },
  header: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
    marginBottom:   6,
    gap:            8,
  },
  titolo: {
    flex:       1,
    fontSize:   16,
    fontWeight: '600',
    color:      '#111827',
  },
  descrizione: {
    fontSize:     13,
    color:        '#6B7280',
    lineHeight:   18,
    marginBottom: 10,
  },
  footer: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
    marginTop:      8,
  },
  fotoChip: {
    backgroundColor: '#F3F4F6',
    borderRadius:    6,
    paddingHorizontal: 8,
    paddingVertical:   3,
  },
  fotoChipText: {
    fontSize:   12,
    color:      '#374151',
    fontWeight: '500',
  },
  data: {
    fontSize: 12,
    color:    '#9CA3AF',
  },
  deleteAction: {
    backgroundColor: '#EF4444',
    justifyContent:  'center',
    alignItems:      'center',
    width:           88,
    marginVertical:  6,
    marginRight:     16,
    borderRadius:    12,
  },
  deleteActionText: {
    color:      '#FFFFFF',
    fontWeight: '600',
    fontSize:   14,
  },
});
