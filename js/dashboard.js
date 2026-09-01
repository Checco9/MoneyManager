/**
 * public/js/dashboard.js
 * Pagina Dashboard: patrimonio, entrate/uscite/risparmio del mese, grafici.
 */

let dashFlowChart = null;
let dashAccountsChart = null;

async function initDashboardPage() {
  try {
    const [wealth, monthSummary, trend, recentTx] = await Promise.all([
      calc.computeWealthBreakdown(),
      calc.computeMonthSummary(currentMonthStr()),
      calc.computeMonthlyTrend(6),
      db.transactions.list({ sort: 'date_desc' })
    ]);

    renderDashSummary(wealth, monthSummary);
    renderDashRecent(recentTx.slice(0, 8));
    renderDashFlowChart(trend);
    renderDashAccountsChart(wealth.accounts);
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function renderDashSummary(wealth, monthSummary) {
  document.getElementById('dash-summary').innerHTML = `
    <div class="summary-card total"><div class="label">Patrimonio totale</div><div class="value">${formatMoney(wealth.total)}</div></div>
    <div class="summary-card"><div class="label">Liquidità</div><div class="value">${formatMoney(wealth.liquidity)}</div></div>
    <div class="summary-card"><div class="label">Investimenti</div><div class="value">${formatMoney(wealth.investments)}</div></div>
    <div class="summary-card"><div class="label">Entrate del mese</div><div class="value" style="color:var(--color-success)">${formatMoney(monthSummary.income)}</div></div>
    <div class="summary-card"><div class="label">Uscite del mese</div><div class="value" style="color:var(--color-danger)">${formatMoney(monthSummary.expense)}</div></div>
    <div class="summary-card"><div class="label">Risparmio del mese</div><div class="value">${formatMoney(monthSummary.savings)}</div></div>
  `;
}

function renderDashRecent(transactions) {
  const body = document.getElementById('dash-recent-tx');
  if (!transactions || transactions.length === 0) {
    body.innerHTML = '<tr><td class="empty-state">Nessuna transazione ancora registrata.</td></tr>';
    return;
  }
  body.innerHTML = transactions
    .map((t) => {
      const cls = t.type === 'income' ? 'balance-positive' : 'balance-negative';
      const sign = t.type === 'income' ? '+' : '−';
      return `<tr>
        <td>${formatDate(t.date)}</td>
        <td>${escapeHtml(t.description) || '<span class="muted-text">Senza descrizione</span>'}</td>
        <td class="${cls}">${sign} ${formatMoney(t.amount)}</td>
      </tr>`;
    })
    .join('');
}

function renderDashFlowChart(trend) {
  const ctx = document.getElementById('dash-chart-flow');
  if (dashFlowChart) dashFlowChart.destroy();
  dashFlowChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: trend.map((m) => m.month),
      datasets: [
        { label: 'Entrate', data: trend.map((m) => m.income / 100), backgroundColor: '#16a34a' },
        { label: 'Uscite', data: trend.map((m) => m.expense / 100), backgroundColor: '#dc2626' }
      ]
    },
    options: { responsive: true, plugins: { legend: { position: 'bottom' } } }
  });
}

function renderDashAccountsChart(accounts) {
  const ctx = document.getElementById('dash-chart-accounts');
  const wrapper = ctx.parentElement;
  const active = accounts.filter((a) => a.currentBalance > 0);

  if (dashAccountsChart) { dashAccountsChart.destroy(); dashAccountsChart = null; }

  // Rimuovo un eventuale messaggio mostrato in precedenza, prima di
  // decidere se ridisegnare il grafico o mostrarne uno nuovo.
  const existingMsg = wrapper.querySelector('.chart-empty-message');
  if (existingMsg) existingMsg.remove();
  ctx.hidden = false;

  if (active.length === 0) {
    ctx.hidden = true;
    const msg = document.createElement('p');
    msg.className = 'chart-empty-message muted-text';
    msg.textContent = accounts.length === 0
      ? 'Crea il tuo primo conto per vedere qui la distribuzione del patrimonio.'
      : 'Nessun conto con saldo positivo da mostrare: assicurati di aver impostato un saldo iniziale o di aver registrato almeno una transazione.';
    wrapper.appendChild(msg);
    return;
  }

  dashAccountsChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: active.map((a) => a.name),
      datasets: [{ data: active.map((a) => a.currentBalance / 100), backgroundColor: active.map((a) => a.color || '#4f46e5') }]
    },
    options: { responsive: true, plugins: { legend: { position: 'bottom' } } }
  });
}

window.initDashboardPage = initDashboardPage;
