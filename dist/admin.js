import { createGameWithFiles } from './admin-create.js';
const main=document.querySelector('#admin-main');
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=n=>Number(n).toLocaleString('en-US')+' ₮';
const date=n=>new Date(n).toLocaleString('mn-MN');
let me,summary={},games=[],tab='games',editing=null,builds=null,list=null,page=1,query='',gameFilter='',busy=false,noticeTimer;
async function api(path,data) {
  const r=await fetch('/api'+path,{credentials:'same-origin',...(data!==undefined?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)}:{})});
  const result=await r.json();if(!r.ok)throw Error(result.error||'Үйлдэл амжилтгүй.');return result;
}
function notice(message){const e=document.querySelector('#admin-notice');e.textContent=message;clearTimeout(noticeTimer);noticeTimer=setTimeout(()=>e.textContent='',4500);}
function error(message){const e=document.querySelector('#admin-error');if(e)e.textContent=message;else notice(message);}
const gameById=id=>games.find(g=>g.id===id);
async function refresh(){[summary,{games}]=await Promise.all([api('/admin/summary'),api('/admin/games')]);}
function frame(content){
  main.innerHTML=`<div class="admin-heading"><div><div class="eyebrow">STORYPLAY / УДИРДЛАГА</div><h1>${editing?(editing==='__new__'?'Шинэ тоглоом':esc(gameById(editing)?.title)):'Админ удирдлага'}</h1><p>${editing?'Тоглоомын мэдээлэл, нүүр зураг, хувилбаруудаа удирдах.':'Тоглоомууд, хэрэглэгчид болон захиалгууд нэг дор.'}</p></div>${editing?'<button class="btn secondary" data-back>← Жагсаалт руу</button>':'<button class="btn" data-new>＋ Шинэ тоглоом</button>'}</div>${editing?'':`<div class="admin-stats"><div class="admin-stat"><strong>${summary.games??0}</strong><span>Тоглоом</span></div><div class="admin-stat"><strong>${summary.users??0}</strong><span>Бүртгэлтэй хэрэглэгч</span></div><div class="admin-stat"><strong>${summary.orders??0}</strong><span>Туршилтын захиалга</span></div></div><div class="admin-tabs" role="tablist">${[['games','Тоглоомууд'],['users','Хэрэглэгчид'],['orders','Захиалгууд']].map(([id,title])=>`<button role="tab" aria-selected="${tab===id}" class="${tab===id?'active':''}" data-tab="${id}">${title}</button>`).join('')}</div>`}<p class="admin-inline-error" id="admin-error" role="alert"></p><div class="admin-upload-status" id="upload-status" role="status"><p></p><progress max="100" value="0"></progress></div>${content}`;
}
function renderGames(){
  const filtered=games.filter(g=>(g.title+' '+g.id).toLowerCase().includes(query.toLowerCase()));
  frame(`<div class="admin-toolbar"><form id="search-form"><input name="q" type="search" value="${esc(query)}" placeholder="Нэр эсвэл ID-аар хайх" aria-label="Тоглоом хайх"><button class="btn secondary">Хайх</button></form><button class="btn secondary" data-refresh>Шинэчлэх</button></div><div class="admin-table-wrap"><table class="admin-table"><thead><tr><th>ТОГЛООМ</th><th>ҮНЭ</th><th>ТӨЛӨВ</th><th>WEB BUILD</th><th></th></tr></thead><tbody>${filtered.map(g=>`<tr><td><div class="admin-game-cell"><img src="/${esc(g.image).replace(/^\//,'')}" alt=""><div><strong>${esc(g.title)}</strong><small>${esc(g.id)} · ${esc(g.length)}</small></div></div></td><td>${money(g.price)}</td><td><span class="admin-status ${g.published?'live':''}">${g.published?'Нийтлэгдсэн':'Ноорог'}</span></td><td><span class="admin-status ${g.buildReady?'live':'missing'}">${g.buildReady?'Бэлэн':'Оруулаагүй'}</span></td><td><button class="btn secondary" data-edit="${esc(g.id)}">Удирдах →</button></td></tr>`).join('')||'<tr><td colspan="5" class="admin-empty">Тоглоом олдсонгүй.</td></tr>'}</tbody></table></div><p class="admin-notice">Үнэ нь төгрөгөөр хадгалагдана. Бодит төлбөр одоогоор холбогдоогүй.</p>`);
}
function renderEditor(){
  const isNew=editing==='__new__',g=isNew?{id:'',title:'',en:'',genre:'Визуал новел',desc:'',price:0,length:'1.0',published:false}:gameById(editing);
  const formOwner=isNew?'form="game-form"':'';
  const coverPanel=`<section class="admin-panel"><h2>Нүүр зураг</h2>
    <p>${isNew?'Зургаа одоо сонгож болно. Тоглоом үүсгэхэд хамт оруулна.':'Дэлгүүр дээр харагдах нүүр зургаа солино уу.'}</p>
    <div class="admin-preview-empty" ${isNew?'':'hidden'}>Нүүр зураг сонгоогүй</div>
    <img class="admin-preview" ${isNew?'hidden':`src="/${esc(g.image).replace(/^\//,'')}"`} alt="Нүүр зургийн урьдчилсан харагдац">
    ${isNew?'<div class="admin-form">':'<form id="cover-form" class="admin-form">'}
      <label>Зураг сонгох<input type="file" name="${isNew?'coverFile':'file'}" ${formOwner} data-cover-input accept="image/png,image/jpeg,image/webp" ${isNew?'':'required'}><small>PNG, JPG, WebP · 5 MB хүртэл · Хэвтээ зураг тохиромжтой.</small></label>
      <p class="admin-file-selection" data-cover-status aria-live="polite">${isNew?'Зураг сонгох нь сонголттой. Дараа нь нэмж болно.':''}</p>
      ${isNew?'</div>':'<button class="btn secondary" type="submit">Зураг оруулах</button></form>'}
    </section>`;
  const buildPanel=`<section class="admin-panel admin-build-panel"><h2>Тоглоомын web build</h2>
    <p>${isNew?'Ren’Py web ZIP-ээ энд сонгоно. Тоглоом үүсгэхэд шалгаж, суулгана.':g.buildReady?'Тоглоомын файл бэлэн. Шинэ хувилбар оруулахад хуучин build хадгалагдана.':'Ren’Py-ээс гаргасан web ZIP-ээ оруулна уу.'}</p>
    ${isNew?'<div class="admin-form">':'<form id="build-form" class="admin-form">'}
      <label>Оруулах хувилбар<input name="${isNew?'buildVersion':'version'}" ${formOwner} value="${esc(g.length)}" maxlength="40" required></label>
      <label>Web ZIP<input type="file" name="${isNew?'buildFile':'file'}" ${formOwner} data-build-input accept=".zip,application/zip" ${isNew?'':'required'}><small>512 MB хүртэл. Бүх файл шалгагдсаны дараа идэвхжинэ.</small></label>
      <p class="admin-file-selection" data-build-status aria-live="polite">${isNew?'ZIP-ээ сонгох эсвэл тоглоомоо ноорог болгон хадгалж болно.':''}</p>
      <button class="btn" type="submit" ${formOwner}>${isNew?'Тоглоом үүсгээд файлуудыг оруулах':g.buildReady?'Шинэ build оруулах':'Build оруулах'}</button>
    ${isNew?'</div>':'</form>'}
    ${!isNew&&g.buildReady&&summary.previewEnabled?`<button class="btn secondary" type="button" data-preview="${esc(g.id)}">Тоглож шалгах →</button><p>Админ эрхээр нээнэ. Бодит худалдан авалт үүсгэхгүй.</p>`:''}
    ${isNew?'':`<ul class="admin-build-list">${builds?.legacyBuild?'<li><div>Өмнө импортлосон build<small>Командаар оруулсан хувилбар</small></div><span class="admin-status live">Идэвхтэй</span></li>':''}${(builds?.builds||[]).map(b=>`<li><div><strong>${esc(b.version)}</strong><small>${date(b.createdAt)} · ${(b.bytes/1024/1024).toFixed(1)} MB · ${b.files} файл</small></div><span class="admin-status ${b.id===builds.activeBuild?'live':''}">${b.id===builds.activeBuild?'Идэвхтэй':'Хадгалагдсан'}</span></li>`).join('')}</ul>`}
    </section>`;
  frame(`${isNew?'<p class="admin-create-hint">Мэдээллээ бөглөөд баруун талд нүүр зураг, Web ZIP-ээ сонгоно. «Тоглоом үүсгэх» дарахад сонгосон файлууд хамт хадгалагдана.</p>':''}
    <div class="admin-editor"><section class="admin-panel"><h2>Тоглоомын мэдээлэл</h2><p>Хадгалсан мэдээлэл дэлгүүр дээр шинэчлэгдэнэ.</p>
    <form id="game-form" class="admin-form">
      <label>Тоглоомын ID<input name="id" value="${esc(g.id)}" ${isNew?'required pattern="[a-z0-9]+(-[a-z0-9]+)*" maxlength="64"':'disabled'} placeholder="my-new-game"><small>ID-г үүсгэсний дараа өөрчлөхгүй.</small></label>
      <label>Нэр<input name="title" required maxlength="120" value="${esc(g.title)}"></label>
      <label>Нүүрэн дээр харагдах нэр<input name="en" required maxlength="120" value="${esc(g.en)}"><small>Монгол эсвэл англи нэр бичиж болно.</small></label>
      <div class="admin-form-grid"><label>Төрөл<input name="genre" required maxlength="60" value="${esc(g.genre)}" list="genres"><datalist id="genres"><option>Визуал новел</option><option>Нууцлаг</option><option>Драм</option><option>Адал явдал</option><option>Романтик</option></datalist></label><label>Үнэ · ₮<input name="price" type="number" required min="0" max="1000000000" step="1" value="${g.price}"></label></div>
      <label>Тайлбар<textarea name="desc" required maxlength="4000">${esc(g.desc)}</textarea></label>
      <label>${g.realBuild===false?'Хугацаа / хувилбар':'Хувилбар'}<input name="version" required maxlength="40" value="${esc(g.length)}"></label>
      <label class="check"><input type="checkbox" name="published" ${g.published?'checked':''}>Дэлгүүрт нийтлэх</label>
      <button class="btn" type="submit">${isNew?'Тоглоом үүсгэх':'Мэдээлэл хадгалах'}</button>
    </form></section><div>${coverPanel}${buildPanel}</div></div>`);
}
function renderList(){
  const users=tab==='users',items=list?.[tab]||[],total=list?.total||0,pages=Math.max(1,Math.ceil(total/25));
  frame(`<div class="admin-toolbar"><form id="search-form"><input name="q" type="search" value="${esc(query)}" placeholder="${users?'Нэр, имэйлээр хайх':'Нэр, имэйл, тоглоомоор хайх'}" aria-label="Хайх">${users?'':`<select name="gameId" aria-label="Тоглоомоор шүүх"><option value="">Бүх тоглоом</option>${games.map(g=>`<option value="${esc(g.id)}" ${gameFilter===g.id?'selected':''}>${esc(g.title)}</option>`).join('')}</select>`}<button class="btn secondary">Хайх</button></form><span>${total} ${users?'хэрэглэгч':'захиалга'}</span></div>${users?'':'<p class="notice">Эдгээр нь туршилтын захиалга. Мөнгө суутгаагүй, бодит орлого биш.</p>'}<div class="admin-table-wrap"><table class="admin-table"><thead><tr>${(users?['ХЭРЭГЛЭГЧ','ЭРХ','БҮРТГҮҮЛСЭН','ЗАХИАЛГА']:['ЗАХИАЛГА / ОГНОО','ХЭРЭГЛЭГЧ','ТОГЛООМ','ЖИШЭЭ ДҮН','ТӨЛӨВ']).map(x=>'<th>'+x+'</th>').join('')}</tr></thead><tbody>${items.map(row=>users?`<tr><td><strong>${esc(row.name)}</strong><small>${esc(row.email)}</small></td><td><span class="admin-status ${row.role==='admin'?'live':''}">${row.role==='admin'?'Админ':'Хэрэглэгч'}</span></td><td>${date(row.createdAt)}</td><td>${row.orderCount}</td></tr>`:`<tr><td><span title="${esc(row.id)}">${esc(row.id.slice(0,8))}</span><small>${date(row.createdAt)}</small></td><td>${esc(row.name)}<small>${esc(row.email)}</small></td><td>${esc(row.gameTitle)}</td><td>${money(row.amount)}</td><td><span class="admin-status">Туршилт</span></td></tr>`).join('')||`<tr><td colspan="5" class="admin-empty">${users?'Хэрэглэгч':'Захиалга'} олдсонгүй.</td></tr>`}</tbody></table></div><div class="admin-pagination"><button class="btn secondary" data-page="${page-1}" ${page<=1?'disabled':''}>← Өмнөх</button><span>${page} / ${pages}</span><button class="btn secondary" data-page="${page+1}" ${page>=pages?'disabled':''}>Дараах →</button></div>`);
}
function render(){if(editing)renderEditor();else if(tab==='games')renderGames();else renderList();}
async function fetchList(){list=await api(`/admin/${tab}?page=${page}&q=${encodeURIComponent(query)}&gameId=${encodeURIComponent(gameFilter)}`);}
async function edit(id){editing=id;builds=id==='__new__'?null:await api('/admin/games/'+id+'/builds');render();window.scrollTo(0,0);}
function lock(value){busy=value;main.querySelectorAll('form, .admin-tabs, .admin-editor').forEach(e=>e.inert=value);main.querySelectorAll('button[data-back],button[data-new],button[data-refresh]').forEach(e=>e.disabled=value);}
function upload(path,file,type){
  const panel=document.querySelector('#upload-status');panel.classList.add('active');panel.querySelector('p').textContent='Файл оруулж байна…';
  return new Promise((resolve,reject)=>{
    const xhr=new XMLHttpRequest();xhr.open('POST','/api'+path);xhr.setRequestHeader('Content-Type',type);xhr.timeout=12*60*1000;
    xhr.upload.onprogress=e=>{const progress=panel.querySelector('progress');if(e.lengthComputable){progress.value=e.loaded/e.total*100;panel.querySelector('p').textContent=progress.value>=100?'Файл хүлээн авлаа. Шалгаж, суулгаж байна…':`Файл оруулж байна… ${Math.round(progress.value)}%`;}};
    xhr.onload=()=>{try{const result=JSON.parse(xhr.responseText);xhr.status>=200&&xhr.status<300?resolve(result):reject(Error(result.error||'Файл оруулахад алдаа гарлаа.'));}catch{reject(Error('Серверийн хариу буруу байна.'));}};
    xhr.onerror=()=>reject(Error('Сервертэй холбогдож чадсангүй. Жагсаалтаа шинэчлээд хувилбар орсон эсэхийг шалгана уу.'));
    xhr.ontimeout=()=>reject(Error('Хугацаа хэтэрлээ. Жагсаалтаа шинэчлээд хувилбар орсон эсэхийг шалгана уу.'));
    xhr.send(file);
  });
}
main.addEventListener('click',async e=>{
  const button=e.target.closest('button');if(!button||busy)return;
  try{
    if(button.hasAttribute('data-edit'))await edit(button.dataset.edit);
    else if(button.hasAttribute('data-preview')){const result=await api('/games/'+encodeURIComponent(button.dataset.preview)+'/launch',{});window.location.assign(result.url);}
    else if(button.hasAttribute('data-new'))await edit('__new__');
    else if(button.hasAttribute('data-back')){editing=null;await refresh();render();}
    else if(button.hasAttribute('data-tab')){tab=button.dataset.tab;editing=null;page=1;query='';gameFilter='';if(tab!=='games')await fetchList();render();}
    else if(button.hasAttribute('data-page')){page=Number(button.dataset.page);await fetchList();render();}
    else if(button.hasAttribute('data-refresh')){await refresh();render();}
  }catch(e){error(e.message);}
});
main.addEventListener('change',e=>{
  const input=e.target,cover=input.matches('[data-cover-input]');
  if(!cover&&!input.matches('[data-build-input]'))return;
  const file=input.files?.[0],panel=input.closest('.admin-panel');
  panel.querySelector(cover?'[data-cover-status]':'[data-build-status]').textContent=file?`${file.name} · ${(file.size/1024/1024).toFixed(1)} MB`:'';
  if(cover&&file&&file.size<=5*1024*1024&&['image/png','image/jpeg','image/webp'].includes(file.type)){
    const reader=new FileReader();
    reader.onload=()=>{if(input.isConnected&&input.files[0]===file){const preview=panel.querySelector('.admin-preview');preview.src=reader.result;preview.hidden=false;panel.querySelector('.admin-preview-empty').hidden=true;}};
    reader.readAsDataURL(file);
  }
});
main.addEventListener('submit',async e=>{
  e.preventDefault();if(busy)return;const form=e.target,data=new FormData(form);error('');
  if(form.id==='search-form'){query=String(data.get('q')||'');gameFilter=String(data.get('gameId')||'');page=1;try{if(tab!=='games')await fetchList();render();}catch(e){error(e.message);}return;}
  lock(true);
  try{
    if(form.id==='game-form'){
      const creating=editing==='__new__';
      const {coverFile,buildFile,buildVersion,...payload}=Object.fromEntries(data);
      payload.price=Number(payload.price);payload.published=data.has('published');
      let game;
      if(creating){
        game=await createGameWithFiles({payload,coverFile,buildFile,buildVersion,api,upload,onCreated:g=>{editing=g.id;games.push(g);builds=null;render();lock(true);}});
      }else{
        payload.revision=gameById(editing).revision;
        ({game}=await api('/admin/games/'+editing,payload));
      }
      await refresh();await edit(game.id);notice(creating?'Тоглоом болон сонгосон файлууд хадгалагдлаа.':'Мэдээлэл хадгалагдлаа.');
    }else if(form.id==='cover-form'||form.id==='build-form'){
      const file=data.get('file'),cover=form.id==='cover-form';
      if(!file?.size)throw Error('Файлаа сонгоно уу.');if(file.size>(cover?5:512)*1024*1024)throw Error(cover?'Зураг 5 MB-аас бага байна.':'ZIP 512 MB-аас бага байна.');
      const suffix=cover?'cover':'builds?version='+encodeURIComponent(data.get('version').trim());
      await upload('/admin/games/'+editing+'/'+suffix,file,cover?file.type:'application/zip');await refresh();await edit(editing);notice(cover?'Нүүр зураг шинэчлэгдлээ.':'Шинэ build шалгагдаж, идэвхжлээ.');
    }
  }catch(e){
    if(e.createdGameId){
      try{await refresh();await edit(e.createdGameId);}catch{render();}
    }
    error(e.message);document.querySelector('#upload-status')?.classList.remove('active');
  }
  finally{lock(false);}
});
window.addEventListener('beforeunload',e=>{if(busy){e.preventDefault();e.returnValue='';}});
(async()=>{
  try{
    ({user:me}=await api('/me'));
    if(!me||me.role!=='admin'){
      main.innerHTML=`<div class="empty"><div class="eyebrow">STORYPLAY ADMIN</div><h2>${me?'Админ эрх шаардлагатай':'Эхлээд нэвтэрнэ үү'}</h2><p>${me?'Энэ бүртгэл админ эрхгүй байна. Серверийн эзэмшигч эрх олгоно.':'Дэлгүүр дээр админ бүртгэлээрээ нэвтрээд энэ хуудсыг дахин нээнэ үү.'}</p><a class="btn" href="/">Дэлгүүр рүү очих</a></div>`;return;
    }
    document.querySelector('#admin-account').textContent=me.name;await refresh();render();
  }catch(e){main.innerHTML=`<div class="empty"><h2>Холболт амжилтгүй</h2><p>${esc(e.message)}</p><a class="btn" href="/admin">Дахин оролдох</a></div>`;}
})();
