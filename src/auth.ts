import NextAuth from "next-auth";
import EmailProvider from "next-auth/providers/email";

import { sendEmail, emailLayout } from "@/lib/email";

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  trustHost: true,
  providers: [
    EmailProvider({
      server: {
        host: "smtp.resend.com",
        port: 465,
        secure: true,
        auth: { user: "resend", pass: process.env.RESEND_API_KEY ?? "" },
      },
      from: process.env.EMAIL_FROM ?? "IDesign Moz <no-reply@idesignmoz.com>",
      async sendVerificationRequest({ identifier, url }) {
        await sendEmail({
          to: identifier,
          subject: "Ligue a sua conta — IDesign Moz",
          html: emailLayout(
            "Iniciar sessão",
            `<p>Use o link abaixo para entrar na sua área de cliente:</p>
             <p><a href="${url}" style="display:inline-block;background:#d9ff3e;color:#000;text-decoration:none;padding:10px 18px;border-radius:8px">Entrar agora</a></p>
             <p style="color:#666">Se não foi você, pode ignorar este email.</p>`,
          ),
          text: `Inicie sessão em: ${url}`,
        });
      },
    }),
  ],
  callbacks: {
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub ?? "";
      }
      return session;
    },
  },
});