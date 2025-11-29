import { loadSettingsFromStorage } from './settings.js';
import { analyzePagePerformance } from './agents/performaceAnalyzerAgent.js';
loadSettingsFromStorage();

const urlInput = document.getElementById('url-input');
const analyzeBtn = document.getElementById('analyze-btn');
const loading = document.getElementById('loading');
const error = document.getElementById('error');
const errorMessage = document.getElementById('error-message');
const results = document.getElementById('results');

async function collectMetrics(url) {
    try {
        // Validate URL format
        let parsedUrl;
        try {
            parsedUrl = new URL(url);
        } catch {
            throw new Error('Invalid URL format. Please check the URL and try again.');
        }

        // First try to fetch the URL to check availability
        let response;
        try {
            response = await fetch(url, { 
                mode: 'no-cors', // This allows request but limits response access
                cache: 'no-cache'
            });
        } catch (fetchErr) {
            throw new Error(
                `Unable to reach the endpoint. Possible reasons:
                - Broken link or endpoint is down
                - Network error or DNS issue
                - Cross-origin restrictions
                - Site security policies

                Try checking the URL or using browser DevTools for more details.`
            );
        }

        // Check for broken links (basic check for status if possible)
        // Note: With 'no-cors', response status is opaque, so we can't reliably check status
        // If mode is changed to 'cors', status can be checked, but may fail for cross-origin
        if (response && response.type === 'opaque') {
            // Can't check status, but at least we know fetch did not throw
        } else if (response && !response.ok) {
            throw new Error(
                `The endpoint responded with an error (status: ${response.status}). 
                The link may be broken or the server is returning an error.`
            );
        }

        // Get current performance metrics before loading page
        const navigationStart = performance.now();
        
        // Use Resource Timing API instead of iframe
        const resources = performance.getEntriesByType('resource');
        const pageResources = resources.filter(r => r.name.startsWith(url));
        
        // Collect available metrics that don't require direct page access
        const metrics = {
            url: url,
            timestamp: new Date().toISOString(),
            timing: {
                responseStart: pageResources[0]?.responseStart || 0,
                responseEnd: pageResources[0]?.responseEnd || 0,
                duration: pageResources[0]?.duration || 0,
                fetchTime: performance.now() - navigationStart,
            },
            resources: {
                totalResources: pageResources.length,
                sizes: {
                    transfer: pageResources.reduce((sum, r) => sum + (r.transferSize || 0), 0),
                    encoded: pageResources.reduce((sum, r) => sum + (r.encodedBodySize || 0), 0),
                    decoded: pageResources.reduce((sum, r) => sum + (r.decodedBodySize || 0), 0),
                }
            },
            security: {
                protocol: new URL(url).protocol,
                isSecure: url.startsWith('https://'),
            },
            limitations: [
                "Note: Due to browser security restrictions, some metrics may be limited.",
                "For detailed metrics, consider using Lighthouse or browser DevTools.",
            ]
        };

        // Add navigation timing if available
        const navEntry = performance.getEntriesByType('navigation')[0];
        if (navEntry) {
            metrics.navigation = {
                domComplete: navEntry.domComplete,
                domInteractive: navEntry.domInteractive,
                loadEventEnd: navEntry.loadEventEnd,
                domContentLoadedEventEnd: navEntry.domContentLoadedEventEnd,
            };
        }

        // Add paint timing if available
        const paintEntries = performance.getEntriesByType('paint');
        if (paintEntries.length) {
            metrics.paint = {
                firstPaint: paintEntries.find(e => e.name === 'first-paint')?.startTime,
                firstContentfulPaint: paintEntries.find(e => e.name === 'first-contentful-paint')?.startTime
            };
        }

        return metrics;

    } catch (err) {
        console.error('Error collecting metrics:', err);
        throw new Error(
            err.message ||
            `Unable to analyze this URL. This might be due to:
            - Cross-origin restrictions
            - Site security policies
            - Invalid or inaccessible URL
            
            Try using browser DevTools for detailed analysis.`
        );
    }
}

async function analyzePage() {
    const url = urlInput.value.trim();
    
    if (!url || !url.startsWith('http')) {
        errorMessage.textContent = 'Please enter a valid URL starting with http:// or https://';
        error.classList.remove('hidden');
        return;
    }

    loading.classList.remove('hidden');
    error.classList.add('hidden');
    results.classList.add('hidden');

    try {
        const metrics = await collectMetrics(url);
        const analysis = await analyzePagePerformance(metrics);
        
        // Configure marked options for better styling
        marked.setOptions({
            breaks: true,
            gfm: true,
            headerIds: true
        });
        
        // Add custom styling for the results
        const style = document.createElement('style');
        style.textContent = `
            .prose h1 { color: #1e293b; margin-bottom: 1rem; font-size: 1.5rem; font-weight: bold; }
            .prose h2 { color: #334155; margin-top: 2rem; font-size: 1.25rem; font-weight: 600; }
            .prose ul { margin-top: 1rem; }
            .prose li { margin-top: 0.5rem; }
            .prose strong { color: #334155; }
            .dark .prose h1 { color: #f8fafc; }
            .dark .prose h2 { color: #e2e8f0; }
            .dark .prose strong { color: #e2e8f0; }
        `;
        document.head.appendChild(style);
        
        results.innerHTML = marked.parse(analysis);
        results.classList.remove('hidden');
    } catch (err) {
        errorMessage.textContent = err.message;
        error.classList.remove('hidden');
    } finally {
        loading.classList.add('hidden');
    }
}

analyzeBtn.addEventListener('click', analyzePage);
urlInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') analyzePage();
});
