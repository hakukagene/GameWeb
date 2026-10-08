import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { stat, realpath, readFile } from 'node:fs/promises';
import { resolve, sep, extname } from 'node:path';
import { randomBytes } from 'node:crypto';
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.wasm':'application/wasm','.data':'application/octet-stream','.zip':'application/zip','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.ogg':'audio/ogg','.opus':'audio/ogg','.mp3':'audio/mpeg','.wav':'audio/wav','.webm':'video/webm','.mp4':'video/mp4','.css':'text/css','.ttf':'font/ttf','.otf':'font/otf'};
export function createGamePlayer({root,origin,appOrigin,authorized}){
  if(new URL(origin).origin!==origin||origin===appOrigin||!/^https?:/.test(origin))throw Error('GAME_ORIGIN must be a separate http(s) origin without trailing slash.');
  const tickets=new Map(),grants=new Map();
  const prune=()=>{for(const map of [tickets,grants])for(const[k,v]of map)if(v.expires<=Date.now())map.delete(k);};
  const grantCookie=origin.startsWith('https:')?'__Secure-bolzoo_preview':'bolzoo_preview';
  function ticket(sessionHash){prune();if(tickets.size>=1000)throw Error('Too many launches. Try later.');const token=randomBytes(32).toString('hex');tickets.set(token,{sessionHash,expires:Date.now()+60000});return origin+'/launch?ticket='+token;}
  async function ready(){try{return(await stat(resolve(root,'bolzoo/index.html'))).isFile();}catch{return false;}}
  function deny(res,code,message){res.writeHead(code,{'Content-Type':'text/plain; charset=utf-8'});res.end(message);}
  const server=createServer(async(req,res)=>{
    res.setHeader('Cache-Control','private, no-store');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('X-Content-Type-Options','nosniff');
    // Engine capabilities apply only to this isolated origin, never the storefront.
    res.setHeader('Content-Security-Policy',`default-src 'self' blob: data:; script-src 'self' 'unsafe-inline' 'unsafe-eval' blob:; style-src 'self' 'unsafe-inline'; connect-src 'self'; worker-src 'none'; frame-ancestors ${appOrigin}; form-action 'none'; base-uri 'self'`);
    try{
      if(!['GET','HEAD'].includes(req.method))return deny(res,405,'Method not allowed');
      const url=new URL(req.url,origin);prune();
      if(url.pathname==='/launch'){
        const token=url.searchParams.get('ticket'),t=tickets.get(token);tickets.delete(token);
        if(!t||!authorized(t.sessionHash)||!(await ready()))return deny(res,403,'Нэвтрээд тоглоомоо дахин нээнэ үү.');
        if(grants.size>=1000)return deny(res,429,'Too many active previews.');
        const key=randomBytes(32).toString('hex');grants.set(key,{sessionHash:t.sessionHash,expires:Date.now()+4*60*60*1000});
        res.setHeader('Set-Cookie',`${grantCookie}=${key}; Path=/games/bolzoo/; HttpOnly; SameSite=Strict; Max-Age=14400${origin.startsWith('https:')?'; Secure':''}`);
        res.writeHead(303,{Location:'/games/bolzoo/'});return res.end();
      }
      const key=(req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith(grantCookie+'='))?.slice(grantCookie.length+1);
      const grant=grants.get(key);if(!grant||!authorized(grant.sessionHash))return deny(res,403,'Тоглох эрх дууссан. Дэлгүүрээс дахин нээнэ үү.');
      if(!url.pathname.startsWith('/games/bolzoo/'))return deny(res,404,'Not found');
      const path=decodeURIComponent(url.pathname.slice('/games/bolzoo/'.length))||'index.html';
      if(path.includes('\\')||path.split('/').some(p=>p==='..'||p.startsWith('.'))||['service-worker.js','pwa_catalog.json','manifest.json','import-info.json'].includes(path))return deny(res,404,'Not found');
      const base=await realpath(resolve(root,'bolzoo')),file=await realpath(resolve(base,path));
      if(!file.startsWith(base+sep))return deny(res,404,'Not found');
      const info=await stat(file);if(!info.isFile())return deny(res,404,'Not found');
      if(path==='index.html'){
        let html=await readFile(file,'utf8');
        // Strip only the stock Ren’Py PWA registration; cached content must not bypass access checks.
        html=html.replace(/<title>[^<]*<\/title>/,'<title>Болзоо</title>').replace(/<link\b[^>]*rel=["']manifest["'][^>]*>/gi,'').replace(/if \(navigator\.serviceWorker\)\s*\{\s*if \(!navigator\.serviceWorker\.controller\)\s*\{\s*navigator\.serviceWorker\.register\([^;]+;\s*\}\s*\}/g,'');
        const bytes=Buffer.from(html);res.writeHead(200,{'Content-Type':types['.html'],'Content-Length':bytes.length});return res.end(req.method==='HEAD'?undefined:bytes);
      }
      let start=0,end=info.size-1,status=200;
      if(req.headers.range){
        const m=/^bytes=(\d*)-(\d*)$/.exec(req.headers.range);
        if(!m||(!m[1]&&!m[2])){res.setHeader('Content-Range',`bytes */${info.size}`);return deny(res,416,'Invalid range');}
        start=m[1]?Number(m[1]):Math.max(0,info.size-Number(m[2]));end=m[1]&&m[2]?Math.min(Number(m[2]),end):end;
        if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start<0||start>end||start>=info.size){res.setHeader('Content-Range',`bytes */${info.size}`);return deny(res,416,'Invalid range');}
        status=206;res.setHeader('Content-Range',`bytes ${start}-${end}/${info.size}`);
      }
      res.writeHead(status,{'Content-Type':types[extname(file).toLowerCase()]||'application/octet-stream','Accept-Ranges':'bytes','Content-Length':Math.max(0,end-start+1)});
      if(req.method==='HEAD'||!info.size)return res.end();
      const stream=createReadStream(file,{start,end});stream.on('error',()=>res.destroy());res.on('close',()=>stream.destroy());stream.pipe(res);
    }catch(e){if(!res.headersSent)deny(res,e.code==='ENOENT'?404:400,'Тоглоомын файл олдсонгүй.');else res.destroy();}
  });
  return {server,ticket,ready};
}
