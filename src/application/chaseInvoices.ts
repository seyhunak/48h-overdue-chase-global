// Application layer — orchestrates domain logic via ports.
import { CREDITS_PER_INVOICE, type Invoice } from "@/domain/invoices";

export type CreditsPort = {
  getBalance(ownerClerkId: string): Promise<number>;
  consume(ownerClerkId: string, amount: number): Promise<void>;
};

export type SubmissionPort = {
  record(entry: {
    ownerClerkId: string;
    clientName: string;
    invoiceId: string;
    amount: number;
    status: string;
    creditsUsed: number;
  }): Promise<void>;
};

export async function chaseInvoices(
  ports: { credits: CreditsPort; submissions: SubmissionPort },
  ownerClerkId: string,
  invoices: Invoice[],
): Promise<{ chased: number; creditsUsed: number }> {
  const needed = invoices.length * CREDITS_PER_INVOICE;
  const balance = await ports.credits.getBalance(ownerClerkId);
  if (balance < needed) throw new Error(`insufficient credits: have ${balance}, need ${needed}`);
  await ports.credits.consume(ownerClerkId, needed);
  for (const inv of invoices) {
    await ports.submissions.record({
      ownerClerkId,
      clientName: inv.clientName,
      invoiceId: inv.invoiceId,
      amount: inv.amount,
      status: "chased",
      creditsUsed: CREDITS_PER_INVOICE,
    });
  }
  return { chased: invoices.length, creditsUsed: needed };
}
