import { NextRequest } from "next/server";

import { getSiteSettings } from "@/lib/site-settings";
import { getFxRates, getBaseCurrency } from "@/lib/money";
import { applyRateLimit, rateLimitResponse, clientIp } from "@/lib/security/rate-limit";

export const dynamic = "force-dynamic";

/**
 * Public, read-only snapshot of the non-secret site settings the storefront
 * needs to render live (branding, tax, currency + FX rates, contact, what's
 * enabled). Never exposes SMTP/gateway secrets.
 */
export async function GET(request: NextRequest) {
  const ip = clientIp(request);
  const limited = await applyRateLimit(request, {
    prefix: "site-settings-public",
    limit: 120,
    windowSec: 60,
    ip,
  });
  if (!limited.ok) return rateLimitResponse(limited.retryAfterSec);

  const s = await getSiteSettings();
  const baseCurrency = await getBaseCurrency();
  const rates = await getFxRates();

  const ratesPublic = Object.fromEntries(
    Object.entries(rates).map(([code, r]) => [code, r.mznPerUnitMillis / 1000]),
  );

  return Response.json({
    ok: true,
    settings: {
      general: {
        siteName: s.general.siteName,
        tagline: s.general.tagline,
        supportEmail: s.general.supportEmail,
        supportPhone: s.general.supportPhone,
        maintenanceMode: s.general.maintenanceMode,
      },
      branding: s.branding,
      tax: {
        rate: s.tax.rate,
        includedInPrices: s.tax.includedInPrices,
        taxName: s.tax.taxName,
      },
      currency: {
        base: baseCurrency,
        rates: ratesPublic,
      },
      payments: {
        defaultMethod: s.payments.defaultMethod,
        defaultCurrency: s.payments.defaultCurrency,
      },
      whatsapp: {
        phoneNumber: s.whatsapp.phoneNumber,
        defaultMessage: s.whatsapp.defaultMessage,
        enabled: s.whatsapp.enabled,
      },
      seo: {
        analyticsEnabled: s.seo.analyticsEnabled,
      },
    },
  });
}