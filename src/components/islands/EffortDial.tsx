import { useEffect, useState } from "react";
import { prefersReducedMotion, onReducedMotionChange } from "../../lib/motion";

type EffortLevel = "minimal" | "low" | "medium" | "high";

interface LevelData {
  key: EffortLevel;
  label: string;
  /** Accuracy on a hard task, %. Rises and saturates. */
  accuracy: number;
  /** Wall-clock latency in seconds. */
  latencySeconds: number;
  /** Relative dollar cost, ×. */
  costMultiplier: number;
  /** Approximate reasoning tokens spent before the answer. */
  reasoningTokens: number;
}

const LEVELS: readonly LevelData[] = [
  { key: "minimal", label: "minimal", accuracy: 58, latencySeconds: 0.4, costMultiplier: 1, reasoningTokens: 50 },
  { key: "low", label: "low", accuracy: 72, latencySeconds: 2, costMultiplier: 4, reasoningTokens: 400 },
  { key: "medium", label: "medium", accuracy: 82, latencySeconds: 8, costMultiplier: 15, reasoningTokens: 2000 },
  { key: "high", label: "high", accuracy: 87, latencySeconds: 30, costMultiplier: 40, reasoningTokens: 8000 },
];

const MAX_INDEX = LEVELS.length - 1;

/** Latency is unbounded-ish; use a log scale to keep the bar readable. */
function latencyFill(seconds: number): number {
  // 0.4s → ~0%, 30s → 100%. log10 domain roughly [-0.4, 1.48].
  const min = Math.log10(0.4);
  const max = Math.log10(30);
  const pct = ((Math.log10(seconds) - min) / (max - min)) * 100;
  return Math.max(0, Math.min(100, pct));
}

/** Cost is a multiplier that grows fast; log scale keeps early levels visible. */
function costFill(mult: number): number {
  const min = Math.log10(1);
  const max = Math.log10(40);
  const pct = ((Math.log10(mult) - min) / (max - min)) * 100;
  return Math.max(0, Math.min(100, pct));
}

/** Reasoning tokens on a log scale, 50 → 8000. */
function tokenFill(tokens: number): number {
  const min = Math.log10(50);
  const max = Math.log10(8000);
  const pct = ((Math.log10(tokens) - min) / (max - min)) * 100;
  return Math.max(0, Math.min(100, pct));
}

function formatLatency(seconds: number): string {
  return seconds < 1 ? `${seconds.toFixed(1)}s` : `${Math.round(seconds)}s`;
}

interface MeterProps {
  label: string;
  valueText: string;
  fillPercent: number;
  color: string;
  animate: boolean;
}

function Meter({ label, valueText, fillPercent, color, animate }: MeterProps) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-baseline justify-between text-xs">
        <span className="font-medium text-[var(--color-fg)]">{label}</span>
        <span className="tabular-nums text-[var(--color-muted)]">{valueText}</span>
      </div>
      <div
        className="h-2.5 w-full overflow-hidden rounded-full"
        style={{ backgroundColor: "var(--color-surface-2)" }}
        role="presentation"
      >
        <div
          className="h-full rounded-full"
          style={{
            width: `${fillPercent}%`,
            backgroundColor: color,
            transition: animate ? "width 400ms cubic-bezier(0.4, 0, 0.2, 1)" : "none",
          }}
        />
      </div>
    </div>
  );
}

export default function EffortDial() {
  const [index, setIndex] = useState<number>(1); // start at "low"
  const [reduced, setReduced] = useState<boolean>(false);
  const [waitNote, setWaitNote] = useState<boolean>(false);

  useEffect(() => {
    setReduced(prefersReducedMotion());
    return onReducedMotionChange(setReduced);
  }, []);

  const level = LEVELS[index];
  const animate = !reduced;

  function selectLevel(nextIndex: number) {
    setWaitNote(false);
    setIndex(nextIndex);
  }

  function forceMoreThinking() {
    setIndex((prev) => {
      const next = Math.min(prev + 1, MAX_INDEX);
      return next;
    });
    setWaitNote(true);
  }

  return (
    <div className="flex h-full w-full flex-col gap-4">
      {/* Segmented effort control */}
      <div className="flex flex-col gap-1.5">
        <span id="effort-label" className="text-xs font-medium text-[var(--color-muted)]">
          Reasoning effort
        </span>
        <div
          role="group"
          aria-labelledby="effort-label"
          className="flex overflow-hidden rounded-lg"
          style={{ border: "1px solid var(--color-line)" }}
        >
          {LEVELS.map((lvl, i) => {
            const active = i === index;
            return (
              <button
                key={lvl.key}
                type="button"
                aria-pressed={active}
                onClick={() => selectLevel(i)}
                className="flex-1 px-2 py-1.5 text-xs font-medium capitalize transition-colors"
                style={{
                  backgroundColor: active ? "var(--color-shared-500)" : "var(--color-surface)",
                  color: active ? "var(--color-surface)" : "var(--color-fg)",
                  borderLeft: i === 0 ? "none" : "1px solid var(--color-line)",
                }}
              >
                {lvl.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Live meters */}
      <div className="flex flex-col gap-3" aria-live="polite">
        <Meter
          label="Accuracy (hard task)"
          valueText={`${level.accuracy}%`}
          fillPercent={level.accuracy}
          color="var(--color-shared-500)"
          animate={animate}
        />
        <Meter
          label="Latency"
          valueText={formatLatency(level.latencySeconds)}
          fillPercent={latencyFill(level.latencySeconds)}
          color="var(--color-data-500)"
          animate={animate}
        />
        <Meter
          label="Cost"
          valueText={`${level.costMultiplier}×`}
          fillPercent={costFill(level.costMultiplier)}
          color="var(--color-weight-500)"
          animate={animate}
        />
      </div>

      {/* Reasoning tokens readout */}
      <div
        className="flex flex-col gap-1.5 rounded-lg p-3"
        style={{ backgroundColor: "var(--color-surface-2)" }}
        aria-live="polite"
      >
        <div className="flex items-baseline justify-between">
          <span className="text-xs font-medium text-[var(--color-muted)]">Reasoning tokens</span>
          <span className="tabular-nums text-sm font-semibold text-[var(--color-fg)]">
            ~{level.reasoningTokens.toLocaleString("en-US")}
          </span>
        </div>
        <div
          className="h-1.5 w-full overflow-hidden rounded-full"
          style={{ backgroundColor: "var(--color-surface)" }}
          role="presentation"
        >
          <div
            className="h-full rounded-full"
            style={{
              width: `${tokenFill(level.reasoningTokens)}%`,
              backgroundColor: "var(--color-unique-500)",
              transition: animate ? "width 400ms cubic-bezier(0.4, 0, 0.2, 1)" : "none",
            }}
          />
        </div>
      </div>

      {/* Budget forcing easter egg */}
      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={forceMoreThinking}
          disabled={index === MAX_INDEX && waitNote}
          className="self-start rounded-md px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50"
          style={{
            border: "1px solid var(--color-unique-400)",
            color: "var(--color-unique-500)",
            backgroundColor: "var(--color-surface)",
          }}
        >
          Force more thinking (append &ldquo;Wait&hellip;&rdquo;)
        </button>
        {waitNote && (
          <p
            className="text-xs leading-relaxed text-[var(--color-muted)]"
            aria-live="polite"
            style={{ color: "var(--color-unique-400)" }}
          >
            Injected &ldquo;Wait&hellip;&rdquo; &mdash; the model reconsiders and catches a mistake.
          </p>
        )}
      </div>

      {/* Factual footer */}
      <p className="mt-auto text-[11px] leading-relaxed text-[var(--color-muted)]">
        OpenAI exposes <code className="text-[var(--color-fg)]">reasoning.effort</code>{" "}
        (minimal/low/medium/high); Anthropic an extended-thinking token budget; Gemini a thinking
        budget. More thinking &rarr; better on hard tasks, but higher latency and cost.
      </p>
    </div>
  );
}
