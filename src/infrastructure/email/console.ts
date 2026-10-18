import type { EmailProvider } from "./types";
/** DEVELOPMENT ONLY: prints the message (incl. links) to the server console. Refused in production. */
export function createConsoleProvider(): EmailProvider & { sent: Array<{ to: string; subject: string; text: string }> } {
  const sent: Array<{ to: string; subject: string; text: string }> = [];
  return { name: "console", sent, async send(m) { sent.push({ to: m.to, subject: m.subject, text: m.text }); console.info(`\n[email:dev] to=${m.to}\nsubject=${m.subject}\n${m.text}\n`); return { id: null }; } };
}
