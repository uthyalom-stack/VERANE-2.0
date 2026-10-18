// Minimal vitest-compatible shim over node:test so DEPENDENCY-FREE unit tests can run without npm install.
// NOT a replacement for vitest: used only for the offline verification pass (see docs/VERIFICATION.md).
import { describe as d, it as i, before, after } from "node:test";
import assert from "node:assert/strict";
const match = (a, e) => Object.entries(e).every(([k, v]) => (v && typeof v === "object" && !Array.isArray(v) && !(v instanceof Date) ? match(a?.[k], v) : (() => { try { assert.deepEqual(a?.[k], v); return true; } catch { return false; } })()));
function mk(actual, neg = false) {
  const ok = (cond, msg) => { if (neg ? cond : !cond) throw new assert.AssertionError({ message: (neg ? "NOT " : "") + msg }); };
  const m = {
    toBe: (e) => ok(Object.is(actual, e), `expected ${String(actual)} toBe ${String(e)}`),
    toEqual: (e) => { let r = true; try { assert.deepEqual(actual, e); } catch { r = false; } ok(r, `expected deep equal ${JSON.stringify(actual)} vs ${JSON.stringify(e)}`); },
    toContain: (e) => ok(actual.includes(e), `expected ${JSON.stringify(actual)} to contain ${e}`),
    toMatchObject: (e) => ok(match(actual, e), `expected ${JSON.stringify(actual)} toMatchObject ${JSON.stringify(e)}`),
    toBeNull: () => ok(actual === null, "expected null"), toBeUndefined: () => ok(actual === undefined, "expected undefined"),
    toBeTruthy: () => ok(!!actual, "expected truthy"), toBeGreaterThan: (n) => ok(actual > n, `expected ${actual} > ${n}`), toBeGreaterThanOrEqual: (n) => ok(actual >= n, `expected ${actual} >= ${n}`),
    toHaveLength: (n) => ok(actual.length === n, `expected length ${n}`),
    toThrow: (re) => { let threw = false, msg = ""; try { actual(); } catch (e) { threw = true; msg = String(e?.message ?? e); } ok(threw && (!re || (re instanceof RegExp ? re.test(msg) : msg.includes(re))), `expected throw ${re ?? ""} (got: ${msg})`); },
  };
  return m;
}
export function expect(actual) {
  const base = mk(actual); base.not = mk(actual, true);
  base.rejects = new Proxy({}, { get: (_, k) => async (...a) => { let err, threw = false; try { await actual; } catch (e) { threw = true; err = e; } if (!threw) throw new assert.AssertionError({ message: "expected promise to reject" }); if (k === "toThrow") return mk(() => { throw err; }).toThrow(...a); return mk(err)[k](...a); } });
  base.resolves = new Proxy({}, { get: (_, k) => async (...a) => mk(await actual)[k](...a) });
  return base;
}
export const describe = d, it = i, beforeAll = before, afterAll = after;
export default { describe, it, expect, beforeAll, afterAll };
