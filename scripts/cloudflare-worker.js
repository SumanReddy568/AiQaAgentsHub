export default {
  async fetch(request, env) {
    // 1. Handle CORS Preflight (OPTIONS)
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*", // Allow any origin
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
        },
      });
    }

    const url = new URL(request.url);

    // 2. Define Gateway Configuration
    // Replace with your specific Gateway ID if it changes
    const GATEWAY_ID = "149585afc77fbfb3dfdf5b43646fb8ca";
    const BASE_GATEWAY_URL = `https://gateway.ai.cloudflare.com/v1/${GATEWAY_ID}/ai-gate-way`;

    // 3. Request Routing
    // The client sends: /deepseek/chat/completions, /openrouter/..., /compat/...
    // We map these directly to the Cloudflare Gateway path structure.
    // Example: https://worker.dev/deepseek/chat/completions
    // -> https://gateway.ai.cloudflare.com/v1/ID/ai-gate-way/deepseek/chat/completions

    // Handle potential double slashes if client sends "//path"
    const cleanedPath = url.pathname.replace(/^\/+/, '/');
    const targetUrl = `${BASE_GATEWAY_URL}${cleanedPath}`;

    // 4. Proxy the Request
    const newRequest = new Request(targetUrl, {
      method: request.method,
      headers: request.headers,
      body: request.body,
    });

    try {
      const response = await fetch(newRequest);

      // 5. Construct Response with CORS Headers
      const newResponse = new Response(response.body, response);
      newResponse.headers.set("Access-Control-Allow-Origin", "*");
      newResponse.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");

      return newResponse;
    } catch (e) {
      return new Response(JSON.stringify({ error: e.message }), { 
        status: 500,
        headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*"
        }
      });
    }
  },
};
