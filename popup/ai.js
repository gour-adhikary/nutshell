// ai.js
// Wraps Chrome's built-in, ON-DEVICE AI (the Prompt API, powered by Gemini Nano).
// There is NO API key and NO network call — the model runs locally in Chrome.
//
// Requirements (why we always keep a fallback):
//   - Desktop Chrome 138+ (Windows/macOS/Linux/Chromebook Plus)
//   - Enough disk + a supported GPU; the model downloads once (~2GB)
//   - Flags/origin-trial may be needed depending on your Chrome build:
//       chrome://flags/#prompt-api-for-gemini-nano
//       chrome://flags/#optimization-guide-on-device-model
//
// If any of that isn't met, summarizeWithAI() throws and popup.js falls back
// to the local extractive summarizer in summarizer.js.

const MAX_INPUT_CHARS = 6000; // keep within the small on-device context window

// The live session for the current page. Seeded with the page text on
// summarize, then reused for follow-up questions so context persists.
let activeSession = null;

// Is the Prompt API even present in this browser?
function isPromptApiSupported() {
  return typeof LanguageModel !== "undefined";
}

// "unavailable" | "downloadable" | "downloading" | "available"
async function getAvailability() {
  if (!isPromptApiSupported()) return "unavailable";
  try {
    return await LanguageModel.availability();
  } catch {
    return "unavailable";
  }
}

// Strip bullets/numbering the model may add, and keep exactly `max` lines.
function parsePoints(text, max) {
  const lines = text
    .split("\n")
    .map((line) => line.replace(/^\s*[-*•\u2022\d.)\]]+\s*/, "").trim())
    .filter(Boolean);
  return lines.slice(0, max);
}

/**
 * Summarize text into exactly `points` bullet points using on-device AI.
 * Keeps the session alive (seeded with the page) so the user can ask
 * follow-up questions afterwards via ask().
 * @param {string} text
 * @param {number} points        3, 5 or 10
 * @param {(pct:number)=>void} onProgress  called with download % on first run
 * @returns {Promise<string[]>}
 */
async function summarizeWithAI(text, points, onProgress) {
  if (!isPromptApiSupported()) {
    throw new Error("Prompt API not supported in this browser.");
  }

  const availability = await LanguageModel.availability();
  console.log("[Summarize][ai] availability:", availability);
  if (availability === "unavailable") {
    throw new Error("On-device AI is unavailable on this device.");
  }

  // Close any previous page's session before starting a new one.
  endSession();

  const clippedContext =
    text.length > MAX_INPUT_CHARS ? text.slice(0, MAX_INPUT_CHARS) : text;

  // create() will download the model on first use (needs the user click we already have).
  // The page text is baked in as a system prompt so it stays as context for
  // both the summary AND every follow-up question on this session.
  const session = await LanguageModel.create({
    initialPrompts: [
      {
        role: "system",
        content:
          "You are Nutshell, a helpful assistant. Answer using ONLY the web " +
          "page content provided below. If the answer is not in the page, say " +
          "you couldn't find it on this page. Be concise.\n\n" +
          "WEB PAGE CONTENT:\n" +
          clippedContext,
      },
    ],
    monitor(m) {
      m.addEventListener("downloadprogress", (e) => {
        const pct = Math.round(e.loaded * 100);
        console.log("[Summarize][ai] model download:", pct + "%");
        if (onProgress) onProgress(pct);
      });
    },
  });

  const prompt =
    `Summarize the web page into exactly ${points} key points.\n` +
    `Rules:\n` +
    `- Output ONLY the ${points} points, nothing else.\n` +
    `- One point per line, each starting with "- ".\n` +
    `- Keep each point to a single concise sentence.`;

  let output;
  try {
    console.log("[Summarize][ai] prompting on-device model…");
    output = await session.prompt(prompt);
  } catch (err) {
    session.destroy();
    throw err;
  }

  // Keep the session alive for follow-up questions (do NOT destroy here).
  activeSession = session;

  const parsed = parsePoints(output, points);
  if (parsed.length === 0) {
    throw new Error("AI returned no usable points.");
  }
  return parsed;
}

/**
 * Ask a follow-up question. Reuses the session from the last summary, so the
 * page is already in context — the user doesn't need to repeat anything.
 * @param {string} question
 * @returns {Promise<string>}
 */
async function ask(question) {
  if (!activeSession) {
    throw new Error("Ask isn't available — summarize a page with AI first.");
  }
  console.log("[Nutshell][ai] follow-up question:", question);
  return activeSession.prompt(question);
}

// True when a page-context session exists (i.e. follow-ups are possible).
function canAsk() {
  return !!activeSession;
}

// Free the on-device model session.
function endSession() {
  if (activeSession) {
    try {
      activeSession.destroy();
    } catch {}
    activeSession = null;
  }
}

// Expose to popup.js
window.PageAI = {
  isPromptApiSupported,
  getAvailability,
  summarizeWithAI,
  ask,
  canAsk,
  endSession,
};
