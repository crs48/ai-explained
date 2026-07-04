import { useMemo, useState } from "react";
import internals from "../../data/internals.json";
import { mulberry32 } from "../../lib/tinynet";

/** The first circuit a lay reader can verify by eye: an induction head.
 *  Pattern: [A][B] … [A] → attend to [B] (the token AFTER the previous
 *  occurrence of the current token) and predict it next. The heatmap uses the
 *  same rows-attend-to-columns language as the LLM tracks' attention scene.
 *  Curated/illustrative pattern (see internals.json note); the real
 *  characterization is Olsson et al. 2022. */

const { sequences, note } = internals.induction;

function buildPattern(tokens: string[], trained: boolean): number[][] {
  const n = tokens.length;
  const rand = mulberry32(7);
  return Array.from({ length: n }, (_, q) => {
    const row = new Array<number>(n).fill(0);
    if (q === 0) {
      row[0] = 1;
      return row;
    }
    if (!trained) {
      // Untrained head: smeared, mostly-recency attention. (Illustrative.)
      let sum = 0;
      for (let k = 0; k <= q; k++) {
        row[k] = rand() * 0.5 + (k === q - 1 ? 0.5 : 0) + (k === 0 ? 0.2 : 0);
        sum += row[k];
      }
      for (let k = 0; k <= q; k++) row[k] /= sum;
      return row;
    }
    // Trained induction head: find the previous occurrence of this token,
    // attend hard to the token AFTER it.
    let prev = -1;
    for (let k = q - 1; k >= 0; k--) {
      if (tokens[k] === tokens[q]) {
        prev = k;
        break;
      }
    }
    if (prev >= 0 && prev + 1 <= q) {
      const target = prev + 1;
      for (let k = 0; k <= q; k++) row[k] = k === target ? 0.82 : 0.18 / q;
    } else {
      // No repeat yet → mild attention to the start + recency.
      for (let k = 0; k <= q; k++) row[k] = k === 0 ? 0.4 : 0.6 / q;
    }
    return row;
  });
}

export default function InductionHead() {
  const [seqIdx, setSeqIdx] = useState(0);
  const [trained, setTrained] = useState(true);
  const seq = sequences[seqIdx];
  const n = seq.tokens.length;
  const pattern = useMemo(() => buildPattern(seq.tokens, trained), [seq, trained]);

  const CELL = Math.min(26, Math.floor(260 / n));
  const last = n - 1;
  // Where does the last row's induction target sit?
  const lastRowMax = pattern[last].indexOf(Math.max(...pattern[last]));

  return (
    <div className="flex h-full w-full flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="inline-flex overflow-hidden rounded-lg border border-[var(--color-line)] text-xs">
          {sequences.map((s, i) => (
            <button
              key={s.label}
              type="button"
              onClick={() => setSeqIdx(i)}
              aria-pressed={seqIdx === i}
              className={
                "px-2.5 py-1 " +
                (seqIdx === i
                  ? "bg-[var(--color-data-500)] text-white"
                  : "bg-[var(--color-surface-2)] text-[var(--color-muted)] hover:text-[var(--color-fg)]")
              }
            >
              {s.label}
            </button>
          ))}
        </div>
        <label className="flex cursor-pointer items-center gap-1.5 text-xs text-[var(--color-muted)]">
          <input
            type="checkbox"
            checked={trained}
            onChange={(e) => setTrained(e.target.checked)}
            suppressHydrationWarning
            className="accent-[var(--color-unique-500)]"
          />
          induction head trained
        </label>
      </div>

      <div className="flex flex-1 items-start justify-center overflow-x-auto">
        <table className="border-separate" style={{ borderSpacing: 2 }} aria-label="Attention pattern: each row shows where that token looks">
          <thead>
            <tr>
              <th></th>
              {seq.tokens.map((t, j) => (
                <th
                  key={j}
                  className="max-w-8 overflow-hidden pb-1 text-center font-mono text-[9px] font-normal text-[var(--color-muted)]"
                  style={{ width: CELL }}
                >
                  {t.trim() || "·"}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pattern.map((row, q) => (
              <tr key={q}>
                <th className="pr-1.5 text-right font-mono text-[9px] font-normal text-[var(--color-muted)]">
                  {seq.tokens[q].trim() || "·"}
                </th>
                {row.map((v, k) => {
                  const masked = k > q;
                  const isInductionHit = trained && q === last && k === lastRowMax && v > 0.5;
                  return (
                    <td
                      key={k}
                      title={masked ? "future — masked" : `${seq.tokens[q]} → ${seq.tokens[k]}: ${v.toFixed(2)}`}
                      style={{
                        width: CELL,
                        height: CELL,
                        borderRadius: 4,
                        background: masked
                          ? "rgba(42,53,86,0.35)"
                          : `color-mix(in oklab, var(--color-unique-500) ${Math.round(v * 100)}%, var(--color-surface-2))`,
                        outline: isInductionHit ? "2px solid var(--color-shared-400)" : "none",
                      }}
                    />
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div
        className="rounded-lg border border-[var(--color-line)] bg-[var(--color-surface-2)] p-2.5 text-xs text-[var(--color-fg)]"
        aria-live="polite"
      >
        {trained ? (
          <>
            Read the <strong>bottom row</strong>: the current token{" "}
            <code className="text-[var(--color-unique-400)]">{seq.tokens[last].trim()}</code> has
            appeared before — so the head snaps its attention to the token that came{" "}
            <em>right after it last time</em> (teal outline), and the model predicts{" "}
            <code className="text-[var(--color-shared-400)]">{seq.predicted.trim()}</code> next.
            [A][B] … [A] → [B]. That's the whole algorithm.
          </>
        ) : (
          <>
            Untrained: attention smears across recent tokens with no usable structure. Toggle{" "}
            <strong>trained</strong> to watch the algorithm appear — this flip is what emerges
            suddenly early in every LLM's training (the "induction bump").
          </>
        )}
      </div>

      <p className="text-[10px] text-[var(--color-muted)]">{note}</p>
    </div>
  );
}
