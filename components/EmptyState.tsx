/**
 * @file components/EmptyState.tsx
 * Stato vuoto con icona vettoriale in riquadro tinteggiato,
 * titolo, sottotitolo e CTA opzionale.
 * Accetta un nodo icona custom (SVG) oppure un'emoji legacy.
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { LoadingButton } from './LoadingButton';
import { Colors, Radius } from '@/constants/theme';

// ─────────────────────────────────────────────
// ICONE VETTORIALI
// ─────────────────────────────────────────────

/** Cartellina d'archivio — icona di default */
export function IconCartella({ size = 30, color = Colors.primary }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M3 7.5A2.5 2.5 0 0 1 5.5 5h3.6c.6 0 1.2.25 1.6.7l1 1.1c.4.45 1 .7 1.6.7h5.2A2.5 2.5 0 0 1 21 10v6.5a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 16.5v-9Z"
        stroke={color}
        strokeWidth={1.8}
        strokeLinejoin="round"
      />
      <Path d="M3 11h18" stroke={color} strokeWidth={1.8} />
    </Svg>
  );
}

/** Fotocamera — per stati vuoti legati alle foto */
export function IconFotocamera({ size = 30, color = Colors.primary }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M4 9a2 2 0 0 1 2-2h1.2l1-1.4c.3-.4.7-.6 1.2-.6h5.2c.5 0 .9.2 1.2.6l1 1.4H18a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V9Z"
        stroke={color}
        strokeWidth={1.8}
        strokeLinejoin="round"
      />
      <Path
        d="M12 16.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4Z"
        stroke={color}
        strokeWidth={1.8}
      />
    </Svg>
  );
}

// ─────────────────────────────────────────────
// TIPI
// ─────────────────────────────────────────────

interface EmptyStateProps {
  /** Emoji legacy (ignorata se è presente iconNode) */
  icon?: string;
  /** Nodo icona custom, tipicamente un SVG */
  iconNode?: React.ReactNode;
  title: string;
  subtitle?: string;
  /** Testo del pulsante CTA (opzionale) */
  ctaLabel?: string;
  onCta?: () => void;
}

// ─────────────────────────────────────────────
// COMPONENTE
// ─────────────────────────────────────────────

export function EmptyState({
  icon,
  iconNode,
  title,
  subtitle,
  ctaLabel,
  onCta,
}: EmptyStateProps) {
  return (
    <View style={styles.container}>
      <View style={styles.iconTile}>
        {iconNode ?? (icon ? <Text style={styles.iconEmoji}>{icon}</Text> : <IconCartella />)}
      </View>
      <Text style={styles.title}>{title}</Text>
      {subtitle ? (
        <Text style={styles.subtitle}>{subtitle}</Text>
      ) : null}
      {ctaLabel && onCta ? (
        <LoadingButton
          label={ctaLabel}
          onPress={onCta}
          variant="primary"
          size="md"
          style={styles.cta}
        />
      ) : null}
    </View>
  );
}

// ─────────────────────────────────────────────
// STILI
// ─────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex:              1,
    alignItems:        'center',
    justifyContent:    'center',
    paddingHorizontal: 40,
    paddingVertical:   60,
  },
  iconTile: {
    width:           72,
    height:          72,
    borderRadius:    Radius.xl,
    backgroundColor: Colors.primaryTint,
    borderWidth:     1,
    borderColor:     Colors.primaryBorder,
    alignItems:      'center',
    justifyContent:  'center',
    marginBottom:    18,
  },
  iconEmoji: {
    fontSize: 30,
  },
  title: {
    fontSize:      19,
    fontWeight:    '700',
    color:         Colors.ink,
    letterSpacing: -0.3,
    textAlign:     'center',
    marginBottom:  8,
  },
  subtitle: {
    fontSize:     14.5,
    color:        Colors.inkMuted,
    textAlign:    'center',
    lineHeight:   21,
    marginBottom: 24,
  },
  cta: {
    minWidth: 180,
  },
});
