import { request } from './http';

type TestDataResult = { ok: boolean; count: number };

/** Создаёт набор обычных товаров с серверной отметкой происхождения. */
export const createTestData = (count: number) =>
  request<TestDataResult>('/api/admin/test-data', { count });

/** Удаляет все товары генератора, сохраняя заказы и обычные товары. */
export const deleteTestData = () =>
  request<TestDataResult>('/api/admin/test-data', {}, 'DELETE');
