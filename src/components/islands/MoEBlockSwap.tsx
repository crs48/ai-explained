import { useEffect, useState } from "react";
import { onReducedMotionChange, prefersReducedMotion } from "../../lib/motion";

/** The MoE track's core: one transformer block, with a Dense ↔ MoE toggle.
 *  Attention stays shared and unchanged; only the FFN forks into a router +
 *  N expert FFNs, of which top-k run per token. */

const N_EXPERTS = 8;
const ACTIVE = [2, 5]; // illustrative top-2 for "this token"
const GATES = [0.7, 0.3];

const EXPERT_COLORS = ["#f5a623", "#e8956b", "#ffcb6b", "#d9a441", "#f0b35e", "#c98d2e", "#ffd27a", "#e3aa50"];

export default function MoEBlockSwap() {
  const [moe, setMoe] = useState(false);
  const [reduce, setReduce] = useState(false);

  useEffect(() => {
    setReduce(prefersReducedMotion());
    return onReducedMotionChange(setReduce);
  }, []);

  const dur = reduce ? "0ms" : "380ms";
  const W = 340;
  const H = 320;

  // expert grid geometry (2 rows × 4)
  const ex = (i: number) => 30 + (i % 4) * 74;
  const ey = (i: number) => (i < 4 ? 178 : 232);

  return (
    <div className="flex h-full w-full flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="inline-flex overflow-hidden rounded-lg border border-[var(--color-line)] text-xs">
          {([false, true] as const).map((m) => (
            <button
              key={String(m)}
              type="button"
              onClick={() => setMoe(m)}
              aria-pressed={moe === m}
              className={
                "px-3 py-1.5 font-medium " +
                (moe === m
                  ? "bg-[var(--color-unique-500)] text-white"
                  : "bg-[var(--color-surface-2)] text-[var(--color-muted)] hover:text-[var(--color-fg)]")
              }
            >
              {m ? "Mixture of Experts" : "Dense"}
            </button>
          ))}
        </div>
        <span className="font-mono text-xs text-[var(--color-muted)]" aria-live="polite">
          {moe ? `capacity ×${N_EXPERTS} · per-token compute ≈ same` : "every token pays for everything"}
        </span>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full flex-1"
        role="img"
        aria-label={moe ? "Transformer block with a router and eight expert FFNs; attention unchanged" : "Transformer block with attention and one dense FFN"}
      >
        {/* block outline */}
        <rect x="10" y="8" width={W - 20} height={H - 16} rx="14" fill="var(--color-surface)" stroke="var(--color-line)" />
        <text x={W / 2} y="30" textAnchor="middle" fontSize="11" className="fill-[var(--color-muted)]">
          one transformer block (of many)
        </text>

        {/* attention — shared, never changes */}
        <rect x="30" y="44" width={W - 60} height="52" rx="10" fill="color-mix(in oklab, var(--color-shared-500) 22%, var(--color-surface))" stroke="var(--color-shared-400)" strokeWidth="1.5" />
        <text x={W / 2} y="66" textAnchor="middle" fontSize="13" fontWeight="600" className="fill-[var(--color-fg)]">
          Self-attention
        </text>
        <text x={W / 2} y="84" textAnchor="middle" fontSize="10" className="fill-[var(--color-shared-400)]">
          SHARED — identical in dense and MoE
        </text>

        {/* token path into the FFN region */}
        <line x1={W / 2} y1="96" x2={W / 2} y2={moe ? 112 : 130} stroke="var(--color-data-400)" strokeWidth="2" style={{ transition: `all ${dur} ease` }} />

        {/* router (MoE only) */}
        <g style={{ opacity: moe ? 1 : 0, transition: `opacity ${dur} ease` }}>
          <rect x={W / 2 - 62} y="114" width="124" height="34" rx="8" fill="color-mix(in oklab, var(--color-unique-500) 20%, var(--color-surface))" stroke="var(--color-unique-400)" strokeWidth="1.5" />
          <text x={W / 2} y="129" textAnchor="middle" fontSize="11" fontWeight="600" className="fill-[var(--color-fg)]">
            Router
          </text>
          <text x={W / 2} y="142" textAnchor="middle" fontSize="9" className="fill-[var(--color-unique-400)]">
            logits → softmax → top-2
          </text>
          {/* routes to the two active experts */}
          {ACTIVE.map((e, i) => (
            <g key={e}>
              <line
                x1={W / 2 + (i === 0 ? -18 : 18)}
                y1="148"
                x2={ex(e) + 32}
                y2={ey(e)}
                stroke="var(--color-unique-400)"
                strokeWidth={1.5 + GATES[i] * 4}
                opacity="0.9"
              />
              <text x={(W / 2 + (i === 0 ? -18 : 18) + ex(e) + 32) / 2 + 8} y={(148 + ey(e)) / 2} fontSize="9" className="fill-[var(--color-unique-400)]" fontWeight="600">
                g={GATES[i]}
              </text>
            </g>
          ))}
        </g>

        {/* dense FFN (dense only) */}
        <g style={{ opacity: moe ? 0 : 1, transition: `opacity ${dur} ease` }}>
          <rect x="30" y="132" width={W - 60} height="140" rx="10" fill="color-mix(in oklab, var(--color-weight-500) 24%, var(--color-surface))" stroke="var(--color-weight-400)" strokeWidth="1.5" />
          <text x={W / 2} y="196" textAnchor="middle" fontSize="13" fontWeight="600" className="fill-[var(--color-fg)]">
            Feed-forward network
          </text>
          <text x={W / 2} y="214" textAnchor="middle" fontSize="10" className="fill-[var(--color-muted)]">
            one big FFN — every token flows through all of it
          </text>
        </g>

        {/* expert grid (MoE only) */}
        <g style={{ opacity: moe ? 1 : 0, transition: `opacity ${dur} ease` }}>
          {Array.from({ length: N_EXPERTS }, (_, i) => {
            const active = ACTIVE.includes(i);
            return (
              <g key={i} opacity={active ? 1 : 0.32}>
                <rect
                  x={ex(i)}
                  y={ey(i)}
                  width="64"
                  height="44"
                  rx="8"
                  fill={active ? EXPERT_COLORS[i] : "var(--color-surface-2)"}
                  stroke={active ? "var(--color-weight-400)" : "var(--color-line)"}
                  strokeWidth={active ? 2 : 1}
                />
                <text x={ex(i) + 32} y={ey(i) + 20} textAnchor="middle" fontSize="10" fontWeight="600" fill={active ? "#1b1405" : "var(--color-muted)"}>
                  Expert {i + 1}
                </text>
                <text x={ex(i) + 32} y={ey(i) + 33} textAnchor="middle" fontSize="8" fill={active ? "#3a2c0a" : "var(--color-line)"}>
                  {active ? "FFN · running" : "FFN · idle"}
                </text>
              </g>
            );
          })}
        </g>

        {/* output line */}
        <line x1={W / 2} y1={moe ? 280 : 274} x2={W / 2} y2="298" stroke="var(--color-data-400)" strokeWidth="2" />
        <text x={W / 2 + 8} y="296" fontSize="9" className="fill-[var(--color-muted)]">
          {moe ? "y = 0.7·E3(x) + 0.3·E6(x)" : "y = FFN(x)"}
        </text>
      </svg>

      <p className="text-xs text-[var(--color-muted)]">
        {moe ? (
          <>
            The <strong className="text-[var(--color-fg)]">only</strong> change: the FFN forked into{" "}
            {N_EXPERTS} experts behind a router; this token runs just 2 of them. Attention is
            untouched. <em>(Which blocks get the MoE swap varies — Mixtral: all; Llama 4:
            alternating; DeepSeek-V3: all but the first three.)</em>
          </>
        ) : (
          <>
            A dense block: attention, then one feed-forward network that{" "}
            <strong className="text-[var(--color-fg)]">every token fully pays for</strong>. Flip the
            toggle to see the one swap MoE makes.
          </>
        )}
      </p>
    </div>
  );
}
