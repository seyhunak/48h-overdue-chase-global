// Domain layer — pure, no framework imports.
export type Invoice = {
  clientName: string;
  invoiceId: string;
  amount: number;
  currency: string;
  dueDate: string;
  daysOverdue: number;
  status: string;
};

export type ChaseStep = {
  key: "pre-due" | "due" | "+7" | "+14" | "+30";
  subject: string;
  body: string;
};

export const CREDITS_PER_INVOICE = 1;
export const PACK_CREDITS = 100;
export const PACK_PRICE_USD = 99;
export const FREE_SIGNUP_CREDITS = 3;

export function validateInvoiceRow(row: Record<string, string>): { invoice?: Invoice; error?: string } {
  const clientName = (row.clientName ?? row.client_name ?? "").trim();
  const invoiceId = (row.invoiceId ?? row.invoice_id ?? "").trim();
  const amount = Number(row.amount);
  const dueDate = (row.dueDate ?? row.due_date ?? "").trim();
  if (!clientName) return { error: "missing clientName" };
  if (!invoiceId) return { error: "missing invoiceId" };
  if (!Number.isFinite(amount) || amount <= 0) return { error: `invalid amount: ${row.amount}` };
  if (!dueDate) return { error: "missing dueDate" };
  const due = new Date(dueDate);
  if (Number.isNaN(due.getTime())) return { error: `invalid dueDate: ${dueDate}` };
  const daysOverdue = Math.max(0, Math.floor((Date.now() - due.getTime()) / 86400000));
  return {
    invoice: {
      clientName,
      invoiceId,
      amount,
      currency: (row.currency ?? "USD").trim() || "USD",
      dueDate,
      daysOverdue,
      status: "overdue",
    },
  };
}

export function buildChaseSequence(inv: Invoice): ChaseStep[] {
  const amt = `${inv.currency} ${inv.amount.toFixed(2)}`;
  return [
    {
      key: "pre-due",
      subject: `Upcoming: invoice ${inv.invoiceId} (${amt}) due ${inv.dueDate}`,
      body: `Hi ${inv.clientName},\n\nQuick heads-up that invoice ${inv.invoiceId} for ${amt} is due ${inv.dueDate}. Let us know if you need anything to clear it on time.\n\nThanks!`,
    },
    {
      key: "due",
      subject: `Due today: invoice ${inv.invoiceId} — ${amt}`,
      body: `Hi ${inv.clientName},\n\nInvoice ${inv.invoiceId} for ${amt} is due today. Payment link/details are on the invoice. Reply if already paid.\n\nThanks!`,
    },
    {
      key: "+7",
      subject: `Overdue 7 days: invoice ${inv.invoiceId} — ${amt}`,
      body: `Hi ${inv.clientName},\n\nInvoice ${inv.invoiceId} (${amt}, due ${inv.dueDate}) is now 7 days overdue. Please confirm payment date this week.\n\nThanks!`,
    },
    {
      key: "+14",
      subject: `Overdue 14 days: invoice ${inv.invoiceId} needs action`,
      body: `Hi ${inv.clientName},\n\nInvoice ${inv.invoiceId} (${amt}) is 14 days overdue. Please pay within 3 business days or propose a date. Late fees may apply per terms.\n\nThanks!`,
    },
    {
      key: "+30",
      subject: `Final notice: invoice ${inv.invoiceId} — 30 days overdue`,
      body: `Hi ${inv.clientName},\n\nInvoice ${inv.invoiceId} (${amt}, due ${inv.dueDate}) is 30 days overdue. This is a final notice before escalation/collections. Pay immediately or contact us today.\n\nThanks!`,
    },
  ];
}

export function parseCsv(text: string): Record<string, string>[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const cells = line.split(",").map((c) => c.trim());
    const row: Record<string, string> = {};
    headers.forEach((h, i) => {
      row[h] = cells[i] ?? "";
    });
    return row;
  });
}
