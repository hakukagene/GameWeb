let games = [], user = null, owned = new Set(), orders = [], demoEnabled = false;
let filter = 'Бүгд', query = '', loading = true, failure = '', pendingGame = null, toastTimer;
const main = document.querySelector('main');
const dialog = document.querySelector('dialog');
const detail = document.querySelector('#dialog-content');
const money = n => n.toLocaleString('en-US') + ' ₮';
const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
async function api(path, data) {
  let response;
  try { response = await fetch('/api' + path, { credentials: 'same-origin', headers: data ? {'Content-Type':'application/json'} : {}, ...(data ? {method:'POST',body:JSON.stringify(data)} : {}) }); }
  catch { throw Error('Сервертэй холбогдохгүй байна. Холболтоо шалгаад дахин оролдоно уу.'); }
  let result;
  try { result = await response.json(); } catch { throw Error('Сервер ассан эсэхийг шалгана уу. Website-ийг npm start командаар ажиллуулна.'); }
  if (!response.ok) {
    if (response.status === 401 && path !== '/auth/login') { user = null; owned.clear(); orders = []; render(); }
    throw Error(result.error || 'Үйлдэл амжилтгүй.');
  }
  return result;
}
function notify(message) { const t=document.querySelector('#toast');t.textContent=message;t.classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>t.classList.remove('visible'),3500); }
function openModal(html) { detail.innerHTML=html;if(!dialog.open)dialog.showModal(); }
function card(g) {
  return `<article class="card"><button class="cover" data-game="${esc(g.id)}" aria-label="${esc(g.title)} дэлгэрэнгүй"><img src="${esc(g.image)}" alt="${esc(g.title)} — жишээ нүүр зураг"><span class="badge">${owned.has(g.id)?'ТУРШИЛТЫН САН':g.realBuild?esc(g.title)+' · '+esc(g.length):'ЖИШЭЭ ТОГЛООМ'}</span><span class="cover-title">${esc(g.en).replace('\n','<br>')}</span></button><div class="card-info"><div><h3>${esc(g.title)}</h3><p>${esc(g.genre)} · Визуал новел</p></div><span class="price">${owned.has(g.id)?'Нэмэгдсэн':money(g.price)}</span></div></article>`;
}
function catalog() {
  const list=games.filter(g=>g.published!==false&&(filter==='Бүгд'||g.genre===filter)&&g.title.toLowerCase().includes(query.toLowerCase()));
  document.querySelector('#catalog').innerHTML=list.length?list.map(card).join(''):'<p>Тохирох тоглоом олдсонгүй. Өөр нэрээр хайгаарай.</p>';
}
function render() {
  const lib=location.hash==='#library';
  document.querySelector('#store-link').classList.toggle('active',!lib);
  document.querySelector('#library-link').classList.toggle('active',lib);
  document.querySelector('#count').textContent=owned.size;
  document.querySelector('#account-menu').innerHTML=loading?'':user?`${user.role==='admin'?'<a class="admin-entry" href="/admin">Удирдлага</a>':''}<button class="account-btn" data-account>${esc(user.name)}</button>`:'<button class="btn secondary" data-auth="login">Нэвтрэх</button>';
  if(loading){main.innerHTML='<div class="empty" role="status">Ачаалж байна…</div>';return;}
  if(failure){main.innerHTML=`<div class="empty"><h2>Холболт амжилтгүй</h2><p role="alert">${esc(failure)}</p><button class="btn" data-retry>Дахин оролдох</button></div>`;return;}
  if(lib){
    main.innerHTML=`<div class="library-heading"><div class="eyebrow">ТАНЫ ТҮҮХҮҮД</div><h1>Миний сан</h1><p>${user?'Таны бүртгэлд хадгалагдсан туршилтын тоглоомууд. Бодит худалдан авалт биш.':'Нэвтэрч өөрийн хадгалсан тоглоомуудыг үзнэ үү.'}</p></div>${!user?'<div class="empty"><h2>Өөрийн санд нэвтрэх</h2><p>Нэг бүртгэлээр сангаа дахин нээх боломжтой.</p><button class="btn" data-auth="login">Нэвтрэх / Бүртгүүлэх</button></div>':owned.size?'<div class="grid">'+games.filter(g=>owned.has(g.id)).map(card).join('')+'</div>':'<div class="empty"><h2>Шинэ түүх таныг хүлээж байна</h2><p>Дэлгүүрээс жишээ тоглоом сонгож, сандаа нэмээд үзээрэй.</p><a class="btn" href="#store">Дэлгүүр үзэх</a></div>'}`;return;
  }
  const featured=games.find(g=>g.id==='bolzoo'&&g.published)||games.find(g=>g.published);
  if(!featured){main.innerHTML='<div class="empty"><h2>Тоглоомууд удахгүй нэмэгдэнэ</h2></div>';return;}
  const genres=['Бүгд',...new Set(games.filter(g=>g.published).map(g=>g.genre))];
  main.innerHTML=`<section class="hero"><img src="${esc(featured.image)}" alt="${esc(featured.title)}"><div class="hero-content"><div class="eyebrow">ОНЦЛОХ ТҮҮХ / 01</div><h1>${esc(featured.title)}</h1><div class="tags"><span>${esc(featured.length)}</span><span>${esc(featured.genre)}</span><span>Монгол хэл</span></div><p>${esc(featured.desc.length>160?featured.desc.slice(0,160)+'…':featured.desc)}</p><button class="btn" data-game="${esc(featured.id)}">Тоглоомтой танилцах <span>＋</span></button><div class="hero-note">Ren’Py · Туршилтын тоглох горим</div></div><div class="hero-bottom" aria-hidden="true"><i></i><i></i><i></i></div></section><div class="section-top"><div><h2>Дараагийн түүхээ сонго</h2><p>Монгол хэл дээрх визуал новелууд</p></div><input class="search" type="search" placeholder="Тоглоом хайх…" aria-label="Тоглоом хайх"></div><div class="filters">${genres.map(t=>`<button class="chip ${t===filter?'active':''}" data-filter="${esc(t)}">${esc(t)}</button>`).join('')}</div><div class="grid" id="catalog"></div><div class="subnote"><span>WEB · ANDROID · iOS — Төлөвлөж буй платформууд</span><span>Бүтэн тоглоом. Нэг удаагийн худалдан авалт.</span></div>`;
  main.querySelector('input').value=query;catalog();
}
function showGame(id) {
  const g=games.find(g=>g.id===id);if(!g)throw Error('Тоглоом олдсонгүй');
  const ready=g.realBuild&&g.playable, inLibrary=owned.has(id);
  openModal(`<img class="detail-image" src="${esc(g.image)}" alt="${esc(g.title)}"><div class="detail-body"><div class="eyebrow">${esc(g.genre)}</div><h2 id="modal-title">${esc(g.title)}</h2><p>${esc(g.desc)}</p><div class="detail-facts"><div><span>Хэл</span>Монгол</div><div><span>${g.realBuild?'Хувилбар':'Жишээ хугацаа'}</span>${esc(g.length)}</div><div><span>Агуулга</span>Бүтэн тоглоом</div></div><p class="notice">${g.realBuild?(ready?'Тоглоомыг туршиж тоглох боломжтой. Төлбөр авахгүй. Save нь энэ браузерт хадгалагдана; хэрэглэгчийн бүртгэлтэй cloud save холбогдоогүй.':'Тоглоомын build оруулаагүй эсвэл туршилтын тоглох горим идэвхгүй байна.'):'Жишээ контент. Төлбөр, тоглох файл холбогдоогүй.'}</p><div class="purchase-row"><strong>${money(g.price)}</strong><button class="btn" ${ready&&inLibrary?`data-play="${esc(id)}"`:`data-checkout="${esc(id)}"`} ${!demoEnabled&&!inLibrary?'disabled':''}>${ready&&inLibrary?'Тоглох':inLibrary?'Миний санг нээх':g.realBuild?'Туршилтын санд нэмэх':'Худалдан авахыг турших'}</button></div><p id="form-error" class="form-error" role="alert"></p></div>`);
}
async function play(id) {
  const result=await api('/games/'+encodeURIComponent(id)+'/launch',{});
  dialog.close();location.hash='play/'+id;
  const g=games.find(g=>g.id===id);
  main.innerHTML=`<section id="game-shell" class="game-shell"><div class="player-toolbar"><div><h1>${esc(g.title)}</h1><small>Туршилтын горим · Save энэ браузерт хадгалагдана</small></div><div><button class="btn secondary" data-fullscreen>Бүтэн дэлгэц</button><a class="btn secondary" href="#library">Сан руу буцах</a></div></div><p id="player-status" role="status">Тоглоом ачаалж байна. Эхний удаа хугацаа шаардаж болно.</p><iframe title="${esc(g.title)} тоглоом" class="game-frame" sandbox="allow-scripts allow-same-origin allow-downloads" allow="autoplay; fullscreen" allowfullscreen></iframe></section>`;
  const frame=main.querySelector('iframe');frame.src=result.url;
  frame.addEventListener('load',()=>{const status=document.querySelector('#player-status');if(status)status.textContent='Дуу идэвхжүүлэхийн тулд тоглоом дээр дарна уу.';});
}
function checkout(id) {
  const g=games.find(g=>g.id===id);if(!g)return;
  if(owned.has(id)){dialog.close();location.hash='library';return;}
  if(!user){pendingGame=id;showAuth('login');return;}
  if(!demoEnabled){notify('Туршилтын захиалга идэвхгүй байна.');return;}
  openModal(`<div class="detail-body"><div class="eyebrow">ТУРШИЛТЫН ЗАХИАЛГА</div><h2 id="modal-title">Захиалгаа шалгах</h2><p>${esc(g.title)} · Бүтэн тоглоом</p><div class="detail-facts"><div><span>Нийт жишээ дүн</span><strong>${money(g.price)}</strong></div></div><p class="notice">Мөнгө суутгахгүй. ${esc(user.name)}-ийн туршилтын санд хадгална. Төлбөртэй эрх үүсгэхгүй. Оруулсан тоглоомыг зөвхөн туршилтын горимд нээж болно.</p><p id="form-error" class="form-error" role="alert"></p><div class="purchase-row"><button class="btn secondary" data-game="${esc(g.id)}">Буцах</button><button class="btn" data-confirm="${esc(g.id)}">Туршилтаар сандаа нэмэх</button></div></div>`);
}
function showAuth(mode='login') {
  const register=mode==='register';
  openModal(`<div class="detail-body"><div class="eyebrow">STORYPLAY ACCOUNT</div><h2 id="modal-title">${register?'Бүртгэл үүсгэх':'Тавтай морил'}</h2><p>${pendingGame?'Захиалгаа үргэлжлүүлэхийн тулд нэвтэрнэ үү.':'Өөрийн тоглоомын санг хадгалаарай.'}</p><form id="auth-form" data-mode="${mode}">${register?'<label>Таны нэр<input name="name" autocomplete="nickname" minlength="2" maxlength="60" required></label>':''}<label>Имэйл<input name="email" type="email" autocomplete="email" maxlength="254" required></label><label>Нууц үг<input name="password" type="password" autocomplete="${register?'new-password':'current-password'}" minlength="10" maxlength="128" required aria-describedby="password-help"></label><small id="password-help">10–128 тэмдэгттэй нууц үг.</small><p id="form-error" class="form-error" role="alert"></p><button class="btn" type="submit">${register?'Бүртгүүлэх':'Нэвтрэх'}</button></form><p><button class="text-btn" data-auth="${register?'login':'register'}">${register?'Бүртгэлтэй юу? Нэвтрэх':'Шинэ хэрэглэгч үү? Бүртгүүлэх'}</button></p></div>`);
}
function account() {
  if(!user)return showAuth();
  openModal(`<div class="detail-body"><div class="eyebrow">МИНИЙ БҮРТГЭЛ</div><h2 id="modal-title">${esc(user.name)}</h2><p>${esc(user.email)}</p><h3>Туршилтын захиалгын түүх</h3>${orders.length?`<ul class="order-list">${orders.map(o=>`<li><div>${esc(games.find(g=>g.id===o.gameId)?.title||o.gameId)}<small>${new Date(o.createdAt).toLocaleDateString('mn-MN')} · Туршилт</small></div><strong>${money(o.amount)}</strong></li>`).join('')}</ul>`:'<p>Захиалга хараахан үүсээгүй.</p>'}<p id="form-error" class="form-error" role="alert"></p><button class="btn secondary" data-logout>Гарах</button></div>`);
}
async function refreshLibrary() {
  if(!user){owned.clear();orders=[];return;}
  const [library,history,catalog]=await Promise.all([api('/library'),api('/orders'),api('/games')]);games=catalog.games;
  owned=new Set(library.demoGameIds);orders=history.orders;
}
async function load() {
  loading=true;failure='';render();
  try{const [catalog,me]=await Promise.all([api('/games'),api('/me')]);games=catalog.games;user=me.user;demoEnabled=me.demoEnabled;await refreshLibrary();}
  catch(e){failure=e.message;}
  loading=false;render();if(!failure&&location.hash.startsWith('#play/')){const id=location.hash.slice(6);if(games.some(g=>g.id===id))showGame(id);}
}
function displayError(e) { const p=document.querySelector('#form-error');if(p)p.textContent=e.message;else notify(e.message); }
document.addEventListener('click',async e=>{
  const target=e.target.closest('button');if(!target)return;
  try{
    if(target.matches('.close'))dialog.close();
    else if(target.hasAttribute('data-game'))showGame(target.dataset.game);
    else if(target.hasAttribute('data-filter')){filter=target.dataset.filter;render();}
    else if(target.hasAttribute('data-auth'))showAuth(target.dataset.auth);
    else if(target.hasAttribute('data-account'))account();
    else if(target.hasAttribute('data-retry'))await load();
    else if(target.hasAttribute('data-play')){target.disabled=true;await play(target.dataset.play);}
    else if(target.hasAttribute('data-fullscreen')){await document.querySelector('#game-shell').requestFullscreen();}
    else if(target.hasAttribute('data-checkout'))checkout(target.dataset.checkout);
    else if(target.hasAttribute('data-confirm')){
      target.disabled=true;
      await api('/demo-orders',{gameId:target.dataset.confirm});
      await refreshLibrary();render();showGame(target.dataset.confirm);notify('Туршилтын санд хадгалагдлаа.');
    }else if(target.hasAttribute('data-logout')){
      target.disabled=true;await api('/auth/logout',{});user=null;owned.clear();orders=[];dialog.close();render();notify('Бүртгэлээс гарлаа.');
    }
  }catch(err){displayError(err);target.disabled=false;}
});
document.addEventListener('submit',async e=>{
  if(e.target.id!=='auth-form')return;e.preventDefault();
  const form=e.target,button=form.querySelector('button[type=submit]');button.disabled=true;
  form.querySelector('#form-error').textContent='';
  try{
    const data=Object.fromEntries(new FormData(form));
    const result=await api('/auth/'+form.dataset.mode,data);user=result.user;
    await refreshLibrary();render();
    if(pendingGame){const id=pendingGame;pendingGame=null;checkout(id);}else{dialog.close();notify('Амжилттай нэвтэрлээ.');}
  }catch(err){displayError(err);button.disabled=false;}
});
main.addEventListener('input',e=>{if(e.target.matches('.search')){query=e.target.value;catalog();}});
dialog.addEventListener('close',()=>{pendingGame=null;});
dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close();}});
window.addEventListener('hashchange',()=>{if(location.hash.startsWith('#play/')&&document.querySelector('.game-frame'))return;if(dialog.open)dialog.close();render();});
load();
if(document.modelContext?.registerTool){try{Promise.resolve(document.modelContext.registerTool({name:'open_game_details',description:'Open a demo game detail view; does not purchase or add to library.',inputSchema:{type:'object',properties:{gameId:{type:'string'}},required:['gameId'],additionalProperties:false},annotations:{readOnlyHint:false},execute:({gameId})=>{if(loading||failure)throw Error('Catalog unavailable');showGame(gameId);return {opened:gameId};}})).catch(()=>{});}catch{}}
