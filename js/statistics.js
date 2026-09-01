/**
 * public/js/statistics.js
 * Pagina "Statistiche": trend mensile, patrimonio nel tempo, categorie, insight.
 */

let statsTrendChart = null;
let statsWealthChart = null;
let statsExpenseCatChart = null;
let statsIncomeCatChart = null;

async function initStatisticsPage() {
  try {
    const month = currentMonthStr();
    const [trend, wealth, expenseCat, incomeCat] = await Promise.all([
      calc.computeMonthlyTrend(12),
      calc.computeWealthOverTime(12),
      calc.computeCategoryTotals(month, 'expense'),
      calc.computeCategoryTotals(month, 'income')
    ]);

    renderInsights(trend, expenseCat);

    if (typeof Chart === 'undefined') {
      showToast('I grafici non si sono caricati (problema di rete).', 'error');
      return;
    }
    try { renderTrendChart(trend); } catch (e) { console.warn(e); }
    try { renderWealthChart(wealth); } catch (e) { console.warn(e); }
    try { renderCategoryChart('stats-chart-expense-cat', expenseCat, (c) => statsExpenseCatChart = c, statsExpenseCatChart); } catch (e) { console.warn(e); }
    try { renderCategoryChart('stats-chart-income-cat', incomeCat, (c) => statsIncomeCatChart = c, statsIncomeCatChart); } catch (e) { console.warn(e); }
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function renderTrendChart(trend) {
  const ctx = document.getElementById('stats-chart-trend');
  if (statsTrendChart) statsTrendChart.destroy();
  statsTrendChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: trend.map((m) => m.month),
      datasets: [
        { label: 'Entrate', data: trend.map((m) => m.income / 100), borderColor: '#16a34a', tension: 0.3 },
        { label: 'Uscite', data: trend.map((m) => m.expense / 100), borderColor: '#dc2626', tension: 0.3 },
        { label: 'Risparmio', data: trend.map((m) => m.savings / 100), borderColor: '#4f46e5', tension: 0.3 }
      ]
    },
    options: { responsive: true, plugins: { legend: { position: 'bottom' } } }
  });
}

function renderWealthChart(wealth) {
  const ctx = document.getElementById('stats-chart-wealth');
  if (statsWealthChart) statsWealthChart.destroy();
  statsWealthChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: wealth.map((w) => w.month),
      datasets: [
        { label: 'Liquidità', data: wealth.map((w) => w.liquidity / 100), borderColor: '#0ea5e9', tension: 0.3 },
        { label: 'Investimenti', data: wealth.map((w) => w.investments / 100), borderColor: '#f59e0b', tension: 0.3 },
        { label: 'Totale', data: wealth.map((w) => w.total / 100), borderColor: '#4f46e5', tension: 0.3, borderWidth: 3 }
      ]
    },
    options: { responsive: true, plugins: { legend: { position: 'bottom' } } }
  });
}

function renderCategoryChart(canvasId, data, setter, existing) {
  const ctx = document.getElementById(canvasId);
  if (existing) existing.destroy();
  if (data.length === 0) { setter(null); return; }

  const chart = new Chart(ctx, {
    type: 'pie',
    data: { labels: data.map((c) => `${c.icon} ${c.categoryName}`), datasets: [{ data: data.map((c) => c.amount / 100) }] },
    options: { responsive: true, plugins: { legend: { position: 'bottom' } } }
  });
  setter(chart);
}

function renderInsights(trend, expenseCat) {
  const nonEmpty = trend.filter((m) => m.income > 0 || m.expense > 0);
  const avgExpense = nonEmpty.length ? Math.round(nonEmpty.reduce((s, m) => s + m.expense, 0) / nonEmpty.length) : 0;
  const top = expenseCat[0] || null;

  document.getElementById('stats-insights').innerHTML = `
    <div class="summary-card">
      <div class="label">Media spese mensili (12 mesi)</div>
      <div class="value">${formatMoney(avgExpense)}</div>
    </div>
    <div class="summary-card">
      <div class="label">Categoria con più spesa (mese corrente)</div>
      <div class="value">${top ? `${top.icon} ${top.categoryName}` : '—'}</div>
    </div>
  `;
}

window.initStatisticsPage = initStatisticsPage;
