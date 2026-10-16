export const PARCEL_LOCKER_UNAVAILABLE_MESSAGE = 'Доставка на поштомат недоступна. Оберіть відділення або адресну доставку.';
export const NOVA_POSHTA_CITY_REQUIRED_MESSAGE = 'Оберіть населений пункт зі списку Нової пошти.';
export const NOVA_POSHTA_BRANCH_REQUIRED_MESSAGE = 'Оберіть відділення зі списку Нової пошти.';
export const NOVA_POSHTA_STREET_REQUIRED_MESSAGE = 'Вкажіть вулицю для адресної доставки.';
export const NOVA_POSHTA_HOUSE_REQUIRED_MESSAGE = 'Вкажіть номер будинку для адресної доставки.';

export function isParcelLocker(value: unknown): boolean {
  return /поштомат|почтомат|postomat|parcel\s*locker|paczkomat/i.test(String(value || ''));
}
