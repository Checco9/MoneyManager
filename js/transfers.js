/**
 * public/js/transfers.js
 * Pagina "Giroconti": lista + CRUD.
 */

let transfersPageBound = false;
let transfersAccountsCache = [];

async function initTransfersPage() {
  bindTransfersPageEvents();
  transfersAccountsCache = await db.accounts.list().catch((e) => { showToast(e.message, 'error'); return []; });
  await loadTransfers();
}

async function loadTransfers() {
  try {
    const list = await db.transfers.list();
    renderTransfersTable(list);
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function accountName(id) {
  const acc = transfersAccountsCache.find((a) => a.id === id);
  return acc ? `${acc.icon || ''} ${acc.name}` : '—';
}

function renderTransfersTable(list) {
  const body = document.getElementById('transfers-table-body');
  const empty = document.getElementById('transfers-empty-state');
  if (list.length === 0) {
    body.innerHTML = '';
    empty.hidden = false;
    return;
  }
  empty.hidden = true;

  body.innerHTML = list
    .map((t) => `<tr>
      <td data-label="Data">${formatDate(t.date)}</td>
      <td data-label="Da">${accountName(t.fromAccountId)}</td>
      <td data-label="A">${accountName(t.toAccountId)}</td>
      <td data-label="Importo">${formatMoney(t.amount)}</td>
      <td data-label="Descrizione">${escapeHtml(t.description) || '<span class="muted-text">—</span>'}</td>
      <td>
        <button class="btn-icon" title="Modifica" onclick="openEditTransfer('${t.id}')">✏️</button>
        <button class="btn-icon" title="Elimina" onclick="askDeleteTransfer('${t.id}')">🗑️</button>
      </td>
    </tr>`)
    .join('');
}

function accountLabelFn(a) { return `${a.icon || ''} ${a.name}`; }

async function openNewTransfer() {
  document.getElementById('transfer-modal-title').textContent = 'Nuovo giroconto';
  document.getElementById('transfer-form').reset();
  document.getElementById('transfer-id').value = '';
  document.getElementById('transfer-date').value = todayStr();
  populateSelect(document.getElementById('transfer-from'), transfersAccountsCache, { labelFn: accountLabelFn });
  populateSelect(document.getElementById('transfer-to'), transfersAccountsCache, { labelFn: accountLabelFn });
  openModal('transfer-modal');
}

function openEditTransfer(id) {
  db.transfers.get(id).then((t) => {
    document.getElementById('transfer-modal-title').textContent = 'Modifica giroconto';
    document.getElementById('transfer-id').value = t.id;
    document.getElementById('transfer-amount').value = (t.amount / 100).toFixed(2);
    document.getElementById('transfer-date').value = t.date;
    document.getElementById('transfer-description').value = t.description || '';
    populateSelect(document.getElementById('transfer-from'), transfersAccountsCache, { labelFn: accountLabelFn });
    populateSelect(document.getElementById('transfer-to'), transfersAccountsCache, { labelFn: accountLabelFn });
    document.getElementById('transfer-from').value = t.fromAccountId;
    document.getElementById('transfer-to').value = t.toAccountId;
    openModal('transfer-modal');
  }).catch((err) => showToast(err.message, 'error'));
}

function askDeleteTransfer(id) {
  confirmAction('Sei sicuro di voler annullare questo giroconto?', async () => {
    try {
      await db.transfers.remove(id);
      showToast('Giroconto eliminato.', 'success');
      loadTransfers();
    } catch (err) {
      showToast(err.message, 'error');
    }
  });
}

function bindTransfersPageEvents() {
  if (transfersPageBound) return;
  transfersPageBound = true;

  document.getElementById('btn-new-transfer').addEventListener('click', openNewTransfer);
  document.getElementById('quick-add-transfer').addEventListener('click', async () => {
    window.location.hash = 'transfers';
    if (transfersAccountsCache.length === 0) transfersAccountsCache = await db.accounts.list().catch(() => []);
    setTimeout(openNewTransfer, 50);
  });

  document.getElementById('transfer-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('transfer-id').value;
    const payload = {
      fromAccountId: document.getElementById('transfer-from').value,
      toAccountId: document.getElementById('transfer-to').value,
      amount: eurosToCents(document.getElementById('transfer-amount').value),
      date: document.getElementById('transfer-date').value,
      description: document.getElementById('transfer-description').value
    };
    try {
      if (id) {
        await db.transfers.update(id, payload);
        showToast('Giroconto aggiornato.', 'success');
      } else {
        await db.transfers.create(payload);
        showToast('Giroconto registrato.', 'success');
      }
      closeModal('transfer-modal');
      loadTransfers();
    } catch (err) {
      showToast(err.message, 'error');
    }
  });
}

window.initTransfersPage = initTransfersPage;
window.openEditTransfer = openEditTransfer;
window.askDeleteTransfer = askDeleteTransfer;
