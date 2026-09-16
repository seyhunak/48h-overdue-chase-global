// Infrastructure — Resend email sender (SERVER ONLY).
// Never import this module from client components. Secrets are read ONLY via
// process.env at request runtime; missing keys throw so route handlers can
// respond 503. Nothing here runs at build time.

export class MissingEmailConfigError extends Error {
  readonly status = 503;
  constructor(name: string) {
    super(`Email not configured (missing ${name})`);
    this.name = "MissingEmailConfigError";
  }
}

export type ReminderEmail = {
  to: string;
  subject: string;
  text: string;
};

export async function sendReminderEmail(email: ReminderEmail): Promise<{ id?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new MissingEmailConfigError("RESEND_API_KEY");
  const from = process.env.RESEND_FROM;
  if (!from) throw new MissingEmailConfigError("RESEND_FROM");
  // Lazy import keeps the resend package out of the client bundle and out of
  // build-time evaluation (build must pass with zero env keys).
  const { Resend } = await import("resend");
  const resend = new Resend(apiKey);
  const { data, error } = await resend.emails.send({
    from,
    to: email.to,
    subject: email.subject,
    text: email.text,
  });
  if (error) throw new Error(`resend: ${error.message}`);
  return { id: data?.id };
}
