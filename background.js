// background.js — the extension's service worker (Manifest V3).
// In MV3 this runs on-demand (it is NOT always alive). It's the right place
// for events that must work even when the popup is closed.
//
// Right now it just logs lifecycle events so you can see when it runs.
// Open chrome://extensions → this extension → "service worker" to view logs.

chrome.runtime.onInstalled.addListener((details) => {
  console.log(`[Summarize] Installed/updated: ${details.reason}`);
});

// Example of listening for messages from the popup or content scripts.
// (The current popup does its work directly, but this shows the pattern
// you'd use for bigger features, e.g. calling a real AI API from here.)
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "ping") {
    sendResponse({ type: "pong", at: Date.now() });
  }
  // Return true here if you ever respond asynchronously.
});
