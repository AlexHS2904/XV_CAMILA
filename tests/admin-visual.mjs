import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const root='test-results/admin-review';mkdirSync(root,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--disable-gpu']});
const report=[];
try {
 for(const scenario of ['empty','populated']) {
  const context=await browser.newContext();
  await context.addInitScript(scenario=>{
   const make=(i,nombre,boletos,estado,asistentes,mesa)=>({folio:'VISUAL-'+i,token:`00000000-0000-4000-8000-00000000000${i}`,nombre,boletos,estado,asistentes,confirmados:asistentes.length,mesa,telefono:'',cancion:'',mensaje:'',confirmado_en:estado==='pendiente'?null:'2026-11-24T20:00:00Z'});
   const rows=scenario==='empty'?[]:[make(1,'Familia Hernández',6,'asiste',['Ana','Luis','Lucía','Diego'],'2'),make(2,'Familia García',4,'asiste',['Sofía','Pedro','María','Daniel'],'3'),make(3,'Familia López',3,'pendiente',[],'4'),make(4,'Familia Martínez',2,'no_asiste',[],'5')];
   const api={uuid:/^[a-f0-9-]{36}$/i,link:token=>location.origin+'/?invitado='+token,client:()=>({auth:{onAuthStateChange(){},getSession:async()=>({data:{session:{}}})}}),rpc:async(name,args)=>{
    if(name==='listar')return structuredClone(rows);
    if(name==='importar')return args.filas.map(r=>{const existing=rows.find(p=>p.folio===r.folio);if(existing){Object.assign(existing,{nombre:r.nombre,boletos:r.boletos,mesa:r.mesa});return structuredClone(existing);}const row={...make(5,r.nombre,r.boletos,'pendiente',[],r.mesa),folio:r.folio};rows.push(row);return row;});
   }};
   Object.defineProperty(window,'CamilaPases',{get:()=>api,set:()=>{}});
  },scenario);
  const page=await context.newPage(),errors=[],css=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('console',msg=>{if(msg.type()==='error')errors.push(msg.text());});
  page.on('response',async r=>{if(r.url().includes('/assets/css/admin.css'))css.push({status:r.status(),mime:r.headers()['content-type'],hash:createHash('sha256').update(await r.body()).digest('hex')});});
  await page.goto('http://127.0.0.1:8000/admin.html?');await page.locator('#panel').waitFor({state:'visible'});
  for(const [width,height]of [[1440,900],[1280,800],[390,844],[320,844]]){
   await page.setViewportSize({width,height});await page.reload();await page.locator('#panel').waitFor({state:'visible'});await page.evaluate(()=>document.fonts.ready);await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));await page.evaluate(()=>scrollTo(0,0));
   const computed=await page.evaluate(()=>{
    const q=s=>document.querySelector(s),style=s=>getComputedStyle(q(s)),rect=s=>{const b=q(s).getBoundingClientRect();return {x:b.x,y:b.y,width:b.width,height:b.height,bottom:b.bottom};};
    return {grid:style('#metrics').gridTemplateColumns,card:{display:style('.metric').display,padding:style('.metric').padding,background:style('.metric').backgroundColor,border:style('.metric').borderWidth},chart:rect('#ticketChart'),svg:rect('#ticketChart svg'),label:rect('.metric-heading'),number:rect('.metric strong'),active:style('[data-filter=todos]').backgroundColor,inactive:style('[data-filter=parcial]').backgroundColor,fileDisplay:style('#archivo').display,select:style('#sortBy').appearance,overflow:document.documentElement.scrollWidth>innerWidth,chartText:q('#chartTotal').textContent};
   });
   assert.equal(computed.card.display,'flex');assert.equal(computed.card.background,'rgb(255, 255, 255)');assert.equal(computed.card.border,'1px');assert.ok(computed.number.y>=computed.label.bottom+8);
   assert.ok(Math.abs(computed.chart.width-computed.chart.height)<1);assert.ok(Math.abs(computed.svg.width-computed.svg.height)<1);assert.equal(computed.fileDisplay,'none');assert.equal(computed.select,'none');assert.notEqual(computed.active,computed.inactive);assert.equal(computed.overflow,false);
   assert.equal(computed.grid.split(' ').length,width>1000?4:2);assert.equal(computed.chartText,scenario==='empty'?'0%':'53.3%');
   assert.equal(await page.locator('#emptyState').isVisible(),scenario==='empty');assert.equal(await page.getByRole('button',{name:'Seleccionar Excel',exact:true}).count(),1);
   await page.screenshot({path:`${root}/${scenario}-${width}.png`,animations:'disabled'});await page.screenshot({path:`${root}/${scenario}-${width}-full.png`,fullPage:true});report.push({scenario,width,height,computed});
  }
  await page.setViewportSize({width:1440,height:900});
  if(scenario==='populated'){
   for(const [filter,count]of [['parcial',1],['confirmados',2],['pendiente',1],['rechazado',1],['todos',4]]){await page.locator(`[data-filter=${filter}]`).click();assert.equal(await page.locator('#saved tr').count(),count);}
   await page.locator('#guestSearch').fill('hernandez');assert.equal(await page.locator('#saved tr').count(),1);
   await page.locator('#saved').getByRole('button',{name:'Detalles',exact:true}).click();assert.match(await page.locator('#detailsBody').textContent(),/Lucía/);await page.locator('[data-close=detailsDialog]').last().click();
   await page.locator('#saved').getByRole('button',{name:'Editar',exact:true}).click();await page.locator('#editName').fill('Familia Hernández actualizada');await page.locator('#editPass button[type=submit]').click();await page.locator('#editDialog').waitFor({state:'hidden'});assert.match(await page.locator('#saved').textContent(),/actualizada/);
   const chooser=page.waitForEvent('filechooser');await page.locator('#chooseFile').click();await chooser;
  }
  await page.waitForTimeout(100);assert.deepEqual(errors,[]);assert.ok(css.length);assert.ok(css.every(r=>[200,304].includes(r.status)));assert.match(css[0].mime,/text\/css/);assert.equal(css[0].hash,createHash('sha256').update(readFileSync('assets/css/admin.css')).digest('hex'));report.push({scenario,css,errors});await context.close();
 }
 writeFileSync(root+'/report.json',JSON.stringify({source:'Datos ficticios en memoria del navegador. Sin escrituras Supabase.',checks:report},null,2));
 console.log('PASS comprobaciones visuales: 8 escenarios/tamaños, CSS servido idéntico, tarjetas, dona circular, filtros, selector único, alineación y funciones. Inspeccionar PNG antes de aprobar.');
}finally{await browser.close();}
