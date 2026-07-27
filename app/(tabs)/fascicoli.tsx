/**
 * @file app/(tabs)/fascicoli.tsx
 * Schermata principale — lista di tutti i fascicoli fotografici.
 * Features:
 * - FlatList con FascicoloCard e swipe-to-delete
 * - Pull-to-refresh
 * - FAB (+) per creare un nuovo fascicolo
 * - EmptyState quando non ci sono fascicoli
 * - Toast di feedback per operazioni completate
 */

import React, { useCallback, useEffect } from 'react';
import {
  View,
  FlatList,
  Text,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import { useFascicoliStore } from '@/store/fascicoli.store';
import { FascicoloCard, EmptyState } from '@/components';
import { IconCartella } from '@/components/EmptyState';
import { TOAST_MESSAGES } from '@/constants';
import { Colors, Radius, overline, raisedShadow } from '@/constants/theme';
import type { FascicoloConFoto } from '@/services/fascicoli.service';

// ─────────────────────────────────────────────
// COMPONENTE
// ─────────────────────────────────────────────

export default function FascicoliScreen() {
  const router  = useRouter();
  const insets  = useSafeAreaInsets();

  // ── Store ──
  const fascicoli     = useFascicoliStore((s) => s.fascicoli);
  const loadingLista  = useFascicoliStore((s) => s.loadingLista);
  const erroreLista   = useFascicoliStore((s) => s.erroreLista);
  const caricaFascicoli  = useFascicoliStore((s) => s.caricaFascicoli);
  const eliminaFascicoloFn = useFascicoliStore((s) => s.eliminaFascicolo);

  const isLoading    = loadingLista === 'loading';
  const isRefreshing = isLoading && fascicoli.length > 0;

  // ── Caricamento iniziale (se non già caricato dallo useDatabase) ──
  useEffect(() => {
    if (fascicoli.length === 0 && loadingLista === 'idle') {
      caricaFascicoli().catch(console.error);
    }
  }, []);

  // ─────────────────────────────────────────
  // HANDLERS
  // ─────────────────────────────────────────

  /** Pull-to-refresh */
  const handleRefresh = useCallback(async () => {
    await caricaFascicoli();
  }, [caricaFascicoli]);

  /** Naviga al dettaglio fascicolo */
  const handlePress = useCallback(
    (id: number) => {
      router.push(`/fascicolo/${id}`);
    },
    [router]
  );

  /** Elimina fascicolo con feedback toast */
  const handleDelete = useCallback(
    async (id: number) => {
      try {
        await eliminaFascicoloFn(id);
        Toast.show({
          type:  'success',
          text1: TOAST_MESSAGES.FASCICOLO_ELIMINATO,
        });
      } catch (error) {
        Toast.show({
          type:  'error',
          text1: 'Errore eliminazione',
          text2: error instanceof Error ? error.message : TOAST_MESSAGES.ERRORE_GENERICO,
        });
      }
    },
    [eliminaFascicoloFn]
  );

  /** Naviga alla schermata di creazione */
  const handleNuovoFascicolo = useCallback(() => {
    router.push('/fascicolo/new');
  }, [router]);

  // ─────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────

  const renderItem = useCallback(
    ({ item }: { item: FascicoloConFoto }) => (
      <FascicoloCard
        fascicolo={item}
        numeroFoto={item.numero_foto}
        onPress={() => handlePress(item.id)}
        onDelete={() => handleDelete(item.id)}
      />
    ),
    [handlePress, handleDelete]
  );

  const keyExtractor = useCallback(
    (item: FascicoloConFoto) => String(item.id),
    []
  );

  // ── Schermata di errore ──
  if (erroreLista && fascicoli.length === 0) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>{erroreLista}</Text>
        <TouchableOpacity
          style={styles.retryButton}
          onPress={caricaFascicoli}
        >
          <Text style={styles.retryText}>Riprova</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ── Loading iniziale (lista vuota + caricamento) ──
  if (isLoading && fascicoli.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={fascicoli}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        contentContainerStyle={[
          styles.lista,
          fascicoli.length === 0 && styles.listaVuota,
          { paddingBottom: insets.bottom + 88 }, // spazio per FAB
        ]}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={Colors.primary}
            colors={[Colors.primary]}
          />
        }
        ListEmptyComponent={
          <EmptyState
            iconNode={<IconCartella />}
            title="Nessun fascicolo"
            subtitle="Crea il tuo primo fascicolo fotografico per iniziare a raccogliere le foto."
            ctaLabel="Crea fascicolo"
            onCta={handleNuovoFascicolo}
          />
        }
        ListHeaderComponent={
          fascicoli.length > 0 ? (
            <View style={styles.header}>
              <Text style={styles.headerCount}>
                Archivio  ·  {fascicoli.length}{' '}
                {fascicoli.length === 1 ? 'fascicolo' : 'fascicoli'}
              </Text>
            </View>
          ) : null
        }
        showsVerticalScrollIndicator={false}
        removeClippedSubviews
        maxToRenderPerBatch={10}
        windowSize={10}
      />

      {/* FAB — pulsante nuovo fascicolo */}
      <TouchableOpacity
        style={[styles.fab, { bottom: insets.bottom + 16 }]}
        onPress={handleNuovoFascicolo}
        activeOpacity={0.85}
      >
        <Text style={styles.fabIcon}>+</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─────────────────────────────────────────────
// STILI
// ─────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex:            1,
    backgroundColor: Colors.bg,
  },
  lista: {
    paddingTop: 6,
  },
  listaVuota: {
    flex:            1,
    justifyContent:  'center',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop:        10,
    paddingBottom:     6,
  },
  headerCount: {
    ...overline,
  },
  loadingContainer: {
    flex:           1,
    alignItems:     'center',
    justifyContent: 'center',
  },
  errorContainer: {
    flex:              1,
    alignItems:        'center',
    justifyContent:    'center',
    paddingHorizontal: 32,
    gap:               16,
  },
  errorText: {
    fontSize:  15,
    color:     Colors.inkMuted,
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor:   Colors.primary,
    paddingHorizontal: 20,
    paddingVertical:   10,
    borderRadius:      Radius.sm,
  },
  retryText: {
    color:      '#FFFFFF',
    fontWeight: '600',
  },
  fab: {
    position:        'absolute',
    right:           20,
    width:           56,
    height:          56,
    borderRadius:    18,
    backgroundColor: Colors.primary,
    alignItems:      'center',
    justifyContent:  'center',
    ...raisedShadow,
  },
  fabIcon: {
    fontSize:   30,
    color:      '#FFFFFF',
    fontWeight: '300',
    lineHeight: 34,
  },
});
