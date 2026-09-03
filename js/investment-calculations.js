/**
 * public/js/investment-calculations.js
 *
 * Tutta la logica di analisi degli investimenti: separata dal layer dati
 * (db.js) e dalla UI (investment-detail.js), come da convenzione del
 * resto del progetto (vedi calculations.js per conti/transazioni).
 *
 * Principio guida, esplicitamente richiesto: MAI presentare un'ipotesi
 * come un fatto. Se i dati non bastano per calcolare qualcosa, le
 * funzioni qui restituiscono null — è compito della UI mostrare
 * "dato non disponibile" invece di un numero inventato.
 */

// ---------- Utility di base ----------

function daysBetweenDates(d1, d2) {
  const a = new Date(d1 + 'T00:00:00Z');
  const b = new Date(d2 + 'T00:00:00Z');
  return (b - a) / (1000 * 60 * 60 * 24);
}

/**
 * Capitale versato = capitale iniziale registrato sull'investimento
 * + somma di tutti i versamenti - somma di tutti i prelievi.
 * Questo NON è il valore attuale: è quanto denaro reale hai messo
 * (o tolto) di tasca tua, indipendentemente da come si è mosso il mercato.
 */
function computeCapitalPaidIn(investment, movements) {
  let total = investment.capital;
  for (const m of movements) {
    total += m.type === 'deposit' ? m.amount : -m.amount;
  }
  return total;
}

/**
 * Valore attuale = ultima rilevazione disponibile, se esiste.
 * Se non ci sono rilevazioni, ripiega sul campo "current_value" statico
 * dell'investimento (retrocompatibilità con investimenti semplici creati
 * prima di questa funzionalità, es. un ETF inserito a mano senza storico).
 */
function getCurrentValue(investment, valuations) {
  if (valuations.length === 0) return investment.currentValue;
  return valuations[valuations.length - 1].totalValue;
}

function getLatestValuation(valuations) {
  return valuations.length > 0 ? valuations[valuations.length - 1] : null;
}

// ---------- Rendimenti ----------

function computeAbsoluteReturn(investment, movements, valuations) {
  const paidIn = computeCapitalPaidIn(investment, movements);
  const current = getCurrentValue(investment, valuations);
  return current - paidIn;
}

function computePercentReturn(investment, movements, valuations) {
  const paidIn = computeCapitalPaidIn(investment, movements);
  if (paidIn <= 0) return null;
  const absolute = computeAbsoluteReturn(investment, movements, valuations);
  return Math.round((absolute / paidIn) * 1000) / 10;
}

/**
 * Variazione rispetto alla rilevazione precedente (non rispetto al
 * capitale versato). Utile per capire "cosa è successo dall'ultima volta
 * che ho controllato", a prescindere dal rendimento complessivo.
 */
function computeChangeSinceLastValuation(valuations) {
  if (valuations.length < 2) return null;
  const last = valuations[valuations.length - 1];
  const prev = valuations[valuations.length - 2];
  const absoluteChange = last.totalValue - prev.totalValue;
  const percentChange = prev.totalValue > 0 ? Math.round((absoluteChange / prev.totalValue) * 1000) / 10 : null;
  return { absoluteChange, percentChange, fromDate: prev.date, toDate: last.date };
}

/**
 * Rendimento annualizzato (XIRR): l'unico modo corretto di annualizzare
 * un rendimento quando ci sono versamenti in momenti diversi, perché
 * pesa ogni flusso di cassa in base a QUANDO è avvenuto, non solo a
 * quanto vale oggi. Restituisce null se i dati non permettono un calcolo
 * affidabile (es. un solo flusso, o nessuna convergenza numerica).
 */
function computeAnnualizedReturn(investment, movements, valuations) {
  if (valuations.length === 0) return null;

  const cashflows = [{ date: investment.date, amount: -investment.capital }];
  for (const m of movements) {
    cashflows.push({ date: m.date, amount: m.type === 'deposit' ? -m.amount : m.amount });
  }
  const latest = getLatestValuation(valuations);
  cashflows.push({ date: latest.date, amount: latest.totalValue });

  cashflows.sort((a, b) => a.date.localeCompare(b.date));
  return xirr(cashflows);
}

function xnpv(rate, cashflows) {
  const t0 = cashflows[0].date;
  return cashflows.reduce((sum, cf) => {
    const days = daysBetweenDates(t0, cf.date);
    return sum + cf.amount / Math.pow(1 + rate, days / 365);
  }, 0);
}

function xirr(cashflows) {
  const hasNeg = cashflows.some((c) => c.amount < 0);
  const hasPos = cashflows.some((c) => c.amount > 0);
  if (!hasNeg || !hasPos) return null;

  let rate = 0.1;
  for (let i = 0; i < 100; i++) {
    const f = xnpv(rate, cashflows);
    const h = 1e-6;
    const fPrime = (xnpv(rate + h, cashflows) - f) / h;
    if (Math.abs(fPrime) < 1e-12) break;
    const newRate = rate - f / fPrime;
    if (!isFinite(newRate) || newRate <= -0.999999) break;
    if (Math.abs(newRate - rate) < 1e-8) return newRate;
    rate = newRate;
  }

  // Fallback più lento ma più robusto se Newton-Raphson non converge
  let lo = -0.9999, hi = 10;
  let fLo = xnpv(lo, cashflows), fHi = xnpv(hi, cashflows);
  if (fLo * fHi > 0) return null;
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    const fMid = xnpv(mid, cashflows);
    if (Math.abs(fMid) < 1e-6) return mid;
    if ((fLo < 0) === (fMid < 0)) { lo = mid; fLo = fMid; } else { hi = mid; }
  }
  return (lo + hi) / 2;
}

/**
 * Rendimento reale = rendimento al netto dell'inflazione. Richiede che
 * l'utente fornisca un tasso di inflazione cumulata (dato pubblico,
 * reperibile da ISTAT) — non lo stimiamo né lo inventiamo mai.
 */
function computeRealReturn(nominalPercentReturn, cumulativeInflationPercent) {
  if (nominalPercentReturn === null || cumulativeInflationPercent === null || cumulativeInflationPercent === undefined) {
    return null;
  }
  // Formula di Fisher: (1+nominale)/(1+inflazione) - 1, più corretta di una semplice sottrazione
  const nominal = nominalPercentReturn / 100;
  const inflation = cumulativeInflationPercent / 100;
  const real = (1 + nominal) / (1 + inflation) - 1;
  return Math.round(real * 1000) / 10;
}

// ---------- Costi cumulativi ----------

function computeCumulativeCosts(valuations) {
  const withCosts = valuations.filter((v) => v.costs !== null && v.costs !== undefined);
  if (withCosts.length === 0) return null;
  return withCosts[withCosts.length - 1].costs;
}

// ---------- Composizione (es. Gestione Separata / Fondo Interno) ----------

function getLatestComposition(valuations) {
  const latest = getLatestValuation(valuations);
  return latest && latest.composition ? latest.composition : null;
}

// ---------- Analisi testuale onesta ----------

/**
 * Genera frasi in linguaggio semplice a partire dai dati DISPONIBILI.
 * Ogni frase è condizionata all'esistenza dei dati necessari: se mancano,
 * la funzione lo dice esplicitamente invece di ipotizzare una causa.
 */
function generateInsights(investment, movements, valuations) {
  const insights = [];

  if (valuations.length === 0) {
    insights.push('Non ci sono ancora rilevazioni per questo investimento. Aggiungi la prima rilevazione per iniziare a vedere le analisi.');
    return insights;
  }

  const paidIn = computeCapitalPaidIn(investment, movements);
  const current = getCurrentValue(investment, valuations);
  const absReturn = computeAbsoluteReturn(investment, movements, valuations);
  const pctReturn = computePercentReturn(investment, movements, valuations);

  insights.push(
    `Hai versato ${formatMoney(paidIn)} e l'investimento vale oggi ${formatMoney(current)}: ` +
    `${absReturn >= 0 ? 'un guadagno' : 'una perdita'} di ${formatMoney(Math.abs(absReturn))}` +
    (pctReturn !== null ? ` (${pctReturn >= 0 ? '+' : ''}${pctReturn}%).` : '.')
  );

  const change = computeChangeSinceLastValuation(valuations);
  if (change) {
    insights.push(
      `Dall'ultima rilevazione (${formatDate(change.fromDate)}) il valore è ${change.absoluteChange >= 0 ? 'aumentato' : 'diminuito'} ` +
      `di ${formatMoney(Math.abs(change.absoluteChange))}` +
      (change.percentChange !== null ? `, pari al ${change.percentChange >= 0 ? '+' : ''}${change.percentChange}%.` : '.')
    );
  } else {
    insights.push('C\'è solo una rilevazione finora: servono almeno due rilevazioni per calcolare una variazione nel tempo.');
  }

  const annualized = computeAnnualizedReturn(investment, movements, valuations);
  if (annualized !== null) {
    const daysSinceStart = daysBetweenDates(investment.date, getLatestValuation(valuations).date);
    if (daysSinceStart < 180) {
      insights.push(
        `Il rendimento annualizzato stimato è ${(annualized * 100).toFixed(1)}%, ma essendo passati meno di 6 mesi dall'inizio ` +
        `questo dato è poco affidabile: può variare molto con il tempo. Prendilo con cautela.`
      );
    } else {
      insights.push(`Il rendimento annualizzato (XIRR), che tiene conto di quando sono avvenuti i versamenti, è circa ${(annualized * 100).toFixed(1)}%.`);
    }
  } else {
    insights.push('Non ci sono abbastanza dati per calcolare un rendimento annualizzato affidabile.');
  }

  const costs = computeCumulativeCosts(valuations);
  if (costs !== null) {
    insights.push(`Risultano costi noti per ${formatMoney(costs)} da quando è iniziato il tracciamento.`);
  }

  // Nota onesta sui costi iniziali quando il rendimento è negativo ma
  // recente: è un pattern comune nelle polizze assicurative (caricamenti
  // iniziali), ma lo segnaliamo solo come possibilità, non come certezza.
  if (pctReturn !== null && pctReturn < 0 && valuations.length <= 2) {
    insights.push(
      'Il rendimento è negativo, ma con così poche rilevazioni non è possibile determinare con certezza la causa ' +
      '(es. costi iniziali, andamento di mercato, o entrambi). Servono ulteriori rilevazioni nel tempo per un quadro più chiaro.'
    );
  }

  return insights;
}

/**
 * Valore "effettivo" di un investimento per i calcoli di patrimonio:
 * usa l'ultima rilevazione disponibile (eventualmente filtrata per data,
 * utile per ricostruire il patrimonio storico) se esiste, altrimenti
 * ripiega sul campo statico "current_value" — retrocompatibilità con
 * investimenti semplici (es. un ETF) che non hanno ancora uno storico.
 */
async function getEffectiveValue(investmentId, staticCurrentValue, upToDate = null) {
  const valuations = await db.investmentValuations.listForInvestment(investmentId);
  const filtered = upToDate ? valuations.filter((v) => v.date <= upToDate) : valuations;
  if (filtered.length === 0) return staticCurrentValue;
  return filtered[filtered.length - 1].totalValue;
}

window.investmentCalc = {
  computeCapitalPaidIn, getCurrentValue, getLatestValuation,
  computeAbsoluteReturn, computePercentReturn, computeChangeSinceLastValuation,
  computeAnnualizedReturn, computeRealReturn, computeCumulativeCosts,
  getLatestComposition, generateInsights, xirr, getEffectiveValue
};
