/* ==========================================================
   Yes We Do Learning (YWDL) — Cloudflare Worker
   Basit hesap sistemi: kullanıcı adı + 4 haneli PIN.
   Cihazlar arası ilerleme bu Worker üzerinden senkronlanır.

   KURULUM (Cloudflare Dashboard üzerinden):
   1) Workers & Pages → mevcut "dilokulu-auth" worker'ını aç
      (yoksa: Create → Create Worker, adını "dilokulu-auth" yap).
   2) Bu dosyanın TÜM içeriğini kopyala, Worker editöründeki
      kodun tamamının yerine yapıştır, "Deploy" / "Save and deploy" bas.
   3) Settings → Variables → KV Namespace Bindings:
      - Yeni bir KV namespace oluştur (ör. "YWDL_KV")
      - Variable name olarak tam olarak  YWDL_KV  yaz ve bu namespace'e bağla.
   4) Worker adresi (URL) değişmez: dilokulu-auth.bb2p4y7wds.workers.dev
   ========================================================== */

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function json(data, status) {
  return new Response(JSON.stringify(data), {
    status: status || 200,
    headers: Object.assign({ 'Content-Type': 'application/json' }, CORS),
  });
}

function normName(name) {
  return String(name || '').trim().toLowerCase().slice(0, 40);
}
function validPin(pin) {
  return /^\d{4}$/.test(String(pin || ''));
}

async function getUser(kv, key) {
  const raw = await kv.get('user:' + key);
  return raw ? JSON.parse(raw) : null;
}
async function putUser(kv, key, rec) {
  await kv.put('user:' + key, JSON.stringify(rec));
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS });
    }

    const kv = env.YWDL_KV;
    if (!kv) return json({ ok: false, error: 'kv_not_bound' }, 500);

    // POST /auth  { name, pin }  -> hesap yoksa oluşturur, varsa PIN'i doğrular
    if (url.pathname === '/auth' && request.method === 'POST') {
      let body;
      try { body = await request.json(); } catch (e) { return json({ ok: false, error: 'bad_json' }, 400); }
      const key = normName(body.name);
      if (!key) return json({ ok: false, error: 'name_required' }, 400);
      if (!validPin(body.pin)) return json({ ok: false, error: 'pin_invalid' }, 400);

      let rec = await getUser(kv, key);
      if (!rec) {
        rec = { name: body.name, pin: body.pin, progress: {}, createdAt: Date.now() };
        await putUser(kv, key, rec);
        return json({ ok: true, created: true, progress: rec.progress });
      }
      if (rec.pin !== body.pin) {
        return json({ ok: false, error: 'pin_mismatch' }, 401);
      }
      return json({ ok: true, created: false, progress: rec.progress || {} });
    }

    // GET /progress?name=&pin=
    if (url.pathname === '/progress' && request.method === 'GET') {
      const key = normName(url.searchParams.get('name'));
      const pin = url.searchParams.get('pin');
      if (!key || !validPin(pin)) return json({ ok: false, error: 'bad_params' }, 400);
      const rec = await getUser(kv, key);
      if (!rec || rec.pin !== pin) return json({ ok: false, error: 'pin_mismatch' }, 401);
      return json({ ok: true, progress: rec.progress || {} });
    }

    // POST /progress  { name, pin, progress }
    if (url.pathname === '/progress' && request.method === 'POST') {
      let body;
      try { body = await request.json(); } catch (e) { return json({ ok: false, error: 'bad_json' }, 400); }
      const key = normName(body.name);
      if (!key || !validPin(body.pin)) return json({ ok: false, error: 'bad_params' }, 400);
      const rec = await getUser(kv, key);
      if (!rec || rec.pin !== body.pin) return json({ ok: false, error: 'pin_mismatch' }, 401);
      rec.progress = body.progress || {};
      rec.updatedAt = Date.now();
      await putUser(kv, key, rec);
      return json({ ok: true });
    }

    return json({ ok: false, error: 'not_found' }, 404);
  },
};
