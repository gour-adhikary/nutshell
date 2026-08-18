# 🌰 Nutshell — the entire web, in a nutshell

A Manifest V3 Chrome/Edge extension that cracks any web page open into
**3, 5 or 10 key points**. It uses Chrome's built-in **on-device AI** (the
Prompt API / Gemini Nano — no API key, runs locally), and automatically falls
back to a **local extractive summarizer** when on-device AI isn't available.

After a summary, you can **ask follow-up questions about the page**. The page
stays in context, so you can just ask *"who wrote this?"* or *"what's the main
takeaway?"* without re-pasting anything — the AI answers straight from the page.

## Load it in your browser (Chrome or Edge)

1. Go to `chrome://extensions` (or `edge://extensions`).
2. Turn on **Developer mode** (top-right toggle).
3. Click **Load unpacked** and select this folder (`xtnsions`).
4. Pin the extension, open any article, click the icon → **Summarize**, then
   use the **Ask about this page** box to ask follow-up questions.

After editing code, click the **reload** ↻ icon on the extension card.

## How it works (the parts you're learning)

```
manifest.json          → declares the extension: name, permissions, popup, worker
background.js          → service worker (MV3): background events, message handling
popup/popup.html      → the UI shown when you click the toolbar icon
popup/popup.css       → styling for the popup
popup/popup.js        → orchestrates: get tab → inject extractor → summarize → render
popup/ai.js           → on-device AI (Chrome Prompt API / Gemini Nano) — no key
popup/summarizer.js   → local extractive fallback (pure logic)
icons/                → toolbar icons
```

### The flow, step by step
1. **popup.js** finds the active tab with `chrome.tabs.query`.
2. It injects `extractPageText()` into that page using
   `chrome.scripting.executeScript`. That injected function runs *in the page*,
   reads the DOM (`<article>`/`<main>`), strips nav/script/style noise, and
   returns the text.
3. **AI summarization** (`ai.js`): first it tries Chrome's built-in **Prompt
   API** (Gemini Nano), which runs **on your device with no API key and no
   network call**. It prompts the model for exactly N key points.
4. **Fallback** (`summarizer.js`): if on-device AI isn't available, it uses a
   local *extractive* algorithm that scores sentences and picks the top N.
   Either way you get N points; the popup shows which engine was used.
5. **popup.js** renders the points and wires up the Copy button.
6. **Follow-up chat** (`ai.js` + `popup.js`): the on-device AI session is kept
   alive with the page text baked in as its system context. After the summary,
   an "Ask about this page" box appears — every question you type reuses that
   same session, so the model already knows the page. You just ask
   *"who wrote this?"* and it answers from the page. No re-pasting, no long
   prompts. (This chat only appears when the on-device AI ran, not the local
   fallback, since the fallback has no conversational model.)

   > Note: the on-device model answers **only from the page + its training** —
   > it does **not** search the web.

### Key concepts this project demonstrates
- `manifest.json` structure (Manifest V3)
- **Permissions**: `activeTab`, `scripting`, `storage`
- **Popup UI** (action popup)
- **Script injection** into a page (`chrome.scripting`)
- **Service worker** lifecycle + message passing (`chrome.runtime`)
- Reading the page DOM safely from an injected function
- **On-device AI** via the built-in Prompt API (Gemini Nano)

## Enabling on-device AI (no API key)

The AI runs locally via Chrome's Prompt API. To use it you need:

- **Desktop Chrome 138+** (Windows/macOS 13+/Linux/Chromebook Plus)
- A supported GPU and enough free disk (the model is ~2GB, downloaded once)
- Depending on your build, enable these flags then restart Chrome:
  - `chrome://flags/#prompt-api-for-gemini-nano` → **Enabled**
  - `chrome://flags/#optimization-guide-on-device-model` → **Enabled BypassPerfRequirement**

The **first** summarize click may download the model (you'll see a
"Downloading AI model… %" status). If any requirement is missing, the extension
automatically falls back to the local summarizer — it always works.

> Watch the on-device AI logs (`[Summarize][ai] …`) in the **popup's** Inspect
> console. In production you'd also register an [origin trial token] and add it
> to `manifest.json` as `"trial_tokens"`.

[origin trial token]: https://developer.chrome.com/docs/web-platform/origin-trials/

## Ideas to extend it
- Summarize only the **selected** text.
- Add a **keyboard shortcut** (`commands` in the manifest).
- Add an **options page** for default point count and theme.
- Cache summaries per URL with `chrome.storage`.
- Use `promptStreaming()` to show points appearing live as the model writes.
