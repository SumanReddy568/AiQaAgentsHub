// news.js
import { state } from './state.js';
import { fetchFromApi, logTechNewsApiCall } from './aiService.js';
import { loadSettingsFromStorage } from './settings.js';

const newsList = document.getElementById('news-list');
const loading = document.getElementById('news-loading');
const errorDiv = document.getElementById('news-error');

// External API Keys
const NEWS_API_KEY = '40a582d4d4fc4c038f6d425213d09f83';
const NEWSDATA_API_KEY = 'pub_872dd00f93e04da988383949bebd2aa5';

// ==============================
// 1️⃣ Fetch from NewsAPI.org (multiple companies + topics)
// ==============================
function getNewsApiRequestCount() {
    const today = getTodayDate();
    const requestCountKey = `newsApiRequestCount_${today}`;
    return parseInt(localStorage.getItem(requestCountKey) || '0', 10);
}

function incrementNewsApiRequestCount() {
    const today = getTodayDate();
    const requestCountKey = `newsApiRequestCount_${today}`;
    const currentCount = getNewsApiRequestCount();
    localStorage.setItem(requestCountKey, currentCount + 1);
}

async function fetchNewsApiData() {
    const maxRequestsPerDay = 50;
    const currentRequestCount = getNewsApiRequestCount();

    if (currentRequestCount >= maxRequestsPerDay) {
        console.warn(`NewsAPI request limit reached (${maxRequestsPerDay} requests per day).`);
        return [];
    }

    const companies = ['Google', 'Microsoft', 'Apple', 'OpenAI', 'NVIDIA', 'Meta', 'Amazon', 'Tesla', 'IBM', 'Intel'];
    const topics = ['AI', 'Cloud', 'Software Testing', 'DevOps', 'Cybersecurity'];

    const queries = [...companies, ...topics];
    const endpoints = queries.map(q =>
        `https://newsapi.org/v2/everything?q=${encodeURIComponent(q)}&from=${new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()}&sortBy=publishedAt&apiKey=${NEWS_API_KEY}`
    );

    const startTime = Date.now();
    try {
        const limitedEndpoints = endpoints.slice(0, maxRequestsPerDay - currentRequestCount); // Limit requests
        const responses = await Promise.all(limitedEndpoints.map(url => fetch(url)));
        const jsonResults = await Promise.all(responses.map(res => res.json()));
        const allArticles = jsonResults.flatMap(r => r.articles || []);

        // Increment the request count
        incrementNewsApiRequestCount();

        const articles = allArticles.map(a => ({
            title: a.title || 'Untitled',
            summary: a.description || a.content || 'No summary available.',
            technicalExplanation: '',
            sourceName: a.source?.name || 'NewsAPI',
            publishedAt: a.publishedAt || new Date().toISOString(),
            category: detectCategory(a.title, a.description || a.content || ''),
            url: a.url || a.urlToImage || '#'
        }));
        // Log API call for dashboard (token metrics set to 0 for external APIs)
        await logTechNewsApiCall({
            duration: Date.now() - startTime,
            count: articles.length,
            totalTokens: 0,
            promptTokens: 0,
            responseTokens: 0
        });
        return articles;
    } catch (err) {
        console.warn('NewsAPI fetch failed:', err);
        await logTechNewsApiCall({
            duration: Date.now() - startTime,
            count: 0,
            totalTokens: 0,
            promptTokens: 0,
            responseTokens: 0
        });
        return [];
    }
}

// ==============================
// 2️⃣ Fetch from NewsData.io
// ==============================
async function fetchNewsDataIo() {
    const q = encodeURIComponent('tech, ai, dev, software testing, cloud, hardware');
    const url = `https://newsdata.io/api/1/latest?apikey=${NEWSDATA_API_KEY}&q=${q}`;

    const startTime = Date.now();
    try {
        const resp = await fetch(url);
        const data = await resp.json();
        const results = data.results || [];

        const articles = results.map(item => ({
            title: item.title || 'Untitled',
            summary: item.description || item.content || 'No summary available.',
            technicalExplanation: '',
            sourceName: item.source_id || item.source || 'NewsData.io',
            publishedAt: item.pubDate || new Date().toISOString(),
            category: detectCategory(item.title, item.description || item.content || ''),
            url: item.link || '#'
        }));
        // Log API call for dashboard (token metrics set to 0 for external APIs)
        await logTechNewsApiCall({
            duration: Date.now() - startTime,
            count: articles.length,
            totalTokens: 0,
            promptTokens: 0,
            responseTokens: 0
        });
        return articles;
    } catch (err) {
        console.warn('NewsData.io fetch failed:', err);
        await logTechNewsApiCall({
            duration: Date.now() - startTime,
            count: 0,
            totalTokens: 0,
            promptTokens: 0,
            responseTokens: 0
        });
        return [];
    }
}

// Helper to detect news category
function detectCategory(title, content) {
    const text = (title + ' ' + content).toLowerCase();

    if (text.includes('ai') || text.includes('artificial intelligence') || text.includes('machine learning') ||
        text.includes('neural') || text.includes('llm') || text.includes('chatgpt')) {
        return 'ai';
    } else if (text.includes('test') || text.includes('qa') || text.includes('quality assurance') ||
        text.includes('unit test') || text.includes('integration test')) {
        return 'testing';
    } else if (text.includes('cloud') || text.includes('aws') || text.includes('azure') ||
        text.includes('google cloud') || text.includes('serverless')) {
        return 'cloud';
    } else if (text.includes('dev') || text.includes('code') || text.includes('programming') ||
        text.includes('software') || text.includes('api') || text.includes('backend') ||
        text.includes('frontend')) {
        return 'development';
    }

    return 'other';
}

// ==============================
// 3️⃣ Handle AI Fetch + Merge (Progressive Rendering)
// ==============================
async function handleFetchNews() {
    loading.classList.remove('hidden');
    errorDiv.classList.add('hidden');
    newsList.innerHTML = '';

    loadSettingsFromStorage();

    if (!state.apiKey) {
        loading.classList.add('hidden');
        errorDiv.textContent = "API key not configured. Please set one on the main page (Settings).";
        errorDiv.classList.remove('hidden');
        return;
    }

    // Start fetching NewsAPI and NewsData.io in parallel
    let newsApiPromise = fetchNewsApiData();
    let newsDataPromise = fetchNewsDataIo();

    // Render non-AI news as soon as they're ready
    try {
        const [newsApiArticles, newsDataArticles] = await Promise.all([newsApiPromise, newsDataPromise]);
        const initialArticles = dedupeArticles([...newsApiArticles, ...newsDataArticles]);
        renderNews(initialArticles);

        // Show a loading indicator for AI news
        showAiLoadingIndicator();

        // Start AI fetch in parallel
        fetchAndRenderAiNews(initialArticles);
    } catch (err) {
        loading.classList.add('hidden');
        errorDiv.innerHTML = `
            <div class="text-center">
                <svg class="w-12 h-12 text-red-500 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                </svg>
                <p class="font-semibold">Failed to load news</p>
                <p class="text-sm mt-2">Error: ${err.message || err}</p>
            </div>
        `;
        errorDiv.classList.remove('hidden');
    }
}

// Helper to get today's date in YYYY-MM-DD format
function getTodayDate() {
    const today = new Date();
    return today.toISOString().split('T')[0];
}

// Fetch AI news with caching
async function fetchAndRenderAiNews(existingArticles) {
    const currentDate = getTodayDate();
    const cacheKey = `aiNewsCache_${currentDate}`;
    let cachedData = JSON.parse(localStorage.getItem(cacheKey)) || [];

    // Show cached data immediately if available
    if (cachedData.length > 0) {
        console.log('Using cached AI news data.');
        // Ensure AI badge is set for cached articles
        cachedData.forEach(article => {
            article.sourceName = "AI Generated";
        });
        renderNews(dedupeArticles([...existingArticles, ...cachedData]));
    }

    const combinedTopics = `
        AI artificial intelligence machine learning LLM GPT,
        cloud AWS Azure Google Cloud serverless,
        software development programming language framework,
        software testing QA quality assurance test automation
    `;

    showAiLoadingIndicator();

    try {
        const aiPrompt = `
            You are a tech news aggregator focusing on the latest technology news.
            The current date is ${currentDate}.
            Find and return 50 of the most important tech news articles published within the last 48 hours.
            Keywords: ${combinedTopics}
            
            **CRITICAL RULES:**
            1. Each 'summary' must be detailed, 2-3 sentences.
            2. Each 'technicalExplanation' should briefly explain the core tech impact.
            3. 'publishedAt' must be accurate ISO 8601 format.
            4. 'url' should be a valid reference link to the original article or source.
            5. Return ONLY valid JSON array (no markdown, no comments).
            
            JSON array:
            [
              {
                "title": "...",
                "summary": "...",
                "technicalExplanation": "...",
                "sourceName": "...",
                "publishedAt": "...",
                "url": "https://..."
              }
            ]
        `;

        console.log('Fetching AI news...');
        const response = await fetchFromApi(aiPrompt);

        if (!response || !response.content) {
            console.error('No response content for AI news.');
            removeAiLoadingIndicator();
            return;
        }

        let jsonStr = response.content.trim();
        if (jsonStr.startsWith('```json')) jsonStr = jsonStr.slice(7, -3).trim();
        else if (jsonStr.startsWith('```')) jsonStr = jsonStr.slice(3, -3).trim();

        const aiArticles = JSON.parse(jsonStr);

        aiArticles.forEach(article => {
            article.category = detectCategory(article.title, article.summary + ' ' + (article.technicalExplanation || ''));
            if (!article.url) article.url = '#';
            // Ensure AI badge is shown
            article.sourceName = "AI Generated";
        });

        console.log(`Fetched ${aiArticles.length} AI articles.`);
        const allArticles = dedupeArticles([...existingArticles, ...aiArticles]);

        // Render the combined articles
        renderNews(allArticles);

        // Cache the AI news data for today
        if (aiArticles.length > 0) {
            console.log('Storing AI news data in cache.');
            localStorage.setItem(cacheKey, JSON.stringify(aiArticles));
        }
    } catch (err) {
        console.error('AI news fetch failed:', err);
    } finally {
        // Ensure the loading indicator is removed regardless of success or failure
        removeAiLoadingIndicator();
    }
}

// ==============================
// 4️⃣ Deduplicate (Heuristic)
// ==============================
function dedupeArticles(articles) {
    const seen = new Map();
    for (const art of articles) {
        const key = art.title.toLowerCase().replace(/[^a-z0-9]/g, '');
        if (!seen.has(key)) {
            seen.set(key, art);
        } else {
            const existing = seen.get(key);
            if ((art.summary || '').length > (existing.summary || '').length) seen.set(key, art);
        }
    }
    return Array.from(seen.values());
}

// ==============================
// 5️⃣ Render Final News Cards
// ==============================
function renderNews(newsArr) {
    loading.classList.add('hidden');
    newsList.innerHTML = '';

    const fragment = document.createDocumentFragment();
    newsArr.forEach((news, index) => {
        const card = document.createElement('div');
        card.className = "news-item bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 backdrop-blur-sm rounded-xl shadow-lg p-6 border border-slate-200 dark:border-slate-700 mb-4 mx-auto";
        card.dataset.category = news.category || 'other';
        card.style.animationDelay = `${index * 50}ms`;
        card.style.width = "95%"; // Adjusted width for better responsiveness
        card.style.maxWidth = "1200px"; // Adjusted max width for better layout

        card.innerHTML = `
            <div class="flex items-center justify-between mb-4">
                <div class="font-semibold text-blue-600 dark:text-blue-400 text-lg">${news.sourceName || 'Tech News'}</div>
                <div class="flex items-center gap-4">
                    ${news.sourceName === 'AI Generated' ? `
                        <img src="assets/ai.png" alt="AI Badge" class="w-6 h-6" title="Generated by AI">
                    ` : ''}
                    <div class="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                        </svg>
                        <span>${formatTimeAgo(news.publishedAt)}</span>
                    </div>
                    ${news.url && news.url !== '#' ? `
                        <a href="${news.url}" target="_blank" rel="noopener noreferrer" 
                           class="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300 text-sm font-medium rounded-full hover:bg-blue-200 dark:hover:bg-blue-800 transition-colors">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path>
                            </svg>
                            Read Source
                        </a>
                    ` : ''}
                </div>
            </div>
            <h3 class="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-4 leading-tight">${news.title}</h3>
            <p class="text-slate-600 dark:text-slate-400 mb-6 text-lg leading-relaxed">${news.summary}</p>
            <div class="bg-slate-100 dark:bg-slate-700 border-l-4 border-slate-300 dark:border-slate-600 p-4 rounded-r-lg mb-4">
                <h4 class="font-bold text-base text-slate-700 dark:text-slate-300 mb-2">Technical Insight</h4>
                <p class="text-base text-slate-700 dark:text-slate-400 leading-relaxed">${news.technicalExplanation || 'No technical explanation provided.'}</p>
            </div>
            ${news.url && news.url !== '#' ? `
                <div class="flex items-center justify-between pt-4 border-t border-slate-200 dark:border-slate-600">
                    <span class="text-sm text-slate-500 dark:text-slate-400">Reference:</span>
                    <a href="${news.url}" target="_blank" rel="noopener noreferrer" 
                       class="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 text-sm font-medium flex items-center gap-1 hover:underline">
                        ${news.url.replace(/^https?:\/\//, '').split('/')[0]}
                        <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path>
                        </svg>
                    </a>
                </div>
            ` : ''}
        `;
        fragment.appendChild(card);
    });

    newsList.appendChild(fragment);

    // Setup filter handlers after rendering
    setupFilterHandlers();
}

// ==============================
// 6️⃣ Helper - Relative Time
// ==============================
function formatTimeAgo(dateString) {
    try {
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now - date;
        const mins = Math.round(diffMs / 60000);
        const hrs = Math.round(diffMs / 3600000);
        const days = Math.floor(diffMs / 86400000);
        if (mins < 1) return 'Just now';
        if (mins < 60) return `${mins} min${mins > 1 ? 's' : ''} ago`;
        if (hrs < 24) return `${hrs} hour${hrs > 1 ? 's' : ''} ago`;
        if (days < 7) return `${days} day${days > 1 ? 's' : ''} ago`;
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } catch {
        return 'Recently';
    }
}

// Add filter functionality
function setupFilterHandlers() {
    const filterButtons = document.querySelectorAll('.filter-btn');

    filterButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            // Update active state
            filterButtons.forEach(b => b.classList.remove('active', 'bg-blue-500', 'text-white'));
            filterButtons.forEach(b => b.classList.add('bg-slate-100', 'text-slate-700'));

            btn.classList.remove('bg-slate-100', 'text-slate-700');
            btn.classList.add('active', 'bg-blue-500', 'text-white');

            const filter = btn.dataset.filter;

            // Get all cards
            const cards = document.querySelectorAll('.news-item');

            cards.forEach(card => {
                if (filter === 'all' || card.dataset.category === filter) {
                    card.classList.remove('hidden');
                } else {
                    card.classList.add('hidden');
                }
            });
        });
    });
}

// ==============================
// Helper: Show "AI news loading" indicator
function showAiLoadingIndicator() {
    // Prevent multiple banners
    if (document.getElementById('ai-loading-banner')) return;

    // Create a banner instead of a card
    const aiLoadingBanner = document.createElement('div');
    aiLoadingBanner.id = 'ai-loading-banner';
    aiLoadingBanner.className = "fixed top-0 left-0 right-0 bg-blue-100 dark:bg-blue-900 py-3 px-4 shadow-md z-50 flex items-center justify-center gap-3";
    aiLoadingBanner.innerHTML = `
        <svg class="animate-spin w-5 h-5 text-blue-600 dark:text-blue-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"></path>
        </svg>
        <span class="font-medium text-blue-700 dark:text-blue-300">Loading AI-powered news...</span>
    `;
    document.body.appendChild(aiLoadingBanner);

    // Add padding to body to prevent content from being hidden under the banner
    document.body.style.paddingTop = '50px';
}

// Helper: Remove AI loading indicator
function removeAiLoadingIndicator() {
    const aiLoadingBanner = document.getElementById('ai-loading-banner');
    if (aiLoadingBanner) {
        aiLoadingBanner.remove();
        document.body.style.paddingTop = ''; // Reset padding
    }
}

// ==============================
document.addEventListener('DOMContentLoaded', () => {
    handleFetchNews();
});
