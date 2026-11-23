/* Local UI only: no tracking or external services. */
(() => {
  'use strict';
  const tiles = [...document.querySelectorAll('[data-gallery-zoom]')];
  if (!tiles.length) return;
  const dialog = document.createElement('dialog');
  dialog.className = 'gallery-lightbox';
  dialog.setAttribute('aria-label', 'Product photo gallery');
  dialog.innerHTML = `
    <div class="gallery-lightbox-stage"><img class="gallery-lightbox-image" alt="" /></div>
    <button type="button" class="gallery-lightbox-close" aria-label="Close photo gallery">×</button>
    <button type="button" class="gallery-lightbox-prev" aria-label="Previous photo">‹</button>
    <button type="button" class="gallery-lightbox-next" aria-label="Next photo">›</button>`;
  document.body.appendChild(dialog);
  const image = dialog.querySelector('.gallery-lightbox-image');
  const closeButton = dialog.querySelector('.gallery-lightbox-close');
  let index = 0;
  let opener = null;
  let priorOverflow = '';
  const showPhoto = (next) => {
    index = (next + tiles.length) % tiles.length;
    const source = tiles[index].querySelector('img');
    image.src = source.currentSrc || source.src;
    image.alt = source.alt;
    dialog.setAttribute('aria-label', `Product photo ${index + 1} of ${tiles.length}`);
  };
  tiles.forEach((tile, i) => tile.addEventListener('click', () => {
    opener = tile;
    priorOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.body.classList.add('gallery-is-open');
    dialog.showModal();
    showPhoto(i);
    closeButton.focus();
  }));
  closeButton.addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog || event.target.classList.contains('gallery-lightbox-stage')) dialog.close();
  });
  dialog.addEventListener('close', () => {
    document.body.style.overflow = priorOverflow;
    document.body.classList.remove('gallery-is-open');
    if (opener) opener.focus({ preventScroll: true });
  });
  dialog.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowRight') { event.preventDefault(); showPhoto(index + 1); }
    if (event.key === 'ArrowLeft') { event.preventDefault(); showPhoto(index - 1); }
  });
  dialog.querySelector('.gallery-lightbox-prev').addEventListener('click', () => showPhoto(index - 1));
  dialog.querySelector('.gallery-lightbox-next').addEventListener('click', () => showPhoto(index + 1));

  const bar = document.querySelector('.scroll-offer');
  const header = document.querySelector('header');
  if (!bar) return;
  const mobile = window.matchMedia('(max-width: 767px)');
  const hero = document.querySelector('section:has(h1)');
  const measure = () => {
    const masthead = header ? header.getBoundingClientRect().height : 0;
    document.documentElement.style.setProperty('--offer-masthead-height', `${masthead}px`);
    document.documentElement.style.setProperty('--offer-bar-height', `${bar.getBoundingClientRect().height}px`);
  };
  const updateBar = () => {
    const threshold = hero ? hero.offsetTop + Math.min(hero.offsetHeight, 320) : 320;
    const visible = window.scrollY > threshold;
    bar.hidden = !visible;
    document.body.classList.toggle('has-scroll-offer', visible);
    document.body.classList.toggle('has-mobile-offer', visible && mobile.matches);
    measure();
  };
  let scheduled = false;
  window.addEventListener('scroll', () => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => { updateBar(); scheduled = false; });
  }, { passive: true });
  window.addEventListener('resize', updateBar);
  mobile.addEventListener('change', updateBar);
  if ('ResizeObserver' in window) {
    const observer = new ResizeObserver(measure);
    if (header) observer.observe(header);
    observer.observe(bar);
  }
  updateBar();
})();
