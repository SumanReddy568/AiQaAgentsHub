// news.js

import * as DOM from './dom.js';
import { state } from './state.js';
import * as Utils from './utils.js';
import { fetchFromApi } from './aiService.js';
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
async function fetchNewsApiData() {
    const companies = ['Google', 'Microsoft', 'Apple', 'OpenAI', 'NVIDIA', 'Meta', 'Amazon', 'Tesla', 'IBM', 'Intel'];
    const topics = ['AI', 'Cloud', 'Software Testing', 'DevOps', 'Cybersecurity'];

    const queries = [...companies, ...topics];
    const endpoints = queries.map(q =>
        `https://newsapi.org/v2/everything?q=${encodeURIComponent(q)}&from=${new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()}&sortBy=publishedAt&apiKey=${NEWS_API_KEY}`
    );

    try {
        const responses = await Promise.all(endpoints.map(url => fetch(url)));
        const jsonResults = await Promise.all(responses.map(res => res.json()));
        const allArticles = jsonResults.flatMap(r => r.articles || []);

        return allArticles.map(a => ({
            title: a.title || 'Untitled',
            summary: a.description || a.content || 'No summary available.',
            technicalExplanation: '',
            sourceName: a.source?.name || 'NewsAPI',
            publishedAt: a.publishedAt || new Date().toISOString()
        }));
    } catch (err) {
        console.warn('NewsAPI fetch failed:', err);
        return [];
    }
}

// ==============================
// 2️⃣ Fetch from NewsData.io
// ==============================
async function fetchNewsDataIo() {
    const q = encodeURIComponent('tech, ai, dev, software testing, cloud, hardware');
    const url = `https://newsdata.io/api/1/latest?apikey=${NEWSDATA_API_KEY}&q=${q}`;

    try {
        const resp = await fetch(url);
        const data = await resp.json();
        const results = data.results || [];

        return results.map(item => ({
            title: item.title || 'Untitled',
            summary: item.description || item.content || 'No summary available.',
            technicalExplanation: '',
            sourceName: item.source_id || item.source || 'NewsData.io',
            publishedAt: item.pubDate || new Date().toISOString()
        }));
    } catch (err) {
        console.warn('NewsData.io fetch failed:', err);
        return [];
    }
}

// ==============================
// 3️⃣ Handle AI Fetch + Merge
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

    const currentDate = new Date().toISOString();
    const aiPrompt = `
        You are a meticulous tech news aggregator with real-time web search.
        The current date is ${currentDate}.
        Find and return a minimum of 100 of the most important tech news articles published within the last 48 hours which include ai, software devlopement, testing, majour outages, new stack in tech, major breakouts etc.

        Focus on: AI breakthroughs, software releases, cloud service updates, major funding/acquisitions, and hardware news.

        **CRITICAL RULES:**
        1. Each 'summary' must be detailed, 3–4 sentences minimum.
        2. Each 'technicalExplanation' should briefly explain the core tech or business impact.
        3. 'publishedAt' must be accurate ISO 8601 format.
        4. Return ONLY valid JSON (no markdown, no comments).

        JSON array:
        [
          {
            "title": "...",
            "summary": "...",
            "technicalExplanation": "...",
            "sourceName": "...",
            "publishedAt": "..."
          }
        ]
    `;

    try {
        const [aiResp, newsApiArticles, newsDataArticles] = await Promise.all([
            fetchFromApi(aiPrompt),
            fetchNewsApiData(),
            fetchNewsDataIo()
        ]);

        // Parse AI JSON safely
        let jsonStr = aiResp.content.trim();
        if (jsonStr.startsWith('```json')) jsonStr = jsonStr.slice(7, -3).trim();
        else if (jsonStr.startsWith('```')) jsonStr = jsonStr.slice(3, -3).trim();

        const aiArticles = JSON.parse(jsonStr);

        // Combine everything
        const allArticles = dedupeArticles([...aiArticles, ...newsApiArticles, ...newsDataArticles]);

        // Enrich missing technicalExplanation via AI
        const toEnrich = allArticles.filter(a => !a.technicalExplanation || a.technicalExplanation.trim() === '');
        if (toEnrich.length > 0) {
            try {
                const enrichPrompt = `
                    For each of the following articles, provide a 2–3 sentence "technicalExplanation" in JSON array format.
                    Articles:
                    ${JSON.stringify(toEnrich.slice(0, 10))}
                `;
                const { content } = await fetchFromApi(enrichPrompt);
                let enrichJson = content.trim();
                if (enrichJson.startsWith('```json')) enrichJson = enrichJson.slice(7, -3).trim();
                else if (enrichJson.startsWith('```')) enrichJson = enrichJson.slice(3, -3).trim();
                const enriched = JSON.parse(enrichJson);

                enriched.forEach(e => {
                    const match = allArticles.find(a => a.title.trim() === e.title.trim());
                    if (match) match.technicalExplanation = e.technicalExplanation;
                });
            } catch (err) {
                console.warn('AI enrichment failed:', err.message);
            }
        }

        renderNews(allArticles);
    } catch (err) {
        console.error(err);
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
        card.className = "news-item bg-white/95 backdrop-blur-sm rounded-xl shadow-lg p-6 border border-slate-200";
        card.style.animationDelay = `${index * 50}ms`;

        card.innerHTML = `
            <div class="flex items-center justify-between mb-3">
                <div class="font-semibold text-blue-600">${news.sourceName || 'Tech News'}</div>
                <div class="flex items-center gap-2 text-xs text-slate-500">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                    </svg>
                    <span>${formatTimeAgo(news.publishedAt)}</span>
                </div>
            </div>
            <h3 class="text-xl font-bold text-slate-800 mb-2">${news.title}</h3>
            <p class="text-slate-600 mb-4">${news.summary}</p>
            <div class="bg-slate-50 border-l-4 border-slate-300 p-3 rounded-r-lg">
                <h4 class="font-bold text-sm text-slate-700 mb-1">Technical Insight</h4>
                <p class="text-sm text-slate-600">${news.technicalExplanation || 'No technical explanation provided.'}</p>
            </div>
        `;
        fragment.appendChild(card);
    });

    newsList.appendChild(fragment);
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

// ==============================
document.addEventListener('DOMContentLoaded', handleFetchNews);
