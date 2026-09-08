export type ProfileData = {
  fullName: string;
  email: string;
  phone: string;
  company: string;
  nuit: string;
  address: string;
  city: string;
};

export const PROFILE: ProfileData = {
  fullName: "João Manhiça",
  email: "joao@company.co.mz",
  phone: "+258 84 000 0000",
  company: "Company Lda",
  nuit: "400987654",
  address: "Av. Julius Nyerere 1230",
  city: "Maputo, Moçambique",
};

export type NotificationPref = {
  id: string;
  label: string;
  description: string;
  enabled: boolean;
};

export const NOTIFICATION_PREFS: NotificationPref[] = [
  {
    id: "billing",
    label: "Facturação",
    description: "Avisos de renovação, recibos e confirmações de pagamento.",
    enabled: true,
  },
  {
    id: "updates",
    label: "Actualizações",
    description: "Novidades dos seus projetos: design, desenvolvimento e lançamento.",
    enabled: true,
  },
  {
    id: "newsletter",
    label: "Newsletter",
    description: "Dicas de marketing digital e novidades da IDesign Moz.",
    enabled: false,
  },
];