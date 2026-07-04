import { useEffect, useMemo, useState } from "react";
import { onReducedMotionChange, prefersReducedMotion } from "../../lib/motion";

/** The two denoiser architectures used inside diffusion models. */
type DenoiserId = "unet" | "dit";

interface Denoiser {
  id: DenoiserId;
  label: string;
  /** The signature inductive-bias / conditioning phrase. */
  tag: string;
  desc: string;
  /** Which real-world models use this architecture. */
  caption: string;
}

const DENOISERS: readonly Denoiser[] = [
  {
    id: "unet",
    label: "U-Net",
    tag: "ResNet + attention · skip connections",
    desc: "Convolutional encoder–decoder that shrinks the latent down to a bottleneck and mirrors it back up, wiring matching levels together with skip connections.",
    caption:
      "Convolutional encoder–decoder with skip connections. Used by Stable Diffusion 1.x/2.x and SDXL.",
  },
  {
    id: "dit",
    label: "DiT / MMDiT",
    tag: "adaLN timestep conditioning",
    desc: "Patchify the latent into a grid of tokens and run a stack of transformer blocks — the same engine as an LLM.",
    caption:
      "Patchify the latent into tokens and run transformer blocks — the same engine as an LLM. Used by SD3, PixArt, FLUX.",
  },
] as const;

/** viewBox geometry shared by both diagrams. */
const VB_W = 320;
const VB_H = 210;

/**
 * One level of the U-Net encoder/decoder, described by the width/height of its
 * block. The bottleneck is the smallest, shared level.
 */
interface UNetLevel {
  /** 0 = widest (outermost), higher = deeper / smaller. */
  depth: number;
  y: number;
  w: number;
  h: number;
}

const UNET_LEVELS: readonly UNetLevel[] = [
  { depth: 0, y: 24, w: 68, h: 26 },
  { depth: 1, y: 66, w: 52, h: 24 },
  { depth: 2, y: 106, w: 38, h: 22 },
] as const;

/** Horizontal centers of the encoder (left) and decoder (right) columns. */
const ENC_CX = 74;
const DEC_CX = 246;
/** Bottleneck sits centered at the base of the U. */
const BOTTLENECK = { cx: 160, cy: 168, w: 62, h: 24 } as const;

export default function DenoiserToggle() {
  const [active, setActive] = useState<DenoiserId>("unet");
  const [reduced, setReduced] = useState(false);
  /** Bump on each switch to retrigger the enter animation via a fresh key. */
  const [animKey, setAnimKey] = useState(0);

  // Read reduced-motion only after mount to stay SSR-safe.
  useEffect(() => {
    setReduced(prefersReducedMotion());
    return onReducedMotionChange(setReduced);
  }, []);

  const denoiser = useMemo(
    () => DENOISERS.find((d) => d.id === active) ?? DENOISERS[0],
    [active],
  );

  function select(id: DenoiserId): void {
    if (id === active) return;
    setActive(id);
    setAnimKey((k) => k + 1);
  }

  return (
    <div className="flex h-full w-full flex-col gap-4">
      {/* Architecture selector */}
      <div
        className="flex flex-wrap gap-2"
        role="group"
        aria-label="Denoiser architecture"
      >
        {DENOISERS.map((d) => {
          const isActive = d.id === active;
          return (
            <button
              key={d.id}
              type="button"
              aria-pressed={isActive}
              onClick={() => select(d.id)}
              className="rounded-md border px-3 py-1.5 text-sm font-medium transition-colors"
              style={{
                borderColor: isActive
                  ? "var(--color-unique-400)"
                  : "var(--color-line)",
                background: isActive
                  ? "var(--color-unique-500)"
                  : "var(--color-surface-2)",
                color: isActive ? "var(--color-surface)" : "var(--color-fg)",
              }}
            >
              {d.label}
            </button>
          );
        })}
      </div>

      {/* Diagram */}
      <div
        className="flex-1 rounded-lg border"
        style={{
          borderColor: "var(--color-line)",
          background: "var(--color-surface)",
        }}
      >
        <svg
          key={animKey}
          viewBox={`0 0 ${VB_W} ${VB_H}`}
          className="w-full"
          role="img"
          aria-label={`${denoiser.label} denoiser: ${denoiser.desc}`}
          style={{ display: "block" }}
        >
          <defs>
            <marker
              id="dt-arrow"
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
              id="dt-arrow-skip"
              viewBox="0 0 10 10"
              refX="8"
              refY="5"
              markerWidth="6.5"
              markerHeight="6.5"
              orient="auto-start-reverse"
            >
              <path d="M0,0 L10,5 L0,10 z" fill="var(--color-shared-400)" />
            </marker>
          </defs>

          <style>{`
            @keyframes dt-fade-in {
              from { opacity: 0; transform: translateY(6px); }
              to   { opacity: 1; transform: translateY(0); }
            }
            .dt-enter { animation: dt-fade-in 320ms ease-out both; }
          `}</style>

          <g className={reduced ? undefined : "dt-enter"}>
            {active === "unet" ? <UNetDiagram /> : <DitDiagram />}
          </g>
        </svg>
      </div>

      {/* Live description + per-architecture caption */}
      <div aria-live="polite" className="flex flex-col gap-1">
        <p className="text-sm" style={{ color: "var(--color-fg)" }}>
          {denoiser.desc}
        </p>
        <p className="text-xs" style={{ color: "var(--color-muted)" }}>
          Signature:{" "}
          <span style={{ color: "var(--color-unique-400)", fontWeight: 600 }}>
            {denoiser.tag}
          </span>
        </p>
        <p className="text-xs" style={{ color: "var(--color-muted)" }}>
          {denoiser.caption}
        </p>
      </div>

      {/* Shared footer note — true of either architecture */}
      <p
        className="text-[0.7rem] leading-snug"
        style={{ color: "var(--color-muted)" }}
      >
        Either way, the denoiser takes (noisy latent, timestep t, text
        conditioning) and predicts the noise to remove.
      </p>
    </div>
  );
}

/** The classic U shape: encoder ↓, bottleneck, decoder ↑, with skip bridges. */
function UNetDiagram() {
  return (
    <>
      {/* Skip connections drawn first so blocks sit on top. */}
      {UNET_LEVELS.map((lvl) => {
        const encRight = ENC_CX + lvl.w / 2;
        const decLeft = DEC_CX - lvl.w / 2;
        const y = lvl.y + lvl.h / 2;
        const midY = y - 14;
        return (
          <path
            key={`skip${lvl.depth}`}
            d={`M ${encRight} ${y} C ${encRight + 26} ${midY} ${decLeft - 26} ${midY} ${decLeft} ${y}`}
            fill="none"
            stroke="var(--color-shared-400)"
            strokeWidth={1.75}
            strokeDasharray="4 3"
            markerEnd="url(#dt-arrow-skip)"
          />
        );
      })}

      {/* Encoder column: blocks getting smaller, arrows going down. */}
      {UNET_LEVELS.map((lvl, i) => {
        const next = UNET_LEVELS[i + 1];
        return (
          <g key={`enc${lvl.depth}`}>
            <UBlock cx={ENC_CX} y={lvl.y} w={lvl.w} h={lvl.h} label="Res+attn" />
            {next ? (
              <line
                x1={ENC_CX}
                y1={lvl.y + lvl.h + 2}
                x2={ENC_CX}
                y2={next.y - 4}
                stroke="var(--color-muted)"
                strokeWidth={2}
                markerEnd="url(#dt-arrow)"
              />
            ) : (
              <line
                x1={ENC_CX}
                y1={lvl.y + lvl.h + 2}
                x2={BOTTLENECK.cx - BOTTLENECK.w / 2 - 4}
                y2={BOTTLENECK.cy}
                stroke="var(--color-muted)"
                strokeWidth={2}
                markerEnd="url(#dt-arrow)"
              />
            )}
          </g>
        );
      })}

      {/* Bottleneck at the base of the U. */}
      <g>
        <rect
          x={BOTTLENECK.cx - BOTTLENECK.w / 2}
          y={BOTTLENECK.cy - BOTTLENECK.h / 2}
          width={BOTTLENECK.w}
          height={BOTTLENECK.h}
          rx={5}
          fill="var(--color-unique-500)"
          stroke="var(--color-unique-400)"
          strokeWidth={2}
        />
        <text
          x={BOTTLENECK.cx}
          y={BOTTLENECK.cy}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={9}
          fill="var(--color-surface)"
          style={{ pointerEvents: "none", fontWeight: 600 }}
        >
          bottleneck
        </text>
      </g>

      {/* Decoder column: blocks getting bigger, arrows going up. */}
      {UNET_LEVELS.map((lvl, i) => {
        const next = UNET_LEVELS[i + 1];
        return (
          <g key={`dec${lvl.depth}`}>
            <UBlock cx={DEC_CX} y={lvl.y} w={lvl.w} h={lvl.h} label="Res+attn" />
            {next ? (
              <line
                x1={DEC_CX}
                y1={next.y - 4}
                x2={DEC_CX}
                y2={lvl.y + lvl.h + 2}
                stroke="var(--color-muted)"
                strokeWidth={2}
                markerEnd="url(#dt-arrow)"
              />
            ) : (
              <line
                x1={BOTTLENECK.cx + BOTTLENECK.w / 2 + 4}
                y1={BOTTLENECK.cy}
                x2={DEC_CX}
                y2={lvl.y + lvl.h + 2}
                stroke="var(--color-muted)"
                strokeWidth={2}
                markerEnd="url(#dt-arrow)"
              />
            )}
          </g>
        );
      })}

      {/* Column labels */}
      <text
        x={ENC_CX}
        y={14}
        textAnchor="middle"
        fontSize={8}
        fill="var(--color-muted)"
        style={{ fontWeight: 600 }}
      >
        encoder ↓
      </text>
      <text
        x={DEC_CX}
        y={14}
        textAnchor="middle"
        fontSize={8}
        fill="var(--color-muted)"
        style={{ fontWeight: 600 }}
      >
        decoder ↑
      </text>
      <text
        x={160}
        y={200}
        textAnchor="middle"
        fontSize={8}
        fill="var(--color-shared-400)"
        style={{ fontWeight: 600 }}
      >
        skip connections bridge matching levels
      </text>
    </>
  );
}

interface UBlockProps {
  cx: number;
  y: number;
  w: number;
  h: number;
  label: string;
}

/** A single encoder/decoder ResNet+attention block. */
function UBlock({ cx, y, w, h, label }: UBlockProps) {
  return (
    <g>
      <rect
        x={cx - w / 2}
        y={y}
        width={w}
        height={h}
        rx={5}
        fill="var(--color-surface-2)"
        stroke="var(--color-data-400)"
        strokeWidth={1.5}
      />
      <text
        x={cx}
        y={y + h / 2}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={7.5}
        fill="var(--color-fg)"
        style={{ pointerEvents: "none", fontWeight: 600 }}
      >
        {label}
      </text>
    </g>
  );
}

/** Patchify the latent into tokens, then run a stack of transformer blocks. */
function DitDiagram() {
  const grid = 4;
  const patch = 14;
  const gap = 3;
  const gridX = 24;
  const gridY = 40;
  const gridSpan = grid * patch + (grid - 1) * gap;

  // Vertical stack of identical transformer blocks (echoes the LLM track).
  const blockX = 168;
  const blockW = 128;
  const blockH = 26;
  const blockGap = 12;
  const firstBlockY = 30;
  const blockCount = 3;
  const blocks = Array.from({ length: blockCount }, (_, i) => ({
    i,
    y: firstBlockY + i * (blockH + blockGap),
  }));

  return (
    <>
      {/* Latent → patchified grid of tokens */}
      <text
        x={gridX + gridSpan / 2}
        y={30}
        textAnchor="middle"
        fontSize={8}
        fill="var(--color-muted)"
        style={{ fontWeight: 600 }}
      >
        patchify latent
      </text>
      {Array.from({ length: grid * grid }, (_, k) => {
        const row = Math.floor(k / grid);
        const col = k % grid;
        return (
          <rect
            key={`patch${k}`}
            x={gridX + col * (patch + gap)}
            y={gridY + row * (patch + gap)}
            width={patch}
            height={patch}
            rx={3}
            fill="var(--color-data-500)"
            stroke="var(--color-data-400)"
            strokeWidth={1}
          />
        );
      })}
      <text
        x={gridX + gridSpan / 2}
        y={gridY + gridSpan + 14}
        textAnchor="middle"
        fontSize={7.5}
        fill="var(--color-muted)"
      >
        tokens
      </text>

      {/* tokens → transformer stack */}
      <line
        x1={gridX + gridSpan + 6}
        y1={gridY + gridSpan / 2}
        x2={blockX - blockW / 2 - 4}
        y2={firstBlockY + (blocks.length * (blockH + blockGap) - blockGap) / 2}
        stroke="var(--color-muted)"
        strokeWidth={2}
        markerEnd="url(#dt-arrow)"
      />

      {/* Vertical stack of identical transformer blocks */}
      <text
        x={blockX}
        y={20}
        textAnchor="middle"
        fontSize={8}
        fill="var(--color-muted)"
        style={{ fontWeight: 600 }}
      >
        transformer blocks ×N
      </text>
      {blocks.map((b, i) => {
        const next = blocks[i + 1];
        return (
          <g key={`block${b.i}`}>
            <rect
              x={blockX - blockW / 2}
              y={b.y}
              width={blockW}
              height={blockH}
              rx={5}
              fill="var(--color-surface-2)"
              stroke="var(--color-weight-400)"
              strokeWidth={1.5}
            />
            <text
              x={blockX}
              y={b.y + blockH / 2}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize={8}
              fill="var(--color-fg)"
              style={{ pointerEvents: "none", fontWeight: 600 }}
            >
              self-attn + MLP
            </text>
            {next ? (
              <line
                x1={blockX}
                y1={b.y + blockH + 1}
                x2={blockX}
                y2={next.y - 3}
                stroke="var(--color-muted)"
                strokeWidth={2}
                markerEnd="url(#dt-arrow)"
              />
            ) : null}
          </g>
        );
      })}

      {/* adaLN timestep conditioning injected into every block */}
      {blocks.map((b) => (
        <line
          key={`ada${b.i}`}
          x1={blockX + blockW / 2 + 2}
          y1={b.y + blockH / 2}
          x2={blockX + blockW / 2 + 22}
          y2={b.y + blockH / 2}
          stroke="var(--color-weight-500)"
          strokeWidth={1.5}
          markerStart="url(#dt-arrow)"
        />
      ))}
      <text
        x={blockX + blockW / 2 + 24}
        y={firstBlockY + (blockCount * (blockH + blockGap) - blockGap) / 2}
        textAnchor="start"
        dominantBaseline="central"
        fontSize={7.5}
        fill="var(--color-weight-400)"
        style={{ fontWeight: 600 }}
      >
        <tspan x={blockX + blockW / 2 + 24} dy="-0.6em">
          adaLN
        </tspan>
        <tspan x={blockX + blockW / 2 + 24} dy="1.2em">
          timestep
        </tspan>
      </text>
    </>
  );
}
