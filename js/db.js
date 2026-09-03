/**
 * public/js/db.js
 *
 * Sostituisce il vecchio apiRequest() verso Express: ora ogni funzione
 * qui dentro parla direttamente con Supabase. I nomi delle funzioni e la
 * "forma" degli oggetti restituiti (camelCase, importi in centesimi)
 * restano il più simile possibile a prima, così le pagine (accounts.js,
 * transactions.js, ...) cambiano il meno possibile.
 *
 * Ogni funzione lancia un Error con un messaggio leggibile in caso di
 * problema, esattamente come faceva apiRequest.
 */

function dbCheck(result) {
  if (result.error) throw new Error(result.error.message || 'Errore nella richiesta al database.');
  return result.data;
}

// ---------- mapping snake_case (Postgres) <-> camelCase (frontend) ----------

function accountFromRow(r) {
  return {
    id: r.id, name: r.name, type: r.type, initialBalance: r.initial_balance,
    openingDate: r.opening_date, color: r.color, icon: r.icon, notes: r.notes,
    active: r.active, createdAt: r.created_at
  };
}
function accountToRow(a) {
  const row = {};
  if (a.name !== undefined) row.name = a.name;
  if (a.type !== undefined) row.type = a.type;
  if (a.initialBalance !== undefined) row.initial_balance = a.initialBalance;
  if (a.openingDate !== undefined) row.opening_date = a.openingDate || null;
  if (a.color !== undefined) row.color = a.color;
  if (a.icon !== undefined) row.icon = a.icon;
  if (a.notes !== undefined) row.notes = a.notes;
  if (a.active !== undefined) row.active = a.active;
  return row;
}

function txFromRow(r) {
  return {
    id: r.id, date: r.date, time: r.time, type: r.type, amount: r.amount,
    accountId: r.account_id, categoryId: r.category_id, subcategory: r.subcategory,
    description: r.description, notes: r.notes, tags: r.tags || [], createdAt: r.created_at
  };
}
function txToRow(t) {
  const row = {};
  if (t.date !== undefined) row.date = t.date;
  if (t.time !== undefined) row.time = t.time || null;
  if (t.type !== undefined) row.type = t.type;
  if (t.amount !== undefined) row.amount = t.amount;
  if (t.accountId !== undefined) row.account_id = t.accountId;
  if (t.categoryId !== undefined) row.category_id = t.categoryId || null;
  if (t.subcategory !== undefined) row.subcategory = t.subcategory;
  if (t.description !== undefined) row.description = t.description;
  if (t.notes !== undefined) row.notes = t.notes;
  if (t.tags !== undefined) row.tags = t.tags;
  return row;
}

function transferFromRow(r) {
  return {
    id: r.id, date: r.date, fromAccountId: r.from_account_id, toAccountId: r.to_account_id,
    amount: r.amount, description: r.description, createdAt: r.created_at
  };
}
function transferToRow(t) {
  const row = {};
  if (t.date !== undefined) row.date = t.date;
  if (t.fromAccountId !== undefined) row.from_account_id = t.fromAccountId;
  if (t.toAccountId !== undefined) row.to_account_id = t.toAccountId;
  if (t.amount !== undefined) row.amount = t.amount;
  if (t.description !== undefined) row.description = t.description;
  return row;
}

function categoryFromRow(r) {
  return { id: r.id, name: r.name, type: r.type, icon: r.icon, isDefault: r.is_default };
}
function categoryToRow(c) {
  const row = {};
  if (c.name !== undefined) row.name = c.name;
  if (c.type !== undefined) row.type = c.type;
  if (c.icon !== undefined) row.icon = c.icon;
  return row;
}

function budgetFromRow(r) {
  return { id: r.id, categoryId: r.category_id, month: r.month, amount: r.amount };
}

function goalFromRow(r, movements = []) {
  return {
    id: r.id, name: r.name, targetAmount: r.target_amount, currentAmount: r.current_amount,
    targetDate: r.target_date, description: r.description, icon: r.icon,
    linkedAccountId: r.linked_account_id, createdAt: r.created_at, movements
  };
}

function recurringFromRow(r) {
  return {
    id: r.id, type: r.type, amount: r.amount, accountId: r.account_id, categoryId: r.category_id,
    description: r.description, frequency: r.frequency, everyN: r.every_n || 1,
    startDate: r.start_date, endDate: r.end_date,
    active: r.active, nextDueDate: r.next_due_date, lastGeneratedDate: r.last_generated_date
  };
}
function recurringToRow(r) {
  const row = {};
  if (r.type !== undefined) row.type = r.type;
  if (r.amount !== undefined) row.amount = r.amount;
  if (r.accountId !== undefined) row.account_id = r.accountId;
  if (r.categoryId !== undefined) row.category_id = r.categoryId || null;
  if (r.description !== undefined) row.description = r.description;
  if (r.frequency !== undefined) row.frequency = r.frequency;
  if (r.everyN !== undefined) row.every_n = r.everyN;
  if (r.startDate !== undefined) row.start_date = r.startDate;
  if (r.endDate !== undefined) row.end_date = r.endDate || null;
  if (r.active !== undefined) row.active = r.active;
  if (r.nextDueDate !== undefined) row.next_due_date = r.nextDueDate;
  if (r.lastGeneratedDate !== undefined) row.last_generated_date = r.lastGeneratedDate;
  return row;
}

function investmentFromRow(r) {
  return {
    id: r.id, name: r.name, type: r.type, capital: r.capital, currentValue: r.current_value,
    date: r.date, notes: r.notes
  };
}
function investmentToRow(i) {
  const row = {};
  if (i.name !== undefined) row.name = i.name;
  if (i.type !== undefined) row.type = i.type;
  if (i.capital !== undefined) row.capital = i.capital;
  if (i.currentValue !== undefined) row.current_value = i.currentValue;
  if (i.date !== undefined) row.date = i.date || null;
  if (i.notes !== undefined) row.notes = i.notes;
  return row;
}

// ================= AUTH =================

const auth = {
  async signIn(email, password) {
    const res = await supabaseClient.auth.signInWithPassword({ email, password });
    if (res.error) throw new Error('Credenziali non valide.');
    return res.data;
  },
  async signOut() {
    await supabaseClient.auth.signOut();
  },
  async getSession() {
    const { data } = await supabaseClient.auth.getSession();
    return data.session;
  },
  onChange(cb) {
    supabaseClient.auth.onAuthStateChange((_event, session) => cb(session));
  }
};

// ================= ACCOUNTS =================

const accounts = {
  async list() {
    const res = await supabaseClient.from('accounts').select('*').order('created_at');
    return dbCheck(res).map(accountFromRow);
  },
  async create(payload) {
    const res = await supabaseClient.from('accounts').insert(accountToRow(payload)).select().single();
    return accountFromRow(dbCheck(res));
  },
  async update(id, payload) {
    const res = await supabaseClient.from('accounts').update(accountToRow(payload)).eq('id', id).select().single();
    return accountFromRow(dbCheck(res));
  },
  async remove(id) {
    // Blocco lato applicazione (in aggiunta alla FK "restrict" nel DB):
    // se ci sono transazioni o giroconti collegati, avvisiamo con un
    // messaggio chiaro invece di far comparire l'errore grezzo di Postgres.
    const [tx, tr] = await Promise.all([
      supabaseClient.from('transactions').select('id', { count: 'exact', head: true }).eq('account_id', id),
      supabaseClient.from('transfers').select('id', { count: 'exact', head: true })
        .or(`from_account_id.eq.${id},to_account_id.eq.${id}`)
    ]);
    if ((tx.count || 0) > 0 || (tr.count || 0) > 0) {
      throw new Error('Impossibile eliminare: esistono transazioni o giroconti collegati a questo conto. Disattivalo invece di eliminarlo.');
    }
    dbCheck(await supabaseClient.from('accounts').delete().eq('id', id));
  }
};

// ================= TRANSACTIONS =================

const transactions = {
  async list(filters = {}) {
    let q = supabaseClient.from('transactions').select('*');
    if (filters.from) q = q.gte('date', filters.from);
    if (filters.to) q = q.lte('date', filters.to);
    if (filters.accountId) q = q.eq('account_id', filters.accountId);
    if (filters.categoryId) q = q.eq('category_id', filters.categoryId);
    if (filters.type) q = q.eq('type', filters.type);
    if (filters.minAmount) q = q.gte('amount', filters.minAmount);
    if (filters.maxAmount) q = q.lte('amount', filters.maxAmount);
    if (filters.tag) q = q.contains('tags', [filters.tag]);
    if (filters.search) q = q.or(`description.ilike.%${filters.search}%,notes.ilike.%${filters.search}%`);

    const sort = filters.sort || 'date_desc';
    if (sort === 'date_desc') q = q.order('date', { ascending: false }).order('time', { ascending: false });
    if (sort === 'date_asc') q = q.order('date', { ascending: true }).order('time', { ascending: true });
    if (sort === 'amount_desc') q = q.order('amount', { ascending: false });
    if (sort === 'amount_asc') q = q.order('amount', { ascending: true });

    return dbCheck(await q).map(txFromRow);
  },
  async get(id) {
    const res = await supabaseClient.from('transactions').select('*').eq('id', id).single();
    return txFromRow(dbCheck(res));
  },
  async create(payload) {
    const res = await supabaseClient.from('transactions').insert(txToRow(payload)).select().single();
    return txFromRow(dbCheck(res));
  },
  async update(id, payload) {
    const res = await supabaseClient.from('transactions').update(txToRow(payload)).eq('id', id).select().single();
    return txFromRow(dbCheck(res));
  },
  async remove(id) {
    dbCheck(await supabaseClient.from('transactions').delete().eq('id', id));
  },
  async duplicate(id) {
    const original = await transactions.get(id);
    const copy = { ...original, date: todayStr() };
    delete copy.id; delete copy.createdAt;
    return transactions.create(copy);
  }
};

// ================= TRANSFERS =================

const transfers = {
  async list() {
    const res = await supabaseClient.from('transfers').select('*').order('date', { ascending: false });
    return dbCheck(res).map(transferFromRow);
  },
  async get(id) {
    const res = await supabaseClient.from('transfers').select('*').eq('id', id).single();
    return transferFromRow(dbCheck(res));
  },
  async create(payload) {
    if (payload.fromAccountId === payload.toAccountId) {
      throw new Error('Il conto di origine e destinazione non possono coincidere.');
    }
    const res = await supabaseClient.from('transfers').insert(transferToRow(payload)).select().single();
    return transferFromRow(dbCheck(res));
  },
  async update(id, payload) {
    if (payload.fromAccountId && payload.toAccountId && payload.fromAccountId === payload.toAccountId) {
      throw new Error('Il conto di origine e destinazione non possono coincidere.');
    }
    const res = await supabaseClient.from('transfers').update(transferToRow(payload)).eq('id', id).select().single();
    return transferFromRow(dbCheck(res));
  },
  async remove(id) {
    dbCheck(await supabaseClient.from('transfers').delete().eq('id', id));
  }
};

// ================= CATEGORIES =================

const categories = {
  async list(type = null) {
    let q = supabaseClient.from('categories').select('*').order('name');
    if (type) q = q.eq('type', type);
    return dbCheck(await q).map(categoryFromRow);
  },
  async create(payload) {
    const res = await supabaseClient.from('categories').insert(categoryToRow(payload)).select().single();
    return categoryFromRow(dbCheck(res));
  },
  async update(id, payload) {
    const res = await supabaseClient.from('categories').update(categoryToRow(payload)).eq('id', id).select().single();
    return categoryFromRow(dbCheck(res));
  },
  async remove(id) {
    const [tx, bud] = await Promise.all([
      supabaseClient.from('transactions').select('id', { count: 'exact', head: true }).eq('category_id', id),
      supabaseClient.from('budgets').select('id', { count: 'exact', head: true }).eq('category_id', id)
    ]);
    if ((tx.count || 0) > 0 || (bud.count || 0) > 0) {
      throw new Error('Impossibile eliminare: la categoria è usata da transazioni o budget esistenti.');
    }
    dbCheck(await supabaseClient.from('categories').delete().eq('id', id));
  }
};

// ================= BUDGETS =================

const budgets = {
  async listByMonth(month) {
    const res = await supabaseClient.from('budgets').select('*').eq('month', month);
    return dbCheck(res).map(budgetFromRow);
  },
  async upsert(payload) {
    const existing = await supabaseClient.from('budgets').select('id')
      .eq('category_id', payload.categoryId).eq('month', payload.month).maybeSingle();
    if (existing.data) {
      const res = await supabaseClient.from('budgets').update({ amount: payload.amount })
        .eq('id', existing.data.id).select().single();
      return budgetFromRow(dbCheck(res));
    }
    const res = await supabaseClient.from('budgets')
      .insert({ category_id: payload.categoryId, month: payload.month, amount: payload.amount })
      .select().single();
    return budgetFromRow(dbCheck(res));
  },
  async remove(id) {
    dbCheck(await supabaseClient.from('budgets').delete().eq('id', id));
  }
};

// ================= GOALS =================

const goals = {
  async list() {
    const gRes = dbCheck(await supabaseClient.from('goals').select('*').order('created_at'));
    const movRes = dbCheck(await supabaseClient.from('goal_movements').select('*'));
    return gRes.map((r) => goalFromRow(r, movRes.filter((m) => m.goal_id === r.id)));
  },
  async create(payload) {
    const res = await supabaseClient.from('goals').insert({
      name: payload.name, target_amount: payload.targetAmount, current_amount: 0,
      target_date: payload.targetDate || null, description: payload.description || '',
      icon: payload.icon || '🎯', linked_account_id: payload.linkedAccountId || null
    }).select().single();
    return goalFromRow(dbCheck(res));
  },
  async update(id, payload) {
    const row = {};
    if (payload.name !== undefined) row.name = payload.name;
    if (payload.targetAmount !== undefined) row.target_amount = payload.targetAmount;
    if (payload.targetDate !== undefined) row.target_date = payload.targetDate || null;
    if (payload.description !== undefined) row.description = payload.description;
    if (payload.icon !== undefined) row.icon = payload.icon;
    const res = await supabaseClient.from('goals').update(row).eq('id', id).select().single();
    return goalFromRow(dbCheck(res));
  },
  async remove(id) {
    dbCheck(await supabaseClient.from('goals').delete().eq('id', id));
  },
  async contribute(id, { amount, direction, accountId, note }) {
    if (!['add', 'remove'].includes(direction)) throw new Error('Direzione non valida.');
    if (typeof amount !== 'number' || amount <= 0) throw new Error('Importo non valido.');

    const goalRes = dbCheck(await supabaseClient.from('goals').select('*').eq('id', id).single());
    const delta = direction === 'add' ? amount : -amount;
    const newAmount = goalRes.current_amount + delta;

    if (newAmount < 0) throw new Error('Non puoi rimuovere più di quanto accantonato.');
    if (newAmount > goalRes.target_amount) throw new Error('L\'importo accantonato supererebbe l\'obiettivo.');

    if (direction === 'add' && accountId) {
      const balance = await computeAccountBalanceById(accountId);
      if (amount > balance) {
        throw new Error('Il conto scelto non ha un saldo sufficiente per questo accantonamento.');
      }
    }

    await supabaseClient.from('goal_movements').insert({
      goal_id: id, date: todayStr(), amount: delta, note: note || '', account_id: accountId || null
    });
    const res = await supabaseClient.from('goals').update({ current_amount: newAmount }).eq('id', id).select().single();
    return goalFromRow(dbCheck(res));
  }
};

// ================= RECURRING =================

const recurring = {
  async list() {
    const res = await supabaseClient.from('recurring_transactions').select('*').order('next_due_date');
    return dbCheck(res).map(recurringFromRow);
  },
  async create(payload) {
    const row = recurringToRow(payload);
    row.next_due_date = payload.startDate;
    const res = await supabaseClient.from('recurring_transactions').insert(row).select().single();
    return recurringFromRow(dbCheck(res));
  },
  async update(id, payload) {
    const res = await supabaseClient.from('recurring_transactions').update(recurringToRow(payload)).eq('id', id).select().single();
    return recurringFromRow(dbCheck(res));
  },
  async remove(id) {
    dbCheck(await supabaseClient.from('recurring_transactions').delete().eq('id', id));
  },
  // La logica di generazione/prossime-occorrenze vive in recurring-engine.js
  // (condivisa, per non duplicare codice).
};

// ================= INVESTMENTS =================

const investments = {
  async list() {
    const res = await supabaseClient.from('investments').select('*').order('date', { ascending: false });
    return dbCheck(res).map(investmentFromRow).map(withInvestmentReturns);
  },
  async get(id) {
    const res = await supabaseClient.from('investments').select('*').eq('id', id).single();
    return withInvestmentReturns(investmentFromRow(dbCheck(res)));
  },
  async create(payload) {
    const res = await supabaseClient.from('investments').insert(investmentToRow(payload)).select().single();
    return withInvestmentReturns(investmentFromRow(dbCheck(res)));
  },
  async update(id, payload) {
    const res = await supabaseClient.from('investments').update(investmentToRow(payload)).eq('id', id).select().single();
    return withInvestmentReturns(investmentFromRow(dbCheck(res)));
  },
  async remove(id) {
    dbCheck(await supabaseClient.from('investments').delete().eq('id', id));
  }
};

function withInvestmentReturns(inv) {
  const absoluteReturn = inv.currentValue - inv.capital;
  const percentReturn = inv.capital > 0 ? Math.round((absoluteReturn / inv.capital) * 1000) / 10 : 0;
  return { ...inv, absoluteReturn, percentReturn };
}

// ---------- INVESTMENT VALUATIONS (rilevazioni storiche) ----------

function valuationFromRow(r) {
  return {
    id: r.id, investmentId: r.investment_id, date: r.date,
    totalValue: r.total_value, redemptionValue: r.redemption_value, mwrr: r.mwrr,
    composition: r.composition || null, costs: r.costs,
    dataSource: r.data_source, sourceNote: r.source_note,
    notes: r.notes, createdAt: r.created_at
  };
}
function valuationToRow(v) {
  const row = {};
  if (v.investmentId !== undefined) row.investment_id = v.investmentId;
  if (v.date !== undefined) row.date = v.date;
  if (v.totalValue !== undefined) row.total_value = v.totalValue;
  if (v.redemptionValue !== undefined) row.redemption_value = v.redemptionValue === '' ? null : v.redemptionValue;
  if (v.mwrr !== undefined) row.mwrr = v.mwrr === '' ? null : v.mwrr;
  if (v.composition !== undefined) row.composition = v.composition;
  if (v.costs !== undefined) row.costs = v.costs === '' ? null : v.costs;
  if (v.dataSource !== undefined) row.data_source = v.dataSource;
  if (v.sourceNote !== undefined) row.source_note = v.sourceNote;
  if (v.notes !== undefined) row.notes = v.notes;
  return row;
}

const investmentValuations = {
  async listForInvestment(investmentId) {
    const res = await supabaseClient.from('investment_valuations').select('*')
      .eq('investment_id', investmentId).order('date', { ascending: true });
    return dbCheck(res).map(valuationFromRow);
  },
  async create(payload) {
    const res = await supabaseClient.from('investment_valuations').insert(valuationToRow(payload)).select().single();
    return valuationFromRow(dbCheck(res));
  },
  async update(id, payload) {
    const res = await supabaseClient.from('investment_valuations').update(valuationToRow(payload)).eq('id', id).select().single();
    return valuationFromRow(dbCheck(res));
  },
  async remove(id) {
    dbCheck(await supabaseClient.from('investment_valuations').delete().eq('id', id));
  }
};

// ---------- INVESTMENT MOVEMENTS (versamenti/prelievi) ----------

function movementFromRow(r) {
  return { id: r.id, investmentId: r.investment_id, date: r.date, amount: r.amount, type: r.type, notes: r.notes, createdAt: r.created_at };
}
function movementToRow(m) {
  const row = {};
  if (m.investmentId !== undefined) row.investment_id = m.investmentId;
  if (m.date !== undefined) row.date = m.date;
  if (m.amount !== undefined) row.amount = m.amount;
  if (m.type !== undefined) row.type = m.type;
  if (m.notes !== undefined) row.notes = m.notes;
  return row;
}

const investmentMovements = {
  async listForInvestment(investmentId) {
    const res = await supabaseClient.from('investment_movements').select('*')
      .eq('investment_id', investmentId).order('date', { ascending: true });
    return dbCheck(res).map(movementFromRow);
  },
  async create(payload) {
    const res = await supabaseClient.from('investment_movements').insert(movementToRow(payload)).select().single();
    return movementFromRow(dbCheck(res));
  },
  async update(id, payload) {
    const res = await supabaseClient.from('investment_movements').update(movementToRow(payload)).eq('id', id).select().single();
    return movementFromRow(dbCheck(res));
  },
  async remove(id) {
    dbCheck(await supabaseClient.from('investment_movements').delete().eq('id', id));
  }
};

// ---------- helper condiviso: saldo di UN conto dato il suo id ----------
async function computeAccountBalanceById(accountId) {
  const acc = dbCheck(await supabaseClient.from('accounts').select('*').eq('id', accountId).single());
  const [txRes, trRes] = await Promise.all([
    supabaseClient.from('transactions').select('type, amount').eq('account_id', accountId),
    supabaseClient.from('transfers').select('from_account_id, to_account_id, amount')
      .or(`from_account_id.eq.${accountId},to_account_id.eq.${accountId}`)
  ]);
  let balance = acc.initial_balance;
  for (const t of dbCheck(txRes)) balance += t.type === 'income' ? t.amount : -t.amount;
  for (const tr of dbCheck(trRes)) {
    if (tr.from_account_id === accountId) balance -= tr.amount;
    if (tr.to_account_id === accountId) balance += tr.amount;
  }
  return balance;
}

window.db = {
  auth, accounts, transactions, transfers, categories, budgets, goals, recurring, investments,
  investmentValuations, investmentMovements
};
