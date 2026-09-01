/**
 * public/js/accounts.js
 * Pagina "Conti": lista, creazione, modifica, eliminazione con conferma.
 */

const TYPE_LABELS = {
  contanti: 'Contanti', conto_corrente: 'Conto corrente', carta: 'Carta',
  poste: 'Poste', postepay: 'Postepay', paypal: 'PayPal',
  investimenti: 'Investimenti', altro: 'Altro'
};

let accountsCache = [];
let accountsPageBound = false;

async function initAccountsPage() {
  bindAccountsPageEvents();
  await loadAccounts();
}

async function loadAccounts() {
  try {
    const wealth = await calc.computeWealthBreakdown();
    accountsCache = wealth.accounts;
    renderAccountsSummary();
    renderAccountsTable();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function renderAccountsSummary() {
  const total = accountsCache.reduce((sum, a) => sum + a.currentBalance, 0);
  const activeCount = accountsCache.filter((a) => a.active).length;
  document.getElementById('accounts-summary').innerHTML = `
    <div class="summary-card total"><div class="label">Patrimonio totale</div><div class="value">${formatMoney(total)}</div></div>
    <div class="summary-card"><div class="label">Conti attivi</div><div class="value">${activeCount}</div></div>
    <div class="summary-card"><div class="label">Conti totali</div><div class="value">${accountsCache.length}</div></div>
  `;
}

function renderAccountsTable() {
  const body = document.getElementById('accounts-table-body');
  const empty = document.getElementById('accounts-empty-state');

  if (accountsCache.length === 0) {
    body.innerHTML = '';
    empty.hidden = false;
    return;
  }
  empty.hidden = true;

  body.innerHTML = accountsCache
    .map((acc) => {
      const balanceClass = acc.currentBalance < 0 ? 'balance-negative' : 'balance-positive';
      return `<tr>
        <td style="font-size:1.2rem">${acc.icon || '💰'}</td>
        <td data-label="Nome">${escapeHtml(acc.name)}</td>
        <td data-label="Tipo">${TYPE_LABELS[acc.type] || acc.type}</td>
        <td data-label="Saldo iniziale">${formatMoney(acc.initialBalance)}</td>
        <td data-label="Saldo attuale" class="${balanceClass}">${formatMoney(acc.currentBalance)}</td>
        <td data-label="Stato"><span class="status-pill ${acc.active ? 'status-active' : 'status-inactive'}">${acc.active ? 'Attivo' : 'Non attivo'}</span></td>
        <td>
          <button class="btn-icon" title="Modifica" onclick="openEditAccount('${acc.id}')">✏️</button>
          <button class="btn-icon" title="Elimina" onclick="askDeleteAccount('${acc.id}')">🗑️</button>
        </td>
      </tr>`;
    })
    .join('');
}

function openNewAccount() {
  document.getElementById('account-modal-title').textContent = 'Nuovo conto';
  document.getElementById('account-form').reset();
  document.getElementById('account-id').value = '';
  document.getElementById('account-color').value = '#4f46e5';
  document.getElementById('account-opening-date').value = todayStr();
  openModal('account-modal');
}

function openEditAccount(id) {
  const acc = accountsCache.find((a) => a.id === id);
  if (!acc) return;
  document.getElementById('account-modal-title').textContent = 'Modifica conto';
  document.getElementById('account-id').value = acc.id;
  document.getElementById('account-name').value = acc.name;
  document.getElementById('account-type').value = acc.type;
  document.getElementById('account-initial-balance').value = (acc.initialBalance / 100).toFixed(2);
  document.getElementById('account-opening-date').value = acc.openingDate || '';
  document.getElementById('account-color').value = acc.color || '#4f46e5';
  document.getElementById('account-icon').value = acc.icon || '';
  document.getElementById('account-notes').value = acc.notes || '';
  document.getElementById('account-active').checked = !!acc.active;
  openModal('account-modal');
}

function askDeleteAccount(id) {
  const acc = accountsCache.find((a) => a.id === id);
  confirmAction(
    `Sei sicuro di voler eliminare il conto "${acc ? acc.name : ''}"? L'operazione non è reversibile.`,
    async () => {
      try {
        await db.accounts.remove(id);
        showToast('Conto eliminato.', 'success');
        loadAccounts();
      } catch (err) {
        showToast(err.message, 'error');
      }
    }
  );
}

function bindAccountsPageEvents() {
  if (accountsPageBound) return;
  accountsPageBound = true;

  document.getElementById('btn-new-account').addEventListener('click', openNewAccount);

  document.getElementById('account-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('account-id').value;
    const payload = {
      name: document.getElementById('account-name').value,
      type: document.getElementById('account-type').value,
      initialBalance: eurosToCents(document.getElementById('account-initial-balance').value || '0'),
      openingDate: document.getElementById('account-opening-date').value,
      color: document.getElementById('account-color').value,
      icon: document.getElementById('account-icon').value,
      notes: document.getElementById('account-notes').value,
      active: document.getElementById('account-active').checked
    };
    try {
      if (id) {
        await db.accounts.update(id, payload);
        showToast('Conto aggiornato.', 'success');
      } else {
        await db.accounts.create(payload);
        showToast('Conto creato.', 'success');
      }
      closeModal('account-modal');
      loadAccounts();
    } catch (err) {
      showToast(err.message, 'error');
    }
  });
}

window.initAccountsPage = initAccountsPage;
window.openEditAccount = openEditAccount;
window.askDeleteAccount = askDeleteAccount;
window.getAccountsCache = () => accountsCache;
