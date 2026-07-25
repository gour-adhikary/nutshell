// summarizer.js
// A simple *extractive* summarizer: it does NOT invent new text.
// It scores each sentence by how many important words it contains,
// then returns the top-N highest-scoring sentences in original order.
//
// This is intentionally dependency-free so you can read every line.
// Later, you can replace `summarize()` with a call to a real AI API.

// Very common English words we ignore when scoring ("stop words").
const STOP_WORDS = new Set(
  ("a about above after again against all am an and any are aren't as at be " +
    "because been before being below between both but by can't cannot could " +
    "couldn't did didn't do does doesn't doing don't down during each few for " +
    "from further had hadn't has hasn't have haven't having he he'd he'll he's " +
    "her here here's hers herself him himself his how how's i i'd i'll i'm i've " +
    "if in into is isn't it it's its itself let's me more most mustn't my myself " +
    "no nor not of off on once only or other ought our ours ourselves out over " +
    "own same shan't she she'd she'll she's should shouldn't so some such than " +
    "that that's the their theirs them themselves then there there's these they " +
    "they'd they'll they're they've this those through to too under until up very " +
    "was wasn't we we'd we'll we're we've were weren't what what's when when's " +
    "where where's which while who who's whom why why's with won't would wouldn't " +
    "you you'd you'll you're you've your yours yourself yourselves").split(/\s+/)
);

// Break raw text into sentences. Not perfect, but good enough to learn with.
function splitSentences(text) {
  return text
    .replace(/\s+/g, " ")
    .match(/[^.!?]+[.!?]+|\S[^.!?]*$/g) || [];
}

// Turn a string into an array of lowercase word tokens.
function tokenize(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

/**
 * Summarize text into `count` key sentences.
 * @param {string} text  The full page text.
 * @param {number} count How many sentences to return.
 * @returns {string[]}   Selected sentences in original order.
 */
function summarize(text, count = 3) {
  console.log("[Summarize][popup] summarizer.js: scoring sentences from", text.length, "chars");
  const sentences = splitSentences(text)
    .map((s) => s.trim())
    .filter((s) => s.split(/\s+/).length >= 4); // drop tiny fragments

  if (sentences.length <= count) return sentences;

  // 1. Build a frequency map of meaningful words across the whole document.
  const freq = {};
  for (const sentence of sentences) {
    for (const word of tokenize(sentence)) {
      if (STOP_WORDS.has(word) || word.length < 3) continue;
      freq[word] = (freq[word] || 0) + 1;
    }
  }

  // 2. Score each sentence = sum of its word frequencies / sentence length.
  //    Dividing by length stops very long sentences from always winning.
  const scored = sentences.map((sentence, index) => {
    const words = tokenize(sentence);
    let score = 0;
    for (const word of words) {
      if (freq[word]) score += freq[word];
    }
    return { sentence, index, score: score / Math.max(words.length, 1) };
  });

  // 3. Take the top `count` by score, then restore original reading order.
  const top = [...scored]
    .sort((a, b) => b.score - a.score)
    .slice(0, count)
    .sort((a, b) => a.index - b.index)
    .map((item) => item.sentence);

  return top;
}

// Expose to popup.js (this file loads first via a <script> tag).
window.PageSummarizer = { summarize };
