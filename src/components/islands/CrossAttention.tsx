import { useState } from "react";
import data from "../../data/diffusion.json";

/** Cross-attention conditioning: hover/click a prompt word and the image
 *  region it "controls" lights up. Regions are hand-authored (illustrative) —
 *  the teaching point is the mechanism: the image latent supplies Queries, the
 *  text supplies Keys and Values. Same attention math as the LLM track, crossing
 *  from words to pixels. */

const CA = data.crossAttention;
type Region = { type: string; cx?: number; cy?: number; rx?: number; ry?: number; x?: number; y?: number; w?: number; h?: number };
const REGIONS = CA.regions as Record<string, Region>;
const WORD_REGION = new Map(CA.words.map((w) => [w.word, w.region]));

function RegionShape({ region, ...rest }: { region: Region } & Record<string, unknown>) {
  if (region.type === "ellipse") {
    return <ellipse cx={region.cx} cy={region.cy} rx={region.rx} ry={region.ry} {...rest} />;
  }
  return <rect x={region.x} y={region.y} width={region.w} height={region.h} {...rest} />;
}

export default function CrossAttention() {
  const [selected, setSelected] = useState<string | null>("balloon");
  const activeRegion = selected ? REGIONS[WORD_REGION.get(selected) ?? ""] : null;
  const dim = selected ? 0.4 : 1;

  return (
    <div className="flex h-full w-full flex-col gap-3">
      <svg viewBox="0 0 100 100" className="w-full max-h-[52vh] rounded-xl border border-[var(--color-line)]" role="img" aria-label="A generated scene; prompt words highlight the regions they control">
        <defs>
          <linearGradient id="ca-sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#3b4a86" />
            <stop offset="1" stopColor="#e8956b" />
          </linearGradient>
          <linearGradient id="ca-balloon" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#ef5a52" />
            <stop offset="1" stopColor="#b7362f" />
          </linearGradient>
        </defs>

        {/* base scene (dims when a word is selected) */}
        <g style={{ opacity: dim, transition: "opacity 200ms ease" }}>
          <rect x="0" y="0" width="100" height="62" fill="url(#ca-sky)" />
          <circle cx="79" cy="18" r="8" fill="#ffd27a" />
          <path d="M0,74 Q28,60 52,70 T100,68 L100,100 L0,100 Z" fill="#3f8a5a" />
          <path d="M0,84 Q30,72 60,82 T100,80 L100,100 L0,100 Z" fill="#2f6d47" />
          {/* balloon */}
          <ellipse cx="50" cy="33" rx="15" ry="18" fill="url(#ca-balloon)" />
          <path d="M43,20 Q50,50 57,20" stroke="#8f231d" strokeWidth="0.6" fill="none" opacity="0.5" />
          <rect x="47.5" y="50" width="5" height="4" rx="1" fill="#6b4a2a" />
          <line x1="45" y1="47" x2="47.5" y2="50" stroke="#6b4a2a" strokeWidth="0.5" />
          <line x1="55" y1="47" x2="52.5" y2="50" stroke="#6b4a2a" strokeWidth="0.5" />
        </g>

        {/* highlight for the selected word's region */}
        {activeRegion && (
          <RegionShape
            region={activeRegion}
            fill="var(--color-unique-500)"
            fillOpacity="0.28"
            stroke="var(--color-unique-400)"
            strokeWidth="1"
            style={{ transition: "all 200ms ease" }}
          />
        )}
      </svg>

      <div className="flex flex-wrap items-baseline gap-x-1.5 gap-y-1 font-mono text-sm">
        {CA.prompt.split(" ").map((word, i) => {
          const clickable = WORD_REGION.has(word);
          if (!clickable)
            return (
              <span key={i} className="text-[var(--color-muted)]">
                {word}
              </span>
            );
          const isSel = selected === word;
          return (
            <button
              key={i}
              type="button"
              onMouseEnter={() => setSelected(word)}
              onFocus={() => setSelected(word)}
              onClick={() => setSelected(word)}
              aria-pressed={isSel}
              className={
                "rounded px-1 " +
                (isSel
                  ? "bg-[var(--color-unique-500)] text-white"
                  : "text-[var(--color-fg)] underline decoration-dotted underline-offset-2 hover:bg-[var(--color-surface-2)]")
              }
            >
              {word}
            </button>
          );
        })}
      </div>

      <p className="text-xs text-[var(--color-muted)]" aria-live="polite">
        {selected ? (
          <>
            The word <strong className="text-[var(--color-fg)]">{selected}</strong> attends most
            strongly to the highlighted region. The image latent supplies the{" "}
            <strong className="text-[var(--color-fg)]">Queries</strong>; your prompt supplies the{" "}
            <strong className="text-[var(--color-fg)]">Keys and Values</strong> — the same attention
            math as the LLM track, now crossing from words to pixels. (Regions illustrative.)
          </>
        ) : (
          <>Hover a word to see which part of the image it controls.</>
        )}
      </p>
    </div>
  );
}
