export type ProvisionStepState = "pending" | "running" | "ok" | "skipped" | "error";

export type ProvisionStep = {
  id: string;
  label: string;
  state: ProvisionStepState;
  detail?: string;
};

export type ProvisionFlowResult = {
  ok: boolean;
  mode: "live" | "simulated";
  provider: string;
  steps: ProvisionStep[];
  data?: unknown;
  error?: string;
};