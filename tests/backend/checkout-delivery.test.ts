import { describe, expect, test } from 'bun:test';
import { checkoutPayloadSchema } from '../../lib/types/checkout';
import { PARCEL_LOCKER_UNAVAILABLE_MESSAGE } from '../../lib/utils/delivery';

const checkout = {
  customer: { email: 'customer@example.com' },
  shipping_type: 'ukraine',
  shipping: { delivery_method: 'branch', warehouse: 'Відділення №12' },
};

describe('The mate delivery restrictions', () => {
  test('rejects a parcel locker selected in an older checkout', () => {
    const result = checkoutPayloadSchema.safeParse({
      ...checkout,
      shipping: { delivery_method: 'postomat', warehouse: '№1234' },
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
        shipping: { delivery_method: 'branch', warehouse },
      }).success).toBe(false);
      expect(checkoutPayloadSchema.safeParse({
        ...checkout,
        shipping: { warehouse },
      }).success).toBe(false);
    },
  );

  test('keeps branch and courier delivery available', () => {
    expect(checkoutPayloadSchema.safeParse(checkout).success).toBe(true);
    expect(checkoutPayloadSchema.safeParse({
      ...checkout,
      shipping: { delivery_method: 'address', street: 'Хрещатик', house: '1' },
    }).success).toBe(true);
  });

  test('keeps international address delivery available', () => {
    expect(checkoutPayloadSchema.safeParse({
      ...checkout,
      shipping_type: 'international',
      shipping: { type: 'international', country: 'Poland', intl_city: 'Warsaw', address: 'Main street 1' },
    }).success).toBe(true);
  });
});
