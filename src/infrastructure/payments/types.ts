export type InitInput = { reference: string; amountMinor: number; currency: string; email: string; callbackUrl: string };
export type InitResult = { authorizationUrl: string; reference: string };
export type VerifyResult = { status: "success" | "failed" | "abandoned" | "pending"; amountMinor: number; currency: string; reference: string; providerTransactionId: string | null; raw: Record<string, unknown> };
export type WebhookEvent = { eventKey: string; type: string; reference: string | null; raw: Record<string, unknown> };

export interface PaymentProvider {
  readonly name: "paystack" | "mock";
  initialize(input: InitInput): Promise<InitResult>;
  /** Server-to-server verification. A browser redirect is NEVER proof of payment. */
  verify(reference: string): Promise<VerifyResult>;
  verifyWebhookSignature(rawBody: string, signature: string | null): Promise<boolean>;
  parseWebhook(rawBody: string): WebhookEvent | null;
}
