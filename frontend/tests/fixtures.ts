import type { Product, Settings } from '@/types/api';
export const product: Product = {
  id: 0,
  name: 'Лампа <Сфера>',
  price: 4900,
  category: 'Дом',
  photo: 0,
  photos: [],
  properties: [{ name: 'Материал', description: 'Металл' }],
  description: 'Описание лампы',
};
export const settings: Settings = {
  name: 'Shoply',
  logo: '',
  accent: '#2864e8',
  background: '#ffffff',
  text: '#182231',
  telegram: '',
};
export const response = (data: unknown, status = 200) => ({
  ok: status < 400,
  status,
  json: async () => data,
});
