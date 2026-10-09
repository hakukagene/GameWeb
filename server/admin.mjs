import { mkdir, open, rm, readFile, rename } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { Worker } from 'node:worker_threads';
import { publicGame } from './database.mjs';
const problem=(status,message)=>Object.assign(Error(message),{status});
const idPattern=/^[a-z0-9]+(?:-[a-z0-9]+)*$/;
function textField(data,key,max,required=true) {
  if(typeof data[key]!=='string')throw problem(400,`${key}: текст оруулна уу.`);
  const value=data[key].trim();
  if((required&&!value)||value.length>max||/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(value))throw problem(400,`${key}: 1–${max} тэмдэгт оруулна уу.`);
  return value;
}
function metadata(data,creating) {
  const allowed=['title','en','genre','desc','price','version','published','revision',...(creating?['id']:[])];
  if(Object.keys(data).some(k=>!allowed.includes(k)))throw problem(400,'Танигдаагүй талбар байна.');
  const result={title:textField(data,'title',120),en:textField(data,'en',120),genre:textField(data,'genre',60),desc:textField(data,'desc',4000),version:textField(data,'version',40)};
  if(!Number.isSafeInteger(data.price)||data.price<0||data.price>1000000000)throw problem(400,'Үнэ 0–1,000,000,000 хооронд бүхэл төгрөг байна.');
  if(typeof data.published!=='boolean')throw problem(400,'Нийтлэх төлөв буруу байна.');
  if(!creating&&!Number.isSafeInteger(data.revision))throw problem(400,'Хуудсаа шинэчлээд дахин оролдоно уу.');
  if(creating&&(!idPattern.test(data.id||'')||data.id.length>64||/^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/.test(data.id)))throw problem(400,'ID: 1–64 жижиг латин үсэг, тоо, дундуур зураас ашиглана уу.');
  return {...result,id:data.id,price:data.price,published:Number(data.published),revision:data.revision};
}
function pageInfo(url) {
  const page=Number(url.searchParams.get('page')||1),limit=25;
  if(!Number.isSafeInteger(page)||page<1||page>1000000)throw problem(400,'Хуудасны дугаар буруу байна.');
  const q=(url.searchParams.get('q')||'').trim().slice(0,120);
  return {page,limit,offset:(page-1)*limit,q,search:'%'+q.replace(/[!%_]/g,'!$&')+'%'};
}
async function receive(req,root,max,accepted) {
  const type=(req.headers['content-type']||'').split(';')[0].toLowerCase();
  if(!accepted.includes(type))throw problem(415,'Файлын төрөл буруу байна.');
  if(Number(req.headers['content-length'])>max)throw problem(413,`Файл ${max/1024/1024} MB-аас бага байна.`);
  await mkdir(root,{recursive:true});const file=join(root,randomUUID()+'.upload');
  const handle=await open(file,'wx');let size=0;
  try {
    for await(const chunk of req.iterator({destroyOnReturn:false})) {
      size+=chunk.length;if(size>max)throw problem(413,`Файл ${max/1024/1024} MB-аас бага байна.`);
      await handle.writeFile(chunk);
    }
    if(!size)throw problem(400,'Хоосон файл байна.');
    return {file,type,size};
  }catch(e){req.resume();await handle.close();await rm(file,{force:true}).catch(()=>{});throw e;}
  finally{await handle.close();}
}
function inspectCover(bytes,type) {
  if(type==='image/png'&&bytes.length>=24&&bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))&&bytes.toString('ascii',12,16)==='IHDR') {
    const w=bytes.readUInt32BE(16),h=bytes.readUInt32BE(20);
    if(!w||!h||w*h>40000000)throw problem(400,'Зургийн хэмжээ хэт том эсвэл буруу байна.');return 'png';
  }
  if(type==='image/jpeg'&&bytes.length>4&&bytes[0]===255&&bytes[1]===216&&bytes[2]===255)return 'jpg';
  if(type==='image/webp'&&bytes.length>=20&&bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP'&&['VP8 ','VP8L','VP8X'].includes(bytes.toString('ascii',12,16)))return 'webp';
  throw problem(400,'PNG, JPG эсвэл WebP зураг сонгоно уу.');
}
function extract(archive,parent,id) {
  return new Promise((ok,reject)=>{
    const worker=new Worker(new URL('./build-import-worker.mjs',import.meta.url),{workerData:{archive,parent,id}});
    const timeout=setTimeout(async()=>{await worker.terminate();reject(problem(422,'Build задлах хугацаа хэтэрлээ.'));},120000);
    worker.once('message',result=>{clearTimeout(timeout);result.ok?ok(result):reject(problem(422,'Build шалгалт амжилтгүй: '+result.error));});
    worker.once('error',e=>{clearTimeout(timeout);reject(e);});
    worker.once('exit',()=>{clearTimeout(timeout);reject(problem(422,'Build боловсруулах боломжгүй.'));});
  });
}
export function createAdmin({db,contentRoot,requireUser,body,json,player}) {
  let building=null;
  function requireAdmin(req) {const u=requireUser(req);if(u.role!=='admin')throw problem(403,'Админ эрх шаардлагатай.');return u;}
  const getGame=id=>{const row=db.prepare('SELECT * FROM games WHERE id=?').get(id);if(!row)throw problem(404,'Тоглоом олдсонгүй.');return row;};
  async function handle(req,res,url) {
    const user=requireAdmin(req),path=url.pathname;
    if(path==='/api/admin/summary'&&req.method==='GET')return json(res,200,{
      games:db.prepare('SELECT count(*) AS n FROM games').get().n,
      users:db.prepare('SELECT count(*) AS n FROM users').get().n,
      orders:db.prepare('SELECT count(*) AS n FROM demo_orders').get().n,mode:'demo'
    });
    if(path==='/api/admin/games'&&req.method==='GET'){
      const rows=db.prepare('SELECT * FROM games ORDER BY created_at DESC,id').all();
      return json(res,200,{games:await Promise.all(rows.map(async row=>({...publicGame(row),buildReady:await player.ready(row.id),activeBuild:row.active_build,uploading:building===row.id}))) });
    }
    if(path==='/api/admin/games'&&req.method==='POST'){
      const d=metadata(await body(req,32768),true),now=Date.now();
      try{db.prepare(`INSERT INTO games(id,price,title,en,genre,description,display_length,real_build,published,image,created_at,updated_at) VALUES(?,?,?,?,?,?,?,1,?,'city.webp',?,?)`).run(d.id,d.price,d.title,d.en,d.genre,d.desc,d.version,d.published,now,now);}
      catch(e){if(e.message.includes('UNIQUE'))throw problem(409,'Энэ ID-тай тоглоом байна. Өөр ID сонгоно уу.');throw e;}
      return json(res,201,{game:publicGame(getGame(d.id))});
    }
    const match=/^\/api\/admin\/games\/([a-z0-9-]+)(?:\/(cover|builds))?$/.exec(path);
    if(match){
      const [,id,action]=match;const game=getGame(id);
      if(!action&&req.method==='POST'){
        if(building===id)throw problem(409,'Build оруулж байна. Дууссаны дараа мэдээллээ хадгална уу.');
        const d=metadata(await body(req,32768),false);
        const result=db.prepare(`UPDATE games SET title=?,en=?,genre=?,description=?,price=?,display_length=?,published=?,updated_at=?,revision=revision+1 WHERE id=? AND revision=?`).run(d.title,d.en,d.genre,d.desc,d.price,d.version,d.published,Date.now(),id,d.revision);
        if(!result.changes)throw problem(409,'Мэдээлэл өөрчлөгдсөн байна. Жагсаалтаа шинэчлээд дахин нээнэ үү.');
        return json(res,200,{game:publicGame(getGame(id))});
      }
      if(action==='cover'&&req.method==='POST'){
        const upload=await receive(req,resolve(contentRoot,'.uploads'),5*1024*1024,['image/png','image/jpeg','image/webp']);let destination;
        try{
          requireAdmin(req);
          const ext=inspectCover(await readFile(upload.file),upload.type),name=randomUUID()+'.'+ext;
          await mkdir(resolve(contentRoot,'covers'),{recursive:true});destination=resolve(contentRoot,'covers',name);await rename(upload.file,destination);
          db.prepare('UPDATE games SET cover_file=?,updated_at=?,revision=revision+1 WHERE id=?').run(name,Date.now(),id);
          return json(res,200,{game:publicGame(getGame(id))});
        }catch(e){if(destination)await rm(destination,{force:true}).catch(()=>{});throw e;}
        finally{await rm(upload.file,{force:true}).catch(()=>{});}
      }
      if(action==='builds'&&req.method==='GET')return json(res,200,{activeBuild:game.active_build,legacyBuild:!game.active_build&&await player.ready(id),builds:db.prepare('SELECT id,version,files,bytes,sha256,created_at AS createdAt FROM game_builds WHERE game_id=? ORDER BY created_at DESC,id DESC').all(id)});
      if(action==='builds'&&req.method==='POST'){
        if(building)throw problem(409,'Өөр build боловсруулж байна. Дууссаны дараа дахин оролдоно уу.');
        const version=textField({version:url.searchParams.get('version')},'version',40);
        const buildId=randomUUID(),relativePath=`releases/${id}/${buildId}`;
        let upload,committed=false;building=id;
        try{
          upload=await receive(req,resolve(contentRoot,'.uploads'),512*1024*1024,['application/zip','application/octet-stream','application/x-zip-compressed']);
          const result=await extract(upload.file,resolve(contentRoot,'releases',id),buildId);
          requireAdmin(req);db.exec('BEGIN IMMEDIATE');
          try {
            db.prepare('INSERT INTO game_builds VALUES(?,?,?,?,?,?,?,?,?)').run(buildId,id,version,relativePath,result.files,result.bytes,result.sha256,Date.now(),user.id);
            db.prepare('UPDATE games SET active_build=?,display_length=?,real_build=1,updated_at=?,revision=revision+1 WHERE id=?').run(buildId,version,Date.now(),id);
            db.exec('COMMIT');committed=true;
          }catch(e){db.exec('ROLLBACK');throw e;}
          return json(res,201,{game:publicGame(getGame(id)),build:{id:buildId,version,files:result.files,bytes:result.bytes}});
        }finally{
          building=null;if(upload)await rm(upload.file,{force:true}).catch(()=>{});
          if(!committed)await rm(resolve(contentRoot,relativePath),{recursive:true,force:true,maxRetries:3,retryDelay:100}).catch(()=>{});
        }
      }
    }
    if(path==='/api/admin/users'&&req.method==='GET'){
      const p=pageInfo(url),where="WHERE email LIKE ? ESCAPE '!' OR name LIKE ? ESCAPE '!'";
      const total=db.prepare(`SELECT count(*) AS n FROM users ${where}`).get(p.search,p.search).n;
      const users=db.prepare(`SELECT id,email,name,role,created_at AS createdAt,(SELECT count(*) FROM demo_orders o WHERE o.user_id=users.id) AS orderCount FROM users ${where} ORDER BY created_at DESC,id LIMIT ? OFFSET ?`).all(p.search,p.search,p.limit,p.offset);
      return json(res,200,{users,total,page:p.page,pageSize:p.limit});
    }
    if(path==='/api/admin/orders'&&req.method==='GET'){
      const p=pageInfo(url),gameId=url.searchParams.get('gameId')||'';
      const where="WHERE (u.email LIKE ? ESCAPE '!' OR u.name LIKE ? ESCAPE '!' OR g.title LIKE ? ESCAPE '!') AND (?='' OR o.game_id=?)";
      const args=[p.search,p.search,p.search,gameId,gameId],joins='FROM demo_orders o JOIN users u ON u.id=o.user_id JOIN games g ON g.id=o.game_id';
      const total=db.prepare(`SELECT count(*) AS n ${joins} ${where}`).get(...args).n;
      const orders=db.prepare(`SELECT o.id,o.game_id AS gameId,g.title AS gameTitle,u.email,u.name,o.amount,o.created_at AS createdAt ${joins} ${where} ORDER BY o.created_at DESC,o.id LIMIT ? OFFSET ?`).all(...args,p.limit,p.offset).map(o=>({...o,mode:'demo',status:'simulated',currency:'MNT'}));
      return json(res,200,{orders,total,page:p.page,pageSize:p.limit});
    }
    throw problem(404,'Админ үйлдэл олдсонгүй.');
  }
  return {handle};
}
