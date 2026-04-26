/**
 * @file components/LoadingButton.tsx
 * Pulsante con stato di caricamento integrato.
 * Mostra uno spinner e si disabilita automaticamente durante
 * operazioni asincrone, prevenendo doppi tap.
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
    bg:         '#6366F1',
    bgDisabled: '#A5B4FC',
    text:       '#FFFFFF',
  },
  danger: {
    bg:         '#EF4444',
    bgDisabled: '#FCA5A5',
    text:       '#FFFFFF',
  },
  secondary: {
    bg:         '#F3F4F6',
    bgDisabled: '#F9FAFB',
    text:       '#374151',
    border:     '#D1D5DB',
  },
  ghost: {
    bg:         'transparent',
    bgDisabled: 'transparent',
    text:       '#6366F1',
    border:     '#E0E0FD',
  },
};

const SIZE_STYLES: Record<
  'sm' | 'md' | 'lg',
  { paddingV: number; paddingH: number; fontSize: number; radius: number }
> = {
  sm: { paddingV: 8,  paddingH: 14, fontSize: 13, radius: 8  },
  md: { paddingV: 12, paddingH: 20, fontSize: 15, radius: 10 },
  lg: { paddingV: 16, paddingH: 24, fontSize: 16, radius: 12 },
};

// ─────────────────────────────────────────────
// COMPONENTE
// ─────────────────────────────────────────────

/**
 * Pulsante con spinner di loading e gestione stato disabilitato.
 *
 * @example
 * <LoadingButton
 *   label="Invia al gestionale"
 *   loadingLabel="Invio in corso..."
 *   loading={loadingInvio}
 *   onPress={handleInvia}
 *   variant="primary"
 *   size="lg"
 * />
 */
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
  const isDisabled = disabled || loading;
  const variantStyle = VARIANT_STYLES[variant];
  const sizeStyle    = SIZE_STYLES[size];

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.8}
      style={[
        styles.button,
        {
          backgroundColor: isDisabled ? variantStyle.bgDisabled : variantStyle.bg,
          paddingVertical:   sizeStyle.paddingV,
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
          color={variant === 'secondary' || variant === 'ghost' ? '#6366F1' : '#FFFFFF'}
          style={styles.spinner}
        />
      )}
      <Text
        style={[
          styles.label,
          {
            color:    variantStyle.text,
            fontSize: sizeStyle.fontSize,
            opacity:  isDisabled && !loading ? 0.6 : 1,
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
    fontWeight: '600',
    textAlign:  'center',
  },
});
