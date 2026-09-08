export type BlogCategory = {
  label: string
  slug: string
  description: string
}

export type BlogPost = {
  slug: string
  title: string
  excerpt: string
  date: string
  updated?: string
  category: string
  tags: string[]
  body: string[]
}

export const BLOG_CATEGORIES: ReadonlyArray<BlogCategory> = [
  {
    label: "Web Design",
    slug: "web-design",
    description: "Websites, interfaces e experiências digitais que convertem visitantes em clientes.",
  },
  {
    label: "Technology",
    slug: "technology",
    description: "Tecnologia, segurança, tendências e o que está a mudar o mundo digital.",
  },
  {
    label: "SEO",
    slug: "seo",
    description: "Otimização para motores de busca e estratégias para aparecer no Google.",
  },
  {
    label: "Marketing",
    slug: "marketing",
    description: "Marketing digital, redes sociais e conteúdo para fazer crescer a marca.",
  },
  {
    label: "Business",
    slug: "business",
    description: "Negócios, estratégia e presença online para empreendedores em Moçambique.",
  },
  {
    label: "Domains",
    slug: "domains",
    description: "Tudo sobre domínios: registo, extensões, DNS e boas práticas.",
  },
  {
    label: "Hosting",
    slug: "hosting",
    description: "Alojamento, velocidade, email profissional e infraestrutura para o seu site.",
  },
  {
    label: "Tutorials",
    slug: "tutorials",
    description: "Guias passo a passo para fazer tarefas técnicas sem complicações.",
  },
]

export const posts: BlogPost[] = [
  {
    slug: "porque-o-seu-negocio-precisa-de-um-dominio-profissional",
    title: "Porque o seu negócio precisa de um domínio profissional",
    excerpt:
      "Um endereço próprio muda a forma como os clientes o encontram, confiam em si e lembram a sua marca.",
    date: "2025-01-20",
    updated: "2025-08-14",
    category: "domains",
    tags: ["domínio", ".co.mz", "presença online", "email profissional"],
    body: [
      "Um domínio próprio é a base de qualquer presença digital séria. Sem ele, o seu endereço fica preso ao nome de outra plataforma — algo como ter a loja dentro de um mercado cujo letreiro não é seu.",
      "Quando um cliente procura o seu negócio, o primeiro reflexo é procurar pelo nome. Se encontra um endereço com o seu nome (.co.mz ou .com), ganha confiança à partida. Se encontra um link genérico de uma rede social, a hesitação começa.",
      "Além da credibilidade, o domínio dá-lhe ownership: é um ativo seu. O email profissional (geral@oseudominio.com) reforça a imagem e as taxas de abertura, e o website ganha autoridade própria que nenhuma página de rede social lhe garante.",
      "Ao escolher, prefira um nome curto, fácil de escrever e dizer. Evite hífens, números ambíguos e abreviaturas confusas. O ideal é algo que um cliente consiga repetir ao telefone sem errar.",
      "Em Moçambique, a extensão .co.mz está associada a empresas locais registadas e transmite imediatamente presença nacional. O .com continua a ser a escolha global mais reconhecida — serve igualmente bem se quiser operar além-fronteiras.",
      "Se a extensão que quer já está ocupada, considere variações lógicas do nome ou extensões alternativas, mas evite versões confusas. Um nome ligeiramente diferente vale mais do que uma grafia que todos erram.",
      "A IDesign Moz trata de tudo: verificação de disponibilidade, registo, renovação e configuração do DNS. O domínio certo hoje funciona como o cartão-de-visita que nunca fica em casa.",
    ],
  },
  {
    slug: "alojamento-velocidade-e-conversao",
    title: "Alojamento, velocidade e conversão",
    excerpt:
      "Um site lento custa clientes. Veja porque a escolha do alojamento importa mais do que parece.",
    date: "2025-02-08",
    category: "hosting",
    tags: ["alojamento", "velocidade", "conversão", "CDN"],
    body: [
      "A velocidade de carregamento influencia diretamente as vendas e o posicionamento nos motores de busca. Estudos repetem o mesmo número: quanto mais lento o site, maior a probabilidade de o visitante desistir.",
      "A maioria das pessoas atribui a lentidão a um problema de design. Na prática, o alojamento é a causa mais frequente — recursos limitados, discos tradicionais e servidores longe do público.",
      "Com alojamento em SSD, CDN e cache bem configurados, o site fica rápido para visitantes em Moçambique e no estrangeiro. A diferença sente-se em menos de dois segundos de carregamento.",
      "A conversão acompanha a velocidade. Páginas rápidas retêm o utilizador, reduzem a taxa de rejeição e aumentam o tempo de sessão — sinais que o Google valoriza no ranking.",
      "Além da velocidade, o alojamento correto garante segurança: SSL, backups automáticos, monitorização e suporte quando algo falha. Ninguém pensa nisto no dia do lançamento, mas toda a gente sente quando falta.",
      "Se o seu site demora mais de 3 segundos a carregar, comece pelo alojamento. Muitas vezes é a mudança de maior impacto com o menor custo real.",
    ],
  },
  {
    slug: "website-basico-vs-loja-online",
    title: "Website básico vs loja online: o que escolher",
    excerpt:
      "Nem todo o negócio precisa de uma loja. Saiba qual o próximo passo certo para o seu.",
    date: "2025-03-02",
    category: "web-design",
    tags: ["website", "e-commerce", "loja online", "web design"],
    body: [
      "Começar por um website institucional bem feito é o caminho mais comum — e muitas vezes o mais eficaz. Mostra quem é, o que faz, onde está e como o contactam.",
      "Uma loja online exige catálogo, carrinho, pagamentos e logística. É mais cara, mais complexa e precisa de tráfego constante. Se ainda não tem procura regular, pode tornar-se numa vitrine cara e sem movimento.",
      "Quando a procura justificar, a evolução para loja online é natural, com os mesmos domínios e alojamento. O website institucional funciona como base e acelera essa transição.",
      "A decisão certa depende dos seus objetivos: gerar contactos e credibilidade aponta para o site institucional; vender diretamente, com stock e preços públicos, aponta para a loja.",
      "Há um meio-termo inteligente: começar com um site com secção de produtos e botão de contacto. Muitas empresas moçambicanas fecham negócios por WhatsApp — o site prepara o terreno e poupa-lhe o custo de um checkout completo.",
      "Fale com a equipa da IDesign Moz sobre o momento certo do seu negócio. Uma boa escolha agora evita retrabalho e dinheiro gasto no passo errado.",
    ],
  },
  {
    slug: "guia-seo-local-mocambique",
    title: "Guia de SEO local para negócios em Moçambique",
    excerpt:
      "Como aparecer no Google quando alguém procura o seu tipo de negócio perto de si, em Maputo, Beira ou Nampula.",
    date: "2025-03-24",
    category: "seo",
    tags: ["SEO", "Google", "pesquisa local", "palavras-chave"],
    body: [
      "A maioria dos clientes começa a jornada no Google: procuram \"café em Maputo\", \"agência de design em Nampula\" ou \"alojamento website Moçambique\". Aparecer nessa resposta é SEO local — e está ao alcance de qualquer negócio.",
      "O primeiro passo é a consistência. O nome, morada e telefone do negócio devem ser idênticos no site, nas redes sociais e nas diretorias. Um NUIT associado a uma morada credível ajuda os motores a confiarem em si.",
      "Depois, trabalhe as palavras-chave certas para o seu mercado. Combine o serviço com a localização (\"web design Beira\"), use a língua que os clientes usam e responda às perguntas que fazem.",
      "O conteúdo do site deve ser rápido, claro e organizado por páginas: serviços, sobre, contactos. Cada página com um título e descrição únicos. Internal links entre páginas distribuem importância e ajudam a navegação.",
      "Toque social e reviews contam na pesquisa local: peça avaliações e responda a todas, boas e más. O Google lê isso como sinal de atividade real.",
      "O SEO é uma maratona, não um sprint: os resultados aparecem em semanas a meses. Mas cada posição conquistada é tráfego gratuito, recorrente, que nenhuma campanha paga substitui a longo prazo.",
    ],
  },
  {
    slug: "marketing-digital-pequenos-negocios",
    title: "Marketing digital para pequenos negócios: por onde começar",
    excerpt:
      "Redes sociais, conteúdo e anúncios sem complicação: o caminho prático para fazer crescer a sua marca.",
    date: "2025-04-12",
    category: "marketing",
    tags: ["marketing digital", "redes sociais", "conteúdo", "anúncios"],
    body: [
      "Marketing digital parece um mundo de siglas e plataformas. Mas para um pequeno negócio a fórmula é simples: presença, conteúdo e consistência.",
      "Escolha uma ou duas plataformas onde os seus clientes estão — e onde consegue manter atividade. Mais vale um Instagram consistente do que cinco redes abandonadas.",
      "O conteúdo deve responder às perguntas que os clientes fazem todos os dias. Vídeos curtos a mostrar o produto, respostas a dúvidas comuns, bastidores do serviço: isto constrói confiança sem gastar um metical.",
      "Quando quiser acelerar, os anúncios pagos funcionam melhor num público pequeno e bem direcionado. Comece com orçamentos modestos, teste duas ou três mensagens e invista na que gera conversas.",
      "Ligue o marketing ao site: cada perfil deve apontar para uma página que capta o contacto (WhatsApp, formulário ou email). Marketing sem destino é ruído — com destino, é motor de vendas.",
      "A consistência vence a intensidade. Um calendário simples, cumprido ao longo de meses, supera campanhas brilhantes de um dia.",
    ],
  },
  {
    slug: "https-seguranca-proteja-o-seu-website",
    title: "HTTPS e segurança: proteja o seu website e os seus clientes",
    excerpt:
      "O cadeado no navegador deixou de ser opcional. Saiba porque o SSL importa para a confiança e para o Google.",
    date: "2025-04-28",
    category: "technology",
    tags: ["segurança", "HTTPS", "SSL", "cibersegurança"],
    body: [
      "O cadeado ao lado do endereço — o HTTPS — já não é um extra em sites comerciais: é a norma. Os navegadores marcam sites sem ele como \"não seguros\", e os clientes notam.",
      "O HTTPS encripta os dados entre o visitante e o servidor: formulários, contactos e pagamentos ficam protegidos de escutas na rede. Para um negócio que recolhe dados de clientes, isto não é negociável.",
      "O Google trata o HTTPS como fator de ranking e como parte da avaliação de Core Web Vitals na componente de segurança. Sites sem SSL perdem posições para concorrentes equivalentes que o usam.",
      "Certificados SSL modernos são automáticos e gratuitos (Let's Encrypt), gerados, renovados e instalados sem intervenção. O custo real é a configuração, não o certificado.",
      "Rode a segurança com boas práticas básicas: backups, atualizações regulares, palavras-passe fortes e monitorização. A maioria das falhas exploradas são porta aberta, não ataques sofisticados.",
      "A IDesign Moz inclui SSL no alojamento e ativa backups automáticos. Cuide das bases e o resto da casa aguenta qualquer tempestade.",
    ],
  },
  {
    slug: "presenca-online-empresas-mocambique",
    title: "Presença online para empresas moçambicanas: 5 passos essenciais",
    excerpt:
      "Domínio, site, email, perfis e Google: o mínimo que toda a empresa séria em Moçambique devia ter hoje.",
    date: "2025-05-16",
    category: "business",
    tags: ["negócios", "Moçambique", "websites", "branding"],
    body: [
      "A presença online de uma empresa moçambicana deixou de ser um luxo de multinacionais. Os clientes pesquisam antes de comprar — e a primeira impressão acontece offline, nas redes e no Google.",
      "Passo um: o domínio próprio (.co.mz ou .com). É o endereço oficial da marca, protegido ou ocupado pela concorrência.",
      "Passo dois: um website claro e rápido. Nome, serviços, preços aproximados, contactos e o que torna o negócio único. Seis secções bem feitas valem mais do que trinta páginas vazias.",
      "Passo três: email profissional no domínio. Receber as faturas e contratos num @gmail.com enfraquece a negociação; no próprio domínio, fecha o círculo de confiança.",
      "Passo quatro: perfis nas redes certas, coerentes com o site, com morada e contacto iguais em todo o lado.",
      "Passo cinco: listagem no Google e nas diretorias locais, com NUIT e morada, para aparecer nas pesquisas \"perto de mim\".",
      "Estes cinco passos formam um sistema que se alimenta: o site dá destino às redes, o email profissional dá autoridade, o Google devolve os clientes ao site. Comece pelo domínio e construa a partir daí.",
    ],
  },
  {
    slug: "tutorial-ligar-dominio-ao-website",
    title: "Tutorial: como ligar o seu domínio ao website",
    excerpt:
      "Passo a passo para apontar o DNS do seu domínio para o alojamento, em menos de uma hora.",
    date: "2025-06-02",
    category: "tutorials",
    tags: ["tutoriais", "DNS", "domínio", "configuração"],
    body: [
      "Ter o domínio e o alojamento em sítios diferentes é normal — o que os liga são os registos DNS, as instruções que dizem ao mundo onde viver o seu site.",
      "Os dois registos mais importantes são o A (aponta o domínio para o IP do servidor) e o CNAME www (faz redirecionar o www para o mesmo lugar).",
      "No painel do registador de domínios, procure \"DNS management\" ou \"Nameservers\", edite o registo A colocando o IP indicado pela empresa de alojamento e adicione um CNAME www apontando para o domínio sem www.",
      "As alterações de DNS demoram entre 15 minutos e 48 horas a propagar, dependendo do registador e da região. Se o seu site não abrir de imediato, aguarde e verifique novamente.",
      "Depois de ligar, configure o email profissional e o SSL. Com o domínio a servir o site, é hora de aparecer no Google com o Search Console e confirmar o HTTPS.",
      "Nunca apanhe pressa num passo destes sem protocolo: se não se sentir confiante, a IDesign Moz faz a ligação e a configuração por si, incluindo DNS, SSL e email.",
    ],
  },
  {
    slug: "core-web-vitals-velocidade-google-mede",
    title: "Core Web Vitals: a velocidade que o Google realmente mede",
    excerpt:
      "LCP, CLS e INP: o que são as métricas de experiência de página e como melhorá-las no seu site.",
    date: "2025-07-10",
    category: "seo",
    tags: ["Core Web Vitals", "velocidade", "LCP", "experiência"],
    body: [
      "O Google não mede apenas o tempo de carregamento — mede a experiência real de quem usa a página. As Core Web Vitals são a forma padronizada de fazer essa leitura.",
      "O LCP diz quanto tempo até o conteúdo principal aparecer. O CLS mede os saltos inesperados (imagens a empurrar texto, por exemplo). O INP avalia a resposta a cliques e scroll.",
      "Valores bons passam em três registos: conteúdo principal visível em menos de 2,5 segundos, zero saltos de layout e interações respondidas em menos de 200 milissegundos.",
      "As melhorias clássicas funcionam: imagens comprimidas no formato certo, fontes eficientes, CSS simplificado e alojamento rápido perto dos visitantes.",
      "O impacto é direto: melhores Core Web Vitals associam-se a melhores posições no Google e a mais conversões. Não é uma caixa de mérito técnico — é uma alavanca comercial.",
      "Peça à IDesign Moz uma auditoria: com análise das métricas reais, sabe exatamente o que atrasa o seu site e quanto tempo de carregamento consegue poupar.",
    ],
  },
  {
    slug: "email-profissional-no-seu-dominio",
    title: "Email profissional: porque importa ter o seu domínio no endereço",
    excerpt:
      "Do boas-práticas à taxa de abertura: como um email @oseudominio muda a forma como o tratam.",
    date: "2025-07-28",
    category: "hosting",
    tags: ["email profissional", "alojamento", "marketing", "confiança"],
    body: [
      "O email é o canal mais antigo do website e, ainda assim, um dos que mais define a seriedade de uma empresa. Um @gmail.com na proposta comercial diz \"comecei agora\"; um @oseudominio.com diz \"negócio a sério\".",
      "O email profissional reforça a marca em cada mensagem. Cada envio é publicidade silenciosa do seu domínio — do contrato à notificação de envio.",
      "A configuração correta (SPF, DKIM e DMARC) garante que as suas mensagens não vão parar ao spam, protegendo a taxa de abertura e a reputação do domínio.",
      "Com o email no próprio domínio, o controlo é seu: caixas por equipa, nomes credíveis (vendas@, geral@), quotas e reencaminhamento organizados.",
      "Para quem faz marketing por email, é a diferença entre uma newsletter que chega ao inbox e uma que morre no spam — o investimento mais barato em credibilidade digital que existe.",
    ],
  },
]

export function getCategory(slug: string): BlogCategory | null {
  return BLOG_CATEGORIES.find((c) => c.slug === slug) ?? null
}

export function getPost(slug: string): BlogPost | null {
  return posts.find((p) => p.slug === slug) ?? null
}

export function postsByCategory(slug: string): BlogPost[] {
  return posts.filter((p) => p.category === slug)
}

export function sortedPosts(list: BlogPost[] = posts): BlogPost[] {
  return [...list].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
}

export function relatedPosts(current: BlogPost, limit = 3): BlogPost[] {
  const sameCategory = posts.filter((p) => p.slug !== current.slug && p.category === current.category)
  const sharedTags = posts.filter(
    (p) => p.slug !== current.slug && p.category !== current.category && p.tags.some((t) => current.tags.includes(t)),
  )
  return sortedPosts([...sameCategory, ...sharedTags]).slice(0, limit)
}

const WORDS_PER_MINUTE = 200

export function postReadingTime(body: string[]): number {
  const words = body.join(" ").split(/\s+/).filter(Boolean).length
  return Math.max(1, Math.round(words / WORDS_PER_MINUTE))
}

export function formatPostDate(iso: string): string {
  try {
    return new Date(`${iso}T12:00:00`).toLocaleDateString("pt-PT", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    })
  } catch {
    return iso
  }
}

export function postUrl(slug: string): string {
  return `/blog/${slug}`
}

export function categoryUrl(slug: string): string {
  return `/blog/category/${slug}`
}