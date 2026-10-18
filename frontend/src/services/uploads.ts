import { request } from './http';
import { readImageData } from '@/utils/files';
/** Загружает изображение через JSON API; возвращает серверный путь файла. */
export async function uploadImage(file: File): Promise<string> {
  const data = await readImageData(file);
  return (await request<{ path: string }>('/api/admin/upload', { data })).path;
}
