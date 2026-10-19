import { computed, nextTick, onMounted, reactive, ref } from 'vue';
import type { Product, ProductInput } from '@/types/api';
import { useAuthStore } from '@/stores/auth';
import { useCatalogStore } from '@/stores/catalog';
import { useNotificationsStore } from '@/stores/notifications';
import { saveProduct, deleteProduct } from '@/services/products';
/** Создаёт независимый черновик; изменения каталога происходят только после ответа сервера. */
export function useProductEditor(
  product: Product | null,
  onDeleted: () => void,
) {
  const auth = useAuthStore();
  const catalog = useCatalogStore();
  const { announce: notify, fail } = useNotificationsStore();
  const saving = ref(false);
  const uploading = ref(false);
  const formEl = ref<HTMLFormElement>();
  type ProductDraft = Omit<ProductInput, 'price'> & { price: number | '' };

  /** Создаёт пустой черновик с отдельными массивами для каждой новой формы. */
  const createEmptyDraft = (): ProductDraft => ({
    id: null,
    name: '',
    category: '',
    price: '',
    description: '',
    photo: 0,
    photos: [],
    properties: [],
  });

  /** Копирует вложенные данные, чтобы правки формы не меняли каталог до сохранения. */
  function copyProductDraft(product: Product): ProductDraft {
    return {
      ...product,
      photos: [...product.photos],
      properties: product.properties.map((property) => ({ ...property })),
    };
  }

  const form = reactive<ProductDraft>(createEmptyDraft());
  const categories = computed(() => [
    ...new Set(catalog.products.map((product) => product.category)),
  ]);

  /** Создаёт независимый черновик товара и переводит фокус в открытую форму. */
  async function edit(product: Product | null) {
    if (uploading.value || saving.value) return;
    Object.assign(
      form,
      product ? copyProductDraft(product) : createEmptyDraft(),
    );
    await nextTick();
    formEl.value?.querySelector<HTMLInputElement>('[name=name]')?.focus();
    formEl.value?.scrollIntoView({ block: 'start' });
  }

  /** Сохраняет черновик и перечитывает каталог; повторная отправка блокируется. */
  async function save() {
    if (saving.value || uploading.value) return;
    saving.value = true;
    try {
      const saved = await auth.run(() =>
        saveProduct({
          ...form,
          price: Number(form.price),
          photos: [...form.photos],
          properties: form.properties.map((product) => ({ ...product })),
        }),
      );
      await catalog.refresh();
      const product = catalog.products.find(
        (product) => product.id === saved.id,
      );
      if (product) Object.assign(form, copyProductDraft(product));
      notify('Товар сохранён.');
    } catch (error) {
      fail(error);
    } finally {
      saving.value = false;
    }
  }

  /** Удаляет товар после подтверждения, сохраняя состав ранее оформленных заказов. */
  async function remove() {
    if (
      saving.value ||
      uploading.value ||
      form.id === null ||
      !confirm(
        'Удалить товар из каталога? Состав уже оформленных заказов сохранится.',
      )
    )
      return;
    saving.value = true;
    try {
      await auth.run(() => deleteProduct(form.id!));
      onDeleted();
      await catalog.refresh();
      notify('Товар удалён из каталога.');
    } catch (error) {
      fail(error);
    } finally {
      saving.value = false;
    }
  }

  /** Добавляет пустое свойство в пределах серверного ограничения в 40 записей. */
  function addProperty() {
    if (form.properties.length >= 40) notify('Максимум 40 свойств.', true);
    else form.properties.push({ name: '', description: '' });
  }

  onMounted(() => {
    void edit(product);
  });
  return {
    form,
    formEl,
    saving,
    uploading,
    categories,
    save,
    remove,
    addProperty,
  };
}
