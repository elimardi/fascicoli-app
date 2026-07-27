/**
 * @file components/FotoGrid.tsx
 * Griglia foto a 2 colonne con layout flessibile (nessun calcolo dalla
 * larghezza schermo: le celle si adattano al contenitore, quindi la
 * griglia non sborda mai anche dentro card con padding).
 *
 * Interazioni:
 * - Long-press su una foto → conferma eliminazione
 * - Modalità riordino (prop `riordinoAttivo`): ogni cella mostra le
 *   frecce ◀ ▶ per spostare la foto prima/dopo nella sequenza.
 *   Funziona ovunque, Expo Go compreso (nessuna libreria di drag nativa).
 */

import React, { useCallback, useMemo } from 'react';
import {
  View,
  Image,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native';
import { CONFIRM_MESSAGES } from '@/constants';
import { Colors, Radius } from '@/constants/theme';
import { IconFotocamera } from './EmptyState';
import type { FotoGridProps, Foto } from '@/types';

const GRID_GAP = 8;

// ─────────────────────────────────────────────
// CELLA SINGOLA
// ─────────────────────────────────────────────

interface FotoCellaProps {
  foto:           Foto;
  indice:         number;
  totale:         number;
  riordinoAttivo: boolean;
  onPress:        (foto: Foto) => void;
  onLongPress:    (foto: Foto) => void;
  onSposta:       (daIndice: number, aIndice: number) => void;
}

function FotoCella({
  foto,
  indice,
  totale,
  riordinoAttivo,
  onPress,
  onLongPress,
  onSposta,
}: FotoCellaProps) {
  const isPrima  = indice === 0;
  const isUltima = indice === totale - 1;

  return (
    <View style={styles.cella}>
      <TouchableOpacity
        onPress={() => onPress(foto)}
        onLongPress={riordinoAttivo ? undefined : () => onLongPress(foto)}
        delayLongPress={400}
        activeOpacity={0.85}
        style={styles.cellaTouch}
      >
        <Image
          source={{ uri: foto.percorso_locale }}
          style={styles.immagine}
          resizeMode="cover"
        />
        <View style={styles.numeroBadge}>
          <Text style={styles.numeroBadgeText}>{indice + 1}</Text>
        </View>
      </TouchableOpacity>

      {/* Controlli riordino: frecce sposta prima / sposta dopo */}
      {riordinoAttivo && (
        <View style={styles.riordinoBar}>
          <TouchableOpacity
            style={[styles.frecciaBtn, isPrima && styles.frecciaBtnDisabled]}
            disabled={isPrima}
            onPress={() => onSposta(indice, indice - 1)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={[styles.frecciaText, isPrima && styles.frecciaTextDisabled]}>
              ◀
            </Text>
          </TouchableOpacity>
          <Text style={styles.riordinoPos}>{indice + 1}ª</Text>
          <TouchableOpacity
            style={[styles.frecciaBtn, isUltima && styles.frecciaBtnDisabled]}
            disabled={isUltima}
            onPress={() => onSposta(indice, indice + 1)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={[styles.frecciaText, isUltima && styles.frecciaTextDisabled]}>
              ▶
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

// ─────────────────────────────────────────────
// GRIGLIA
// ─────────────────────────────────────────────

export function FotoGrid({
  foto,
  onFotoPress,
  onFotoLongPress,
  onReorder,
  riordinoAttivo = false,
}: FotoGridProps) {

  // ── Long-press → conferma eliminazione ──
  const handleLongPress = useCallback(
    (fotoItem: Foto) => {
      Alert.alert(
        CONFIRM_MESSAGES.ELIMINA_FOTO.title,
        CONFIRM_MESSAGES.ELIMINA_FOTO.message,
        [
          { text: 'Annulla', style: 'cancel' },
          {
            text:    'Elimina',
            style:   'destructive',
            onPress: () => onFotoLongPress(fotoItem),
          },
        ]
      );
    },
    [onFotoLongPress]
  );

  // ── Sposta una foto da un indice all'altro ──
  const handleSposta = useCallback(
    (daIndice: number, aIndice: number) => {
      if (aIndice < 0 || aIndice >= foto.length) return;
      const nuovoOrdine = [...foto];
      const [spostata] = nuovoOrdine.splice(daIndice, 1);
      nuovoOrdine.splice(aIndice, 0, spostata);
      onReorder(nuovoOrdine);
    },
    [foto, onReorder]
  );

  // ── Divide le foto in righe da 2 ──
  const righe = useMemo(() => {
    const result: Foto[][] = [];
    for (let i = 0; i < foto.length; i += 2) {
      result.push(foto.slice(i, i + 2));
    }
    return result;
  }, [foto]);

  if (foto.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <View style={styles.emptyIconTile}>
          <IconFotocamera size={26} />
        </View>
        <Text style={styles.emptyTitle}>Nessuna foto</Text>
        <Text style={styles.emptySubtitle}>
          Tocca "Aggiungi foto" per scattare o selezionare immagini
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.griglia}>
      {righe.map((riga, rigaIdx) => (
        <View key={`riga-${rigaIdx}`} style={styles.riga}>
          {riga.map((f, colIdx) => (
            <FotoCella
              key={f.id}
              foto={f}
              indice={rigaIdx * 2 + colIdx}
              totale={foto.length}
              riordinoAttivo={riordinoAttivo}
              onPress={onFotoPress}
              onLongPress={handleLongPress}
              onSposta={handleSposta}
            />
          ))}
          {/* Spaziatore per mantenere la larghezza a metà se la riga ha 1 sola foto */}
          {riga.length === 1 && <View style={styles.cellaVuota} />}
        </View>
      ))}
    </View>
  );
}

// ─────────────────────────────────────────────
// STILI
// ─────────────────────────────────────────────

const styles = StyleSheet.create({
  griglia: {
    gap: GRID_GAP,
  },
  riga: {
    flexDirection: 'row',
    gap:           GRID_GAP,
  },
  cella: {
    flex: 1,
  },
  cellaVuota: {
    flex: 1,
  },
  cellaTouch: {
    aspectRatio:     1,
    borderRadius:    Radius.md,
    overflow:        'hidden',
    backgroundColor: Colors.surfaceSunken,
    borderWidth:     1,
    borderColor:     Colors.hairline,
  },
  immagine: {
    width:  '100%',
    height: '100%',
  },
  numeroBadge: {
    position:          'absolute',
    top:               7,
    left:              7,
    backgroundColor:   'rgba(16,24,40,0.62)',
    borderRadius:      Radius.pill,
    paddingHorizontal: 7,
    paddingVertical:   2,
  },
  numeroBadgeText: {
    color:      '#FFFFFF',
    fontSize:   11,
    fontWeight: '700',
  },
  riordinoBar: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
    marginTop:         5,
    backgroundColor:   Colors.primaryTint,
    borderRadius:      Radius.sm,
    borderWidth:       1,
    borderColor:       Colors.primaryBorder,
    paddingVertical:   2,
    paddingHorizontal: 4,
  },
  frecciaBtn: {
    paddingHorizontal: 12,
    paddingVertical:   4,
  },
  frecciaBtnDisabled: {
    opacity: 0.25,
  },
  frecciaText: {
    fontSize: 14,
    color:    Colors.primary,
  },
  frecciaTextDisabled: {
    color: Colors.inkFaint,
  },
  riordinoPos: {
    fontSize:    12,
    fontWeight:  '700',
    color:       Colors.primary,
    fontVariant: ['tabular-nums'],
  },
  emptyContainer: {
    alignItems:        'center',
    paddingVertical:   40,
    paddingHorizontal: 32,
  },
  emptyIconTile: {
    width:           56,
    height:          56,
    borderRadius:    Radius.lg,
    backgroundColor: Colors.primaryTint,
    borderWidth:     1,
    borderColor:     Colors.primaryBorder,
    alignItems:      'center',
    justifyContent:  'center',
    marginBottom:    12,
  },
  emptyTitle: {
    fontSize:     16,
    fontWeight:   '700',
    color:        Colors.ink,
    marginBottom: 5,
  },
  emptySubtitle: {
    fontSize:   13.5,
    color:      Colors.inkMuted,
    textAlign:  'center',
    lineHeight: 19,
  },
});
