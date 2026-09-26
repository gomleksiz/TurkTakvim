// ── 12 Hayvanlı Türk Takvimi · ortak betik ──────────────────────────
// Tema düğmesi (açık / koyu), paylaşım ve kısa bildirim.
// Kayıtlı tema, sayfa başındaki tek satırlık betikle erkenden uygulanır.

(function () {
  const KEY   = 'tt-theme';
  const root  = document.documentElement;
  const media = window.matchMedia('(prefers-color-scheme: dark)');

  function currentTheme() {
    return root.dataset.theme || (media.matches ? 'dark' : 'light');
  }

  function paintToggles() {
    const dark = currentTheme() === 'dark';
    document.querySelectorAll('[data-theme-toggle]').forEach(btn => {
      btn.innerHTML = dark ? '☀️ <span>Açık</span>' : '🌙 <span>Koyu</span>';
      btn.setAttribute('aria-label', dark ? 'Açık temaya geç' : 'Koyu temaya geç');
    });
  }

  window.toggleTheme = function () {
    const next = currentTheme() === 'dark' ? 'light' : 'dark';
    root.dataset.theme = next;
    try { localStorage.setItem(KEY, next); } catch (e) { /* gizli pencere: yalnızca bu oturum */ }
    paintToggles();
  };

  let toastTimer = null;
  window.showToast = function (message) {
    let toast = document.getElementById('tt-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'tt-toast';
      toast.className = 'toast';
      toast.setAttribute('role', 'status');
      document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toast.hidden = true; }, 2600);
  };

  function copyFallback(text) {
    const area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
    area.remove();
    return ok;
  }

  // Telefonda paylaşım menüsünü açar; yoksa metni panoya kopyalar.
  window.shareText = async function (text, url) {
    if (navigator.share) {
      try {
        await navigator.share({ text, url });
        return;
      } catch (e) {
        if (e.name === 'AbortError') return;
      }
    }
    const full = `${text} ${url}`;
    try {
      await navigator.clipboard.writeText(full);
      showToast('Kopyalandı ✓');
    } catch (e) {
      showToast(copyFallback(full) ? 'Kopyalandı ✓' : 'Kopyalanamadı. Lütfen metni elle kopyalayın.');
    }
  };

  // Hareketi azalt ayarına uyan kaydırma
  window.scrollToEl = function (el) {
    if (!el) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
  };

  document.addEventListener('DOMContentLoaded', () => {
    paintToggles();
    document.querySelectorAll('[data-theme-toggle]').forEach(btn => {
      btn.addEventListener('click', window.toggleTheme);
    });
  });

  if (media.addEventListener) media.addEventListener('change', paintToggles);
})();
