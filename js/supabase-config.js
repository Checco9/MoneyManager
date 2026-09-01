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

const SUPABASE_URL = 'https://ehfmzbbysjffsbfxdkey.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_mazElwmm0yEhYKRzp2wNJg_E2zllWnB';

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
