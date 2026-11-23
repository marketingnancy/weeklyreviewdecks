/* Local functionality only. This file sends no analytics or tracking requests. */
(() => {
  'use strict';
  const currentParameters = new URLSearchParams(window.location.search);
  let storedParameters = new URLSearchParams();
  try {
    storedParameters = new URLSearchParams(sessionStorage.getItem('lem-incoming-parameters') || '');
    for (const key of new Set(currentParameters.keys())) {
      storedParameters.delete(key);
      for (const value of currentParameters.getAll(key)) storedParameters.append(key, value);
    }
    sessionStorage.setItem('lem-incoming-parameters', storedParameters.toString());
  } catch (_) {
    storedParameters = currentParameters;
  }

  const decorateUrl = (original) => {
    const url = new URL(original, window.location.href);
    for (const key of new Set(storedParameters.keys())) {
      // Existing destination parameters, including hn_at, must remain unchanged.
      if (!url.searchParams.has(key)) {
        for (const value of storedParameters.getAll(key)) url.searchParams.append(key, value);
      }
    }
    return url.href;
  };

  document.querySelectorAll('[data-product-link]').forEach((anchor) => {
    const original = anchor.getAttribute('data-original-destination') || anchor.href;
    anchor.href = decorateUrl(original);
  });
  document.querySelectorAll('[data-variation-link]').forEach((anchor) => {
    anchor.href = decorateUrl(anchor.getAttribute('href'));
  });

  const showMore = document.getElementById('show-more-reviews');
  if (showMore) {
    showMore.addEventListener('click', () => {
      document.querySelectorAll('[data-extra-review]').forEach((card) => {
        card.classList.remove('hidden');
        card.classList.add('block');
      });
      showMore.setAttribute('aria-expanded', 'true');
      showMore.hidden = true;
      showMore.style.display = 'none';
    });
  }
})();
