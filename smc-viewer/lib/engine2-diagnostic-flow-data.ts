/**
 * Per-timeframe diagnostic data for Engine 2 Diagnostic Flow.
 * Observed distributions and blockers per TF (from KCEX_ETHUSDT.P diagnostic grid).
 * Presentation only; no threshold or logic changes.
 */

export const TIMEFRAME_ORDER = ["1M", "1W", "1D", "360", "90", "23"] as const;
export type TimeframeKey = (typeof TIMEFRAME_ORDER)[number];

export interface AlignmentRow {
  state: "STRONG" | "MODERATE" | "WEAK" | "DISALIGNED";
  pct: number;
  unreachable?: boolean;
  dominant?: boolean;
}

export interface ConfidenceRow {
  state: "HIGH" | "MEDIUM" | "LOW";
  pct: number;
  unreachable?: boolean;
  default?: boolean;
}

export interface BiasRow {
  state: "NEUTRAL" | "CONTINUATION" | "EXHAUSTION";
  pct: number;
  dominant?: boolean;
  rareButReachable?: boolean;
  unreachable?: boolean;
}

export interface Step1Blockers {
  primary: { label: string; pct: number };
}

export interface Step2Blockers {
  blockingFrequency: { label: string; blocks: string; pct: number }[];
}

export interface Step3Blockers {
  primaryBlockers: string[];
}

export interface TimeframeDiagnostic {
  timeframe: TimeframeKey;
  bars: number;
  dominantAlignment: string;
  dominantConfidence: string;
  dominantBias: string;
  step1: {
    outcomes: AlignmentRow[];
    blockers: Step1Blockers;
  };
  step2: {
    outcomes: ConfidenceRow[];
    blockers: Step2Blockers;
  };
  step3: {
    outcomes: BiasRow[];
    blockers: Step3Blockers;
  };
}

/** Per-TF data: alignment (W/M/D/S), confidence (L/M/H), bias (N/C/E), gating %. */
export const PER_TF_DIAGNOSTIC: Record<TimeframeKey, TimeframeDiagnostic> = {
  "1M": {
    timeframe: "1M",
    bars: 37,
    dominantAlignment: "WEAK",
    dominantConfidence: "LOW",
    dominantBias: "NEUTRAL",
    step1: {
      outcomes: [
        { state: "STRONG", pct: 4.0 },
        { state: "MODERATE", pct: 26.3 },
        { state: "WEAK", pct: 48.7, dominant: true },
        { state: "DISALIGNED", pct: 21.1 },
      ],
      blockers: { primary: { label: "alignment_score < 0.75", pct: 100 } },
    },
    step2: {
      outcomes: [
        { state: "HIGH", pct: 4.0 },
        { state: "MEDIUM", pct: 1.3 },
        { state: "LOW", pct: 94.7, default: true },
      ],
      blockers: {
        blockingFrequency: [
          { label: "stack < 0.70", blocks: "HIGH", pct: 98.6 },
          { label: "stack < 0.40", blocks: "MEDIUM", pct: 98.6 },
          { label: "alignment < 0.65", blocks: "HIGH", pct: 93.2 },
        ],
      },
    },
    step3: {
      outcomes: [
        { state: "NEUTRAL", pct: 64.5, dominant: true },
        { state: "CONTINUATION", pct: 34.2 },
        { state: "EXHAUSTION", pct: 1.3, rareButReachable: true },
      ],
      blockers: {
        primaryBlockers: [
          "wave3_probability < 0.6",
          "wave_number ≠ 3",
          "momentum_strength_score < 0.55",
        ],
      },
    },
  },
  "1W": {
    timeframe: "1W",
    bars: 231,
    dominantAlignment: "WEAK",
    dominantConfidence: "LOW",
    dominantBias: "NEUTRAL",
    step1: {
      outcomes: [
        { state: "STRONG", pct: 0, unreachable: true },
        { state: "MODERATE", pct: 20.9 },
        { state: "WEAK", pct: 70.9, dominant: true },
        { state: "DISALIGNED", pct: 8.3 },
      ],
      blockers: { primary: { label: "alignment_score < 0.75", pct: 100 } },
    },
    step2: {
      outcomes: [
        { state: "HIGH", pct: 0, unreachable: true },
        { state: "MEDIUM", pct: 0, unreachable: true },
        { state: "LOW", pct: 100, default: true },
      ],
      blockers: {
        blockingFrequency: [
          { label: "stack < 0.70", blocks: "HIGH", pct: 100 },
          { label: "stack < 0.40", blocks: "MEDIUM", pct: 100 },
          { label: "alignment < 0.65", blocks: "HIGH", pct: 94.5 },
        ],
      },
    },
    step3: {
      outcomes: [
        { state: "NEUTRAL", pct: 72.7, dominant: true },
        { state: "CONTINUATION", pct: 27.3 },
        { state: "EXHAUSTION", pct: 0, unreachable: true },
      ],
      blockers: {
        primaryBlockers: ["wave3_probability < 0.6", "wave_number ≠ 3"],
      },
    },
  },
  "1D": {
    timeframe: "1D",
    bars: 619,
    dominantAlignment: "WEAK",
    dominantConfidence: "LOW",
    dominantBias: "NEUTRAL",
    step1: {
      outcomes: [
        { state: "STRONG", pct: 12.3 },
        { state: "MODERATE", pct: 17.8 },
        { state: "WEAK", pct: 61.9, dominant: true },
        { state: "DISALIGNED", pct: 8.0 },
      ],
      blockers: { primary: { label: "alignment_score < 0.75", pct: 100 } },
    },
    step2: {
      outcomes: [
        { state: "HIGH", pct: 16.8 },
        { state: "MEDIUM", pct: 2.4 },
        { state: "LOW", pct: 80.8, default: true },
      ],
      blockers: {
        blockingFrequency: [
          { label: "alignment < 0.65", blocks: "HIGH", pct: 98.7 },
          { label: "stack < 0.70", blocks: "HIGH", pct: 97.1 },
          { label: "stack < 0.40", blocks: "MEDIUM", pct: 97.1 },
        ],
      },
    },
    step3: {
      outcomes: [
        { state: "NEUTRAL", pct: 70.3, dominant: true },
        { state: "CONTINUATION", pct: 29.7 },
        { state: "EXHAUSTION", pct: 0, unreachable: true },
      ],
      blockers: {
        primaryBlockers: ["wave3_probability < 0.6", "wave_number ≠ 3"],
      },
    },
  },
  "360": {
    timeframe: "360",
    bars: 716,
    dominantAlignment: "WEAK",
    dominantConfidence: "LOW",
    dominantBias: "NEUTRAL",
    step1: {
      outcomes: [
        { state: "STRONG", pct: 1.2 },
        { state: "MODERATE", pct: 12.8 },
        { state: "WEAK", pct: 71.6, dominant: true },
        { state: "DISALIGNED", pct: 14.4 },
      ],
      blockers: { primary: { label: "alignment_score < 0.75", pct: 100 } },
    },
    step2: {
      outcomes: [
        { state: "HIGH", pct: 2.6 },
        { state: "MEDIUM", pct: 0.9 },
        { state: "LOW", pct: 96.5, default: true },
      ],
      blockers: {
        blockingFrequency: [
          { label: "alignment < 0.65", blocks: "HIGH", pct: 99.2 },
          { label: "stack < 0.70", blocks: "HIGH", pct: 99.1 },
          { label: "stack < 0.40", blocks: "MEDIUM", pct: 99.1 },
        ],
      },
    },
    step3: {
      outcomes: [
        { state: "NEUTRAL", pct: 85.6, dominant: true },
        { state: "CONTINUATION", pct: 14.4 },
        { state: "EXHAUSTION", pct: 0, unreachable: true },
      ],
      blockers: {
        primaryBlockers: ["wave3_probability < 0.6", "wave_number ≠ 3"],
      },
    },
  },
  "90": {
    timeframe: "90",
    bars: 667,
    dominantAlignment: "WEAK",
    dominantConfidence: "LOW",
    dominantBias: "NEUTRAL",
    step1: {
      outcomes: [
        { state: "STRONG", pct: 3.5 },
        { state: "MODERATE", pct: 10.4 },
        { state: "WEAK", pct: 66.7, dominant: true },
        { state: "DISALIGNED", pct: 19.4 },
      ],
      blockers: { primary: { label: "alignment_score < 0.75", pct: 100 } },
    },
    step2: {
      outcomes: [
        { state: "HIGH", pct: 4.1 },
        { state: "MEDIUM", pct: 0, unreachable: true },
        { state: "LOW", pct: 95.9, default: true },
      ],
      blockers: {
        blockingFrequency: [
          { label: "stack < 0.70", blocks: "HIGH", pct: 100 },
          { label: "stack < 0.40", blocks: "MEDIUM", pct: 100 },
          { label: "alignment < 0.65", blocks: "HIGH", pct: 99.6 },
        ],
      },
    },
    step3: {
      outcomes: [
        { state: "NEUTRAL", pct: 82.8, dominant: true },
        { state: "CONTINUATION", pct: 16.9 },
        { state: "EXHAUSTION", pct: 0.3, rareButReachable: true },
      ],
      blockers: {
        primaryBlockers: [
          "wave3_probability < 0.6",
          "wave_number ≠ 3",
          "momentum_strength_score < 0.55",
        ],
      },
    },
  },
  "23": {
    timeframe: "23",
    bars: 776,
    dominantAlignment: "WEAK",
    dominantConfidence: "LOW",
    dominantBias: "NEUTRAL",
    step1: {
      outcomes: [
        { state: "STRONG", pct: 0, unreachable: true },
        { state: "MODERATE", pct: 9.7 },
        { state: "WEAK", pct: 77.6, dominant: true },
        { state: "DISALIGNED", pct: 12.7 },
      ],
      blockers: { primary: { label: "alignment_score < 0.75", pct: 100 } },
    },
    step2: {
      outcomes: [
        { state: "HIGH", pct: 0, unreachable: true },
        { state: "MEDIUM", pct: 0, unreachable: true },
        { state: "LOW", pct: 100, default: true },
      ],
      blockers: {
        blockingFrequency: [
          { label: "stack < 0.70", blocks: "HIGH", pct: 100 },
          { label: "stack < 0.40", blocks: "MEDIUM", pct: 100 },
          { label: "alignment < 0.65", blocks: "HIGH", pct: 99.5 },
        ],
      },
    },
    step3: {
      outcomes: [
        { state: "NEUTRAL", pct: 91.4, dominant: true },
        { state: "CONTINUATION", pct: 8.3 },
        { state: "EXHAUSTION", pct: 0.3, rareButReachable: true },
      ],
      blockers: {
        primaryBlockers: ["wave3_probability < 0.6", "wave_number ≠ 3"],
      },
    },
  },
};

