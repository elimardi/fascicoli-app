/**
 * @file app/fascicolo/[id]/camera.tsx
 * Schermata fotocamera in-app — si apre come fullScreenModal.
 * Features:
 * - Preview camera live con expo-camera
 * - Pulsante scatto centrale
 * - Pulsante libreria (image picker) in basso a sinistra
 * - Flip camera (frontale/posteriore)
 * - Preview post-scatto con conferma / riprova / annulla
 * - Salvataggio foto nel fascicolo tramite useFascicolo
 * - Gestione permessi con fallback UI
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Dimensions,
  Platform,
} from 'react-native';
import { Camera, CameraType, FlashMode } from 'expo-camera';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import { useCamera, type FotoScattata } from '@/hooks/useCamera';
import { useFascicoliStore } from '@/store/fascicoli.store';
import { TOAST_MESSAGES } from '@/constants';

// ─────────────────────────────────────────────
// COSTANTI
// ─────────────────────────────────────────────

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

// ─────────────────────────────────────────────
// SOTTO-COMPONENTI
// ─────────────────────────────────────────────

/**
 * Schermata mostrata quando il permesso camera è negato.
 */
function PermessoNegato({
  onRichiedi,
  onChiudi,
}: {
  onRichiedi: () => void;
  onChiudi:   () => void;
}) {
  return (
    <View style={permStyles.container}>
      <Text style={permStyles.icon}>📷</Text>
      <Text style={permStyles.titolo}>Accesso fotocamera negato</Text>
      <Text style={permStyles.sottotitolo}>
        Per scattare foto è necessario consentire l'accesso alla fotocamera
        nelle impostazioni del dispositivo.
      </Text>
      <TouchableOpacity style={permStyles.btnPrimary} onPress={onRichiedi}>
        <Text style={permStyles.btnPrimaryText}>Richiedi permesso</Text>
      </TouchableOpacity>
      <TouchableOpacity style={permStyles.btnSecondary} onPress={onChiudi}>
        <Text style={permStyles.btnSecondaryText}>Chiudi</Text>
      </TouchableOpacity>
    </View>
  );
}

/**
 * Overlay di preview post-scatto con pulsanti Conferma / Riprova / Annulla.
 */
function PreviewOverlay({
  foto,
  isSaving,
  onConferma,
  onRiprova,
  onAnnulla,
}: {
  foto:       FotoScattata;
  isSaving:   boolean;
  onConferma: () => void;
  onRiprova:  () => void;
  onAnnulla:  () => void;
}) {
  const insets = useSafeAreaInsets();

  return (
    <View style={StyleSheet.absoluteFillObject}>
      {/* Immagine preview a pieno schermo */}
      <Image
        source={{ uri: foto.uri }}
        style={styles.previewImage}
        resizeMode="cover"
      />

      {/* Overlay scuro semi-trasparente in basso */}
      <View style={[previewStyles.bar, { paddingBottom: insets.bottom + 16 }]}>
        {isSaving ? (
          <View style={previewStyles.savingRow}>
            <ActivityIndicator size="small" color="#FFFFFF" />
            <Text style={previewStyles.savingText}>Salvataggio foto...</Text>
          </View>
        ) : (
          <View style={previewStyles.azioniRow}>
            {/* Riprova */}
            <TouchableOpacity
              style={previewStyles.btnSecondario}
              onPress={onRiprova}
              activeOpacity={0.8}
            >
              <Text style={previewStyles.btnSecondarioText}>Riprova</Text>
            </TouchableOpacity>

            {/* Conferma */}
            <TouchableOpacity
              style={previewStyles.btnConferma}
              onPress={onConferma}
              activeOpacity={0.85}
            >
              <Text style={previewStyles.btnConfermaText}>Usa foto</Text>
            </TouchableOpacity>

            {/* Annulla */}
            <TouchableOpacity
              style={previewStyles.btnSecondario}
              onPress={onAnnulla}
              activeOpacity={0.8}
            >
              <Text style={previewStyles.btnSecondarioText}>Annulla</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
}

// ─────────────────────────────────────────────
// SCHERMATA PRINCIPALE
// ─────────────────────────────────────────────

export default function CameraScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router  = useRouter();
  const insets  = useSafeAreaInsets();

  const fascicoloId    = Number(id);
  const cameraRef      = useRef<Camera>(null);

  // ── Stato locale ──
  const [cameraType,   setCameraType]   = useState<CameraType>(CameraType.back);
  const [flashMode,    setFlashMode]    = useState<FlashMode>(FlashMode.off);
  const [fotoPreview,  setFotoPreview]  = useState<FotoScattata | null>(null);
  const [isSaving,     setIsSaving]     = useState(false);
  const [cameraReady,  setCameraReady]  = useState(false);

  // ── Hook fotocamera ──
  const {
    hasPermission,
    requestPermission,
    apriLibreria,
    scattaFoto,
    isProcessing,
  } = useCamera();

  // ── Store ──
  const aggiungiFotoFn = useFascicoliStore((s) => s.aggiungiFoto);

  // ── Richiedi permesso al mount ──
  useEffect(() => {
    if (hasPermission === null) {
      requestPermission();
    }
  }, [hasPermission, requestPermission]);

  // ─────────────────────────────────────────
  // HANDLERS — CAMERA
  // ─────────────────────────────────────────

  const handleFlipCamera = useCallback(() => {
    setCameraType((prev) =>
      prev === CameraType.back ? CameraType.front : CameraType.back
    );
  }, []);

  const handleToggleFlash = useCallback(() => {
    setFlashMode((prev) =>
      prev === FlashMode.off ? FlashMode.on : FlashMode.off
    );
  }, []);

  const handleScatta = useCallback(async () => {
    if (!cameraReady || isProcessing) return;
    const foto = await scattaFoto(cameraRef);
    if (foto) {
      setFotoPreview(foto);
    }
  }, [cameraReady, isProcessing, scattaFoto]);

  const handleApriLibreria = useCallback(async () => {
    const foto = await apriLibreria();
    if (foto) {
      setFotoPreview(foto);
    }
  }, [apriLibreria]);

  // ─────────────────────────────────────────
  // HANDLERS — PREVIEW
  // ─────────────────────────────────────────

  /**
   * Conferma la foto: la copia nella directory permanente
   * e la registra nel DB tramite lo store.
   */
  const handleConferma = useCallback(async () => {
    if (!fotoPreview) return;

    setIsSaving(true);
    try {
      await aggiungiFotoFn(
        fascicoloId,
        fotoPreview.uri,
        fotoPreview.dataScatto
      );

      Toast.show({
        type:  'success',
        text1: TOAST_MESSAGES.FOTO_AGGIUNTA,
      });

      // Torna alla camera per scattare un'altra foto
      setFotoPreview(null);
    } catch (error) {
      Toast.show({
        type:  'error',
        text1: 'Errore salvataggio foto',
        text2: error instanceof Error ? error.message : TOAST_MESSAGES.ERRORE_GENERICO,
      });
    } finally {
      setIsSaving(false);
    }
  }, [fotoPreview, fascicoloId, aggiungiFotoFn]);

  /** Scarta la foto e torna alla camera live. */
  const handleRiprova = useCallback(() => {
    setFotoPreview(null);
  }, []);

  /** Chiude la schermata fotocamera e torna al dettaglio. */
  const handleChiudi = useCallback(() => {
    router.back();
  }, [router]);

  // ─────────────────────────────────────────
  // RENDER — PERMESSO NEGATO
  // ─────────────────────────────────────────

  if (hasPermission === false) {
    return (
      <PermessoNegato
        onRichiedi={requestPermission}
        onChiudi={handleChiudi}
      />
    );
  }

  // ─────────────────────────────────────────
  // RENDER — LOADING PERMESSO
  // ─────────────────────────────────────────

  if (hasPermission === null) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FFFFFF" />
        <Text style={styles.loadingText}>Accesso fotocamera...</Text>
      </View>
    );
  }

  // ─────────────────────────────────────────
  // RENDER — CAMERA
  // ─────────────────────────────────────────

  return (
    <View style={styles.container}>
      {/* ── Camera live ── */}
      <Camera
        ref={cameraRef}
        style={styles.camera}
        type={cameraType}
        flashMode={flashMode}
        onCameraReady={() => setCameraReady(true)}
        ratio="16:9"
      />

      {/* ── Overlay controlli superiori ── */}
      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        {/* Chiudi */}
        <TouchableOpacity
          style={styles.iconButton}
          onPress={handleChiudi}
          activeOpacity={0.8}
        >
          <Text style={styles.iconButtonText}>✕</Text>
        </TouchableOpacity>

        {/* Flash toggle */}
        <TouchableOpacity
          style={[
            styles.iconButton,
            flashMode === FlashMode.on && styles.iconButtonActive,
          ]}
          onPress={handleToggleFlash}
          activeOpacity={0.8}
        >
          <Text style={styles.iconButtonText}>
            {flashMode === FlashMode.on ? '⚡' : '⚡'}
          </Text>
          {flashMode === FlashMode.off && (
            <View style={styles.flashOff} />
          )}
        </TouchableOpacity>

        {/* Flip camera */}
        <TouchableOpacity
          style={styles.iconButton}
          onPress={handleFlipCamera}
          activeOpacity={0.8}
        >
          <Text style={styles.iconButtonText}>🔄</Text>
        </TouchableOpacity>
      </View>

      {/* ── Barra inferiore: libreria + scatta + placeholder ── */}
      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 16 }]}>
        {/* Pulsante libreria */}
        <TouchableOpacity
          style={styles.sideButton}
          onPress={handleApriLibreria}
          disabled={isProcessing}
          activeOpacity={0.8}
        >
          <View style={styles.sideButtonInner}>
            <Text style={styles.sideButtonText}>Libreria</Text>
          </View>
        </TouchableOpacity>

        {/* Pulsante scatto */}
        <TouchableOpacity
          style={[
            styles.shutterButton,
            (!cameraReady || isProcessing) && styles.shutterButtonDisabled,
          ]}
          onPress={handleScatta}
          disabled={!cameraReady || isProcessing}
          activeOpacity={0.85}
        >
          <View style={styles.shutterInner}>
            {isProcessing && (
              <ActivityIndicator size="small" color="#6366F1" />
            )}
          </View>
        </TouchableOpacity>

        {/* Placeholder destra (bilanciamento layout) */}
        <View style={styles.sideButton} />
      </View>

      {/* ── Preview post-scatto ── */}
      {fotoPreview && (
        <PreviewOverlay
          foto={fotoPreview}
          isSaving={isSaving}
          onConferma={handleConferma}
          onRiprova={handleRiprova}
          onAnnulla={handleChiudi}
        />
      )}
    </View>
  );
}

// ─────────────────────────────────────────────
// STILI
// ─────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex:            1,
    backgroundColor: '#000000',
  },
  camera: {
    flex: 1,
  },
  loadingContainer: {
    flex:            1,
    backgroundColor: '#000000',
    alignItems:      'center',
    justifyContent:  'center',
    gap:             16,
  },
  loadingText: {
    color:    '#FFFFFF',
    fontSize: 15,
    opacity:  0.8,
  },
  topBar: {
    position:          'absolute',
    top:               0,
    left:              0,
    right:             0,
    flexDirection:     'row',
    justifyContent:    'space-between',
    alignItems:        'center',
    paddingHorizontal: 20,
    paddingBottom:     12,
    // Gradiente simulato con overlay scuro
    backgroundColor:   'rgba(0,0,0,0.35)',
  },
  iconButton: {
    width:           44,
    height:          44,
    borderRadius:    22,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems:      'center',
    justifyContent:  'center',
    borderWidth:     1,
    borderColor:     'rgba(255,255,255,0.15)',
  },
  iconButtonActive: {
    backgroundColor: 'rgba(250,204,21,0.3)',
    borderColor:     'rgba(250,204,21,0.6)',
  },
  iconButtonText: {
    fontSize: 16,
    color:    '#FFFFFF',
  },
  flashOff: {
    position:        'absolute',
    width:           2,
    height:          24,
    backgroundColor: 'rgba(255,255,255,0.7)',
    transform:       [{ rotate: '45deg' }],
    borderRadius:    1,
  },
  bottomBar: {
    position:          'absolute',
    bottom:            0,
    left:              0,
    right:             0,
    flexDirection:     'row',
    justifyContent:    'space-between',
    alignItems:        'center',
    paddingHorizontal: 32,
    paddingTop:        20,
    backgroundColor:   'rgba(0,0,0,0.5)',
  },
  sideButton: {
    width:          72,
    alignItems:     'center',
    justifyContent: 'center',
  },
  sideButtonInner: {
    backgroundColor:   'rgba(255,255,255,0.15)',
    borderRadius:      10,
    paddingHorizontal: 12,
    paddingVertical:   8,
    borderWidth:       1,
    borderColor:       'rgba(255,255,255,0.25)',
  },
  sideButtonText: {
    color:      '#FFFFFF',
    fontSize:   13,
    fontWeight: '500',
  },
  shutterButton: {
    width:           76,
    height:          76,
    borderRadius:    38,
    backgroundColor: '#FFFFFF',
    alignItems:      'center',
    justifyContent:  'center',
    borderWidth:     4,
    borderColor:     'rgba(255,255,255,0.4)',
    // Anello esterno
    shadowColor:     '#FFFFFF',
    shadowOffset:    { width: 0, height: 0 },
    shadowOpacity:   0.4,
    shadowRadius:    8,
  },
  shutterButtonDisabled: {
    opacity: 0.5,
  },
  shutterInner: {
    width:           58,
    height:          58,
    borderRadius:    29,
    backgroundColor: '#FFFFFF',
    alignItems:      'center',
    justifyContent:  'center',
  },
  previewImage: {
    width:  SCREEN_W,
    height: SCREEN_H,
  },
});

const previewStyles = StyleSheet.create({
  bar: {
    position:          'absolute',
    bottom:            0,
    left:              0,
    right:             0,
    backgroundColor:   'rgba(0,0,0,0.65)',
    paddingTop:        20,
    paddingHorizontal: 24,
  },
  azioniRow: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
    paddingBottom:  8,
  },
  btnConferma: {
    backgroundColor:   '#6366F1',
    borderRadius:      14,
    paddingHorizontal: 28,
    paddingVertical:   14,
    minWidth:          120,
    alignItems:        'center',
  },
  btnConfermaText: {
    color:      '#FFFFFF',
    fontSize:   16,
    fontWeight: '700',
  },
  btnSecondario: {
    backgroundColor:   'rgba(255,255,255,0.12)',
    borderRadius:      12,
    paddingHorizontal: 16,
    paddingVertical:   12,
    borderWidth:       1,
    borderColor:       'rgba(255,255,255,0.2)',
    minWidth:          80,
    alignItems:        'center',
  },
  btnSecondarioText: {
    color:      '#FFFFFF',
    fontSize:   14,
    fontWeight: '500',
  },
  savingRow: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'center',
    paddingVertical: 18,
    gap:            12,
  },
  savingText: {
    color:    '#FFFFFF',
    fontSize: 15,
    opacity:  0.9,
  },
});

const permStyles = StyleSheet.create({
  container: {
    flex:              1,
    backgroundColor:   '#111827',
    alignItems:        'center',
    justifyContent:    'center',
    paddingHorizontal: 40,
    gap:               16,
  },
  icon: {
    fontSize:     56,
    marginBottom: 8,
  },
  titolo: {
    fontSize:   22,
    fontWeight: '700',
    color:      '#FFFFFF',
    textAlign:  'center',
  },
  sottotitolo: {
    fontSize:   15,
    color:      'rgba(255,255,255,0.6)',
    textAlign:  'center',
    lineHeight: 22,
    marginBottom: 8,
  },
  btnPrimary: {
    backgroundColor:   '#6366F1',
    borderRadius:      12,
    paddingHorizontal: 28,
    paddingVertical:   14,
    width:             '100%',
    alignItems:        'center',
  },
  btnPrimaryText: {
    color:      '#FFFFFF',
    fontSize:   16,
    fontWeight: '600',
  },
  btnSecondary: {
    paddingVertical: 12,
    alignItems:      'center',
    width:           '100%',
  },
  btnSecondaryText: {
    color:    'rgba(255,255,255,0.55)',
    fontSize: 15,
  },
});
