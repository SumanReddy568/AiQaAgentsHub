const { GoogleGenerativeAI } = require('@google/generative-ai');

async function validateWebhook() {
  try {
    const response = await fetch(process.env.DISCORD_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: "🔄 News digest workflow starting..." })
    });
    if (!response.ok) throw new Error(`Discord webhook test failed: ${response.status}`);
    console.log("✅ Discord webhook test successful");
    return true;
  } catch (error) {
    console.error("❌ Discord webhook test failed:", error);
    return false;
  }
}

async function fetchNewsWithGemini() {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  // ✅ Updated to latest stable model
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-pro" });

  const prompt = `
    Act as an AI news curator. Find and summarize the 5 most significant news stories from the last 12 hours.
    
    PRIORITY ORDER (Most important first):
    1. Major AI breakthroughs and significant developments
    2. AI applications in software testing and test automation
    3. AI in DevOps and development tools
    4. AI in cloud computing and infrastructure
    5. Other significant tech developments
    
    CRITICAL REQUIREMENTS:
    1. At least 3 news items MUST be about AI
    2. Prioritize news about AI tools for developers and testers
    3. Each news item MUST have a valid, accessible source URL
    4. Include only English language technical sources
    5. Focus on practical implementations over research papers
    6. Highlight real-world impact and technical details
    
    Format each news item as:
    🤖 **[HEADLINE]**
    📝 [2-3 sentence technical summary focusing on developer/tester perspective]
    🔍 Technical Impact: [How this affects developers/testers]
    🔗 Source: [FULL_URL_TO_ARTICLE]
  `;

  const result = await model.generateContent(prompt);
  const response = await result.response;
  return response.text();
}

async function sendToDiscord() {
  if (!await validateWebhook()) {
    throw new Error("Discord webhook validation failed");
  }

  const news = await fetchNewsWithGemini();
  if (!news?.trim()) {
    throw new Error("No news content generated");
  }

  const timeLabel = new Date().getHours() < 12 ? "Morning" : "Evening";
  const payload = {
    content: `📰 **${timeLabel} AI News Digest**\n\n${news}\n\n_Generated at: ${new Date().toISOString()}_`
  };

  const response = await fetch(process.env.DISCORD_WEBHOOK_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error(`Failed to send news: ${response.status}`);
  }

  console.log("✅ News digest sent successfully");
}

// Run workflow
(async () => {
  try {
    await sendToDiscord();
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
})();
