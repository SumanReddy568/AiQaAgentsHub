import { addApiCall, initDB } from "../db.js";

/**
 * Logs a tech news API call for dashboard tracking.
 * @param {Object} options
 * @param {number} duration - Duration in ms
 * @param {number} count - Number of news items fetched
 * @param {number} totalTokens - (optional) Total tokens used
 * @param {number} promptTokens - (optional) Prompt tokens
 * @param {number} responseTokens - (optional) Response tokens
 */
export async function logTechNewsApiCall({
  duration = 0,
  count = 0,
  totalTokens = 0,
  promptTokens = 0,
  responseTokens = 0,
} = {}) {
  await initDB();
  await addApiCall({
    timestamp: new Date(),
    model: "external-news",
    totalTokens,
    promptTokens,
    responseTokens,
    locatorsGenerated: count,
    type: "technews",
    duration,
  }).catch((err) => console.error("DB save failed (technews):", err));
}
