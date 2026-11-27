// Descargas reales mediante los controles del panel; RPC simulado para no escribir en Supabase.
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
const directory='test-results/excel-compat';mkdirSync(directory,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--disable-gpu']});
try {
 const page=await browser.newPage({acceptDownloads:true});
 await page.addInitScript(()=>{
  const sample=(i,name,count,status='pendiente',names=[])=>({folio:'QA-COMPAT-'+i,token:`00000000-0000-4000-8000-${String(i).padStart(12,'0')}`,nombre:name,boletos:count,mesa:String(i),estado:status,confirmados:names.length,asistentes:names,telefono:'2220000000',cancion:'Vals de prueba',mensaje:'Respuesta de prueba',confirmado_en:status==='pendiente'?null:'2026-11-25T14:00:00Z'});
  window.excelQA={rows:[],sample};
  const client={auth:{getSession:async()=>({data:{session:{}}}),onAuthStateChange(){}}};
  const api={uuid:/^[\da-f-]{36}$/i,link:token=>location.origin+'/?invitado='+token,client:()=>client,rpc:async(name,args)=>{
   if(name==='listar')return structuredClone(excelQA.rows);
   if(name==='importar')return args.filas.map(r=>{let p=excelQA.rows.find(p=>p.folio===r.folio);if(p){p.nombre=r.nombre;p.boletos=r.boletos;if(r.mesa!==null)p.mesa=r.mesa;}else{p={...sample(excelQA.rows.length+100,r.nombre,r.boletos),folio:r.folio,mesa:r.mesa||''};excelQA.rows.push(p);}return structuredClone(p);});
   throw new Error('Operación no prevista en esta prueba: '+name);
  }};
  Object.defineProperty(window,'CamilaPases',{get:()=>api,set:()=>{}});
 });
 await page.goto('http://127.0.0.1:8000/admin.html');await page.locator('#panel').waitFor({state:'visible'});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 async function download(selector,name){const event=page.waitForEvent('download');await page.locator(selector).click();const d=await event;await d.saveAs(directory+'/'+name);return readFileSync(directory+'/'+name);}
 async function refresh(){await page.locator('#refresh').click();await page.waitForFunction(()=>!document.querySelector('#refresh').disabled);}
 async function upload(bytes){await page.locator('#archivo').setInputFiles({name:'Lista.xlsx',mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',buffer:bytes});await page.locator('#preview').waitFor({state:'visible'});assert.equal(await page.locator('#confirmImport').isDisabled(),false);}
 async function parse(bytes){return page.evaluate(async b=>{const data=await CamilaExcel.readList(Uint8Array.from(atob(b),c=>c.charCodeAt(0)));const additional=[...data.book.doc.getElementsByTagNameNS('*','c')].map(c=>c.getAttribute('t')==='s'?data.book.strings[Number(c.getElementsByTagNameNS('*','v')[0]?.textContent)]:[...c.getElementsByTagNameNS('*','t')].map(t=>t.textContent).join('')).filter(t=>t?.startsWith('Nota propia'));return {entries:data.entries,additional};},bytes.toString('base64'));}
 if(process.argv.includes('--verify-saved')){
  const manifest=JSON.parse(readFileSync(directory+'/manifest.json','utf8'));
  for(const item of manifest.filter(x=>x.entries)){
   const saved=readFileSync(directory+'/'+item.file.replace('.xlsx','-excel.xlsx')),actual=await parse(saved);
   assert.deepEqual(actual.entries.map(p=>[p.folio,p.token,p.nombre,p.boletos,p.mesa]),item.entries.map(p=>[p.folio,p.token,p.nombre,p.boletos,p.mesa]),item.file);
   assert.deepEqual(actual.additional,item.additional,item.file+' columnas propias');
  }
  // Importación de la copia guardada por Excel: resuelve por identidad, sin duplicar familias iguales.
  const item=manifest.find(x=>x.file==='02-importados.xlsx');await page.evaluate(rows=>{excelQA.rows=rows;},item.passes);
  await upload(readFileSync(directory+'/02-importados-excel.xlsx'));
  assert.match(await page.locator('#previewSummary').textContent(),/2 sin cambios/);
  const bytes=await download('#confirmImport','08-reimportado-desde-excel.xlsx');await page.locator('#preview').waitFor({state:'hidden'});
  assert.equal(await page.evaluate(()=>excelQA.rows.length),2);
  assert.deepEqual((await parse(bytes)).entries.map(p=>[p.folio,p.token]),item.entries.map(p=>[p.folio,p.token]));
  console.log('PASS: guardado en Excel conserva IDs ocultos, enlaces y columnas propias; reimportación desde panel sin duplicados.');
 }else{
  const manifest=[];
  async function capture(name,bytes){const value=await parse(bytes);manifest.push({file:name,...value,passes:await page.evaluate(()=>structuredClone(excelQA.rows))});}
  const blank=await download('a[download][href*="Plantilla_invitados"]','01-plantilla-vacia.xlsx');manifest.push({file:'01-plantilla-vacia.xlsx'});
  const input=Buffer.from(await page.evaluate(async base=>{
   const zip=await JSZip.loadAsync(Uint8Array.from(atob(base),c=>c.charCodeAt(0)));const doc=new DOMParser().parseFromString(await zip.file('xl/worksheets/sheet1.xml').async('string'),'application/xml'),data=doc.getElementsByTagNameNS('*','sheetData')[0];data.replaceChildren();
   [['Familia o invitado','Boletos','Mesa','Notas del organizador'],['Familia Igual',6,'2','Nota propia A'],['Familia Igual',3,'3','Nota propia B']].forEach((vals,i)=>{const row=doc.createElementNS(data.namespaceURI,'row');row.setAttribute('r',i+1);vals.forEach((val,j)=>{const c=doc.createElementNS(data.namespaceURI,'c');c.setAttribute('r',String.fromCharCode(65+j)+(i+1));c.setAttribute('t','inlineStr');const is=doc.createElementNS(data.namespaceURI,'is'),t=doc.createElementNS(data.namespaceURI,'t');t.textContent=val;is.append(t);c.append(is);row.append(c);});data.append(row);});zip.file('xl/worksheets/sheet1.xml',new XMLSerializer().serializeToString(doc));return zip.generateAsync({type:'base64'});
  },blank.toString('base64')),'base64');
  await upload(input);const imported=await download('#confirmImport','02-importados.xlsx');await page.locator('#preview').waitFor({state:'hidden'});await capture('02-importados.xlsx',imported);const importedPasses=await page.evaluate(()=>structuredClone(excelQA.rows));
  await page.evaluate(()=>excelQA.rows=[excelQA.sample(1,'Invitado individual',1,'asiste',['Ana'])]);await refresh();await capture('03-un-invitado.xlsx',await download('#downloadAll','03-un-invitado.xlsx'));
  await page.evaluate(()=>excelQA.rows=[1,2,3].map(i=>excelQA.sample(i,'Familia de prueba '+i,i+1)));await refresh();await capture('04-multiples.xlsx',await download('#downloadAll','04-multiples.xlsx'));
  await page.evaluate(()=>excelQA.rows=[excelQA.sample(1,'Familia confirmada',2,'asiste',['Ana','Luis']),excelQA.sample(2,'Familia parcial',6,'asiste',['María','José','Luz','Pablo']),excelQA.sample(3,'Familia pendiente',3),excelQA.sample(4,'Familia no asiste',2,'no_asiste')]);await refresh();await capture('05-estados.xlsx',await download('#downloadAll','05-estados.xlsx'));
  await page.evaluate(()=>excelQA.rows=[excelQA.sample(1,'Familia Igual',2),excelQA.sample(2,'Familia Igual',4)]);await refresh();await capture('06-nombres-iguales.xlsx',await download('#downloadAll','06-nombres-iguales.xlsx'));
  await page.evaluate(rows=>{excelQA.rows=rows;},importedPasses);await refresh();await upload(imported);assert.match(await page.locator('#previewSummary').textContent(),/2 sin cambios/);await capture('07-reimportado.xlsx',await download('#confirmImport','07-reimportado.xlsx'));
  assert.equal(await page.evaluate(()=>excelQA.rows.length),2);writeFileSync(directory+'/manifest.json',JSON.stringify(manifest,null,2));
  console.log('PASS: siete archivos originales descargados desde el panel; datos ficticios aislados, sin Supabase. Pendiente validación nativa en Excel.');
 }
 assert.deepEqual(errors,[]);
}finally{await browser.close();}
