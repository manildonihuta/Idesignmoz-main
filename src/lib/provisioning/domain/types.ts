export type DomainContact = {
  firstName?: string;
  lastName?: string;
  org?: string;
  email?: string;
  phone?: string;
  address1?: string;
  city?: string;
  state?: string;
  zip?: string;
  country?: string;
};

export type DomainRegistrarCheck = {
  available: boolean;
  source: string;
  message?: string;
};

export type DomainRegistrationRequest = {
  fullDomain: string;
  years?: number;
  contact: DomainContact;
};

export type DomainRegistrationResult = {
  ok: boolean;
  message?: string;
  registrantId?: string;
  eppCode?: string;
};

export type DomainNameservers = string[];

export type DomainSetNsRequest = {
  fullDomain: string;
  nameservers: DomainNameservers;
};

export type DomainInquiryRequest = {
  fullDomain: string;
  extraYears?: number;
};

export type DomainInquiryResult = {
  ok: boolean;
  message?: string;
  authCode?: string;
  expiry?: string;
};

export type DomainActionResult = { ok: boolean; message?: string };

export interface DomainRegistrar {
  readonly id: string;
  readonly label: string;
  readonly configured: boolean;

  check(fullDomain: string): Promise<DomainRegistrarCheck>;
  register(req: DomainRegistrationRequest): Promise<DomainRegistrationResult>;
  setNameservers(req: DomainSetNsRequest): Promise<DomainActionResult>;
  getAuthCode(req: DomainInquiryRequest): Promise<DomainInquiryResult>;
  renew(req: DomainInquiryRequest): Promise<DomainInquiryResult>;
}