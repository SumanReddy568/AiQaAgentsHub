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
      headline: item.title,
      source: item.source
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
  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-pro" });

    const prompt = `
      Act as an AI news curator focusing on DIVERSE and UNIQUE tech news. Find and summarize 10 significant but DIFFERENT tech stories from the last 24 hours.

      EXCLUSIONS - SKIP THESE PREVIOUS HEADLINES:
      ${previousHeadlines.slice(0, 20).map(h => `- ${h}`).join("\n")}

      PRIORITY DOMAINS (find different stories from each):
      - AI/ML Research & New Models
      - Developer Tools & Frameworks  
      - Cloud Computing & Infrastructure
      - Cybersecurity & Privacy
      - Data Science & Analytics
      - Open Source Innovations
      - Tech Industry News

      FORMAT REQUIREMENTS:
      Return a JSON array with exactly 10 items. Each item should have:
      {
        "title": "Clear, specific headline",
        "summary": "2-3 sentence technical summary with specific details",
        "impact": "How this affects developers/engineers",
        "source": "Working URL to the source"
      }

      IMPORTANT:
      - Each story must be from a different domain
      - Include specific technical details, numbers, version numbers
      - Ensure URLs are real and accessible
      - Focus on actionable insights for technical audience
      - Return ONLY valid JSON, no other text
    `;

    console.log('🤖 Fetching news from Gemini...');
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text().trim();
    
    // Clean the response to extract JSON
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      throw new Error('No JSON array found in Gemini response');
    }
    
    const newsData = JSON.parse(jsonMatch[0]);
    console.log(`✅ Gemini returned ${newsData.length} news items`);
    return newsData;
  } catch (error) {
    console.error('❌ Gemini API failed:', error.message);
    throw error; // Re-throw to handle in main function
  }
}

async function fetchNewsWithOpenRouter(previousHeadlines) {
  try {
    const prompt = `
      As a tech news analyst, find 10 significant and diverse technology news stories from the last 24 hours.
      
      EXCLUSIONS - DO NOT INCLUDE:
      ${previousHeadlines.slice(0, 20).map(h => `- ${h}`).join("\n")}
      
      Focus on unique stories across different tech domains.
      
      Return a JSON array with exactly 10 items. Each item should have:
      {
        "title": "Specific news headline", 
        "summary": "2-3 sentence technical summary",
        "impact": "Developer/engineer impact",
        "source": "Actual source URL"
      }
      
      Requirements:
      - Each from different sub-domain
      - Include specific technical details
      - Ensure URLs are real
      - Return ONLY valid JSON
    `;

    console.log('🔄 Fetching news from OpenRouter...');
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://github.com/SumanReddy568/AiQaAgentsHub',
        'X-Title': 'Tech News Aggregator'
      },
      body: JSON.stringify({
        model: "kwaipilot/kat-coder-pro:free",
        messages: [
          {
            role: "user",
            content: prompt
          }
        ],
        max_tokens: 4000,
        temperature: 0.7
      })
    });

    if (!response.ok) {
      throw new Error(`OpenRouter API error: ${response.status} ${await response.text()}`);
    }

    const data = await response.json();
    const content = data.choices[0].message.content.trim();
    
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      throw new Error('No JSON array found in OpenRouter response');
    }
    
    const newsData = JSON.parse(jsonMatch[0]);
    console.log(`✅ OpenRouter returned ${newsData.length} news items`);
    return newsData;
  } catch (error) {
    console.error('❌ OpenRouter API failed:', error.message);
    throw error;
  }
}

function deduplicateNews(items, previousHeadlines) {
  const uniqueItems = [];
  const usedTitles = new Set();
  
  items.forEach(item => {
    const title = item.title.toLowerCase().trim();
    
    // Check if similar to cached headlines
    const isCached = previousHeadlines.some(cached => 
      cached.toLowerCase().includes(title) || title.includes(cached.toLowerCase())
    );
    
    // Check if similar to already used titles
    const isDuplicate = Array.from(usedTitles).some(existing => {
      const words = title.split(' ').filter(word => word.length > 4);
      return words.some(word => existing.includes(word));
    });
    
    if (!isCached && !isDuplicate) {
      uniqueItems.push(item);
      usedTitles.add(title);
    }
  });
  
  return uniqueItems;
}

function formatNewsForDiscord(newsItems) {
  const timeLabel = new Date().getHours() < 12 ? "Morning" : "Evening";
  
  return newsItems.map((item, index) => {
    // Create clean, readable format for Discord
    return `**${timeLabel} Tech Digest #${index + 1}** 📰

**${item.title}**

📝 ${item.summary}

💡 **Technical Impact:** ${item.impact}

🔗 ${item.source}

━━━━━━━━━━━━━━━━━━━━━━━━`;
  });
}

async function sendNewsToDiscord(formattedMessages) {
  if (!formattedMessages.length) {
    throw new Error("No news items to send");
  }

  console.log(`📨 Sending ${formattedMessages.length} news items to Discord...`);

  for (let i = 0; i < formattedMessages.length; i++) {
    const message = formattedMessages[i];
    
    const response = await fetch(process.env.DISCORD_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: message }),
    });

    if (!response.ok) {
      throw new Error(`Failed to send news item ${i + 1}: ${response.status}`);
    }
    
    console.log(`✅ Sent news item ${i + 1}/${formattedMessages.length}`);
    
    // Add delay between messages to avoid rate limiting
    if (i < formattedMessages.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  console.log("✅ All news items sent successfully");
}

async function main() {
  try {
    if (!await validateWebhook()) {
      throw new Error("Discord webhook validation failed");
    }

    const previousHeadlines = loadPreviousNews();
    
    // Fetch news from both services with better error handling
    console.log('🔄 Fetching news from both AI services...');
    
    let geminiNews = [];
    let openRouterNews = [];
    let successfulAPIs = 0;

    try {
      geminiNews = await fetchNewsWithGemini(previousHeadlines);
      successfulAPIs++;
    } catch (error) {
      console.log('⚠️ Continuing without Gemini news');
      geminiNews = [];
    }

    try {
      openRouterNews = await fetchNewsWithOpenRouter(previousHeadlines);
      successfulAPIs++;
    } catch (error) {
      console.log('⚠️ Continuing without OpenRouter news');
      openRouterNews = [];
    }

    // Check if both APIs failed
    if (successfulAPIs === 0) {
      throw new Error("Both Gemini and OpenRouter APIs failed. Cannot fetch news.");
    }

    console.log(`✅ ${successfulAPIs}/2 APIs successful - Gemini: ${geminiNews.length}, OpenRouter: ${openRouterNews.length}`);

    // Combine and deduplicate news
    const allNews = [...geminiNews, ...openRouterNews];
    const uniqueNews = deduplicateNews(allNews, previousHeadlines);
    
    console.log(`🔄 Combined ${allNews.length} items, ${uniqueNews.length} after deduplication`);

    // Select top 8 items (reduced for better readability)
    const topNews = uniqueNews.slice(0, 8);
    
    if (topNews.length === 0) {
      throw new Error("No unique news items found after processing");
    }

    // Format for Discord readability
    const discordMessages = formatNewsForDiscord(topNews);
    
    // Send to Discord
    await sendNewsToDiscord(discordMessages);
    
    // Save to cache
    saveCurrentNews(topNews);

    console.log("🎉 News digest completed successfully!");

  } catch (error) {
    console.error("❌ Critical error:", error.message);
    
    // Send error notification to Discord
    try {
      await fetch(process.env.DISCORD_WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: `❌ **News Digest Failed**\nError: ${error.message}\nTime: ${new Date().toLocaleString()}`
        }),
      });
    } catch (discordError) {
      console.error("Failed to send error notification to Discord:", discordError);
    }
    
    process.exit(1);
  }
}

// Add required environment variables check
const requiredEnvVars = ['DISCORD_WEBHOOK_URL', 'GEMINI_API_KEY', 'OPENROUTER_API_KEY'];
const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingVars.length > 0) {
  console.error('❌ Missing required environment variables:', missingVars.join(', '));
  process.exit(1);
}

// Handle uncaught errors
process.on('unhandledRejection', (error) => {
  console.error('Unhandled promise rejection:', error);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error);
});

main();