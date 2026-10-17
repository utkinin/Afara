for (const root of document.querySelectorAll('[data-material-study]')) {
  const start = async () => {observer?.disconnect(); const {initMaterialStudy} = await import('./material-study-controls.js'); initMaterialStudy(root)};
  const observer = typeof IntersectionObserver === 'undefined' ? null : new IntersectionObserver(entries => {if(entries.some(e=>e.isIntersecting))start()}, {rootMargin:'500px'});
  if(observer)observer.observe(root);else start();
}
