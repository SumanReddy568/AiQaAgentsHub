const TRACK_URL = "https://multi-product-analytics.sumanreddy568.workers.dev/";

async function track(eventName, options = {}) {
    try {
        const systemInfo = typeof window !== 'undefined' ? {
            ua: navigator.userAgent,
            lang: navigator.language,
            platform: navigator.platform,
            screen: `${window.screen.width}x${window.screen.height}`,
            viewport: `${window.innerWidth}x${window.innerHeight}`,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
        } : { ua: 'service-worker' };

        const response = await fetch(TRACK_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                product: "ai-qa-agents-hub",
                event: eventName,
                extensionId: chrome?.runtime?.id || 'web_user',
                page: options.page || (typeof window !== 'undefined' ? window.location.href : 'background'),
                feature: options.feature || null,
                version: chrome?.runtime?.getManifest?.()?.version || '1.0.0',
                metadata: {
                    system: systemInfo,
                    ...options.meta
                }
            })
        });
        return await response.json();
    } catch (err) {
        console.error("Analytics failed", err);
    }
}


// Track AI insights event
function trackQAAgentLocator(meta = {}) {
    return track("qa_agent_locator", {
        feature: "locator_page",
        meta
    });
}

// Track QA Agent Code Optimizer event
function trackQAAgentCodeOptimizer(meta = {}) {
    return track("qa_agent_code_optimizer", {
        feature: "code_optimizer_page",
        meta
    });
}

// Track QA Agent Explain event
function trackQAAgentExplain(meta = {}) {
    return track("qa_agent_explain", {
        feature: "explain_page",
        meta
    });
}

// Track QA Agent Diff Checker event
function trackQAAgentDiffChecker(meta = {}) {
    return track("qa_agent_diff_checker", {
        feature: "diff_checker_page",
        meta
    });
}

// Track QA Agent Performance event
function trackQAAgentPerformance(meta = {}) {
    return track("qa_agent_performance", {
        feature: "performance_page",
        meta
    });
}

// Track QA Agent Tech News event
function trackQAAgentTechNews(meta = {}) {
    return track("qa_agent_tech_news", {
        feature: "tech_news_page",
        meta
    });
}

// Track QA Agent Test Case Generator event
function trackQAAgentTestCaseGenerator(meta = {}) {
    return track("qa_agent_test_case_generator", {
        feature: "test_case_generator_page",
        meta
    });
}

// Track QA Agent Dashboard event
function trackQAAgentDashboard(meta = {}) {
    return track("qa_agent_dashboard", {
        feature: "dashboard_page",
        meta
    });
}


// Track QA Agent Landing event
function trackQAAgentLanding(meta = {}) {
    return track("qa_agent_landing", {
        feature: "landing_page",
        meta
    });
}

// Track QA Agent Login event
function trackQAAgentLogin(meta = {}) {
    return track("qa_agent_login", {
        feature: "login_page",
        meta
    });
}

// Track QA Agent SignUp event
function trackQAAgentSignUp(meta = {}) {
    return track("qa_agent_signup", {
        feature: "signup_page",
        meta
    });
}

// Track QA Agent Gemini Docs event
function trackQAAgentGeminiDocs(meta = {}) {
    return track("qa_agent_gemini_docs", {
        feature: "gemini_docs_page",
        meta
    });
}

// Track QA Agent Gemini Status event
function trackQAAgentGeminiStatus(meta = {}) {
    return track("qa_agent_gemini_status", {
        feature: "gemini_status_page",
        meta
    });
}

// Expose globally for non-module scripts (popup, etc.)
if (typeof window !== 'undefined') {
    window.Analytics = {
        trackQAAgentLanding,
        trackQAAgentLogin,
        trackQAAgentSignUp,
        trackQAAgentGeminiDocs,
        trackQAAgentGeminiStatus,
        trackQAAgentLocator,
        trackQAAgentCodeOptimizer,
        trackQAAgentExplain,
        trackQAAgentDiffChecker,
        trackQAAgentPerformance,
        trackQAAgentTechNews,
        trackQAAgentTestCaseGenerator,
        trackQAAgentDashboard
    };
}

// Expose for service worker context
if (typeof self !== 'undefined' && typeof window === 'undefined') {
    self.Analytics = {
        trackQAAgentLanding,
        trackQAAgentLogin,
        trackQAAgentSignUp,
        trackQAAgentGeminiDocs,
        trackQAAgentGeminiStatus,
        trackQAAgentLocator,
        trackQAAgentCodeOptimizer,
        trackQAAgentExplain,
        trackQAAgentDiffChecker,
        trackQAAgentPerformance,
        trackQAAgentTechNews,
        trackQAAgentTestCaseGenerator,
        trackQAAgentDashboard
    };
}
