/* Apply before styles load to avoid a flash of the wrong theme. */
(() => {
  const root = document.documentElement;
  const preference = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
  let saved = null;
  try { saved = localStorage.getItem('shoply-theme'); } catch (_) {}
  if (saved !== 'light' && saved !== 'dark') saved = null;
  let ready = false;
  let transitionTimer;
  const apply = (theme) => {
    if (ready && root.dataset.theme !== theme) {
      clearTimeout(transitionTimer);
      root.dataset.themeTransition = "true";
      // Установить переходы до изменения значений палитры.
      void root.offsetWidth;
      transitionTimer = setTimeout(() => {
        delete root.dataset.themeTransition;
      }, 360);
    }
    root.dataset.theme = theme;
    const button = document.querySelector('#theme-toggle');
    if (!button) return;
    const dark = theme === 'dark';
    const label = dark ? 'Включить светлую тему' : 'Включить тёмную тему';
    button.setAttribute('aria-pressed', String(dark));
    button.setAttribute('aria-label', label);
    button.title = label;
  };
  apply(saved || (preference && preference.matches ? 'dark' : 'light'));
  document.addEventListener('DOMContentLoaded', () => {
    apply(root.dataset.theme);
    ready = true;
    document.querySelector('#theme-toggle')?.addEventListener('click', () => {
      saved = root.dataset.theme === 'dark' ? 'light' : 'dark';
      try { localStorage.setItem('shoply-theme', saved); } catch (_) {}
      apply(saved);
    });
  });
  preference?.addEventListener('change', (event) => {
    if (!saved) apply(event.matches ? 'dark' : 'light');
  });
  window.addEventListener('storage', (event) => {
    if (event.key !== 'shoply-theme' && event.key !== null) return;
    saved = event.newValue === 'dark' || event.newValue === 'light' ? event.newValue : null;
    apply(saved || (preference?.matches ? 'dark' : 'light'));
  });
})();
