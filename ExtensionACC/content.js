// Botón flotante de sincronización ACC -> GitHub.
// La secuencia de acciones que ejecuta el boton se arma paso a paso: cada
// paso nuevo que se indique se agrega como una entrada mas en SYNC_STEPS.
(function () {
  const BUTTON_ID = 'ingeurbe-acc-sync-btn';

  // Intercepta cualquier descarga que dispare la pagina, para mas adelante
  // poder leer sus bytes y subirlos a GitHub en vez de solo guardarlos en
  // disco. Una descarga en la web se genera de dos formas: (a) un blob:
  // creado en memoria via URL.createObjectURL, o (b) un enlace <a> con
  // href/download apuntando a una URL real. Se detectan ambos casos.
  let lastCapturedDownload = null; // { type: 'blob'|'url', value, blob? }
  let lastUploadResult = null; // { ok, path } | { ok: false, error }

  const origCreateObjectURL = URL.createObjectURL.bind(URL);
  URL.createObjectURL = function (obj) {
    const url = origCreateObjectURL(obj);
    lastCapturedDownload = { type: 'blob', value: url, blob: obj };
    return url;
  };

  // Fase de captura (el "true" final): para enterarnos del clic ANTES de
  // que el navegador procese la descarga, no despues.
  document.addEventListener('click', (ev) => {
    const a = ev.target && ev.target.closest && ev.target.closest('a[download], a[href^="blob:"], a[href^="http"]');
    if (a && a.href) {
      lastCapturedDownload = { type: 'url', value: a.href };
    }
  }, true);

  // Espera hasta que aparezca un elemento en el DOM (ACC es una SPA: al
  // navegar de una vista a otra, el contenido nuevo tarda un instante en
  // renderizarse). "selectorOrFn" puede ser un selector CSS o una funcion
  // que devuelva el elemento (util para tomar "el primero de varios").
  function waitForElement(selectorOrFn, timeoutMs, intervalMs) {
    timeoutMs = timeoutMs || 6000;
    intervalMs = intervalMs || 150;
    const find = typeof selectorOrFn === 'function' ? selectorOrFn : () => document.querySelector(selectorOrFn);
    return new Promise((resolve) => {
      const start = Date.now();
      (function poll() {
        const el = find();
        if (el) return resolve(el);
        if (Date.now() - start >= timeoutMs) return resolve(null);
        setTimeout(poll, intervalMs);
      })();
    });
  }

  // Simula un clic real disparando el evento de mouse directamente. Los
  // elementos SVG (como los iconos de boton que usa ACC) no tienen metodo
  // .click() -- solo lo tienen los elementos HTML -- asi que hay que usar
  // dispatchEvent para que funcione con cualquier tipo de elemento.
  function clickElement(el) {
    el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
  }

  function arrayBufferToBase64(buffer) {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const chunkSize = 0x8000;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunkSize));
    }
    return btoa(binary);
  }

  // Saca el nombre de archivo del parametro "response-content-disposition"
  // de la URL firmada de ACC (ej. "...filename*=utf-8''ProyectoNativa.mpp").
  function extractFilenameFromUrl(url) {
    try {
      const disposition = new URL(url).searchParams.get('response-content-disposition');
      if (!disposition) return null;
      let m = /filename\*=(?:UTF-8|utf-8)''([^;]+)/.exec(disposition);
      if (m) return decodeURIComponent(m[1]);
      m = /filename="?([^";]+)"?/.exec(disposition);
      if (m) return m[1];
    } catch (e) { /* URL invalida, se usa el nombre por defecto */ }
    return null;
  }

  // Pasos de navegacion/interaccion que se ejecutan al oprimir el boton,
  // en orden. Por ahora solo navegacion (sin descargar/leer datos todavia).
  const SYNC_STEPS = [
    {
      name: 'Clic en "Schedules"',
      run: async () => {
        // El "for" del label es un id generado dinamicamente por ACC
        // (ej. "alloy-tag-6") y puede cambiar entre cargas; el
        // data-testid es estable y no depende de ese id.
        const label = await waitForElement('[data-testid="TimelinesView__toolbar-groups--schedules"]');
        if (!label) {
          console.warn('[Ingeurbe ACC Sync] No se encontró el elemento "Schedules" (data-testid).');
          return false;
        }
        clickElement(label);
        return true;
      }
    },
    {
      name: 'Seleccionar el primer elemento de la lista',
      run: async () => {
        // Cada fila tiene un data-testid "HomePageNameCell-<uuid>" (el uuid
        // cambia por proyecto/schedule), asi que se busca la primera que
        // empiece con ese prefijo, en el orden en que aparece en la lista.
        const row = await waitForElement(() => document.querySelector('[data-testid^="HomePageNameCell-"]'));
        if (!row) {
          console.warn('[Ingeurbe ACC Sync] No se encontraron filas ("HomePageNameCell-*").');
          return false;
        }
        clickElement(row);
        return true;
      }
    },
    {
      name: 'Abrir el selector de versión',
      run: async () => {
        // Al seleccionar la fila anterior, ACC navega a la vista del
        // cronograma; ese cambio de vista puede tardar un instante en
        // renderizarse, por eso se espera a que aparezca este boton.
        const btn = await waitForElement('[data-testid="ScheduleHeaderCaption__version"]');
        if (!btn) {
          console.warn('[Ingeurbe ACC Sync] No se encontró el botón de versión ("ScheduleHeaderCaption__version").');
          return false;
        }
        clickElement(btn);
        return true;
      }
    },
    {
      name: 'Clic en el botón de descarga',
      run: async () => {
        lastCapturedDownload = null;
        const btn = await waitForElement('[data-testid="download"]');
        if (!btn) {
          console.warn('[Ingeurbe ACC Sync] No se encontró el botón de descarga ("download").');
          return false;
        }
        clickElement(btn);
        return true;
      }
    },
    {
      name: 'Detectar el archivo descargado',
      run: async () => {
        // Se da un margen para que la descarga real se dispare tras el
        // clic anterior (puede tardar un poco en generarse en el backend).
        for (let i = 0; i < 20 && !lastCapturedDownload; i++) {
          await new Promise((r) => setTimeout(r, 250));
        }
        if (!lastCapturedDownload) {
          console.warn('[Ingeurbe ACC Sync] No se detectó ninguna descarga (ni blob ni enlace).');
          return false;
        }
        console.log('[Ingeurbe ACC Sync] Descarga detectada:', lastCapturedDownload.type, lastCapturedDownload.value);
        return true;
      },
      // Mensaje mas detallado que el generico, para poder leer el tipo/URL
      // detectado sin depender de la consola.
      statusMessage: () => lastCapturedDownload
        ? ('Detectada (' + lastCapturedDownload.type + '): ' + lastCapturedDownload.value)
        : null
    },
    {
      name: 'Subir el archivo a GitHub',
      run: async () => {
        if (!lastCapturedDownload) return false;
        const rawFilename = extractFilenameFromUrl(lastCapturedDownload.value) || 'ProyectoDescargado.mpp';
        // Prefijo para identificar que este archivo viene de la
        // sincronizacion con ACC (y no de una subida manual del .mpp).
        const filename = 'ACC-' + rawFilename;

        let message;
        if (lastCapturedDownload.type === 'blob') {
          // Un blob: solo es valido en esta misma pestana, asi que hay que
          // leerlo aqui (el segundo plano no puede acceder a el) y mandar
          // el contenido ya codificado en vez de la URL.
          const res = await fetch(lastCapturedDownload.value);
          const buffer = await res.arrayBuffer();
          const base64 = arrayBufferToBase64(buffer);
          message = { type: 'UPLOAD_SCHEDULE_FILE', filename: filename, base64: base64 };
        } else {
          // URL http(s) normal: el segundo plano la puede pedir directo,
          // sin las restricciones de seguridad de la pagina de ACC.
          message = { type: 'UPLOAD_SCHEDULE_FILE', filename: filename, url: lastCapturedDownload.value };
        }

        const response = await chrome.runtime.sendMessage(message);
        lastUploadResult = response;
        if (!response || !response.ok) {
          console.warn('[Ingeurbe ACC Sync] Error subiendo a GitHub:', response && response.error);
          return false;
        }
        return true;
      },
      statusMessage: () => lastUploadResult && lastUploadResult.ok
        ? ('Guardado en el repositorio: ' + lastUploadResult.path)
        : null,
      errorMessage: () => !lastCapturedDownload
        ? 'no hay ninguna descarga detectada'
        : (lastUploadResult && lastUploadResult.error) || 'no se pudo conectar con la extensión (¿está recién instalada/actualizada? recarga la página)'
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
        'max-width:380px',
        'padding:10px 14px',
        'border-radius:10px',
        'font:13px/1.4 system-ui,sans-serif',
        'box-shadow:0 4px 14px rgba(0,0,0,.25)',
        'z-index:2147483647',
        'transition:opacity .2s ease',
        'white-space:pre-line',
        'word-break:break-all',
        'user-select:text'
      ].join(';');
      document.body.appendChild(status);
    }
    status.textContent = message;
    status.style.background = isError ? '#fdecea' : '#eaf7e6';
    status.style.color = isError ? '#a13a2f' : '#2f6b1f';
    status.style.border = '1px solid ' + (isError ? '#e2a49b' : '#a9d99b');
    status.style.opacity = '1';
    clearTimeout(showStatus._timer);
    showStatus._timer = setTimeout(() => { status.style.opacity = '0'; }, 15000);
  }

  async function runSyncSteps() {
    for (const step of SYNC_STEPS) {
      let ok, thrown;
      try {
        ok = await step.run();
      } catch (e) {
        ok = false;
        thrown = e;
      }
      let msg;
      if (ok) {
        const detail = step.statusMessage ? step.statusMessage() : null;
        msg = '✅ ' + step.name + (detail ? '\n' + detail : '');
      } else {
        const detail = thrown ? thrown.message : (step.errorMessage ? step.errorMessage() : null);
        msg = '❌ ' + step.name + ' — ' + (detail || 'no se encontró el elemento');
      }
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
