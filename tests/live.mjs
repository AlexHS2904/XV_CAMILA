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
const createdFolios = [prefix+'-ONE',prefix+'-FAMILY',prefix+'-X1',prefix+'-X2'];
function passed(name) { console.log('PASS '+name); }
async function login() {
  await page.goto(base+'/admin.html');
  await page.locator('#username').fill(username);
  await page.locator('#password').fill(password);
  await page.locator('#loginForm button').click();
  await page.locator('#panel').waitFor({state:'visible'});
  access = await page.evaluate(async ()=>(await CamilaPases.client().auth.getSession()).data.session.access_token);
}
async function add(name,count,folio) {
  await page.locator('#newPass').click();
  await page.locator('#oneName').fill(name);
  await page.locator('#oneCount').fill(String(count));
  await page.locator('#oneFolio').fill(folio);
  await page.locator('#onePass button[type=submit]').click();
  await page.locator('#onePass').waitFor({state:'hidden'});
  await page.waitForFunction(name=>document.querySelector('#saved').textContent.includes(name),name);
}
try {
  await page.goto(base+'/admin.html');
  assert.equal(await page.locator('#panel').isVisible(),false);
  assert.equal((await rpc('listar')).ok,false);
  assert.equal((await rpc('importar',{filas:[{folio:prefix+'-BAD',nombre:'No autorizado',boletos:1}]})).ok,false);
  assert.equal((await rpc('eliminar',{p_folio:prefix+'-ONE',p_token:randomUUID()})).ok,false);
  for (const table of ['pases','organizadoras']) assert.equal((await request('/rest/v1/'+table+'?select=*',undefined,undefined,'GET')).ok,false);
  const privateAttempt = await fetch(supabaseUrl+'/rest/v1/pases?select=*',{headers:{apikey:publishableKey,'Accept-Profile':'camila_xv'}});
  assert.equal(privateAttempt.ok,false);
  passed('Panel y API rechazan acceso anónimo y acceso directo a tablas');
  await page.locator('#username').fill(username); await page.locator('#password').fill('incorrecta');
  await page.locator('#loginForm button').click();
  await page.waitForFunction(()=>document.querySelector('#loginStatus').dataset.error==='true');
  assert.equal(await page.locator('#panel').isVisible(),false);
  await login(); passed('Login válido y rechazo de contraseña incorrecta');
  await add('Prueba individual',1,createdFolios[0]);
  await add('Familia de prueba',3,createdFolios[1]);
  const familyRow = page.locator('#saved tr').filter({hasText:'Familia de prueba'});
  await familyRow.getByRole('button',{name:'Editar',exact:true}).click();
  await page.locator('#oneTable').fill('Mesa 7');
  await page.locator('#onePass button[type=submit]').click();
  await page.locator('#onePass').waitFor({state:'hidden'});
  await page.waitForFunction(()=>document.querySelector('#saved').textContent.includes('Mesa 7'));
  passed('Creación individual y familiar, edición y asignación de boletos');
  const xlsx = await page.evaluate(async ({prefix})=>{
    const zip = await JSZip.loadAsync(await (await fetch('assets/excel/Plantilla_invitados.xlsx')).arrayBuffer());
    const path='xl/worksheets/sheet1.xml';
    const doc=new DOMParser().parseFromString(await zip.file(path).async('string'),'application/xml');
    const data=doc.getElementsByTagNameNS('*','sheetData')[0]; data.replaceChildren();
    const rows=[['Familia o invitado','Boletos','Folio'],['Familia Excel',4,prefix+'-X1'],['Invitado Excel',1,prefix+'-X2']];
    rows.forEach((values,i)=>{
      const row=doc.createElementNS(data.namespaceURI,'row'); row.setAttribute('r',i+1);
      values.forEach((value,j)=>{
        const cell=doc.createElementNS(data.namespaceURI,'c'); cell.setAttribute('r',String.fromCharCode(65+j)+(i+1)); cell.setAttribute('t','inlineStr');
        const s=doc.createElementNS(data.namespaceURI,'is'), t=doc.createElementNS(data.namespaceURI,'t'); t.textContent=String(value); s.append(t);cell.append(s);row.append(cell);
      });data.append(row);
    });
    zip.file(path,new XMLSerializer().serializeToString(doc)); return zip.generateAsync({type:'base64'});
  },{prefix});
  await page.locator('#archivo').setInputFiles({name:'QA.xlsx',mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',buffer:Buffer.from(xlsx,'base64')});
  await page.locator('#preview').waitFor({state:'visible'});
  const downloadPromise = page.waitForEvent('download');
  await page.locator('#confirmImport').click();
  const download=await downloadPromise; const file=await download.path();
  const exported = await page.evaluate(async bytes=>{
    const list=await CamilaExcel.readList(Uint8Array.from(atob(bytes),c=>c.charCodeAt(0)).buffer);
    return list.entries;
  },readFileSync(file).toString('base64'));
  assert.equal(exported.length,2); assert.ok(exported.every(x=>x.token));
  assert.notEqual(exported[0].token,exported[1].token);
  await page.locator('#preview').waitFor({state:'hidden'});
  await page.waitForFunction(()=>document.querySelector('#saved').textContent.includes('Familia Excel'));
  // Reimportar el Excel exportado debe conservar los tokens.
  await page.locator('#archivo').setInputFiles(file);
  // Playwright conserva el nombre temporal sin .xlsx: reemplazar por un nombre válido.
  await page.locator('#archivo').setInputFiles({name:'QA_con_enlaces.xlsx',mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',buffer:readFileSync(file)});
  await page.locator('#preview').waitFor({state:'visible'});
  const repeatPromise=page.waitForEvent('download'); await page.locator('#confirmImport').click(); await repeatPromise;
  await page.locator('#preview').waitFor({state:'hidden'});
  const all = (await rpc('listar',{},access)).data;
  for (const entry of exported) assert.equal(all.find(p=>p.folio===entry.folio).token,entry.token);
  passed('Importación y reimportación Excel, exportación con enlaces únicos y estables');
  const allDownload=page.waitForEvent('download'); await page.locator('#downloadAll').click();
  assert.ok(await (await allDownload).path());
  const family=all.find(p=>p.folio===createdFolios[1]);
  const guestContext=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:1});
  const guest=await guestContext.newPage(); guest.on('pageerror',e=>errors.push(e.message));
  await guest.goto(base+'/?invitado='+family.token);
  await guest.waitForFunction(()=>document.querySelector('#summaryGuest').textContent==='Familia de prueba');
  assert.equal(await guest.locator('#summaryCount').textContent(),'3');
  await guest.locator('#openRsvp').click();
  await guest.locator('#confirmar-asistencia').waitFor({state:'visible'});
  await guest.locator('#rsvpSeatsSelect').selectOption('2');
  await guest.locator('.attendee-name-input').nth(0).fill('Invitada ficticia');
  await guest.locator('.attendee-name-input').nth(1).fill('Invitado ficticio');
  await guest.locator('#rsvpMessage').fill('Mensaje de prueba');
  await guest.locator('#saveRsvp').click();
  await guest.waitForFunction(()=>document.querySelector('#rsvpFeedback').textContent.startsWith('Gracias.'));
  await guest.reload();
  await guest.waitForFunction(()=>document.querySelector('#ticketStatusBadge').textContent==='Confirmados 2 de 3');
  assert.equal(await guest.locator('#rsvpMessage').inputValue(),'Mensaje de prueba');
  passed('Invitación personalizada, confirmación y persistencia en recarga móvil');
  mkdirSync('test-results',{recursive:true});
  for (const width of [320,390,768]) {
    await guest.setViewportSize({width,height:844});
    assert.ok(await guest.evaluate(()=>document.documentElement.scrollWidth <= innerWidth+1),'Overflow RSVP '+width);
  }
  await guest.setViewportSize({width:390,height:844});
  await guest.screenshot({path:'test-results/mobile-rsvp.png',fullPage:true});
  await guest.goto(base+'/?invitado='+family.token);
  await guest.waitForFunction(()=>!document.querySelector('#heroPass').hidden);
  await guest.screenshot({path:'test-results/mobile-invitation.png',fullPage:true});
  assert.ok(await guest.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Overflow invitation');
  for (const width of [320,390,768]) {
    await page.setViewportSize({width,height:844});
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Overflow admin '+width);
  }
  await page.screenshot({path:'test-results/mobile-admin.png',fullPage:true});
  passed('Vista móvil sin desbordamientos en 320, 390 y 768 px');
  const tooMany=await rpc('responder',{p_token:family.token,respuesta:{estado:'asiste',asistentes:['A','B','C','D']}});
  assert.equal(tooMany.ok,false);
  assert.equal((await rpc('ver',{p_token:family.token})).data.confirmados,2);
  assert.equal((await rpc('importar',{filas:[{folio:family.folio,nombre:family.nombre,boletos:1}]},access)).ok,false);
  // Una importación inválida debe revertir también las filas válidas anteriores.
  assert.equal((await rpc('importar',{filas:[{folio:prefix+'-ROLLBACK',nombre:'Rollback',boletos:1},{folio:prefix+'-ZZBAD',nombre:'Malo',boletos:16}]},access)).ok,false);
  assert.ok(!(await rpc('listar',{},access)).data.some(p=>p.folio===prefix+'-ROLLBACK'));
  for (const asistentes of [[null],[{}],[' ']]) assert.equal((await rpc('responder',{p_token:family.token,respuesta:{estado:'asiste',asistentes}})).ok,false);
  const unknown=randomUUID();
  assert.equal((await rpc('ver',{p_token:unknown})).data,null);
  assert.equal((await rpc('responder',{p_token:unknown,respuesta:{estado:'no_asiste',asistentes:[]}})).ok,false);
  const publicPass=(await rpc('ver',{p_token:family.token})).data;
  assert.equal(publicPass.folio,undefined); assert.equal(publicPass.token,undefined);
  const other=all.find(p=>p.folio===createdFolios[0]);
  const beforeOther=(await rpc('ver',{p_token:other.token})).data;
  // Los campos extra no pueden cambiar otro pase ni modificar nombre/cupo.
  assert.ok((await rpc('responder',{p_token:family.token,respuesta:{
    estado:'asiste',asistentes:['Invitada ficticia','Invitado ficticio'],
    token:other.token,folio:other.folio,boletos:99,nombre:'Cambio no autorizado'
  }})).ok);
  assert.deepEqual((await rpc('ver',{p_token:other.token})).data,beforeOther);
  const afterAttack=(await rpc('ver',{p_token:family.token})).data;
  assert.equal(afterAttack.boletos,3); assert.equal(afterAttack.nombre,'Familia de prueba');
  passed('Límite de boletos en servidor, rollback, datos inválidos y aislamiento por token');
  await guest.locator('#openRsvp').click();
  await guest.locator('input[value=declined]').check({force:true});
  await guest.locator('#saveRsvp').click();
  await guest.waitForFunction(()=>document.querySelector('#rsvpFeedback').textContent.startsWith('Tu respuesta'));
  assert.equal((await rpc('ver',{p_token:family.token})).data.confirmados,0);
  passed('Rechazo de asistencia actualiza el cupo confirmado a cero');
  await page.reload(); await page.locator('#panel').waitFor({state:'visible'});
  assert.ok((await page.locator('#saved').textContent()).includes('Familia Excel'));
  passed('Sesión administrativa y lista persisten tras recargar');
  const row=page.locator('#saved tr').filter({hasText:'Prueba individual'});
  page.once('dialog',dialog=>dialog.accept()); await row.getByRole('button',{name:'Eliminar',exact:true}).click();
  await page.waitForFunction(()=>!document.querySelector('#saved').textContent.includes('Prueba individual'));
  assert.equal((await rpc('ver',{p_token:all.find(p=>p.folio===createdFolios[0]).token})).data,null);
  passed('Eliminación administrativa invalida el enlace');
  for (const p of (await rpc('listar',{},access)).data.filter(p=>p.folio.startsWith(prefix))) assert.ok((await rpc('eliminar',{p_folio:p.folio,p_token:p.token},access)).ok);
  await page.locator('#logout').click(); await page.locator('#loginBox').waitFor({state:'visible'});
  assert.equal(await page.locator('#panel').isVisible(),false);
  assert.equal((await rpc('listar',{},access)).ok,false,'El JWT anterior al logout no debe conservar acceso');
  await page.reload(); assert.equal(await page.locator('#panel').isVisible(),false);
  passed('Logout, recarga y rechazo inmediato del JWT revocado');
  // La siguiente etapa comprueba que un usuario autenticado sin membresía tampoco entra.
  console.log(JSON.stringify({stage:'REMOVE_QA_MEMBERSHIP',userId}));
  const next=createInterface({input:process.stdin,output:process.stdout}); await next.question('Revoca solo la membresía QA y pulsa Enter: '); next.close();
  const signed=await request('/auth/v1/token?grant_type=password',{email,password}); assert.ok(signed.ok);
  const outsider=signed.data.access_token;
  assert.equal((await rpc('listar',{},outsider)).ok,false);
  assert.equal((await rpc('importar',{filas:[{folio:prefix+'-DENIED',nombre:'No permitido',boletos:1}]},outsider)).ok,false);
  assert.equal((await rpc('eliminar',{p_folio:'NADA',p_token:randomUUID()},outsider)).ok,false);
  await request('/auth/v1/user',{data:{role:'admin',organizer:true}},outsider,'PUT');
  assert.equal((await rpc('listar',{},outsider)).ok,false);
  await request('/auth/v1/logout',{},outsider);
  passed('Usuario autenticado no autorizado y user_metadata falsificado rechazados');
  assert.deepEqual(errors,[]); assert.deepEqual(broken,[]);
  passed('Sin errores JavaScript ni recursos locales faltantes');
  console.log(JSON.stringify({stage:'COMPLETE_DELETE_QA_AUTH_USER',userId,email}));
} finally {
  // Limpieza de los pases de este proceso incluso si una prueba falla.
  if (access) {
    const result=await rpc('listar',{},access);
    if (result.ok) for (const p of result.data.filter(p=>p.folio.startsWith(prefix))) await rpc('eliminar',{p_folio:p.folio,p_token:p.token},access);
    await request('/auth/v1/logout',{},access);
  }
  await browser.close();
}
