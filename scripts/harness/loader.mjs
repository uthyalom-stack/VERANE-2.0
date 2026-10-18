import { existsSync, statSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const tryFile = (p) => { for (const c of [p, p + ".ts", p + ".tsx", path.join(p, "index.ts")]) if (existsSync(c) && statSync(c).isFile()) return pathToFileURL(c).href; return null; };
export async function resolve(spec, ctx, next) {
  if (spec === "vitest") return { url: pathToFileURL(path.join(root, "scripts/harness/vitest-shim.mjs")).href, shortCircuit: true };
  if (spec.startsWith("@/")) { const u = tryFile(path.join(root, "src", spec.slice(2))); if (u) return { url: u, shortCircuit: true }; }
  if ((spec.startsWith("./") || spec.startsWith("../")) && ctx.parentURL?.startsWith("file:")) { const u = tryFile(path.resolve(path.dirname(fileURLToPath(ctx.parentURL)), spec)); if (u) return { url: u, shortCircuit: true }; }
  return next(spec, ctx);
}
