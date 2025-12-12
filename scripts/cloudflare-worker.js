export default {
  /**
   * Cloudflare Worker proxy for AI Gateway.
   *
   * Responsibilities:
   *  - Handle CORS for browser requests
   *  - Forward all paths directly to Cloudflare AI Gateway
   *  - Preserve request method, headers, and body
   *  - Attach CORS headers on responses
   *
   * Path Mapping Example:
   *   /deepseek/chat/completions
   *     → https://gateway.ai.cloudflare.com/v1/<GATEWAY_ID>/ai-gate-way/deepseek/chat/completions
   */
  async fetch(request, env) {
    // -----------------------------
    // 1. CORS Preflight Support
    // -----------------------------
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
        },
      });
    }

    // -----------------------------
    // 2. Gateway Configuration
    // -----------------------------
    const GATEWAY_ID = "149585afc77fbfb3dfdf5b43646fb8ca";
    const BASE_GATEWAY_URL = `https://gateway.ai.cloudflare.com/v1/${GATEWAY_ID}/ai-gate-way`;

    const url = new URL(request.url);

    // Clean double/triple leading slashes (e.g., "//deepseek/...")
    const cleanedPath = url.pathname.replace(/^\/+/, "/");
    const targetUrl = `${BASE_GATEWAY_URL}${cleanedPath}`;

    // -----------------------------
    // 3. Proxy Request to Gateway
    // -----------------------------
    const newRequest = new Request(targetUrl, {
      method: request.method,
      headers: request.headers,
      body: request.body,
    });

    try {
      const response = await fetch(newRequest);

      // -----------------------------
      // 4. Add CORS to Gateway Response
      // -----------------------------
      const newResponse = new Response(response.body, response);
      newResponse.headers.set("Access-Control-Allow-Origin", "*");
      newResponse.headers.set(
        "Access-Control-Allow-Headers",
        "Content-Type, Authorization"
      );

      return newResponse;
    } catch (e) {
      return new Response(
        JSON.stringify({ error: e.message }),
        {
          status: 500,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        }
      );
    }
  },
};
