/**
 * public/js/financial-health.js
 *
 * Pagina "Salute finanziaria": non introduce NESSUN calcolo nuovo sui
 * dati grezzi — aggrega e presenta in un unico posto indicatori ottenuti
 * da funzioni già esistenti (calc.computeWealthBreakdown,
 * calc.computeMonthlyTrend, calc.computeWealthOverTime).
 *
 * Principio esplicito: questi sono INDICATORI DESCRITTIVI, non consigli.
 * Il testo generato descrive cosa dicono i numeri, mai cosa "dovresti"
 * fare (niente "dovresti investire di più", solo fatti osservabili).
 */

let fhWealthChart = null;

async function initFinancialHealthPage() {
  try {
    const [wealth, trend6, wealthOverTime] = await Promise.all([
      calc.computeWealthBreakdown(),
      calc.computeMonthlyTrend(6),
      calc.computeWealthOverTime(12)
    ]);

    renderFhSummary(wealth, trend6);
    renderFhInsights(wealth, trend6);

    if (typeof Chart !== 'undefined') {
      try { renderFhWealthChart(wealthOverTime); } catch (e) { console.warn(e); }
    }
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function computeIndicators(wealth, trend) {
  const validMonths = trend.filter((m) => m.income > 0 || m.expense > 0);
  const avgSavings = validMonths.length ? Math.round(validMonths.reduce((s, m) => s + m.savings, 0) / validMonths.length) : 0;
  const avgExpense = validMonths.length ? Math.round(validMonths.reduce((s, m) => s + m.expense, 0) / validMonths.length) : 0;
  const pctInvested = wealth.total > 0 ? Math.round((wealth.investments / wealth.total) * 1000) / 10 : 0;
  const monthsCovered = avgExpense > 0 ? Math.round((wealth.liquidity / avgExpense) * 10) / 10 : null;
  return { avgSavings, avgExpense, pctInvested, monthsCovered, validMonths };
}

function renderFhSummary(wealth, trend) {
  const { avgSavings, pctInvested, monthsCovered } = computeIndicators(wealth, trend);

  document.getElementById('fh-summary').innerHTML = `
    <div class="summary-card total"><div class="label">Patrimonio totale</div><div class="value">${formatMoney(wealth.total)}</div></div>
    <div class="summary-card"><div class="label">Liquidità disponibile</div><div class="value">${formatMoney(wealth.liquidity)}</div></div>
    <div class="summary-card"><div class="label">% patrimonio investito</div><div class="value">${pctInvested}%</div></div>
    <div class="summary-card"><div class="label">Risparmio medio mensile (6 mesi)</div><div class="value">${formatMoney(avgSavings)}</div></div>
    <div class="summary-card"><div class="label">Mesi di spese coperti dalla liquidità</div><div class="value">${monthsCovered !== null ? monthsCovered + ' mesi' : '—'}</div></div>
  `;
}

function renderFhWealthChart(wealthOverTime) {
  const ctx = document.getElementById('fh-chart-wealth');
  if (fhWealthChart) fhWealthChart.destroy();
  fhWealthChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: wealthOverTime.map((w) => w.month),
      datasets: [{ label: 'Patrimonio totale', data: wealthOverTime.map((w) => w.total / 100), borderColor: '#4f46e5', tension: 0.3, fill: false }]
    },
    options: { responsive: true, plugins: { legend: { display: false } } }
  });
}

/**
 * Genera osservazioni testuali DESCRITTIVE, mai prescrittive. Ogni
 * frase riporta un fatto calcolabile dai dati, senza suggerire azioni
 * ("dovresti...") né esprimere giudizi di valore.
 */
function renderFhInsights(wealth, trend) {
  const { avgSavings, avgExpense, pctInvested, monthsCovered, validMonths } = computeIndicators(wealth, trend);
  const insights = [];

  if (validMonths.length === 0) {
    insights.push('Non ci sono ancora abbastanza transazioni registrate per calcolare indicatori affidabili su entrate e uscite.');
  } else {
    insights.push(`Negli ultimi ${validMonths.length} mesi con movimenti registrati, il risparmio medio mensile è stato di ${formatMoney(avgSavings)}, a fronte di uscite medie di ${formatMoney(avgExpense)}.`);
  }

  if (wealth.total > 0) {
    insights.push(`Il ${pctInvested}% del patrimonio totale è attualmente investito, il resto (${100 - pctInvested}%) è liquidità immediatamente disponibile.`);
  }

  if (monthsCovered !== null) {
    if (monthsCovered < 3) {
      insights.push(`La liquidità disponibile copre circa ${monthsCovered} mesi di spese medie — un valore basso rispetto alla soglia di 3-6 mesi comunemente citata come fondo di emergenza, ma questa è solo un'osservazione statistica, non una raccomandazione.`);
    } else {
      insights.push(`La liquidità disponibile copre circa ${monthsCovered} mesi di spese medie.`);
    }
  } else {
    insights.push('Non ci sono ancora abbastanza dati di spesa per stimare quanti mesi di spese copra la liquidità disponibile.');
  }

  document.getElementById('fh-insights').innerHTML = insights.map((text) => `<li>${escapeHtml(text)}</li>`).join('');
}

window.initFinancialHealthPage = initFinancialHealthPage;
