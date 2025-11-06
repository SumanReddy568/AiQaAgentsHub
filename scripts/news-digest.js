const fs = require("fs");
const path = require("path");
const { GoogleGenerativeAI } = require("@google/generative-ai");

const CACHE_FILE = path.join(__dirname, "../data/news-cache.json");

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
    if (!response.ok) throw new Error(`Discord webhook test failed: ${response.status}`);
    console.log("✅ Discord webhook test successful");
    return true;
  } catch (error) {
    console.error("❌ Discord webhook test failed:", error);
    return false;
  }
}

function loadPreviousNews() {
  try {
    // Ensure cache directory exists
    fs.mkdirSync(path.dirname(CACHE_FILE), { recursive: true });
    
    // Initialize empty cache if doesn't exist
    if (!fs.existsSync(CACHE_FILE)) {
      fs.writeFileSync(CACHE_FILE, JSON.stringify([], null, 2));
      console.log('📁 Initialized new cache file');
      return [];
    }

    const data = JSON.parse(fs.readFileSync(CACHE_FILE, "utf-8"));
    const tenDaysAgo = new Date();
    tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);

    // Filter entries from last 10 days
    const recentNews = Array.isArray(data) ? data.filter(entry => new Date(entry.date) >= tenDaysAgo) : [];
    
    // Clean up old entries and save
    if (recentNews.length !== data.length) {
      fs.writeFileSync(CACHE_FILE, JSON.stringify(recentNews, null, 2));
      console.log(`🧹 Cleaned up ${data.length - recentNews.length} old entries`);
    }
    
    console.log(`🗂️ Loaded ${recentNews.length} cached headlines from last 10 days`);
    return recentNews.map(entry => entry.headline);
  } catch (error) {
    console.error('⚠️ Cache read error:', error);
    // Initialize fresh cache on error
    fs.writeFileSync(CACHE_FILE, JSON.stringify([], null, 2));
    return [];
  }
}

function saveCurrentNews(newsItems) {
  try {
    const currentDate = new Date().toISOString();
    const headlines = newsItems.map(item => ({
      date: currentDate,
      headline: item.match(/\*\*(.*?)\*\*/)?.[1],
      source: (item.match(/Source: (.*?)(\n|$)/)?.[1] || '').trim()
    })).filter(item => item.headline);

    let existingCache = [];
    try {
      existingCache = JSON.parse(fs.readFileSync(CACHE_FILE, "utf-8"));
    } catch {
      existingCache = [];
    }

    // Remove duplicates based on headline
    const uniqueCache = [...existingCache];
    headlines.forEach(newItem => {
      if (!uniqueCache.some(item => item.headline === newItem.headline)) {
        uniqueCache.push(newItem);
      }
    });
    
    fs.writeFileSync(CACHE_FILE, JSON.stringify(uniqueCache, null, 2));
    console.log(`💾 Cached ${headlines.length} new headlines (total: ${uniqueCache.length})`);
  } catch (e) {
    console.error("⚠️ Failed to write cache:", e);
  }
}

async function fetchNewsWithGemini(previousHeadlines) {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-pro" });

  const prompt = `
    Act as an AI news curator focusing on DIVERSE and UNIQUE tech news. Find and summarize 10 of the most significant but DIFFERENT news stories from various tech domains in the last 12 hours.

    STRICT EXCLUSIONS:
    1. Skip these previous headlines:
    ${previousHeadlines.map(h => `- ${h}`).join("\n")}
    2. Avoid general GitHub/Microsoft/OpenAI news unless truly groundbreaking
    3. Skip minor version updates and small feature releases

    PRIORITY AREAS (Find different stories from EACH area):
    1. Emerging AI Technologies & Research
       - New AI models or architectures
       - Novel AI applications
       - Breakthrough research papers
    
    2. Developer Tools & Testing
       - New testing frameworks or tools
       - Innovative development platforms
       - Performance optimization tools
       - Code analysis innovations
    
    3. Infrastructure & Cloud
       - New cloud services
       - Infrastructure automation
       - Security innovations
       - Performance improvements
    
    4. Industry Applications
       - AI in different industries
       - Real-world implementation cases
       - Success stories and failures
    
    5. Alternative Sources
       - Check tech blogs, research papers
       - Industry conferences
       - Company tech blogs
       - Academic publications

    FORMAT REQUIREMENTS:
    🤖 **[UNIQUE AND SPECIFIC HEADLINE - NO GENERIC TITLES]**
    📝 [2-3 technical sentences with specific details, numbers, or technical aspects]
    🔍 Technical Impact: [Specific ways developers/testers can use or are affected]
    🔗 Source: [VERIFIED_WORKING_URL]

    ESSENTIAL:
    - Each story must be from a different domain/area
    - Include specific technical details and numbers
    - Ensure sources are diverse (not all from the same website)
    - URLs must be valid and accessible
    - Focus on actionable insights for developers/testers

    STRICT FORMAT (EXACTLY 10 items, no separators or headers needed):
    🤖 **[HEADLINE]**
    📝 [Technical Summary]
    🔍 Technical Impact: [Impact Details]
    🔗 Source: [URL]

    DO NOT include any additional text, separators, or numbering.
    Start each item directly with the 🤖 emoji.
    Provide exactly 10 items, no more, no less.
  `;

  const result = await model.generateContent(prompt);
  const response = await result.response;
  return response.text();
}

async function sendEachNewsToDiscord(newsText) {
  // Split by news items more accurately and clean up formatting
  const items = newsText
    .replace(/---|\n{3,}/g, '') // Remove separators and extra newlines
    .split(/(?=🤖\s+\*\*)/g) // Split only on actual news items
    .map(i => i.trim())
    .filter(item => item.startsWith('🤖')); // Keep only valid news items

  if (!items.length) throw new Error("No news items found to send");
  if (items.length > 10) {
    console.log(`⚠️ Found ${items.length} items, trimming to 10 items`);
    items.length = 10; // Ensure we only take  items
  }

  const timeLabel = new Date().getHours() < 12 ? "Morning" : "Evening";
  console.log(`📨 Sending ${items.length} news items to Discord (${timeLabel} digest)...`);

  for (let i = 0; i < items.length; i++) {
    const message = `📰 **${timeLabel} AI News Digest #${i + 1}/10**\n\n${items[i]}`;
    const response = await fetch(process.env.DISCORD_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: message }),
    });

    if (!response.ok) throw new Error(`Failed to send news item ${i + 1}: ${response.status}`);
    console.log(`✅ Sent news item ${i + 1}/10`);
    await new Promise(r => setTimeout(r, 1500));
  }

  console.log("✅ All news items sent successfully");
  return items;
}

async function main() {
  try {
    if (!await validateWebhook()) throw new Error("Discord webhook validation failed");

    const previousHeadlines = loadPreviousNews();
    const newsText = await fetchNewsWithGemini(previousHeadlines);

    if (!newsText?.trim()) throw new Error("No news content generated by Gemini");

    const items = await sendEachNewsToDiscord(newsText);
    saveCurrentNews(items);

  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
}

main();
