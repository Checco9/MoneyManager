/**
 * public/js/categories.js
 * Pagina "Categorie": elenco entrate/uscite + CRUD.
 */

let categoriesPageBound = false;

async function initCategoriesPage() {
  bindCategoriesPageEvents();
  await loadCategories();
}

async function loadCategories() {
  try {
    const list = await db.categories.list();
    renderCategoryList('categories-income-list', list.filter((c) => c.type === 'income'));
    renderCategoryList('categories-expense-list', list.filter((c) => c.type === 'expense'));
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function renderCategoryList(elementId, items) {
  const el = document.getElementById(elementId);
  if (items.length === 0) {
    el.innerHTML = '<li class="empty-state">Nessuna categoria.</li>';
    return;
  }
  el.innerHTML = items
    .map((c) => `
      <li class="category-list-item">
        <span>${c.icon} ${escapeHtml(c.name)}</span>
        <span>
          <button class="btn-icon" title="Modifica" onclick="openEditCategory('${c.id}')">✏️</button>
          <button class="btn-icon" title="Elimina" onclick="askDeleteCategory('${c.id}')">🗑️</button>
        </span>
      </li>`)
    .join('');
}

function openNewCategory() {
  document.getElementById('category-modal-title').textContent = 'Nuova categoria';
  document.getElementById('category-form').reset();
  document.getElementById('category-id').value = '';
  openModal('category-modal');
}

function openEditCategory(id) {
  db.categories.list().then((list) => {
    const cat = list.find((c) => c.id === id);
    if (!cat) return;
    document.getElementById('category-modal-title').textContent = 'Modifica categoria';
    document.getElementById('category-id').value = cat.id;
    document.getElementById('category-name').value = cat.name;
    document.getElementById('category-type').value = cat.type;
    document.getElementById('category-icon').value = cat.icon || '';
    openModal('category-modal');
  }).catch((err) => showToast(err.message, 'error'));
}

function askDeleteCategory(id) {
  confirmAction('Eliminare questa categoria? Non sarà possibile se è già usata da transazioni o budget.', async () => {
    try {
      await db.categories.remove(id);
      showToast('Categoria eliminata.', 'success');
      loadCategories();
    } catch (err) {
      showToast(err.message, 'error');
    }
  });
}

function bindCategoriesPageEvents() {
  if (categoriesPageBound) return;
  categoriesPageBound = true;

  document.getElementById('btn-new-category').addEventListener('click', openNewCategory);

  document.getElementById('category-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('category-id').value;
    const payload = {
      name: document.getElementById('category-name').value,
      type: document.getElementById('category-type').value,
      icon: document.getElementById('category-icon').value || '❓'
    };
    try {
      if (id) {
        await db.categories.update(id, payload);
        showToast('Categoria aggiornata.', 'success');
      } else {
        await db.categories.create(payload);
        showToast('Categoria creata.', 'success');
      }
      closeModal('category-modal');
      loadCategories();
    } catch (err) {
      showToast(err.message, 'error');
    }
  });
}

window.initCategoriesPage = initCategoriesPage;
window.openEditCategory = openEditCategory;
window.askDeleteCategory = askDeleteCategory;
