import { describe, expect, spyOn, test } from 'bun:test';
import { env } from '../../lib/config/env';
import {
  mapNovaPoshtaCity,
  popularCitiesForQuery,
  searchWarehouses,
} from '../../lib/services/nova-poshta/client';

describe('Nova Poshta helpers', () => {
  test('maps Nova Poshta city response', () => {
    expect(mapNovaPoshtaCity({
      Ref: 'city-ref',
      Description: 'Київ',
      AreaDescription: 'Київська',
      SettlementTypeDescription: 'місто',
    })).toEqual({
      ref: 'city-ref',
      name: 'Київ',
      area: 'Київська',
      settlementType: 'місто',
    });
  });

  test('finds popular city by prefix', () => {
    expect(popularCitiesForQuery('Ки').map((city) => city.name)).toContain('Київ');
  });

  test('warehouse search excludes parcel lockers and retains branches', async () => {
    const apiKey = env.novaPoshtaApiKey;
    env.novaPoshtaApiKey = 'test-key';
    const fetchMock = spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      success: true,
      data: [
        { Ref: 'branch', Description: 'Відділення №12', Number: '12', CityRef: 'test-city' },
        { Ref: 'locker-name', Description: 'Поштомат №1234' },
        { Ref: 'locker-category', Description: '№5678', CategoryOfWarehouse: 'Postomat' },
        { Ref: 'locker-ru', Description: '№9012', DescriptionRu: 'Почтомат №9012' },
      ],
    })));
    try {
      expect(await searchWarehouses({ cityRef: 'parcel-locker-filter-test-city' })).toEqual([
        { ref: 'branch', name: 'Відділення №12', number: '12', cityRef: 'test-city' },
      ]);
    } finally {
      fetchMock.mockRestore();
      env.novaPoshtaApiKey = apiKey;
    }
  });

  test('shares concurrent warehouse lookups for the same city and query', async () => {
    const apiKey = env.novaPoshtaApiKey;
    env.novaPoshtaApiKey = 'test-key';
    let requestCount = 0;
    const fetchMock = spyOn(globalThis, 'fetch').mockImplementation((async () => {
      requestCount += 1;
      await new Promise((resolve) => setTimeout(resolve, 10));
      return new Response(JSON.stringify({
        success: true,
        data: [{ Ref: 'branch-88', Description: 'Відділення №88', Number: '88' }],
      }));
    }) as unknown as typeof fetch);
    try {
      const params = { cityRef: 'concurrent-lookup-test-city', query: '88' };
      const [first, second] = await Promise.all([
        searchWarehouses(params),
        searchWarehouses(params),
      ]);

      expect(first).toEqual(second);
      expect(requestCount).toBe(1);
    } finally {
      fetchMock.mockRestore();
      env.novaPoshtaApiKey = apiKey;
    }
  });
});
