-- ============================================================
-- MIGRAZIONE FASE 2: sistema PAC (piani di accumulo)
-- ============================================================
-- Esegui una volta su Supabase (SQL Editor → Run).
-- ============================================================

-- ---------- PAC (piani di accumulo) ----------
-- Stessa logica di scheduling già usata per i movimenti ricorrenti
-- (frequenza + "ogni X" + next_due_date), qui applicata a versamenti
-- automatici verso un investimento invece che a transazioni normali.
create table investment_pacs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  investment_id uuid not null references investments(id) on delete cascade,
  account_id uuid not null references accounts(id) on delete restrict,
  amount integer not null check (amount > 0),
  frequency text not null check (frequency in ('daily','weekly','monthly','yearly')),
  every_n integer not null default 1 check (every_n >= 1),
  start_date date not null,
  end_date date,
  active boolean not null default true,
  next_due_date date not null,
  last_generated_date date
);

alter table investment_pacs enable row level security;
create policy "authenticated_full_access" on investment_pacs
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- Collega (facoltativamente) un movimento al PAC che lo ha generato,
-- per poter mostrare "storico versamenti" nella pagina del PAC.
alter table investment_movements add column if not exists pac_id uuid references investment_pacs(id) on delete set null;

-- ---------- Nuovo tipo di transazione: "investment" ----------
-- Un versamento PAC riduce il saldo del conto di origine ma NON deve
-- essere confuso con una spesa: non deve comparire nelle statistiche
-- entrate/uscite del mese (che filtrano esplicitamente su
-- income/expense, quindi un tipo diverso ne resta fuori automaticamente)
-- e rappresenta uno spostamento di patrimonio, non una sua diminuzione.
alter table transactions drop constraint if exists transactions_type_check;
alter table transactions add constraint transactions_type_check
  check (type in ('income','expense','investment'));
