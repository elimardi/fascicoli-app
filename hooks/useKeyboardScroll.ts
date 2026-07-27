/**
 * @file hooks/useKeyboardScroll.ts
 * Gestione affidabile della tastiera nelle schermate con form.
 *
 * Problema: su Android (specie con edge-to-edge attivo) la tastiera può
 * sovrapporsi agli input senza che la ScrollView scorra automaticamente,
 * quindi l'utente scrive "al buio".
 *
 * Soluzione a doppia rete di sicurezza:
 * 1. `keyboardHeight` — altezza corrente della tastiera, da aggiungere
 *    come paddingBottom al contenuto della ScrollView: garantisce che ci
 *    sia sempre spazio per scorrere l'input sopra la tastiera.
 * 2. `scrollToFocusedInput` — da passare come `onFocus` a ogni input:
 *    attende l'apertura della tastiera e porta l'input attivo in vista
 *    usando lo scroll responder nativo di React Native.
 *
 * Uso tipico:
 * ```tsx
 * const { scrollRef, keyboardHeight, scrollToFocusedInput } = useKeyboardScroll();
 * <ScrollView
 *   ref={scrollRef}
 *   contentContainerStyle={{ paddingBottom: 32 + keyboardHeight }}
 *   keyboardShouldPersistTaps="handled"
 * >
 *   <FormField onFocus={scrollToFocusedInput} ... />
 * </ScrollView>
 * ```
 */

import { useRef, useEffect, useState, useCallback, type Component } from 'react';
import {
  Keyboard,
  Platform,
  ScrollView,
  TextInput,
  findNodeHandle,
} from 'react-native';

/** Distanza extra (px) tra l'input e il bordo superiore della tastiera */
const KEYBOARD_OFFSET = 120;

export function useKeyboardScroll() {
  const scrollRef = useRef<ScrollView>(null);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  // ── Traccia l'altezza della tastiera ──
  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSub = Keyboard.addListener(showEvent, (e) => {
      setKeyboardHeight(e.endCoordinates?.height ?? 0);
    });
    const hideSub = Keyboard.addListener(hideEvent, () => {
      setKeyboardHeight(0);
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  // ── Porta l'input attivo sopra la tastiera ──
  const scrollToFocusedInput = useCallback(() => {
    // Attende che la tastiera sia (quasi) aperta prima di misurare
    setTimeout(() => {
      const input  = TextInput.State.currentlyFocusedInput();
      const scroll = scrollRef.current;
      if (!input || !scroll) return;

      const node = findNodeHandle(input as unknown as Component);
      // API interna ma stabile da anni: scorre il nodo sopra la tastiera
      const responder = scroll.getScrollResponder?.() as unknown as {
        scrollResponderScrollNativeHandleToKeyboard?: (
          nodeHandle: number,
          additionalOffset: number,
          preventNegativeScrollOffset: boolean
        ) => void;
      };

      if (node && responder?.scrollResponderScrollNativeHandleToKeyboard) {
        responder.scrollResponderScrollNativeHandleToKeyboard(
          node,
          KEYBOARD_OFFSET,
          true
        );
      }
    }, Platform.OS === 'ios' ? 220 : 320);
  }, []);

  return { scrollRef, keyboardHeight, scrollToFocusedInput };
}
