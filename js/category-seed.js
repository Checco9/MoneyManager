/**
 * public/js/category-seed.js
 *
 * Prima della migrazione multi-utente, le categorie di default venivano
 * create UNA VOLTA SOLA a livello di database (vedi sql/schema.sql),
 * condivise da tutti. Ora che ogni account ha i propri dati isolati,
 * un account nuovo (o un account esistente che prima vedeva le
 * categorie di un altro) partirebbe senza categorie.
 *
 * Questa funzione controlla, ad ogni login, se l'utente ha zero
 * categorie e in quel caso gliele crea — una volta sola, poi non
 * tocca più nulla (se l'utente le cancella tutte di proposito, non
 * vengono ricreate al prossimo login).
 */

const DEFAULT_CATEGORIES = [
  { name: 'Stipendio', type: 'income', icon: '💼' },
  { name: 'Regali', type: 'income', icon: '🎁' },
  { name: 'Rimborsi', type: 'income', icon: '↩️' },
  { name: 'Vendite', type: 'income', icon: '🏷️' },
  { name: 'Investimenti', type: 'income', icon: '📈' },
  { name: 'Altro', type: 'income', icon: '❓' },
  { name: 'Cibo', type: 'expense', icon: '🍔' },
  { name: 'Benzina', type: 'expense', icon: '⛽' },
  { name: 'Trasporti', type: 'expense', icon: '🚌' },
  { name: 'Casa', type: 'expense', icon: '🏠' },
  { name: 'Abbonamenti', type: 'expense', icon: '📺' },
  { name: 'Divertimento', type: 'expense', icon: '🎉' },
  { name: 'Shopping', type: 'expense', icon: '🛍️' },
  { name: 'Tecnologia', type: 'expense', icon: '💻' },
  { name: 'Viaggi', type: 'expense', icon: '✈️' },
  { name: 'Salute', type: 'expense', icon: '⚕️' },
  { name: 'Istruzione', type: 'expense', icon: '📚' },
  { name: 'Regali', type: 'expense', icon: '🎁' },
  { name: 'Altro', type: 'expense', icon: '❓' }
];

async function seedDefaultCategoriesIfNeeded() {
  try {
    const existing = await db.categories.list();
    if (existing.length > 0) return; // già ha categorie (sue, non più condivise): non tocco nulla

    for (const cat of DEFAULT_CATEGORIES) {
      await db.categories.create(cat);
    }
    showToast('Categorie di base create per il tuo account.', 'success');
  } catch (err) {
    console.warn('Seed categorie saltato:', err.message);
  }
}

window.seedDefaultCategoriesIfNeeded = seedDefaultCategoriesIfNeeded;
