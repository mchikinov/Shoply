import type { Router } from 'vue-router';
/** Приводит старый hash к новому формату без новой записи в истории браузера. */
export function normalizeLegacyHash() {
  const hash = window.location.hash;
  if (hash.length > 1 && !hash.startsWith('#/'))
    window.history.replaceState(
      window.history.state,
      '',
      window.location.pathname + window.location.search + '#/' + hash.slice(1),
    );
}
/** Поддерживает старые ссылки и после запуска приложения, включая переходы назад/вперёд. */
export function supportLegacyLinks(router: Router) {
  router.afterEach((_to, _from, failure) => {
    if (!failure) normalizeLegacyHash();
  });
}
