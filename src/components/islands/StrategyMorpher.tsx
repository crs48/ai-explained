import { useEffect, useMemo, useState } from "react";
import { onReducedMotionChange, prefersReducedMotion } from "../../lib/motion";

/** IDs of the four inference-time reasoning strategies, in progression order. */
type StrategyId = "cot" | "self-consistency" | "tree" | "reflection";

interface Strategy {
  id: StrategyId;
  label: string;
  /** The "selection signal" — how a final answer is chosen. */
  signal: string;
  desc: string;
  /** Optional anchor fact shown beneath the description. */
  anchor?: string;
}

const STRATEGIES: readonly Strategy[] = [
  {
    id: "cot",
    label: "Greedy CoT",
    signal: "— (take the one chain)",
    desc: "One chain of thought, top token each step.",
  },
  {
    id: "self-consistency",
    label: "Self-consistency",
    signal: "majority vote",
    desc: "Sample many chains, take the most common answer.",
  },
  {
    id: "tree",
    label: "Tree-of-Thoughts",
    signal: "state evaluator + backtracking",
    desc: "Explore branches, prune dead ends, backtrack.",
    anchor:
      "GPT-4 solved 4% of 'Game of 24' with plain CoT vs 74% with Tree-of-Thoughts.",
  },
  {
    id: "reflection",
    label: "Reflection",
    signal: "self-critique loop",
    desc: "Generate, critique yourself, revise — repeat.",
  },
] as const;

/** viewBox geometry shared by every topology. */
const VB_W = 320;
const VB_H = 200;

interface NodeSpec {
  id: string;
  x: number;
  y: number;
  label: string;
  /** Visual role drives fill/stroke choices. */
  role?: "normal" | "root" | "result" | "pruned" | "final";
}

interface EdgeSpec {
  from: string;
  to: string;
  /** Edge role: solid path, pruned (dashed/grey), backtrack, or loop-back. */
  kind?: "normal" | "pruned" | "backtrack" | "loop";
}

interface Topology {
  nodes: NodeSpec[];
  edges: EdgeSpec[];
}

/** Diameter/radius for the round nodes. */
const R = 15;

function buildTopology(id: StrategyId): Topology {
  switch (id) {
    case "cot": {
      // A single straight line of 4 nodes.
      const ys = VB_H / 2;
      const xs = [40, 133, 227, 300];
      const nodes: NodeSpec[] = xs.map((x, i) => ({
        id: `n${i}`,
        x,
        y: ys,
        label: i === xs.length - 1 ? "ans" : `t${i + 1}`,
        role: i === 0 ? "root" : i === xs.length - 1 ? "result" : "normal",
      }));
      const edges: EdgeSpec[] = nodes
        .slice(0, -1)
        .map((n, i) => ({ from: n.id, to: nodes[i + 1].id }));
      return { nodes, edges };
    }
    case "self-consistency": {
      // Root fans out to 4 parallel chains, converging on one result node.
      const rootX = 30;
      const midX = 150;
      const endX = 250;
      const resultX = 300;
      const laneYs = [40, 90, 120, 170];
      const nodes: NodeSpec[] = [
        { id: "root", x: rootX, y: VB_H / 2, label: "q", role: "root" },
        { id: "res", x: resultX, y: VB_H / 2, label: "vote", role: "result" },
      ];
      const edges: EdgeSpec[] = [];
      laneYs.forEach((y, i) => {
        const a = `m${i}`;
        const b = `e${i}`;
        nodes.push({ id: a, x: midX, y, label: "" });
        nodes.push({ id: b, x: endX, y, label: "" });
        edges.push({ from: "root", to: a });
        edges.push({ from: a, to: b });
        edges.push({ from: b, to: "res" });
      });
      return { nodes, edges };
    }
    case "tree": {
      // root -> 2 children -> each 2 children; two leaves pruned + backtrack.
      const nodes: NodeSpec[] = [
        { id: "r", x: 160, y: 28, label: "root", role: "root" },
        { id: "a", x: 90, y: 100, label: "A", role: "normal" },
        { id: "b", x: 230, y: 100, label: "B", role: "normal" },
        { id: "a1", x: 45, y: 172, label: "", role: "pruned" },
        { id: "a2", x: 118, y: 172, label: "", role: "normal" },
        { id: "b1", x: 200, y: 172, label: "", role: "normal" },
        { id: "b2", x: 275, y: 172, label: "", role: "pruned" },
      ];
      const edges: EdgeSpec[] = [
        { from: "r", to: "a" },
        { from: "r", to: "b" },
        { from: "a", to: "a1", kind: "pruned" },
        { from: "a", to: "a2" },
        { from: "b", to: "b1" },
        { from: "b", to: "b2", kind: "pruned" },
        // backtrack up from the pruned branch A back toward the root.
        { from: "a1", to: "r", kind: "backtrack" },
      ];
      return { nodes, edges };
    }
    case "reflection": {
      // Cycle: generate -> critique -> revise -> (loop back), plus exit -> final.
      const nodes: NodeSpec[] = [
        { id: "gen", x: 70, y: 60, label: "gen", role: "root" },
        { id: "crit", x: 200, y: 60, label: "crit", role: "normal" },
        { id: "rev", x: 135, y: 150, label: "rev", role: "normal" },
        { id: "final", x: 285, y: 150, label: "final", role: "final" },
      ];
      const edges: EdgeSpec[] = [
        { from: "gen", to: "crit" },
        { from: "crit", to: "rev" },
        { from: "rev", to: "gen", kind: "loop" },
        { from: "rev", to: "final" },
      ];
      return { nodes, edges };
    }
  }
}

/**
 * Trim a straight segment between two node centers so the arrow starts/ends on
 * the node's rim rather than its center.
 */
function trimSegment(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  padStart: number,
  padEnd: number,
): { x1: number; y1: number; x2: number; y2: number } {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  return {
    x1: x1 + ux * padStart,
    y1: y1 + uy * padStart,
    x2: x2 - ux * padEnd,
    y2: y2 - uy * padEnd,
  };
}

function nodeFill(role: NodeSpec["role"]): string {
  switch (role) {
    case "root":
      return "var(--color-data-500)";
    case "result":
    case "final":
      return "var(--color-unique-500)";
    case "pruned":
      return "var(--color-surface-2)";
    default:
      return "var(--color-surface-2)";
  }
}

function nodeStroke(role: NodeSpec["role"]): string {
  switch (role) {
    case "root":
      return "var(--color-data-400)";
    case "result":
    case "final":
      return "var(--color-unique-400)";
    case "pruned":
      return "var(--color-line)";
    default:
      return "var(--color-line)";
  }
}

export default function StrategyMorpher() {
  const [active, setActive] = useState<StrategyId>("cot");
  const [reduced, setReduced] = useState(false);
  /** Bump on each switch to retrigger the enter animation via a fresh key. */
  const [animKey, setAnimKey] = useState(0);

  // Read reduced-motion only after mount to stay SSR-safe.
  useEffect(() => {
    setReduced(prefersReducedMotion());
    return onReducedMotionChange(setReduced);
  }, []);

  const strategy = useMemo(
    () => STRATEGIES.find((s) => s.id === active) ?? STRATEGIES[0],
    [active],
  );
  const topology = useMemo(() => buildTopology(active), [active]);
  const nodeById = useMemo(() => {
    const map = new Map<string, NodeSpec>();
    for (const n of topology.nodes) map.set(n.id, n);
    return map;
  }, [topology]);

  function select(id: StrategyId): void {
    if (id === active) return;
    setActive(id);
    setAnimKey((k) => k + 1);
  }

  return (
    <div className="flex h-full w-full flex-col gap-3">
      {/* Strategy selector chips */}
      <div
        className="flex flex-wrap gap-2"
        role="group"
        aria-label="Reasoning strategy"
      >
        {STRATEGIES.map((s) => {
          const isActive = s.id === active;
          return (
            <button
              key={s.id}
              type="button"
              aria-pressed={isActive}
              onClick={() => select(s.id)}
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
              {s.label}
            </button>
          );
        })}
      </div>

      {/* Topology diagram */}
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
          aria-label={`${strategy.label} topology: ${strategy.desc}`}
          style={{ display: "block" }}
        >
          <defs>
            <marker
              id="sm-arrow"
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
              id="sm-arrow-accent"
              viewBox="0 0 10 10"
              refX="8"
              refY="5"
              markerWidth="6.5"
              markerHeight="6.5"
              orient="auto-start-reverse"
            >
              <path d="M0,0 L10,5 L0,10 z" fill="var(--color-unique-400)" />
            </marker>
          </defs>

          <style>{`
            @keyframes sm-fade-in {
              from { opacity: 0; transform: translateY(6px); }
              to   { opacity: 1; transform: translateY(0); }
            }
            .sm-enter { animation: sm-fade-in 320ms ease-out both; }
          `}</style>

          <g className={reduced ? undefined : "sm-enter"}>
            {/* Edges first so nodes render on top */}
            {topology.edges.map((e, i) => {
              const a = nodeById.get(e.from);
              const b = nodeById.get(e.to);
              if (!a || !b) return null;
              const kind = e.kind ?? "normal";

              if (kind === "loop") {
                // Curved loop-back arrow between two nodes.
                const mx = (a.x + b.x) / 2;
                const my = (a.y + b.y) / 2;
                const cx = mx - 55;
                const cy = my + 10;
                return (
                  <path
                    key={`e${i}`}
                    d={`M ${a.x} ${a.y} Q ${cx} ${cy} ${b.x} ${b.y}`}
                    fill="none"
                    stroke="var(--color-unique-400)"
                    strokeWidth={2}
                    strokeDasharray="5 3"
                    markerEnd="url(#sm-arrow-accent)"
                  />
                );
              }

              const seg = trimSegment(a.x, a.y, b.x, b.y, R + 2, R + 4);

              if (kind === "backtrack") {
                // Dashed accent curve arcing back up to the root.
                const cx = (seg.x1 + seg.x2) / 2 - 48;
                const cy = (seg.y1 + seg.y2) / 2;
                return (
                  <path
                    key={`e${i}`}
                    d={`M ${seg.x1} ${seg.y1} Q ${cx} ${cy} ${seg.x2} ${seg.y2}`}
                    fill="none"
                    stroke="var(--color-unique-400)"
                    strokeWidth={1.75}
                    strokeDasharray="4 3"
                    markerEnd="url(#sm-arrow-accent)"
                  />
                );
              }

              const pruned = kind === "pruned";
              return (
                <line
                  key={`e${i}`}
                  x1={seg.x1}
                  y1={seg.y1}
                  x2={seg.x2}
                  y2={seg.y2}
                  stroke={pruned ? "var(--color-line)" : "var(--color-muted)"}
                  strokeWidth={pruned ? 1.5 : 2}
                  strokeDasharray={pruned ? "4 4" : undefined}
                  opacity={pruned ? 0.55 : 1}
                  markerEnd={pruned ? undefined : "url(#sm-arrow)"}
                />
              );
            })}

            {/* Nodes */}
            {topology.nodes.map((n) => {
              const pruned = n.role === "pruned";
              return (
                <g key={n.id} opacity={pruned ? 0.5 : 1}>
                  <circle
                    cx={n.x}
                    cy={n.y}
                    r={R}
                    fill={nodeFill(n.role)}
                    stroke={nodeStroke(n.role)}
                    strokeWidth={n.role === "root" || n.role === "result" || n.role === "final" ? 2 : 1.5}
                    strokeDasharray={pruned ? "3 3" : undefined}
                  />
                  {n.label ? (
                    <text
                      x={n.x}
                      y={n.y}
                      textAnchor="middle"
                      dominantBaseline="central"
                      fontSize={9}
                      fill={
                        n.role === "root" ||
                        n.role === "result" ||
                        n.role === "final"
                          ? "var(--color-surface)"
                          : "var(--color-fg)"
                      }
                      style={{ pointerEvents: "none", fontWeight: 600 }}
                    >
                      {n.label}
                    </text>
                  ) : null}
                </g>
              );
            })}

            {/* "backtrack" annotation for the tree topology */}
            {active === "tree" ? (
              <text
                x={70}
                y={130}
                fontSize={8}
                fill="var(--color-unique-400)"
                style={{ fontWeight: 600 }}
              >
                backtrack
              </text>
            ) : null}
            {active === "tree" ? (
              <text
                x={250}
                y={195}
                textAnchor="middle"
                fontSize={8}
                fill="var(--color-muted)"
              >
                pruned
              </text>
            ) : null}
          </g>
        </svg>
      </div>

      {/* Description + selection signal (announced on change) */}
      <div aria-live="polite" className="flex flex-col gap-1">
        <p className="text-sm" style={{ color: "var(--color-fg)" }}>
          {strategy.desc}
        </p>
        <p className="text-xs" style={{ color: "var(--color-muted)" }}>
          Selection signal:{" "}
          <span style={{ color: "var(--color-unique-400)", fontWeight: 600 }}>
            {strategy.signal}
          </span>
        </p>
        {strategy.anchor ? (
          <p
            className="text-xs italic"
            style={{ color: "var(--color-unique-400)" }}
          >
            {strategy.anchor}
          </p>
        ) : null}
      </div>

      {/* Footer note */}
      <p
        className="text-[0.7rem] leading-snug"
        style={{ color: "var(--color-muted)" }}
      >
        Compute-optimal: revise on easy problems, search wider on hard ones
        (Snell et al., 2024).
      </p>
    </div>
  );
}
