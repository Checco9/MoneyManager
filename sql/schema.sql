-- ============================================================
-- Money Manager — Schema Supabase (Postgres)
-- ============================================================
-- Esegui questo intero file UNA VOLTA in:
-- Supabase Dashboard → SQL Editor → New query → incolla → Run
--
-- Convenzioni:
--  - Tutti gli importi sono INTEGER espressi in CENTESIMI (mai float).
--  - Gli id sono UUID generati automaticamente.
--  - RLS (Row Level Security) è attiva su ogni tabella: solo utenti
--    AUTENTICATI (tu e la tua ragazza, dopo il login) possono leggere
--    e scrivere. Un visitatore anonimo che trova l'URL non vede nulla.
--  - I dati sono CONDIVISI tra tutti gli utenti autenticati (non c'è
--    isolamento per utente): è il modello giusto per finanze di coppia.
-- ============================================================

create extension if not exists "pgcrypto";

-- ---------- ACCOUNTS ----------
create table accounts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type text not null check (type in (
    'contanti','conto_corrente','carta','poste','postepay','paypal','investimenti','altro'
  )),
  initial_balance integer not null default 0,
  opening_date date,
  color text default '#4f46e5',
  icon text default '💰',
  notes text default '',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ---------- CATEGORIES ----------
create table categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type text not null check (type in ('income','expense')),
  icon text default '❓',
  is_default boolean not null default false
);

-- ---------- TRANSACTIONS ----------
create table transactions (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  time time,
  type text not null check (type in ('income','expense')),
  amount integer not null check (amount > 0),
  account_id uuid not null references accounts(id) on delete restrict,
  category_id uuid references categories(id) on delete set null,
  subcategory text default '',
  description text default '',
  notes text default '',
  tags text[] not null default '{}',
  created_at timestamptz not null default now()
);

-- ---------- TRANSFERS (giroconti) ----------
create table transfers (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  from_account_id uuid not null references accounts(id) on delete restrict,
  to_account_id uuid not null references accounts(id) on delete restrict,
  amount integer not null check (amount > 0),
  description text default '',
  created_at timestamptz not null default now(),
  constraint different_accounts check (from_account_id <> to_account_id)
);

-- ---------- BUDGETS ----------
create table budgets (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references categories(id) on delete cascade,
  month text not null check (month ~ '^\d{4}-\d{2}$'),
  amount integer not null check (amount >= 0),
  unique (category_id, month)
);

-- ---------- GOALS (obiettivi di risparmio) ----------
create table goals (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  target_amount integer not null check (target_amount > 0),
  current_amount integer not null default 0,
  target_date date,
  description text default '',
  icon text default '🎯',
  linked_account_id uuid references accounts(id) on delete set null,
  created_at timestamptz not null default now()
);

-- Movimenti di accantonamento verso un obiettivo. NON spostano denaro
-- reale tra conti: sono solo un'etichetta di progresso (vedi commenti
-- nel frontend js/goals.js per il dettaglio).
create table goal_movements (
  id uuid primary key default gen_random_uuid(),
  goal_id uuid not null references goals(id) on delete cascade,
  date date not null default current_date,
  amount integer not null, -- positivo = accantonato, negativo = prelevato
  note text default '',
  account_id uuid references accounts(id) on delete set null
);

-- ---------- RECURRING TRANSACTIONS ----------
create table recurring_transactions (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('income','expense')),
  amount integer not null check (amount > 0),
  account_id uuid not null references accounts(id) on delete restrict,
  category_id uuid references categories(id) on delete set null,
  description text not null default '',
  frequency text not null check (frequency in ('daily','weekly','monthly','yearly')),
  every_n integer not null default 1 check (every_n >= 1),
  start_date date not null,
  end_date date,
  active boolean not null default true,
  next_due_date date not null,
  last_generated_date date
);

-- ---------- INVESTMENTS ----------
create table investments (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type text not null check (type in ('BTP','BOT','ETF','Azioni','Obbligazioni','Altro')),
  capital integer not null default 0,
  current_value integer not null default 0,
  date date,
  notes text default ''
);

-- ============================================================
-- ROW LEVEL SECURITY: solo utenti autenticati possono leggere/scrivere.
-- Nessun isolamento per utente: i dati sono condivisi (finanze di coppia).
-- ============================================================

alter table accounts enable row level security;
alter table categories enable row level security;
alter table transactions enable row level security;
alter table transfers enable row level security;
alter table budgets enable row level security;
alter table goals enable row level security;
alter table goal_movements enable row level security;
alter table recurring_transactions enable row level security;
alter table investments enable row level security;

-- Una policy identica per ogni tabella: chiunque sia autenticato (loggato)
-- può fare SELECT/INSERT/UPDATE/DELETE su qualunque riga. Chi non è
-- loggato (ruolo "anon") non passa nemmeno la clausola USING e non vede nulla.
create policy "authenticated_full_access" on accounts
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "authenticated_full_access" on categories
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "authenticated_full_access" on transactions
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "authenticated_full_access" on transfers
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "authenticated_full_access" on budgets
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "authenticated_full_access" on goals
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "authenticated_full_access" on goal_movements
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "authenticated_full_access" on recurring_transactions
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "authenticated_full_access" on investments
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- ============================================================
-- CATEGORIE DI DEFAULT (equivalenti al seed automatico che faceva
-- prima il server Express al primo avvio)
-- ============================================================
insert into categories (name, type, icon, is_default) values
  ('Stipendio', 'income', '💼', true),
  ('Regali', 'income', '🎁', true),
  ('Rimborsi', 'income', '↩️', true),
  ('Vendite', 'income', '🏷️', true),
  ('Investimenti', 'income', '📈', true),
  ('Altro', 'income', '❓', true),
  ('Cibo', 'expense', '🍔', true),
  ('Benzina', 'expense', '⛽', true),
  ('Trasporti', 'expense', '🚌', true),
  ('Casa', 'expense', '🏠', true),
  ('Abbonamenti', 'expense', '📺', true),
  ('Divertimento', 'expense', '🎉', true),
  ('Shopping', 'expense', '🛍️', true),
  ('Tecnologia', 'expense', '💻', true),
  ('Viaggi', 'expense', '✈️', true),
  ('Salute', 'expense', '⚕️', true),
  ('Istruzione', 'expense', '📚', true),
  ('Regali', 'expense', '🎁', true),
  ('Altro', 'expense', '❓', true);
