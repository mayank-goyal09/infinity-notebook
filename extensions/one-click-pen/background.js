// Infinity Pen - Background Service Worker (Manifest V3)

chrome.commands.onCommand.addListener(async (command) => {
  if (command === 'toggle-pen') {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab && tab.id) {
      togglePenOnTab(tab.id);
    }
  }
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'togglePen') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) {
        togglePenOnTab(tabs[0].id);
        sendResponse({ success: true });
      }
    });
    return true;
  }
});

async function togglePenOnTab(tabId) {
  try {
    await chrome.scripting.insertCSS({
      target: { tabId },
      files: ['content/overlay.css']
    });

    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['content/overlay.js']
    });

    // Send toggle message
    chrome.tabs.sendMessage(tabId, { action: 'toggleInfinityPen' }).catch(() => {
      // Content script will handle auto-mount upon initial injection
    });
  } catch (err) {
    console.error('Infinity Pen failed to inject:', err);
  }
}
