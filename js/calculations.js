/**
 * public/js/calculations.js
 *
 * Stessa logica di calcolo che prima viveva in services/calculations.js
 * sul server Express, ora eseguita nel browser sui dati letti da Supabase.
 * Per un uso personale (poche migliaia di righe) è più che sufficiente:
 * scarica tutte le transazioni/giroconti una volta e calcola in memoria.
 */

function monthBounds(monthStr) {
  const [y, m] = monthStr.split('-').map(Number);
  const start = `${monthStr}-01`;
  const lastDay = new Date(y, m, 0).getDate();
  const end = `${monthStr}-${String(lastDay).padStart(2, '0')}`;
  return { start, end };
}

function computeAccountBalance(account, transactionsList, transfersList, upToDate = null) {
  let balance = account.initialBalance;
  for (const t of transactionsList) {
    if (t.accountId !== account.id) continue;
    if (upToDate && t.date > upToDate) continue;
    balance += t.type === 'income' ? t.amount : -t.amount;
  }
  for (const tr of transfersList) {
    if (upToDate && tr.date > upToDate) continue;
    if (tr.fromAccountId === account.id) balance -= tr.amount;
    if (tr.toAccountId === account.id) balance += tr.amount;
  }
  return balance;
}

async function computeAllAccountsWithBalance(upToDate = null) {
  const [accountsList, transactionsList, transfersList] = await Promise.all([
    db.accounts.list(), db.transactions.list(), db.transfers.list()
  ]);
  return accountsList.map((a) => ({
    ...a,
    currentBalance: computeAccountBalance(a, transactionsList, transfersList, upToDate)
  }));
}

// LIMITE NOTO: gli investimenti non hanno uno storico di valore nel tempo
// (v1 non implementa quotazioni), quindi il loro valore attuale viene
// sempre sommato al totale corrente, anche calcolando il patrimonio a
// una data passata (upToDate). Il grafico storico è quindi preciso per
// la liquidità, non per gli investimenti.
async function computeWealthBreakdown(upToDate = null) {
  const accounts = await computeAllAccountsWithBalance(upToDate);
  const investmentAccounts = accounts.filter((a) => a.type === 'investimenti');
  const liquidAccounts = accounts.filter((a) => a.type !== 'investimenti');

  const liquidity = liquidAccounts.reduce((s, a) => s + a.currentBalance, 0);
  const investmentAccountsTotal = investmentAccounts.reduce((s, a) => s + a.currentBalance, 0);

  const investmentsList = await db.investments.list();
  const investmentsTotal = investmentsList.reduce((s, i) => s + i.currentValue, 0);

  const investments = investmentAccountsTotal + investmentsTotal;
  return { total: liquidity + investments, liquidity, investments, accounts };
}

async function computeMonthSummary(monthStr) {
  const { start, end } = monthBounds(monthStr);
  const list = await db.transactions.list({ from: start, to: end });
  const income = list.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const expense = list.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  return { month: monthStr, income, expense, savings: income - expense };
}

async function computeCategoryTotals(monthStr, type = 'expense') {
  const { start, end } = monthBounds(monthStr);
  const [list, categoriesList] = await Promise.all([
    db.transactions.list({ from: start, to: end, type }),
    db.categories.list()
  ]);
  const totals = {};
  for (const t of list) totals[t.categoryId] = (totals[t.categoryId] || 0) + t.amount;

  return Object.entries(totals)
    .map(([categoryId, amount]) => {
      const cat = categoriesList.find((c) => c.id === categoryId);
      return { categoryId, categoryName: cat ? cat.name : 'Sconosciuta', icon: cat ? cat.icon : '❓', amount };
    })
    .sort((a, b) => b.amount - a.amount);
}

async function computeMonthlyTrend(monthsBack = 12) {
  const now = new Date();
  const months = [];
  for (let i = monthsBack - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  return Promise.all(months.map((m) => computeMonthSummary(m)));
}

async function computeWealthOverTime(monthsBack = 12) {
  const now = new Date();
  const months = [];
  for (let i = monthsBack - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    const monthLabel = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    months.push({ month: monthLabel, endOfMonth: `${monthLabel}-${String(lastDay).padStart(2, '0')}` });
  }
  return Promise.all(months.map(async ({ month, endOfMonth }) => {
    const b = await computeWealthBreakdown(endOfMonth);
    return { month, liquidity: b.liquidity, investments: b.investments, total: b.total };
  }));
}

async function computeBudgetStatus(monthStr) {
  const { start, end } = monthBounds(monthStr);
  const [budgetsList, categoriesList, expenseTx] = await Promise.all([
    db.budgets.listByMonth(monthStr),
    db.categories.list(),
    db.transactions.list({ from: start, to: end, type: 'expense' })
  ]);

  return budgetsList.map((b) => {
    const spent = expenseTx.filter((t) => t.categoryId === b.categoryId).reduce((s, t) => s + t.amount, 0);
    const cat = categoriesList.find((c) => c.id === b.categoryId);
    return {
      ...b,
      categoryName: cat ? cat.name : 'Sconosciuta',
      categoryIcon: cat ? cat.icon : '❓',
      spent,
      remaining: b.amount - spent,
      percentage: b.amount > 0 ? Math.round((spent / b.amount) * 100) : 0,
      overBudget: spent > b.amount
    };
  });
}

window.calc = {
  monthBounds, computeAccountBalance, computeAllAccountsWithBalance, computeWealthBreakdown,
  computeMonthSummary, computeCategoryTotals, computeMonthlyTrend, computeWealthOverTime, computeBudgetStatus
};
