import { describe, expect, it } from "vitest";
import {
  decideSweepAction,
  ESCALATE_SMS_AMOUNT_USD,
  isWeekendUtc,
  MAX_ATTEMPTS_BEFORE_PAUSE,
  phoneLike,
  type SweepDecisionInput,
} from "./sweepDecide";

// Monday 2026-09-14 12:00 UTC (weekday) and Saturday 2026-09-12 12:00 UTC.
const MONDAY = Date.UTC(2026, 8, 14, 12, 0, 0);
const SATURDAY = Date.UTC(2026, 8, 12, 12, 0, 0);

function base(overrides: Partial<SweepDecisionInput> = {}): SweepDecisionInput {
  return {
    stepKey: "due",
    amount: 500,
    currency: "USD",
    email: "ap@acme.co",
    phone: "+15551234567",
    touches: 0,
    emailQueued: false,
    smsQueued: false,
    pastReminders: [],
    nowMs: MONDAY,
    ...overrides,
  };
}

describe("phoneLike", () => {
  it("accepts E.164 numbers", () => {
    expect(phoneLike("+15551234567")).toBe(true);
    expect(phoneLike("15551234567")).toBe(true);
  });

  it("rejects junk", () => {
    expect(phoneLike("")).toBe(false);
    expect(phoneLike("123")).toBe(false);
    expect(phoneLike("not-a-phone")).toBe(false);
  });
});

describe("isWeekendUtc", () => {
  it("detects Saturday/Sunday", () => {
    expect(isWeekendUtc(SATURDAY)).toBe(true);
    expect(isWeekendUtc(Date.UTC(2026, 8, 13, 12))).toBe(true); // Sunday
    expect(isWeekendUtc(MONDAY)).toBe(false);
  });
});

describe("decideSweepAction guards", () => {
  it("does nothing with no ladder step", () => {
    expect(decideSweepAction(base({ stepKey: null })).reason).toMatch(
      /no ladder step/,
    );
  });

  it("skips paid and unsubscribed invoices", () => {
    expect(decideSweepAction(base({ paid: true })).reason).toMatch(/paid/);
    expect(decideSweepAction(base({ unsubscribed: true })).reason).toMatch(
      /unsubscribed/,
    );
  });

  it("stops after max touches", () => {
    const d = decideSweepAction(base({ touches: 5 }));
    expect(d.action).toBe("none");
    expect(d.reason).toMatch(/max touches/);
  });

  it("pauses when already touched today (UTC)", () => {
    const d = decideSweepAction(base({ lastTouchAt: MONDAY }));
    expect(d.action).toBe("none");
    expect(d.reason).toMatch(/already touched today/);
  });

  it("resumes when last touch was yesterday", () => {
    const d = decideSweepAction(
      base({ lastTouchAt: MONDAY - 24 * 3600 * 1000 }),
    );
    expect(d.action).toBe("queue");
  });
});

describe("decideSweepAction dedupe + health", () => {
  it("skips duplicate email already queued", () => {
    const d = decideSweepAction(base({ emailQueued: true }));
    expect(d).toMatchObject({ action: "none", channel: "none" });
    expect(d.reason).toMatch(/already queued/);
  });

  it("pauses on 401 / invalid-key failure", () => {
    const d = decideSweepAction(
      base({
        pastReminders: [
          { stepKey: "due", status: "failed", lastError: "401 Unauthorized" },
        ],
      }),
    );
    expect(d.action).toBe("none");
    expect(d.reason).toMatch(/401/);
  });

  it(`pauses after ${MAX_ATTEMPTS_BEFORE_PAUSE} failed attempts`, () => {
    const d = decideSweepAction(
      base({
        pastReminders: [
          {
            stepKey: "due",
            status: "failed",
            attempts: MAX_ATTEMPTS_BEFORE_PAUSE,
            lastError: "timeout",
          },
        ],
      }),
    );
    expect(d.reason).toMatch(/failed send attempts/);
  });

  it("keeps escalation constants intact", () => {
    expect(ESCALATE_SMS_AMOUNT_USD).toBe(2500);
    expect(MAX_ATTEMPTS_BEFORE_PAUSE).toBe(3);
  });
});

describe("decideSweepAction channel selection", () => {
  it("queues the default email ladder step on a weekday", () => {
    const d = decideSweepAction(base());
    expect(d).toMatchObject({
      action: "queue",
      channel: "email",
    });
  });

  it("defers gentle steps on weekends", () => {
    const d = decideSweepAction(base({ stepKey: "pre-due", nowMs: SATURDAY }));
    expect(d.action).toBe("none");
    expect(d.reason).toMatch(/Saturday/);
  });

  it("does NOT defer escalations on weekends", () => {
    const d = decideSweepAction(base({ stepKey: "+14", nowMs: SATURDAY }));
    expect(d.action).toBe("queue");
  });

  it("escalates high-value invoices to SMS after email was sent", () => {
    const d = decideSweepAction(
      base({
        stepKey: "+14",
        amount: 3000,
        pastReminders: [
          { stepKey: "+14", status: "sent", channel: "email" },
        ],
      }),
    );
    expect(d).toMatchObject({ action: "queue", channel: "sms" });
    expect(d.reason).toMatch(/SMS escalation/);
  });

  it("skips SMS escalation below the threshold", () => {
    const d = decideSweepAction(
      base({
        stepKey: "+14",
        amount: 100,
        pastReminders: [
          { stepKey: "+14", status: "sent", channel: "email" },
        ],
      }),
    );
    expect(d.channel).toBe("email");
  });

  it("skips duplicate SMS already queued", () => {
    const d = decideSweepAction(
      base({
        stepKey: "+14",
        amount: 3000,
        smsQueued: true,
        pastReminders: [
          { stepKey: "+14", status: "sent", channel: "email" },
        ],
      }),
    );
    expect(d.action).toBe("none");
    expect(d.reason).toMatch(/SMS already queued/);
  });

  it("does nothing with no recipient email", () => {
    const d = decideSweepAction(base({ email: "" }));
    expect(d.action).toBe("none");
    expect(d.reason).toMatch(/no recipient email/);
  });
});
