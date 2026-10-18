/** Возвращает текст исключения или общее сообщение для неизвестной ошибки. */
export const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : 'Не удалось выполнить действие.';
