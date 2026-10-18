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
