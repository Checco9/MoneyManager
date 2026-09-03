/**
 * public/js/investment-detail.js
 *
 * Pagina di dettaglio per un singolo investimento: storico rilevazioni,
 * versamenti/prelievi, grafici e analisi testuale.
 *
 * Il router del progetto è volutamente semplice (hash -> pagina, senza
 * parametri nell'URL). Invece di riscriverlo per supportare "/investment/:id",
 * che avrebbe richiesto toccare l'architettura di navigazione condivisa
 * da tutte le pagine, memorizzo qui l'id dell'investimento corrente in una
 * variabile di modulo, impostata da openInvestmentDetail() PRIMA di
 * cambiare l'hash. È la soluzione che introduce meno cambiamenti
 * strutturali, coerente con il resto del progetto.
 */

let currentInvestmentId = null;
let currentInvestment = null;
let currentMovements = [];
let currentValuations = [];

let detailPageBound = false;
let compositionRowCount = 0;

const DATA_SOURCE_LABELS = {
  manual: 'Manuale', automatic: 'Automatica', calculated: 'Calcolata', estimate: 'Stima'
};

let chartValue = null, chartCapitalVsValue = null, chartComposition = null,
    chartCompositionTime = null, chartMwrr = null, chartCosts = null;

function openInvestmentDetail(id) {
  currentInvestmentId = id;
  window.location.hash = 'investment-detail';
  // Se l'hash non cambia (già sulla pagina), il router non ricarica da
  // solo: forziamo noi l'init.
  if (window.location.hash === '#investment-detail') initInvestmentDetailPage();
}

async function initInvestmentDetailPage() {
  if (!currentInvestmentId) {
    window.location.hash = 'investments';
    return;
  }
  bindDetailPageEvents();

  try {
    const [investment, movements, valuations] = await Promise.all([
      db.investments.get(currentInvestmentId),
      db.investmentMovements.listForInvestment(currentInvestmentId),
      db.investmentValuations.listForInvestment(currentInvestmentId)
    ]);
    currentInvestment = investment;
    currentMovements = movements;
    currentValuations = valuations;

    document.getElementById('detail-investment-name').textContent = `${investment.name} (${investment.type})`;
    document.getElementById('detail-official-links').hidden = investment.type !== 'Polizza';
    document.getElementById('detail-inflation-input').value = '';
    document.getElementById('detail-inflation-source').textContent = '';
    document.getElementById('detail-real-return-result').textContent = '';

    renderDetailSummary();
    renderDetailInsights();
    renderValuationsTable();
    renderMovementsTable();
    renderDetailCharts();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ---------- Riepilogo numerico ----------

function renderDetailSummary() {
  const paidIn = investmentCalc.computeCapitalPaidIn(currentInvestment, currentMovements);
  const current = investmentCalc.getCurrentValue(currentInvestment, currentValuations);
  const absReturn = investmentCalc.computeAbsoluteReturn(currentInvestment, currentMovements, currentValuations);
  const pctReturn = investmentCalc.computePercentReturn(currentInvestment, currentMovements, currentValuations);
  const annualized = investmentCalc.computeAnnualizedReturn(currentInvestment, currentMovements, currentValuations);
  const latest = investmentCalc.getLatestValuation(currentValuations);

  const returnClass = absReturn >= 0 ? 'balance-positive' : 'balance-negative';

  document.getElementById('detail-summary').innerHTML = `
    <div class="summary-card"><div class="label">Capitale versato</div><div class="value">${formatMoney(paidIn)}</div></div>
    <div class="summary-card"><div class="label">Valore attuale</div><div class="value">${formatMoney(current)}</div></div>
    <div class="summary-card"><div class="label">Rendimento</div><div class="value ${returnClass}">${absReturn >= 0 ? '+' : ''}${formatMoney(absReturn)}${pctReturn !== null ? ` (${pctReturn >= 0 ? '+' : ''}${pctReturn}%)` : ''}</div></div>
    <div class="summary-card"><div class="label">Rendimento annualizzato</div><div class="value">${annualized !== null ? (annualized * 100).toFixed(1) + '%' : '—'}</div></div>
    <div class="summary-card"><div class="label">MWRR (ultima rilevazione)</div><div class="value">${latest && latest.mwrr !== null && latest.mwrr !== undefined ? latest.mwrr + '%' : '—'}</div></div>
  `;

  // Sezione inflazione: calcolo live quando l'utente digita un valore
  updateRealReturnDisplay(pctReturn);
}

function updateRealReturnDisplay(nominalPctReturn) {
  const input = document.getElementById('detail-inflation-input');
  const result = document.getElementById('detail-real-return-result');
  const inflationValue = input.value ? parseFloat(input.value) : null;

  if (inflationValue === null || nominalPctReturn === null) {
    result.textContent = '';
    return;
  }
  const real = investmentCalc.computeRealReturn(nominalPctReturn, inflationValue);
  result.textContent = real !== null
    ? `Rendimento nominale ${nominalPctReturn >= 0 ? '+' : ''}${nominalPctReturn}% → rendimento reale stimato: ${real >= 0 ? '+' : ''}${real}%.`
    : '';
}

// ---------- Analisi testuale ----------

function renderDetailInsights() {
  const insights = investmentCalc.generateInsights(currentInvestment, currentMovements, currentValuations);
  document.getElementById('detail-insights').innerHTML = insights.map((text) => `<li>${escapeHtml(text)}</li>`).join('');
}

// ---------- Tabelle storico ----------

function renderValuationsTable() {
  const body = document.getElementById('detail-valuations-table-body');
  const empty = document.getElementById('detail-valuations-empty');

  if (currentValuations.length === 0) {
    body.innerHTML = '';
    empty.hidden = false;
    return;
  }
  empty.hidden = true;

  // Più recenti in cima
  const sorted = [...currentValuations].sort((a, b) => b.date.localeCompare(a.date));

  body.innerHTML = sorted.map((v) => {
    const compositionText = v.composition
      ? Object.entries(v.composition).map(([k, pct]) => `${escapeHtml(k)} ${pct}%`).join(', ')
      : '—';
    return `<tr>
      <td data-label="Data">${formatDate(v.date)}</td>
      <td data-label="Valore">${formatMoney(v.totalValue)}</td>
      <td data-label="MWRR">${v.mwrr !== null && v.mwrr !== undefined ? v.mwrr + '%' : '—'}</td>
      <td data-label="Composizione">${compositionText}</td>
      <td data-label="Fonte"><span class="status-pill status-active">${DATA_SOURCE_LABELS[v.dataSource] || v.dataSource}</span></td>
      <td>
        <button class="btn-icon" title="Modifica" onclick="openEditValuation('${v.id}')">✏️</button>
        <button class="btn-icon" title="Elimina" onclick="askDeleteValuation('${v.id}')">🗑️</button>
      </td>
    </tr>`;
  }).join('');
}

function renderMovementsTable() {
  const body = document.getElementById('detail-movements-table-body');
  const empty = document.getElementById('detail-movements-empty');

  if (currentMovements.length === 0) {
    body.innerHTML = '';
    empty.hidden = false;
    return;
  }
  empty.hidden = true;

  const sorted = [...currentMovements].sort((a, b) => b.date.localeCompare(a.date));
  body.innerHTML = sorted.map((m) => `<tr>
    <td data-label="Data">${formatDate(m.date)}</td>
    <td data-label="Tipo">${m.type === 'deposit' ? '⬆️ Versamento' : '⬇️ Prelievo'}</td>
    <td data-label="Importo" class="${m.type === 'deposit' ? 'balance-positive' : 'balance-negative'}">${formatMoney(m.amount)}</td>
    <td data-label="Note">${escapeHtml(m.notes) || '<span class="muted-text">—</span>'}</td>
    <td>
      <button class="btn-icon" title="Modifica" onclick="openEditMovement('${m.id}')">✏️</button>
      <button class="btn-icon" title="Elimina" onclick="askDeleteMovement('${m.id}')">🗑️</button>
    </td>
  </tr>`).join('');
}

// ---------- Grafici ----------

function destroyChart(chart) { if (chart) chart.destroy(); return null; }

function renderDetailCharts() {
  if (typeof Chart === 'undefined') {
    showToast('I grafici non si sono caricati (problema di rete).', 'error');
    return;
  }

  const sorted = [...currentValuations].sort((a, b) => a.date.localeCompare(b.date));
  const labels = sorted.map((v) => formatDate(v.date));

  chartValue = destroyChart(chartValue);
  chartCapitalVsValue = destroyChart(chartCapitalVsValue);
  chartComposition = destroyChart(chartComposition);
  chartCompositionTime = destroyChart(chartCompositionTime);
  chartMwrr = destroyChart(chartMwrr);
  chartCosts = destroyChart(chartCosts);

  if (sorted.length === 0) return;

  // Valore nel tempo
  chartValue = new Chart(document.getElementById('detail-chart-value'), {
    type: 'line',
    data: { labels, datasets: [{ label: 'Valore', data: sorted.map((v) => v.totalValue / 100), borderColor: '#4f46e5', tension: 0.3 }] },
    options: { responsive: true, plugins: { legend: { display: false } } }
  });

  // Capitale versato vs valore attuale (capitale ricostruito data per data)
  const capitalOverTime = sorted.map((v) => {
    const movementsUpToDate = currentMovements.filter((m) => m.date <= v.date);
    return investmentCalc.computeCapitalPaidIn(currentInvestment, movementsUpToDate) / 100;
  });
  chartCapitalVsValue = new Chart(document.getElementById('detail-chart-capital-vs-value'), {
    type: 'line',
    data: {
      labels,
      datasets: [
        { label: 'Capitale versato', data: capitalOverTime, borderColor: '#6b7280', borderDash: [5, 5], tension: 0.1 },
        { label: 'Valore', data: sorted.map((v) => v.totalValue / 100), borderColor: '#4f46e5', tension: 0.3 }
      ]
    },
    options: { responsive: true, plugins: { legend: { position: 'bottom' } } }
  });

  // Composizione: mostrata solo se almeno una rilevazione la contiene
  const hasComposition = sorted.some((v) => v.composition);
  document.getElementById('detail-composition-section').hidden = !hasComposition;

  if (hasComposition) {
    const latestComposition = investmentCalc.getLatestComposition(currentValuations);
    if (latestComposition) {
      const entries = Object.entries(latestComposition);
      chartComposition = new Chart(document.getElementById('detail-chart-composition'), {
        type: 'doughnut',
        data: { labels: entries.map(([k]) => k), datasets: [{ data: entries.map(([, v]) => v), backgroundColor: ['#4f46e5', '#f59e0b', '#16a34a', '#dc2626', '#0ea5e9'] }] },
        options: { responsive: true, plugins: { legend: { position: 'bottom' } } }
      });
    }

    // Componenti nel tempo: prendo l'unione di tutti i nomi componente mai usati
    const allComponentNames = [...new Set(sorted.flatMap((v) => v.composition ? Object.keys(v.composition) : []))];
    const colors = ['#4f46e5', '#f59e0b', '#16a34a', '#dc2626', '#0ea5e9'];
    chartCompositionTime = new Chart(document.getElementById('detail-chart-composition-time'), {
      type: 'line',
      data: {
        labels,
        datasets: allComponentNames.map((name, idx) => ({
          label: name,
          data: sorted.map((v) => (v.composition && v.composition[name] !== undefined ? v.composition[name] : null)),
          borderColor: colors[idx % colors.length],
          spanGaps: true,
          tension: 0.2
        }))
      },
      options: { responsive: true, plugins: { legend: { position: 'bottom' } }, scales: { y: { min: 0, max: 100 } } }
    });
  }

  // MWRR nel tempo: solo se almeno una rilevazione lo riporta
  const mwrrData = sorted.filter((v) => v.mwrr !== null && v.mwrr !== undefined);
  document.getElementById('detail-mwrr-card').hidden = mwrrData.length === 0;
  if (mwrrData.length > 0) {
    chartMwrr = new Chart(document.getElementById('detail-chart-mwrr'), {
      type: 'line',
      data: { labels: mwrrData.map((v) => formatDate(v.date)), datasets: [{ label: 'MWRR %', data: mwrrData.map((v) => v.mwrr), borderColor: '#f59e0b', tension: 0.3 }] },
      options: { responsive: true, plugins: { legend: { display: false } } }
    });
  }

  // Costi cumulativi: solo se almeno una rilevazione li riporta
  const costsData = sorted.filter((v) => v.costs !== null && v.costs !== undefined);
  document.getElementById('detail-costs-card').hidden = costsData.length === 0;
  if (costsData.length > 0) {
    chartCosts = new Chart(document.getElementById('detail-chart-costs'), {
      type: 'line',
      data: { labels: costsData.map((v) => formatDate(v.date)), datasets: [{ label: 'Costi cumulativi', data: costsData.map((v) => v.costs / 100), borderColor: '#dc2626', tension: 0.2 }] },
      options: { responsive: true, plugins: { legend: { display: false } } }
    });
  }
}

// ---------- Form rilevazione ----------

function addCompositionRow(name = '', percentage = '') {
  compositionRowCount++;
  const rowId = `comp-row-${compositionRowCount}`;
  const container = document.getElementById('valuation-composition-rows');
  const row = document.createElement('div');
  row.className = 'inline-fields';
  row.id = rowId;
  row.style.marginBottom = '8px';
  row.innerHTML = `
    <input type="text" placeholder="es. Gestione Separata" class="composition-name" value="${escapeHtml(name)}" style="flex:2" />
    <input type="number" placeholder="%" class="composition-pct" value="${percentage}" step="0.1" min="0" max="100" style="max-width:90px" />
    <button type="button" class="btn-icon" onclick="document.getElementById('${rowId}').remove()">🗑️</button>
  `;
  container.appendChild(row);
}

function readCompositionFromForm() {
  const rows = document.querySelectorAll('#valuation-composition-rows .inline-fields');
  const composition = {};
  let hasAny = false;
  rows.forEach((row) => {
    const name = row.querySelector('.composition-name').value.trim();
    const pct = row.querySelector('.composition-pct').value;
    if (name && pct !== '') {
      composition[name] = parseFloat(pct);
      hasAny = true;
    }
  });
  return hasAny ? composition : null;
}

function openNewValuation() {
  document.getElementById('valuation-modal-title').textContent = 'Nuova rilevazione';
  document.getElementById('valuation-form').reset();
  document.getElementById('valuation-id').value = '';
  document.getElementById('valuation-investment-id').value = currentInvestmentId;
  document.getElementById('valuation-date').value = todayStr();
  document.getElementById('valuation-composition-rows').innerHTML = '';

  // Precompila la composizione con l'ultima rilevazione, se presente:
  // in molti casi (es. la polizza) cambia poco da una rilevazione
  // all'altra, così l'utente deve solo aggiornare i numeri.
  const latestComposition = investmentCalc.getLatestComposition(currentValuations);
  if (latestComposition) {
    Object.entries(latestComposition).forEach(([name, pct]) => addCompositionRow(name, pct));
  }

  openModal('valuation-modal');
}

function openEditValuation(id) {
  const v = currentValuations.find((x) => x.id === id);
  if (!v) return;
  document.getElementById('valuation-modal-title').textContent = 'Modifica rilevazione';
  document.getElementById('valuation-id').value = v.id;
  document.getElementById('valuation-investment-id').value = currentInvestmentId;
  document.getElementById('valuation-date').value = v.date;
  document.getElementById('valuation-total-value').value = (v.totalValue / 100).toFixed(2);
  document.getElementById('valuation-mwrr').value = v.mwrr !== null && v.mwrr !== undefined ? v.mwrr : '';
  document.getElementById('valuation-redemption-value').value = v.redemptionValue ? (v.redemptionValue / 100).toFixed(2) : '';
  document.getElementById('valuation-costs').value = v.costs ? (v.costs / 100).toFixed(2) : '';
  document.getElementById('valuation-source').value = v.dataSource;
  document.getElementById('valuation-notes').value = v.notes || '';

  document.getElementById('valuation-composition-rows').innerHTML = '';
  if (v.composition) Object.entries(v.composition).forEach(([name, pct]) => addCompositionRow(name, pct));

  openModal('valuation-modal');
}

function askDeleteValuation(id) {
  confirmAction('Eliminare questa rilevazione? Non si può annullare.', async () => {
    try {
      await db.investmentValuations.remove(id);
      showToast('Rilevazione eliminata.', 'success');
      await initInvestmentDetailPage();
    } catch (err) {
      showToast(err.message, 'error');
    }
  });
}

// ---------- Form movimento ----------

function setMovementTypeToggle(type) {
  document.getElementById('movement-type').value = type;
  document.getElementById('movement-type-deposit').classList.toggle('active', type === 'deposit');
  document.getElementById('movement-type-withdrawal').classList.toggle('active', type === 'withdrawal');
}

function openNewMovement() {
  document.getElementById('movement-modal-title').textContent = 'Versamento o prelievo';
  document.getElementById('movement-form').reset();
  document.getElementById('movement-id').value = '';
  document.getElementById('movement-investment-id').value = currentInvestmentId;
  document.getElementById('movement-date').value = todayStr();
  setMovementTypeToggle('deposit');
  openModal('movement-modal');
}

function openEditMovement(id) {
  const m = currentMovements.find((x) => x.id === id);
  if (!m) return;
  document.getElementById('movement-modal-title').textContent = 'Modifica movimento';
  document.getElementById('movement-id').value = m.id;
  document.getElementById('movement-investment-id').value = currentInvestmentId;
  document.getElementById('movement-date').value = m.date;
  document.getElementById('movement-amount').value = (m.amount / 100).toFixed(2);
  document.getElementById('movement-notes').value = m.notes || '';
  setMovementTypeToggle(m.type);
  openModal('movement-modal');
}

function askDeleteMovement(id) {
  confirmAction('Eliminare questo movimento?', async () => {
    try {
      await db.investmentMovements.remove(id);
      showToast('Movimento eliminato.', 'success');
      await initInvestmentDetailPage();
    } catch (err) {
      showToast(err.message, 'error');
    }
  });
}

// ---------- Eventi ----------

function bindDetailPageEvents() {
  if (detailPageBound) return;
  detailPageBound = true;

  document.getElementById('btn-back-to-investments').addEventListener('click', () => {
    window.location.hash = 'investments';
  });

  document.getElementById('btn-new-valuation').addEventListener('click', openNewValuation);
  document.getElementById('btn-new-movement').addEventListener('click', openNewMovement);
  document.getElementById('btn-add-composition-row').addEventListener('click', () => addCompositionRow());

  document.getElementById('movement-type-deposit').addEventListener('click', () => setMovementTypeToggle('deposit'));
  document.getElementById('movement-type-withdrawal').addEventListener('click', () => setMovementTypeToggle('withdrawal'));

  document.getElementById('detail-inflation-input').addEventListener('input', () => {
    const pctReturn = investmentCalc.computePercentReturn(currentInvestment, currentMovements, currentValuations);
    updateRealReturnDisplay(pctReturn);
  });

  document.getElementById('btn-fetch-inflation').addEventListener('click', async () => {
    const btn = document.getElementById('btn-fetch-inflation');
    const sourceEl = document.getElementById('detail-inflation-source');
    btn.disabled = true;
    btn.textContent = '⏳ Recupero in corso...';
    try {
      const result = await externalData.computeCumulativeInflationFromEurostat(currentInvestment.date);
      document.getElementById('detail-inflation-input').value = result.cumulativePercent;
      sourceEl.textContent = `Fonte: Eurostat (HICP Italia), dati da ${result.fromPeriod} a ${result.toPeriod}.`;
      const pctReturn = investmentCalc.computePercentReturn(currentInvestment, currentMovements, currentValuations);
      updateRealReturnDisplay(pctReturn);
      showToast('Inflazione recuperata da Eurostat.', 'success');
    } catch (err) {
      sourceEl.textContent = '';
      showToast(err.message, 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = '🔄 Recupera da Eurostat';
    }
  });

  document.getElementById('valuation-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('valuation-id').value;
    const payload = {
      investmentId: document.getElementById('valuation-investment-id').value,
      date: document.getElementById('valuation-date').value,
      totalValue: eurosToCents(document.getElementById('valuation-total-value').value),
      mwrr: document.getElementById('valuation-mwrr').value !== '' ? parseFloat(document.getElementById('valuation-mwrr').value) : null,
      redemptionValue: document.getElementById('valuation-redemption-value').value !== '' ? eurosToCents(document.getElementById('valuation-redemption-value').value) : null,
      costs: document.getElementById('valuation-costs').value !== '' ? eurosToCents(document.getElementById('valuation-costs').value) : null,
      composition: readCompositionFromForm(),
      dataSource: document.getElementById('valuation-source').value,
      notes: document.getElementById('valuation-notes').value
    };
    try {
      if (id) {
        await db.investmentValuations.update(id, payload);
        showToast('Rilevazione aggiornata.', 'success');
      } else {
        await db.investmentValuations.create(payload);
        showToast('Rilevazione salvata.', 'success');
      }
      closeModal('valuation-modal');
      await initInvestmentDetailPage();
    } catch (err) {
      // Il vincolo unique(investment_id, date) del database dà un errore
      // leggibile solo a metà: lo rendiamo comprensibile qui.
      if (err.message.includes('duplicate key') || err.message.includes('unique')) {
        showToast('Esiste già una rilevazione per questa data. Modifica quella esistente invece di crearne una nuova.', 'error');
      } else {
        showToast(err.message, 'error');
      }
    }
  });

  document.getElementById('movement-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('movement-id').value;
    const payload = {
      investmentId: document.getElementById('movement-investment-id').value,
      date: document.getElementById('movement-date').value,
      amount: eurosToCents(document.getElementById('movement-amount').value),
      type: document.getElementById('movement-type').value,
      notes: document.getElementById('movement-notes').value
    };
    try {
      if (id) {
        await db.investmentMovements.update(id, payload);
        showToast('Movimento aggiornato.', 'success');
      } else {
        await db.investmentMovements.create(payload);
        showToast('Movimento salvato.', 'success');
      }
      closeModal('movement-modal');
      await initInvestmentDetailPage();
    } catch (err) {
      showToast(err.message, 'error');
    }
  });
}

window.openInvestmentDetail = openInvestmentDetail;
window.initInvestmentDetailPage = initInvestmentDetailPage;
window.openEditValuation = openEditValuation;
window.askDeleteValuation = askDeleteValuation;
window.openEditMovement = openEditMovement;
window.askDeleteMovement = askDeleteMovement;
