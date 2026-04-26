/**
 * @file components/StatusBadge.tsx
 * Badge colorato per la visualizzazione dello stato di un fascicolo.
 * Supporta due dimensioni: 'sm' (liste) e 'md' (dettaglio header).
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { STATO_COLORS } from '@/constants';
import type { StatusBadgeProps } from '@/types';

/**
 * Mostra un pill colorato con l'etichetta dello stato del fascicolo.
 *
 * @example
 * <StatusBadge stato="bozza" size="sm" />
 * <StatusBadge stato="inviato" size="md" />
 */
export function StatusBadge({ stato, size = 'sm' }: StatusBadgeProps) {
  const colors = STATO_COLORS[stato];
  const isMd   = size === 'md';

  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: colors.bg,
          borderColor:     colors.border,
          paddingHorizontal: isMd ? 12 : 8,
          paddingVertical:   isMd ? 5  : 3,
        },
      ]}
    >
      <View style={[styles.dot, { backgroundColor: colors.border }]} />
      <Text
        style={[
          styles.label,
          {
            color:    colors.text,
            fontSize: isMd ? 13 : 11,
          },
        ]}
      >
        {colors.label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection:  'row',
    alignItems:     'center',
    borderRadius:   20,
    borderWidth:    1,
    alignSelf:      'flex-start',
    gap:            5,
  },
  dot: {
    width:        6,
    height:       6,
    borderRadius: 3,
  },
  label: {
    fontWeight: '600',
    letterSpacing: 0.2,
  },
});
