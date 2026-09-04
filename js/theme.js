/**
 * public/js/theme.js
 *
 * Gestisce il cambio tema chiaro/scuro. Il tema vero e proprio (i colori)
 * è tutto definito in css/style.css tramite variabili CSS sotto
 * [data-theme="dark"] — qui ci limitiamo a:
 *   1) leggere/salvare la preferenza (localStorage, per dispositivo)
 *   2) applicare l'attributo data-theme su <html>
 *   3) aggiornare i colori di default di Chart.js, che altrimenti
 *      resterebbero scuri e illeggibili su sfondo scuro
 *   4) ridisegnare la pagina corrente, così i grafici già aperti
 *      vengono ricreati con i colori giusti
 *
 * Nota: l'impostazione iniziale del tema (per evitare il "flash" del
 * tema sbagliato) avviene in un piccolo script inline nell'<head> di
 * index.html, PRIMA che questo file venga caricato.
 */

function getCurrentTheme() {
  return document.documentElement.getAttribute('data-theme') || 'light';
}

function applyChartDefaults() {
  if (typeof Chart === 'undefined') return;
  const styles = getComputedStyle(document.documentElement);
  Chart.defaults.color = styles.getPropertyValue('--color-text-muted').trim();
  Chart.defaults.borderColor = styles.getPropertyValue('--color-border').trim();
}

function updateThemeToggleButton() {
  const btn = document.getElementById('btn-theme-toggle');
  if (!btn) return;
  btn.textContent = getCurrentTheme() === 'dark' ? '☀️ Chiaro' : '🌙 Scuro';
}

function updateMetaThemeColor(theme) {
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', theme === 'dark' ? '#0f172a' : '#4f46e5');
}

function setTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('mm-theme', theme);
  applyChartDefaults();
  updateThemeToggleButton();
  updateMetaThemeColor(theme);
  // Ridisegna la pagina corrente: eventuali grafici già a schermo vengono
  // ricreati (il pattern "destroy + ricrea" è già usato in dashboard.js,
  // statistics.js e investment-detail.js), così prendono subito i nuovi colori.
  if (typeof handleHashChange === 'function') handleHashChange();
}

function toggleTheme() {
  setTheme(getCurrentTheme() === 'dark' ? 'light' : 'dark');
}

document.addEventListener('DOMContentLoaded', () => {
  applyChartDefaults();
  updateThemeToggleButton();
  updateMetaThemeColor(getCurrentTheme());
  const btn = document.getElementById('btn-theme-toggle');
  if (btn) btn.addEventListener('click', toggleTheme);
});

window.toggleTheme = toggleTheme;
