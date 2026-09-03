-- ============================================================
-- MIGRAZIONE: monitoraggio investimenti con storico
-- ============================================================
-- Esegui questo script UNA VOLTA nel tuo progetto Supabase esistente
-- (SQL Editor → New query → incolla → Run). Non tocca i dati già
-- presenti nella tabella "investments": aggiunge solo due tabelle nuove
-- e amplia l'elenco dei tipi di investimento consentiti.
-- ============================================================

-- Amplio i tipi consentiti per includere polizze e conti deposito,
-- utile fin da subito anche per confronti futuri con altri strumenti.
alter table investments drop constraint if exists investments_type_check;
alter table investments add constraint investments_type_check
  check (type in ('BTP','BOT','ETF','Azioni','Obbligazioni','Polizza','Conto Deposito','Altro'));

-- ---------- STORICO RILEVAZIONI ----------
-- Una riga = una "fotografia" dell'investimento in una data precisa.
-- La tabella "investments" resta il contenitore (nome, tipo, note);
-- qui vive tutto ciò che cambia nel tempo.
create table investment_valuations (
  id uuid primary key default gen_random_uuid(),
  investment_id uuid not null references investments(id) on delete cascade,
  date date not null,

  total_value integer not null,        -- valore complessivo, in centesimi
  redemption_value integer,            -- valore di riscatto, se diverso e noto (centesimi)
  mwrr numeric(7,3),                   -- rendimento money-weighted %, es. -1.99

  -- Composizione interna, generica: non ogni investimento ha una
  -- suddivisione (Gestione Separata / Fondo Interno è specifico delle
  -- polizze), quindi la salviamo come mappa {componente: percentuale}
  -- invece di colonne fisse — un ETF o un BTP semplicemente non la
  -- valorizzano.
  composition jsonb,

  costs integer,                       -- costi noti CUMULATIVI a questa data (centesimi)

  -- Tracciabilità del dato: da dove viene, per non confondere una tua
  -- rilevazione manuale con un dato futuro raccolto automaticamente.
  data_source text not null default 'manual'
    check (data_source in ('manual','automatic','calculated','estimate')),
  source_note text default '',

  notes text default '',
  created_at timestamptz not null default now(),

  -- Evita doppioni accidentali per la stessa data: se serve correggere,
  -- si modifica la rilevazione esistente invece di duplicarla.
  unique (investment_id, date)
);

-- ---------- VERSAMENTI E PRELIEVI ----------
-- Distinti dalle rilevazioni: un versamento aumenta il capitale
-- versato, NON è un guadagno. Una rilevazione fotografa il valore,
-- non implica movimento di denaro.
create table investment_movements (
  id uuid primary key default gen_random_uuid(),
  investment_id uuid not null references investments(id) on delete cascade,
  date date not null,
  amount integer not null check (amount > 0),  -- sempre positivo, il "type" dà il segno
  type text not null check (type in ('deposit','withdrawal')),
  notes text default '',
  created_at timestamptz not null default now()
);

-- ---------- RLS: stessa regola di tutte le altre tabelle ----------
alter table investment_valuations enable row level security;
alter table investment_movements enable row level security;

create policy "authenticated_full_access" on investment_valuations
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "authenticated_full_access" on investment_movements
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
