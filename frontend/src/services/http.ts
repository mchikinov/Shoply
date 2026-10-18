import { ApiError } from './ApiError';

export { ApiError } from './ApiError';

/** Выполняет запрос с HttpOnly-сессией текущего сайта; ошибки ответа сохраняют HTTP-статус. */
export async function request<T>(
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
    const message =
      data && typeof data === 'object' && 'error' in data
        ? String(data.error)
        : 'Ошибка запроса.';
    throw new ApiError(message, response.status);
  }
  return data as T;
}
