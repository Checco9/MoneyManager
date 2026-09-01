/**
 * public/js/recurring.js
 * Pagina "Ricorrenti": pattern di movimenti ripetuti + prossime scadenze previste.
 */

let recurringPageBound = false;
let recurringAccountsCache = [];
let recurringCategoriesCache = [];

const FREQ_LABELS = { daily: 'Giornaliera', weekly: 'Settimanale', monthly: 'Mensile', yearly: 'Annuale' };
const FREQ_UNIT_PLURAL = { daily: 'giorni', weekly: 'settimane', monthly: 'mesi', yearly: 'anni' };

function formatFrequency(frequency, everyN) {
  const n = everyN || 1;
  if (n === 1) return FREQ_LABELS[frequency] || frequency;
  return `Ogni ${n} ${FREQ_UNIT_PLURAL[frequency] || frequency}`;
}

async function initRecurringPage() {
  bindRecurringPageEvents();
  [recurringAccountsCache, recurringCategoriesCache] = await Promise.all([
    db.accounts.list().catch(() => []), db.categories.list().catch(() => [])
  ]);
  await Promise.all([loadRecurringList(), loadUpcoming()]);
}

async function loadRecurringList() {
  try {
    const list = await db.recurring.list();
    renderRecurringTable(list);
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function renderRecurringTable(list) {
  const body = document.getElementById('recurring-table-body');
  if (list.length === 0) {
    body.innerHTML = '<tr><td colspan="6" class="empty-state">Nessun movimento ricorrente creato.</td></tr>';
    return;
  }
  body.innerHTML = list
    .map((r) => `<tr>
      <td data-label="Descrizione">${escapeHtml(r.description)}</td>
      <td data-label="Importo" class="${r.type === 'income' ? 'balance-positive' : 'balance-negative'}">${formatMoney(r.amount)}</td>
      <td data-label="Frequenza">${formatFrequency(r.frequency, r.everyN)}</td>
      <td data-label="Prossima data">${formatDate(r.nextDueDate)}</td>
      <td data-label="Stato"><span class="status-pill ${r.active ? 'status-active' : 'status-inactive'}">${r.active ? 'Attivo' : 'Sospeso'}</span></td>
      <td>
        <button class="btn-icon" title="${r.active ? 'Sospendi' : 'Riattiva'}" onclick="toggleRecurringActive('${r.id}', ${!r.active})">${r.active ? '⏸️' : '▶️'}</button>
        <button class="btn-icon" title="Elimina" onclick="askDeleteRecurring('${r.id}')">🗑️</button>
      </td>
    </tr>`)
    .join('');
}

async function loadUpcoming() {
  try {
    const list = await recurringEngine.computeUpcoming(30);
    const body = document.getElementById('upcoming-table-body');
    const empty = document.getElementById('upcoming-empty-state');
    if (list.length === 0) {
      body.innerHTML = '';
      empty.hidden = false;
      return;
    }
    empty.hidden = true;
    body.innerHTML = list
      .map((u) => `<tr>
        <td data-label="Data">${formatDate(u.date)}</td>
        <td data-label="Descrizione">${escapeHtml(u.description)}</td>
        <td data-label="Importo" class="${u.type === 'income' ? 'balance-positive' : 'balance-negative'}">${formatMoney(u.amount)}</td>
      </tr>`)
      .join('');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function setRecurringTypeToggle(type) {
  document.getElementById('recurring-type').value = type;
  document.getElementById('recurring-type-expense').classList.toggle('active', type === 'expense');
  document.getElementById('recurring-type-income').classList.toggle('active', type === 'income');
  populateSelect(
    document.getElementById('recurring-category'),
    recurringCategoriesCache.filter((c) => c.type === type),
    { placeholder: 'Nessuna categoria', labelFn: (c) => `${c.icon} ${c.name}` }
  );
}

function openNewRecurring() {
  document.getElementById('recurring-modal-title').textContent = 'Nuovo movimento ricorrente';
  document.getElementById('recurring-form').reset();
  document.getElementById('recurring-id').value = '';
  document.getElementById('recurring-every-n').value = 1;
  document.getElementById('recurring-start').value = todayStr();
  populateSelect(document.getElementById('recurring-account'), recurringAccountsCache, { labelFn: (a) => `${a.icon || ''} ${a.name}` });
  setRecurringTypeToggle('expense');
  openModal('recurring-modal');
}

function toggleRecurringActive(id, active) {
  db.recurring.update(id, { active })
    .then(() => { showToast(active ? 'Riattivato.' : 'Sospeso.', 'success'); loadRecurringList(); })
    .catch((err) => showToast(err.message, 'error'));
}

function askDeleteRecurring(id) {
  confirmAction('Eliminare questo movimento ricorrente? Le transazioni già generate non verranno rimosse.', async () => {
    try {
      await db.recurring.remove(id);
      showToast('Movimento ricorrente eliminato.', 'success');
      loadRecurringList();
      loadUpcoming();
    } catch (err) {
      showToast(err.message, 'error');
    }
  });
}

function bindRecurringPageEvents() {
  if (recurringPageBound) return;
  recurringPageBound = true;

  document.getElementById('btn-new-recurring').addEventListener('click', openNewRecurring);
  document.getElementById('btn-generate-recurring').addEventListener('click', () => promptRecurringGeneration(true));
  document.getElementById('recurring-type-expense').addEventListener('click', () => setRecurringTypeToggle('expense'));
  document.getElementById('recurring-type-income').addEventListener('click', () => setRecurringTypeToggle('income'));

  document.getElementById('recurring-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
      type: document.getElementById('recurring-type').value,
      description: document.getElementById('recurring-description').value,
      amount: eurosToCents(document.getElementById('recurring-amount').value),
      accountId: document.getElementById('recurring-account').value,
      categoryId: document.getElementById('recurring-category').value || null,
      frequency: document.getElementById('recurring-frequency').value,
      everyN: parseInt(document.getElementById('recurring-every-n').value, 10) || 1,
      startDate: document.getElementById('recurring-start').value,
      endDate: document.getElementById('recurring-end').value || null
    };
    try {
      await db.recurring.create(payload);
      showToast('Movimento ricorrente creato.', 'success');
      closeModal('recurring-modal');
      loadRecurringList();
      loadUpcoming();
    } catch (err) {
      showToast(err.message, 'error');
    }
  });
}

window.initRecurringPage = initRecurringPage;
window.toggleRecurringActive = toggleRecurringActive;
window.askDeleteRecurring = askDeleteRecurring;
