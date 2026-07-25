// popup.js
// Orchestrates the whole flow when the user clicks "Summarize this page":
//   1. Find the active tab.
//   2. Inject a small function into that page to pull out its text.
//   3. Run the local summarizer on that text.
//   4. Render the result in the popup.

console.log("[Summarize][popup] popup.js loaded, UI ready");

const els = {
  button: document.getElementById("summarize"),
  status: document.getElementById("status"),
  result: document.getElementById("result"),
  summary: document.getElementById("summary"),
  metaText: document.getElementById("meta-text"),
  copy: document.getElementById("copy"),
  points: document.getElementById("points"),
};

// This function is serialized and injected INTO the web page by
// chrome.scripting.executeScript. It runs in the page's context, so it
// can read the DOM. It must be self-contained (no outside variables).
function extractPageText() {
  // NOTE: this runs in the PAGE, so this log appears in the *page's* console.
  console.log("[Summarize][page] extractPageText running inside the page");
  // Prefer the <article> or <main> region if the page has one.
  const container =
    document.querySelector("article") ||
    document.querySelector("main") ||
    document.body;

  // Clone so we can strip noise without touching the real page.
  const clone = container.cloneNode(true);
  clone
    .querySelectorAll("script, style, nav, header, footer, aside, noscript")
    .forEach((el) => el.remove());

  const text = clone.innerText || "";
  console.log("[Summarize][page] extracted characters:", text.length);
  return {
    title: document.title,
    text: text.replace(/\s+/g, " ").trim(),
  };
}

function setStatus(message, isError = false) {
  els.status.textContent = message;
  els.status.classList.toggle("error", isError);
  els.status.classList.toggle("hidden", !message);
}

function renderSummary(points, wordCount, engine) {
  els.summary.innerHTML = "";
  for (const point of points) {
    const li = document.createElement("li");
    li.textContent = point;
    els.summary.appendChild(li);
  }
  const engineLabel = engine === "ai" ? "🤖 on-device AI" : "⚙️ local";
  els.metaText.textContent = `${points.length} points · ${engineLabel} · from ${wordCount} words`;
  els.result.classList.remove("hidden");
}

// Try on-device AI first; fall back to the local extractive summarizer.
async function summarizePage(text, count) {
  try {
    if (window.PageAI && window.PageAI.isPromptApiSupported()) {
      console.log("[Summarize][popup] Step 5a: trying on-device AI");
      setStatus("Summarizing with on-device AI…");
      const points = await window.PageAI.summarizeWithAI(text, count, (pct) => {
        setStatus(`Downloading AI model… ${pct}%`);
      });
      return { points, engine: "ai" };
    }
    console.log("[Summarize][popup] Step 5a: Prompt API not supported, using local");
  } catch (err) {
    console.warn("[Summarize][popup] AI failed, falling back to local:", err.message);
  }

  console.log("[Summarize][popup] Step 5b: using local summarizer");
  setStatus("Summarizing locally…");
  const points = window.PageSummarizer.summarize(text, count);
  return { points, engine: "local" };
}

async function handleSummarize() {
  els.button.disabled = true;
  els.result.classList.add("hidden");
  setStatus("Reading the page…");
  console.log("[Summarize][popup] Step 1: button clicked, finding active tab");

  try {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
    console.log("[Summarize][popup] Step 2: active tab is", tab && tab.url);

    if (!tab || !tab.id || /^(chrome|edge|about|chrome-extension):/.test(tab.url || "")) {
      throw new Error("This page can't be summarized. Try a normal website.");
    }

    // Inject and run extractPageText() inside the target tab.
    console.log("[Summarize][popup] Step 3: injecting extractPageText into the page");
    const [injection] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: extractPageText,
    });

    const { title, text } = injection.result || {};
    const wordCount = text ? text.split(/\s+/).length : 0;
    console.log("[Summarize][popup] Step 4: got text back,", wordCount, "words");

    if (!text || wordCount < 40) {
      throw new Error("Not enough readable text on this page.");
    }

    const count = parseInt(els.points.value, 10);
    console.log("[Summarize][popup] Step 5: summarizing into", count, "points");
    const { points, engine } = await summarizePage(text, count);

    setStatus("");
    renderSummary(points, wordCount, engine);
    console.log("[Summarize][popup] Step 6: rendered", points.length, "points via", engine);

    // Remember the last summary so the copy button works.
    els._lastSummary = `${title}\n\n- ${points.join("\n- ")}`;
  } catch (err) {
    console.warn("[Summarize][popup] error:", err.message);
    setStatus(err.message || "Something went wrong.", true);
  } finally {
    els.button.disabled = false;
  }
}

async function handleCopy() {
  if (!els._lastSummary) return;
  await navigator.clipboard.writeText(els._lastSummary);
  els.copy.textContent = "Copied!";
  setTimeout(() => (els.copy.textContent = "Copy"), 1200);
}

els.button.addEventListener("click", handleSummarize);
els.copy.addEventListener("click", handleCopy);
