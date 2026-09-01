-- ============================================================
-- MIGRAZIONE: aggiunge il supporto "ogni X" ai movimenti ricorrenti
-- ============================================================
-- Esegui questo script UNA VOLTA nel tuo progetto Supabase già esistente
-- (SQL Editor → New query → incolla → Run). Non tocca i dati già presenti:
-- aggiunge solo una colonna con valore di default 1 (= comportamento
-- identico a prima per i movimenti ricorrenti già creati).
-- ============================================================

alter table recurring_transactions
  add column if not exists every_n integer not null default 1;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'every_n_positive'
  ) then
    alter table recurring_transactions
      add constraint every_n_positive check (every_n >= 1);
  end if;
end $$;
