/**
 * public/js/goals.js
 * Pagina "Obiettivi di risparmio": card con progresso e contributi.
 */

let goalsPageBound = false;
let goalsAccountsCache = [];

async function initGoalsPage() {
  bindGoalsPageEvents();
  goalsAccountsCache = await db.accounts.list().catch((e) => { showToast(e.message, 'error'); return []; });
  await loadGoals();
}

async function loadGoals() {
  try {
    const list = await db.goals.list();
    renderGoals(list.map(withGoalPercentage));
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function withGoalPercentage(g) {
  const percentage = g.targetAmount > 0 ? Math.min(100, Math.round((g.currentAmount / g.targetAmount) * 1000) / 10) : 0;
  return { ...g, percentage };
}

function renderGoals(list) {
  const grid = document.getElementById('goals-grid');
  const empty = document.getElementById('goals-empty-state');
  if (list.length === 0) {
    grid.innerHTML = '';
    empty.hidden = false;
    return;
  }
  empty.hidden = true;

  grid.innerHTML = list
    .map((g) => `
      <div class="summary-card goal-card">
        <div class="budget-card-header">
          <span>${g.icon} ${escapeHtml(g.name)}</span>
          <button class="btn-icon" title="Elimina" onclick="askDeleteGoal('${g.id}')">🗑️</button>
        </div>
        <div class="progress-bar"><div class="progress-fill progress-ok" style="width:${g.percentage}%"></div></div>
        <div class="budget-card-numbers">
          <span>${formatMoney(g.currentAmount)} di ${formatMoney(g.targetAmount)}</span>
          <span><strong>${g.percentage}%</strong></span>
        </div>
        ${g.targetDate ? `<div class="muted-text">Entro il ${formatDate(g.targetDate)}</div>` : ''}
        ${g.description ? `<div class="muted-text">${escapeHtml(g.description)}</div>` : ''}
        <div class="goal-actions">
          <button class="btn btn-secondary btn-small" onclick="openGoalContribute('${g.id}','add')">+ Aggiungi</button>
          <button class="btn btn-secondary btn-small" onclick="openGoalContribute('${g.id}','remove')">− Preleva</button>
        </div>
      </div>`)
    .join('');
}

function openNewGoal() {
  document.getElementById('goal-modal-title').textContent = 'Nuovo obiettivo';
  document.getElementById('goal-form').reset();
  document.getElementById('goal-id').value = '';
  openModal('goal-modal');
}

function askDeleteGoal(id) {
  confirmAction('Eliminare questo obiettivo? I movimenti collegati non toccano i saldi reali dei conti.', async () => {
    try {
      await db.goals.remove(id);
      showToast('Obiettivo eliminato.', 'success');
      loadGoals();
    } catch (err) {
      showToast(err.message, 'error');
    }
  });
}

function openGoalContribute(goalId, direction) {
  document.getElementById('goal-contribute-title').textContent =
    direction === 'add' ? 'Aggiungi denaro all\'obiettivo' : 'Preleva denaro dall\'obiettivo';
  document.getElementById('goal-contribute-form').reset();
  document.getElementById('goal-contribute-id').value = goalId;
  document.getElementById('goal-contribute-direction').value = direction;
  populateSelect(document.getElementById('goal-contribute-account'), goalsAccountsCache, {
    labelFn: (a) => `${a.icon || ''} ${a.name}`
  });
  openModal('goal-contribute-modal');
}

function bindGoalsPageEvents() {
  if (goalsPageBound) return;
  goalsPageBound = true;

  document.getElementById('btn-new-goal').addEventListener('click', openNewGoal);

  document.getElementById('goal-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
      name: document.getElementById('goal-name').value,
      targetAmount: eurosToCents(document.getElementById('goal-target').value),
      targetDate: document.getElementById('goal-date').value || null,
      icon: document.getElementById('goal-icon').value || '🎯',
      description: document.getElementById('goal-description').value
    };
    try {
      await db.goals.create(payload);
      showToast('Obiettivo creato.', 'success');
      closeModal('goal-modal');
      loadGoals();
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  document.getElementById('goal-contribute-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const goalId = document.getElementById('goal-contribute-id').value;
    const payload = {
      direction: document.getElementById('goal-contribute-direction').value,
      amount: eurosToCents(document.getElementById('goal-contribute-amount').value),
      accountId: document.getElementById('goal-contribute-account').value,
      note: document.getElementById('goal-contribute-note').value
    };
    try {
      await db.goals.contribute(goalId, payload);
      showToast('Obiettivo aggiornato.', 'success');
      closeModal('goal-contribute-modal');
      loadGoals();
    } catch (err) {
      showToast(err.message, 'error');
    }
  });
}

window.initGoalsPage = initGoalsPage;
window.askDeleteGoal = askDeleteGoal;
window.openGoalContribute = openGoalContribute;
