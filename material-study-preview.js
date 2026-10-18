for (const root of document.querySelectorAll('[data-material-study]')) {
  const start = async () => {observer?.disconnect(); const {initMaterialStudy} = await import('./material-study-controls.js?v=3f3aae38e6e1ff6f'); initMaterialStudy(root)};
  const observer = typeof IntersectionObserver === 'undefined' ? null : new IntersectionObserver(entries => {if(entries.some(e=>e.isIntersecting))start()}, {rootMargin:'500px'});
  if(observer)observer.observe(root);else start();
}
