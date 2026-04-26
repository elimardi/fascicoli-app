/**
 * @file components/EmptyState.tsx
 * Componente per stati vuoti nelle schermate lista.
 * Mostra icona, titolo, sottotitolo e un CTA opzionale.
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LoadingButton } from './LoadingButton';

// ─────────────────────────────────────────────
// TIPI
// ─────────────────────────────────────────────

interface EmptyStateProps {
  /** Emoji o carattere usato come icona decorativa */
  icon: string;
  title: string;
  subtitle?: string;
  /** Testo del pulsante CTA (opzionale) */
  ctaLabel?: string;
  onCta?: () => void;
}

// ─────────────────────────────────────────────
// COMPONENTE
// ─────────────────────────────────────────────

/**
 * Stato vuoto generico con icona, testi e CTA opzionale.
 *
 * @example
 * <EmptyState
 *   icon="🗂️"
 *   title="Nessun fascicolo"
 *   subtitle="Crea il tuo primo fascicolo fotografico"
 *   ctaLabel="Crea fascicolo"
 *   onCta={() => router.push('/fascicolo/new')}
 * />
 */
export function EmptyState({
  icon,
  title,
  subtitle,
  ctaLabel,
  onCta,
}: EmptyStateProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.icon}>{icon}</Text>
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
  icon: {
    fontSize:     56,
    marginBottom: 16,
  },
  title: {
    fontSize:     20,
    fontWeight:   '600',
    color:        '#111827',
    textAlign:    'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize:   15,
    color:      '#6B7280',
    textAlign:  'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  cta: {
    minWidth: 180,
  },
});
