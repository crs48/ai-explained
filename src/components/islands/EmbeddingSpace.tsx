import { useMemo, useState } from "react";
import example from "../../data/example.json";

/** 2-D projection of word vectors. Click a word to see nearest neighbors; toggle
 *  the king − man + woman ≈ queen analogy. Coordinates are illustrative. */

const WORDS = example.embedding.words;
const ANALOGY = example.embedding.analogy;

const GROUP_COLOR: Record<string, string> = {
  royalty: "#ec4899",
  animal: "#f5a623",
  country: "#14b8a6",
  city: "#5aa9ff",
  tech: "#8b5cf6",
  food: "#22c55e",
};

const V = 100; // viewBox units
const M = 8; // margin
const map = (v: number) => M + v * (V - 2 * M);

function find(word: string) {
  return WORDS.find((w) => w.word === word)!;
}

function nearest(word: string, k = 3) {
  const self = find(word);
  return WORDS.filter((w) => w.word !== word)
    .map((w) => ({ w, d: Math.hypot(w.x - self.x, w.y - self.y) }))
    .sort((a, b) => a.d - b.d)
    .slice(0, k)
    .map((x) => x.w.word);
}

export default function EmbeddingSpace() {
  const [selected, setSelected] = useState<string | null>("king");
  const [analogy, setAnalogy] = useState(false);

  const neighbors = useMemo(
    () => (selected ? new Set(nearest(selected)) : new Set<string>()),
    [selected],
  );

  const predicted = useMemo(() => {
    const a = find(ANALOGY.a);
    const m = find(ANALOGY.minus);
    const p = find(ANALOGY.plus);
    return { x: a.x - m.x + p.x, y: a.y - m.y + p.y };
  }, []);

  return (
    <div className="flex h-full w-full flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <button
          type="button"
          onClick={() => setAnalogy((v) => !v)}
          aria-pressed={analogy}
          className={
            "rounded-md px-2.5 py-1 font-medium " +
            (analogy
              ? "bg-[var(--color-unique-500)] text-white"
              : "border border-[var(--color-line)] text-[var(--color-muted)] hover:text-[var(--color-fg)]")
          }
        >
          king − man + woman ≈ queen
        </button>
        {Object.entries(GROUP_COLOR).map(([g, c]) => (
          <span key={g} className="inline-flex items-center gap-1 text-[var(--color-muted)]">
            <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: c }} />
            {g}
          </span>
        ))}
      </div>

      <svg viewBox={`0 0 ${V} ${V}`} className="max-h-[56vh] w-full" role="img" aria-label="Word embedding space">
        <defs>
          <marker id="arrow" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
            <path d="M0,0 L6,3 L0,6 Z" fill="var(--color-unique-400)" />
          </marker>
        </defs>

        {/* neighbor links */}
        {selected &&
          !analogy &&
          [...neighbors].map((nb) => {
            const s = find(selected);
            const t = find(nb);
            return (
              <line
                key={nb}
                x1={map(s.x)}
                y1={map(s.y)}
                x2={map(t.x)}
                y2={map(t.y)}
                stroke="var(--color-data-400)"
                strokeWidth={0.4}
                strokeDasharray="1 1"
                opacity={0.7}
              />
            );
          })}

        {/* analogy vectors */}
        {analogy && (
          <g>
            {(() => {
              const a = find(ANALOGY.a);
              const m = find(ANALOGY.minus);
              const p = find(ANALOGY.plus);
              return (
                <>
                  <line x1={map(m.x)} y1={map(m.y)} x2={map(a.x)} y2={map(a.y)} stroke="var(--color-unique-400)" strokeWidth={0.6} markerEnd="url(#arrow)" />
                  <line x1={map(p.x)} y1={map(p.y)} x2={map(predicted.x)} y2={map(predicted.y)} stroke="var(--color-unique-400)" strokeWidth={0.6} markerEnd="url(#arrow)" />
                  <circle cx={map(predicted.x)} cy={map(predicted.y)} r={3.2} fill="none" stroke="var(--color-unique-400)" strokeWidth={0.8} />
                </>
              );
            })()}
          </g>
        )}

        {/* points */}
        {WORDS.map((w) => {
          const isSel = selected === w.word;
          const isNb = neighbors.has(w.word) && !analogy;
          const dim = selected && !isSel && !isNb && !analogy;
          return (
            <g
              key={w.word}
              onClick={() => setSelected(w.word)}
              style={{ cursor: "pointer" }}
              opacity={dim ? 0.35 : 1}
            >
              <circle cx={map(w.x)} cy={map(w.y)} r={isSel ? 2.4 : 1.7} fill={GROUP_COLOR[w.group]} stroke={isSel ? "white" : "none"} strokeWidth={0.5} />
              <text x={map(w.x) + 2.6} y={map(w.y) + 1.4} fontSize={isSel || isNb ? 3 : 2.6} className={isSel ? "fill-[var(--color-fg)]" : "fill-[var(--color-muted)]"}>
                {w.word}
              </text>
            </g>
          );
        })}
      </svg>

      <p className="min-h-[2.5rem] text-sm" aria-live="polite">
        {analogy ? (
          <span className="text-[var(--color-fg)]">
            <span className="font-mono">king − man + woman</span> lands right on{" "}
            <span className="font-semibold text-[var(--color-unique-400)]">queen</span>. (A hand-picked
            example — the real story is messier.)
          </span>
        ) : selected ? (
          <span className="text-[var(--color-muted)]">
            Nearest to <span className="font-semibold text-[var(--color-fg)]">{selected}</span>:{" "}
            {[...neighbors].join(", ")}
          </span>
        ) : (
          <span className="text-[var(--color-muted)]">Click a word to see its nearest neighbors.</span>
        )}
      </p>
    </div>
  );
}
