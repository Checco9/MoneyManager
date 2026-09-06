/**
 * public/js/pac-engine.js
 *
 * Genera i versamenti PAC dovuti. Riusa DELIBERATAMENTE
 * recurringEngine.addInterval() invece di duplicare la matematica delle
 * date (stesso motivo per cui esiste già corretta e testata lì).
 *
 * Ogni versamento PAC dovuto genera DUE righe collegate:
 *  1) una transazione di tipo 'investment' sul conto di origine — riduce
 *     il saldo di quel conto ma NON è una spesa: le statistiche
 *     entrate/uscite del mese filtrano esplicitamente su income/expense,
 *     quindi la escludono automaticamente, senza bisogno di codice apposta.
 *  2) un movimento di tipo 'deposit' sull'investimento di destinazione
 *     (con pac_id valorizzato, per lo storico versamenti del PAC).
 *
 * IMPORTANTE — il "trucco" per la neutralità patrimoniale immediata:
 * se l'investimento di destinazione NON ha ancora uno storico di
 * rilevazioni, aggiorniamo anche i suoi campi statici capital/current_value
 * dello stesso importo, così il patrimonio totale resta invariato
 * nell'istante stesso del versamento (il denaro si sposta, non sparisce
 * né si moltiplica). Se l'investimento HA GIÀ uno storico di rilevazioni,
 * lasciamo che sia l'utente a registrare la prossima rilevazione: sarebbe
 * disonesto far finta che il valore sia salito esattamente di quella
 * cifra quando in realtà dipende dal prezzo di mercato del giorno.
 */

async function generateDuePacs() {
  const today = todayStr();
  const list = await db.pacs.list();
  let createdCount = 0;

  for (const pac of list) {
    if (!pac.active) continue;
    if (pac.nextDueDate > today) continue;

    // Serve sapere UNA VOLTA sola, prima del ciclo, se l'investimento ha
    // già uno storico: non deve cambiare a metà elaborazione.
    const valuations = await db.investmentValuations.listForInvestment(pac.investmentId);
    const hasHistory = valuations.length > 0;
    const investment = hasHistory ? null : await db.investments.get(pac.investmentId);
    let accumulatedAmount = 0;

    let cursor = pac.nextDueDate;
    let guard = 0;

    while (cursor <= today && guard < 500) {
      if (pac.endDate && cursor > pac.endDate) break;

      await db.transactions.create({
        date: cursor, type: 'investment', amount: pac.amount,
        accountId: pac.accountId, categoryId: null, subcategory: '',
        description: `Versamento PAC: ${pac.name}`,
        notes: 'Generato automaticamente da un PAC', tags: ['pac']
      });

      await db.investmentMovements.create({
        investmentId: pac.investmentId, date: cursor, amount: pac.amount,
        type: 'deposit', notes: 'Versamento PAC automatico', pacId: pac.id
      });

      accumulatedAmount += pac.amount;
      createdCount++;
      cursor = recurringEngine.addInterval(cursor, pac.frequency, pac.everyN);
      guard++;
    }

    if (accumulatedAmount > 0 && !hasHistory && investment) {
      await db.investments.update(pac.investmentId, {
        capital: investment.capital + accumulatedAmount,
        currentValue: investment.currentValue + accumulatedAmount
      });
    }

    if (cursor !== pac.nextDueDate) {
      await db.pacs.update(pac.id, { nextDueDate: cursor, lastGeneratedDate: today });
    }
  }
  return createdCount;
}

async function previewDuePacs() {
  const today = todayStr();
  const list = await db.pacs.list();
  const due = [];

  for (const pac of list) {
    if (!pac.active) continue;
    let cursor = pac.nextDueDate;
    let guard = 0;
    while (cursor <= today && guard < 500) {
      if (pac.endDate && cursor > pac.endDate) break;
      due.push({ pacId: pac.id, name: pac.name, amount: pac.amount, date: cursor });
      cursor = recurringEngine.addInterval(cursor, pac.frequency, pac.everyN);
      guard++;
    }
  }
  due.sort((a, b) => a.date.localeCompare(b.date));
  return due;
}

window.pacEngine = { generateDuePacs, previewDuePacs };
