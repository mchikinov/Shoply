/** Читает сохранённую корзину с проверкой данных; запрет хранилища не блокирует покупки. */
export function readBasket(): Record<number, number> {
  const basket: Record<number, number> = {};
  try {
    const saved = JSON.parse(localStorage.getItem('shoply-basket') || '{}');
    if (!saved || typeof saved !== 'object' || Array.isArray(saved))
      return basket;
    for (const [id, quantity] of Object.entries(saved)) {
      if (
        Number.isInteger(Number(id)) &&
        Number(id) >= 0 &&
        Number.isInteger(quantity) &&
        Number(quantity) > 0 &&
        Number(quantity) <= 999
      )
        basket[Number(id)] = Number(quantity);
    }
  } catch {
    /* Malformed or unavailable storage falls back to an empty basket. */
  }
  return basket;
}
