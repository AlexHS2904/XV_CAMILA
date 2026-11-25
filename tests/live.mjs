import assert from 'node:assert/strict';
import {randomBytes, randomUUID} from 'node:crypto';
import {readFileSync, mkdirSync} from 'node:fs';
import {createInterface} from 'node:readline/promises';
import vm from 'node:vm';
import {spawnSync} from 'node:child_process';
import {chromium} from 'playwright';

const sandbox = {window:{}};
vm.runInNewContext(readFileSync('assets/js/config.js','utf8'), sandbox);
const {supabaseUrl, publishableKey} = sandbox.window.CAMILA_CONFIG;
assert.equal(supabaseUrl, 'https://bwwmrtxuninbqvoyuruo.supabase.co');
const username = 'qa-' + Date.now();
const email = username + '@admin.com';
const password = randomBytes(30).toString('base64url');
const prefix = username.toUpperCase();
const base = 'http://127.0.0.1:8000';
const headers = {apikey:publishableKey, 'Content-Type':'application/json'};
async function request(path, body, access, method='POST') {
  const response = await fetch(supabaseUrl+path, {method, headers:{...headers,...(access ? {Authorization:'Bearer '+access} : {})}, ...(body===undefined ? {} : {body:JSON.stringify(body)})});
  const text = await response.text();
  return {ok:response.ok,status:response.status,data:text ? JSON.parse(text) : null};
}
const rpc = (name, body={}, access) => request('/rest/v1/rpc/camila_xv_'+name,body,access);
// Cuenta desechable de QA. Solo se entrega el hash a la conexión SQL de confianza.
const userId = randomUUID();
const hashResult = spawnSync('htpasswd',['-niBC','12','qa'],{input:password+'\n',encoding:'utf8'});
assert.equal(hashResult.status,0);
const passwordHash = hashResult.stdout.trim().split(':')[1];
assert.ok(passwordHash.startsWith('$2'));
console.log(JSON.stringify({stage:'CREATE_QA_USER_WITH_HASH',email,userId,prefix,passwordHash}));
console.log('Crea solo esta cuenta temporal con el hash y autorízala; después pulsa Enter. Nunca se imprime ni guarda la contraseña.');
const input = createInterface({input:process.stdin,output:process.stdout});
await input.question('Continuar: '); input.close();
const browser = await chromium.launch({channel:'chrome',headless:true,args:['--disable-gpu']});
const context = await browser.newContext({viewport:{width:1440,height:1000},acceptDownloads:true});
const page = await context.newPage();
const errors = [], broken = [];
page.on('pageerror', e=>errors.push(e.message));
page.on('response', r=>{if(r.url().startsWith(base) && r.status()>=400) broken.push(r.url());});
let access;
const owned=p=>p.nombre.startsWith(prefix+' ');
const current=async()=>{const r=await rpc('listar',{},access);assert.ok(r.ok);return r.data;};
function passed(name){console.log('PASS '+name);}
async function add(name,count,table=''){
 const before=await page.locator('#openCreated').getAttribute('href');
 await page.locator('#oneName').fill(name);await page.locator('#oneCount').fill(String(count));await page.locator('#oneTable').fill(table);
 await page.locator('#onePass button').click();
 await page.waitForFunction(before=>document.querySelector('#openCreated').getAttribute('href')!==before && document.querySelector('#oneName').value==='',before);
 const token=new URL(await page.locator('#openCreated').getAttribute('href')).searchParams.get('invitado');
 return (await current()).find(p=>p.token===token);
}
async function workbook(rows){
 return Buffer.from(await page.evaluate(async rows=>{
  const zip=await JSZip.loadAsync(await (await fetch('assets/excel/Plantilla_invitados.xlsx')).arrayBuffer()),path='xl/worksheets/sheet1.xml';
  const doc=new DOMParser().parseFromString(await zip.file(path).async('string'),'application/xml'),data=doc.getElementsByTagNameNS('*','sheetData')[0];data.replaceChildren();
  [['Familia o invitado','Boletos','Mesa','Notas del organizador'],...rows].forEach((values,i)=>{const row=doc.createElementNS(data.namespaceURI,'row');row.setAttribute('r',i+1);values.forEach((v,j)=>{const c=doc.createElementNS(data.namespaceURI,'c'),s=doc.createElementNS(data.namespaceURI,'is'),t=doc.createElementNS(data.namespaceURI,'t');c.setAttribute('r',String.fromCharCode(65+j)+(i+1));c.setAttribute('t','inlineStr');t.textContent=v;s.append(t);c.append(s);row.append(c);});data.append(row);});
  zip.file(path,new XMLSerializer().serializeToString(doc));return zip.generateAsync({type:'base64'});
 },rows),'base64');
}
async function upload(bytes){await page.locator('#archivo').setInputFiles({name:'Invitados_QA.xlsx',mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',buffer:bytes});await page.locator('#preview').waitFor({state:'visible'});}
async function importDownload(){const promise=page.waitForEvent('download');await page.locator('#confirmImport').click();const file=await (await promise).path();await page.locator('#preview').waitFor({state:'hidden'});return readFileSync(file);}
async function readBook(bytes){return page.evaluate(async b=>{const parsed=await CamilaExcel.readList(Uint8Array.from(atob(b),c=>c.charCodeAt(0)).buffer);return parsed.entries;},bytes.toString('base64'));}
async function assertDashboard(){
 await page.locator('#refresh').click();await page.waitForFunction(()=>!document.querySelector('#refresh').disabled);
 const all=await current();const assigned=all.reduce((s,p)=>s+p.boletos,0),confirmed=all.reduce((s,p)=>s+p.confirmados,0),pending=all.filter(p=>p.estado==='pendiente').reduce((s,p)=>s+p.boletos,0),unused=all.filter(p=>p.estado!=='pendiente').reduce((s,p)=>s+p.boletos-p.confirmados,0),responded=all.filter(p=>p.estado!=='pendiente').length;
 assert.equal(assigned,confirmed+pending+unused);
 const expected=[all.length,assigned,confirmed,pending,unused,responded,all.length-responded,all.filter(p=>p.estado==='no_asiste').length,(assigned?confirmed/assigned*100:0).toFixed(1)+' %',(all.length?responded/all.length*100:0).toFixed(1)+' %'].map(String);
 assert.deepEqual(await page.locator('#metrics .metric strong').allTextContents(),expected);
}
try{
 await page.goto(base+'/admin.html');assert.equal(await page.locator('#panel').isVisible(),false);
 assert.equal((await rpc('listar')).ok,false);assert.equal((await rpc('importar',{filas:[]})).ok,false);assert.equal((await rpc('eliminar',{p_folio:'QA',p_token:randomUUID()})).ok,false);
 for(const table of ['pases','organizadoras'])assert.equal((await request('/rest/v1/'+table+'?select=*',undefined,undefined,'GET')).ok,false);
 await page.locator('#username').fill(username);await page.locator('#password').fill('incorrecta');await page.locator('#loginForm button').click();await page.waitForFunction(()=>document.querySelector('#loginStatus').dataset.error==='true');
 await page.locator('#password').fill(password);await page.locator('#loginForm button').click();await page.locator('#panel').waitFor({state:'visible'});
 access=await page.evaluate(async()=>(await CamilaPases.client().auth.getSession()).data.session.access_token);
 assert.ok(await page.locator('#onePass').isVisible());assert.equal(await page.locator('#oneFolio').count(),0);
 passed('Autenticación, rechazo anónimo y formulario de alta visible sin folios');
 const individual=await add(prefix+' Individual',1);
 const family=await add(prefix+' Familia igual',6,'2');
 const duplicate=await add(prefix+' Familia igual',2,'10');
 assert.notEqual(family.folio,duplicate.folio);assert.notEqual(family.token,duplicate.token);
 assert.equal(await page.locator('#oneCount').inputValue(),'1');
 await page.locator('#guestSearch').fill(prefix+' Familia igual');assert.equal(await page.locator('#saved tr').count(),2);
 await page.locator('#saved tr').filter({hasText:'0 / 6'}).getByRole('button',{name:'Editar',exact:true}).click();
 await page.locator('#editName').fill(prefix+' Familia editada');await page.locator('#editTable').fill('8');await page.locator('#editPass button[type=submit]').click();await page.locator('#editDialog').waitFor({state:'hidden'});
 const edited=(await current()).find(p=>p.folio===family.folio);assert.equal(edited.token,family.token);assert.equal(edited.mesa,'8');
 await page.locator('#guestSearch').fill('');await assertDashboard();passed('Alta, nombres iguales, edición y enlaces persistentes');
 const guestContext=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});const guest=await guestContext.newPage();guest.on('pageerror',e=>errors.push(e.message));
 await guest.goto(base+'/?invitado='+family.token);await guest.locator('#openRsvp').waitFor({state:'visible'});await guest.locator('#openRsvp').click();
 await guest.locator('#rsvpSeatsSelect').selectOption('4');for(let i=0;i<4;i++)await guest.locator('.attendee-name-input').nth(i).fill('Persona ficticia '+(i+1));
 await guest.locator('#rsvpSong').fill('Un vals de prueba');await guest.locator('#rsvpMessage').fill('Gracias, mensaje ficticio.');await guest.locator('#saveRsvp').click();await guest.locator('#respuesta-guardada').waitFor({state:'visible'});
 assert.equal(await guest.locator('#successTitle').textContent(),'¡Asistencia confirmada!');assert.equal(await guest.locator('#successConfirmed').textContent(),'4');assert.equal(await guest.locator('#successNames li').count(),4);
 await guest.reload();await guest.locator('#respuesta-guardada').waitFor({state:'visible'});assert.equal(await guest.locator('#successConfirmed').textContent(),'4');
 const partial=(await rpc('ver',{p_token:family.token})).data;assert.ok(partial.confirmado_en);assert.equal(partial.confirmados,4);
 await page.bringToFront();await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await page.waitForFunction(()=>document.querySelectorAll('#metrics strong')[2].textContent==='4');await assertDashboard();
 assert.equal((await page.locator('#metrics .metric strong').allTextContents())[4],'2');
 await page.locator('[data-filter=parcial]').click();assert.equal(await page.locator('#saved tr').count(),1);
 await page.locator('#saved tr').getByRole('button',{name:'Detalles',exact:true}).click();assert.ok((await page.locator('#detailsBody').textContent()).includes('Persona ficticia 4'));await page.locator('[data-close=detailsDialog]').last().click();
 await page.locator('[data-filter=todos]').click();passed('Confirmación parcial 4/6, pantalla persistente, fecha real y estadísticas actualizadas al enfocar');
 // Un error de guardado nunca produce la pantalla de éxito.
 await guest.locator('#editResponse').click();assert.equal(await guest.locator('#rsvpSeatsSelect').inputValue(),'4');assert.equal(await guest.locator('#rsvpSong').inputValue(),'Un vals de prueba');
 await guest.route('**/rest/v1/rpc/camila_xv_responder',route=>route.fulfill({status:400,contentType:'application/json',body:JSON.stringify({message:'Error de prueba controlado'})}));
 await guest.locator('#saveRsvp').click();await guest.waitForFunction(()=>document.querySelector('#rsvpFeedback').textContent.includes('Error de prueba'));assert.equal(await guest.locator('#respuesta-guardada').isVisible(),false);await guest.unroute('**/rest/v1/rpc/camila_xv_responder');
 await guest.locator('#rsvpSeatsSelect').selectOption('3');await guest.locator('#saveRsvp').click();await guest.locator('#respuesta-guardada').waitFor({state:'visible'});assert.equal(await guest.locator('#successConfirmed').textContent(),'3');
 const updated=(await rpc('ver',{p_token:family.token})).data;assert.ok(new Date(updated.confirmado_en)>=new Date(partial.confirmado_en));assert.equal((await current()).filter(p=>p.folio===family.folio).length,1);
 assert.equal((await rpc('responder',{p_token:family.token,respuesta:{estado:'asiste',asistentes:['1','2','3','4','5','6','7']}})).ok,false);
 const beforeOther=(await rpc('ver',{p_token:duplicate.token})).data;
 assert.ok((await rpc('responder',{p_token:family.token,respuesta:{estado:'asiste',asistentes:['Uno','Dos','Tres'],token:duplicate.token,boletos:99,nombre:'Otro'}})).ok);assert.deepEqual((await rpc('ver',{p_token:duplicate.token})).data,beforeOther);
 passed('Edición de respuesta sin duplicados, error sin éxito falso, límites y aislamiento por token');
 const bytes=await workbook([[prefix+' Excel igual',4,'3','Conservar nota A'],[prefix+' Excel igual',2,'4','Conservar nota B']]);
 await upload(bytes);assert.ok((await page.locator('#previewSummary').textContent()).includes('2 nuevas'));const exportedBytes=await importDownload(),exported=await readBook(exportedBytes);
 assert.equal(exported.length,2);assert.notEqual(exported[0].folio,exported[1].folio);assert.notEqual(exported[0].token,exported[1].token);
 const firstExport=await page.evaluate(async b=>{const z=await JSZip.loadAsync(Uint8Array.from(atob(b),c=>c.charCodeAt(0)));return z.file('xl/worksheets/sheet1.xml').async('string');},exportedBytes.toString('base64'));assert.ok(firstExport.includes('Conservar nota A'));
 // Reimportar el mismo original y el exportado no duplica sus familias.
 const countBefore=(await current()).length;await upload(bytes);assert.ok((await page.locator('#previewSummary').textContent()).includes('2 sin cambios'));await importDownload();assert.equal((await current()).length,countBefore);
 await upload(exportedBytes);const exportedAgain=await readBook(await importDownload());assert.deepEqual(exportedAgain.map(p=>[p.folio,p.token]),exported.map(p=>[p.folio,p.token]));
 // Un archivo nuevo sin identidad pero con nombre coincidente exige resolución explícita.
 const conflictBytes=await workbook([[prefix+' Excel igual',1,'5','Otra familia']]);await upload(conflictBytes);assert.ok(await page.locator('#confirmImport').isDisabled());assert.ok((await page.locator('#previewSummary').textContent()).includes('1 con conflictos'));
 await page.locator('#sample select').selectOption('new');await importDownload();assert.equal((await current()).filter(p=>p.nombre===prefix+' Excel igual').length,3);
 // Reimportar una familia con respuesta modifica solo datos administrativos.
 const beforeResponse=(await rpc('ver',{p_token:family.token})).data;
 const familyExcel=Buffer.from(await page.evaluate(async p=>{const blob=await CamilaExcel.exportAll([{...p,nombre:p.nombre+' nueva',mesa:'9'}]);return new Promise(resolve=>{const r=new FileReader();r.onload=()=>resolve(r.result.split(',')[1]);r.readAsDataURL(blob);});},(await current()).find(p=>p.folio===family.folio)),'base64');
 await upload(familyExcel);await importDownload();const afterImport=(await current()).find(p=>p.folio===family.folio);
 assert.equal(afterImport.token,family.token);assert.equal(afterImport.confirmados,beforeResponse.confirmados);assert.deepEqual(afterImport.asistentes,beforeResponse.asistentes);assert.equal(afterImport.confirmado_en,beforeResponse.confirmado_en);assert.equal(afterImport.mesa,'9');
 passed('Excel: identidades ocultas, columnas propias, reimportación, conflictos, nombres iguales y respuestas conservadas');
 // Rechazo y actualización de la pantalla tras recargar.
 await guest.reload();await guest.locator('#respuesta-guardada').waitFor({state:'visible'});await guest.locator('#editResponse').click();await guest.locator('input[value=declined]').check({force:true});await guest.locator('#saveRsvp').click();await guest.locator('#respuesta-guardada').waitFor({state:'visible'});assert.equal(await guest.locator('#successTitle').textContent(),'Gracias por avisarnos');assert.equal(await guest.locator('#successConfirmed').textContent(),'0');await guest.reload();await guest.locator('#respuesta-guardada').waitFor({state:'visible'});
 await assertDashboard();await page.locator('[data-filter=rechazado]').click();assert.equal(await page.locator('#saved tr').count(),1);await page.locator('[data-filter=todos]').click();
 const download=page.waitForEvent('download');await page.locator('#downloadAll').click();const exportedAll=readFileSync(await (await download).path());assert.equal((await readBook(exportedAll)).length,(await current()).length);
 mkdirSync('test-results',{recursive:true});
 for(const width of [320,390,768]){await page.setViewportSize({width,height:844});await guest.setViewportSize({width,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));assert.ok(await guest.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));}
 await page.setViewportSize({width:390,height:844});await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:'test-results/admin-mobile.png',fullPage:true});await guest.setViewportSize({width:390,height:844});await guest.screenshot({path:'test-results/confirmation-mobile.png',fullPage:true});
 await page.setViewportSize({width:1440,height:1000});await page.screenshot({path:'test-results/admin-desktop.png',fullPage:true});
 passed('Rechazos, exportación completa, detalles y vistas móviles en 320/390/768 px');
 // Paginación con registros exclusivamente ficticios.
 const more=Array.from({length:14},(_,i)=>({folio:prefix+'-PAGE-'+i,nombre:prefix+' Página '+i,boletos:1,mesa:String(i+1)}));assert.ok((await rpc('importar',{filas:more},access)).ok);await assertDashboard();assert.equal(await page.locator('#saved tr').count(),12);await page.locator('#nextPage').click();assert.ok((await page.locator('#pageInfo').textContent()).includes('Página 2'));await page.locator('#guestSearch').fill(prefix+' Individual');
 page.once('dialog',d=>d.accept());await page.locator('#saved tr').getByRole('button',{name:'Eliminar',exact:true}).click();await page.waitForFunction(()=>!document.querySelector('#saved').textContent.includes('Individual'));assert.equal((await rpc('ver',{p_token:individual.token})).data,null);
 await page.locator('#guestSearch').fill('');await page.reload();await page.locator('#panel').waitFor({state:'visible'});passed('Paginación, eliminación con confirmación, enlace invalidado y persistencia al recargar');
 for(const p of (await current()).filter(owned))assert.ok((await rpc('eliminar',{p_folio:p.folio,p_token:p.token},access)).ok);
 await page.locator('#logout').click();await page.locator('#loginBox').waitFor({state:'visible'});assert.equal((await rpc('listar',{},access)).ok,false);await page.reload();assert.equal(await page.locator('#panel').isVisible(),false);
 console.log(JSON.stringify({stage:'REMOVE_QA_MEMBERSHIP',userId}));const next=createInterface({input:process.stdin,output:process.stdout});await next.question('Revoca solo la membresía QA y pulsa Enter: ');next.close();
 const signed=await request('/auth/v1/token?grant_type=password',{email,password});assert.ok(signed.ok);const outsider=signed.data.access_token;
 for(const [name,args]of [['listar',{}],['importar',{filas:[{folio:prefix+'-DENIED',nombre:prefix+' Denegada',boletos:1}]}],['eliminar',{p_folio:'NADA',p_token:randomUUID()}]])assert.equal((await rpc(name,args,outsider)).ok,false);
 await request('/auth/v1/user',{data:{role:'admin',organizer:true}},outsider,'PUT');assert.equal((await rpc('listar',{},outsider)).ok,false);await request('/auth/v1/logout',{},outsider);
 assert.deepEqual(errors,[]);assert.deepEqual(broken,[]);passed('Logout, JWT revocado, usuario sin autorización y metadatos falsos rechazados');
 console.log(JSON.stringify({stage:'COMPLETE_DELETE_QA_AUTH_USER',userId,email}));
}finally{
 if(access){const result=await rpc('listar',{},access);if(result.ok)for(const p of result.data.filter(owned))await rpc('eliminar',{p_folio:p.folio,p_token:p.token},access);await request('/auth/v1/logout',{},access);}
 await browser.close();
}
