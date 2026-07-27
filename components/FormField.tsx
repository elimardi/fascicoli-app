/**
 * @file components/FormField.tsx
 * Campo di input riusabile con etichetta in maiuscoletto, stato di
 * focus evidenziato (bordo accento), errore e testo di aiuto.
 */

import React, { useState, forwardRef } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import { Colors, Radius, overline } from '@/constants/theme';

// ─────────────────────────────────────────────
// TIPI
// ─────────────────────────────────────────────

interface FormFieldProps extends TextInputProps {
  /** Etichetta sopra il campo */
  label: string;
  /** Messaggio di errore sotto il campo (rosso) */
  error?: string;
  /** Testo helper sotto il campo (grigio) */
  helper?: string;
  /** Campo obbligatorio — mostra asterisco */
  required?: boolean;
  /** Stile aggiuntivo per il container esterno */
  containerStyle?: ViewStyle;
}

// ─────────────────────────────────────────────
// COMPONENTE
// ─────────────────────────────────────────────

export const FormField = forwardRef<TextInput, FormFieldProps>(function FormField(
  {
    label,
    error,
    helper,
    required,
    containerStyle,
    style,
    onFocus,
    onBlur,
    ...textInputProps
  },
  ref
) {
  const hasError = Boolean(error);
  const [isFocused, setIsFocused] = useState(false);

  return (
    <View style={[styles.container, containerStyle]}>
      {/* Label */}
      <View style={styles.labelRow}>
        <Text style={styles.label}>{label}</Text>
        {required && <Text style={styles.asterisco}> *</Text>}
      </View>

      {/* Input */}
      <TextInput
        ref={ref}
        style={[
          styles.input,
          isFocused && styles.inputFocused,
          hasError && styles.inputError,
          textInputProps.multiline && styles.inputMultiline,
          style,
        ]}
        placeholderTextColor={Colors.inkFaint}
        onFocus={(e) => {
          setIsFocused(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setIsFocused(false);
          onBlur?.(e);
        }}
        {...textInputProps}
      />

      {/* Errore o helper */}
      {hasError ? (
        <Text style={styles.errorText}>{error}</Text>
      ) : helper ? (
        <Text style={styles.helperText}>{helper}</Text>
      ) : null}
    </View>
  );
});

// ─────────────────────────────────────────────
// STILI
// ─────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems:    'center',
    marginBottom:  7,
  },
  label: {
    ...overline,
    fontSize:      10.5,
    letterSpacing: 0.9,
  },
  asterisco: {
    fontSize:   12,
    color:      Colors.danger,
    fontWeight: '700',
  },
  input: {
    backgroundColor:   Colors.surface,
    borderWidth:       1.5,
    borderColor:       Colors.hairlineStrong,
    borderRadius:      Radius.md,
    paddingHorizontal: 14,
    paddingVertical:   12,
    fontSize:          15,
    color:             Colors.ink,
  },
  inputFocused: {
    borderColor: Colors.primary,
  },
  inputError: {
    borderColor:     Colors.danger,
    backgroundColor: Colors.dangerTint,
  },
  inputMultiline: {
    minHeight:         100,
    textAlignVertical: 'top',
    paddingTop:        12,
  },
  errorText: {
    marginTop:  6,
    fontSize:   12,
    color:      Colors.dangerText,
    fontWeight: '600',
  },
  helperText: {
    marginTop:  6,
    fontSize:   12,
    color:      Colors.inkFaint,
    lineHeight: 16,
  },
});
