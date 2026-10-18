export type EmailMessage = { to: string; subject: string; html: string; text: string };
export interface EmailProvider { readonly name: "resend" | "console"; send(msg: EmailMessage): Promise<{ id: string | null }>; }
