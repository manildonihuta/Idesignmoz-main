import "server-only";

import { Resend } from "resend";

export type SendEmailInput = {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  from?: string;
};

export type SendEmailResult =
  | { ok: true; id?: string }
  | { ok: false; reason: string };

export async function sendEmail({
  to,
  subject,
  html,
  text,
  from,
}: SendEmailInput): Promise<SendEmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return { ok: false, reason: "RESEND_API_KEY não definida" };
  }
  const resend = new Resend(apiKey);
  const { data, error } = await resend.emails.send({
    from: from ?? process.env.EMAIL_FROM ?? "IDesign Moz <no-reply@idesignmoz.com>",
    to,
    subject,
    ...(html ? { html } : {}),
    text: text ?? subject,
  });
  if (error) {
    return { ok: false, reason: String(error) };
  }
  return { ok: true, id: data?.id };
}

export function emailLayout(title: string, body: string): string {
  return `<div style="font-family:system-ui,-apple-system,sans-serif;background:#ffffff;color:#111;margin:0;padding:40px 20px">
  <div style="max-width:520px;margin:0 auto">
    <h2 style="font-size:20px;margin:0 0 16px">${title}</h2>
    ${body}
    <p style="color:#666;font-size:13px;margin-top:32px">IDesign Moz — alojamento, domínios, websites e marketing em Moçambique.</p>
  </div></div>`;
}