import { env } from '../../config/env';
import type { CheckoutPayload, PaymentType } from '../../types/checkout';
import { asNumber, asString, parseJsonObject } from '../../utils/format';

const MONOBANK_API_URL = 'https://api.monobank.ua/api/merchant/invoice/create';

export interface MonobankInvoice {
  invoiceUrl: string;
  invoiceId: string;
  reference: string;
  amount: number;
  paymentType: PaymentType;
}

export interface MonobankBasketOrderItem {
  name: string;
  qty: number;
  sum: number;
  total: number;
  unit: string;
  code: string;
  barcode: null;
  header: null;
  footer: null;
  tax: unknown[];
  uktzed: null;
}

function createCheckoutReference(): string {
  return `checkout-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function toCoins(value: unknown): number {
  return Math.max(0, Math.round(asNumber(value) * 100));
}

function basketItem(params: {
  name: string;
  qty: number;
  sum: number;
  code: string;
}): MonobankBasketOrderItem {
  return {
    name: params.name.trim().slice(0, 128) || 'The Mate order',
    qty: params.qty,
    sum: params.sum,
    total: params.sum * params.qty,
    unit: 'шт.',
    code: params.code.trim().slice(0, 128) || `item-${Date.now()}`,
    barcode: null,
    header: null,
    footer: null,
    tax: [],
    uktzed: null,
  };
}

export function buildMonobankBasketOrder(body: CheckoutPayload, amount: number): MonobankBasketOrderItem[] {
  const targetTotal = toCoins(amount);
  if (targetTotal <= 0) return [];

  const items = (body.goods || [])
    .map((item, index) => {
      const qty = Math.max(1, Math.round(Number(item.quantity || 1)));
      const sum = toCoins(item.price);
      if (sum <= 0) return null;

      return basketItem({
        name: asString(item.name || item.title || item.variant_title) || 'The Mate product',
        qty,
        sum,
        code: asString(item.code || item.variant_id) || `item-${index + 1}`,
      });
    })
    .filter((item): item is MonobankBasketOrderItem => Boolean(item));

  const shippingPrice = toCoins(body.shipping?.shipping_price);
  if (shippingPrice > 0) {
    items.push(basketItem({
      name: 'Доставка',
      qty: 1,
      sum: shippingPrice,
      code: 'shipping',
    }));
  }

  const itemsTotal = items.reduce((sum, item) => sum + item.total, 0);
  if (items.length && itemsTotal === targetTotal) return items;

  return [basketItem({
    name: 'The Mate order',
    qty: 1,
    sum: targetTotal,
    code: `order-${Date.now()}`,
  })];
}

export async function createMonobankInvoice(
  body: CheckoutPayload,
  shopifyOrder: { id: number; name: string } | null,
  amount: number,
): Promise<MonobankInvoice> {
  if (!env.monoToken) throw new Error('Missing MONO_TOKEN');
  if (!env.webhookUrl) throw new Error('Missing WEBHOOK_URL');
  if (amount <= 0) throw new Error('Amount must be greater than 0');

  const customer = body.customer || {};
  const customerName = `${asString(customer.first_name)} ${asString(customer.last_name)}`.trim() || 'Customer';
  const customerPhone = asString(customer.phone);
  const reference = shopifyOrder?.id
    ? `shopify-${shopifyOrder.id}-${Date.now()}`
    : createCheckoutReference();
  const requestBody = {
    amount: Math.round(amount * 100),
    ccy: 980,
    merchantPaymInfo: {
      reference,
      destination: shopifyOrder?.name
        ? `Order ${shopifyOrder.name}: ${customerName}${customerPhone ? ` (${customerPhone})` : ''}`
        : `Themate checkout: ${customerName}${customerPhone ? ` (${customerPhone})` : ''}`,
      basketOrder: buildMonobankBasketOrder(body, amount),
    },
    redirectUrl: env.redirectUrl,
    webHookUrl: env.webhookUrl,
  };

  console.log('Creating monobank invoice:', {
    amount: requestBody.amount,
    paymentType: body.payment_type || 'full',
    redirectUrl: requestBody.redirectUrl,
    webHookUrl: requestBody.webHookUrl,
  });

  const response = await fetch(MONOBANK_API_URL, {
    method: 'POST',
    headers: {
      'X-Token': env.monoToken,
      'Content-Type': 'application/json',
      Accept: '*/*',
    },
    body: JSON.stringify(requestBody),
  });

  const text = await response.text();
  if (!response.ok) throw new Error(`Monobank error ${response.status}: ${text}`);

  const data = parseJsonObject<{ pageUrl?: string; invoiceId?: string }>(text, 'Monobank');
  if (!data.pageUrl) throw new Error('Monobank response missing pageUrl');
  if (!data.invoiceId) throw new Error('Monobank response missing invoiceId');

  return {
    invoiceUrl: data.pageUrl,
    invoiceId: data.invoiceId,
    reference,
    amount,
    paymentType: body.payment_type === 'prepayment' ? 'prepayment' : 'full',
  };
}
