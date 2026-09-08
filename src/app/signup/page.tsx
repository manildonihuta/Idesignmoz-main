import SignupPanel from "@/components/signup-panel";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

export default function SignupPage() {
  return (
    <div className="site-shell">
      <SiteHeader />
      <main id="main" className="inner-page section-wrap auth-page">
        <SignupPanel />
      </main>
      <SiteFooter />
    </div>
  );
}