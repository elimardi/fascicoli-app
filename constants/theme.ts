/**
 * @file constants/theme.ts
 * Design system dell'app — tutti i colori, raggi, spaziature e stili
 * di testo condivisi. Ogni schermata e componente attinge da qui:
 * cambiare un valore qui ricolora l'intera app in modo coerente.
 *
 * Direzione visiva: "Infinitek — strumento professionale".
 * - Chrome navy profondo (header, tab bar, splash) ripreso dal fondo del logo
 * - Ciano elettrico come accento sul navy, esattamente dove sta nel marchio
 * - Argento/acciaio per gli stati neutri, il secondo colore del simbolo
 * - Contenuti su carta chiara: leggibili anche in cantiere, con il sole
 * - Etichette di sezione in maiuscoletto spaziato, come il wordmark
 * - Firma: dorso colorato per stato sulle card, come le etichette
 *   delle cartelline d'archivio
 */

import { Platform } from 'react-native';
import type { TextStyle, ViewStyle } from 'react-native';

// ─────────────────────────────────────────────
// COLORI
// ─────────────────────────────────────────────

export const Colors = {
  // ── Marchio: il navy e il ciano del logo ──
  /** Fondo del logo — header, tab bar, splash, icona */
  brandNavy:     '#050C1C',
  /** Navy sollevato, per superfici sopra il chrome */
  brandNavySoft: '#0B1730',
  /** Filetto sul navy */
  brandNavyLine: '#1B2942',
  /** Ciano elettrico del simbolo — accento SOLO su navy (11.4:1) */
  brandCyan:     '#35D6FF',
  /** Argento del simbolo — elementi inattivi su navy (6.6:1) */
  brandSilver:   '#8A97AD',

  // ── Accento azioni su fondo chiaro ──
  // Il ciano puro su bianco non è leggibile (1.8:1): qui si usa
  // lo stesso blu portato a contrasto AA con testo bianco (5.1:1).
  primary:        '#0B6FC7',
  primaryPressed: '#0A5AA6',
  primaryTint:    '#EAF3FC',
  primaryBorder:  '#C7E0F6',
  primaryMuted:   '#9EC4E6', // stati disabled

  // ── Inchiostro (testi) ──
  ink:       '#0B1220',
  inkSoft:   '#3E4C63',
  inkMuted:  '#5F6E86',
  inkFaint:  '#8A97AD',

  // ── Superfici ──
  bg:             '#F3F6FA',
  surface:        '#FFFFFF',
  surfaceSunken:  '#F7F9FC',
  hairline:       '#E4E9F0',
  hairlineStrong: '#CBD3DF',

  // ── Semantici ──
  success:       '#17B26A',
  successText:   '#067647',
  successTint:   '#ECFDF3',
  successBorder: '#ABEFC6',

  danger:       '#F04438',
  dangerText:   '#B42318',
  dangerTint:   '#FEF3F2',
  dangerBorder: '#FECDCA',

  warning:       '#F79009',
  warningText:   '#B54708',
  warningTint:   '#FFFAEB',
  warningBorder: '#FEDF89',
} as const;

// ─────────────────────────────────────────────
// FORME E SPAZI
// ─────────────────────────────────────────────

export const Radius = {
  sm:   10,
  md:   12,
  lg:   16,
  xl:   20,
  pill: 999,
} as const;

/** Spessore del dorso colorato per stato (firma visiva dell'app) */
export const SPINE_WIDTH = 4;

// ─────────────────────────────────────────────
// TIPOGRAFIA
// ─────────────────────────────────────────────

/** Font monospazio di piattaforma, per codici documento e JSON */
export const MONO_FONT = Platform.select({
  ios:     'Menlo',
  android: 'monospace',
  default: 'monospace',
});

/**
 * Etichetta di sezione in maiuscoletto spaziato.
 * Usata come titolo di ogni card-sezione al posto dei titoli generici.
 */
export const overline: TextStyle = {
  fontSize:      11,
  fontWeight:    '700',
  letterSpacing: 1.1,
  textTransform: 'uppercase',
  color:         Colors.inkMuted,
};

// ─────────────────────────────────────────────
// OMBRE
// ─────────────────────────────────────────────

/** Ombra morbida per card su sfondo carta */
export const cardShadow: ViewStyle = {
  shadowColor:   '#101828',
  shadowOffset:  { width: 0, height: 2 },
  shadowOpacity: 0.05,
  shadowRadius:  8,
  elevation:     2,
};

/** Ombra pronunciata per elementi flottanti (FAB) */
export const raisedShadow: ViewStyle = {
  shadowColor:   Colors.primary,
  shadowOffset:  { width: 0, height: 6 },
  shadowOpacity: 0.30,
  shadowRadius:  12,
  elevation:     8,
};

/** Stile base condiviso per le card-sezione */
export const sectionCard: ViewStyle = {
  backgroundColor: Colors.surface,
  borderRadius:    Radius.lg,
  borderWidth:     1,
  borderColor:     Colors.hairline,
  padding:         16,
  ...cardShadow,
};
