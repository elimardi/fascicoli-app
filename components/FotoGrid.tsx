/**
 * @file components/FotoGrid.tsx
 * Griglia foto a 2 colonne con drag-and-drop (react-native-draggable-flatlist)
 * e long-press per eliminazione singola con conferma Alert.
 * Richiede development build — non compatibile con Expo Go.
 */

import React, { useCallback } from 'react';
import {
  View,
  Image,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Dimensions,
} from 'react-native';
import DraggableFlatList, {
  type RenderItemParams,
  ScaleDecorator,
} from 'react-native-draggable-flatlist';
import { CONFIRM_MESSAGES } from '@/constants';
import type { FotoGridProps, Foto } from '@/types';

const SCREEN_WIDTH = Dimensions.get('window').width;
const GRID_PADDING = 16;
const GRID_GAP     = 8;
const CELL_SIZE    = (SCREEN_WIDTH - GRID_PADDING * 2 - GRID_GAP) / 2;

interface FotoCellaProps {
  foto:        Foto;
  indice:      number;
  drag:        () => void;
  isActive:    boolean;
  onLongPress: (foto: Foto) => void;
}

function FotoCella({ foto, indice, drag, isActive, onLongPress }: FotoCellaProps) {
  return (
    <ScaleDecorator activeScale={0.96}>
      <TouchableOpacity
        onLongPress={() => onLongPress(foto)}
        delayLongPress={400}
        activeOpacity={0.85}
        style={[styles.cella, isActive && styles.cellaAttiva]}
      >
        <Image
          source={{ uri: foto.percorso_locale }}
          style={styles.immagine}
          resizeMode="cover"
        />
        <View style={styles.numeroBadge}>
          <Text style={styles.numeroBadgeText}>{indice + 1}</Text>
        </View>
        {isActive && (
          <View style={styles.dragOverlay}>
            <Text style={styles.dragIcon}>⠿</Text>
          </View>
        )}
      </TouchableOpacity>
    </ScaleDecorator>
  );
}

export function FotoGrid({
  foto,
  onFotoPress,
  onFotoLongPress,
  onReorder,
}: FotoGridProps) {

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

  const renderItem = useCallback(
    ({ item, getIndex, drag, isActive }: RenderItemParams<Foto>) => {
      const indice = getIndex() ?? 0;
      return (
        <FotoCella
          foto={item}
          indice={indice}
          drag={drag}
          isActive={isActive}
          onLongPress={handleLongPress}
        />
      );
    },
    [handleLongPress]
  );

  if (foto.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyIcon}>📷</Text>
        <Text style={styles.emptyTitle}>Nessuna foto</Text>
        <Text style={styles.emptySubtitle}>
          Tocca "Aggiungi foto" per scattare o selezionare immagini
        </Text>
      </View>
    );
  }

  return (
    <DraggableFlatList
      data={foto}
      keyExtractor={(item) => String(item.id)}
      renderItem={renderItem}
      numColumns={2}
      onDragEnd={({ data }) => onReorder(data)}
      containerStyle={styles.lista}
      columnWrapperStyle={styles.riga}
      scrollEnabled={false}
      activationDistance={15}
    />
  );
}

const styles = StyleSheet.create({
  lista: {
    paddingHorizontal: GRID_PADDING,
  },
  riga: {
    gap:          GRID_GAP,
    marginBottom: GRID_GAP,
  },
  cella: {
    width:           CELL_SIZE,
    height:          CELL_SIZE,
    borderRadius:    10,
    overflow:        'hidden',
    backgroundColor: '#F3F4F6',
  },
  cellaAttiva: {
    opacity:     0.85,
    borderWidth: 2,
    borderColor: '#6366F1',
  },
  immagine: {
    width:  '100%',
    height: '100%',
  },
  numeroBadge: {
    position:          'absolute',
    top:               6,
    left:              6,
    backgroundColor:   'rgba(0,0,0,0.55)',
    borderRadius:      10,
    paddingHorizontal: 6,
    paddingVertical:   2,
  },
  numeroBadgeText: {
    color:      '#FFFFFF',
    fontSize:   11,
    fontWeight: '700',
  },
  dragOverlay: {
    position:        'absolute',
    top:             0,
    left:            0,
    right:           0,
    bottom:          0,
    backgroundColor: 'rgba(99,102,241,0.2)',
    justifyContent:  'center',
    alignItems:      'center',
  },
  dragIcon: {
    fontSize: 32,
    color:    '#FFFFFF',
    opacity:  0.9,
  },
  emptyContainer: {
    alignItems:        'center',
    paddingVertical:   40,
    paddingHorizontal: 32,
  },
  emptyIcon: {
    fontSize:     48,
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize:     17,
    fontWeight:   '600',
    color:        '#374151',
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize:  14,
    color:     '#9CA3AF',
    textAlign: 'center',
    lineHeight: 20,
  },
});
