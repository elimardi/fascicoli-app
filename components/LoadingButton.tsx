/**
 * @file components/LoadingButton.tsx
 * Pulsante con stato di caricamento integrato.
 * Varianti: primary (ottanio pieno), danger, secondary (bianco con
 * bordo), ghost (tinta accento).
 */

import React from 'react';
import {
  TouchableOpacity,
  Text,
  ActivityIndicator,
  StyleSheet,
  type ViewStyle,
  type TextStyle,
} from 'react-native';
import { Colors, Radius } from '@/constants/theme';

// ─────────────────────────────────────────────
// TIPI
// ─────────────────────────────────────────────

type ButtonVariant = 'primary' | 'danger' | 'secondary' | 'ghost';

interface LoadingButtonProps {
  /** Testo del pulsante */
  label: string;
  /** Testo mostrato durante il loading (default: label) */
  loadingLabel?: string;
  /** Callback onPress */
  onPress: () => void;
  /** Mostra spinner e disabilita il pulsante */
  loading?: boolean;
  /** Disabilita il pulsante (indipendente da loading) */
  disabled?: boolean;
  /** Variante visiva */
  variant?: ButtonVariant;
  /** Stile aggiuntivo per il container */
  style?: ViewStyle;
  /** Stile aggiuntivo per il testo */
  textStyle?: TextStyle;
  /** Dimensione del pulsante: 'sm' | 'md' | 'lg' */
  size?: 'sm' | 'md' | 'lg';
}

// ─────────────────────────────────────────────
// CONFIGURAZIONE VARIANTI
// ─────────────────────────────────────────────

const VARIANT_STYLES: Record<
  ButtonVariant,
  { bg: string; bgDisabled: string; text: string; border?: string }
> = {
  primary: {
    bg:         Colors.primary,
    bgDisabled: Colors.primaryMuted,
    text:       '#FFFFFF',
  },
  danger: {
    bg:         '#D92D20',
    bgDisabled: '#FDA29B',
    text:       '#FFFFFF',
  },
  secondary: {
    bg:         Colors.surface,
    bgDisabled: Colors.surfaceSunken,
    text:       Colors.inkSoft,
    border:     Colors.hairlineStrong,
  },
  ghost: {
    bg:         Colors.primaryTint,
    bgDisabled: Colors.surfaceSunken,
    text:       Colors.primary,
    border:     Colors.primaryBorder,
  },
};

const SIZE_STYLES: Record<
  'sm' | 'md' | 'lg',
  { height: number; paddingH: number; fontSize: number; radius: number }
> = {
  sm: { height: 36, paddingH: 14, fontSize: 13, radius: Radius.sm },
  md: { height: 46, paddingH: 20, fontSize: 15, radius: Radius.md },
  lg: { height: 52, paddingH: 24, fontSize: 16, radius: Radius.md },
};

// ─────────────────────────────────────────────
// COMPONENTE
// ─────────────────────────────────────────────

export function LoadingButton({
  label,
  loadingLabel,
  onPress,
  loading  = false,
  disabled = false,
  variant  = 'primary',
  style,
  textStyle,
  size = 'md',
}: LoadingButtonProps) {
  const isDisabled   = disabled || loading;
  const variantStyle = VARIANT_STYLES[variant];
  const sizeStyle    = SIZE_STYLES[size];

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.75}
      style={[
        styles.button,
        {
          backgroundColor:   isDisabled ? variantStyle.bgDisabled : variantStyle.bg,
          height:            sizeStyle.height,
          paddingHorizontal: sizeStyle.paddingH,
          borderRadius:      sizeStyle.radius,
          borderWidth:       variantStyle.border ? 1 : 0,
          borderColor:       variantStyle.border,
        },
        style,
      ]}
    >
      {loading && (
        <ActivityIndicator
          size="small"
          color={
            variant === 'secondary' || variant === 'ghost'
              ? Colors.primary
              : '#FFFFFF'
          }
          style={styles.spinner}
        />
      )}
      <Text
        style={[
          styles.label,
          {
            color:    variantStyle.text,
            fontSize: sizeStyle.fontSize,
            opacity:  isDisabled && !loading ? 0.55 : 1,
          },
          textStyle,
        ]}
      >
        {loading && loadingLabel ? loadingLabel : label}
      </Text>
    </TouchableOpacity>
  );
}

// ─────────────────────────────────────────────
// STILI
// ─────────────────────────────────────────────

const styles = StyleSheet.create({
  button: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'center',
  },
  spinner: {
    marginRight: 8,
  },
  label: {
    fontWeight:    '700',
    letterSpacing: 0.2,
    textAlign:     'center',
  },
});
