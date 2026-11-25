import {chromium} from 'playwright';
import {createServer} from 'node:http';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';
const oldCSS=execFileSync('git',['show','6c6a9da:assets/css/admin.css'],{encoding:'utf8'});
let oldRequests=0,newRequests=0;
const server=createServer((req,res)=>{
 const url=new URL(req.url,'http://localhost'),path=url.pathname;
 if(path==='/legacy') {res.setHeader('Content-Type','text/html');res.end('<link rel="stylesheet" href="/assets/css/admin.css"><p>Precarga de caché anterior</p>');return;}
 if(path==='/assets/css/admin.css'){
  res.setHeader('Content-Type','text/css');res.setHeader('Cache-Control','public,max-age=3600');
  if(!url.search){oldRequests++;res.end(oldCSS);}else{newRequests++;res.end(readFileSync('assets/css/admin.css'));}return;
 }
 try {const file=path.slice(1);assert.ok(!file.includes('..'));res.setHeader('Content-Type',file.endsWith('.html')?'text/html':file.endsWith('.js')?'text/javascript':file.endsWith('.webp')?'image/webp':'application/octet-stream');res.end(readFileSync(file));}
 catch{res.statusCode=404;res.end();}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--disable-gpu']});
try {
 const page=await browser.newPage();
 await page.addInitScript(()=>Object.defineProperty(window,'CamilaPases',{set:()=>{},get:()=>({rpc:async()=>[],client:()=>({auth:{onAuthStateChange(){},getSession:async()=>({data:{session:{}}})}})})}));
 const base='http://127.0.0.1:'+server.address().port;
 await page.goto(base+'/legacy');await page.goto(base+'/admin.html');await page.locator('#panel').waitFor({state:'visible'});
 assert.equal(await page.locator('.metric').first().evaluate(el=>getComputedStyle(el).display),'flex');
 const ring=await page.locator('#ticketChart').boundingBox();assert.equal(ring.width,ring.height);
 const retained=await page.evaluate(async()=>await(await fetch('/assets/css/admin.css')).text());assert.equal(retained,oldCSS);
 assert.equal(oldRequests,1,'CSS viejo sigue en caché, sin volver al servidor');assert.equal(newRequests,1,'CSS actual se descargó por su URL nueva');
 console.log('PASS caché real de Chrome: CSS antiguo almacenado, nueva URL por hash evita mezclar versiones y renderiza tarjetas/dona.');
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
