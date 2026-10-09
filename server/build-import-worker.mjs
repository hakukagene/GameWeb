import { parentPort, workerData } from 'node:worker_threads';
import { importGame } from '../scripts/import-bolzoo.mjs';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
try {
  const result=importGame(workerData.archive,workerData.parent,workerData.id);
  const info=JSON.parse(readFileSync(join(result.target,'import-info.json'),'utf8'));
  parentPort.postMessage({ok:true,files:result.files,bytes:result.bytes,sha256:info.sha256});
}catch(e){parentPort.postMessage({ok:false,error:e.message});}
