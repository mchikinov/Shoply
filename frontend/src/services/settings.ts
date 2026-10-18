import { request } from './http';
import type { Settings } from '@/types/api';
/** Сохраняет оформление магазина в текущей сессии администратора. */
export const saveSettings = (settings: Settings) =>
  request('/api/admin/settings', settings);
