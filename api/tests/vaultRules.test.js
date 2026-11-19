import { describe, test, expect } from "@jest/globals";
import {
  checkPayout,
  createChange,
  evaluateChange,
} from "../src/rules/vaultRules.js";

const home = { bank: "GTBank", number: "0123456789", name: "Ada Obi" };
const opay = { bank: "OPay", number: "9876543210", name: "Chidi Unknown" };
const at = (hhmm) => new Date(`2026-11-20T${hhmm}:00+01:00`);
const HOUR = 3600 * 1000;

describe("checkPayout", () => {
  test("home account = YES", () =>
    expect(checkPayout({ homeAccount: home, destination: home })).toMatchObject(
      { verdict: "YES", status: "APPROVED" },
    ));
  test("normalises case and spaces", () =>
    expect(
      checkPayout({
        homeAccount: home,
        destination: { bank: " gtbank ", number: "0123456789 " },
      }).verdict,
    ).toBe("YES"));
  test("other account = NO", () =>
    expect(checkPayout({ homeAccount: home, destination: opay })).toMatchObject(
      { verdict: "NO", status: "BLOCKED" },
    ));
  test("no home account = NO", () =>
    expect(checkPayout({ homeAccount: null, destination: home }).verdict).toBe(
      "NO",
    ));
});

describe("change home account", () => {
  const open = (now) => ({ ...createChange(now), approvals: 0, vetoes: 0 });

  test("2:14 AM attempt is BLOCKED, needs 3 approvals + 24h", () => {
    const c = open(at("02:14"));
    expect(c.requiredApprovals).toBe(3);
    expect(c.eligibleAt.getTime() - at("02:14").getTime()).toBe(24 * HOUR);
    expect(evaluateChange(c, at("02:14"))).toMatchObject({
      status: "BLOCKED",
      reason: "NEED_APPROVALS",
    });
  });
  test("2 approvals = still BLOCKED", () =>
    expect(
      evaluateChange({ ...open(at("10:00")), approvals: 2 }, at("10:00"))
        .reason,
    ).toBe("NEED_APPROVALS"));
  test("3 approvals at 23h = BLOCKED (waiting)", () => {
    const now = new Date(at("10:00").getTime() + 23 * HOUR);
    expect(
      evaluateChange({ ...open(at("10:00")), approvals: 3 }, now),
    ).toMatchObject({ status: "BLOCKED", reason: "WAITING_24H" });
  });
  test("3 approvals at 24h = APPROVED", () => {
    const now = new Date(at("10:00").getTime() + 24 * HOUR);
    expect(
      evaluateChange({ ...open(at("10:00")), approvals: 3 }, now).status,
    ).toBe("APPROVED");
  });
  test("a veto = REJECTED", () =>
    expect(
      evaluateChange(
        { ...open(at("10:00")), approvals: 3, vetoes: 1 },
        at("10:00"),
      ).status,
    ).toBe("REJECTED"));
});
