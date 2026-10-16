import { describe, expect, test } from 'bun:test';
import { checkoutPayloadSchema } from '../../lib/types/checkout';
import { PARCEL_LOCKER_UNAVAILABLE_MESSAGE } from '../../lib/utils/delivery';

const checkout = {
  customer: { email: 'customer@example.com' },
  shipping_type: 'ukraine',
  shipping: {
    delivery_method: 'branch',
    city: 'Київ',
    city_ref: 'city-ref-kyiv',
    warehouse: 'Відділення №12',
    warehouse_ref: 'warehouse-ref-12',
  },
};

describe('The mate delivery restrictions', () => {
  test('rejects a parcel locker selected in an older checkout', () => {
    const result = checkoutPayloadSchema.safeParse({
      ...checkout,
      shipping: { ...checkout.shipping, delivery_method: 'postomat', warehouse: '№1234' },
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues).toContainEqual(expect.objectContaining({
        path: ['shipping', 'delivery_method'],
        message: PARCEL_LOCKER_UNAVAILABLE_MESSAGE,
      }));
    }
  });

  test.each(['Поштомат №1234', 'Почтомат №1234', 'Parcel locker 1234', 'Paczkomat 1234'])(
    'rejects a parcel locker submitted as a branch: %s',
    (warehouse) => {
      expect(checkoutPayloadSchema.safeParse({
        ...checkout,
        shipping: { ...checkout.shipping, delivery_method: 'branch', warehouse },
      }).success).toBe(false);
      expect(checkoutPayloadSchema.safeParse({
        ...checkout,
        shipping: { ...checkout.shipping, warehouse },
      }).success).toBe(false);
    },
  );

  test('keeps branch and courier delivery available', () => {
    expect(checkoutPayloadSchema.safeParse(checkout).success).toBe(true);
    expect(checkoutPayloadSchema.safeParse({
      ...checkout,
      shipping: {
        delivery_method: 'address',
        city: 'Київ',
        city_ref: 'city-ref-kyiv',
        street: 'Хрещатик',
        house: '1',
      },
    }).success).toBe(true);
  });

  test('rejects free-text city and branch names without Nova Poshta references', () => {
    const result = checkoutPayloadSchema.safeParse({
      ...checkout,
      shipping: {
        delivery_method: 'branch',
        city: 'Брюховичі 1',
        warehouse: '',
      },
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.path.join('.') === 'shipping.city_ref')).toBe(true);
      expect(result.error.issues.some((issue) => issue.path.join('.') === 'shipping.warehouse_ref')).toBe(true);
    }
  });

  test('rejects a branch without its Nova Poshta warehouse reference', () => {
    expect(checkoutPayloadSchema.safeParse({
      ...checkout,
      shipping: { ...checkout.shipping, warehouse_ref: '' },
    }).success).toBe(false);
  });

  test('keeps international address delivery available', () => {
    expect(checkoutPayloadSchema.safeParse({
      ...checkout,
      shipping_type: 'international',
      shipping: { type: 'international', country: 'Poland', intl_city: 'Warsaw', address: 'Main street 1' },
    }).success).toBe(true);
  });
});
