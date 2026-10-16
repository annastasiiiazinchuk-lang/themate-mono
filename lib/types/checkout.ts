import { z } from 'zod';
import {
  isParcelLocker,
  NOVA_POSHTA_BRANCH_REQUIRED_MESSAGE,
  NOVA_POSHTA_CITY_REQUIRED_MESSAGE,
  NOVA_POSHTA_HOUSE_REQUIRED_MESSAGE,
  NOVA_POSHTA_STREET_REQUIRED_MESSAGE,
  PARCEL_LOCKER_UNAVAILABLE_MESSAGE,
} from '../utils/delivery';

const stringish = z.union([z.string(), z.number()]).optional();
const requiredEmail = z.string().trim()
  .min(1, 'Введіть, будь ласка, e-mail')
  .email('Введіть коректний e-mail');

export const checkoutPayloadSchema = z.object({
  locale: z.string().optional(),
  payment_type: z.enum(['full', 'no_prepayment', 'prepayment', 'installments']).default('full'),
  installments_parts_count: stringish,
  amount: stringish,
  cart_total: stringish,
  cart_token: z.string().optional(),
  customer: z.object({
    first_name: z.string().optional(),
    last_name: z.string().optional(),
    phone: z.string().optional(),
    email: requiredEmail,
  }),
  shipping_type: z.enum(['ukraine', 'international']).default('ukraine'),
  shipping: z.object({
    type: z.enum(['ukraine', 'international']).optional(),
    delivery_method: z.enum(['branch', 'postomat', 'address']).optional(),
    city: z.string().optional(),
    city_ref: z.string().optional(),
    warehouse: z.string().optional(),
    warehouse_ref: z.string().optional(),
    street: z.string().optional(),
    house: z.string().optional(),
    apartment: z.string().optional(),
    country: z.string().optional(),
    country_code: z.string().optional(),
    intl_city: z.string().optional(),
    address: z.string().optional(),
    postcode: z.string().optional(),
    shipping_price: stringish,
  }).default({}),
  goods: z.array(z.object({
    code: stringish,
    variant_id: stringish,
    variant_title: z.string().optional(),
    name: z.string().optional(),
    title: z.string().optional(),
    price: stringish,
    quantity: stringish,
    properties: z.array(z.object({
      name: z.string().optional(),
      value: stringish,
    })).optional(),
  })).default([]),
  comment: z.string().optional(),
  personal_data_consent: z.boolean().optional(),
  tracking: z.record(z.unknown()).optional(),
  utm: z.record(z.unknown()).optional(),
}).superRefine((body, context) => {
  if (body.shipping_type === 'international' || body.shipping.type === 'international') return;

  const deliveryMethod = body.shipping.delivery_method || 'branch';
  const addShippingIssue = (field: string, message: string) => {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['shipping', field],
      message,
    });
  };

  if (deliveryMethod === 'postomat' || isParcelLocker(body.shipping.warehouse)) {
    addShippingIssue('delivery_method', PARCEL_LOCKER_UNAVAILABLE_MESSAGE);
    return;
  }

  if (!body.shipping.city?.trim() || !body.shipping.city_ref?.trim()) {
    addShippingIssue('city_ref', NOVA_POSHTA_CITY_REQUIRED_MESSAGE);
  }

  if (deliveryMethod === 'address') {
    if (!body.shipping.street?.trim()) addShippingIssue('street', NOVA_POSHTA_STREET_REQUIRED_MESSAGE);
    if (!body.shipping.house?.trim()) addShippingIssue('house', NOVA_POSHTA_HOUSE_REQUIRED_MESSAGE);
  } else if (!body.shipping.warehouse?.trim() || !body.shipping.warehouse_ref?.trim()) {
    addShippingIssue('warehouse_ref', NOVA_POSHTA_BRANCH_REQUIRED_MESSAGE);
  }
});

export type CheckoutPayload = z.infer<typeof checkoutPayloadSchema>;

export type PaymentType = 'full' | 'no_prepayment' | 'prepayment' | 'installments';

export interface StoredPaymentMetadata {
  shopifyOrderId: number;
  shopifyOrderName?: string;
  reference: string;
  amount: number;
  paymentType: PaymentType;
  customer: CheckoutPayload['customer'];
  tracking: Record<string, unknown>;
  cartTotal: number;
  goods?: CheckoutPayload['goods'];
}
