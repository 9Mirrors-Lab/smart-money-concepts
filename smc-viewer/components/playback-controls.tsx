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

const iconBase = "size-3 stroke-[1.25]";
const playColor = "text-[#00ffb3]";
const skipBackColor = "text-[#ff10f0]";
const skipForwardColor = "text-[#00f5ff]";
const reverseColor = "text-[#ff6600]";

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
    <div className="flex w-full items-center gap-2 px-4 py-2">
      <Button
        variant="outline"
        size="icon-xs"
        onClick={onPlayPause}
        aria-label={isPlaying ? "Pause" : "Play"}
        className="border-[#00ffb3]/55 hover:bg-[#00ffb3]/22"
      >
        {isPlaying ? (
          <Pause className={`${iconBase} ${playColor}`} strokeWidth={1.25} />
        ) : (
          <Play className={`${iconBase} ${playColor}`} strokeWidth={1.25} />
        )}
      </Button>
      <Button
        variant="outline"
        size="icon-xs"
        onClick={onStepBack}
        aria-label="Previous frame"
        className="border-[#ff10f0]/55 hover:bg-[#ff10f0]/18"
      >
        <SkipBack className={`${iconBase} ${skipBackColor}`} strokeWidth={1.25} />
      </Button>
      <Button
        variant="outline"
        size="icon-xs"
        onClick={onStepForward}
        aria-label="Next frame"
        className="border-[#00f5ff]/55 hover:bg-[#00f5ff]/18"
      >
        <SkipForward className={`${iconBase} ${skipForwardColor}`} strokeWidth={1.25} />
      </Button>
      <Button
        variant={isReversed ? "secondary" : "outline"}
        size="icon-xs"
        onClick={onReverse}
        aria-label="Reverse playback"
        className={isReversed ? "bg-[#ff6600]/25 border-[#ff6600]/60" : "border-[#ff6600]/55 hover:bg-[#ff6600]/18"}
      >
        <RotateCcw className={`${iconBase} ${reverseColor}`} strokeWidth={1.25} />
      </Button>
      <Slider
        className="min-w-0 flex-1"
        min={0}
        max={100}
        step={totalFrames <= 1 ? 100 : 100 / (totalFrames - 1)}
        value={[speedPercent]}
        onValueChange={([p]) => {
          if (totalFrames <= 1) return;
          const idx = Math.round((p / 100) * (totalFrames - 1));
          onFrameChange(Math.max(0, Math.min(idx, totalFrames - 1)));
        }}
        rangeClassName="!bg-[linear-gradient(to_right,#ef4444,#f97316,#eab308,#22c55e,#3b82f6,#8b5cf6,#ec4899)]"
        thumbClassName="border-[#00d4ff] bg-[#00d4ff] shadow-[0_0_8px_#00d4ff] hover:shadow-[0_0_12px_#00d4ff] focus-visible:ring-[#00d4ff]/50"
      />
      <div className="flex shrink-0 items-center gap-1.5">
        <span className="text-[10px] text-muted-foreground">Speed</span>
        <Slider
          className="w-14"
          min={SPEED_MIN}
          max={SPEED_MAX}
          step={SPEED_STEP}
          value={[speed]}
          onValueChange={([v]) => onSpeedChange(v ?? 1)}
        />
        <span className="w-8 text-right text-[10px] tabular-nums text-muted-foreground">
          {speed.toFixed(2)}×
        </span>
      </div>
    </div>
  );
}
