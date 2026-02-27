"use client";

import { useState, useEffect, useRef, useCallback } from "react";

type HudPhase =
  | "idle"
  | "initializing"
  | "connecting"
  | "fetching"
  | "processing"
  | "writing"
  | "complete"
  | "error";

interface Particle {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  opacity: number;
  hue: number;
  life: number;
}

export interface ExportHudProps {
  active: boolean;
  symbol: string;
  timeframe: string;
  last: number;
  windowSize: number;
  allTimeframes: boolean;
  onComplete: (result: { ok: boolean; message: string }) => void;
}

const PHASE_META: Record<
  HudPhase,
  { label: string; detail: string; progress: number; icon: string }
> = {
  idle: { label: "STANDBY", detail: "Awaiting command", progress: 0, icon: "◇" },
  initializing: {
    label: "INIT",
    detail: "Engaging export subsystem",
    progress: 8,
    icon: "⟐",
  },
  connecting: {
    label: "CONNECT",
    detail: "Establishing Supabase uplink",
    progress: 20,
    icon: "⟡",
  },
  fetching: {
    label: "FETCH",
    detail: "Downloading OHLCV candle stream",
    progress: 40,
    icon: "⬡",
  },
  processing: {
    label: "PROCESS",
    detail: "Running SMC analysis engine",
    progress: 65,
    icon: "⬢",
  },
  writing: {
    label: "WRITE",
    detail: "Transmitting frames to database",
    progress: 85,
    icon: "◈",
  },
  complete: {
    label: "DONE",
    detail: "Export transmission successful",
    progress: 100,
    icon: "✦",
  },
  error: { label: "ERROR", detail: "Export failed", progress: 0, icon: "✕" },
};

const PHASE_SEQUENCE: HudPhase[] = [
  "initializing",
  "connecting",
  "fetching",
  "processing",
  "writing",
];

function createParticle(canvasW: number, canvasH: number, id: number): Particle {
  const centerX = canvasW / 2;
  const angle = Math.random() * Math.PI * 2;
  const speed = 0.3 + Math.random() * 1.2;
  return {
    id,
    x: centerX + (Math.random() - 0.5) * 60,
    y: canvasH * 0.85 + Math.random() * 20,
    vx: Math.cos(angle) * speed * 0.3,
    vy: -speed,
    size: 1 + Math.random() * 2,
    opacity: 0.4 + Math.random() * 0.6,
    hue: 30 + Math.random() * 40,
    life: 60 + Math.random() * 80,
  };
}

export function ExportHud({
  active,
  symbol,
  timeframe,
  last,
  windowSize,
  allTimeframes,
  onComplete,
}: ExportHudProps) {
  const [phase, setPhase] = useState<HudPhase>("idle");
  const [progress, setProgress] = useState(0);
  const [logLines, setLogLines] = useState<string[]>([]);
  const [elapsed, setElapsed] = useState(0);
  const [resultMsg, setResultMsg] = useState("");
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const animFrameRef = useRef<number>(0);
  const startTimeRef = useRef(0);
  const phaseTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const nextParticleId = useRef(0);

  const propsRef = useRef({ symbol, timeframe, last, windowSize, allTimeframes });
  propsRef.current = { symbol, timeframe, last, windowSize, allTimeframes };
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  const addLog = useCallback((line: string) => {
    setLogLines((prev) => [...prev.slice(-8), line]);
  }, []);

  useEffect(() => {
    if (!active) {
      setPhase("idle");
      setProgress(0);
      setLogLines([]);
      setElapsed(0);
      setResultMsg("");
      return;
    }

    const { symbol: sym, timeframe: tf, last: l, windowSize: ws, allTimeframes: all } = propsRef.current;

    startTimeRef.current = Date.now();
    let currentPhaseIdx = 0;
    let cancelled = false;

    const advancePhase = () => {
      if (cancelled) return;
      if (currentPhaseIdx < PHASE_SEQUENCE.length) {
        const p = PHASE_SEQUENCE[currentPhaseIdx];
        setPhase(p);
        addLog(`▸ ${PHASE_META[p].label}: ${PHASE_META[p].detail}`);
        currentPhaseIdx++;
        const delay = 800 + Math.random() * 600;
        phaseTimerRef.current = setTimeout(advancePhase, delay);
      }
    };

    advancePhase();

    const resolvedTf = tf === "current" ? "23" : tf;
    const isAll = all || tf === "all";

    fetch("/api/export-smc-frames", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        symbol: sym,
        timeframe: isAll ? "23" : resolvedTf,
        allTimeframes: isAll,
        last: l,
        window: ws,
      }),
    })
      .then(async (res) => {
        if (cancelled) return;
        const data = await res.json().catch(() => ({}));
        clearTimeout(phaseTimerRef.current);
        if (!res.ok) {
          setPhase("error");
          const msg = data.detail ?? data.error ?? `Export failed (${res.status})`;
          setResultMsg(msg);
          addLog(`✕ ERROR: ${msg}`);
          onCompleteRef.current({ ok: false, message: msg });
        } else {
          setPhase("complete");
          setProgress(100);
          const msg = data.message ?? "Export finished.";
          setResultMsg(msg);
          addLog(`✦ ${msg}`);
          onCompleteRef.current({ ok: true, message: msg });
        }
      })
      .catch((e) => {
        if (cancelled) return;
        clearTimeout(phaseTimerRef.current);
        const msg = e instanceof Error ? e.message : "Export failed";
        setPhase("error");
        setResultMsg(msg);
        addLog(`✕ ERROR: ${msg}`);
        onCompleteRef.current({ ok: false, message: msg });
      });

    return () => {
      cancelled = true;
      clearTimeout(phaseTimerRef.current);
    };
  // Only re-run when active toggles on/off
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  useEffect(() => {
    if (!active || phase === "idle") return;
    const target = PHASE_META[phase].progress;
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= target) return prev;
        const step = Math.max(0.3, (target - prev) * 0.08);
        return Math.min(target, prev + step);
      });
    }, 50);
    return () => clearInterval(interval);
  }, [active, phase]);

  useEffect(() => {
    if (!active || phase === "idle" || phase === "complete" || phase === "error") return;
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [active, phase]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !active || phase === "idle") {
      cancelAnimationFrame(animFrameRef.current);
      return;
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    let frame = 0;
    const isRunning = phase !== "complete" && phase !== "error";

    const animate = () => {
      const rect = canvas.getBoundingClientRect();
      const w = rect.width;
      const h = rect.height;

      if (w < 1 || h < 1) {
        animFrameRef.current = requestAnimationFrame(animate);
        return;
      }

      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      frame++;

      if (isRunning && frame % 4 === 0) {
        particlesRef.current.push(createParticle(w, h, nextParticleId.current++));
      }

      const centerX = w / 2;

      if (isRunning && h > 4) {
        const beamGrad = ctx.createLinearGradient(centerX, h * 0.1, centerX, h * 0.9);
        beamGrad.addColorStop(0, "oklch(0.72 0.16 75 / 0)");
        beamGrad.addColorStop(0.2, "oklch(0.72 0.16 75 / 0.06)");
        beamGrad.addColorStop(0.5, `oklch(0.72 0.16 75 / ${0.04 + Math.sin(frame * 0.05) * 0.02})`);
        beamGrad.addColorStop(0.8, "oklch(0.72 0.16 75 / 0.06)");
        beamGrad.addColorStop(1, "oklch(0.72 0.16 75 / 0)");
        ctx.fillStyle = beamGrad;
        ctx.fillRect(centerX - 16, 0, 32, h);
      }

      if (isRunning && h > 4) {
        const scanY = (frame * 1.2) % h;
        const scanGrad = ctx.createLinearGradient(0, scanY - 1, 0, scanY + 1);
        scanGrad.addColorStop(0, "oklch(0.72 0.16 75 / 0)");
        scanGrad.addColorStop(0.5, "oklch(0.72 0.16 75 / 0.12)");
        scanGrad.addColorStop(1, "oklch(0.72 0.16 75 / 0)");
        ctx.fillStyle = scanGrad;
        ctx.fillRect(0, scanY - 1, w, 2);
      }

      particlesRef.current = particlesRef.current.filter((p) => {
        p.x += p.vx;
        p.y += p.vy;
        p.life--;
        p.opacity *= 0.985;

        if (p.life <= 0 || p.opacity < 0.01) return false;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `oklch(0.72 0.16 ${p.hue} / ${p.opacity})`;
        ctx.fill();

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * 2.5, 0, Math.PI * 2);
        ctx.fillStyle = `oklch(0.72 0.16 ${p.hue} / ${p.opacity * 0.2})`;
        ctx.fill();

        return true;
      });

      if (phase === "complete" && w > 1 && h > 1) {
        const burstOpacity = Math.max(0, 1 - frame * 0.02);
        if (burstOpacity > 0) {
          const r = Math.max(w, h) * 0.6;
          const grad = ctx.createRadialGradient(centerX, h / 2, 0, centerX, h / 2, r || 1);
          grad.addColorStop(0, `oklch(0.85 0.18 145 / ${burstOpacity * 0.3})`);
          grad.addColorStop(0.5, `oklch(0.72 0.16 75 / ${burstOpacity * 0.1})`);
          grad.addColorStop(1, "oklch(0.72 0.16 75 / 0)");
          ctx.fillStyle = grad;
          ctx.fillRect(0, 0, w, h);
        }
      }

      if (phase === "error") {
        if (Math.sin(frame * 0.15) > 0) {
          ctx.fillStyle = "oklch(0.6 0.2 25 / 0.04)";
          ctx.fillRect(0, 0, w, h);
        }
      }

      animFrameRef.current = requestAnimationFrame(animate);
    };

    animate();
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [active, phase]);

  if (!active && phase === "idle") return null;

  const meta = PHASE_META[phase];
  const isRunning = phase !== "idle" && phase !== "complete" && phase !== "error";
  const isDone = phase === "complete";
  const isErr = phase === "error";

  const { symbol: sym, timeframe: tf, last: l, windowSize: ws, allTimeframes: all } = propsRef.current;
  const tfDisplay = all ? "ALL" : tf;

  return (
    <div className="export-hud-live relative overflow-hidden">
      <canvas
        ref={canvasRef}
        className="absolute inset-0 h-full w-full pointer-events-none"
        style={{ opacity: 0.8 }}
      />

      <div className="relative z-10 flex flex-col gap-2.5 px-3 py-3">
        {/* Phase icon + label + elapsed */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span
              className={`export-hud-icon text-base ${isRunning ? "export-hud-icon-pulse" : ""} ${isDone ? "export-hud-icon-done" : ""} ${isErr ? "export-hud-icon-error" : ""}`}
            >
              {meta.icon}
            </span>
            <span className="export-hud-label font-mono text-xs font-semibold uppercase tracking-[0.12em]">
              {meta.label}
            </span>
          </div>
          {(isRunning || isDone) && (
            <span className="font-mono text-xs tabular-nums export-hud-elapsed">
              {elapsed}s
            </span>
          )}
        </div>

        {/* Detail */}
        <p className="font-mono text-[0.6875rem] export-hud-detail leading-snug">
          {meta.detail}
        </p>

        {/* Progress bar */}
        <div className="export-hud-track relative h-[3px] w-full overflow-hidden rounded-full">
          <div
            className={`export-hud-bar absolute inset-y-0 left-0 rounded-full transition-all duration-300 ease-out ${isDone ? "export-hud-bar-done" : ""} ${isErr ? "export-hud-bar-error" : ""}`}
            style={{ width: `${progress}%` }}
          />
          {isRunning && (
            <div
              className="export-hud-bar-glow absolute inset-y-0 rounded-full"
              style={{ width: `${progress}%` }}
            />
          )}
        </div>

        {/* Readout grid */}
        <div className="export-hud-readout grid grid-cols-3 gap-x-3 gap-y-1">
          <HudField label="SYM" value={sym || "---"} />
          <HudField label="TF" value={tfDisplay} />
          <HudField label="BARS" value={String(l)} />
          <HudField label="WIN" value={String(ws)} />
          <HudField label="PROG" value={`${Math.round(progress)}%`} highlight />
          <HudField
            label="STS"
            value={isDone ? "OK" : isErr ? "FAIL" : "RUN"}
            highlight={isDone}
            error={isErr}
          />
        </div>

        {/* Log feed */}
        <div className="export-hud-log flex flex-col gap-[2px]">
          {logLines.slice(-5).map((line, i, arr) => (
            <div
              key={i}
              className={`export-hud-log-line font-mono text-[0.625rem] leading-snug ${i === arr.length - 1 ? "export-hud-log-latest" : ""}`}
            >
              {line}
            </div>
          ))}
        </div>

        {/* Result */}
        {resultMsg && (isDone || isErr) && (
          <div
            className={`export-hud-result font-mono text-[0.6875rem] leading-snug ${isDone ? "export-hud-result-ok" : "export-hud-result-error"}`}
          >
            {resultMsg}
          </div>
        )}

        {/* Phase dots */}
        <div className="flex items-center justify-center gap-1.5">
          {PHASE_SEQUENCE.map((p, i) => {
            const phaseIdx = PHASE_SEQUENCE.indexOf(phase as never);
            const done = i < phaseIdx || isDone;
            const current = p === phase;
            return (
              <div
                key={p}
                className={`export-hud-phase-dot ${done ? "export-hud-phase-done" : ""} ${current ? "export-hud-phase-current" : ""}`}
                title={PHASE_META[p].label}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}

function HudField({
  label,
  value,
  highlight,
  error,
}: {
  label: string;
  value: string;
  highlight?: boolean;
  error?: boolean;
}) {
  return (
    <div className="flex items-baseline gap-1.5 overflow-hidden">
      <span className="export-hud-field-label shrink-0">
        {label}
      </span>
      <span
        className={`export-hud-field-value truncate ${highlight ? "export-hud-field-highlight" : ""} ${error ? "export-hud-field-error" : ""}`}
      >
        {value}
      </span>
    </div>
  );
}
