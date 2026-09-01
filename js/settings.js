/**
 * public/js/settings.js
 *
 * Backup nella versione cloud: dato che i dati vivono in Supabase (Postgres
 * con vincoli di chiave esterna) invece che in un unico file JSON, qui:
 *  - l'EXPORT legge tutte le tabelle e le mette in un unico oggetto JSON
 *    scaricabile (stessa idea di prima, formato diverso sotto il cofano)
 *  - l'IMPORT cancella e reinserisce i dati rispettando l'ordine delle
 *    chiavi esterne (prima le "tabelle genitore" come conti e categorie,
 *    poi quelle che le referenziano), preservando gli ID originali così
 *    i collegamenti tra tabelle restano validi.
 *
 * L'import chiede SEMPRE conferma esplicita perché sostituisce tutto.
 */

let settingsPageBound = false;

const EXPORT_TABLES = [
  'accounts', 'categories', 'transactions', 'transfers',
  'budgets', 'goals', 'goal_movements', 'recurring_transactions', 'investments'
];

// Ordine di cancellazione: prima le tabelle "figlie" (con FK verso le
// altre), poi quelle "genitore". L'inserimento userà l'ordine inverso.
const DELETE_ORDER = [
  'goal_movements', 'goals', 'transactions', 'transfers',
  'budgets', 'recurring_transactions', 'investments', 'categories', 'accounts'
];
const INSERT_ORDER = [...DELETE_ORDER].reverse();

function initSettingsPage() {
  bindSettingsPageEvents();
}

async function exportAllData() {
  const result = {};
  for (const table of EXPORT_TABLES) {
    const res = await supabaseClient.from(table).select('*');
    if (res.error) throw new Error(`Errore esportando "${table}": ${res.error.message}`);
    result[table] = res.data;
  }
  return result;
}

function downloadJson(obj, filename) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}

function validateBackupStructure(data) {
  const errors = [];
  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    return ['Il file non è un oggetto JSON valido.'];
  }
  for (const table of EXPORT_TABLES) {
    if (!(table in data)) errors.push(`Manca la sezione "${table}" nel file di backup.`);
    else if (!Array.isArray(data[table])) errors.push(`La sezione "${table}" dovrebbe essere un elenco.`);
  }
  return errors;
}

async function importAllData(data) {
  // Cancella tutto nell'ordine sicuro (figlie prima, genitori dopo)
  for (const table of DELETE_ORDER) {
    const res = await supabaseClient.from(table).delete().not('id', 'is', null);
    if (res.error) throw new Error(`Errore cancellando "${table}": ${res.error.message}`);
  }
  // Reinserisce nell'ordine inverso (genitori prima, figlie dopo),
  // mantenendo gli ID originali del backup per preservare i collegamenti.
  for (const table of INSERT_ORDER) {
    const rows = data[table];
    if (!rows || rows.length === 0) continue;
    const res = await supabaseClient.from(table).insert(rows);
    if (res.error) throw new Error(`Errore importando "${table}": ${res.error.message}`);
  }
}

async function exportTransactionsCsv() {
  const [txRes, accRes, catRes] = await Promise.all([
    supabaseClient.from('transactions').select('*').order('date'),
    supabaseClient.from('accounts').select('id,name'),
    supabaseClient.from('categories').select('id,name')
  ]);
  if (txRes.error) throw new Error(txRes.error.message);

  const accounts = accRes.data || [];
  const categories = catRes.data || [];
  const header = ['Data', 'Ora', 'Tipo', 'Importo (EUR)', 'Conto', 'Categoria', 'Descrizione', 'Note', 'Tag'];

  const escapeCsv = (val) => {
    const s = String(val ?? '');
    return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };

  const rows = txRes.data.map((t) => {
    const account = accounts.find((a) => a.id === t.account_id);
    const category = categories.find((c) => c.id === t.category_id);
    return [
      t.date, t.time || '', t.type === 'income' ? 'Entrata' : 'Uscita',
      (t.amount / 100).toFixed(2), account ? account.name : '', category ? category.name : '',
      t.description || '', t.notes || '', (t.tags || []).join('|')
    ];
  });

  return '\uFEFF' + [header, ...rows].map((r) => r.map(escapeCsv).join(';')).join('\n');
}

function bindSettingsPageEvents() {
  if (settingsPageBound) return;
  settingsPageBound = true;

  document.getElementById('btn-export-json').addEventListener('click', async () => {
    try {
      const data = await exportAllData();
      downloadJson(data, `money-manager-backup-${todayStr()}.json`);
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  document.getElementById('btn-export-csv').addEventListener('click', async () => {
    try {
      const csv = await exportTransactionsCsv();
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `money-manager-transazioni-${todayStr()}.csv`;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  document.getElementById('import-file-input').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;

    let parsed;
    try {
      parsed = JSON.parse(await file.text());
    } catch (err) {
      showToast('Il file non è un JSON valido. Importazione annullata.', 'error');
      return;
    }

    const errors = validateBackupStructure(parsed);
    if (errors.length > 0) {
      showToast('File di backup non valido: ' + errors.join(' '), 'error');
      return;
    }

    confirmAction(
      'Importando questo backup TUTTI i dati attuali (conti, transazioni, budget, obiettivi, ecc.) verranno sostituiti per entrambi gli utenti. Vuoi continuare?',
      async () => {
        try {
          await importAllData(parsed);
          showToast('Backup importato con successo. Ricarico la pagina...', 'success');
          setTimeout(() => window.location.reload(), 1200);
        } catch (err) {
          showToast(err.message, 'error');
        }
      },
      'Conferma importazione backup'
    );
  });
}

window.initSettingsPage = initSettingsPage;
