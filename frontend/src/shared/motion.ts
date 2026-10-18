/** Заменяет текущие анимации появления с учётом настройки уменьшенного движения. */
export function animateAppearance(
  element: HTMLElement | null,
  distance = 8,
  duration = 240,
  delay = 0,
) {
  if (
    !element?.animate ||
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
    return;
  element.getAnimations().forEach((animation) => animation.cancel());
  element.animate(
    [
      { opacity: 0, transform: `translateY(${distance}px)` },
      { opacity: 1, transform: 'translateY(0)' },
    ],
    { duration, delay, easing: 'cubic-bezier(.2,.7,.2,1)', fill: 'backwards' },
  );
}
