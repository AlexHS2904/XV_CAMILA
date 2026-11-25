import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdirSync} from 'node:fs';
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--disable-gpu']});
try {
  const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  const errors=[]; page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:8000/');
  await page.evaluate(()=>document.fonts.ready);
  await page.locator('#btnHeroMusic').click();
  await page.waitForFunction(()=>document.querySelector('#bgMusic').currentTime>0.2);
  await page.locator('#btnHeroMusic').click();
  assert.ok(await page.locator('#bgMusic').evaluate(el=>el.paused));
  await page.locator('#galleryNext').scrollIntoViewIfNeeded();
  const before=await page.locator('#galleryTrack').evaluate(el=>el.scrollLeft);
  await page.locator('#galleryNext').click();
  await page.waitForFunction(before=>document.querySelector('#galleryTrack').scrollLeft>before+50,before);
  await page.locator('.memory-photo').nth(1).click();
  await page.locator('#lightboxModal').waitFor({state:'visible'});
  await page.keyboard.press('Escape');
  await page.locator('#lightboxModal').waitFor({state:'hidden'});
  await page.locator('#portraitNext').scrollIntoViewIfNeeded();
  await page.locator('#portraitNext').click();
  await page.waitForFunction(()=>document.querySelector('#portraitPosition').textContent.startsWith('02'));
  // Las capturas de viewport evitan artefactos de composición en páginas animadas muy largas.
  mkdirSync('test-results',{recursive:true});
  await page.evaluate(()=>scrollTo({top:0,behavior:'instant'}));
  await page.waitForFunction(()=>scrollY===0);
  await page.screenshot({path:'test-results/mobile-cover.png',animations:'disabled'});
  await page.setViewportSize({width:1440,height:1000});
  await page.evaluate(()=>scrollTo({top:0,behavior:'instant'}));
  await page.screenshot({path:'test-results/desktop-cover.png',animations:'disabled'});
  await page.goto('http://127.0.0.1:8000/admin.html');
  await page.setViewportSize({width:390,height:844});
  await page.screenshot({path:'test-results/mobile-login.png'});
  assert.deepEqual(errors,[]);
  console.log('PASS Música real (reproducir/pausar), carruseles, lightbox, capturas móvil/escritorio y ausencia de errores JS');
} finally {await browser.close();}
