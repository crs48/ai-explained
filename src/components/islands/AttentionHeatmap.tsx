import { useState } from "react";
import { interpolateRgb } from "d3-interpolate";
import example from "../../data/example.json";

/** Causal self-attention heatmap for a fixed sentence (precomputed values).
 *  Row i = how much token i attends to each earlier token j. Upper triangle is
 *  masked (a token can't attend to the future). */

const { tokens, matrix } = example.attention;
const color = interpolateRgb("#16203a", "#37d9c3");

function tok(t: string) {
  return t.replace(/^ /, "");
}

export default function AttentionHeatmap() {
  const [hover, setHover] = useState<{ i: number; j: number } | null>(null);
  const n = tokens.length;
  const cell = 46;
  const pad = 74; // room for labels
  const size = pad + n * cell + 10;

  const active = hover;
  const caption = active
    ? `"${tok(tokens[active.i])}" attends to "${tok(tokens[active.j])}" with weight ${matrix[active.i][active.j].toFixed(2)}`
    : example.attention.note;

  return (
    <div className="flex h-full w-full flex-col gap-3">
      <svg
        viewBox={`0 0 ${size} ${size}`}
        className="max-h-[60vh] w-full"
        role="img"
        aria-label="Attention heatmap for the sentence 'The capital of France is'"
      >
        <defs>
          <pattern id="mask-hatch" width="6" height="6" patternTransform="rotate(45)" patternUnits="userSpaceOnUse">
            <rect width="6" height="6" fill="#0e1526" />
            <line x1="0" y1="0" x2="0" y2="6" stroke="#1c2742" strokeWidth="2" />
          </pattern>
        </defs>

        {/* column (key) labels */}
        {tokens.map((t, j) => (
          <text
            key={`c${j}`}
            x={pad + j * cell + cell / 2}
            y={pad - 12}
            textAnchor="start"
            transform={`rotate(-45 ${pad + j * cell + cell / 2} ${pad - 12})`}
            className="fill-[var(--color-muted)] font-mono"
            fontSize="12"
          >
            {tok(t)}
          </text>
        ))}

        {/* rows */}
        {matrix.map((row, i) => (
          <g key={`r${i}`}>
            <text
              x={pad - 10}
              y={pad + i * cell + cell / 2 + 4}
              textAnchor="end"
              className="fill-[var(--color-fg)] font-mono"
              fontSize="12"
            >
              {tok(tokens[i])}
            </text>
            {row.map((w, j) => {
              const masked = j > i;
              const isHover = hover?.i === i && hover?.j === j;
              return (
                <rect
                  key={j}
                  x={pad + j * cell}
                  y={pad + i * cell}
                  width={cell - 3}
                  height={cell - 3}
                  rx={4}
                  fill={masked ? "url(#mask-hatch)" : color(w)}
                  stroke={isHover ? "var(--color-fg)" : "transparent"}
                  strokeWidth={2}
                  onMouseEnter={() => !masked && setHover({ i, j })}
                  onMouseLeave={() => setHover(null)}
                  style={{ cursor: masked ? "default" : "pointer" }}
                >
                  {!masked && <title>{`${tok(tokens[i])} → ${tok(tokens[j])}: ${w.toFixed(2)}`}</title>}
                </rect>
              );
            })}
          </g>
        ))}
      </svg>

      <div className="flex items-center gap-3 text-xs text-[var(--color-muted)]">
        <span className="inline-flex items-center gap-1">
          <span className="inline-block h-3 w-3 rounded" style={{ background: color(1) }} /> strong
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="inline-block h-3 w-3 rounded" style={{ background: color(0.1) }} /> weak
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="inline-block h-3 w-3 rounded" style={{ background: "url(#mask-hatch)", backgroundColor: "#0e1526" }} />
          masked (future)
        </span>
      </div>
      <p className="min-h-[2.5rem] text-sm text-[var(--color-fg)]" aria-live="polite">
        {caption}
      </p>
    </div>
  );
}
