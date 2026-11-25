import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--disable-gpu']});
try {
 const page=await browser.newPage();await page.goto('http://127.0.0.1:8000/admin.html');
 const result=await page.evaluate(async()=>{
  const passes=[{folio:'QA-A',token:'12345678-1234-1234-1234-123456789abc',nombre:'Familia Igual',boletos:6,confirmados:4,estado:'asiste',asistentes:['Uno','Dos','Tres','Cuatro'],mesa:'2',telefono:'123',cancion:'Vals',mensaje:'Mensaje',confirmado_en:'2026-11-25T04:30:00Z'},{folio:'QA-B',token:'22345678-1234-1234-1234-123456789abc',nombre:'Familia Igual',boletos:2,confirmados:0,estado:'no_asiste',asistentes:[],mesa:'10',confirmado_en:null}];
  const blob=await CamilaExcel.exportAll(passes),bytes=await blob.arrayBuffer(),list=await CamilaExcel.readList(bytes),zip=await JSZip.loadAsync(bytes);
  const doc=new DOMParser().parseFromString(await zip.file('xl/worksheets/sheet1.xml').async('string'),'application/xml');
  const rows=[...doc.getElementsByTagNameNS('*','row')],cols=[...doc.getElementsByTagNameNS('*','col')];
  const tablePath=Object.keys(zip.files).find(p=>/^xl\/tables\/.*\.xml$/.test(p));const table=new DOMParser().parseFromString(await zip.file(tablePath).async('string'),'application/xml');
  const repeated=await CamilaExcel.exportList(list,passes),reread=await CamilaExcel.readList(await repeated.arrayBuffer());
  // Copia sin metadatos: mismo nombre, pero dos identidades de fila diferentes.
  const raw=await JSZip.loadAsync(await (await fetch('assets/excel/Plantilla_invitados.xlsx')).arrayBuffer());
  const sheet=new DOMParser().parseFromString(await raw.file('xl/worksheets/sheet1.xml').async('string'),'application/xml');const data=sheet.getElementsByTagNameNS('*','sheetData')[0];
  for(let i=2;i<=3;i++){const row=sheet.createElementNS(data.namespaceURI,'row');row.setAttribute('r',i);['Familia Igual',String(i),'Mesa '+i].forEach((v,j)=>{const c=sheet.createElementNS(data.namespaceURI,'c');c.setAttribute('r',String.fromCharCode(65+j)+i);c.setAttribute('t','inlineStr');const s=sheet.createElementNS(data.namespaceURI,'is'),t=sheet.createElementNS(data.namespaceURI,'t');t.textContent=v;s.append(t);c.append(s);row.append(c);});data.append(row);}
  raw.file('xl/worksheets/sheet1.xml',new XMLSerializer().serializeToString(sheet));const rawBytes=await raw.generateAsync({type:'arraybuffer'}),rawList=await CamilaExcel.readList(rawBytes),rawAgain=await CamilaExcel.readList(rawBytes);
  const asBase64=await new Promise(resolve=>{const r=new FileReader();r.onload=()=>resolve(r.result.split(',')[1]);r.readAsDataURL(blob);});
  // Libro de organizador con estilos en otra ruta, fecha Mac 1904 y columna propia con formato.
  const variant=await JSZip.loadAsync(bytes),parser=new DOMParser(),serialize=node=>new XMLSerializer().serializeToString(node);
  const styleText=await variant.file('xl/styles.xml').async('string');variant.remove('xl/styles.xml');variant.file('xl/custom-styles.xml',styleText);
  const refs=parser.parseFromString(await variant.file('xl/_rels/workbook.xml.rels').async('string'),'application/xml');[...refs.documentElement.children].find(r=>r.getAttribute('Type').endsWith('/styles')).setAttribute('Target','custom-styles.xml');variant.file('xl/_rels/workbook.xml.rels',serialize(refs));
  const workbook=parser.parseFromString(await variant.file('xl/workbook.xml').async('string'),'application/xml');let props=workbook.getElementsByTagNameNS('*','workbookPr')[0];if(!props){props=workbook.createElementNS(workbook.documentElement.namespaceURI,'workbookPr');workbook.documentElement.prepend(props);}props.setAttribute('date1904','1');variant.file('xl/workbook.xml',serialize(workbook));
  const ownSheet=parser.parseFromString(await variant.file('xl/worksheets/sheet1.xml').async('string'),'application/xml'),ownRows=[...ownSheet.getElementsByTagNameNS('*','row')];
  const oldDate=[...ownRows[1].children].find(c=>c.getAttribute('r')==='L2'),styleId=oldDate.getAttribute('s'),serial=Number(oldDate.textContent);
  for(const [i,value]of ['Fecha del organizador',serial].entries()){const c=ownSheet.createElementNS(ownSheet.documentElement.namespaceURI,'c');c.setAttribute('r','M'+(i+1));if(i){c.setAttribute('s',styleId);const v=ownSheet.createElementNS(c.namespaceURI,'v');v.textContent=value;c.append(v);}else{c.setAttribute('t','inlineStr');const is=ownSheet.createElementNS(c.namespaceURI,'is'),t=ownSheet.createElementNS(c.namespaceURI,'t');t.textContent=value;is.append(t);c.append(is);}ownRows[i].append(c);}
  variant.file('xl/worksheets/sheet1.xml',serialize(ownSheet));const instructions=await variant.file('xl/worksheets/sheet2.xml').async('string');
  const custom=await CamilaExcel.readList(await variant.generateAsync({type:'arraybuffer'})),out=await JSZip.loadAsync(await (await CamilaExcel.exportList(custom,passes)).arrayBuffer()),outDoc=parser.parseFromString(await out.file('xl/worksheets/sheet1.xml').async('string'),'application/xml'),cells=[...outDoc.getElementsByTagNameNS('*','c')];
  const compatibility={alternateStyles:!!out.file('xl/custom-styles.xml')&&!out.file('xl/styles.xml'),dateOffset:serial-Number(cells.find(c=>c.getAttribute('r')==='L2').textContent),customFormat:cells.find(c=>c.getAttribute('r')==='M2').getAttribute('s')===styleId,otherSheet:instructions===await out.file('xl/worksheets/sheet2.xml').async('string')};
  return {compatibility,entries:list.entries,reread:reread.entries,rowCount:rows.length,hidden:cols.filter(c=>c.getAttribute('hidden')==='1').map(c=>c.getAttribute('min')),ref:table.documentElement.getAttribute('ref'),pane:doc.getElementsByTagNameNS('*','pane')[0].getAttribute('state'),links:[...doc.getElementsByTagNameNS('*','hyperlink')].length,conditional:doc.getElementsByTagNameNS('*','cfRule').length,raw:rawList.entries,rawAgain:rawAgain.entries,base64:asBase64};
 });
 assert.deepEqual(result.compatibility,{alternateStyles:true,dateOffset:1462,customFormat:true,otherSheet:true});
 assert.equal(result.entries.length,2);assert.equal(result.entries[0].token,'12345678-1234-1234-1234-123456789abc');assert.equal(result.entries[1].folio,'QA-B');assert.deepEqual(result.reread,result.entries);assert.equal(result.rowCount,3);assert.deepEqual(result.hidden,['4']);assert.equal(result.ref,'A1:L3');assert.equal(result.pane,'frozen');assert.equal(result.links,2);assert.equal(result.conditional,4);assert.notEqual(result.raw[0].folio,result.raw[1].folio);assert.deepEqual(result.raw,result.rawAgain);
 mkdirSync('test-results',{recursive:true});writeFileSync('test-results/exportacion-qa.xlsx',Buffer.from(result.base64,'base64'));
 console.log('PASS Excel: identidad oculta, familias iguales, reimportación estable, enlaces, fechas, formato, rango exacto y cero filas vacías.');
}finally{await browser.close();}
