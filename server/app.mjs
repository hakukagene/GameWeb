import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes, randomUUID, scrypt, timingSafeEqual, createHash } from 'node:crypto';
import { promisify } from 'node:util';
import { openDatabase, publicGame, buildLocation } from './database.mjs';
import { createAdmin } from './admin.mjs';
import { createGamePlayer } from './game-player.mjs';

const derive = promisify(scrypt);
const root = fileURLToPath(new URL('../dist/', import.meta.url));
const ttl = 7 * 24 * 60 * 60 * 1000;
const secretHash = token => createHash('sha256').update(token).digest('hex');
const problem = (status, message) => Object.assign(new Error(message), { status });
const scryptOptions = { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
const staticFiles = new Set(['index.html', 'style.css', 'app.js', 'train.jpg', 'city.webp', 'mountain.jpg', 'admin.html', 'admin.js', 'admin-create.js', 'admin.css']);
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.png':'image/png' };

export function createApp({ dbPath = './data/storyplay.sqlite', origin = 'http://localhost:8000', production = false, demo = !production, gameOrigin = 'http://localhost:8001', contentRoot = './game-content' } = {}) {
  const appURL = new URL(origin);
  if (origin !== appURL.origin || !['http:', 'https:'].includes(appURL.protocol)) throw Error('APP_ORIGIN must be a plain http(s) origin without a trailing slash.');
  if (production && appURL.protocol !== 'https:') throw Error('Production requires an HTTPS APP_ORIGIN.');
  if (production && demo) throw Error('Demo purchases cannot be enabled in production.');
  const db = openDatabase(dbPath);
  const attempts = new Map();
  let hashesInFlight = 0;
  const player = createGamePlayer({root:contentRoot, origin:gameOrigin, appOrigin:origin,
    locate:id=>buildLocation(db,contentRoot,id), authorized:(hash,id)=> {
      if(production || !demo) return false;
      return !!db.prepare(`SELECT 1 FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>? AND (u.role='admin' OR EXISTS(SELECT 1 FROM demo_orders o WHERE o.user_id=u.id AND o.game_id=?))`).get(hash,Date.now(),id);
    }});
  const cookieName = production ? '__Host-storyplay_session' : 'storyplay_session';
  const cookie = (token, maxAge = ttl / 1000) => `${cookieName}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${production ? '; Secure' : ''}`;
  function rawToken(req) {
    return (req.headers.cookie || '').split(';').map(s => s.trim()).find(s => s.startsWith(cookieName + '='))?.slice(cookieName.length + 1) || '';
  }
  function session(req) {
    const token = rawToken(req);
    if (!/^[a-f0-9]{64}$/.test(token)) return null;
    return db.prepare(`SELECT u.id,u.email,u.name,u.role FROM sessions s JOIN users u ON u.id=s.user_id WHERE token_hash=? AND expires_at>?`).get(secretHash(token), Date.now()) || null;
  }
  function requireUser(req) { const user = session(req); if (!user) throw problem(401, 'Эхлээд нэвтэрнэ үү.'); return user; }
  function newSession(req, res, user) {
    const token = randomBytes(32).toString('hex');
    db.prepare('DELETE FROM sessions WHERE token_hash=? OR expires_at<=?').run(secretHash(rawToken(req)), Date.now());
    db.prepare('INSERT INTO sessions VALUES(?,?,?)').run(secretHash(token), user.id, Date.now() + ttl);
    res.setHeader('Set-Cookie', cookie(token));
  }
  function limit(req) {
    const now = Date.now();
    for (const [key, entry] of attempts) if (entry.until <= now) attempts.delete(key);
    const ip = req.socket.remoteAddress || 'unknown'; // Never trust client-supplied forwarding headers.
    let a = attempts.get(ip);
    if (!a) { if (attempts.size >= 10000) throw problem(429, 'Түр хүлээгээд дахин оролдоно уу.'); a = { count: 0, until: now + 15 * 60 * 1000 }; attempts.set(ip, a); }
    if (++a.count > 20) throw problem(429, 'Олон удаа оролдлоо. 15 минутын дараа дахин оролдоно уу.');
  }
  async function passwordKey(password, salt) {
    if (hashesInFlight >= 4) throw problem(503, 'Түр хүлээгээд дахин оролдоно уу.');
    hashesInFlight++;
    try { return await derive(password, salt, 64, scryptOptions); } finally { hashesInFlight--; }
  }
  async function body(req, max=8192) {
    if (!/^application\/json(?:;|$)/i.test(req.headers['content-type'] || '')) throw problem(415, 'JSON өгөгдөл шаардлагатай.');
    if (Number(req.headers['content-length']) > max) throw problem(413, 'Өгөгдөл хэт том байна.');
    let size = 0; const chunks = [];
    for await (const c of req) { size += c.length; if (size > max) throw problem(413, 'Өгөгдөл хэт том байна.'); chunks.push(c); }
    try { const data = JSON.parse(Buffer.concat(chunks).toString()); if (!data || Array.isArray(data) || typeof data !== 'object') throw Error(); return data; }
    catch { throw problem(400, 'Өгөгдлийн формат буруу байна.'); }
  }
  function json(res, code, data) { res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(data)); }
  function orders(user) {
    return db.prepare('SELECT id,game_id AS gameId,amount,created_at AS createdAt FROM demo_orders WHERE user_id=? ORDER BY created_at DESC,id DESC').all(user.id).map(o => ({ ...o, mode: 'demo', status: 'simulated', currency: 'MNT' }));
  }
  const admin=createAdmin({db,contentRoot,requireUser,body,json,player});
  const server = createServer(async (req, res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'same-origin');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'; frame-src " + gameOrigin);
    if (production) res.setHeader('Strict-Transport-Security', 'max-age=31536000');
    try {
      const url = new URL(req.url, origin), path=url.pathname;
      if (path.startsWith('/api/')) {
        if (req.method === 'POST') {
          if (req.headers.origin !== origin || req.headers['sec-fetch-site'] === 'cross-site') throw problem(403, 'Хүсэлтийн эх сурвалж зөвшөөрөгдөөгүй.');
        } else if (req.method !== 'GET') throw problem(405, 'Энэ үйлдэл дэмжигдэхгүй.');
        if(path.startsWith('/api/admin/'))return await admin.handle(req,res,url);
        if (path === '/api/games' && req.method === 'GET') {
          const user=session(req);
          const rows=db.prepare(`SELECT * FROM games WHERE published=1 OR EXISTS(SELECT 1 FROM demo_orders o WHERE o.game_id=games.id AND o.user_id=?) ORDER BY created_at DESC,id`).all(user?.id||'');
          return json(res,200,{games:await Promise.all(rows.map(async row=>({...publicGame(row),playable:!!row.real_build&&demo&&!production&&await player.ready(row.id)})))});
        }
        const gameRoute=/^\/api\/games\/([a-z0-9-]+)\/(cover|launch)$/.exec(path);
        if(gameRoute){
          const [,id,action]=gameRoute;
          const game=db.prepare('SELECT * FROM games WHERE id=?').get(id);
          if(!game)throw problem(404,'Тоглоом олдсонгүй.');
          if(action==='cover'&&req.method==='GET') {
            const user=session(req);
            if(!game.published&&user?.role!=='admin'&&!db.prepare('SELECT 1 FROM demo_orders WHERE user_id=? AND game_id=?').get(user?.id||'',id))throw problem(404,'Тоглоом олдсонгүй.');
            let cover,type='image/webp';
            if(game.cover_file){cover=await readFile(resolve(contentRoot,'covers',game.cover_file));type=types[extname(game.cover_file)];}
            else {try{cover=await readFile(resolve(buildLocation(db,contentRoot,id).path,'game/images/story/school_gate.webp'));}catch{cover=await readFile(resolve(root,'city.webp'));}}
            res.writeHead(200,{'Content-Type':type,'Cache-Control':'no-cache'});return res.end(cover);
          }
          if(action==='launch'&&req.method==='POST') {
            const user=requireUser(req);await body(req);
            if(production||!demo)throw problem(403,'Туршилтын тоглох горим идэвхгүй байна.');
            if(!await player.ready(id))throw problem(409,'Тоглоомын web build-ийг эхлээд оруулна уу.');
            if(user.role!=='admin'&&!db.prepare('SELECT 1 FROM demo_orders WHERE user_id=? AND game_id=?').get(user.id,id))throw problem(403,'Эхлээд туршилтын сандаа нэмнэ үү.');
            return json(res,200,{url:player.ticket(secretHash(rawToken(req)),id)});
          }
        }
        if (path === '/api/me' && req.method === 'GET') return json(res, 200, { user: session(req), demoEnabled: demo });
        if (['/api/auth/register', '/api/auth/login'].includes(path) && req.method === 'POST') {
          limit(req);
          const data = await body(req);
          const email = typeof data.email === 'string' ? data.email.trim().toLowerCase() : '';
          if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || typeof data.password !== 'string' || data.password.length < 10 || data.password.length > 128) throw problem(400, 'Зөв имэйл, 10–128 тэмдэгттэй нууц үг оруулна уу.');
          let user;
          if (path.endsWith('/register')) {
            const name = typeof data.name === 'string' ? data.name.trim() : '';
            if (name.length < 2 || name.length > 60) throw problem(400, 'Нэр 2–60 тэмдэгттэй байна.');
            const salt = randomBytes(16).toString('hex');
            const hash = (await passwordKey(data.password, salt)).toString('hex');
            user = { id: randomUUID(), email, name, role:'user' };
            try { db.prepare('INSERT INTO users(id,email,name,password_hash,salt,created_at) VALUES(?,?,?,?,?,?)').run(user.id,email,name,hash,salt,Date.now()); }
            catch (e) { if (e.message.includes('UNIQUE')) throw problem(409, 'Энэ имэйлээр бүртгэл үүсгэх боломжгүй. Нэвтрэх хэсгийг ашиглана уу.'); throw e; }
          } else {
            const record = db.prepare('SELECT * FROM users WHERE email=?').get(email);
            const key = await passwordKey(data.password, record?.salt || '00000000000000000000000000000000');
            const expected = record ? Buffer.from(record.password_hash, 'hex') : Buffer.alloc(64);
            if (!timingSafeEqual(key, expected) || !record) throw problem(401, 'Имэйл эсвэл нууц үг буруу байна.');
            user = { id: record.id, email: record.email, name: record.name, role:record.role };
          }
          newSession(req, res, user);
          return json(res, path.endsWith('/register') ? 201 : 200, { user });
        }
        if (path === '/api/auth/logout' && req.method === 'POST') {
          await body(req);
          db.prepare('DELETE FROM sessions WHERE token_hash=?').run(secretHash(rawToken(req)));
          res.setHeader('Set-Cookie', cookie('', 0)); return json(res, 200, { ok: true });
        }
        if (path === '/api/library' && req.method === 'GET') {
          const user = requireUser(req);
          return json(res, 200, { demoGameIds: orders(user).map(o => o.gameId), paidGameIds: [] });
        }
        if (path === '/api/orders' && req.method === 'GET') return json(res, 200, { orders: orders(requireUser(req)) });
        if (path === '/api/demo-orders' && req.method === 'POST') {
          const user = requireUser(req);
          if (!demo) throw problem(403, 'Туршилтын захиалга идэвхгүй байна.');
          const data = await body(req);
          if (Object.keys(data).some(k => k !== 'gameId') || typeof data.gameId !== 'string') throw problem(400, 'Зөвхөн gameId илгээнэ үү.');
          const game = db.prepare('SELECT * FROM games WHERE id=? AND published=1').get(data.gameId);
          if (!game) throw problem(404, 'Тоглоом олдсонгүй.');
          // One atomic insertion, unique per account/game; price comes from the server.
          const result = db.prepare('INSERT INTO demo_orders VALUES(?,?,?,?,?) ON CONFLICT(user_id,game_id) DO NOTHING').run(randomUUID(), user.id, game.id, game.price, Date.now());
          const order = orders(user).find(o => o.gameId === game.id);
          return json(res, result.changes ? 201 : 200, { order });
        }
        throw problem(404, 'Хүссэн үйлдэл олдсонгүй.');
      }
      if (!['GET', 'HEAD'].includes(req.method)) throw problem(405, 'Энэ үйлдэл дэмжигдэхгүй.');
      const file = path === '/' ? 'index.html' : ['/admin','/admin/'].includes(path)?'admin.html':path.slice(1);
      if (!staticFiles.has(file)) throw problem(404, 'Хуудас олдсонгүй.');
      const content = await readFile(resolve(root, file));
      res.writeHead(200, { 'Content-Type': types[extname(file)], 'Cache-Control': 'no-cache' });
      res.end(req.method === 'HEAD' ? undefined : content);
    } catch (e) {
      if (!e.status) console.error('Request failed:', e.code || e.name); // Do not log request bodies or credentials.
      if (!res.headersSent) json(res, e.status || 500, { error: e.status ? e.message : 'Серверийн алдаа. Дахин оролдоно уу.' });
      else res.end();
    }
  });
  server.requestTimeout = 10 * 60 * 1000; // Allow authenticated web-build uploads on slower connections.
  server.headersTimeout = 10000;
  return { server, db, gameServer:player.server, close: async () => {
    await Promise.all([server,player.server].filter(s=>s.listening).map(s=>new Promise((ok,reject)=>s.close(e=>e?reject(e):ok()))));db.close();
  }};
}
