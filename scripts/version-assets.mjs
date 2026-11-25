// Ejecutar tras editar recursos. Las URLs cambian solo cuando cambia su contenido.
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const hash=file=>createHash('sha256').update(readFileSync(file)).digest('hex').slice(0,12);
const excel='assets/excel/Plantilla_invitados.xlsx';
const excelJS='assets/js/excel-invitados.js';
writeFileSync(excelJS,readFileSync(excelJS,'utf8').replace(/assets\/excel\/Plantilla_invitados\.xlsx(?:\?v=[a-f0-9]+)?/g,excel+'?v='+hash(excel)));
for(const file of ['admin.html','index.html']){
 const source=readFileSync(file,'utf8');
 const updated=source.replace(/((?:href|src)=")((?:assets\/)[^"?]+)(?:\?[^" ]*)?(")/g,(match,prefix,path,suffix)=>{
  const versioned=file==='admin.html'?/\.(css|js|xlsx)$/.test(path):['assets/css/confirmation.css','assets/js/invitado.js'].includes(path);
  return versioned?prefix+path+'?v='+hash(path)+suffix:match;
 });
 writeFileSync(file,updated);
}
console.log('URLs CSS/JS/Excel sincronizadas con su contenido.');
