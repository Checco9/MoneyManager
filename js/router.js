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
  'goals', 'recurring', 'investments', 'statistics', 'categories', 'settings'
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
