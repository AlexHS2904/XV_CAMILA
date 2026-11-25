import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, existsSync, readdirSync} from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const read = file => readFileSync(file,'utf8');
function checkPath(file, reference) {
  if (!reference || /^(?:[a-z]+:|#|\/\/)/i.test(reference)) return;
  const target=decodeURIComponent(reference.split(/[?#]/)[0]);
  if (target) assert.ok(existsSync(path.resolve(path.dirname(file),target)),`${file} → ${target}`);
}
test('Todos los recursos HTML, CSS y JavaScript existen',()=>{
  for (const file of ['index.html','admin.html']) {
    const html=read(file);
    for (const [,value] of html.matchAll(/(?:src|href|poster)=["']([^"']+)["']/g)) checkPath(file,value);
    for (const [,value] of html.matchAll(/(?:srcset|imagesrcset)=["']([^"']+)["']/g)) {
      for (const entry of value.split(',')) checkPath(file,entry.trim().split(/\s/)[0]);
    }
  }
  for (const name of readdirSync('assets/css')) {
    const file='assets/css/'+name;
    for (const [,value] of read(file).matchAll(/url\(["']?([^)'"\s]+)["']?\)/g)) checkPath(file,value);
  }
  for (const name of readdirSync('assets/js')) {
    for (const [,value] of read('assets/js/'+name).matchAll(/["'](assets\/[^"']+)["']/g)) checkPath('index.html',value);
  }
});
test('Configuración pública exclusiva de XV_CAMILA',()=>{
  const sandbox={window:{}}; vm.runInNewContext(read('assets/js/config.js'),sandbox);
  assert.equal(sandbox.window.CAMILA_CONFIG.supabaseUrl,'https://bwwmrtxuninbqvoyuruo.supabase.co');
  assert.match(sandbox.window.CAMILA_CONFIG.publishableKey,/^sb_publishable_/);
});
test('La instalación de referencia coincide con la migración aplicada',()=>{
  assert.equal(read('supabase/instalar.sql'),read('supabase/migrations/20261125032250_camila_pases_seguros.sql'));
});
test('IDs de controles y enlaces de secciones sin duplicados ni destinos rotos',()=>{
  for (const file of ['index.html','admin.html']) {
    const html=read(file), ids=[...html.matchAll(/\bid=["']([^"']+)["']/g)].map(m=>m[1]);
    assert.equal(new Set(ids).size,ids.length,'IDs repetidos en '+file);
    for (const [,id] of html.matchAll(/href=["']#([^"']+)["']/g)) assert.ok(ids.includes(id),'Ancla faltante '+id);
  }
});
