// Botón flotante de sincronización ACC -> GitHub.
// Paso 1 de la integración: solo aparece/desaparece según la URL y todavía
// no hace nada al hacer clic (eso se conecta en el siguiente paso).
(function () {
  const BUTTON_ID = 'ingeurbe-acc-sync-btn';

  // Coincide con enlaces como:
  // https://acc.autodesk.com/build/schedule/projects/ce619a54-c780-411b-afc9-3545f20c38c4
  const SCHEDULE_URL_PATTERN = /^https:\/\/acc\.autodesk\.com\/build\/schedule\//;

  function isScheduleUrl(url) {
    return SCHEDULE_URL_PATTERN.test(url);
  }

  function createButton() {
    if (document.getElementById(BUTTON_ID)) return;

    const btn = document.createElement('button');
    btn.id = BUTTON_ID;
    btn.type = 'button';
    btn.title = 'Sincronizar programación con GitHub (próximamente)';
    btn.style.cssText = [
      'position:fixed',
      'top:24px',
      'right:24px',
      'width:88px',
      'height:88px',
      'border-radius:50%',
      'border:none',
      'padding:0',
      'cursor:pointer',
      'z-index:2147483647',
      'box-shadow:0 4px 14px rgba(0,0,0,.35)',
      'background-image:url(' + chrome.runtime.getURL('icons/logo.png') + ')',
      'background-size:auto 84%',
      'background-repeat:no-repeat',
      'background-position:center 80%',
      'background-color:#fff',
      'transition:transform .15s ease, box-shadow .15s ease'
    ].join(';');

    btn.addEventListener('mouseenter', () => {
      btn.style.transform = 'scale(1.06)';
      btn.style.boxShadow = '0 6px 18px rgba(0,0,0,.4)';
    });
    btn.addEventListener('mouseleave', () => {
      btn.style.transform = 'scale(1)';
      btn.style.boxShadow = '0 4px 14px rgba(0,0,0,.35)';
    });

    // Todavia sin funcionalidad: es el primer paso de la integracion
    // (sincronizar la programacion de ACC Build > Schedule con el repo).
    btn.addEventListener('click', () => {
      console.log('[Ingeurbe ACC Sync] Botón presionado (funcionalidad pendiente).');
    });

    document.body.appendChild(btn);
  }

  function removeButton() {
    const btn = document.getElementById(BUTTON_ID);
    if (btn) btn.remove();
  }

  function syncButtonWithUrl() {
    if (isScheduleUrl(location.href)) createButton();
    else removeButton();
  }

  // ACC es una SPA: la URL cambia sin recargar la pagina al navegar entre
  // modulos (Schedule, Cost, Files...), asi que hay que vigilar los cambios
  // de historial ademas de la carga inicial del content script.
  const pushState = history.pushState;
  history.pushState = function () {
    pushState.apply(this, arguments);
    window.dispatchEvent(new Event('ingeurbe-locationchange'));
  };
  const replaceState = history.replaceState;
  history.replaceState = function () {
    replaceState.apply(this, arguments);
    window.dispatchEvent(new Event('ingeurbe-locationchange'));
  };
  window.addEventListener('popstate', syncButtonWithUrl);
  window.addEventListener('ingeurbe-locationchange', syncButtonWithUrl);

  syncButtonWithUrl();
})();
