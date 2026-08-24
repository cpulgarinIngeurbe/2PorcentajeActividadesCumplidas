// Service worker en segundo plano de la extension. Se encarga de las
// llamadas de red que el content script no puede hacer de forma confiable
// (estan sujetas a la politica de seguridad -CSP- de la pagina de ACC): bajar
// el archivo de la programacion y subirlo al repositorio de GitHub.

// El token de GitHub NO se escribe aqui (GitHub bloquea el push si detecta
// un secreto en el codigo). Se guarda una sola vez desde la pagina de
// opciones de la extension, en chrome.storage.local -- queda solo en este
// navegador, nunca en el repositorio.
const GITHUB_REPO = 'cpulgarinIngeurbe/2PorcentajeActividadesCumplidas';

async function getGithubToken() {
  const { githubToken } = await chrome.storage.local.get('githubToken');
  return githubToken || null;
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

async function getFileSha(path, token) {
  const res = await fetch('https://api.github.com/repos/' + GITHUB_REPO + '/contents/' + path, {
    headers: { Authorization: 'Bearer ' + token }
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data.sha || null;
}

async function uploadFileToGitHub(path, base64Content, message, token) {
  // Se relee el sha en cada intento por si otro guardado lo movio mientras
  // tanto (mismo patron de reintento que ya usa la app web).
  let lastError = 'Desconocido';
  for (let attempt = 1; attempt <= 3; attempt++) {
    const sha = await getFileSha(path, token);
    const body = { message: message, content: base64Content, branch: 'main' };
    if (sha) body.sha = sha;

    const res = await fetch('https://api.github.com/repos/' + GITHUB_REPO + '/contents/' + path, {
      method: 'PUT',
      headers: {
        Authorization: 'Bearer ' + token,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });
    if (res.ok) return true;

    const err = await res.json().catch(() => ({}));
    lastError = err.message || ('HTTP ' + res.status);
    const isConflict = res.status === 409 || res.status === 422 || /but expected|sha/i.test(lastError);
    if (isConflict && attempt < 3) {
      await new Promise((r) => setTimeout(r, 600 * attempt));
      continue;
    }
    throw new Error(lastError);
  }
  throw new Error(lastError);
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || msg.type !== 'UPLOAD_SCHEDULE_FILE') return;

  (async () => {
    try {
      const token = await getGithubToken();
      if (!token) {
        throw new Error('Falta configurar el token de GitHub. Clic derecho en el ícono de la extensión → Opciones.');
      }

      let base64 = msg.base64 || null;
      if (!base64) {
        if (!msg.url) throw new Error('Sin URL ni contenido para subir.');
        const fileRes = await fetch(msg.url);
        if (!fileRes.ok) throw new Error('No se pudo descargar el archivo (HTTP ' + fileRes.status + ').');
        const buffer = await fileRes.arrayBuffer();
        base64 = arrayBufferToBase64(buffer);
      }
      const path = 'data/' + msg.filename;
      await uploadFileToGitHub(path, base64, 'Sincroniza ' + msg.filename + ' desde ACC (extensión)', token);
      sendResponse({ ok: true, path: path });
    } catch (e) {
      sendResponse({ ok: false, error: e.message });
    }
  })();

  return true; // mantiene abierto el canal para la respuesta asincrona
});
