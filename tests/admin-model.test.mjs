import test from 'node:test';
import assert from 'node:assert/strict';
import model from '../assets/js/admin-model.js';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const p=(folio,nombre,boletos,estado='pendiente',confirmados=0)=>({folio,token:folio,nombre,boletos,estado,confirmados,mesa:''});
test('Confirmación parcial: 6 asignados, 4 confirmados, 2 sin utilizar, ninguno pendiente',()=>{
 const s=model.stats([p('1','Familia',6,'asiste',4)]);assert.equal(s.confirmados,4);assert.equal(s.pendientes,0);assert.equal(s.noUtilizados,2);assert.equal(s.respondidas,1);assert.equal(s.respuesta,100);assert.equal(s.confirmacion,4/6*100);
});
test('Los totales siempre suman; personas e invitaciones tienen denominadores distintos',()=>{
 const rows=[p('1','A',6,'asiste',4),p('2','B',3),p('3','C',2,'no_asiste'),p('4','D',1,'asiste',1)],s=model.stats(rows);
 assert.equal(s.invitaciones,4);assert.equal(s.asignados,12);assert.equal(s.confirmados,5);assert.equal(s.pendientes,3);assert.equal(s.noUtilizados,4);assert.equal(s.respondidas,3);assert.equal(s.noAsisten,1);assert.equal(s.respuesta,75);
 for(let n=0;n<200;n++){const data=Array.from({length:n%20},(_,i)=>{const assigned=i%15+1;return p(String(i),'Familia',assigned,['pendiente','asiste','no_asiste'][i%3],i%3===1?Math.max(1,assigned-2):0);});const r=model.stats(data);assert.equal(r.asignados,r.confirmados+r.pendientes+r.noUtilizados);assert.equal(r.invitaciones,r.respondidas+r.familiasPendientes);assert.ok(Number.isFinite(r.confirmacion));}
});
test('Búsqueda acentuada, filtros parciales y orden natural de mesa',()=>{
 const rows=[{...p('1','Álvarez',6,'asiste',4),mesa:'10'},{...p('2','Familia',3,'asiste',3),mesa:'2'},p('3','Otra',2,'no_asiste')];
 assert.equal(model.select(rows,{search:'alvarez'})[0].folio,'1');assert.equal(model.select(rows,{filter:'confirmados'}).length,2);assert.equal(model.select(rows,{filter:'parcial'}).length,1);assert.equal(model.select(rows,{sort:'mesa'}).at(-1).mesa,'10');
});
test('Familias iguales requieren resolver el conflicto sin usar el nombre como identidad',()=>{
 const saved=[p('1','Familia Igual',4),p('2','Familia Igual',4)],entry={fila:2,folio:'GENERATED',nombre:'Familia Igual',boletos:4,mesa:null,explicitId:false,token:null};
 assert.equal(model.plan([entry],saved)[0].operation,'Conflicto');
 const newPass=model.plan([entry],saved,{2:'new:F-UNIQUE'})[0];assert.equal(newPass.operation,'Nueva');assert.equal(newPass.row.folio,'F-UNIQUE');
 const update=model.plan([entry],saved,{2:'2'})[0];assert.equal(update.row.folio,'2');assert.equal(update.row.token,'2');
 assert.equal(model.plan([{...entry,folio:'1',explicitId:true,token:'2'}],saved)[0].operation,'Conflicto');
 assert.equal(model.plan([{...entry,folio:'DELETED',explicitId:true}],saved)[0].operation,'Conflicto');
});
test('Importar nunca reduce cupo confirmado ni dirige dos filas al mismo registro',()=>{
 const saved=[p('1','A',6,'asiste',4)],entry={fila:2,folio:'1',nombre:'A',boletos:3,mesa:null,explicitId:true};
 assert.equal(model.plan([entry],saved)[0].operation,'Conflicto');
 const valid={...entry,boletos:6};assert.equal(model.plan([valid,{...valid,fila:3}],saved)[1].operation,'Conflicto');
});
test('URL publicada conserva la carpeta de GitHub Pages y rechaza localhost',()=>{
 const location=new URL('https://alexhs2904.github.io/XV_CAMILA/admin.html');const sandbox={window:{CAMILA_CONFIG:{},location},URL};
 vm.runInNewContext(readFileSync('assets/js/pases-api.js','utf8'),sandbox);const token='12345678-1234-1234-1234-123456789abc';
 assert.equal(sandbox.window.CamilaPases.link(token),'https://alexhs2904.github.io/XV_CAMILA/?invitado='+token);
 sandbox.window.CAMILA_CONFIG.invitationUrl='http://localhost:8000/';assert.throws(()=>sandbox.window.CamilaPases.link(token),/localhost/);
});
