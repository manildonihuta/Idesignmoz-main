/* AI Builder — template catalogue (static data, no DB yet). */

export type AiTemplate = {
  id: string;
  name: string;
  industry: string;
  industryLabel: string;
  description: string;
  style: string;
  colors: { from: string; to: string; accent: string };
  pages: number;
  brief: string;
};

export const AI_TEMPLATES: AiTemplate[] = [
  {
    id: "restaurante",
    name: "Sabor & Tradição",
    industry: "Restaurante e alimentação",
    industryLabel: "🍽️ Restaurante",
    description:
      "Cozinha moçambicana em destaque: menu, especialidades, reservas, horários e localização com o calor de um estabelecimento familiar.",
    style: "modern",
    colors: { from: "#E31E24", to: "#FF5A5F", accent: "#7C3AED" },
    pages: 4,
    brief:
      "Restaurante de cozinha moçambicana com ambiente familiar. Destacar o menu, especialidades, reservas, horários e localização.",
  },
  {
    id: "hotel-boutique",
    name: "Mar Azul",
    industry: "Hotel e alojamento",
    industryLabel: "🏨 Hotel",
    description:
      "Um hotel boutique virado para a praia: quartos, experiências, preços e reserva. Elegante, sóbrio e acolhedor.",
    style: "elegant",
    colors: { from: "#0E7C7B", to: "#1FB6A6", accent: "#F5B942" },
    pages: 4,
    brief:
      "Hotel boutique com quartos virados para a praia. Apresentar quartos, experiências, preços e formulário de reserva.",
  },
  {
    id: "portfolio-criativo",
    name: "Estúdio K",
    industry: "Portfólio",
    industryLabel: "🎨 Portfólio",
    description:
      "Portfólio de designer ou fotógrafo: projetos seleccionados, serviços e contacto. Tipografia forte e presença marcante.",
    style: "bold",
    colors: { from: "#7C3AED", to: "#FF5A5F", accent: "#22D3EE" },
    pages: 3,
    brief:
      "Portfólio de designer criativo. Apresentar projetos seleccionados, serviços e um formulário de contacto claro.",
  },
  {
    id: "agencia",
    name: "Cresce & Co",
    industry: "Empresa / serviços",
    industryLabel: "💼 Negócio",
    description:
      "Escritório de serviços profissionais: apresentação, equipa, serviços e contactos. Limpo, de confiança e direto.",
    style: "minimal",
    colors: { from: "#111827", to: "#4B5563", accent: "#E31E24" },
    pages: 4,
    brief:
      "Consultoria de negócios para PME. Destacar serviços, vantagens, casos de sucesso e contacto para reunião.",
  },
  {
    id: "loja-online",
    name: "Kiva Store",
    industry: "Loja online",
    industryLabel: "🛍️ Loja online",
    description:
      "Loja online de artesanato: catálogo, categorias, promoções e uma página dedicada a vender. Vibrante e convidativo.",
    style: "playful",
    colors: { from: "#F59E0B", to: "#FF5A5F", accent: "#7C3AED" },
    pages: 5,
    brief:
      "Loja online de artesanato moçambicano. Mostrar catálogo, categorias e uma página dedicada a vender com entrega nacional.",
  },
  {
    id: "imobiliaria",
    name: "Casa MZ",
    industry: "Imobiliário",
    industryLabel: "🏡 Imobiliário",
    description:
      "Imobiliária que inspira confiança: imóveis em destaque, zonas de Maputo, serviços e contactos para visitas.",
    style: "modern",
    colors: { from: "#065F46", to: "#10B981", accent: "#F5B942" },
    pages: 4,
    brief:
      "Imobiliária em Maputo para venda e arrendamento. Destacar imóveis disponíveis, zonas e contactos para visitas.",
  },
  {
    id: "salao-beleza",
    name: "Bela & Co",
    industry: "Outro",
    industryLabel: "✨ Outro",
    description:
      "Salão de beleza e estética: serviços, preços, marcas e marcação online. Feminino, elegante e moderno.",
    style: "elegant",
    colors: { from: "#DB2777", to: "#F472B6", accent: "#7C3AED" },
    pages: 3,
    brief:
      "Salão de beleza e estética. Destacar serviços, preços, marcas utilizadas e marcação online.",
  },
  {
    id: "landing-app",
    name: "App Launch",
    industry: "Landing page",
    industryLabel: "🚀 Landing page",
    description:
      "Landing page de lançamento: proposta de valor, vantagens, prova social e chamada à ação. Energética e focada em conversão.",
    style: "bold",
    colors: { from: "#7C3AED", to: "#06B6D4", accent: "#F59E0B" },
    pages: 2,
    brief:
      "Landing page de lançamento de uma aplicação. Proposta de valor clara, vantagens, prova social e chamada à ação.",
  },
];

export function getAiTemplate(id: string | undefined | null): AiTemplate | null {
  if (!id) return null;
  return AI_TEMPLATES.find((t) => t.id === id) ?? null;
}