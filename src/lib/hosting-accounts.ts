export type HostingAccountStatus = "Active" | "Pending" | "Canceled";

export type HostingAccount = {
  plan: string;
  slug: string;
  hostingFor: string;
  storage: string;
  bandwidth: string;
  sites: number;
  status: HostingAccountStatus;
  expiry: string;
  renewal: string;
};

export const HOSTING_ACCOUNTS: HostingAccount[] = [
  {
    plan: "Business",
    slug: "shared-business",
    hostingFor: "amplius.co.mz",
    storage: "30 GB SSD",
    bandwidth: "5 TB/mês",
    sites: 1,
    status: "Active",
    expiry: "30 Jan 2027",
    renewal: "4,990 MT/ano",
  },
  {
    plan: "Email 50",
    slug: "email-50",
    hostingFor: "company.co.mz",
    storage: "50 GB",
    bandwidth: "—",
    sites: 0,
    status: "Active",
    expiry: "30 Jan 2027",
    renewal: "2,990 MT/ano",
  },
  {
    plan: "Pro",
    slug: "shared-pro",
    hostingFor: "kayacolectivo.com",
    storage: "80 GB NVMe",
    bandwidth: "10 TB/mês",
    sites: 3,
    status: "Pending",
    expiry: "—",
    renewal: "7,990 MT/ano",
  },
];

export const HOSTING_QUOTA = {
  used: "45%",
  detail: "45 GB de 100 GB",
};