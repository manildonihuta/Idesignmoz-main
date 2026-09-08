import "server-only";

import { sendEmail, emailLayout, type SendEmailInput, type SendEmailResult } from "@/lib/email";

export function isEmailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

export async function send(input: SendEmailInput): Promise<SendEmailResult> {
  return sendEmail(input);
}

export function layout(title: string, body: string): string {
  return emailLayout(title, body);
}