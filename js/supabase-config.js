/**
 * public/js/supabase-config.js
 *
 * INCOLLA QUI le tue credenziali Supabase (le trovi in:
 * Dashboard del progetto → Project Settings → API).
 *
 * SUPABASE_URL   → "Project URL"
 * SUPABASE_ANON_KEY → "anon public" key
 *
 * Nota di sicurezza: la "anon key" NON è un segreto da nascondere,
 * è pensata per stare nel codice frontend pubblico — la protezione
 * vera è la Row Level Security attiva sul database (vedi sql/schema.sql),
 * che blocca chiunque non abbia fatto login.
 */

const SUPABASE_URL = 'INCOLLA_QUI_IL_TUO_PROJECT_URL';
const SUPABASE_ANON_KEY = 'INCOLLA_QUI_LA_TUA_ANON_KEY';

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
