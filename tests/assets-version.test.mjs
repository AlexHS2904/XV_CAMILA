import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
test('Los recursos del panel y confirmación invalidan caché por contenido',()=>{
 for(const file of ['admin.html','index.html']){
  for(const [,path,version]of readFileSync(file,'utf8').matchAll(/(?:src|href)="(assets\/[^"?]+)(?:\?v=([^" ]+))?"/g)){
   const required=file==='admin.html'?/\.(css|js|xlsx)$/.test(path):['assets/css/confirmation.css','assets/js/invitado.js'].includes(path);
   if(required)assert.equal(version,createHash('sha256').update(readFileSync(path)).digest('hex').slice(0,12),path+' necesita npm run version:assets');
  }
 }
});
