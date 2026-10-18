/** Хранит HTTP-статус ошибки для сброса истёкшей сессии админки. */
export class ApiError extends Error {
  /** Сохраняет сообщение и HTTP-статус исходного ответа сервера. */
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
