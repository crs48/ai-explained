/** Quick convergence checks for src/lib/tinynet.ts (run: npm run test:tinynet).
 *  Not a test framework — a script that exits 1 if the numerics regress.
 *  Requires Node >= 23.6 (native TypeScript type stripping). */
import {
  BOWL_DATA,
  accuracy,
  bowlGrad,
  bowlLoss,
  createNet,
  forward,
  makeDataset,
  netLoss,
  sgdStep,
} from "../src/lib/tinynet.ts";

let failures = 0;
function check(name, ok, detail = "") {
  console.log(`${ok ? "✅" : "❌"} ${name}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures++;
}

// 1. Determinism: same seed → identical nets and datasets.
{
  const a = createNet([2, 8, 8, 1], 42);
  const b = createNet([2, 8, 8, 1], 42);
  const same =
    a.w.every((l, i) => l.every((v, j) => v === b.w[i][j])) &&
    makeDataset("spiral", 200, 0.05, 7)[13].x === makeDataset("spiral", 200, 0.05, 7)[13].x;
  check("seeded init + datasets are deterministic", same);
}

// 2. Gradient check: sgdStep's backward pass vs finite differences.
{
  const net = createNet([2, 3, 1], 1);
  const pts = makeDataset("xor", 16, 0, 2);
  const h = 1e-4;
  const l = 0;
  const idx = 2;
  const base = net.w[l][idx];
  net.w[l][idx] = base + h;
  const up = netLoss(net, pts);
  net.w[l][idx] = base - h;
  const down = netLoss(net, pts);
  net.w[l][idx] = base;
  const numeric = (up - down) / (2 * h);
  // Recover the analytic grad from the weight delta applied by one step.
  const before = net.w[l][idx];
  sgdStep(net, pts, 0.5, 1e9);
  const analytic = (before - net.w[l][idx]) / 0.5;
  const relErr = Math.abs(numeric - analytic) / Math.max(1e-8, Math.abs(numeric));
  check("backprop matches finite differences", relErr < 1e-2, `rel err ${relErr.toExponential(2)}`);
}

// 3. Convergence: every dataset trains to high accuracy, no NaNs.
for (const [key, epochs, target] of [
  ["xor", 300, 0.95],
  ["circle", 300, 0.95],
  ["spiral", 3000, 0.9],
]) {
  const pts = makeDataset(key, 300, 0.04, 11);
  const net = createNet([2, 8, 8, 1], 42);
  let loss = Infinity;
  const t0 = performance.now();
  for (let e = 0; e < epochs; e++) loss = sgdStep(net, pts, key === "spiral" ? 0.6 : 0.4);
  const ms = performance.now() - t0;
  const acc = accuracy(net, pts);
  check(
    `${key} converges (${epochs} epochs)`,
    Number.isFinite(loss) && acc >= target,
    `acc ${(acc * 100).toFixed(1)}% · loss ${loss.toFixed(3)} · ${ms.toFixed(0)}ms`,
  );
}

// 4. Stability at the UI's max learning rate: ugly is fine, NaN is not.
{
  const pts = makeDataset("circle", 300, 0.1, 3);
  const net = createNet([2, 8, 8, 1], 5);
  let loss = 0;
  for (let e = 0; e < 500; e++) loss = sgdStep(net, pts, 3);
  const finite = Number.isFinite(loss) && net.w.every((l) => l.every(Number.isFinite));
  check("no NaNs at lr=3 (UI max is lower)", finite, `loss ${loss.toFixed(3)}`);
}

// 5. The bowl: analytic gradient matches finite differences; descent descends.
{
  const h = 1e-5;
  const [dw, db] = bowlGrad(1.2, -0.7);
  const ndw = (bowlLoss(1.2 + h, -0.7) - bowlLoss(1.2 - h, -0.7)) / (2 * h);
  const ndb = (bowlLoss(1.2, -0.7 + h) - bowlLoss(1.2, -0.7 - h)) / (2 * h);
  const gradOk = Math.abs(dw - ndw) < 1e-4 && Math.abs(db - ndb) < 1e-4;
  check("bowlGrad matches finite differences", gradOk);

  let w = -3.5;
  let b = 3.5;
  for (let i = 0; i < 400; i++) {
    const [gw, gb] = bowlGrad(w, b);
    w -= 1.5 * gw;
    b -= 1.5 * gb;
  }
  const final = bowlLoss(w, b);
  check("bowl descent converges from a far corner", final < 0.3, `loss ${final.toFixed(3)}`);
  check("bowl minimum is finite (overlap point works)", BOWL_DATA.some((d) => d.y === 1 && d.x < 0.3));
}

// 6. Forward exposes per-neuron activations for the heatmap thumbnails.
{
  const net = createNet([2, 4, 1], 9);
  const acts = [];
  forward(net, 0.3, -0.2, acts);
  check(
    "forward() records activations per layer",
    acts.length === 3 && acts[1].length === 4 && acts[2].length === 1,
  );
}

console.log(failures ? `\n${failures} check(s) failed` : "\nall tinynet checks passed");
process.exit(failures ? 1 : 0);
