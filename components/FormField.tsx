/**
 * @file components/FormField.tsx
 * Campo form riusabile con label, TextInput, messaggio di errore
 * e testo helper. Supporta tutte le varianti TextInput di React Native.
 */

import React from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';

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
  /** Campo obbligatorio — mostra asterisco rosso */
  required?: boolean;
  /** Stile aggiuntivo per il container esterno */
  containerStyle?: ViewStyle;
}

// ─────────────────────────────────────────────
// COMPONENTE
// ─────────────────────────────────────────────

/**
 * Campo form con label, TextInput, gestione errori e testo helper.
 * Eredita tutte le props di TextInput per massima flessibilità.
 *
 * @example
 * <FormField
 *   label="URL base"
 *   required
 *   value={formValues.base_url}
 *   onChangeText={(v) => setField('base_url', v)}
 *   error={fieldErrors.base_url}
 *   helper="Es. https://gestionale.esempio.com/api"
 *   keyboardType="url"
 *   autoCapitalize="none"
 * />
 */
export function FormField({
  label,
  error,
  helper,
  required,
  containerStyle,
  style,
  ...textInputProps
}: FormFieldProps) {
  const hasError = Boolean(error);

  return (
    <View style={[styles.container, containerStyle]}>
      {/* Label */}
      <View style={styles.labelRow}>
        <Text style={styles.label}>{label}</Text>
        {required && <Text style={styles.asterisco}> *</Text>}
      </View>

      {/* Input */}
      <TextInput
        style={[
          styles.input,
          hasError && styles.inputError,
          textInputProps.multiline && styles.inputMultiline,
          style,
        ]}
        placeholderTextColor="#9CA3AF"
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
}

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
    marginBottom:  6,
  },
  label: {
    fontSize:   14,
    fontWeight: '500',
    color:      '#374151',
  },
  asterisco: {
    fontSize: 14,
    color:    '#EF4444',
    fontWeight: '600',
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderWidth:     1,
    borderColor:     '#D1D5DB',
    borderRadius:    10,
    paddingHorizontal: 14,
    paddingVertical:   11,
    fontSize:        15,
    color:           '#111827',
  },
  inputError: {
    borderColor:     '#EF4444',
    backgroundColor: '#FFF5F5',
  },
  inputMultiline: {
    minHeight:  100,
    textAlignVertical: 'top',
    paddingTop: 12,
  },
  errorText: {
    marginTop: 5,
    fontSize:  12,
    color:     '#EF4444',
    fontWeight: '500',
  },
  helperText: {
    marginTop: 5,
    fontSize:  12,
    color:     '#9CA3AF',
    lineHeight: 16,
  },
});
