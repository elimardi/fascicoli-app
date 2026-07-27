/**
 * @file components/StatusBadge.tsx
 * Pill di stato del fascicolo in stile "etichetta d'archivio":
 * maiuscoletto spaziato, tinta piena tenue, puntino colorato.
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { STATO_COLORS } from '@/constants';
import { Radius } from '@/constants/theme';
import type { StatusBadgeProps } from '@/types';

export function StatusBadge({ stato, size = 'sm' }: StatusBadgeProps) {
  const colors = STATO_COLORS[stato];
  const isMd   = size === 'md';

  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor:   colors.bg,
          paddingHorizontal: isMd ? 12 : 9,
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
            fontSize: isMd ? 11.5 : 10.5,
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
    flexDirection: 'row',
    alignItems:    'center',
    borderRadius:  Radius.pill,
    alignSelf:     'flex-start',
    gap:           5,
  },
  dot: {
    width:        6,
    height:       6,
    borderRadius: 3,
  },
  label: {
    fontWeight:    '700',
    letterSpacing: 0.7,
    textTransform: 'uppercase',
  },
});
