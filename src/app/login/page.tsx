import LoginPanel from "@/components/login-panel";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

export default function LoginPage() {
  return (
    <div className="site-shell">
      <SiteHeader />
      <main id="main" className="inner-page section-wrap auth-page">
        <LoginPanel />
      </main>
      <SiteFooter />
    </div>
  );
}