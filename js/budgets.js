/**
 * public/js/budgets.js
 * Pagina "Budget": barra di avanzamento per categoria, selettore mese.
 */

let budgetsPageBound = false;
let budgetsCategoriesCache = [];

async function initBudgetsPage() {
  bindBudgetsPageEvents();
  const monthPicker = document.getElementById('budget-month-picker');
  if (!monthPicker.value) monthPicker.value = currentMonthStr();

  budgetsCategoriesCache = await db.categories.list('expense').catch((e) => { showToast(e.message, 'error'); return []; });
  await loadBudgets();
}

async function loadBudgets() {
  const month = document.getElementById('budget-month-picker').value || currentMonthStr();
  try {
    const list = await calc.computeBudgetStatus(month);
    renderBudgets(list);
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function renderBudgets(list) {
  const grid = document.getElementById('budgets-grid');
  const empty = document.getElementById('budgets-empty-state');
  if (list.length === 0) {
    grid.innerHTML = '';
    empty.hidden = false;
    return;
  }
  empty.hidden = true;

  grid.innerHTML = list
    .map((b) => {
      const pct = Math.min(100, b.percentage);
      const barClass = b.overBudget ? 'progress-over' : pct > 80 ? 'progress-warning' : 'progress-ok';
      return `
        <div class="summary-card budget-card ${b.overBudget ? 'over-budget' : ''}">
          <div class="budget-card-header">
            <span>${b.categoryIcon} ${escapeHtml(b.categoryName)}</span>
            <button class="btn-icon" title="Elimina budget" onclick="askDeleteBudget('${b.id}')">🗑️</button>
          </div>
          <div class="progress-bar"><div class="progress-fill ${barClass}" style="width:${pct}%"></div></div>
          <div class="budget-card-numbers">
            <span>Speso: <strong>${formatMoney(b.spent)}</strong></span>
            <span>Budget: <strong>${formatMoney(b.amount)}</strong></span>
          </div>
          ${b.overBudget
            ? `<div class="budget-warning">⚠️ Budget superato di ${formatMoney(b.spent - b.amount)}</div>`
            : `<div class="muted-text">Disponibili: ${formatMoney(b.remaining)}</div>`}
        </div>`;
    })
    .join('');
}

function openNewBudget() {
  const month = document.getElementById('budget-month-picker').value || currentMonthStr();
  document.getElementById('budget-form').reset();
  document.getElementById('budget-month').value = month;
  populateSelect(document.getElementById('budget-category'), budgetsCategoriesCache, { labelFn: (c) => `${c.icon} ${c.name}` });
  openModal('budget-modal');
}

function askDeleteBudget(id) {
  confirmAction('Eliminare questo budget?', async () => {
    try {
      await db.budgets.remove(id);
      showToast('Budget eliminato.', 'success');
      loadBudgets();
    } catch (err) {
      showToast(err.message, 'error');
    }
  });
}

function bindBudgetsPageEvents() {
  if (budgetsPageBound) return;
  budgetsPageBound = true;

  document.getElementById('btn-new-budget').addEventListener('click', openNewBudget);
  document.getElementById('budget-month-picker').addEventListener('change', loadBudgets);

  document.getElementById('budget-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
      categoryId: document.getElementById('budget-category').value,
      month: document.getElementById('budget-month').value,
      amount: eurosToCents(document.getElementById('budget-amount').value)
    };
    try {
      await db.budgets.upsert(payload);
      showToast('Budget salvato.', 'success');
      closeModal('budget-modal');
      loadBudgets();
    } catch (err) {
      showToast(err.message, 'error');
    }
  });
}

window.initBudgetsPage = initBudgetsPage;
window.askDeleteBudget = askDeleteBudget;
