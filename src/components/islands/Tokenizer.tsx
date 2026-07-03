import { useMemo, useState } from "react";
import { encode as encodeCl100k, decode as decodeCl100k } from "gpt-tokenizer";
import {
  encode as encodeO200k,
  decode as decodeO200k,
} from "gpt-tokenizer/encoding/o200k_base";

/** Live, in-browser tokenizer. No model download — pure JS BPE. */

type Enc = "cl100k" | "o200k";

const ENCODERS: Record<Enc, { label: string; model: string; encode: (s: string) => number[]; decode: (t: number[]) => string }> = {
  cl100k: { label: "GPT-4 · cl100k", model: "~100k vocab", encode: encodeCl100k, decode: decodeCl100k },
  o200k: { label: "GPT-4o · o200k", model: "~200k vocab", encode: encodeO200k, decode: decodeO200k },
};

const PRESETS = [
  "strawberry",
  "ChatGPT is helpful",
  "1234567890",
  "élan café 日本語 🍓",
  "const x = arr.map(n => n * 2);",
];

// Deterministic per-index palette so adjacent token chips are distinguishable.
const CHIP_COLORS = [
  "#2f7ff0",
  "#14b8a6",
  "#f5a623",
  "#ec4899",
  "#8b5cf6",
  "#22c55e",
];

function visibleToken(s: string): string {
  // Make whitespace visible so " Paris" ≠ "Paris" is obvious.
  return s.replace(/ /g, "·").replace(/\n/g, "⏎");
}

export default function Tokenizer() {
  const [text, setText] = useState("strawberry");
  const [enc, setEnc] = useState<Enc>("cl100k");

  const { ids, tokens } = useMemo(() => {
    const { encode, decode } = ENCODERS[enc];
    try {
      const ids = encode(text);
      const tokens = ids.map((id) => decode([id]));
      return { ids, tokens };
    } catch {
      return { ids: [] as number[], tokens: [] as string[] };
    }
  }, [text, enc]);

  return (
    <div className="flex h-full w-full flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex overflow-hidden rounded-lg border border-[var(--color-line)]">
          {(Object.keys(ENCODERS) as Enc[]).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setEnc(k)}
              aria-pressed={enc === k}
              className={
                "px-3 py-1.5 text-xs font-medium transition-colors " +
                (enc === k
                  ? "bg-[var(--color-data-500)] text-white"
                  : "bg-[var(--color-surface-2)] text-[var(--color-muted)] hover:text-[var(--color-fg)]")
              }
            >
              {ENCODERS[k].label}
            </button>
          ))}
        </div>
        <span className="text-xs text-[var(--color-muted)]">{ENCODERS[enc].model}</span>
      </div>

      <label className="sr-only" htmlFor="tok-input">
        Text to tokenize
      </label>
      <textarea
        id="tok-input"
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={2}
        spellCheck={false}
        suppressHydrationWarning
        className="w-full resize-none rounded-lg border border-[var(--color-line)] bg-[var(--color-surface)] p-3 font-mono text-sm text-[var(--color-fg)] focus:border-[var(--color-data-400)]"
        placeholder="Type anything…"
      />

      <div className="flex flex-wrap gap-1.5" aria-hidden="true">
        {tokens.map((t, i) => (
          <span
            key={i}
            title={`token id ${ids[i]}`}
            className="rounded-md px-1.5 py-1 font-mono text-sm text-white/95"
            style={{ backgroundColor: CHIP_COLORS[i % CHIP_COLORS.length] + "cc" }}
          >
            {visibleToken(t)}
          </span>
        ))}
      </div>

      <div className="mt-auto flex flex-wrap items-center justify-between gap-3 border-t border-[var(--color-line)] pt-3">
        <p className="text-sm" aria-live="polite">
          <span className="font-semibold text-[var(--color-data-400)]">{ids.length}</span>{" "}
          <span className="text-[var(--color-muted)]">tokens</span>
          <span className="mx-2 text-[var(--color-line)]">·</span>
          <span className="font-semibold text-[var(--color-fg)]">{[...text].length}</span>{" "}
          <span className="text-[var(--color-muted)]">characters</span>
        </p>
        <div className="flex flex-wrap gap-1.5">
          {PRESETS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setText(p)}
              className="max-w-[10rem] truncate rounded-md border border-[var(--color-line)] bg-[var(--color-surface-2)] px-2 py-1 font-mono text-xs text-[var(--color-muted)] hover:border-[var(--color-data-400)] hover:text-[var(--color-fg)]"
            >
              {p}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
