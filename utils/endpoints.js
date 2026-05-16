// Loaded as a classic script before any consumer in every HTML, so both
// classic scripts (analytics.js, auth.js) and ES modules (aiService.js,
// etc.) can read window.WORKER_BASE / window.GATEWAY_BASE without
// duplicating the host literal.
window.WORKER_BASE = "https://open-api-worker.sumanreddy568.workers.dev";
window.GATEWAY_BASE = window.WORKER_BASE + "/gateway";
