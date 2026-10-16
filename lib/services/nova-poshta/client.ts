import { env } from '../../config/env';
import { normalizeSearchText } from '../../utils/format';
import { isParcelLocker } from '../../utils/delivery';

const NOVA_POSHTA_TIMEOUT_MS = 8000;
const NOVA_POSHTA_CACHE_TTL_MS = 30 * 60 * 1000;

const cache = new Map<string, { data: unknown[]; createdAt: number }>();
const pendingRequests = new Map<string, Promise<unknown[]>>();

export const POPULAR_NP_CITIES = [
  { ref: '8d5a980d-391c-11dd-90d9-001a92567626', name: 'Київ', area: 'Київська', settlementType: 'місто' },
  { ref: 'db5c88f5-391c-11dd-90d9-001a92567626', name: 'Львів', area: 'Львівська', settlementType: 'місто' },
  { ref: 'db5c88d0-391c-11dd-90d9-001a92567626', name: 'Одеса', area: 'Одеська', settlementType: 'місто' },
  { ref: 'db5c88f0-391c-11dd-90d9-001a92567626', name: 'Дніпро', area: 'Дніпропетровська', settlementType: 'місто' },
  { ref: 'db5c88e0-391c-11dd-90d9-001a92567626', name: 'Харків', area: 'Харківська', settlementType: 'місто' },
];

export function popularCitiesForQuery(query: string) {
  const normalized = query.trim().toLocaleLowerCase('uk-UA');
  return POPULAR_NP_CITIES.filter((city) => city.name.toLocaleLowerCase('uk-UA').startsWith(normalized));
}

export function mapNovaPoshtaCity(city: Record<string, unknown>) {
  return {
    ref: String(city.Ref || city.ref || ''),
    name: String(city.Description || city.name || ''),
    area: String(city.AreaDescription || city.area || ''),
    settlementType: String(city.SettlementTypeDescription || city.settlementType || ''),
  };
}

async function novaPoshtaRequest(modelName: string, calledMethod: string, methodProperties: Record<string, unknown>) {
  if (!env.novaPoshtaApiKey) throw new Error('Missing NOVA_POSHTA_API_KEY');

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), NOVA_POSHTA_TIMEOUT_MS);

  try {
    const response = await fetch('https://api.novaposhta.ua/v2.0/json/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        apiKey: env.novaPoshtaApiKey,
        modelName,
        calledMethod,
        methodProperties,
      }),
    });
    const text = await response.text();
    let data: Record<string, unknown>;
    try {
      data = text ? JSON.parse(text) as Record<string, unknown> : {};
    } catch {
      throw new Error(`Nova Poshta returned invalid JSON (HTTP ${response.status})`);
    }
    if (!response.ok || data.success === false) {
      const errors = Array.isArray(data.errors) ? data.errors : [];
      const message = errors.length > 0 ? errors.join('; ') : text || response.statusText;
      throw new Error(`Nova Poshta error (HTTP ${response.status}): ${message}`);
    }

    return (data.data || []) as unknown[];
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Nova Poshta request timed out after ${NOVA_POSHTA_TIMEOUT_MS}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function cachedNovaPoshtaRequest(
  cacheKey: string,
  modelName: string,
  calledMethod: string,
  methodProperties: Record<string, unknown>,
): Promise<unknown[]> {
  const normalizedCacheKey = cacheKey.trim().toLocaleLowerCase('uk-UA');
  const cached = cache.get(normalizedCacheKey);
  if (cached && Date.now() - cached.createdAt < NOVA_POSHTA_CACHE_TTL_MS) {
    console.log(`Nova Poshta cache hit: ${normalizedCacheKey}`);
    return cached.data;
  }

  const pending = pendingRequests.get(normalizedCacheKey);
  if (pending) return pending;

  const startedAt = Date.now();
  const request = (async () => {
    try {
      const data = await novaPoshtaRequest(modelName, calledMethod, methodProperties);
      cache.set(normalizedCacheKey, { data, createdAt: Date.now() });
      console.log(`Nova Poshta loaded: ${normalizedCacheKey} in ${Date.now() - startedAt}ms`);
      return data;
    } catch (error) {
      if (cached) {
        console.warn(`Nova Poshta timeout/error, returning stale cache for ${normalizedCacheKey}:`, error);
        return cached.data;
      }
      throw error;
    } finally {
      pendingRequests.delete(normalizedCacheKey);
    }
  })();
  pendingRequests.set(normalizedCacheKey, request);
  return request;
}

export async function searchCities(queryValue: unknown) {
  const query = normalizeSearchText(queryValue);
  if (query.length < 2) return [];

  const popularMatches = popularCitiesForQuery(query);
  if (popularMatches.length > 0) return popularMatches;

  const cities = await cachedNovaPoshtaRequest(`cities:${query.toLocaleLowerCase('uk-UA')}`, 'Address', 'getCities', {
    FindByString: query,
    Limit: '20',
  });

  return cities.map((city) => mapNovaPoshtaCity(city as Record<string, unknown>)).filter((city) => city.ref && city.name);
}

export async function searchWarehouses(params: { city?: string; cityRef?: string; query?: string }) {
  const city = normalizeSearchText(params.city);
  const cityRef = String(params.cityRef || '').trim();
  const query = normalizeSearchText(params.query);
  if (!city && !cityRef) return [];

  const warehouses = await cachedNovaPoshtaRequest(
    `warehouses:${cityRef || city}:${query}`,
    'AddressGeneral',
    'getWarehouses',
    {
      ...(cityRef ? { CityRef: cityRef } : { CityName: city }),
      ...(query ? { FindByString: query } : {}),
      Limit: '50',
    },
  );

  return warehouses.filter((warehouse) => {
    const item = warehouse as Record<string, unknown>;
    return ![item.CategoryOfWarehouse, item.Description, item.DescriptionRu].some(isParcelLocker);
  }).map((warehouse) => {
    const item = warehouse as Record<string, unknown>;
    return {
      ref: String(item.Ref || ''),
      name: String(item.Description || ''),
      number: item.Number,
      cityRef: item.CityRef,
    };
  });
}
