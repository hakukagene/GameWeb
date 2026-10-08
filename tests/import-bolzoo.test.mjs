import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync,writeFileSync,readFileSync,existsSync,rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { importBolzoo } from '../scripts/import-bolzoo.mjs';
// One-byte stored payload (CRC32('x') = 0x8cdc1683) keeps fixtures independent of the importer.
function archive(names){const locals=[],central=[];let offset=0;for(const name of names){const n=Buffer.from(name),h=Buffer.alloc(30),c=Buffer.alloc(46);h.writeUInt32LE(0x04034b50);h.writeUInt32LE(0x8cdc1683,14);h.writeUInt32LE(1,18);h.writeUInt32LE(1,22);h.writeUInt16LE(n.length,26);const part=Buffer.concat([h,n,Buffer.from('x')]);locals.push(part);c.writeUInt32LE(0x02014b50);c.writeUInt32LE(0x8cdc1683,16);c.writeUInt32LE(1,20);c.writeUInt32LE(1,24);c.writeUInt16LE(n.length,28);c.writeUInt32LE(offset,42);central.push(c,n);offset+=part.length;}const ct=Buffer.concat(central),e=Buffer.alloc(22);e.writeUInt32LE(0x06054b50);e.writeUInt16LE(names.length,8);e.writeUInt16LE(names.length,10);e.writeUInt32LE(ct.length,12);e.writeUInt32LE(offset,16);return Buffer.concat([...locals,ct,e]);}
const required=['index.html','renpy.js','renpy-pre.js','renpy.wasm','renpy.data','game.zip'];
test('ZIP import, nested root, refusal to overwrite and traversal rejection',()=>{
 const root=mkdtempSync(join(tmpdir(),'import-game-'));try{
  const file=join(root,'build.zip'),dest=join(root,'content');writeFileSync(file,archive(required.map(n=>'build/'+n)));
  const result=importBolzoo(file,dest);assert.equal(result.files,6);assert.equal(readFileSync(join(dest,'bolzoo/index.html'),'utf8'),'x');assert.throws(()=>importBolzoo(file,dest),/already exists/);
  for(const name of ['../escape.txt','bad\\file','/absolute','CON.txt']){writeFileSync(file,archive([...required,name]));assert.throws(()=>importBolzoo(file,join(root,'unsafe')),/Unsafe/);}
  assert.equal(existsSync(join(root,'escape.txt')),false);
  const bad=archive(required);bad[30+Buffer.byteLength(required[0])]=121;writeFileSync(file,bad);assert.throws(()=>importBolzoo(file,join(root,'corrupt')),/Corrupt/);assert.equal(existsSync(join(root,'corrupt/bolzoo')),false);
 }finally{rmSync(root,{recursive:true,force:true});}
});
