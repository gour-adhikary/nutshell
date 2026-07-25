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

  // create() will download the model on first use (needs the user click we already have).
  const session = await LanguageModel.create({
    monitor(m) {
      m.addEventListener("downloadprogress", (e) => {
        const pct = Math.round(e.loaded * 100);
        console.log("[Summarize][ai] model download:", pct + "%");
        if (onProgress) onProgress(pct);
      });
    },
  });

  const clipped =
    text.length > MAX_INPUT_CHARS ? text.slice(0, MAX_INPUT_CHARS) : text;

  const prompt =
    `Summarize the following web page content into exactly ${points} key points.\n` +
    `Rules:\n` +
    `- Output ONLY the ${points} points, nothing else.\n` +
    `- One point per line, each starting with "- ".\n` +
    `- Keep each point to a single concise sentence.\n\n` +
    `CONTENT:\n${clipped}`;

  let output;
  try {
    console.log("[Summarize][ai] prompting on-device model…");
    output = await session.prompt(prompt);
  } finally {
    session.destroy(); // always free the model resources
  }

  const parsed = parsePoints(output, points);
  if (parsed.length === 0) {
    throw new Error("AI returned no usable points.");
  }
  return parsed;
}

// Expose to popup.js
window.PageAI = { isPromptApiSupported, getAvailability, summarizeWithAI };
