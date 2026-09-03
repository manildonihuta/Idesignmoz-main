import Link from "next/link";

interface SiteFooterProps {
  anchors?: boolean;
}

export function SiteFooter({ anchors = false }: SiteFooterProps) {
  return (
    <footer className="footer section-wrap">
      <Link className="logo" href={anchors ? "#top" : "/"}><span>ID</span>ESIGN<span className="logo-accent">.</span></Link>
      <p>Soluções digitais para<br />negócios modernos.</p>
      <div className="footer-links">
        <Link href={anchors ? "#services" : "/services"}>Serviços</Link>
        <Link href={anchors ? "#work" : "/portfolio"}>Trabalhos</Link>
        <Link href={anchors ? "#pricing" : "/pricing"}>Preços</Link>
        <Link href={anchors ? "#contact" : "/contact"}>Contacto</Link>
      </div>
      <small>© 2025 IDesign Moz</small>
    </footer>
  );
}
