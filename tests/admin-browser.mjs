import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--disable-gpu']});
try {
 const page=await browser.newPage({viewport:{width:1440,height:1000}});
 // Simula solo fallos y concurrencia de red. El flujo real se cubre en live.mjs.
 await page.addInitScript(()=>{
  const rows=[{folio:'TEST-1',token:'12345678-1234-1234-1234-123456789abc',nombre:'Familia inicial',boletos:6,confirmados:4,estado:'asiste',asistentes:['A','B','C','D'],mesa:'2',telefono:'',cancion:'',mensaje:'',confirmado_en:null}];
  window.qa={hold:false,fail:false,rows};
  const api={uuid:/^[a-f0-9-]{36}$/i,link:token=>'http://127.0.0.1:8000/?invitado='+token,client:()=>({auth:{onAuthStateChange(){},getSession:async()=>({data:{session:{}}})}}),rpc:async(name,args)=>{
   if(name==='listar'){if(qa.fail)throw new Error('Conexión interrumpida.');const snapshot=structuredClone(rows);if(qa.hold){qa.hold=false;return new Promise(resolve=>qa.release=()=>resolve(snapshot));}return snapshot;}
   if(name==='importar'){return args.filas.map(row=>{let p=rows.find(p=>p.folio===row.folio);if(p)Object.assign(p,{nombre:row.nombre,mesa:row.mesa,boletos:row.boletos});else{p={...row,token:crypto.randomUUID(),estado:'pendiente',confirmados:0,asistentes:[],telefono:'',cancion:'',mensaje:'',confirmado_en:null};rows.push(p);}return structuredClone(p);});}
   if(name==='eliminar'){rows.splice(rows.findIndex(p=>p.folio===args.p_folio),1);return true;}
  }};
  Object.defineProperty(window,'CamilaPases',{get:()=>api,set:()=>{}});
 });
 await page.goto('http://127.0.0.1:8000/admin.html');await page.locator('#panel').waitFor({state:'visible'});
 for(const width of [1440,390]){await page.setViewportSize({width,height:1000});const a=await page.locator('#oneCount').boundingBox(),b=await page.locator('#oneTable').boundingBox();assert.ok(Math.abs(a.y-b.y)<2);}
 await page.setViewportSize({width:1440,height:1000});
 await page.evaluate(()=>qa.hold=true);await page.locator('#refresh').click();await page.waitForFunction(()=>Boolean(qa.release));
 await page.locator('#oneName').fill('Nueva durante consulta');await page.locator('#onePass button').click();await page.waitForFunction(()=>qa.rows.length===2);await page.evaluate(()=>qa.release());
 await page.waitForFunction(()=>document.querySelector('#invitationCount').textContent==='2');assert.equal(await page.locator('#oneName').inputValue(),'');
 await page.evaluate(()=>qa.fail=true);await page.locator('#oneName').fill('Guardada sin refresco');await page.locator('#onePass button').click();await page.waitForFunction(()=>document.querySelector('#createStatus').textContent.includes('se creó'));
 assert.equal(await page.evaluate(()=>qa.rows.length),3);assert.equal(await page.locator('#createdLink').isVisible(),true);assert.equal(await page.locator('#oneName').inputValue(),'');
 await page.locator('#saved tr').first().getByRole('button',{name:'Editar',exact:true}).click();await page.locator('#editName').fill('Cambio guardado');await page.locator('#editPass button[type=submit]').click();await page.waitForFunction(()=>document.querySelector('#tableStatus').textContent.includes('Los cambios se guardaron'));
 assert.equal(await page.locator('#editDialog').isVisible(),false);
 page.on('dialog',dialog=>dialog.accept());await page.locator('#saved tr').first().getByRole('button',{name:'Eliminar',exact:true}).click();await page.waitForFunction(()=>document.querySelector('#tableStatus').textContent.includes('se eliminó'));
 assert.equal(await page.evaluate(()=>qa.rows.length),2);
 console.log('PASS Panel: campos alineados, consulta simultánea sin datos obsoletos y escritura confirmada con fallo de actualización.');
}finally{await browser.close();}
