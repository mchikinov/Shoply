import type { Shop } from './types';

import { ApiError } from './ApiError';

export { ApiError } from './ApiError';

/** Выполняет запрос с HttpOnly-сессией текущего сайта; ошибки ответа сохраняют HTTP-статус. */
export async function api<T>(
  path: string,
  body?: object,
  method = 'POST',
): Promise<T> {
  const response = await fetch(
    path,
    body === undefined
      ? { credentials: 'same-origin' }
      : {
          method,
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        },
  );
  let data: unknown;
  try {
    data = await response.json();
  } catch {
    throw new ApiError('Сервер вернул некорректный ответ.', response.status);
  }
  if (!response.ok) {
    /** Возвращает текст исключения или общее сообщение для неизвестной ошибки. */
    const message =
      data && typeof data === 'object' && 'error' in data
        ? String(data.error)
        : 'Ошибка запроса.';
    throw new ApiError(message, response.status);
  }
  return data as T;
}

/** Проверяет структуру каталога перед передачей данных в реактивное состояние. */
export async function loadShop(): Promise<Shop> {
  const data = await api<Shop>('/api/shop');
  if (
    !data ||
    !Array.isArray(data.products) ||
    !data.settings ||
    !data.products.every(
      (product) =>
        Number.isInteger(product.id) &&
        typeof product.name === 'string' &&
        typeof product.category === 'string' &&
        Number.isFinite(product.price) &&
        product.price > 0 &&
        Array.isArray(product.photos) &&
        Array.isArray(product.properties),
    )
  ) {
    throw new Error('Некорректные данные каталога.');
  }
  return data;
}

/** Возвращает текст исключения или общее сообщение для неизвестной ошибки. */
export const message = (error: unknown) =>
  error instanceof Error ? error.message : 'Не удалось выполнить действие.';

/** Читает изображение в base64 для JSON-загрузки; отклоняет файлы больше 6 МБ. */
export async function readImageData(file: File): Promise<string> {
  if (file.size > 6000000) throw new Error('Максимум 6 МБ на фотографию.');
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1]);
    reader.onerror = () => reject(new Error('Не удалось прочитать файл.'));
    reader.readAsDataURL(file);
  });
}
