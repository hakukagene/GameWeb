import { readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
for(const directory of ['server','scripts','dist','tests'])for(const file of readdirSync(directory)){
  if(!/\.(mjs|js)$/.test(file))continue;
  const result=spawnSync(process.execPath,['--check',`${directory}/${file}`],{stdio:'inherit'});
  if(result.status!==0)process.exit(result.status||1);
}
