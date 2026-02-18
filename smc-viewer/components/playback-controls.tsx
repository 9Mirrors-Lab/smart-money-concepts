"use client";

import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Play, Pause, SkipBack, SkipForward, RotateCcw } from "lucide-react";

export interface PlaybackControlsProps {
  currentFrame: number;
  totalFrames: number;
  isPlaying: boolean;
  onPlayPause: () => void;
  speed: number;
  onSpeedChange: (v: number) => void;
  isReversed: boolean;
  onReverse: () => void;
  onFrameChange: (frame: number) => void;
  onStepBack: () => void;
  onStepForward: () => void;
}

const SPEED_MIN = 0.25;
const SPEED_MAX = 4;
const SPEED_STEP = 0.25;

export function PlaybackControls({
  currentFrame,
  totalFrames,
  isPlaying,
  onPlayPause,
  speed,
  onSpeedChange,
  isReversed,
  onReverse,
  onFrameChange,
  onStepBack,
  onStepForward,
}: PlaybackControlsProps) {
  const speedPercent =
    totalFrames <= 1 ? 0 : (currentFrame / (totalFrames - 1)) * 100;

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="outline"
          size="icon"
          onClick={onPlayPause}
          aria-label={isPlaying ? "Pause" : "Play"}
        >
          {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        </Button>
        <Button variant="outline" size="icon" onClick={onStepBack} aria-label="Previous frame">
          <SkipBack className="h-4 w-4" />
        </Button>
        <Button variant="outline" size="icon" onClick={onStepForward} aria-label="Next frame">
          <SkipForward className="h-4 w-4" />
        </Button>
        <Button
          variant={isReversed ? "secondary" : "outline"}
          size="icon"
          onClick={onReverse}
          aria-label="Reverse playback"
        >
          <RotateCcw className="h-4 w-4" />
        </Button>
        <span className="ml-2 text-sm text-muted-foreground tabular-nums">
          {currentFrame + 1} / {totalFrames}
        </span>
        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Speed</span>
          <Slider
            className="w-24"
            min={SPEED_MIN}
            max={SPEED_MAX}
            step={SPEED_STEP}
            value={[speed]}
            onValueChange={([v]) => onSpeedChange(v ?? 1)}
          />
          <span className="w-10 text-right text-sm tabular-nums">{speed.toFixed(2)}×</span>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Slider
          className="flex-1"
          min={0}
          max={100}
          step={totalFrames <= 1 ? 100 : 100 / (totalFrames - 1)}
          value={[speedPercent]}
          onValueChange={([p]) => {
            if (totalFrames <= 1) return;
            const idx = Math.round((p / 100) * (totalFrames - 1));
            onFrameChange(Math.max(0, Math.min(idx, totalFrames - 1)));
          }}
        />
      </div>
    </div>
  );
}
