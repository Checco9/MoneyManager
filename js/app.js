/**
 * public/js/app.js
 *
 * Utility condivise da tutte le pagine dell'app:
 * - apiRequest: wrapper attorno a fetch() con gestione errori uniforme
 * - formatMoney / eurosToCents: conversione euro <-> centesimi
 * - showToast: notifica non invasiva
 * - openModal/closeModal: gestione generica delle finestre modali
 * - confirmAction: modale di conferma riutilizzabile (per le eliminazioni)
 * - populateSelect: riempie una <select> con opzioni {value,label}
 */

const API_BASE = '/api';

async function apiRequest(endpoint, options = {}) {
  let res;
  try {
    res = await fetch(`${API_BASE}${endpoint}`, {
      headers: { 'Content-Type': 'application/json' },
      ...options
    });
  } catch (networkErr) {
    throw new Error('Impossibile contattare il server. Controlla che sia in esecuzione.');
  }

  if (res.status === 204) return null;

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    const message =
      (data && (data.error || (data.errors && data.errors.join(' ')))) || `Errore ${res.status}`;
    throw new Error(message);
  }

  return data;
}

function formatMoney(cents) {
  const euros = (cents || 0) / 100;
  return euros.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' });
}

function eurosToCents(value) {
  return Math.round(parseFloat(value) * 100);
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-');
  return `${d}/${m}/${y}`;
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function currentMonthStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str == null ? '' : str;
  return div.innerHTML;
}

function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('visible'));
  setTimeout(() => {
    toast.classList.remove('visible');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// ---------- Modali generiche ----------

function openModal(id) {
  document.getElementById(id).hidden = false;
}

function closeModal(id) {
  document.getElementById(id).hidden = true;
}

// Chiude qualunque modale cliccando sull'overlay o su un pulsante [data-close-modal]
document.addEventListener('click', (e) => {
  if (e.target.classList.contains('modal-overlay')) {
    e.target.hidden = true;
  }
  const closeBtn = e.target.closest('[data-close-modal]');
  if (closeBtn) {
    closeModal(closeBtn.dataset.closeModal);
  }
});

let _confirmActionCallback = null;

function confirmAction(text, onConfirm, title = 'Conferma') {
  document.getElementById('confirm-modal-title').textContent = title;
  document.getElementById('confirm-modal-text').textContent = text;
  _confirmActionCallback = onConfirm;
  openModal('confirm-modal');
}

document.getElementById('btn-confirm-action')?.addEventListener('click', async () => {
  const cb = _confirmActionCallback;
  closeModal('confirm-modal');
  _confirmActionCallback = null;
  if (cb) await cb();
});

// ---------- Helper select ----------

function populateSelect(selectEl, items, { valueKey = 'id', labelFn, placeholder } = {}) {
  const currentValue = selectEl.value;
  selectEl.innerHTML = '';
  if (placeholder) {
    const opt = document.createElement('option');
    opt.value = '';
    opt.textContent = placeholder;
    selectEl.appendChild(opt);
  }
  items.forEach((item) => {
    const opt = document.createElement('option');
    opt.value = item[valueKey];
    opt.textContent = labelFn ? labelFn(item) : item.name;
    selectEl.appendChild(opt);
  });
  if (currentValue) selectEl.value = currentValue;
}
