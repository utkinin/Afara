'use strict';

const contactLink = document.querySelector('[data-contact-primary]');
const baseContact = contactLink?.dataset.contactBase;
const pageURL = document.querySelector('link[rel="canonical"]')?.href;
const menu = document.querySelector('nav[aria-label="Мобильная навигация"]')?.closest('dialog');
const openMenu = document.querySelector('button[aria-label="Открыть меню"]');
openMenu?.addEventListener('click', () => menu?.showModal());
menu?.querySelector('button[aria-label="Закрыть меню"]')?.addEventListener('click', () => menu.close());
menu?.addEventListener('click', event => {
  if (event.target === menu || event.target.closest('a')) menu.close();
});
menu?.addEventListener('close', () => openMenu?.focus({ preventScroll: true }));

// A local draft only. No request, cookie, storage or automatic message is sent.
window.addEventListener('afara:question', event => {
  if (!baseContact || typeof event.detail !== 'string') return;
  const brief = event.detail.trim().slice(0, 1000);
  const status = document.querySelector('[data-contact-brief]');
  if (status) status.textContent = brief;
  const url = new URL(baseContact);
  url.searchParams.set('text', `${brief}\n\nСтраница AFARA: ${pageURL}`);
  contactLink.href = url.href;
});

for (const container of document.querySelectorAll('[data-save-idea]')) {
  container.querySelector('button')?.addEventListener('click', async () => {
    const url = new URL(pageURL);
    url.hash = container.dataset.saveIdea;
    const status = container.querySelector('[role="status"]');
    try {
      await navigator.clipboard.writeText(url.href);
      if (status) status.textContent = 'Ссылка скопирована';
    } catch {
      if (status) status.textContent = 'Скопируйте ссылку из поля';
      let input = container.querySelector('input');
      if (!input) {
        const label = document.createElement('label');
        label.textContent = 'Ссылка на идею';
        input = document.createElement('input');
        input.readOnly = true;
        label.append(input);
        container.append(label);
      }
      input.value = url.href;
      input.focus();
      input.select();
    }
  });
}
