export type ServiceFailure = { ok: false; error: string; status: number };

export type ServiceSuccess<T = Record<string, never>> = { ok: true } & T;

export type ServiceResult<T = Record<string, never>> = ServiceSuccess<T> | ServiceFailure;

export function fail(status: number, error: string): ServiceFailure {
  return { ok: false, status, error };
}