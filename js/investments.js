/**
 * public/js/investments.js
 * Pagina "Investimenti": tracciamento manuale, senza quotazioni in tempo reale.
 */

let investmentsPageBound = false;
let allInvestmentsCache = [];

async function initInvestmentsPage() {
  bindInvestmentsPageEvents();
  await loadInvestments();
}

async function loadInvestments() {
  try {
    const list = await db.investments.list();
    // Per ogni investimento, se esistono rilevazioni storiche uso quelle
    // per capitale/valore/rendimento invece dei vecchi campi statici,
    // mantenendo comunque la retrocompatibilità per chi non ne ha ancora.
    const enriched = await Promise.all(list.map(async (inv) => {
      const [movements, valuations] = await Promise.all([
        db.investmentMovements.listForInvestment(inv.id),
        db.investmentValuations.listForInvestment(inv.id)
      ]);
      const hasHistory = valuations.length > 0;
      const capital = hasHistory ? investmentCalc.computeCapitalPaidIn(inv, movements) : inv.capital;
      const currentValue = hasHistory ? investmentCalc.getCurrentValue(inv, valuations) : inv.currentValue;
      const dividends = investmentCalc.computeTotalDividends(movements);
      const absoluteReturn = currentValue - capital;
      const percentReturn = capital > 0 ? Math.round((absoluteReturn / capital) * 1000) / 10 : 0;
      return { ...inv, capital, currentValue, absoluteReturn, percentReturn, dividends, hasHistory };
    }));
    allInvestmentsCache = enriched;
    renderInvestmentsTable(enriched);
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function renderInvestmentsTable(list) {
  const body = document.getElementById('investments-table-body');
  const empty = document.getElementById('investments-empty-state');
  if (list.length === 0) {
    body.innerHTML = '';
    empty.hidden = false;
    return;
  }
  empty.hidden = true;

  body.innerHTML = list
    .map((i) => {
      const cls = i.absoluteReturn >= 0 ? 'balance-positive' : 'balance-negative';
      const sign = i.absoluteReturn >= 0 ? '+' : '';
      const subtitle = [i.ticker, i.broker].filter(Boolean).join(' · ');
      const dividendNote = i.dividends > 0 ? `<div class="muted-text" style="font-size:0.75rem">di cui ${formatMoney(i.dividends)} dividendi</div>` : '';
      return `<tr>
        <td data-label="Nome">${escapeHtml(i.name)}${i.hasHistory ? ' <span class="status-pill status-active" title="Ha uno storico rilevazioni">storico</span>' : ''}${subtitle ? `<div class="muted-text" style="font-size:0.78rem">${escapeHtml(subtitle)}</div>` : ''}</td>
        <td data-label="Tipo">${i.type}</td>
        <td data-label="Capitale">${formatMoney(i.capital)}</td>
        <td data-label="Valore attuale">${formatMoney(i.currentValue)}</td>
        <td data-label="Rendimento" class="${cls}">${sign}${formatMoney(i.absoluteReturn)} (${sign}${i.percentReturn}%)${dividendNote}</td>
        <td>
          <button class="btn-icon" title="Dettagli e storico" onclick="openInvestmentDetail('${i.id}')">📊</button>
          <button class="btn-icon" title="Modifica" onclick="openEditInvestment('${i.id}')">✏️</button>
          <button class="btn-icon" title="Elimina" onclick="askDeleteInvestment('${i.id}')">🗑️</button>
        </td>
      </tr>`;
    })
    .join('');
}

function openNewInvestment() {
  document.getElementById('investment-modal-title').textContent = 'Nuovo investimento';
  document.getElementById('investment-form').reset();
  document.getElementById('investment-id').value = '';
  document.getElementById('investment-date').value = todayStr();
  document.getElementById('investment-currency').value = 'EUR';
  openModal('investment-modal');
}

function openEditInvestment(id) {
  db.investments.list().then((list) => {
    const inv = list.find((i) => i.id === id);
    if (!inv) return;
    document.getElementById('investment-modal-title').textContent = 'Modifica investimento';
    document.getElementById('investment-id').value = inv.id;
    document.getElementById('investment-name').value = inv.name;
    document.getElementById('investment-type').value = inv.type;
    document.getElementById('investment-capital').value = (inv.capital / 100).toFixed(2);
    document.getElementById('investment-current-value').value = (inv.currentValue / 100).toFixed(2);
    document.getElementById('investment-date').value = inv.date || '';
    document.getElementById('investment-notes').value = inv.notes || '';
    document.getElementById('investment-ticker').value = inv.ticker || '';
    document.getElementById('investment-isin').value = inv.isin || '';
    document.getElementById('investment-quantity').value = inv.quantity !== null && inv.quantity !== undefined ? inv.quantity : '';
    document.getElementById('investment-avg-price').value = inv.avgPrice ? (inv.avgPrice / 100).toFixed(2) : '';
    document.getElementById('investment-currency').value = inv.currency || 'EUR';
    document.getElementById('investment-broker').value = inv.broker || '';
    openModal('investment-modal');
  }).catch((err) => showToast(err.message, 'error'));
}

function askDeleteInvestment(id) {
  const inv = allInvestmentsCache.find((i) => i.id === id);
  const warning = inv && inv.hasHistory
    ? `Eliminare "${inv.name}"? Verranno cancellate ANCHE tutte le rilevazioni e i movimenti storici collegati. L'operazione non è reversibile.`
    : 'Eliminare questo investimento?';

  confirmAction(warning, async () => {
    try {
      await db.investments.remove(id);
      showToast('Investimento eliminato.', 'success');
      loadInvestments();
    } catch (err) {
      showToast(err.message, 'error');
    }
  }, 'Conferma eliminazione');
}

function bindInvestmentsPageEvents() {
  if (investmentsPageBound) return;
  investmentsPageBound = true;

  document.getElementById('btn-new-investment').addEventListener('click', openNewInvestment);

  document.getElementById('btn-calc-capital').addEventListener('click', () => {
    const qty = parseFloat(document.getElementById('investment-quantity').value);
    const price = parseFloat(document.getElementById('investment-avg-price').value);
    if (!qty || !price) {
      showToast('Inserisci prima quantità e prezzo medio.', 'error');
      return;
    }
    document.getElementById('investment-capital').value = (qty * price).toFixed(2);
  });

  document.getElementById('investment-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('investment-id').value;
    const quantityVal = document.getElementById('investment-quantity').value;
    const avgPriceVal = document.getElementById('investment-avg-price').value;
    const payload = {
      name: document.getElementById('investment-name').value,
      type: document.getElementById('investment-type').value,
      capital: eurosToCents(document.getElementById('investment-capital').value),
      currentValue: eurosToCents(document.getElementById('investment-current-value').value),
      date: document.getElementById('investment-date').value,
      notes: document.getElementById('investment-notes').value,
      ticker: document.getElementById('investment-ticker').value.trim(),
      isin: document.getElementById('investment-isin').value.trim(),
      quantity: quantityVal !== '' ? parseFloat(quantityVal) : null,
      avgPrice: avgPriceVal !== '' ? eurosToCents(avgPriceVal) : null,
      currency: document.getElementById('investment-currency').value.trim() || 'EUR',
      broker: document.getElementById('investment-broker').value.trim()
    };
    try {
      if (id) {
        await db.investments.update(id, payload);
        showToast('Investimento aggiornato.', 'success');
      } else {
        await db.investments.create(payload);
        showToast('Investimento creato.', 'success');
      }
      closeModal('investment-modal');
      loadInvestments();
    } catch (err) {
      showToast(err.message, 'error');
    }
  });
}

window.initInvestmentsPage = initInvestmentsPage;
window.openEditInvestment = openEditInvestment;
window.askDeleteInvestment = askDeleteInvestment;
