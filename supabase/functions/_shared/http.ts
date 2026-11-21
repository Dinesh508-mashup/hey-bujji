export const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, x-client-info, apikey, content-type",
  "access-control-allow-methods": "GET, POST, OPTIONS",
};

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, "content-type": "application/json" } });
}

export function errorJson(e: unknown, status = 500): Response {
  const message = e instanceof Error ? e.message : String(e);
  console.error(message);
  return json({ error: message }, status);
}
