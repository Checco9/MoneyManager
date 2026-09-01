/**
 * public/js/auth.js
 *
 * Mostra la schermata di login finché non c'è una sessione Supabase
 * valida; una volta loggati, mostra l'app e avvia il router.
 * Gli account (email+password) vanno creati manualmente dal Dashboard
 * Supabase (Authentication → Users → Add user) — non c'è una pagina di
 * registrazione pubblica, di proposito: siete solo in due.
 */

async function initAuthGate() {
  const session = await db.auth.getSession();
  if (session) {
    showApp(session);
  } else {
    showLogin();
  }

  db.auth.onChange((session) => {
    if (session) {
      showApp(session);
    } else {
      showLogin();
    }
  });

  document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    const errorEl = document.getElementById('login-error');
    errorEl.textContent = '';

    try {
      await db.auth.signIn(email, password);
      // showApp() viene chiamato automaticamente da onChange qui sopra
    } catch (err) {
      errorEl.textContent = err.message;
    }
  });

  document.getElementById('btn-logout').addEventListener('click', async () => {
    await db.auth.signOut();
  });
}

function showLogin() {
  document.getElementById('login-screen').hidden = false;
  document.querySelector('.app-layout').hidden = true;
}

let appAlreadyStarted = false;

function showApp(session) {
  document.getElementById('login-screen').hidden = true;
  document.querySelector('.app-layout').hidden = false;
  document.getElementById('user-email').textContent = session.user.email;

  if (!appAlreadyStarted) {
    appAlreadyStarted = true;
    startApp();
  }
}

async function startApp() {
  handleHashChange();
  // Non generiamo più in automatico e senza avviso: chiediamo conferma
  // se ci sono movimenti ricorrenti scaduti da registrare.
  promptRecurringGeneration(false);
}

/**
 * Controlla se ci sono movimenti ricorrenti dovuti e, se sì, chiede
 * conferma prima di registrarli davvero. Richiamabile sia all'avvio
 * (manual=false, silenzioso se non c'è nulla da fare) sia da un
 * pulsante nella pagina Ricorrenti (manual=true, avvisa anche se non
 * c'è nulla da registrare).
 */
async function promptRecurringGeneration(manual = false) {
  try {
    const due = await recurringEngine.previewDue();

    if (due.length === 0) {
      if (manual) showToast('Nessun movimento ricorrente da registrare al momento.', 'info');
      return;
    }

    const totalNet = due.reduce((s, d) => s + (d.type === 'income' ? d.amount : -d.amount), 0);
    const preview = due.slice(0, 3).map((d) => d.description).join(', ');
    const more = due.length > 3 ? ` e altri ${due.length - 3}` : '';

    confirmAction(
      `Ci sono ${due.length} movimenti ricorrenti da registrare (${preview}${more}), per un totale netto di ${formatMoney(totalNet)}. Vuoi registrarli ora?`,
      async () => {
        const created = await recurringEngine.generateDueTransactions();
        showToast(`Registrati ${created} movimenti ricorrenti.`, 'success');
        handleHashChange(); // ricarica la pagina corrente con i dati aggiornati
      },
      'Movimenti ricorrenti da registrare'
    );
  } catch (err) {
    if (manual) showToast(err.message, 'error');
    else console.warn('Controllo ricorrenti saltato:', err.message);
  }
}

window.promptRecurringGeneration = promptRecurringGeneration;

document.addEventListener('DOMContentLoaded', initAuthGate);
