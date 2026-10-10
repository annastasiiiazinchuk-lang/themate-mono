import { describe, expect, test } from 'bun:test';
import {
  buildMonobankBasketOrder,
  buildMonobankInvoiceRequestBody,
  getMonobankCustomerEmails,
} from '../../lib/services/monobank/monobank-invoice';
import type { CheckoutPayload } from '../../lib/types/checkout';

const basePayload: CheckoutPayload = {
  locale: 'uk',
  payment_type: 'full',
  amount: 1300,
  cart_total: 1200,
  cart_token: 'cart-token',
  customer: {
    first_name: 'Анастасія',
    last_name: 'Зінчук',
    phone: '0682345729',
    email: 'test@example.com',
  },
  shipping_type: 'international',
  shipping: {
    type: 'international',
    country: 'Poland',
    intl_city: 'Warsaw',
    address: 'Test street 1',
    shipping_price: 100,
  },
  goods: [{
    code: 'SKU-1',
    variant_id: '111',
    variant_title: '134-140',
    name: 'Килимок',
    title: 'Килимок',
    price: 600,
    quantity: 2,
    properties: [],
  }],
  comment: '',
  personal_data_consent: true,
  tracking: {},
  utm: {},
};

describe('Monobank invoice payload', () => {
  test('builds fiscal basket order matching invoice amount', () => {
    const basketOrder = buildMonobankBasketOrder(basePayload, 1300);

    expect(basketOrder).toMatchObject([
      {
        name: 'Килимок',
        qty: 2,
        sum: 60000,
        total: 120000,
        code: 'SKU-1',
        unit: 'шт.',
      },
      {
        name: 'Доставка',
        qty: 1,
        sum: 10000,
        total: 10000,
        code: 'shipping',
        unit: 'шт.',
      },
    ]);
    expect(basketOrder.reduce((sum, item) => sum + item.total, 0)).toBe(130000);
  });

  test('falls back to one order item when checkout goods do not match amount', () => {
    const basketOrder = buildMonobankBasketOrder({
      ...basePayload,
      amount: 999,
      cart_total: 999,
      shipping: { type: 'ukraine', shipping_price: 0 },
      goods: [],
    }, 999);

    expect(basketOrder).toHaveLength(1);
    expect(basketOrder[0]).toMatchObject({
      name: 'The Mate order',
      qty: 1,
      sum: 99900,
      total: 99900,
    });
  });

  test('passes checkout email to Monobank receipt emails', () => {
    expect(getMonobankCustomerEmails(basePayload)).toEqual(['test@example.com']);

    const requestBody = buildMonobankInvoiceRequestBody(
      basePayload,
      null,
      1300,
      'checkout-test-reference',
    );

    expect(requestBody.merchantPaymInfo.customerEmails).toEqual(['test@example.com']);
    expect(requestBody.merchantPaymInfo.comment).toBe(requestBody.merchantPaymInfo.destination);
  });
});
