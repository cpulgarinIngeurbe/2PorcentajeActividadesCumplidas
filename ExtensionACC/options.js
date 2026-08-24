const tokenInput = document.getElementById('token');
const status = document.getElementById('status');

chrome.storage.local.get('githubToken').then(({ githubToken }) => {
  if (githubToken) tokenInput.value = githubToken;
});

document.getElementById('save').addEventListener('click', async () => {
  const value = tokenInput.value.trim();
  if (!value) {
    status.textContent = 'Escribe un token antes de guardar.';
    status.className = 'error';
    return;
  }
  await chrome.storage.local.set({ githubToken: value });
  status.textContent = '✅ Token guardado.';
  status.className = 'ok';
});
