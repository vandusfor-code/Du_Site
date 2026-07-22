"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type ToneType = OscillatorType;

/**
 * Lightweight Web Audio feedback used across the redesigned modules.
 * Mirrors the click / notify / alert tones from the Claude Design prototype.
 */
export function useModuleSound() {
  const [soundOn, setSoundOn] = useState(true);
  const ctxRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    return () => {
      ctxRef.current?.close().catch(() => {});
    };
  }, []);

  const ctx = useCallback(() => {
    if (!ctxRef.current) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      ctxRef.current = new AudioCtx();
    }
    return ctxRef.current;
  }, []);

  const tone = useCallback(
    (freqs: number[], dur: number, vol = 0.06, type: ToneType = "sine") => {
      if (!soundOn) return;
      const audioCtx = ctx();
      freqs.forEach((f, i) => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = type;
        osc.frequency.value = f;
        const t0 = audioCtx.currentTime + i * 0.09;
        gain.gain.setValueAtTime(0, t0);
        gain.gain.linearRampToValueAtTime(vol, t0 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start(t0);
        osc.stop(t0 + dur + 0.05);
      });
    },
    [ctx, soundOn]
  );

  const playClick = useCallback(() => tone([880], 0.12, 0.05), [tone]);
  const playNotify = useCallback(() => tone([660, 990], 0.35, 0.07), [tone]);
  const playAlert = useCallback(() => tone([523, 659, 784], 0.6, 0.08, "triangle"), [tone]);
  const toggleSound = useCallback(() => setSoundOn((s) => !s), []);

  return { soundOn, toggleSound, playClick, playNotify, playAlert };
}
