// Capturas visuales con respuestas RPC simuladas: no crea ni modifica datos en Supabase.
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--disable-gpu']});
const out='test-results/confirmation-review';mkdirSync(out,{recursive:true});
const token='12345678-1234-1234-1234-123456789abc';
const original={nombre:'Familia Hernández',boletos:6,mesa:'4',estado:'asiste',confirmados:4,asistentes:['Ana Hernández','Luis Hernández','Lucía Hernández','Diego Hernández'],telefono:'222 000 0000',cancion:'Tiempo de vals',mensaje:'Gracias por invitarnos. Una persona es vegetariana.',confirmado_en:'2026-11-24T22:30:00Z'};
const report=[];
try{
 for(const [width,height] of [[1440,900],[1280,800],[390,844],[320,844]]){
  const context=await browser.newContext({viewport:{width,height},isMobile:width<500,hasTouch:width<500});
  const page=await context.newPage();let data=structuredClone(original);const errors=[],css=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.url().includes('/assets/css/'))css.push({url:r.url(),status:r.status(),mime:r.headers()['content-type']});});
  await page.route('https://bwwmrtxuninbqvoyuruo.supabase.co/**',async route=>{
   const url=route.request().url();
   if(url.includes('/rpc/camila_xv_ver'))return route.fulfill({contentType:'application/json',body:JSON.stringify(data)});
   if(url.includes('/rpc/camila_xv_responder')){const r=route.request().postDataJSON().respuesta;data={...data,...r,confirmados:r.asistentes.length,confirmado_en:'2026-11-24T23:30:00Z'};return route.fulfill({contentType:'application/json',body:JSON.stringify(data)});}
   throw new Error('Solicitud Supabase inesperada: '+url);
  });
  await page.goto('http://127.0.0.1:8000/?invitado='+token+'#respuesta-guardada');await page.locator('#respuesta-guardada').waitFor({state:'visible'});await page.evaluate(()=>document.fonts.ready);
  assert.equal(await page.locator('#successConfirmed').textContent(),'4');assert.equal(await page.locator('#successNames li').count(),4);
  await page.screenshot({path:out+'/success-'+width+'.png',fullPage:true,animations:'disabled'});
  const computed=await page.evaluate(()=>{const q=s=>getComputedStyle(document.querySelector(s));return{overflow:document.documentElement.scrollWidth>innerWidth,iconWidth:q('.confirmation-icon').width,iconRadius:q('.confirmation-icon').borderRadius,countDisplay:q('.confirmation-counts').display,ticketBorder:q('.confirmation-ticket').borderTopWidth,ticketBackground:q('.confirmation-ticket').backgroundImage};});
  assert.equal(computed.overflow,false);assert.equal(computed.countDisplay,'grid');assert.equal(computed.ticketBorder,'1px');
  await page.locator('#editResponse').click();await page.locator('#confirmar-asistencia').waitFor({state:'visible'});assert.equal(await page.locator('#rsvpSeatsSelect').inputValue(),'4');assert.equal(await page.locator('#rsvpSong').inputValue(),'Tiempo de vals');
  await page.screenshot({path:out+'/edit-'+width+'.png',fullPage:true,animations:'disabled'});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await page.locator('input[value=declined]').check({force:true});await page.locator('#saveRsvp').click();await page.locator('#respuesta-guardada').waitFor({state:'visible'});assert.equal(await page.locator('#successConfirmed').textContent(),'0');
  await page.reload();await page.locator('#respuesta-guardada').waitFor({state:'visible'});assert.equal(await page.locator('#successTitle').textContent(),'Gracias por avisarnos');
  await page.screenshot({path:out+'/declined-'+width+'.png',fullPage:true,animations:'disabled'});
  assert.deepEqual(errors,[]);assert.ok(css.every(r=>r.status===200 && r.mime.includes('text/css')));report.push({width,height,computed,css,errors});await context.close();
 }
 writeFileSync(out+'/report.json',JSON.stringify({source:'RPC simulada; Chrome real; sin escrituras Supabase',results:report},null,2));
 console.log('PASS Confirmación: Chrome en 1440,1280,390,320 px; éxito, rechazo, recarga y edición precargada. RPC simuladas, sin cambios en Supabase.');
}finally{await browser.close();}
