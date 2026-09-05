-- ============================================================
-- MIGRAZIONE FASE 1: portfolio tracker (ETF/azioni/fondi)
-- ============================================================
-- Esegui una volta su Supabase (SQL Editor → New query → Run).
-- Tutte le colonne sono NULLABLE: gli investimenti già inseriti
-- restano identici, non serve compilare nulla di nuovo per loro.
-- ============================================================

alter table investments add column if not exists ticker text;
alter table investments add column if not exists isin text;
alter table investments add column if not exists quantity numeric(18,6);
alter table investments add column if not exists avg_price integer;      -- prezzo medio di carico, in centesimi per unità
alter table investments add column if not exists currency text default 'EUR';
alter table investments add column if not exists broker text;
alter table investments add column if not exists last_price_update date;

-- Amplio i tipi per includere "Fondo" (fondi comuni, distinti da ETF/Polizza)
alter table investments drop constraint if exists investments_type_check;
alter table investments add constraint investments_type_check
  check (type in ('BTP','BOT','ETF','Azioni','Obbligazioni','Fondo','Polizza','Conto Deposito','Altro'));

-- I dividendi sono un movimento particolare: denaro che l'investimento
-- restituisce SENZA essere un prelievo di capitale (non riduce il
-- capitale versato) e senza essere un nuovo versamento. Riuso la
-- tabella investment_movements già esistente invece di crearne una
-- nuova, aggiungendo solo il tipo 'dividend' ai tipi ammessi.
alter table investment_movements drop constraint if exists investment_movements_type_check;
alter table investment_movements add constraint investment_movements_type_check
  check (type in ('deposit','withdrawal','dividend'));
