/**
 * @file hooks/useCamera.ts
 * Hook per la gestione della fotocamera e della libreria immagini.
 * Gestisce i permessi (camera + libreria), lo scatto e la selezione
 * tramite expo-camera ed expo-image-picker.
 */

import { useState, useCallback } from 'react';
import { Alert, Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Camera } from 'expo-camera';

// ─────────────────────────────────────────────
// TIPI
// ─────────────────────────────────────────────

export interface FotoScattata {
  uri: string;
  width: number;
  height: number;
  /** Data scatto ISO 8601 — disponibile solo da image picker, non dalla camera */
  dataScatto?: string;
}

export interface UseCameraResult {
  // ── Permessi ──
  hasPermission: boolean | null;
  requestPermission: () => Promise<boolean>;

  // ── Libreria ──
  hasLibraryPermission: boolean | null;
  requestLibraryPermission: () => Promise<boolean>;

  // ── Stato ──
  isProcessing: boolean;

  // ── Azioni ──
  apriLibreria: () => Promise<FotoScattata | null>;
  scattaFoto: (cameraRef: React.RefObject<Camera>) => Promise<FotoScattata | null>;
}

// ─────────────────────────────────────────────
// HOOK
// ─────────────────────────────────────────────

/**
 * Gestisce permessi fotocamera/libreria, scatto e selezione immagini.
 * Da usare nella schermata `/fascicolo/[id]/camera`.
 *
 * @returns `UseCameraResult` con permessi, stato e azioni
 *
 * @example
 * const { hasPermission, requestPermission, apriLibreria, scattaFoto } = useCamera();
 *
 * useEffect(() => {
 *   if (hasPermission === null) requestPermission();
 * }, []);
 */
export function useCamera(): UseCameraResult {
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [hasLibraryPermission, setHasLibraryPermission] = useState<boolean | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // ─────────────────────────────────────────
  // PERMESSI
  // ─────────────────────────────────────────

  /**
   * Richiede il permesso di accesso alla fotocamera.
   * Su iOS mostra un dialog nativo la prima volta.
   * Restituisce true se concesso, false altrimenti.
   */
  const requestPermission = useCallback(async (): Promise<boolean> => {
    try {
      const { status } = await Camera.requestCameraPermissionsAsync();
      const granted = status === 'granted';
      setHasPermission(granted);

      if (!granted) {
        Alert.alert(
          'Permesso fotocamera negato',
          'Per scattare foto è necessario consentire l\'accesso alla fotocamera nelle impostazioni del dispositivo.',
          [{ text: 'OK' }]
        );
      }

      return granted;
    } catch (error) {
      console.error('[useCamera] Errore richiesta permesso camera:', error);
      setHasPermission(false);
      return false;
    }
  }, []);

  /**
   * Richiede il permesso di accesso alla libreria foto.
   * Necessario per la selezione da image picker.
   */
  const requestLibraryPermission = useCallback(async (): Promise<boolean> => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      const granted = status === 'granted';
      setHasLibraryPermission(granted);

      if (!granted) {
        Alert.alert(
          'Permesso libreria negato',
          'Per selezionare foto dalla libreria è necessario consentire l\'accesso nelle impostazioni del dispositivo.',
          [{ text: 'OK' }]
        );
      }

      return granted;
    } catch (error) {
      console.error('[useCamera] Errore richiesta permesso libreria:', error);
      setHasLibraryPermission(false);
      return false;
    }
  }, []);

  // ─────────────────────────────────────────
  // AZIONI
  // ─────────────────────────────────────────

  /**
   * Apre l'image picker per selezionare una foto dalla libreria.
   * Restituisce `null` se l'utente annulla o si verifica un errore.
   *
   * @returns `FotoScattata` con URI e dimensioni, o `null`
   */
  const apriLibreria = useCallback(async (): Promise<FotoScattata | null> => {
    // Verifica o richiede permesso
    if (!hasLibraryPermission) {
      const granted = await requestLibraryPermission();
      if (!granted) return null;
    }

    setIsProcessing(true);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 0.85,
        exif: true, // Necessario per recuperare la data scatto
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return null;
      }

      const asset = result.assets[0];
      const dataScatto = asset.exif?.DateTimeOriginal
        ? parseExifDate(asset.exif.DateTimeOriginal as string)
        : undefined;

      return {
        uri:        asset.uri,
        width:      asset.width,
        height:     asset.height,
        dataScatto,
      };
    } catch (error) {
      console.error('[useCamera] Errore apertura libreria:', error);
      Alert.alert('Errore', 'Impossibile aprire la libreria foto.');
      return null;
    } finally {
      setIsProcessing(false);
    }
  }, [hasLibraryPermission, requestLibraryPermission]);

  /**
   * Scatta una foto tramite il ref della Camera di expo-camera.
   * Ottimizzata per qualità e velocità di scatto.
   *
   * @param cameraRef - Ref alla componente Camera
   * @returns         `FotoScattata` con URI e dimensioni, o `null`
   */
  const scattaFoto = useCallback(
    async (cameraRef: React.RefObject<Camera>): Promise<FotoScattata | null> => {
      if (!cameraRef.current) {
        console.warn('[useCamera] Camera ref non disponibile.');
        return null;
      }

      if (isProcessing) return null;

      setIsProcessing(true);
      try {
        const photo = await cameraRef.current.takePictureAsync({
          quality:               0.85,
          skipProcessing:        Platform.OS === 'android', // Più veloce su Android
          exif:                  false,
          shutterSound:          false,
        });

        return {
          uri:    photo.uri,
          width:  photo.width,
          height: photo.height,
          dataScatto: new Date().toISOString(),
        };
      } catch (error) {
        console.error('[useCamera] Errore scatto foto:', error);
        Alert.alert('Errore', 'Impossibile scattare la foto. Riprova.');
        return null;
      } finally {
        setIsProcessing(false);
      }
    },
    [isProcessing]
  );

  return {
    hasPermission,
    requestPermission,
    hasLibraryPermission,
    requestLibraryPermission,
    isProcessing,
    apriLibreria,
    scattaFoto,
  };
}

// ─────────────────────────────────────────────
// HELPERS PRIVATI
// ─────────────────────────────────────────────

/**
 * Converte una data EXIF nel formato "YYYY:MM:DD HH:MM:SS"
 * in una stringa ISO 8601 standard.
 * Restituisce `undefined` se il parsing fallisce.
 *
 * @param exifDate - Data in formato EXIF
 * @returns        Stringa ISO 8601 o `undefined`
 */
function parseExifDate(exifDate: string): string | undefined {
  try {
    // Formato EXIF: "2024:03:15 14:30:00"
    const normalized = exifDate.replace(
      /^(\d{4}):(\d{2}):(\d{2})/,
      '$1-$2-$3'
    );
    const date = new Date(normalized);
    if (isNaN(date.getTime())) return undefined;
    return date.toISOString();
  } catch {
    return undefined;
  }
}
