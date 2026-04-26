/**
 * @file app/_layout.tsx
 * Root layout dell'applicazione Expo Router.
 * Responsabile di:
 * - Inizializzazione del database SQLite (useDatabase)
 * - Configurazione di react-native-toast-message
 * - GestureHandlerRootView (richiesto da react-native-gesture-handler)
 * - Splash screen durante il caricamento iniziale
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { Stack } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import Toast, { type BaseToastProps } from 'react-native-toast-message';
import { useDatabase } from '@/hooks/useDatabase';

// ─────────────────────────────────────────────
// TOAST CONFIG
// ─────────────────────────────────────────────

/**
 * Configurazione personalizzata dei toast per react-native-toast-message.
 * Tre tipi: success (verde), error (rosso), info (indigo).
 */
const toastConfig = {
  success: ({ text1, text2 }: BaseToastProps) => (
    <View style={[toastStyles.toast, toastStyles.success]}>
      <View style={toastStyles.dot} />
      <View style={toastStyles.textContainer}>
        {text1 ? <Text style={toastStyles.title}>{text1}</Text> : null}
        {text2 ? <Text style={toastStyles.subtitle}>{text2}</Text> : null}
      </View>
    </View>
  ),
  error: ({ text1, text2 }: BaseToastProps) => (
    <View style={[toastStyles.toast, toastStyles.error]}>
      <View style={[toastStyles.dot, toastStyles.dotError]} />
      <View style={toastStyles.textContainer}>
        {text1 ? <Text style={toastStyles.title}>{text1}</Text> : null}
        {text2 ? <Text style={toastStyles.subtitle}>{text2}</Text> : null}
      </View>
    </View>
  ),
  info: ({ text1, text2 }: BaseToastProps) => (
    <View style={[toastStyles.toast, toastStyles.info]}>
      <View style={[toastStyles.dot, toastStyles.dotInfo]} />
      <View style={toastStyles.textContainer}>
        {text1 ? <Text style={toastStyles.title}>{text1}</Text> : null}
        {text2 ? <Text style={toastStyles.subtitle}>{text2}</Text> : null}
      </View>
    </View>
  ),
};

// ─────────────────────────────────────────────
// SCHERMATE DI STATO
// ─────────────────────────────────────────────

function LoadingScreen() {
  return (
    <View style={splashStyles.container}>
      <ActivityIndicator size="large" color="#6366F1" />
      <Text style={splashStyles.text}>Caricamento...</Text>
    </View>
  );
}

interface ErrorScreenProps {
  message: string;
  onRetry: () => void;
}

function ErrorScreen({ message, onRetry }: ErrorScreenProps) {
  return (
    <View style={splashStyles.container}>
      <Text style={splashStyles.errorIcon}>⚠️</Text>
      <Text style={splashStyles.errorTitle}>Errore di avvio</Text>
      <Text style={splashStyles.errorMessage}>{message}</Text>
      <TouchableOpacity style={splashStyles.retryButton} onPress={onRetry}>
        <Text style={splashStyles.retryText}>Riprova</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─────────────────────────────────────────────
// ROOT LAYOUT
// ─────────────────────────────────────────────

/**
 * Root layout — wrappa l'intera app con i provider necessari
 * e gestisce il ciclo di vita del database.
 */
export default function RootLayout() {
  const { isReady, error, retry } = useDatabase();

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        {!isReady && !error && <LoadingScreen />}
        {error && <ErrorScreen message={error} onRetry={retry} />}
        {isReady && (
          <Stack
            screenOptions={{
              headerStyle:      { backgroundColor: '#FFFFFF' },
              headerTintColor:  '#111827',
              headerTitleStyle: { fontWeight: '600', fontSize: 17 },
              headerShadowVisible: false,
              contentStyle:     { backgroundColor: '#F9FAFB' },
            }}
          >
            <Stack.Screen name="(tabs)"  options={{ headerShown: false }} />
            <Stack.Screen
              name="fascicolo/new"
              options={{
                title:         'Nuovo fascicolo',
                presentation:  'modal',
                headerStyle:   { backgroundColor: '#FFFFFF' },
              }}
            />
            <Stack.Screen
              name="fascicolo/[id]/index"
              options={{ title: 'Fascicolo' }}
            />
            <Stack.Screen
              name="fascicolo/[id]/camera"
              options={{
                title:         'Fotocamera',
                presentation:  'fullScreenModal',
                headerStyle:   { backgroundColor: '#000000' },
                headerTintColor: '#FFFFFF',
              }}
            />
          </Stack>
        )}
        <Toast config={toastConfig} topOffset={56} />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

// ─────────────────────────────────────────────
// STILI
// ─────────────────────────────────────────────

const splashStyles = StyleSheet.create({
  container: {
    flex:            1,
    alignItems:      'center',
    justifyContent:  'center',
    backgroundColor: '#F9FAFB',
    padding:         32,
  },
  text: {
    marginTop: 16,
    fontSize:  16,
    color:     '#6B7280',
  },
  errorIcon: {
    fontSize:     48,
    marginBottom: 12,
  },
  errorTitle: {
    fontSize:     20,
    fontWeight:   '600',
    color:        '#111827',
    marginBottom: 8,
  },
  errorMessage: {
    fontSize:   14,
    color:      '#6B7280',
    textAlign:  'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  retryButton: {
    backgroundColor: '#6366F1',
    paddingHorizontal: 24,
    paddingVertical:   12,
    borderRadius:      10,
  },
  retryText: {
    color:      '#FFFFFF',
    fontWeight: '600',
    fontSize:   15,
  },
});

const toastStyles = StyleSheet.create({
  toast: {
    flexDirection:     'row',
    alignItems:        'center',
    marginHorizontal:  16,
    paddingHorizontal: 16,
    paddingVertical:   12,
    borderRadius:      12,
    borderWidth:       1,
    borderColor:       '#E5E7EB',
    backgroundColor:   '#FFFFFF',
    shadowColor:       '#000',
    shadowOffset:      { width: 0, height: 2 },
    shadowOpacity:     0.08,
    shadowRadius:      8,
    elevation:         4,
    gap:               12,
  },
  success: {
    borderColor: '#D1FAE5',
    backgroundColor: '#F0FDF4',
  },
  error: {
    borderColor: '#FEE2E2',
    backgroundColor: '#FFF5F5',
  },
  info: {
    borderColor: '#E0E7FF',
    backgroundColor: '#EEF2FF',
  },
  dot: {
    width:        8,
    height:       8,
    borderRadius: 4,
    backgroundColor: '#10B981',
  },
  dotError: {
    backgroundColor: '#EF4444',
  },
  dotInfo: {
    backgroundColor: '#6366F1',
  },
  textContainer: {
    flex: 1,
  },
  title: {
    fontSize:   14,
    fontWeight: '600',
    color:      '#111827',
  },
  subtitle: {
    fontSize:  12,
    color:     '#6B7280',
    marginTop: 2,
  },
});
