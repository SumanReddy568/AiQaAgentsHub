const fs = require("fs");
const path = require("path");
const { GoogleGenerativeAI } = require("@google/generative-ai");

// Cache file location
const CACHE_FILE = path.join(__dirname, "../data/news-cache.json");

/* -------------------------------------------------------
 *  Discord Webhook Validator
 * -----------------------------------------------------*/
async function validateWebhook() {
  try {
    const response = await fetch(process.env.DISCORD_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content: `🔄 @everyone AI Started Fetching latest tech news... (${new Date().toLocaleString('en-US', {
          dateStyle: 'medium',
          timeStyle: 'short',
          timeZone: 'Asia/Kolkata'
        })})`
      })
    });

    if (!response.ok) throw new Error(`Webhook test failed: ${response.status}`);

    console.log("✅ Discord webhook validated");
    return true;
  } catch (err) {
    console.error("❌ Webhook validation failed:", err);
    return false;
  }
}

/* -------------------------------------------------------
 *  Load previous headlines for exclusion
 * -----------------------------------------------------*/
function loadPreviousNews() {
  try {
    fs.mkdirSync(path.dirname(CACHE_FILE), { recursive: true });

    if (!fs.existsSync(CACHE_FILE)) {
      fs.writeFileSync(CACHE_FILE, JSON.stringify([], null, 2));
      return [];
    }

    const data = JSON.parse(fs.readFileSync(CACHE_FILE, "utf-8"));
    return Array.isArray(data) ? data.map(entry => entry.headline) : [];
  } catch {
    return [];
  }
}

/* -------------------------------------------------------
 *  Save new headlines
 * -----------------------------------------------------*/
function saveCurrentNews(items) {
  try {
    let cache = [];
    try {
      cache = JSON.parse(fs.readFileSync(CACHE_FILE, "utf-8"));
    } catch {
      cache = [];
    }

    const timestamp = new Date().toISOString();
    const entries = items.map(n => ({
      date: timestamp,
      headline: n.title,
      source: n.source
    }));

    const merged = [...cache, ...entries];
    fs.writeFileSync(CACHE_FILE, JSON.stringify(merged, null, 2));

    console.log("💾 Cache updated");
  } catch (e) {
    console.error("⚠️ Cache write failed:", e);
  }
}

/* -------------------------------------------------------
 *  UNIVERSAL STRICT REAL-NEWS PROMPT
 * -----------------------------------------------------*/
function buildNewsPrompt(previousHeadlines, count) {
  return `
You are a strict real-time technology news analyst. Your task is to return ONLY 100% real, verifiable tech news stories from the last 24 hours — NOT AI-generated or fabricated items.

RULES:
1. NO hallucinated URLs — use only real, existing articles.
2. NO made-up events — every story must match a real published article.
3. Include diverse categories:
   - AI/ML
   - Developer tools
   - Cloud/DevOps
   - Cybersecurity
   - Data/Analytics
   - Open source
   - Tech industry
   - Hardware/Chips

4. EXCLUDE these previously used headlines:
${previousHeadlines.slice(0, 30).map(h => `- ${h}`).join("\n")}

5. RETURN EXACTLY ${count} NEWS ITEMS.

FORMAT STRICTLY:
[
  {
    "title": "Exact real headline",
    "summary": "Real article summary with accurate details only",
    "impact": "Explain impact for engineers/devs",
    "source": "Real, valid article URL"
  }
]

NO markdown. NO commentary. JSON only.
  `;
}

/* -------------------------------------------------------
 *  Gemini Fetcher - 15 news
 * -----------------------------------------------------*/
async function fetchNewsWithGemini(previousHeadlines) {
  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-pro" });

    console.log("🤖 Fetching from Gemini...");

    const prompt = buildNewsPrompt(previousHeadlines, 15);
    const result = await model.generateContent(prompt);

    const text = result.response.text().trim();
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) throw new Error("Gemini: No valid JSON found");

    const items = JSON.parse(jsonMatch[0]);
    console.log(`✅ Gemini returned ${items.length} items`);
    return items;
  } catch (err) {
    console.error("❌ Gemini failed:", err.message);
    return [];
  }
}

/* -------------------------------------------------------
 *  OpenRouter Fetcher - 15 news
 * -----------------------------------------------------*/
async function fetchNewsWithOpenRouter(previousHeadlines) {
  try {
    console.log("🔄 Fetching from OpenRouter...");

    const prompt = buildNewsPrompt(previousHeadlines, 15);

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "openai/gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.4,
        max_tokens: 4000
      })
    });

    const data = await response.json();
    const content = data.choices[0].message.content.trim();

    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (!jsonMatch) throw new Error("OpenRouter: No JSON found");

    const items = JSON.parse(jsonMatch[0]);
    console.log(`✅ OpenRouter returned ${items.length} items`);
    return items;
  } catch (err) {
    console.error("❌ OpenRouter failed:", err.message);
    return [];
  }
}

/* -------------------------------------------------------
 *  Format for Discord
 * -----------------------------------------------------*/
function formatNewsForDiscord(items) {
  return items.map((n, i) => `
**Tech Digest #${i + 1}** 📰

**${n.title}**

📝 ${n.summary}

💡 **Impact:** ${n.impact}

🔗 ${n.source}

━━━━━━━━━━━━━━━━━━━━━━━━`).join("\n");
}

/* -------------------------------------------------------
 *  Send to Discord
 * -----------------------------------------------------*/
async function sendToDiscordLarge(content) {
  const MAX = 1900; // avoid hitting 2000 limit
  const chunks = [];

  // Split by lines safely
  let buffer = "";
  for (const line of content.split("\n")) {
    if ((buffer + line).length > MAX) {
      chunks.push(buffer);
      buffer = "";
    }
    buffer += line + "\n";
  }
  if (buffer.trim().length > 0) chunks.push(buffer);

  console.log(`📨 Sending ${chunks.length} chunk(s) to Discord...`);

  for (const msg of chunks) {
    const res = await fetch(process.env.DISCORD_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: msg })
    });

    if (!res.ok) {
      throw new Error(`Discord send failed: ${res.status}`);
    }

    await new Promise(r => setTimeout(r, 1500)); // rate limit safe
  }

  console.log("✅ All chunks sent");
}

/* -------------------------------------------------------
 *  MAIN
 * -----------------------------------------------------*/
async function main() {
  try {
    if (!await validateWebhook()) throw new Error("Webhook invalid");

    const previousHeadlines = loadPreviousNews();

    // Fetch 15 + 15
    const gemini = await fetchNewsWithGemini(previousHeadlines);
    const openrouter = await fetchNewsWithOpenRouter(previousHeadlines);

    const allNews = [...gemini, ...openrouter];
    console.log(`📦 TOTAL FETCHED: ${allNews.length} news items`);

    if (allNews.length === 0) throw new Error("No news fetched");

    // Send 30 directly — no filtering
    const discordMsg = formatNewsForDiscord(allNews);

    await sendToDiscordLarge(discordMsg);
    saveCurrentNews(allNews);

    console.log("🎉 News digest sent successfully!");
  } catch (err) {
    console.error("❌ Fatal Error:", err.message);

    try {
      await sendToDiscordLarge(`❌ ERROR: ${err.message}`);
    } catch {}
  }
}

/* -------------------------------------------------------
 *  ENV Checks
 * -----------------------------------------------------*/
const required = ["DISCORD_WEBHOOK_URL", "GEMINI_API_KEY", "OPENROUTER_API_KEY"];
const missing = required.filter(v => !process.env[v]);

if (missing.length) {
  console.error("❌ Missing env vars:", missing.join(", "));
  process.exit(1);
}

main();
