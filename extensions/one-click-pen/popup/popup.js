document.getElementById('toggleBtn').addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.id) {
    chrome.runtime.sendMessage({ action: 'togglePen' }, () => {
      window.close();
    });
  }
});
