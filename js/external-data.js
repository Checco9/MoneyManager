/**
 * public/js/external-data.js
 *
 * Recupero automatico di dati PUBBLICI da fonti esterne ufficiali.
 * Isolato in un proprio file, separato dai calcoli (investment-calculations.js)
 * e dalla UI (investment-detail.js): se in futuro si aggiungono altre fonti
 * (es. quotazioni, tassi BCE), questo è il punto giusto dove metterle,
 * senza toccare il resto dell'app.
 *
 * Principio guida: se una fonte non risponde o i dati non sono affidabili,
 * la funzione lancia un errore chiaro — non inventa mai un numero.
 *
 * ---------------------------------------------------------------
 * INFLAZIONE (Eurostat HICP)
 * ---------------------------------------------------------------
 * Fonte: API pubblica ufficiale di Eurostat (ec.europa.eu), nessuna
 * chiave richiesta, dati armonizzati (HICP) usati anche per l'inflazione
 * italiana ufficiale. Dataset "prc_hicp_midx" = indice mensile dei
 * prezzi al consumo, base 2015=100, tutte le voci (coicop=CP00).
 *
 * Come si calcola l'inflazione cumulata tra due date: si prende
 * l'indice nel mese di partenza e quello nel mese più recente
 * disponibile, e si calcola la variazione percentuale tra i due —
 * è lo stesso principio con cui ISTAT calcola l'inflazione cumulata
 * ufficiale nei suoi comunicati.
 */

const EUROSTAT_INFLATION_URL = 'https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/prc_hicp_midx';

/**
 * Scarica la serie storica dell'indice HICP italiano dal mese indicato
 * ad oggi. Restituisce un array ordinato {period: 'YYYY-MM', value: number}.
 * Lancia un errore se la richiesta fallisce o i dati non sono utilizzabili.
 */
async function fetchItalyInflationIndexSeries(fromMonth) {
  const params = new URLSearchParams({
    format: 'JSON', lang: 'EN', geo: 'IT', unit: 'I15', coicop: 'CP00',
    sinceTimePeriod: fromMonth
  });
  const url = `${EUROSTAT_INFLATION_URL}?${params.toString()}`;

  let res;
  try {
    res = await fetch(url);
  } catch (networkErr) {
    throw new Error('Impossibile contattare Eurostat (problema di rete o CORS). Inserisci il dato manualmente.');
  }
  if (!res.ok) throw new Error(`Eurostat ha risposto con un errore (${res.status}).`);

  const data = await res.json();
  if (!data || !data.dimension || !data.dimension.time) {
    throw new Error('Risposta di Eurostat in un formato inatteso.');
  }

  // Formato JSON-stat 2.0: le posizioni nel tempo sono in
  // dimension.time.category.index (periodo -> posizione), i valori
  // effettivi sono in value (posizione -> numero), come oggetto sparso
  // (i mesi senza dato pubblicato semplicemente non compaiono).
  const positions = data.dimension.time.category.index;
  const values = data.value || {};

  const series = Object.entries(positions)
    .map(([period, pos]) => ({ period, value: values[String(pos)] }))
    .filter((s) => s.value !== undefined && s.value !== null)
    .sort((a, b) => a.period.localeCompare(b.period));

  if (series.length === 0) throw new Error('Eurostat non ha restituito dati utilizzabili per il periodo richiesto.');
  return series;
}

/**
 * Calcola l'inflazione cumulata (%) tra la data di un investimento e
 * l'ultimo dato disponibile. Restituisce anche il periodo esatto
 * coperto, così l'utente sa sempre da dove viene il numero.
 */
async function computeCumulativeInflationFromEurostat(investmentDateStr) {
  const fromMonth = investmentDateStr.slice(0, 7); // 'YYYY-MM-DD' -> 'YYYY-MM'
  const series = await fetchItalyInflationIndexSeries(fromMonth);

  if (series.length < 2) {
    throw new Error('Non ci sono ancora abbastanza dati Eurostat pubblicati per calcolare una variazione (serve almeno un mese successivo a quello di partenza).');
  }

  const start = series[0];
  const end = series[series.length - 1];
  const cumulativePercent = Math.round(((end.value / start.value) - 1) * 10000) / 100;

  return { cumulativePercent, fromPeriod: start.period, toPeriod: end.period };
}

window.externalData = { computeCumulativeInflationFromEurostat };
