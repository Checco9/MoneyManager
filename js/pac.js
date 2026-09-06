/**
 * public/js/pac.js
 * Pagina "PAC": card per ogni piano di accumulo con storico versamenti,
 * capitale totale versato tramite il PAC, numero di versamenti effettuati.
 */

let pacPageBound = false;
let pacInvestmentsCache = [];
let pacAccountsCache = [];

const PAC_FREQ_LABELS = { daily: 'giorno/i', weekly: 'settimana/e', monthly: 'mese/i', yearly: 'anno/i' };

function formatPacFrequency(frequency, everyN) {
  const n = everyN || 1;
  const unit = PAC_FREQ_LABELS[frequency] || frequency;
  return n === 1 ? `Ogni ${unit.replace('/i', '').replace('/e', '')}` : `Ogni ${n} ${unit}`;
}

async function initPacPage() {
  bindPacPageEvents();
  [pacInvestmentsCache, pacAccountsCache] = await Promise.all([
    db.investments.list().catch(() => []),
    db.accounts.list().catch(() => [])
  ]);
  await loadPacs();
}

async function loadPacs() {
  try {
    const list = await db.pacs.list();
    // Per ogni PAC, calcolo capitale versato e numero di versamenti dal
    // suo storico movimenti (che è la fonte di verità, non un contatore
    // salvato a parte che potrebbe disallinearsi).
    const enriched = await Promise.all(list.map(async (pac) => {
      const movements = await db.investmentMovements.listForPac(pac.id);
      const totalPaid = movements.reduce((s, m) => s + m.amount, 0);
      return { ...pac, totalPaid, paymentsCount: movements.length, movements };
    }));
    renderPacGrid(enriched);
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function investmentName(id) {
  const inv = pacInvestmentsCache.find((i) => i.id === id);
  return inv ? inv.name : '—';
}
function accountName(id) {
  const acc = pacAccountsCache.find((a) => a.id === id);
  return acc ? `${acc.icon || ''} ${acc.name}` : '—';
}

function renderPacGrid(list) {
  const grid = document.getElementById('pac-grid');
  const empty = document.getElementById('pac-empty-state');
  if (list.length === 0) {
    grid.innerHTML = '';
    empty.hidden = false;
    return;
  }
  empty.hidden = true;

  grid.innerHTML = list.map((pac) => `
    <div class="summary-card">
      <div class="budget-card-header">
        <span>🔄 ${escapeHtml(pac.name)}</span>
        <button class="btn-icon" title="Elimina" onclick="askDeletePac('${pac.id}')">🗑️</button>
      </div>
      <div class="muted-text">${investmentName(pac.investmentId)} · da ${accountName(pac.accountId)}</div>
      <div class="budget-card-numbers">
        <span>${formatMoney(pac.amount)} / ${formatPacFrequency(pac.frequency, pac.everyN).toLowerCase()}</span>
        <span><span class="status-pill ${pac.active ? 'status-active' : 'status-inactive'}">${pac.active ? 'Attivo' : 'Sospeso'}</span></span>
      </div>
      <div class="budget-card-numbers">
        <span>Versato finora: <strong>${formatMoney(pac.totalPaid)}</strong></span>
        <span>${pac.paymentsCount} versamenti</span>
      </div>
      <div class="muted-text">Prossimo: ${formatDate(pac.nextDueDate)}${pac.endDate ? ` · fine ${formatDate(pac.endDate)}` : ''}</div>
      <div class="goal-actions">
        <button class="btn btn-secondary btn-small" onclick="openInvestmentDetail('${pac.investmentId}')">📊 Vedi investimento</button>
        <button class="btn btn-secondary btn-small" onclick="togglePacActive('${pac.id}', ${!pac.active})">${pac.active ? '⏸️ Sospendi' : '▶️ Riattiva'}</button>
      </div>
    </div>
  `).join('');
}

function openNewPac() {
  if (pacInvestmentsCache.length === 0) {
    showToast('Crea prima almeno un investimento a cui collegare il PAC.', 'error');
    return;
  }
  document.getElementById('pac-modal-title').textContent = 'Nuovo PAC';
  document.getElementById('pac-form').reset();
  document.getElementById('pac-id').value = '';
  document.getElementById('pac-start').value = todayStr();
  document.getElementById('pac-every-n').value = 1;
  populateSelect(document.getElementById('pac-investment'), pacInvestmentsCache, { labelFn: (i) => `${i.name} (${i.type})` });
  populateSelect(document.getElementById('pac-account'), pacAccountsCache, { labelFn: (a) => `${a.icon || ''} ${a.name}` });
  openModal('pac-modal');
}

function togglePacActive(id, active) {
  db.pacs.update(id, { active })
    .then(() => { showToast(active ? 'PAC riattivato.' : 'PAC sospeso.', 'success'); loadPacs(); })
    .catch((err) => showToast(err.message, 'error'));
}

function askDeletePac(id) {
  confirmAction(
    'Eliminare questo PAC? I versamenti già effettuati restano nello storico dell\'investimento, ma non saranno più collegati a nessun PAC.',
    async () => {
      try {
        await db.pacs.remove(id);
        showToast('PAC eliminato.', 'success');
        loadPacs();
      } catch (err) {
        showToast(err.message, 'error');
      }
    }
  );
}

function bindPacPageEvents() {
  if (pacPageBound) return;
  pacPageBound = true;

  document.getElementById('btn-new-pac').addEventListener('click', openNewPac);
  document.getElementById('btn-generate-pac').addEventListener('click', () => promptPacGeneration(true));

  document.getElementById('pac-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
      name: document.getElementById('pac-name').value,
      investmentId: document.getElementById('pac-investment').value,
      accountId: document.getElementById('pac-account').value,
      amount: eurosToCents(document.getElementById('pac-amount').value),
      frequency: document.getElementById('pac-frequency').value,
      everyN: parseInt(document.getElementById('pac-every-n').value, 10) || 1,
      startDate: document.getElementById('pac-start').value,
      endDate: document.getElementById('pac-end').value || null
    };
    try {
      await db.pacs.create(payload);
      showToast('PAC creato.', 'success');
      closeModal('pac-modal');
      loadPacs();
    } catch (err) {
      showToast(err.message, 'error');
    }
  });
}

window.initPacPage = initPacPage;
window.togglePacActive = togglePacActive;
window.askDeletePac = askDeletePac;
