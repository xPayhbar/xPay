import { describe, it, expect, beforeEach } from "vitest";

const mkSpend = (hbarLimit: number, usdcLimit: number) => {
  let hbar = 0, usdc = 0;
  return {
    record: (a: number, c: string) => { if (c === "HBAR") hbar += a; else usdc += a; },
    check:  (a: number, c: string) => {
      const used  = c === "HBAR" ? hbar  : usdc;
      const limit = c === "HBAR" ? hbarLimit : usdcLimit;
      return used + a > limit;
    },
  };
};
const mkAllow   = (acc: string[]) => ({ check: (id: string) => !acc.map(a => a.toLowerCase()).includes(id.toLowerCase()) });
const mkAnomaly = (known: Record<string, unknown>) => ({
  check: (id: string, amt: number, cur: string) => {
    if (!known[id]) return true;
    if (amt > (cur === "HBAR" ? 10000 : 5000)) return true;
    if (amt >= 1000 && amt % 1000 === 0) return true;
    return false;
  },
});
const mkApproval = (t: number) => ({ check: (a: number, c: string) => c === "HBAR" && a >= t });
const KNOWN = { "0.0.4567890": {}, "0.0.8901234": {}, "0.0.2345679": {}, "0.0.3456789": {} };

describe("SpendLimit", () => {
  let p: ReturnType<typeof mkSpend>;
  beforeEach(() => { p = mkSpend(500, 100); });
  it("passes within cap",      () => expect(p.check(50,  "HBAR")).toBe(false));
  it("blocks when over cap",   () => { p.record(480, "HBAR"); expect(p.check(50, "HBAR")).toBe(true); });
  it("tracks USDC separately", () => { p.record(95,  "USDC"); expect(p.check(10, "USDC")).toBe(true); });
});

describe("Allowlist", () => {
  const p = mkAllow(["0.0.4567890", "0.0.8901234"]);
  it("passes allowlisted account", () => expect(p.check("0.0.4567890")).toBe(false));
  it("blocks unknown account",     () => expect(p.check("0.0.9999999")).toBe(true));
  it("empty list passes all",      () => expect(mkAllow([]).check("0.0.9999")).toBe(false));
});

describe("Anomaly", () => {
  const p = mkAnomaly(KNOWN);
  it("flags unknown recipient",     () => expect(p.check("0.0.9999",    50,    "HBAR")).toBe(true));
  it("passes known normal payment", () => expect(p.check("0.0.4567890", 50,    "HBAR")).toBe(false));
  it("flags huge HBAR payment",     () => expect(p.check("0.0.4567890", 50000, "HBAR")).toBe(true));
  it("flags round amounts",         () => expect(p.check("0.0.4567890", 1000,  "HBAR")).toBe(true));
  it("passes 999 HBAR",             () => expect(p.check("0.0.4567890", 999,   "HBAR")).toBe(false));
});

describe("ApprovalThreshold", () => {
  const p = mkApproval(100);
  it("passes below threshold", () => expect(p.check(50,   "HBAR")).toBe(false));
  it("triggers at threshold",  () => expect(p.check(100,  "HBAR")).toBe(true));
  it("never gates USDC",       () => expect(p.check(9999, "USDC")).toBe(false));
});

describe("Combined", () => {
  it("normal payment clears all policies", () => {
    const sp = mkSpend(500, 100), al = mkAllow(["0.0.4567890"]);
    const an = mkAnomaly(KNOWN),  ap = mkApproval(100);
    expect([al.check("0.0.4567890"), an.check("0.0.4567890", 50, "HBAR"),
            ap.check(50, "HBAR"),    sp.check(50, "HBAR")].every(v => v === false)).toBe(true);
  });
  it("unknown account fails allowlist and anomaly", () => {
    expect(mkAllow(["0.0.4567890"]).check("0.0.9999")).toBe(true);
    expect(mkAnomaly(KNOWN).check("0.0.9999", 50, "HBAR")).toBe(true);
  });
});
