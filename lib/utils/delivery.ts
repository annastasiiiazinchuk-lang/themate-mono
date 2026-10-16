export const PARCEL_LOCKER_UNAVAILABLE_MESSAGE = 'Доставка на поштомат недоступна. Оберіть відділення або адресну доставку.';

export function isParcelLocker(value: unknown): boolean {
  return /поштомат|почтомат|postomat|parcel\s*locker|paczkomat/i.test(String(value || ''));
}
