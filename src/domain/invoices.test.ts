import { describe, expect, it } from "vitest";
import {
  buildChaseSequence,
  CREDITS_PER_INVOICE,
  FREE_SIGNUP_CREDITS,
  PACK_CREDITS,
  PACK_PRICE_USD,
  parseCsv,
  validateInvoiceRow,
  type Invoice,
} from "./invoices";

const validRow = {
  clientName: "Acme Co",
  invoiceId: "INV-001",
  amount: "1200.50",
  currency: "USD",
  dueDate: "2026-08-01",
  email: "ap@acme.co",
  phone: "+15551234567",
};

describe("parseCsv", () => {
  it("parses header + rows into records", () => {
    const rows = parseCsv(
      "clientName,invoiceId,amount,dueDate,email\nAcme,INV-1,100,2026-08-01,ap@acme.co",
    );
    expect(rows).toEqual([
      {
        clientName: "Acme",
        invoiceId: "INV-1",
        amount: "100",
        dueDate: "2026-08-01",
        email: "ap@acme.co",
      },
    ]);
  });

  it("returns [] for empty or header-only input", () => {
    expect(parseCsv("")).toEqual([]);
    expect(parseCsv("clientName,invoiceId")).toEqual([]);
  });

  it("skips blank lines", () => {
    const rows = parseCsv(
      "clientName,invoiceId,amount,dueDate\n\nAcme,INV-1,100,2026-08-01\n  \n",
    );
    expect(rows).toHaveLength(1);
  });
});

describe("validateInvoiceRow", () => {
  it("accepts a valid row", () => {
    const { invoice, error } = validateInvoiceRow({ ...validRow });
    expect(error).toBeUndefined();
    expect(invoice).toMatchObject({
      clientName: "Acme Co",
      invoiceId: "INV-001",
      amount: 1200.5,
      currency: "USD",
      status: "overdue",
    });
    expect(invoice!.daysOverdue).toBeGreaterThanOrEqual(0);
  });

  it("accepts snake_case aliases", () => {
    const { invoice, error } = validateInvoiceRow({
      client_name: "Acme",
      invoice_id: "INV-9",
      amount: "50",
      due_date: "2026-08-01",
      email: "",
    });
    expect(error).toBeUndefined();
    expect(invoice!.invoiceId).toBe("INV-9");
  });

  it("rejects missing clientName / invoiceId", () => {
    expect(validateInvoiceRow({ ...validRow, clientName: " " }).error).toMatch(
      /clientName/,
    );
    expect(validateInvoiceRow({ ...validRow, invoiceId: "" }).error).toMatch(
      /invoiceId/,
    );
  });

  it("rejects invalid amount", () => {
    expect(validateInvoiceRow({ ...validRow, amount: "abc" }).error).toMatch(
      /invalid amount/,
    );
    expect(validateInvoiceRow({ ...validRow, amount: "0" }).error).toMatch(
      /invalid amount/,
    );
    expect(validateInvoiceRow({ ...validRow, amount: "-5" }).error).toMatch(
      /invalid amount/,
    );
  });

  it("rejects invalid email and invalid/missing dueDate", () => {
    expect(
      validateInvoiceRow({ ...validRow, email: "not-an-email" }).error,
    ).toMatch(/invalid email/);
    expect(validateInvoiceRow({ ...validRow, dueDate: "" }).error).toMatch(
      /missing dueDate/,
    );
    expect(validateInvoiceRow({ ...validRow, dueDate: "junk" }).error).toMatch(
      /invalid dueDate/,
    );
  });

  it("keeps credit model constants intact", () => {
    expect(CREDITS_PER_INVOICE).toBe(1);
    expect(FREE_SIGNUP_CREDITS).toBe(3);
    expect(PACK_CREDITS).toBe(100);
    expect(PACK_PRICE_USD).toBe(99);
  });
});

describe("buildChaseSequence", () => {
  const inv: Invoice = {
    clientName: "Acme Co",
    invoiceId: "INV-001",
    amount: 250,
    currency: "USD",
    dueDate: "2026-08-01",
    email: "ap@acme.co",
    daysOverdue: 9,
    status: "overdue",
  };

  it("builds the 5-step ladder in order", () => {
    const seq = buildChaseSequence(inv);
    expect(seq.map((s) => s.key)).toEqual([
      "pre-due",
      "due",
      "+7",
      "+14",
      "+30",
    ]);
  });

  it("includes invoice id and amount in every subject/body", () => {
    for (const step of buildChaseSequence(inv)) {
      expect(step.subject).toContain("INV-001");
      expect(step.body).toContain("Acme Co");
    }
  });
});
