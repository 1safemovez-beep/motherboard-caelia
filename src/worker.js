// Caelia Motherboard — Cloudflare Worker
// © 2026 Alicia Spears / Caelia Systems
// Serves the dashboard (index.html and assets/). The dashboard talks to
// https://backend.caeliasystems.com/api, which connects to Caelia's brain.
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/health") {
      return Response.json({ ok: true, service: "caelia-motherboard" });
    }
    const res = await env.ASSETS.fetch(request);
    const out = new Response(res.body, res);
    out.headers.set("X-Content-Type-Options", "nosniff");
    out.headers.set("Referrer-Policy", "no-referrer");
    return out;
  },
};
