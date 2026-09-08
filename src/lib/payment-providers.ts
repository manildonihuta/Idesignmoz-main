export type PaymentMethodId =
  | "mpesa"
  | "emola"
  | "mkesh"
  | "visa"
  | "mastercard"
  | "bank-transfer";

export type PaymentIntent = {
  method: PaymentMethodId;
  amount: number;
  currency: string;
  reference: string;
  customerPhone?: string;
  customerName?: string;
};

export type PaymentResult = {
  success: boolean;
  reference: string;
  message?: string;
};

/**
 * Contrato comum para todos os gateways de pagamento.
 * Para adicionar um novo método, basta implementar esta interface e
 * registá-lo no mapa PROVIDERS — o checkout não muda.
 */
export interface PaymentProvider {
  readonly id: PaymentMethodId;
  readonly name: string;
  readonly description: string;
  readonly kind: "mobile-money" | "card" | "bank";
  /** Inicia ou valida um pagamento para o intent fornecido. */
  process(intent: PaymentIntent): Promise<PaymentResult>;
}

/**
 * Base genérica para wallets de dinheiro móvel (M-Pesa, e-Mola, mKesh).
 * A validação real pode ser ligada a um SDK aqui sem tocar no checkout.
 */
abstract class MobileMoneyProvider implements PaymentProvider {
  abstract readonly id: PaymentMethodId;
  abstract readonly name: string;
  abstract readonly description: string;
  readonly kind = "mobile-money" as const;

  async process(intent: PaymentIntent): Promise<PaymentResult> {
    if (!intent.customerPhone) {
      return { success: false, reference: intent.reference, message: `${this.name}: número de telemóvel em falta.` };
    }
    return {
      success: true,
      reference: intent.reference,
      message: `${this.name}: pedido de pagamento enviado para ${intent.customerPhone}. Confirme no seu telemóvel.`,
    };
  }
}

class MpesaProvider extends MobileMoneyProvider {
  readonly id = "mpesa" as const;
  readonly name = "M-Pesa";
  readonly description = "Pague com M-Pesa (Vodacom).";
}

class EMolaProvider extends MobileMoneyProvider {
  readonly id = "emola" as const;
  readonly name = "e-Mola";
  readonly description = "Pague com e-Mola (Movitel).";
}

class MKeshProvider extends MobileMoneyProvider {
  readonly id = "mkesh" as const;
  readonly name = "mKesh";
  readonly description = "Pague com mKesh (TMCEL).";
}

/**
 * Base genérica para cartões (Visa, Mastercard) — ligar aqui o SDK do gateway
 * de cartões (ex. Stripe, PayGate) sem alterar o checkout.
 */
abstract class CardProvider implements PaymentProvider {
  abstract readonly id: PaymentMethodId;
  abstract readonly name: string;
  abstract readonly description: string;
  readonly kind = "card" as const;

  async process(intent: PaymentIntent): Promise<PaymentResult> {
    return {
      success: true,
      reference: intent.reference,
      message: `${this.name}: cartão autorizado para ${intent.amount} ${intent.currency}.`,
    };
  }
}

class VisaProvider extends CardProvider {
  readonly id = "visa" as const;
  readonly name = "Visa";
  readonly description = "Pague com cartão Visa.";
}

class MastercardProvider extends CardProvider {
  readonly id = "mastercard" as const;
  readonly name = "Mastercard";
  readonly description = "Pague com cartão Mastercard.";
}

class BankTransferProvider implements PaymentProvider {
  readonly id = "bank-transfer" as const;
  readonly name = "Bank Transfer";
  readonly description = "Pague por transferência bancária. Os dados da conta serão mostrados na confirmação.";
  readonly kind = "bank" as const;

  async process(intent: PaymentIntent): Promise<PaymentResult> {
    return {
      success: true,
      reference: intent.reference,
      message: "Transferência bancária registada. Enviaremos os dados da conta e a factura proforma por email.",
    };
  }
}

/** Registo central de métodos de pagamento disponíveis. */
export const PROVIDERS: Record<PaymentMethodId, PaymentProvider> = {
  mpesa: new MpesaProvider(),
  emola: new EMolaProvider(),
  mkesh: new MKeshProvider(),
  visa: new VisaProvider(),
  mastercard: new MastercardProvider(),
  "bank-transfer": new BankTransferProvider(),
};

export const PAYMENT_METHODS: PaymentProvider[] = Object.values(PROVIDERS);

export function getProvider(id: PaymentMethodId): PaymentProvider | undefined {
  return PROVIDERS[id];
}

export function generateReference(): string {
  return `IDM-${Date.now().toString(36).toUpperCase()}`;
}
