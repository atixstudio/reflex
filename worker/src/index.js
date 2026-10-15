const AUTH_MAX_AGE_SEC = 60 * 60 * 24;
const SCORE_CAP = { blitz: 100000, survival: 86400 };
const TOP_KEEP = 100;
const TOP_SHOW = 20;
const enc = new TextEncoder();

const cors = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, POST, OPTIONS',
  'access-control-allow-headers': 'content-type, x-telegram-init-data',
  'access-control-max-age': '86400'
};

export default {
  async fetch(req, env) {
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });

    const url = new URL(req.url);
    try {
      if (req.method === 'POST' && url.pathname === '/score') return await postScore(req, env);
      if (req.method === 'GET' && url.pathname === '/top') return await getTop(req, env, url);
      return json({ error: 'not found' }, 404);
    } catch (e) {
      return json({ error: 'server' }, 500);
    }
  }
};

async function postScore(req, env) {
  const body = await req.json().catch(() => null);
  const mode = body && SCORE_CAP[body.mode] ? body.mode : null;
  const score = body ? Math.floor(Number(body.score)) : NaN;
  if (!mode || !Number.isFinite(score) || score <= 0 || score > SCORE_CAP[mode]) {
    return json({ error: 'bad score' }, 400);
  }
  const user = await verifyInitData(body.initData, env.BOT_TOKEN);
  if (!user) return json({ error: 'unauthorized' }, 401);

  const name = displayName(user);
  const prev = await env.SCORES.get(playerKey(user.id), 'json') || { name, blitz: 0, survival: 0 };
  const improved = score > (prev[mode] || 0);
  const next = {
    name,
    blitz: prev.blitz || 0,
    survival: prev.survival || 0
  };
  next[mode] = improved ? score : (prev[mode] || 0);
  await env.SCORES.put(playerKey(user.id), JSON.stringify(next));
  if (next[mode] > 0 && (improved || name !== prev.name)) {
    await upsertTop(env, mode, { id: user.id, name, score: next[mode] });
  }
  return json({ ok: true });
}

async function getTop(req, env, url) {
  const mode = url.searchParams.get('mode') === 'survival' ? 'survival' : 'blitz';
  const list = await env.SCORES.get(topKey(mode), 'json') || [];
  const user = await verifyInitData(req.headers.get('x-telegram-init-data') || '', env.BOT_TOKEN);

  let me = null;
  if (user) {
    const idx = list.findIndex(row => row.id === user.id);
    if (idx >= 0) {
      me = { name: list[idx].name, score: list[idx].score, rank: idx + 1 };
    } else {
      const player = await env.SCORES.get(playerKey(user.id), 'json');
      if (player && player[mode] > 0) me = { name: player.name, score: player[mode], rank: null };
    }
  }

  return json({
    top: list.slice(0, TOP_SHOW).map(row => ({
      name: row.name,
      score: row.score,
      you: !!(user && row.id === user.id)
    })),
    me
  });
}

async function upsertTop(env, mode, entry) {
  const list = await env.SCORES.get(topKey(mode), 'json') || [];
  const already = list.some(row => row.id === entry.id);
  const rest = list.filter(row => row.id !== entry.id);
  if (!already && rest.length >= TOP_KEEP) {
    const weakest = rest.reduce((min, row) => Math.min(min, row.score), Infinity);
    if (entry.score <= weakest) return;
  }
  rest.push(entry);
  rest.sort((a, b) => b.score - a.score || a.id - b.id);
  await env.SCORES.put(topKey(mode), JSON.stringify(rest.slice(0, TOP_KEEP)));
}

function playerKey(id) { return 'p:' + id; }
function topKey(mode) { return 'top:' + mode; }

export async function verifyInitData(initData, botToken) {
  if (!initData || !botToken) return null;
  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  if (!hash) return null;
  params.delete('hash');

  const authDate = Number(params.get('auth_date'));
  const now = Math.floor(Date.now() / 1000);
  if (!Number.isFinite(authDate) || authDate > now + 30 || now - authDate > AUTH_MAX_AGE_SEC) return null;

  const check = [...params.entries()]
    .sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)
    .map(([k, v]) => k + '=' + v)
    .join('\n');

  const secret = await hmacRaw(enc.encode('WebAppData'), botToken);
  const mac = await hmacHex(secret, check);
  if (!safeEqual(mac, hash)) return null;

  try {
    const user = JSON.parse(params.get('user') || '');
    if (!user || typeof user.id !== 'number') return null;
    return user;
  } catch (e) {
    return null;
  }
}

function displayName(user) {
  const raw = [user.first_name, user.last_name].filter(Boolean).join(' ').trim() || user.username || 'Игрок';
  const clean = raw.replace(/[\u0000-\u001f<>]/g, '').slice(0, 32).trim();
  return clean || 'Игрок';
}

async function hmacRaw(keyBytes, message) {
  const key = await crypto.subtle.importKey('raw', keyBytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(message)));
}

async function hmacHex(keyBytes, message) {
  const raw = await hmacRaw(keyBytes, message);
  return [...raw].map(b => b.toString(16).padStart(2, '0')).join('');
}

function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...cors, 'content-type': 'application/json; charset=utf-8' }
  });
}
