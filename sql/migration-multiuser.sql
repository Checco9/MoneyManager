-- ============================================================
-- MIGRAZIONE: ACCOUNT SEPARATI (ogni utente vede solo i propri dati)
-- ============================================================
-- Prima: chiunque fosse loggato vedeva e modificava gli stessi dati.
-- Dopo:  ogni riga appartiene a UN utente e solo lui la vede.
--
-- ⚠️  PRIMA DI ESEGUIRE, modifica UNA sola riga qui sotto (marcata
--     "<<< CAMBIA QUI"): metti l'email dell'account che deve
--     RICEVERE i dati che esistono oggi (di solito la tua).
--     Gli altri account esistenti ripartiranno vuoti.
--
-- Come eseguirla: Supabase → SQL Editor → New query → incolla
-- tutto → modifica l'email → Run.
--
-- Sicurezza:
--  * Se l'email non corrisponde a nessun utente, lo script si FERMA
--    con un errore e NON modifica nulla (è tutto in una transazione).
--  * Puoi rilanciarlo senza danni (es. dopo aver eseguito in seguito
--    un'altra migrazione che crea nuove tabelle).
--  * Non cancella nessun dato: assegna solo un proprietario alle righe.
-- ============================================================

begin;

do $$
declare
  owner_email text := 'francescogallo956@gmail.com';  -- <<< CAMBIA QUI
  v_owner uuid;
  t text;
  tables text[] := array[
    'accounts', 'categories', 'transactions', 'transfers', 'budgets',
    'goals', 'goal_movements', 'recurring_transactions',
    'investments', 'investment_valuations', 'investment_movements', 'investment_pacs'
  ];
begin
  select id into v_owner from auth.users where lower(email) = lower(owner_email);

  if v_owner is null then
    raise exception 'Nessun utente con email "%" in Authentication → Users. Controlla di averla scritta esattamente come nel dashboard. NESSUNA modifica è stata applicata.', owner_email;
  end if;

  foreach t in array tables loop
    -- Salta le tabelle che non esistono ancora (es. investment_pacs se
    -- non hai ancora eseguito migration-pac.sql): in quel caso rilancia
    -- questo script dopo averla creata.
    if to_regclass('public.' || t) is null then
      raise notice 'Tabella % non presente, saltata.', t;
      continue;
    end if;

    -- 1) Colonna proprietario. Il default auth.uid() fa sì che ogni
    --    nuova riga creata dall'app venga assegnata automaticamente
    --    all'utente loggato, senza cambiare una riga del codice di salvataggio.
    execute format('alter table public.%I add column if not exists owner_id uuid default auth.uid() references auth.users(id) on delete cascade', t);

    -- 2) I dati esistenti vanno al proprietario scelto.
    execute format('update public.%I set owner_id = %L where owner_id is null', t, v_owner);

    -- 3) Da ora in poi ogni riga DEVE avere un proprietario.
    execute format('alter table public.%I alter column owner_id set not null', t);
    execute format('create index if not exists %I on public.%I (owner_id)', t || '_owner_idx', t);

    -- 4) Nuova regola di accesso: sostituisce "tutti gli utenti loggati
    --    vedono tutto" con "vedi e modifichi solo le righe tue".
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "authenticated_full_access" on public.%I', t);
    execute format('drop policy if exists "owner_only" on public.%I', t);
    execute format('create policy "owner_only" on public.%I for all using (owner_id = auth.uid()) with check (owner_id = auth.uid())', t);
  end loop;
end $$;

commit;
