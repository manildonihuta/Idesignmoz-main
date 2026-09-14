import LoginPanel from "@/components/login-panel";

export default function LoginPage() {
  return (
    <div className="site-shell">
      <main id="main" className="inner-page section-wrap auth-page">
        <LoginPanel />
      </main>
    </div>
  );
}