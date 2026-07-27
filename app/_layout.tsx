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
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import Toast, { type BaseToastProps } from 'react-native-toast-message';
import { useDatabase } from '@/hooks/useDatabase';
import { Colors, Radius } from '@/constants/theme';

// ─────────────────────────────────────────────
// TOAST CONFIG
// ─────────────────────────────────────────────

/**
 * Configurazione personalizzata dei toast per react-native-toast-message.
 * Tre tipi: success (verde), error (rosso), info (indigo).
 */
function ToastBase({
  text1,
  text2,
  spineColor,
}: BaseToastProps & { spineColor: string }) {
  return (
    <View style={toastStyles.toast}>
      <View style={[toastStyles.spine, { backgroundColor: spineColor }]} />
      <View style={toastStyles.textContainer}>
        {text1 ? <Text style={toastStyles.title}>{text1}</Text> : null}
        {text2 ? <Text style={toastStyles.subtitle}>{text2}</Text> : null}
      </View>
    </View>
  );
}

const toastConfig = {
  success: (props: BaseToastProps) => (
    <ToastBase {...props} spineColor={Colors.success} />
  ),
  error: (props: BaseToastProps) => (
    <ToastBase {...props} spineColor={Colors.danger} />
  ),
  info: (props: BaseToastProps) => (
    <ToastBase {...props} spineColor={Colors.primary} />
  ),
};

// ─────────────────────────────────────────────
// SCHERMATE DI STATO
// ─────────────────────────────────────────────

function LoadingScreen() {
  return (
    <View style={splashStyles.container}>
      <ActivityIndicator size="large" color={Colors.brandCyan} />
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
              headerStyle:      { backgroundColor: Colors.brandNavy },
              headerTintColor:  '#FFFFFF',
              headerTitleStyle: {
                fontWeight: '700',
                fontSize:   17,
                color:      '#FFFFFF',
              },
              headerShadowVisible: false,
              contentStyle:     { backgroundColor: Colors.bg },
            }}
          >
            <Stack.Screen name="(tabs)"  options={{ headerShown: false }} />
            <Stack.Screen
              name="fascicolo/new"
              options={{
                title:         'Nuovo fascicolo',
                presentation:  'modal',
                headerStyle:   { backgroundColor: Colors.brandNavy },
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
        <StatusBar style="light" />
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
    // Stesso navy dello splash: nessuno stacco bianco all'avvio
    backgroundColor: Colors.brandNavy,
    padding:         32,
  },
  text: {
    marginTop: 16,
    fontSize:  16,
    color:     Colors.brandSilver,
  },
  errorIcon: {
    fontSize:     48,
    marginBottom: 12,
  },
  errorTitle: {
    fontSize:     20,
    fontWeight:   '700',
    color:        '#FFFFFF',
    marginBottom: 8,
  },
  errorMessage: {
    fontSize:     14,
    color:        Colors.brandSilver,
    textAlign:    'center',
    lineHeight:   20,
    marginBottom: 24,
  },
  retryButton: {
    backgroundColor:   Colors.primary,
    paddingHorizontal: 24,
    paddingVertical:   12,
    borderRadius:      Radius.md,
  },
  retryText: {
    color:      '#FFFFFF',
    fontWeight: '600',
    fontSize:   15,
  },
});

const toastStyles = StyleSheet.create({
  toast: {
    flexDirection:    'row',
    alignItems:       'stretch',
    marginHorizontal: 16,
    borderRadius:     Radius.md,
    borderWidth:      1,
    borderColor:      Colors.hairline,
    backgroundColor:  Colors.surface,
    overflow:         'hidden',
    shadowColor:      '#101828',
    shadowOffset:     { width: 0, height: 4 },
    shadowOpacity:    0.10,
    shadowRadius:     12,
    elevation:        5,
  },
  spine: {
    width: 4,
  },
  textContainer: {
    flex:              1,
    paddingHorizontal: 14,
    paddingVertical:   12,
  },
  title: {
    fontSize:   14,
    fontWeight: '700',
    color:      Colors.ink,
  },
  subtitle: {
    fontSize:  12.5,
    color:     Colors.inkMuted,
    marginTop: 2,
  },
});
