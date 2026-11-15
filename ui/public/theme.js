(() => {
  const key = 'concert-theme';
  const stored = localStorage.getItem(key);
  const system = window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  const theme = stored === 'light' || stored === 'dark' ? stored : system;

  document.documentElement.dataset.theme = theme;

  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) {
    meta.setAttribute('content', theme === 'light' ? '#fbfafc' : '#0d0a11');
  }
})();
