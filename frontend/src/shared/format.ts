import type { Product } from './types';

/** Форматирует сумму в рублях с русскими разделителями разрядов. */
export const fmt = (value: number) => value.toLocaleString('ru-RU') + ' ₽';

/** Выбирает форму слова «товар» для целого количества. */
export const plural = (count: number) =>
  count % 10 === 1 && count % 100 !== 11
    ? 'товар'
    : count % 10 >= 2 && count % 10 <= 4 && (count % 100 < 12 || count % 100 > 14)
      ? 'товара'
      : 'товаров';

/** Экранирует URL фотографии через JSON, чтобы он оставался внутри CSS-значения url. */
export const photoStyle = (product: Pick<Product, 'photos'>, index = 0) =>
  product.photos?.length
    ? {
        backgroundImage: 'url(' + JSON.stringify(product.photos[index]) + ')',
        backgroundSize: 'contain',
        backgroundPosition: 'center',
      }
    : {};
