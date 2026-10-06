// Proxy personale per panini-iptc-web (Cloudflare Workers, piano gratuito).
// NON viene caricato dalla pagina: va copiato in un Worker su dash.cloudflare.com.
//
// Uso: https://<nome-worker>.<tuo-account>.workers.dev/?url=<link LastSticker>
// Accetta solo pagine di www.laststicker.com, quindi non e' un proxy aperto.

const ALLOWED_PREFIX = "https://www.laststicker.com/";

export default {
  async fetch(request) {
    const cors = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
    };
    if (request.method === "OPTIONS") return new Response(null, { headers: cors });

    let target = new URL(request.url).searchParams.get("url") || "";
    target = target.replace(/^http:\/\//i, "https://");
    if (!target.startsWith(ALLOWED_PREFIX)) {
      return new Response("URL non consentito: solo pagine www.laststicker.com", { status: 403, headers: cors });
    }

    try {
      const upstream = await fetch(target, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
          "Accept": "text/html,application/xhtml+xml",
          "Accept-Language": "it-IT,it;q=0.9,en;q=0.8",
        },
        redirect: "follow",
        cf: { cacheTtl: 3600, cacheEverything: true }, // cache 1 ora: meno carico su LastSticker
      });
      return new Response(await upstream.text(), {
        status: upstream.status,
        headers: { ...cors, "Content-Type": "text/html; charset=utf-8" },
      });
    } catch (e) {
      return new Response("Errore proxy: " + e.message, { status: 502, headers: cors });
    }
  },
};
