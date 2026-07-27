/**
 * @file app/fascicolo/[id]/camera.tsx
 * Versione stabile con flash funzionante (usa enableTorch)
 */

import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  ScrollView,
  Alert,
  Dimensions,
} from 'react-native';
import { CameraView, useCameraPermissions, CameraType } from 'expo-camera';
import Svg, { Path, Rect, Circle } from 'react-native-svg';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import { useFascicoliStore } from '@/store/fascicoli.store';

// ── Dimensioni anteprima: proporzionali allo schermo, sempre centrate ──
const SCREEN_W  = Dimensions.get('window').width;
const PREVIEW_W = SCREEN_W - 88;                       // lascia intravedere la foto successiva
const PREVIEW_H = Math.round(PREVIEW_W * 1.32);
const PREVIEW_GAP = 16;
const PREVIEW_SIDE_PAD = (SCREEN_W - PREVIEW_W) / 2;   // centra la prima e l'ultima foto

// ─────────────────────────────────────────────
// ICONE VETTORIALI (stile coerente con l'app)
// ─────────────────────────────────────────────

interface IconProps {
  size?: number;
  color?: string;
}

/** X di chiusura */
function IconChiudi({ size = 22, color = '#FFFFFF' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M6 6l12 12M18 6L6 18"
        stroke={color}
        strokeWidth={2.2}
        strokeLinecap="round"
      />
    </Svg>
  );
}

/** Fulmine — torcia */
function IconTorcia({ size = 22, color = '#FFFFFF' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M13 2.5 5.5 13.5h5L9.5 21.5 18.5 10h-5l-.5-7.5Z"
        stroke={color}
        strokeWidth={1.9}
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/** Frecce circolari — inverti fotocamera */
function IconInverti({ size = 22, color = '#FFFFFF' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M19.5 9.5A8 8 0 0 0 6 6.2M4.5 14.5A8 8 0 0 0 18 17.8"
        stroke={color}
        strokeWidth={1.9}
        strokeLinecap="round"
      />
      <Path
        d="M19.5 4.5v5h-5M4.5 19.5v-5h5"
        stroke={color}
        strokeWidth={1.9}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/** Immagine con montagne — galleria foto */
function IconGalleria({ size = 24, color = '#FFFFFF' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect
        x={3}
        y={5}
        width={18}
        height={14}
        rx={3}
        stroke={color}
        strokeWidth={1.9}
      />
      <Circle cx={8.6} cy={10} r={1.7} stroke={color} strokeWidth={1.7} />
      <Path
        d="M5 17.5 9.2 13a1.5 1.5 0 0 1 2.1 0l5.7 5"
        stroke={color}
        strokeWidth={1.9}
        strokeLinecap="round"
      />
      <Path
        d="m14.5 15.5 1.9-1.9a1.5 1.5 0 0 1 2.1 0l2.5 2.4"
        stroke={color}
        strokeWidth={1.9}
        strokeLinecap="round"
      />
    </Svg>
  );
}

export default function CameraScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const fascicoloId = Number(id);
  const cameraRef = useRef<CameraView>(null);

  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [libraryPermission, requestLibraryPermission] = ImagePicker.useMediaLibraryPermissions();

  const [facing, setFacing] = useState<CameraType>('back');
  const [torchEnabled, setTorchEnabled] = useState(false);   // ← Usiamo torch invece di flash
  const [selectedPhotos, setSelectedPhotos] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isCameraReady, setIsCameraReady] = useState(false);

  const aggiungiFotoFn = useFascicoliStore((s) => s.aggiungiFoto);

  // Richiedi permessi
  React.useEffect(() => {
    if (cameraPermission === null) requestCameraPermission();
  }, [cameraPermission]);

  // ─────────────────────────────────────────
  // FOTOCAMERA
  // ─────────────────────────────────────────
  const takePhoto = useCallback(async () => {
    if (!cameraRef.current || !isCameraReady) return;

    try {
      const result = await cameraRef.current.takePictureAsync({
        quality: 0.85,
        skipProcessing: true,
      });
      if (result?.uri) {
        setSelectedPhotos((prev) => [...prev, result.uri]);
      }
    } catch (error) {
      Toast.show({ type: 'error', text1: 'Errore durante lo scatto' });
    }
  }, [isCameraReady]);

  const flipCamera = () => setFacing((prev) => (prev === 'back' ? 'front' : 'back'));
  
  const toggleTorch = () => setTorchEnabled((prev) => !prev);   // ← Toggle torch

  // ─────────────────────────────────────────
  // MULTI-SELEZIONE LIBRERIA
  // ─────────────────────────────────────────
  const openLibrary = useCallback(async () => {
    if (!libraryPermission?.granted) {
      const { granted } = await requestLibraryPermission();
      if (!granted) {
        Alert.alert('Permesso negato', 'Concedi l’accesso alla libreria foto.');
        return;
      }
    }

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        quality: 0.85,
      });

      if (!result.canceled && result.assets?.length > 0) {
        const newUris = result.assets.map((asset) => asset.uri);
        setSelectedPhotos((prev) => [...prev, ...newUris]);
        Toast.show({ type: 'success', text1: `${newUris.length} foto selezionate` });
      }
    } catch (error) {
      Toast.show({ type: 'error', text1: 'Impossibile aprire la libreria' });
    }
  }, [libraryPermission]);

  // ─────────────────────────────────────────
  // SALVATAGGIO
  // ─────────────────────────────────────────
  const saveAllPhotos = useCallback(async () => {
    if (selectedPhotos.length === 0) return;

    setIsSaving(true);
    let savedCount = 0;

    try {
      for (const uri of selectedPhotos) {
        await aggiungiFotoFn(fascicoloId, uri);
        savedCount++;
      }

      Toast.show({
        type: 'success',
        text1: `${savedCount} foto salvate con successo`,
      });

      router.back();
    } catch (error) {
      Toast.show({ type: 'error', text1: 'Errore durante il salvataggio' });
    } finally {
      setIsSaving(false);
    }
  }, [selectedPhotos, fascicoloId, aggiungiFotoFn, router]);

  const removePhoto = (index: number) => {
    setSelectedPhotos((prev) => prev.filter((_, i) => i !== index));
  };

  const clearAll = () => setSelectedPhotos([]);

  // ─────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────
  if (!cameraPermission?.granted) {
    return (
      <View style={styles.center}>
        <Text style={styles.textWhite}>Accesso alla fotocamera necessario</Text>
        <TouchableOpacity onPress={requestCameraPermission} style={styles.btn}>
          <Text style={styles.btnText}>Abilita fotocamera</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {selectedPhotos.length === 0 ? (
        <CameraView
          ref={cameraRef}
          style={styles.camera}
          facing={facing}
          enableTorch={torchEnabled}           // ← Usa enableTorch invece di flash
          onCameraReady={() => setIsCameraReady(true)}
          ratio="16:9"
        />
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          snapToInterval={PREVIEW_W + PREVIEW_GAP}
          decelerationRate="fast"
          contentContainerStyle={styles.previewScrollContent}
          style={styles.previewScroll}
        >
          {selectedPhotos.map((uri, index) => (
            <View key={index} style={styles.previewItem}>
              <Image 
                source={{ uri }} 
                style={styles.previewImage} 
                resizeMode="contain"
              />
              <TouchableOpacity style={styles.removeBtn} onPress={() => removePhoto(index)}>
                <Text style={styles.removeText}>✕</Text>
              </TouchableOpacity>

              <View style={styles.photoNumber}>
                <Text style={styles.photoNumberText}>{index + 1}</Text>
              </View>
            </View>
          ))}
        </ScrollView>
      )}

      {/* Top Bar */}
      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconButton}>
          <IconChiudi />
        </TouchableOpacity>

        <View style={styles.topBarRight}>
          <TouchableOpacity
            onPress={toggleTorch}
            style={[styles.iconButton, torchEnabled && styles.iconButtonActive]}
          >
            <IconTorcia color={torchEnabled ? '#101828' : '#FFFFFF'} />
          </TouchableOpacity>

          <TouchableOpacity onPress={flipCamera} style={styles.iconButton}>
            <IconInverti />
          </TouchableOpacity>
        </View>
      </View>

      {/* Bottom Bar */}
      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 20 }]}>
        {selectedPhotos.length === 0 ? (
          <View style={styles.controlsRow}>
            <TouchableOpacity onPress={openLibrary} style={styles.sideButton}>
              <View style={styles.sideButtonCircle}>
                <IconGalleria />
              </View>
              <Text style={styles.sideButtonLabel} numberOfLines={1}>
                Galleria
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={takePhoto}
              style={[styles.shutterButton, !isCameraReady && styles.shutterDisabled]}
              disabled={!isCameraReady}
            >
              <View style={styles.shutterInner} />
            </TouchableOpacity>

            <View style={styles.sideButton} />
          </View>
        ) : (
          <View style={styles.previewActions}>
            {/* Azione primaria a tutta larghezza */}
            <TouchableOpacity
              onPress={saveAllPhotos}
              style={[styles.actionButton, styles.confermaButton]}
              disabled={isSaving}
            >
              {isSaving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.confermaText}>
                  Salva {selectedPhotos.length} {selectedPhotos.length === 1 ? 'foto' : 'foto'}
                </Text>
              )}
            </TouchableOpacity>

            {/* Azioni secondarie affiancate */}
            <View style={styles.secondaryRow}>
              <TouchableOpacity
                onPress={clearAll}
                style={[styles.actionButton, styles.secondaryButton]}
              >
                <Text style={styles.actionText}>Cancella tutto</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => router.back()}
                style={[styles.actionButton, styles.secondaryButton]}
              >
                <Text style={styles.actionText}>Annulla</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>
    </View>
  );
}

// STILI (invariati, solo per completezza)
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  camera: { flex: 1 },

  previewScroll: { flex: 1, backgroundColor: '#000' },
  previewScrollContent: {
    paddingHorizontal: PREVIEW_SIDE_PAD,
    alignItems: 'center',
    gap: PREVIEW_GAP,
  },
  previewItem: {
    width: PREVIEW_W,
    height: PREVIEW_H,
    backgroundColor: '#050C1C',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    overflow: 'hidden',
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewImage: { width: '100%', height: '100%' },

  removeBtn: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: 'rgba(217,45,32,0.95)',
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: 'center',
    alignItems: 'center',
  },
  removeText: { color: '#fff', fontSize: 17, fontWeight: '700' },

  photoNumber: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    backgroundColor: 'rgba(0,0,0,0.75)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  photoNumberText: { color: '#fff', fontSize: 15, fontWeight: '700' },

  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(16,24,40,0.55)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconButtonActive: {
    backgroundColor: '#FFFFFF',
    borderColor: '#FFFFFF',
  },
  topBarRight: {
    flexDirection: 'row',
    gap: 10,
  },

  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingTop: 18,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },

  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: 30,
  },
  sideButton: {
    // 72px non bastavano a "GALLERIA" in maiuscolo spaziato: con i caratteri
    // ingranditi dalle impostazioni di sistema l'ultima lettera andava a capo.
    // Lo spaziatore a destra usa lo stesso stile, quindi lo scatto resta centrato.
    width: 92,
    alignItems: 'center',
    gap: 6,
  },
  sideButtonCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(16,24,40,0.55)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sideButtonLabel: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },

  shutterButton: {
    width: 78,
    height: 78,
    borderRadius: 39,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 6,
    borderColor: 'rgba(255,255,255,0.7)',
  },
  shutterInner: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#fff',
    borderWidth: 3,
    borderColor: '#0F6B70',
  },
  shutterDisabled: { opacity: 0.5 },

  previewActions: {
    width: '100%',
    paddingHorizontal: 20,
    gap: 10,
  },
  secondaryRow: {
    flexDirection: 'row',
    gap: 10,
  },
  actionButton: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButton: {
    flex: 1,
  },
  confermaButton: {
    backgroundColor: '#0F6B70',
    borderColor: '#0F6B70',
  },
  actionText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  confermaText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  center: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  textWhite: { color: '#fff', fontSize: 18, textAlign: 'center' },
  btn: {
    backgroundColor: '#0F6B70',
    paddingHorizontal: 28,
    paddingVertical: 16,
    borderRadius: 12,
  },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});