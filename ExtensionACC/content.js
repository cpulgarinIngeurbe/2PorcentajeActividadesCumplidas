// Botón flotante de sincronización ACC -> GitHub.
// La secuencia de acciones que ejecuta el boton se arma paso a paso: cada
// paso nuevo que se indique se agrega como una entrada mas en SYNC_STEPS.
(function () {
  const BUTTON_ID = 'ingeurbe-acc-sync-btn';

  // Pasos de navegacion/interaccion que se ejecutan al oprimir el boton,
  // en orden. Por ahora solo navegacion (sin descargar/leer datos todavia).
  const SYNC_STEPS = [
    {
      name: 'Clic en "Schedules"',
      run: () => {
        const label = document.querySelector('label[for="Schedules"]');
        if (!label) {
          console.warn('[Ingeurbe ACC Sync] No se encontró label[for="Schedules"].');
          return false;
        }
        label.click();
        return true;
      }
    }
  ];

  // Aviso visual en pantalla (no todos pueden abrir la consola del
  // navegador para ver los console.log de depuracion).
  function showStatus(message, isError) {
    let status = document.getElementById('ingeurbe-acc-sync-status');
    if (!status) {
      status = document.createElement('div');
      status.id = 'ingeurbe-acc-sync-status';
      status.style.cssText = [
        'position:fixed',
        'top:160px',
        'right:24px',
        'max-width:260px',
        'padding:10px 14px',
        'border-radius:10px',
        'font:13px/1.4 system-ui,sans-serif',
        'box-shadow:0 4px 14px rgba(0,0,0,.25)',
        'z-index:2147483647',
        'transition:opacity .2s ease'
      ].join(';');
      document.body.appendChild(status);
    }
    status.textContent = message;
    status.style.background = isError ? '#fdecea' : '#eaf7e6';
    status.style.color = isError ? '#a13a2f' : '#2f6b1f';
    status.style.border = '1px solid ' + (isError ? '#e2a49b' : '#a9d99b');
    status.style.opacity = '1';
    clearTimeout(showStatus._timer);
    showStatus._timer = setTimeout(() => { status.style.opacity = '0'; }, 6000);
  }

  function runSyncSteps() {
    for (const step of SYNC_STEPS) {
      const ok = step.run();
      const msg = (ok ? '✅ ' : '❌ ') + step.name + (ok ? '' : ' — no se encontró el elemento');
      console.log('[Ingeurbe ACC Sync] ' + msg);
      showStatus(msg, !ok);
      if (!ok) break;
    }
  }

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
    btn.title = 'Sincronizar programación con GitHub';
    btn.style.cssText = [
      'position:fixed',
      'top:64px',
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

    btn.addEventListener('click', runSyncSteps);

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
