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
    Act as an AI news curator focusing on DIVERSE and UNIQUE tech news. Find and summarize 15 of the most significant but DIFFERENT news stories from various tech domains in the last 12 hours.

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

    STRICT FORMAT (EXACTLY 15 items, no separators or headers needed):
    🤖 **[HEADLINE]**
    📝 [Technical Summary]
    🔍 Technical Impact: [Impact Details]
    🔗 Source: [URL]

    DO NOT include any additional text, separators, or numbering.
    Start each item directly with the 🤖 emoji.
    Provide exactly 15 items, no more, no less.
  `;

  const result = await model.generateContent(prompt);
  const response = await result.response;
  return response.text();
}

async function fetchNewsWithOpenRouter(previousHeadlines) {
  const prompt = `
    As a tech news analyst, find 15 significant and diverse technology news stories from the last 12 hours.
    
    EXCLUSIONS - DO NOT INCLUDE ANY OF THESE:
    ${previousHeadlines.map(h => `- ${h}`).join("\n")}
    
    Focus on unique stories across these domains:
    - AI/ML Research & Breakthroughs
    - Software Development & Tools
    - Cloud Computing & Infrastructure
    - Cybersecurity Innovations
    - Data Science & Analytics
    - Open Source Projects
    - Tech Industry Developments
    
    FORMAT EACH ITEM EXACTLY AS:
    🚀 **[SPECIFIC_NEWS_HEADLINE]**
    📊 [2-3 sentence technical summary with concrete details]
    💡 Developer Value: [How this benefits developers/engineers]
    🌐 Source: [ACTUAL_SOURCE_URL]
    
    Requirements:
    - Provide exactly 15 items
    - Each must be from a different sub-domain
    - Include specific metrics, version numbers, or technical specs
    - Ensure URLs are real and accessible
    - No generic headlines or repetitive content
    
    Start immediately with the first item, no introduction.
  `;

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://github.com/SumanReddy568/AiQaAgentsHub',
      'X-Title': 'Tech News Aggregator'
    },
    body: JSON.stringify({
      model: "deepseek/deepseek-chat-v3.1:free",
      messages: [
        {
          role: "user",
          content: prompt
        }
      ],
      max_tokens: 9000,
      temperature: 0.7
    })
  });

  if (!response.ok) {
    throw new Error(`OpenRouter API error: ${response.status} ${await response.text()}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

async function prioritizeAndSelectTopNews(geminiNews, openRouterNews, previousHeadlines) {
  console.log('🤖 Combining and prioritizing news from both AI services...');
  
  // Parse both news sources
  const geminiItems = geminiNews
    .split(/(?=🤖\s+\*\*)/g)
    .map(item => item.trim())
    .filter(item => item.startsWith('🤖') && item.includes('**'));
  
  const openRouterItems = openRouterNews
    .split(/(?=🚀\s+\*\*)/g)
    .map(item => item.trim())
    .filter(item => item.startsWith('🚀') && item.includes('**'));

  console.log(`📊 Gemini provided: ${geminiItems.length} items`);
  console.log(`📊 OpenRouter provided: ${openRouterItems.length} items`);

  // Combine all items
  const allItems = [...geminiItems, ...openRouterItems];
  
  // Remove duplicates based on headline similarity
  const uniqueItems = [];
  const usedHeadlines = new Set();
  
  allItems.forEach(item => {
    const headlineMatch = item.match(/\*\*(.*?)\*\*/);
    if (headlineMatch) {
      const headline = headlineMatch[1].toLowerCase().trim();
      
      // Check if this headline is too similar to any previous one
      const isDuplicate = Array.from(usedHeadlines).some(existing => 
        headline.includes(existing) || existing.includes(headline) ||
        headline.split(' ').filter(word => word.length > 3).some(word => 
          existing.includes(word)
        )
      );
      
      // Also check against cached headlines
      const isCached = previousHeadlines.some(cached => 
        cached.toLowerCase().includes(headline) || headline.includes(cached.toLowerCase())
      );
      
      if (!isDuplicate && !isCached && uniqueItems.length < 20) {
        uniqueItems.push(item);
        usedHeadlines.add(headline);
      }
    }
  });

  console.log(`🔄 After deduplication: ${uniqueItems.length} unique items`);

  // Use a simple AI to select top 10 most impactful items
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-pro" });

  const prioritizationPrompt = `
    You are a tech news editor. Select the TOP 10 most impactful and diverse technology news stories from the following list.
    
    CRITERIA:
    1. Technical significance and innovation
    2. Practical impact on developers/engineers
    3. Diversity across different tech domains
    4. Uniqueness and novelty
    5. Actionable insights for technical audience
    
    NEWS ITEMS TO REVIEW:
    ${uniqueItems.map((item, index) => `ITEM ${index + 1}:\n${item}`).join('\n\n')}
    
    INSTRUCTIONS:
    - Select exactly 10 items total
    - Ensure diversity across AI, development, infrastructure, security, etc.
    - Prioritize stories with specific technical details and metrics
    - Prefer stories with clear developer impact
    - Maintain the original formatting exactly
    - Remove the item numbering I added
    
    Return ONLY the 10 selected items in their original format, no additional text.
  `;

  const result = await model.generateContent(prioritizationPrompt);
  const response = await result.response;
  const selectedNews = response.text();

  // Parse the final selection
  const finalItems = selectedNews
    .split(/(?=🤖\s+\*\*|🚀\s+\*\*)/g)
    .map(item => item.trim())
    .filter(item => (item.startsWith('🤖') || item.startsWith('🚀')) && item.includes('**'))
    .slice(0, 10); // Ensure we only take 10 items

  console.log(`🎯 Final selection: ${finalItems.length} top news items`);
  return finalItems;
}

async function sendEachNewsToDiscord(newsItems) {
  if (!newsItems.length) throw new Error("No news items found to send");
  if (newsItems.length > 10) {
    console.log(`⚠️ Found ${newsItems.length} items, trimming to 10 items`);
    newsItems.length = 10;
  }

  const timeLabel = new Date().getHours() < 12 ? "Morning" : "Evening";
  console.log(`📨 Sending ${newsItems.length} news items to Discord (${timeLabel} digest)...`);

  for (let i = 0; i < newsItems.length; i++) {
    // Standardize emoji to 🤖 for consistency
    const standardizedItem = newsItems[i].replace(/^🚀/, '🤖');
    const message = `📰 **${timeLabel} AI News Digest #${i + 1}/10**\n\n${standardizedItem}`;
    
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
  return newsItems;
}

async function main() {
  try {
    if (!await validateWebhook()) throw new Error("Discord webhook validation failed");

    const previousHeadlines = loadPreviousNews();
    
    // Fetch news from both services in parallel
    console.log('🔄 Fetching news from Gemini and OpenRouter...');
    const [geminiNews, openRouterNews] = await Promise.allSettled([
      fetchNewsWithGemini(previousHeadlines),
      fetchNewsWithOpenRouter(previousHeadlines)
    ]);

    // Handle API failures gracefully
    if (geminiNews.status === 'rejected') {
      console.error('❌ Gemini API failed:', geminiNews.reason);
      throw new Error('Gemini API call failed');
    }
    
    if (openRouterNews.status === 'rejected') {
      console.error('❌ OpenRouter API failed:', openRouterNews.reason);
      // Continue with only Gemini data if OpenRouter fails
      console.log('⚠️ Continuing with only Gemini data');
    }

    const combinedNews = await prioritizeAndSelectTopNews(
      geminiNews.value,
      openRouterNews.status === 'fulfilled' ? openRouterNews.value : '',
      previousHeadlines
    );

    if (!combinedNews.length) throw new Error("No news items after prioritization");

    const items = await sendEachNewsToDiscord(combinedNews);
    saveCurrentNews(items);

  } catch (error) {
    console.error("❌ Error:", error);
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

main();