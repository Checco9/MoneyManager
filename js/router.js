/**
 * public/js/router.js
 *
 * Router minimale basato su hash (#dashboard, #accounts, ...). Mostra la
 * sezione corrispondente e chiama la funzione "init<Page>()" del modulo
 * relativo se esiste, così ogni pagina carica i propri dati solo quando
 * viene effettivamente visitata.
 */

const PAGES = [
  'dashboard', 'accounts', 'transactions', 'transfers', 'budgets',
  'goals', 'recurring', 'investments', 'investment-detail', 'statistics', 'categories', 'settings'
];

const PAGE_INIT_FUNCTIONS = {
  dashboard: () => window.initDashboardPage && window.initDashboardPage(),
  accounts: () => window.initAccountsPage && window.initAccountsPage(),
  transactions: () => window.initTransactionsPage && window.initTransactionsPage(),
  transfers: () => window.initTransfersPage && window.initTransfersPage(),
  budgets: () => window.initBudgetsPage && window.initBudgetsPage(),
  goals: () => window.initGoalsPage && window.initGoalsPage(),
  recurring: () => window.initRecurringPage && window.initRecurringPage(),
  investments: () => window.initInvestmentsPage && window.initInvestmentsPage(),
  'investment-detail': () => window.initInvestmentDetailPage && window.initInvestmentDetailPage(),
  statistics: () => window.initStatisticsPage && window.initStatisticsPage(),
  categories: () => window.initCategoriesPage && window.initCategoriesPage(),
  settings: () => window.initSettingsPage && window.initSettingsPage()
};

function navigateTo(page) {
  if (!PAGES.includes(page)) page = 'dashboard';

  PAGES.forEach((p) => {
    document.getElementById(`page-${p}`).hidden = p !== page;
  });

  document.querySelectorAll('.nav-item').forEach((el) => {
    el.classList.toggle('active', el.dataset.page === page);
  });

  const fn = PAGE_INIT_FUNCTIONS[page];
  if (fn) fn();
}

function handleHashChange() {
  const page = window.location.hash.replace('#', '') || 'dashboard';
  navigateTo(page);
}

window.addEventListener('hashchange', handleHashChange);

// ============================================================
// SWIPE tra pagine (solo mobile)
// ============================================================
// Stessa sequenza del menu principale, MA senza "investment-detail":
// è una sotto-pagina raggiunta da un pulsante specifico (dentro
// Investimenti), non una scheda del menu, quindi non ha senso "scorrerci
// sopra" con lo swipe insieme alle altre.
const SWIPE_PAGES = PAGES.filter((p) => p !== 'investment-detail');

let swipeStartX = 0;
let swipeStartY = 0;
let swipeStartTime = 0;

function isModalOpen() {
  return !!document.querySelector('.modal-overlay:not([hidden])');
}

function navigateSwipe(direction) {
  const current = window.location.hash.replace('#', '') || 'dashboard';
  const idx = SWIPE_PAGES.indexOf(current);
  if (idx === -1) return; // pagina fuori dalla sequenza (es. dettaglio investimento): niente swipe
  const nextIdx = idx + direction;
  if (nextIdx < 0 || nextIdx >= SWIPE_PAGES.length) return; // già alla prima/ultima pagina, non fare nulla
  window.location.hash = SWIPE_PAGES[nextIdx];
}

function initSwipeNavigation() {
  const target = document.querySelector('.main-content');
  if (!target) return;

  target.addEventListener('touchstart', (e) => {
    if (window.innerWidth > 800) return; // lo swipe tra pagine ha senso solo su mobile
    if (isModalOpen()) return; // non deve confliggere con lo scorrimento dentro una modale aperta
    const t = e.touches[0];
    swipeStartX = t.clientX;
    swipeStartY = t.clientY;
    swipeStartTime = Date.now();
  }, { passive: true });

  target.addEventListener('touchend', (e) => {
    if (window.innerWidth > 800) return;
    if (isModalOpen()) return;

    const t = e.changedTouches[0];
    const dx = t.clientX - swipeStartX;
    const dy = t.clientY - swipeStartY;
    const dt = Date.now() - swipeStartTime;

    const MIN_DISTANCE = 70;      // sotto questa soglia è un tap, non uno swipe
    const MAX_VERTICAL_RATIO = 0.5; // lo spostamento orizzontale deve dominare nettamente, altrimenti è uno scroll verticale
    const MAX_DURATION = 600;     // uno swipe è un gesto rapido, non un trascinamento lento

    if (Math.abs(dx) < MIN_DISTANCE) return;
    if (Math.abs(dy) > Math.abs(dx) * MAX_VERTICAL_RATIO) return;
    if (dt > MAX_DURATION) return;

    navigateSwipe(dx < 0 ? 1 : -1); // swipe a sinistra -> pagina successiva, a destra -> precedente
  }, { passive: true });
}

document.addEventListener('DOMContentLoaded', initSwipeNavigation);
