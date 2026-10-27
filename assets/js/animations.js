
(() => {
  const preference = window.matchMedia('(prefers-reduced-motion: reduce)');

  if (preference.matches || !('IntersectionObserver' in window)) return;

  const elements = document.querySelectorAll('[data-reveal]');

  const observer = new IntersectionObserver(entries =>
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      }
    }),
    {
      threshold: 0.08,
      rootMargin: '0px 0px -20px 0px'
    }
  );

  document.documentElement.classList.add('motion-ready');

  elements.forEach(el => observer.observe(el));

  preference.addEventListener('change', e => {
    if (e.matches) {
      document.documentElement.classList.remove('motion-ready');
      observer.disconnect();
    }
  });
})();
