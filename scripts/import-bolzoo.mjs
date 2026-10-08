import { readFileSync, writeFileSync, mkdirSync, mkdtempSync, rmSync, renameSync, existsSync, cpSync, copyFileSync, constants } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inflateRawSync } from 'node:zlib';
import { createHash } from 'node:crypto';

// Narrow ZIP reader: stored/deflated, single-disk ZIPs. Never follows archive paths or links.
const table=Array.from({length:256},(_,n)=>{for(let i=0;i<8;i++)n=(n&1)?0xedb88320^(n>>>1):n>>>1;return n>>>0;});
const crc=b=>{let c=0xffffffff;for(const n of b)c=table[(c^n)&255]^(c>>>8);return(c^0xffffffff)>>>0;};
const removeTemporary=path=>rmSync(path,{recursive:true,force:true,maxRetries:3,retryDelay:100});

// Windows scanners and some mapped drives can block a directory rename even
// though ordinary file copies work. Install the entry page only after all other
// files have arrived, so the player cannot launch a partially copied build.
export function installStagedBuild(staging,target,{renameDirectory=renameSync,copyDirectory=cpSync}={}) {
  try { renameDirectory(staging,target);return {installation:'rename'}; }
  catch(error) { if(!['EPERM','EACCES','EBUSY','EXDEV'].includes(error.code))throw error; }
  mkdirSync(target); // Exclusive: never copy into an existing build or symlink.
  try {
    const entry=join(staging,'index.html');
    copyDirectory(staging,target,{recursive:true,force:false,errorOnExist:true,filter:source=>source!==entry});
    const pendingEntry=join(target,'.bolzoo-index.html');
    copyFileSync(entry,pendingEntry,constants.COPYFILE_EXCL);
    renameSync(pendingEntry,join(target,'index.html'));
  } catch(error) {
    try { removeTemporary(target); }
    catch(cleanup) { error.message+=`\nIncomplete folder could not be removed: ${target} (${cleanup.code}). Move it to a backup before retrying.`; }
    throw error;
  }
  try { removeTemporary(staging); }
  catch(error) { return {installation:'copy',warning:`Build installed, but temporary folder remains: ${staging} (${error.code}). It can be removed after closing programs that are using it.`}; }
  return {installation:'copy'};
}
export function importBolzoo(archive, contentRoot) {
  const zip=readFileSync(archive);if(zip.length>512*1024*1024)throw Error('ZIP exceeds 512 MB.');
  let end=-1;
  for(let i=zip.length-22;i>=Math.max(0,zip.length-65557);i--)if(zip.readUInt32LE(i)===0x06054b50&&i+22+zip.readUInt16LE(i+20)===zip.length){end=i;break;}
  if(end<0)throw Error('Invalid ZIP ending.');
  const count=zip.readUInt16LE(end+10),offset=zip.readUInt32LE(end+16),centralSize=zip.readUInt32LE(end+12);
  if(zip.readUInt16LE(end+4)||zip.readUInt16LE(end+6)||zip.readUInt16LE(end+8)!==count||count===65535||count>5000||offset+centralSize!==end)throw Error('Unsupported ZIP64/multi-disk archive or too many files.');
  const entries=[],names=new Set();let pos=offset,total=0;
  for(let i=0;i<count;i++){
    if(pos+46>end||zip.readUInt32LE(pos)!==0x02014b50)throw Error('Invalid ZIP directory.');
    const flags=zip.readUInt16LE(pos+8),method=zip.readUInt16LE(pos+10),checksum=zip.readUInt32LE(pos+16),packed=zip.readUInt32LE(pos+20),size=zip.readUInt32LE(pos+24),nl=zip.readUInt16LE(pos+28),extra=zip.readUInt16LE(pos+30),comment=zip.readUInt16LE(pos+32),mode=zip.readUInt32LE(pos+38)>>>16,local=zip.readUInt32LE(pos+42);
    if(pos+46+nl+extra+comment>end)throw Error('Invalid ZIP entry.');
    const name=zip.subarray(pos+46,pos+46+nl).toString('utf8');pos+=46+nl+extra+comment;
    const parts=name.replace(/\/$/,'').split('/');
    if(!name||name.startsWith('/')||name.includes('\\')||/[\x00-\x1f:*?"<>|]/.test(name)||parts.some(p=>!p||p==='.'||p==='..'||p.startsWith('.')||/[. ]$/.test(p)||/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(p))||(mode&0xf000)===0xa000||names.has(name.toLowerCase()))throw Error('Unsafe or duplicate ZIP path.');
    names.add(name.toLowerCase());total+=size;
    if(flags&1||![0,8].includes(method)||size>128*1024*1024||total>1024*1024*1024)throw Error('Unsupported or oversized ZIP entry.');
    if(local+30>offset||zip.readUInt32LE(local)!==0x04034b50)throw Error('Invalid ZIP local header.');
    const start=local+30+zip.readUInt16LE(local+26)+zip.readUInt16LE(local+28);
    if(start+packed>offset)throw Error('Invalid ZIP data length.');
    entries.push({name,size,checksum,method,start,packed});
  }
  if(pos!==end)throw Error('Invalid ZIP central directory size.');
  let prefix='';
  if(!entries.some(e=>e.name==='index.html')){
    const roots=entries.filter(e=>e.name.endsWith('/index.html'));
    if(roots.length!==1)throw Error('Web build index.html not found.');prefix=roots[0].name.slice(0,-10);
  }
  for(const required of ['index.html','renpy.js','renpy-pre.js','renpy.wasm','renpy.data','game.zip'])if(!entries.some(e=>e.name===prefix+required&&e.size>0))throw Error('Missing Ren’Py build file: '+required);
  mkdirSync(contentRoot,{recursive:true});const target=join(contentRoot,'bolzoo');
  if(existsSync(target))throw Error('game-content/bolzoo already exists. Move it to a backup folder before importing an update.');
  const staging=mkdtempSync(join(contentRoot,'.bolzoo-'));
  try{
    for(const e of entries){
      if(!e.name.startsWith(prefix)||e.name.endsWith('/'))continue;
      const relative=e.name.slice(prefix.length);const path=join(staging,relative);
      const packed=zip.subarray(e.start,e.start+e.packed);
      const data=e.method===0?packed:inflateRawSync(packed,{maxOutputLength:Math.max(e.size,1)});
      if(data.length!==e.size||crc(data)!==e.checksum)throw Error('Corrupt ZIP entry: '+e.name);
      mkdirSync(dirname(path),{recursive:true});writeFileSync(path,data);
    }
    writeFileSync(join(staging,'import-info.json'),JSON.stringify({title:'Болзоо',sha256:createHash('sha256').update(zip).digest('hex'),files:entries.length,bytes:total,importedAt:new Date().toISOString()},null,2));
    const installed=installStagedBuild(staging,target);return {target,files:entries.length,bytes:total,...installed};
  }catch(e){
    try { removeTemporary(staging); }
    catch(cleanup) { e.message+=`\nTemporary folder could not be removed: ${staging} (${cleanup.code}).`; }
    throw e;
  }
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  try{if(!process.argv[2])throw Error('Usage: npm run import:bolzoo -- "C:\\path\\NewProject-1.0-web.zip"');console.log(importBolzoo(resolve(process.argv[2]),resolve(process.env.GAME_CONTENT_ROOT||'./game-content')));}
  catch(e){console.error(e.message);process.exitCode=1;}
}
