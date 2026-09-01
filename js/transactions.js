/**
 * public/js/transactions.js
 * Pagina "Transazioni": elenco filtrabile/ordinabile + CRUD + duplicazione.
 */

let txPageBound = false;
let txAccountsCache = [];
let txCategoriesCache = [];

async function initTransactionsPage() {
  bindTransactionsPageEvents();
  await loadTxFiltersData();
  await loadTransactions();
}

async function loadTxFiltersData() {
  try {
    [txAccountsCache, txCategoriesCache] = await Promise.all([db.accounts.list(), db.categories.list()]);
    populateSelect(document.getElementById('tx-filter-account'), txAccountsCache, {
      placeholder: 'Tutti i conti', labelFn: (a) => `${a.icon || ''} ${a.name}`
    });
    populateSelect(document.getElementById('tx-filter-category'), txCategoriesCache, {
      placeholder: 'Tutte le categorie', labelFn: (c) => `${c.icon} ${c.name}`
    });
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function buildFilters() {
  const filters = {};
  const search = document.getElementById('tx-search').value.trim();
  const accountId = document.getElementById('tx-filter-account').value;
  const categoryId = document.getElementById('tx-filter-category').value;
  const type = document.getElementById('tx-filter-type').value;
  const from = document.getElementById('tx-filter-from').value;
  const to = document.getElementById('tx-filter-to').value;
  const sort = document.getElementById('tx-sort').value;

  if (search) filters.search = search;
  if (accountId) filters.accountId = accountId;
  if (categoryId) filters.categoryId = categoryId;
  if (type) filters.type = type;
  if (from) filters.from = from;
  if (to) filters.to = to;
  if (sort) filters.sort = sort;
  return filters;
}

async function loadTransactions() {
  try {
    const list = await db.transactions.list(buildFilters());
    renderTransactionsTable(list);
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function renderTransactionsTable(list) {
  const body = document.getElementById('tx-table-body');
  const empty = document.getElementById('tx-empty-state');

  if (list.length === 0) {
    body.innerHTML = '';
    empty.hidden = false;
    return;
  }
  empty.hidden = true;

  body.innerHTML = list
    .map((t) => {
      const account = txAccountsCache.find((a) => a.id === t.accountId);
      const category = txCategoriesCache.find((c) => c.id === t.categoryId);
      const cls = t.type === 'income' ? 'balance-positive' : 'balance-negative';
      const sign = t.type === 'income' ? '+' : '−';
      return `<tr>
        <td data-label="Data">${formatDate(t.date)}</td>
        <td data-label="Tipo">${t.type === 'income' ? '⬆️ Entrata' : '⬇️ Uscita'}</td>
        <td data-label="Conto">${account ? escapeHtml(account.name) : '—'}</td>
        <td data-label="Categoria">${category ? `${category.icon} ${escapeHtml(category.name)}` : '—'}</td>
        <td data-label="Descrizione">${escapeHtml(t.description) || '<span class="muted-text">—</span>'}</td>
        <td data-label="Importo" class="${cls}">${sign} ${formatMoney(t.amount)}</td>
        <td>
          <button class="btn-icon" title="Modifica" onclick="openEditTransaction('${t.id}')">✏️</button>
          <button class="btn-icon" title="Duplica" onclick="duplicateTransaction('${t.id}')">📋</button>
          <button class="btn-icon" title="Elimina" onclick="askDeleteTransaction('${t.id}')">🗑️</button>
        </td>
      </tr>`;
    })
    .join('');
}

function setTxTypeToggle(type) {
  document.getElementById('tx-type').value = type;
  document.getElementById('tx-type-expense').classList.toggle('active', type === 'expense');
  document.getElementById('tx-type-income').classList.toggle('active', type === 'income');
  populateSelect(
    document.getElementById('tx-category'),
    txCategoriesCache.filter((c) => c.type === type),
    { placeholder: 'Nessuna categoria', labelFn: (c) => `${c.icon} ${c.name}` }
  );
}

function openNewTransaction(presetType = 'expense') {
  document.getElementById('transaction-modal-title').textContent = 'Nuova transazione';
  document.getElementById('transaction-form').reset();
  document.getElementById('tx-id').value = '';
  document.getElementById('tx-date').value = todayStr();
  populateSelect(document.getElementById('tx-account'), txAccountsCache, { labelFn: (a) => `${a.icon || ''} ${a.name}` });
  setTxTypeToggle(presetType);
  openModal('transaction-modal');
}

function openEditTransaction(id) {
  db.transactions.get(id).then((t) => {
    document.getElementById('transaction-modal-title').textContent = 'Modifica transazione';
    document.getElementById('tx-id').value = t.id;
    document.getElementById('tx-amount').value = (t.amount / 100).toFixed(2);
    document.getElementById('tx-date').value = t.date;
    document.getElementById('tx-time').value = t.time || '';
    document.getElementById('tx-subcategory').value = t.subcategory || '';
    document.getElementById('tx-description').value = t.description || '';
    document.getElementById('tx-notes').value = t.notes || '';
    document.getElementById('tx-tags').value = (t.tags || []).join(', ');

    populateSelect(document.getElementById('tx-account'), txAccountsCache, { labelFn: (a) => `${a.icon || ''} ${a.name}` });
    document.getElementById('tx-account').value = t.accountId;
    setTxTypeToggle(t.type);
    document.getElementById('tx-category').value = t.categoryId || '';

    openModal('transaction-modal');
  }).catch((err) => showToast(err.message, 'error'));
}

function duplicateTransaction(id) {
  db.transactions.duplicate(id)
    .then(() => { showToast('Transazione duplicata.', 'success'); loadTransactions(); })
    .catch((err) => showToast(err.message, 'error'));
}

function askDeleteTransaction(id) {
  confirmAction('Sei sicuro di voler eliminare questa transazione?', async () => {
    try {
      await db.transactions.remove(id);
      showToast('Transazione eliminata.', 'success');
      loadTransactions();
    } catch (err) {
      showToast(err.message, 'error');
    }
  });
}

function bindTransactionsPageEvents() {
  if (txPageBound) return;
  txPageBound = true;

  document.getElementById('btn-new-transaction').addEventListener('click', () => openNewTransaction('expense'));
  document.getElementById('quick-add-expense').addEventListener('click', () => {
    window.location.hash = 'transactions';
    setTimeout(() => openNewTransaction('expense'), 50);
  });

  document.getElementById('tx-type-expense').addEventListener('click', () => setTxTypeToggle('expense'));
  document.getElementById('tx-type-income').addEventListener('click', () => setTxTypeToggle('income'));

  ['tx-search', 'tx-filter-account', 'tx-filter-category', 'tx-filter-type', 'tx-filter-from', 'tx-filter-to', 'tx-sort']
    .forEach((id) => {
      const el = document.getElementById(id);
      el.addEventListener(id === 'tx-search' ? 'input' : 'change', debounce(loadTransactions, 250));
    });

  document.getElementById('transaction-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('tx-id').value;
    const tags = document.getElementById('tx-tags').value.split(',').map((s) => s.trim()).filter(Boolean);

    const payload = {
      type: document.getElementById('tx-type').value,
      amount: eurosToCents(document.getElementById('tx-amount').value),
      date: document.getElementById('tx-date').value,
      time: document.getElementById('tx-time').value || null,
      accountId: document.getElementById('tx-account').value,
      categoryId: document.getElementById('tx-category').value || null,
      subcategory: document.getElementById('tx-subcategory').value,
      description: document.getElementById('tx-description').value,
      notes: document.getElementById('tx-notes').value,
      tags
    };

    try {
      if (id) {
        await db.transactions.update(id, payload);
        showToast('Transazione aggiornata.', 'success');
      } else {
        await db.transactions.create(payload);
        showToast('Transazione salvata.', 'success');
      }
      closeModal('transaction-modal');
      loadTransactions();
    } catch (err) {
      showToast(err.message, 'error');
    }
  });
}

function debounce(fn, ms) {
  let timer;
  return (...args) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), ms); };
}

window.initTransactionsPage = initTransactionsPage;
window.openNewTransaction = openNewTransaction;
window.openEditTransaction = openEditTransaction;
window.duplicateTransaction = duplicateTransaction;
window.askDeleteTransaction = askDeleteTransaction;

// Pulsante flottante mobile "+": deve funzionare anche se la pagina
// Transazioni non è mai stata aperta prima (quindi con le cache ancora
// vuote), per questo carica conti/categorie al volo se necessario.
document.addEventListener('DOMContentLoaded', () => {
  const fab = document.getElementById('fab-new-transaction');
  if (!fab) return;
  fab.addEventListener('click', async () => {
    window.location.hash = 'transactions';
    if (txAccountsCache.length === 0 || txCategoriesCache.length === 0) {
      await loadTxFiltersData();
    }
    setTimeout(() => openNewTransaction('expense'), 50);
  });
});
