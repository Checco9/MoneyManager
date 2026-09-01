/**
 * public/js/recurring-engine.js
 *
 * Stessa logica idempotente che prima girava sul server all'avvio
 * (services/recurringEngine.js): qui viene eseguita nel browser ogni
 * volta che l'app si apre. Idempotente = non crea mai duplicati anche
 * se la richiami più volte, perché ogni pattern avanza il proprio
 * "nextDueDate" solo dopo aver generato davvero la transazione.
 */

/**
 * Calcola la data della prossima occorrenza.
 *
 * FIX IMPORTANTE: le date sono trattate SEMPRE in UTC (Date.UTC e i
 * metodi getUTCDate/setUTCDate ecc.), mai in ora locale. Motivo: se si costruisce un Date
 * con "new Date(dateStr + 'T00:00:00')" (ora locale) e poi lo si
 * riconverte in stringa con toISOString() (che restituisce sempre UTC),
 * ogni singolo passaggio perde/guadagna delle ore in base al fuso orario
 * del browser — per l'Italia, tipicamente un'ora indietro. Ripetendo
 * questo calcolo settimana dopo settimana, l'errore si accumula e la
 * data "scivola" sempre più indietro rispetto al giorno della settimana
 * originale (es. il sabato diventa venerdì, poi giovedì...). Lavorando
 * sempre in UTC, senza mai passare per l'ora locale, il calcolo resta
 * esatto all'infinito.
 *
 * everyN = "ogni quante unità" (es. everyN=2, frequency='weekly' → ogni
 * 2 settimane). Default 1 se non specificato.
 */
function addInterval(dateStr, frequency, everyN = 1) {
  const n = Math.max(1, parseInt(everyN, 10) || 1);
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));

  if (frequency === 'daily') date.setUTCDate(date.getUTCDate() + n);
  if (frequency === 'weekly') date.setUTCDate(date.getUTCDate() + 7 * n);
  if (frequency === 'monthly') date.setUTCMonth(date.getUTCMonth() + n);
  if (frequency === 'yearly') date.setUTCFullYear(date.getUTCFullYear() + n);

  return date.toISOString().slice(0, 10);
}

async function previewDue() {
  const today = todayStr();
  const list = await db.recurring.list();
  const due = [];

  for (const r of list) {
    if (!r.active) continue;
    let cursor = r.nextDueDate;
    let guard = 0;
    while (cursor <= today && guard < 500) {
      if (r.endDate && cursor > r.endDate) break;
      due.push({
        recurringId: r.id, description: r.description, amount: r.amount,
        type: r.type, date: cursor, accountId: r.accountId, categoryId: r.categoryId
      });
      cursor = addInterval(cursor, r.frequency, r.everyN);
      guard++;
    }
  }
  due.sort((a, b) => a.date.localeCompare(b.date));
  return due;
}

async function generateDueTransactions() {
  const today = todayStr();
  const list = await db.recurring.list();
  let createdCount = 0;

  for (const r of list) {
    if (!r.active) continue;
    let cursor = r.nextDueDate;
    let guard = 0;

    while (cursor <= today && guard < 500) {
      if (r.endDate && cursor > r.endDate) break;

      await db.transactions.create({
        date: cursor, time: null, type: r.type, amount: r.amount,
        accountId: r.accountId, categoryId: r.categoryId, subcategory: '',
        description: r.description, notes: 'Generata automaticamente da movimento ricorrente',
        tags: ['ricorrente']
      });
      createdCount++;
      cursor = addInterval(cursor, r.frequency, r.everyN);
      guard++;
    }

    if (cursor !== r.nextDueDate) {
      await db.recurring.update(r.id, { nextDueDate: cursor, lastGeneratedDate: today });
    }
  }
  return createdCount;
}

async function computeUpcoming(days = 30) {
  const limit = new Date();
  limit.setDate(limit.getDate() + days);
  const limitStr = limit.toISOString().slice(0, 10);

  const list = await db.recurring.list();
  const upcoming = [];

  for (const r of list) {
    if (!r.active) continue;
    let cursor = r.nextDueDate;
    let guard = 0;
    while (cursor <= limitStr && guard < 500) {
      if (r.endDate && cursor > r.endDate) break;
      upcoming.push({
        recurringId: r.id, description: r.description, amount: r.amount,
        type: r.type, accountId: r.accountId, categoryId: r.categoryId, date: cursor
      });
      cursor = addInterval(cursor, r.frequency, r.everyN);
      guard++;
    }
  }
  upcoming.sort((a, b) => a.date.localeCompare(b.date));
  return upcoming;
}

window.recurringEngine = { generateDueTransactions, previewDue, computeUpcoming, addInterval };
