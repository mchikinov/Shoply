import { request } from './http';
import type { Session } from '@/types/api';
export interface Credentials {
  username: string;
  password: string;
}
/** Читает сессию из HttpOnly cookie. */
export const fetchSession = () => request<Session>('/api/session');
/** Создаёт первого администратора или выполняет вход через существующий API. */
export const signIn = (credentials: Credentials, setup: boolean) =>
  request(setup ? '/api/setup' : '/api/login', credentials);
/** Завершает серверную сессию. */
export const signOut = () => request('/api/logout', {});
