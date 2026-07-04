import { useEffect, useMemo, useState } from "react";
import { onReducedMotionChange, prefersReducedMotion } from "../../lib/motion";

/**
 * Classifier-free guidance (CFG) visualizer.
 *
 * Each denoising step the model predicts noise twice — with and without the
 * prompt — then extrapolates: ε = ε_uncond + w·(ε_cond − ε_uncond). Dragging
 * the guidance scale w stretches the extrapolated arrow past ε_cond.
 */

/** Discrete guidance-scale stops, mirroring how the real explainer precomputes it. */
const STOPS = [0, 1, 7, 20] as const;
type Guidance = (typeof STOPS)[number];

interface Readout {
  /** Short tag shown next to the value. */
  tag: string;
  /** Full aria-live sentence. */
  text: string;
}

const READOUTS: Record<Guidance, Readout> = {
  0: {
    tag: "unconditional",
    text: "Ignores your prompt entirely (unconditional).",
  },
  1: {
    tag: "plain conditional",
    text: "Plain conditional — follows the prompt, softly.",
  },
  7: {
    tag: "sweet spot",
    text: "The usual sweet spot: strong prompt adherence, still natural.",
  },
  20: {
    tag: "over-cooked",
    text: "Over-cooked: rigid adherence, oversaturated, less diverse, artifacts.",
  },
};

/** viewBox geometry for the vector diagram. */
const VB_W = 320;
const VB_H = 220;
/** Common origin of every noise vector. */
const ORIGIN = { x: 46, y: 176 };

/**
 * Unit-ish directions (before scaling) for the two base predictions. Both point
 * up-and-right; ε_cond is aimed slightly higher/steeper so the two arrows
 * visibly diverge and the extrapolation has somewhere to go.
 */
const UNCOND = { x: 150, y: -70 };
const COND = { x: 128, y: -128 };

/** Extrapolated tip position for a given w: origin + uncond + w·(cond − uncond). */
function extrapolate(w: number): { x: number; y: number } {
  return {
    x: ORIGIN.x + UNCOND.x + w * (COND.x - UNCOND.x),
    y: ORIGIN.y + UNCOND.y + w * (COND.y - UNCOND.y),
  };
}

/**
 * At w=20 the raw extrapolation flies far off-canvas, so we visually compress
 * the arrow length with a soft cap while keeping direction exact. Purely a
 * display concern — the labelled math stays literal.
 */
const MAX_LEN = 168;
function clampTip(w: number): { x: number; y: number; capped: boolean } {
  const raw = extrapolate(w);
  const dx = raw.x - ORIGIN.x;
  const dy = raw.y - ORIGIN.y;
  const len = Math.hypot(dx, dy);
  if (len <= MAX_LEN || len === 0) return { ...raw, capped: false };
  const s = MAX_LEN / len;
  return { x: ORIGIN.x + dx * s, y: ORIGIN.y + dy * s, capped: true };
}

/** How saturated / high-contrast the schematic output swatch reads at scale w. */
function swatchLook(w: number): { sat: number; contrast: number } {
  // Normalize across the discrete stops (0 → flat, 20 → blown out).
  const t = Math.min(w / 20, 1);
  return { sat: 30 + t * 130, contrast: 0.15 + t * 0.85 };
}

export default function GuidanceScale() {
  const [wIndex, setWIndex] = useState(2); // default to w=7 (index 2)
  const [reduce, setReduce] = useState(false);

  // Read reduced-motion after mount so SSR and first client render match.
  useEffect(() => {
    setReduce(prefersReducedMotion());
    return onReducedMotionChange(setReduce);
  }, []);

  const w = STOPS[wIndex];
  const readout = READOUTS[w];

  const uncondTip = useMemo(
    () => ({ x: ORIGIN.x + UNCOND.x, y: ORIGIN.y + UNCOND.y }),
    [],
  );
  const condTip = useMemo(
    () => ({ x: ORIGIN.x + COND.x, y: ORIGIN.y + COND.y }),
    [],
  );
  const tip = useMemo(() => clampTip(w), [w]);
  const look = useMemo(() => swatchLook(w), [w]);

  const transition = reduce ? "none" : "all 380ms cubic-bezier(0.22, 1, 0.36, 1)";

  return (
    <div className="flex h-full w-full flex-col gap-4">
      {/* Discrete guidance-scale selector */}
      <div className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between">
          <span className="text-xs font-medium text-[var(--color-muted)]">
            Guidance scale
          </span>
          <span className="font-mono text-sm text-[var(--color-fg)]">
            w = <span className="text-[var(--color-unique-400)]">{w}</span>
            <span className="ml-2 text-[var(--color-muted)]">({readout.tag})</span>
          </span>
        </div>

        <input
          type="range"
          min={0}
          max={STOPS.length - 1}
          step={1}
          value={wIndex}
          suppressHydrationWarning
          onChange={(e) => setWIndex(Number(e.target.value))}
          aria-label="Guidance scale"
          aria-valuetext={`w equals ${w}`}
          className="w-full accent-[var(--color-unique-500)]"
        />

        {/* Discrete tick labels doubling as buttons */}
        <div
          className="flex justify-between"
          role="group"
          aria-label="Guidance scale stops"
        >
          {STOPS.map((s, i) => {
            const active = i === wIndex;
            return (
              <button
                key={s}
                type="button"
                aria-pressed={active}
                suppressHydrationWarning
                onClick={() => setWIndex(i)}
                className="rounded px-2 py-0.5 font-mono text-xs transition-colors"
                style={{
                  color: active ? "var(--color-surface)" : "var(--color-muted)",
                  background: active
                    ? "var(--color-unique-500)"
                    : "transparent",
                }}
              >
                {s}
              </button>
            );
          })}
        </div>
      </div>

      {/* Vector diagram */}
      <div
        className="flex-1 rounded-lg border"
        style={{
          borderColor: "var(--color-line)",
          background: "var(--color-surface)",
        }}
      >
        <svg
          viewBox={`0 0 ${VB_W} ${VB_H}`}
          className="w-full"
          role="img"
          aria-label={`Guidance vector diagram at w equals ${w}. The extrapolated noise arrow ${
            w === 0
              ? "coincides with the unconditional prediction"
              : w === 1
                ? "coincides with the conditional prediction"
                : "extends beyond the conditional prediction"
          }.`}
          style={{ display: "block" }}
        >
          <defs>
            <marker
              id="gs-arrow-muted"
              viewBox="0 0 10 10"
              refX="8"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M0,0 L10,5 L0,10 z" fill="var(--color-muted)" />
            </marker>
            <marker
              id="gs-arrow-cond"
              viewBox="0 0 10 10"
              refX="8"
              refY="5"
              markerWidth="6.5"
              markerHeight="6.5"
              orient="auto-start-reverse"
            >
              <path d="M0,0 L10,5 L0,10 z" fill="var(--color-unique-400)" />
            </marker>
            <marker
              id="gs-arrow-result"
              viewBox="0 0 10 10"
              refX="8"
              refY="5"
              markerWidth="7"
              markerHeight="7"
              orient="auto-start-reverse"
            >
              <path d="M0,0 L10,5 L0,10 z" fill="var(--color-data-400)" />
            </marker>
          </defs>

          {/* Guide line along the extrapolation axis (uncond → cond → beyond) */}
          <line
            x1={uncondTip.x}
            y1={uncondTip.y}
            x2={ORIGIN.x + UNCOND.x + 20 * (COND.x - UNCOND.x)}
            y2={ORIGIN.y + UNCOND.y + 20 * (COND.y - UNCOND.y)}
            stroke="var(--color-line)"
            strokeWidth={1}
            strokeDasharray="2 4"
            opacity={0.6}
          />

          {/* Origin dot */}
          <circle
            cx={ORIGIN.x}
            cy={ORIGIN.y}
            r={3.5}
            fill="var(--color-fg)"
          />

          {/* ε_uncond — unconditional prediction (muted) */}
          <line
            x1={ORIGIN.x}
            y1={ORIGIN.y}
            x2={uncondTip.x}
            y2={uncondTip.y}
            stroke="var(--color-muted)"
            strokeWidth={2}
            markerEnd="url(#gs-arrow-muted)"
          />
          <text
            x={uncondTip.x + 6}
            y={uncondTip.y - 4}
            fontSize={10}
            fill="var(--color-muted)"
            style={{ fontWeight: 600 }}
          >
            ε_uncond
          </text>

          {/* ε_cond — conditional prediction (magenta emphasis) */}
          <line
            x1={ORIGIN.x}
            y1={ORIGIN.y}
            x2={condTip.x}
            y2={condTip.y}
            stroke="var(--color-unique-400)"
            strokeWidth={2}
            markerEnd="url(#gs-arrow-cond)"
          />
          <text
            x={condTip.x - 4}
            y={condTip.y - 8}
            textAnchor="end"
            fontSize={10}
            fill="var(--color-unique-400)"
            style={{ fontWeight: 600 }}
          >
            ε_cond
          </text>

          {/* Extrapolated result ε (bright blue), length animates with w */}
          <line
            x1={ORIGIN.x}
            y1={ORIGIN.y}
            x2={tip.x}
            y2={tip.y}
            stroke="var(--color-data-400)"
            strokeWidth={3}
            markerEnd="url(#gs-arrow-result)"
            style={{ transition }}
          />
          <circle
            cx={tip.x}
            cy={tip.y}
            r={4}
            fill="var(--color-data-500)"
            style={{ transition }}
          />
          <text
            x={tip.x}
            y={tip.y + 18}
            textAnchor="middle"
            fontSize={11}
            fill="var(--color-data-400)"
            style={{ fontWeight: 700, transition }}
          >
            ε (w={w})
          </text>

          {tip.capped ? (
            <text
              x={tip.x}
              y={tip.y + 31}
              textAnchor="middle"
              fontSize={7.5}
              fill="var(--color-muted)"
            >
              (compressed to fit)
            </text>
          ) : null}
        </svg>
      </div>

      {/* Formula */}
      <div
        className="rounded-md border px-3 py-2 text-center"
        style={{
          borderColor: "var(--color-line)",
          background: "var(--color-surface-2)",
        }}
      >
        <p className="font-mono text-sm text-[var(--color-fg)]">
          ε ={" "}
          <span className="text-[var(--color-muted)]">ε_uncond</span> +{" "}
          <span className="text-[var(--color-unique-400)]">w</span> · (
          <span className="text-[var(--color-unique-400)]">ε_cond</span> −{" "}
          <span className="text-[var(--color-muted)]">ε_uncond</span>)
        </p>
      </div>

      {/* Readout + schematic output swatch */}
      <div className="flex items-center gap-3">
        <div
          className="h-14 w-14 shrink-0 rounded-md border"
          role="img"
          aria-label={`Schematic output preview: ${
            w >= 20 ? "oversaturated" : w >= 7 ? "vivid" : "flat"
          }`}
          style={{
            borderColor: "var(--color-line)",
            background: `linear-gradient(135deg, color-mix(in srgb, var(--color-data-500) ${look.sat}%, var(--color-surface)) 0%, color-mix(in srgb, var(--color-unique-500) ${look.sat}%, var(--color-surface)) 100%)`,
            filter: `saturate(${1 + look.contrast * 1.6}) contrast(${1 + look.contrast})`,
            transition,
          }}
        />
        <p
          aria-live="polite"
          className="text-sm leading-snug text-[var(--color-fg)]"
        >
          {readout.text}
        </p>
      </div>

      {/* Caption */}
      <p className="text-[0.7rem] leading-snug text-[var(--color-muted)]">
        Each denoising step the model predicts noise twice — with and without
        your prompt — then extrapolates between them. The guidance scale is how
        hard it leans toward your words.
      </p>
    </div>
  );
}
