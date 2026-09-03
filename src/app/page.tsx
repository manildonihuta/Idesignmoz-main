"use client";

import { FormEvent, useState } from "react";
import { motion } from "framer-motion";
import { Autoplay, A11y } from "swiper/modules";
import { Swiper, SwiperSlide } from "swiper/react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

const services = [
  { number: "01", title: "Websites que fazem crescer", text: "Experiências digitais rápidas e pensadas para a forma como os seus clientes decidem.", tag: "Design web" },
  { number: "02", title: "Uma marca memorável", text: "Sistemas de identidade com clareza e personalidade para se destacar no mercado.", tag: "Identidade" },
  { number: "03", title: "Crescimento com propósito", text: "Pesquisa, redes sociais e conteúdo que transformam atenção numa carteira mais saudável.", tag: "Marketing" },
];

const hostingPlans = [
  { name: "Starter", price: "499", detail: "Para o seu primeiro espaço online", features: ["10 GB de armazenamento SSD", "1 website", "5 contas de email"] },
  { name: "Business", price: "999", detail: "Para equipas prontas para crescer", features: ["30 GB de armazenamento NVMe", "10 websites", "Suporte prioritário"], featured: true },
  { name: "Pro", price: "1,999", detail: "Para operações digitais ambiciosas", features: ["100 GB de armazenamento NVMe", "Websites ilimitados", "Backup avançado"] },
];

function Arrow() {
  return <span aria-hidden="true">↗</span>;
}

const heroCopy = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0 },
};

const heroArt = {
  hidden: { opacity: 0, scale: 0.94 },
  visible: { opacity: 1, scale: 1, transition: { duration: 0.8 } },
};

export default function Home() {
  const [domain, setDomain] = useState("");
  const [extension, setExtension] = useState(".co.mz");
  const [searched, setSearched] = useState(false);

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (domain.trim()) setSearched(true);
  }

  return (
    <div className="site-shell">
      <SiteHeader anchors />
      <main id="top">
        <motion.section
          className="hero section-wrap"
          initial="hidden"
          animate="visible"
          variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.12 } } }}
        >
          <motion.div className="hero-copy" variants={heroCopy}>
            <p className="eyebrow"><span className="pulse" /> Parceiros digitais para negócios ambiciosos</p>
            <h1>Dê sentido ao<br /><em>próximo passo.</em></h1>
            <p className="hero-text">Tudo o que precisa para construir, lançar e fazer crescer a sua presença digital. Estratégia cuidadosa, design marcante e tecnologia que trabalha consigo.</p>
            <div className="hero-actions">
              <a className="button" href="#contact">Começar projecto <Arrow /></a>
              <a className="text-link" href="#services">Explorar serviços <Arrow /></a>
            </div>
          </motion.div>

          <motion.div className="hero-art" aria-label="Smartphone moderno a apresentar um website" variants={heroArt}>
            <div className="hero-glow" />
            <motion.div
              className="hero-orbit orbit-one"
              animate={{ rotate: [-20, -12, -20], scale: [1, 1.035, 1], opacity: [0.72, 1, 0.72] }}
              transition={{ duration: 14, ease: "easeInOut", repeat: Infinity }}
            />
            <motion.div
              className="hero-orbit orbit-two"
              animate={{ rotate: [42, 50, 42], scale: [1, 0.96, 1], opacity: [0.45, 0.8, 0.45] }}
              transition={{ duration: 18, ease: "easeInOut", repeat: Infinity }}
            />
            <div className="phone">
              <div className="phone-notch" />
              <div className="phone-screen">
                <div className="screen-top">ID<span>.</span><small>MENU</small></div>
                <div className="screen-title">Crie<br /><i>com força.</i></div>
                <div className="screen-line" />
                <div className="screen-footer">DESLIZE PARA EXPLORAR <b>↓</b></div>
              </div>
            </div>
            <div className="art-label label-top">01 / 03<br /><b>Criação digital</b></div>
            <div className="art-label label-bottom">Maputo, MZ<br /><b>25° 58′ S</b></div>
          </motion.div>
        </motion.section>

        <section className="domain-panel section-wrap" aria-labelledby="domain-heading">
          <div className="section-kicker"><span>01</span><span className="rule" /><span>Encontre o seu lugar</span></div>
          <div className="domain-heading">
            <h2 id="domain-heading">A sua ideia merece<br /><em>um bom endereço.</em></h2>
            <p>Pesquise um domínio que torne o seu negócio fácil de encontrar, lembrar e confiar.</p>
          </div>
          <form className="domain-form" onSubmit={handleSearch}>
            <label className="sr-only" htmlFor="domain">Pesquisar um domínio</label>
            <input id="domain" value={domain} onChange={(event) => { setDomain(event.target.value); setSearched(false); }} placeholder="oseunegocio" />
            <select value={extension} onChange={(event) => setExtension(event.target.value)} aria-label="Extensão do domínio">
              <option>.co.mz</option><option>.com</option><option>.africa</option><option>.org</option>
            </select>
            <button className="button" type="submit">Pesquisar domínio <Arrow /></button>
          </form>
          {searched && (
            <div className="domain-result">
              <span className="result-check">✓</span>
              <span><strong>{domain.toLowerCase().replaceAll(" ", "")}{extension}</strong><small>Disponível para registo</small></span>
              <b>2,500 MT / ano</b>
              <a href="#contact" className="result-link">Adicionar ao carrinho <Arrow /></a>
            </div>
          )}
          <div className="domain-foot">
            <span>Extensões populares</span><b>.co.mz</b><span>.com</span><span>.africa</span><span>.tech</span><span>.online</span>
          </div>
        </section>

        <section className="services-section section-wrap" id="services">
          <div className="section-kicker"><span>02</span><span className="rule" /><span>O que fazemos</span></div>
          <div className="section-intro">
            <h2>Um parceiro.<br /><em>Mais impulso.</em></h2>
            <p>Do seu primeiro domínio à próxima grande campanha, juntamos pensamento e execução sob o mesmo tecto.</p>
          </div>
          <div className="service-grid">
            {services.map((service, index) => (
              <motion.article
                className="service-card"
                key={service.number}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.25 }}
                transition={{ delay: index * 0.1 }}
              >
                <span className="service-number">{service.number}</span>
                <div className="service-icon">{service.number === "01" ? "◩" : service.number === "02" ? "✳" : "↗"}</div>
                <h3>{service.title}</h3>
                <p>{service.text}</p>
                <a href="#contact">{service.tag} <Arrow /></a>
              </motion.article>
            ))}
          </div>
        </section>

        <section className="work-section section-wrap" id="work">
          <div className="section-kicker"><span>03</span><span className="rule" /><span>Trabalhos seleccionados</span></div>
          <div className="work-heading">
            <h2>Feito em Moçambique.<br /><em>Construído para o mundo.</em></h2>
            <a className="text-link" href="#contact">Ver trabalhos <Arrow /></a>
          </div>
          <Swiper
            className="work-swiper"
            modules={[Autoplay, A11y]}
            autoplay={{ delay: 4200, disableOnInteraction: false }}
            spaceBetween={25}
            slidesPerView={1.05}
            breakpoints={{ 760: { slidesPerView: 1.35 }, 1020: { slidesPerView: 1.75 } }}
            aria-label="Trabalhos seleccionados"
          >
            <SwiperSlide>
              <article className="work-feature">
                <div className="work-image coastal">
                  <div className="work-overlay"><span>Hotelaria · 2024</span><h3>Castel<br /><em>Branco</em></h3></div>
                </div>
                <p>Estratégia de marca / Experiência digital</p>
              </article>
            </SwiperSlide>
            <SwiperSlide>
              <article className="work-feature">
                <div className="work-image editorial">
                  <div className="editorial-word">Kaya</div>
                  <div className="work-overlay"><span>Cultura · 2023</span></div>
                </div>
                <p>Identidade / Comércio electrónico</p>
              </article>
            </SwiperSlide>
          </Swiper>
        </section>

        <motion.section
          className="hosting-section section-wrap"
          id="hosting"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.65 }}
        >
          <div className="hosting-copy">
            <div className="section-kicker"><span>04</span><span className="rule" /><span>Alojamento, simplificado</span></div>
            <h2>Mantenha o seu<br /><em>espaço na web</em><br />sempre aberto.</h2>
            <p>Alojamento fiável com suporte local, segurança integrada e espaço para o que vem a seguir.</p>
            <a className="text-link" href="#pricing">Comparar planos <Arrow /></a>
          </div>
          <div className="hosting-card-wrap">
            <div className="hosting-status"><span className="status-dot" /> Todos os sistemas operacionais <small>99,99% de disponibilidade</small></div>
            <div className="hosting-terminal">
              <div className="terminal-top"><span>idesignmoz / painel</span><i>•••</i></div>
              <div className="terminal-stat"><span>VISITANTES MENSAIS</span><strong>24.891</strong><b>+18,4%</b></div>
              <div className="chart">{Array.from({ length: 12 }, (_, index) => <i key={index} />)}</div>
              <div className="terminal-bottom"><span>SSL activo</span><span>Backups diários</span><span>Maputo / MZ</span></div>
            </div>
          </div>
        </motion.section>

        <section className="pricing-section section-wrap" id="pricing">
          <div className="section-kicker"><span>05</span><span className="rule" /><span>Preços simples</span></div>
          <div className="section-intro">
            <h2>Espaço para crescer.<br /><em>Sem surpresas.</em></h2>
            <p>Comece com o que precisa hoje. Faça upgrade quando chegar a altura.</p>
          </div>
          <div className="pricing-grid">
            {hostingPlans.map((plan) => (
              <article className={`price-card ${plan.featured ? "featured" : ""}`} key={plan.name}>
                {plan.featured && <span className="popular">Mais escolhido</span>}
                <h3>{plan.name}</h3>
                <p>{plan.detail}</p>
                <div className="price"><strong>{plan.price}</strong> <span>MT / mês</span></div>
                <ul>{plan.features.map((feature) => <li key={feature}>✓ {feature}</li>)}</ul>
                <a className={plan.featured ? "button" : "outline-button"} href="#contact">Escolher {plan.name} <Arrow /></a>
              </article>
            ))}
          </div>
        </section>

        <motion.section
          className="cta-section section-wrap"
          id="contact"
          initial={{ opacity: 0, scale: 0.98 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true, amount: 0.35 }}
          transition={{ duration: 0.6 }}
        >
          <div className="cta-mark">ID<span>.</span></div>
          <div>
            <p className="eyebrow">Tem uma boa ideia?</p>
            <h2>Vamos torná-la<br /><em>realidade.</em></h2>
            <a className="button" href="mailto:hello@idesignmoz.com">Iniciar conversa <Arrow /></a>
          </div>
          <div className="cta-contact">
            <span>Fale connosco</span>
            <a href="mailto:hello@idesignmoz.com">hello@idesignmoz.com</a>
            <a href="tel:+258840000000">+258 84 000 0000</a>
            <small>Av. Julius Nyerere<br />Maputo, Moçambique</small>
          </div>
        </motion.section>
      </main>
      <SiteFooter anchors />
    </div>
  );
}
