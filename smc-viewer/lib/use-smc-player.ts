"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { SMCFrame, IndicatorId } from "./smc-types";
import { INDICATOR_IDS } from "./smc-types";

const BASE_INTERVAL_MS = 500;

const DEFAULT_INDICATOR_VISIBILITY: Record<IndicatorId, boolean> = {
  candles: true,
  fvg: true,
  swing: true,
  fib: false,
  bos: true,
  choch: true,
  ob: true,
  liquidity: true,
  phl: false,
  sessionsAsia: true,
  sessionsLondon: false,
  sessionsNYAM: false,
  sessionsNYPM: false,
  retracements: false,
  ewo: true,
  sma5: false,
  sma35: false,
};

export interface UseSMCPlayerOptions {
  frames: SMCFrame[];
  defaultSpeed?: number;
}

export function useSMCPlayer({ frames, defaultSpeed = 1 }: UseSMCPlayerOptions) {
  const [currentFrame, setCurrentFrame] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(defaultSpeed);
  const [isReversed, setIsReversed] = useState(false);
  const [indicatorVisibility, setIndicatorVisibility] = useState<Record<IndicatorId, boolean>>(
    () => ({ ...DEFAULT_INDICATOR_VISIBILITY })
  );
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const totalFrames = frames.length;
  const current = totalFrames > 0 ? frames[Math.min(currentFrame, totalFrames - 1)] : null;

  const goToFrame = useCallback(
    (index: number) => {
      const next = Math.max(0, Math.min(index, totalFrames - 1));
      setCurrentFrame(next);
    },
    [totalFrames]
  );

  const stepForward = useCallback(() => {
    setCurrentFrame((i) => (i >= totalFrames - 1 ? i : i + 1));
  }, [totalFrames]);

  const stepBack = useCallback(() => {
    setCurrentFrame((i) => (i <= 0 ? i : i - 1));
  }, []);

  const toggleIndicator = useCallback((id: IndicatorId) => {
    setIndicatorVisibility((v) => ({ ...v, [id]: !v[id] }));
  }, []);

  const setCandlesOnly = useCallback(() => {
    setIndicatorVisibility(
      () =>
        Object.fromEntries(
          INDICATOR_IDS.map((id) => [id, id === "candles"])
        ) as Record<IndicatorId, boolean>
    );
  }, []);

  useEffect(() => {
    if (!isPlaying || totalFrames === 0) {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      return;
    }
    const interval = Math.max(50, BASE_INTERVAL_MS / speed);
    timerRef.current = setInterval(() => {
      setCurrentFrame((i) => {
        const next = isReversed ? i - 1 : i + 1;
        if (next < 0) return totalFrames - 1;
        if (next >= totalFrames) return 0;
        return next;
      });
    }, interval);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isPlaying, speed, isReversed, totalFrames]);

  return {
    currentFrame,
    current,
    totalFrames,
    isPlaying,
    setIsPlaying,
    speed,
    setSpeed,
    isReversed,
    setIsReversed,
    indicatorVisibility,
    setIndicatorVisibility,
    toggleIndicator,
    setCandlesOnly,
    goToFrame,
    stepForward,
    stepBack,
  };
}
