(() => {
  'use strict';
  const relNs = 'http://schemas.openxmlformats.org/package/2006/relationships';
  const normal = text => String(text).normalize('NFKD').replace(/\p{M}/gu, '').trim().toLowerCase().replace(/[\s_/.-]+/g, ' ');
  const fields = {
    nombre: ['familia o invitado','invitado o familia','invitado familia','familia invitado','nombre','familia','invitado','nombre de familia','nombre del invitado'],
    boletos: ['boletos','boletos asignados','pases','lugares','cupo','cantidad de boletos','numero de boletos'],
    estado:['asistencia','estado'],confirmados:['boletos confirmados','confirmados'],asistentes:['asistentes'],telefono:['telefono'],cancion:['cancion'],mensaje:['mensaje'],confirmado_en:['fecha de confirmacion','ultima confirmacion'],
    mesa: ['mesa','mesa asignada'], folio: ['folio','codigo','id','id de invitacion'], enlace: ['enlace','enlace de invitacion','link','url']
  };
  const fieldName = label => Object.keys(fields).find(key => fields[key].includes(normal(label)));
  const children = (parent, tag) => Array.from(parent?.children || []).filter(el => el.localName === tag);
  const first = (parent, tag) => children(parent, tag)[0];
  const descendants = (parent, tag) => Array.from(parent?.getElementsByTagNameNS('*', tag) || []);
  const newEl = (parent, tag) => parent.ownerDocument.createElementNS(parent.namespaceURI, tag);
  const xml = doc => new XMLSerializer().serializeToString(doc);
  function parse(source) {
    const doc = new DOMParser().parseFromString(source, 'application/xml');
    if (doc.getElementsByTagName('parsererror').length) throw new Error('Excel no pudo leer una parte del libro. Guarda una copia en formato .xlsx.');
    return doc;
  }
  function resolvePart(source, target) {
    const url = new URL(target, 'https://libro.invalid/' + source);
    if (url.origin !== 'https://libro.invalid') throw new Error('El libro contiene una referencia externa a la hoja.');
    return decodeURI(url.pathname.slice(1));
  }
  const relFile = path => path.replace(/(^|\/)([^/]+)$/, '$1_rels/$2.rels');
  async function part(zip, path) {
    const file = zip.file(path);
    if (!file) throw new Error('Falta una hoja o parte del archivo. Vuelve a guardarlo en formato .xlsx.');
    return parse(await file.async('string'));
  }
  function colIndex(letters) {
    let result = 0;
    for (const c of letters) result = result * 26 + c.charCodeAt(0) - 64;
    return result;
  }
  function colName(number) {
    let letters = '';
    while (number > 0) { number--; letters = String.fromCharCode(65 + number % 26) + letters; number = Math.floor(number / 26); }
    return letters;
  }
  const cellCol = cell => colIndex((cell.getAttribute('r') || '').replace(/[0-9]/g, ''));
  const texts = el => descendants(el, 't').filter(t => t.parentNode.localName !== 'rPh').map(t => t.textContent).join('');
  function cellValue(cell, strings) {
    if (!cell) return '';
    const type = cell.getAttribute('t');
    const value = first(cell, 'v')?.textContent ?? '';
    if (type === 'inlineStr') return texts(first(cell, 'is'));
    return type === 's' ? (strings[Number(value)] ?? '') : value;
  }
  async function openBook(bytes) {
    const zip = await JSZip.loadAsync(bytes);
    const base = 'xl/workbook.xml';
    const book = await part(zip, base);
    const refs = children((await part(zip, relFile(base))).documentElement, 'Relationship');
    const sheets = descendants(book, 'sheet').filter(s => !['hidden','veryHidden'].includes(s.getAttribute('state')));
    const sheet = sheets.find(s => normal(s.getAttribute('name')) === 'invitados') || sheets[0];
    if (!sheet) throw new Error('El libro necesita una hoja visible de invitados.');
    const idAttr = Array.from(sheet.attributes).find(a => a.localName === 'id');
    const rel = refs.find(r => r.getAttribute('Id') === idAttr?.value);
    if (!rel || !rel.getAttribute('Type').endsWith('/worksheet')) throw new Error('Nombra «Invitados» a la hoja de la lista.');
    const path = resolvePart(base, rel.getAttribute('Target'));
    const doc = await part(zip, path);
    const pathRels = relFile(path);
    const rels = zip.file(pathRels) ? await part(zip, pathRels) : parse('<Relationships xmlns="' + relNs + '"/>');
    const stringRef = refs.find(r => r.getAttribute('Type').endsWith('/sharedStrings'));
    const strings = stringRef ? descendants(await part(zip, resolvePart(base, stringRef.getAttribute('Target'))), 'si').map(texts) : [];
    const data = first(doc.documentElement, 'sheetData');
    if (!data) throw new Error('La hoja no contiene celdas.');
    const rows = children(data, 'row');
    let header, cols;
    for (const row of rows) {
      const found = {};
      const repeated = new Set();
      for (const cell of children(row, 'c')) {
        const key = fieldName(cellValue(cell, strings));
        if (key && found[key]) repeated.add(key);
        if (key) found[key] = cellCol(cell);
      }
      if (found.nombre && found.boletos) {
        if (repeated.size) throw new Error('Hay encabezados repetidos: ' + [...repeated].join(', ') + '.');
        header = row; cols = found; break;
      }
    }
    if (!header) throw new Error('La primera hoja o la hoja «Invitados» necesita las columnas «Familia o invitado» y «Boletos».');
    const styleRef=refs.find(r=>r.getAttribute('Type').endsWith('/styles'));
    const stylesPath=styleRef?resolvePart(base,styleRef.getAttribute('Target')):'xl/styles.xml';
    const date1904=['1','true'].includes(first(book.documentElement,'workbookPr')?.getAttribute('date1904'));
    return {zip, doc, path, pathRels, rels, stylesPath, date1904, idNs:idAttr.namespaceURI, rows, data, header, cols, strings, sheetName:sheet.getAttribute('name')};
  }
  async function fingerprint(bytes) {
    return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),n=>n.toString(16).padStart(2,'0')).join('').toUpperCase();
  }
  async function checkRow(values, rowNumber, generatedFolio) {
    const nombre = String(values.nombre ?? '').trim();
    const boletos = Number(String(values.boletos ?? '').trim());
    const mesa = values.mesa == null ? null : String(values.mesa).trim();
    if (!nombre || nombre.length > 160) throw new Error('Escribe un nombre de hasta 160 caracteres.');
    if (!Number.isInteger(boletos) || boletos < 1 || boletos > 15) throw new Error('Los boletos deben ser un número entero entre 1 y 15.');
    if (mesa && mesa.length > 80) throw new Error('La mesa admite hasta 80 caracteres.');
    const folio = String(values.folio ?? '').trim().toUpperCase() || generatedFolio || ('F-'+crypto.randomUUID().toUpperCase());
    if (!/^[A-Z0-9][A-Z0-9._-]{0,49}$/.test(folio)) throw new Error('El identificador interno no es válido. Usa una exportación original del panel.');
    let token = null;
    if (values.enlace) {
      try { token = new URL(String(values.enlace)).searchParams.get('invitado'); } catch {}
      if (!CamilaPases.uuid.test(token)) throw new Error('La columna Enlace debe contener un pase generado por este panel.');
    }
    return {fila:rowNumber, folio, nombre, boletos, mesa, token, explicitId:Boolean(String(values.folio ?? '').trim())};
  }
  async function readList(bytes) {
    const book = await openBook(bytes);
    const fileId=await fingerprint(bytes);
    const links=new Map(descendants(book.doc,'hyperlink').map(h=>[h.getAttribute('ref'),h.getAttributeNS(book.idNs,'id')]));
    const relationships=new Map(children(book.rels.documentElement,'Relationship').map(r=>[r.getAttribute('Id'),r.getAttribute('Target')]));
    const entries = [], errors = [], seen = new Map();
    const headerNumber = Number(book.header.getAttribute('r'));
    for (const row of book.rows) {
      const rowNumber = Number(row.getAttribute('r'));
      if (rowNumber <= headerNumber) continue;
      const cells = new Map(children(row, 'c').map(c => [cellCol(c), c]));
      const values = {};
      let formula = false;
      for (const [field,index] of Object.entries(book.cols).filter(([key])=>['nombre','boletos','mesa','folio','enlace'].includes(key))) {
        const cell = cells.get(index);
        values[field] = cellValue(cell, book.strings);
        if(field==='enlace' && cell && links.has(cell.getAttribute('r'))) values[field]=relationships.get(links.get(cell.getAttribute('r')))||values[field];
        if (first(cell,'f')) formula = true;
      }
      if (!formula && Object.values(values).every(v => !String(v).trim())) continue;
      try {
        if (formula) throw new Error('Pega los campos del pase como valores antes de importar.');
        const generatedFolio='X-'+(await fingerprint(new TextEncoder().encode(fileId+'|'+book.path+'|'+rowNumber))).slice(0,40);
        const entry = await checkRow(values, rowNumber, generatedFolio);
        if (seen.has(entry.folio)) throw new Error('Comparte identidad con la fila ' + seen.get(entry.folio) + '. Elimina la fila duplicada o usa la plantilla para crear otra familia.');
        seen.set(entry.folio, rowNumber); entries.push(entry);
      } catch (e) { errors.push('Fila ' + rowNumber + ' · ' + e.message); }
    }
    if (errors.length) throw new Error(errors.slice(0,12).join('\n') + (errors.length > 12 ? '\nHay ' + (errors.length-12) + ' filas adicionales por corregir.' : ''));
    if (!entries.length || entries.length > 2000) throw new Error('Incluye entre 1 y 2000 familias por archivo.');
    return {book, entries};
  }
  function writeCell(row, col, value) {
    const rowNumber = row.getAttribute('r'), ref = colName(col) + rowNumber;
    const cells = children(row, 'c');
    let cell = cells.find(c => c.getAttribute('r') === ref);
    if (!cell) {
      cell = newEl(row,'c'); cell.setAttribute('r', ref);
      row.insertBefore(cell, cells.find(c => cellCol(c) > col) || first(row, 'extLst') || null);
    }
    cell.replaceChildren();
    if (typeof value === 'number') {
      cell.removeAttribute('t');
      const v = newEl(cell,'v'); v.textContent = String(value); cell.append(v);
    } else {
      cell.setAttribute('t','inlineStr');
      const inline = newEl(cell,'is'), t = newEl(cell,'t'); t.textContent = value;
      inline.append(t); cell.append(inline);
    }
    return cell;
  }
  const titles = {nombre:'Familia o invitado',boletos:'Boletos',mesa:'Mesa',folio:'ID de invitación',enlace:'Enlace',estado:'Asistencia',confirmados:'Boletos confirmados',asistentes:'Asistentes',telefono:'Teléfono',cancion:'Canción',mensaje:'Mensaje',confirmado_en:'Fecha de confirmación'};
  function columns(book, keys) {
    let right = 0;
    for (const row of book.rows) for (const c of children(row,'c')) {
      if (first(c,'v') || first(c,'is') || first(c,'f')) right = Math.max(right, cellCol(c));
    }
    const before = right;
    for (const key of keys) {
      if (book.cols[key]) continue;
      if (right >= 16384) throw new Error('La hoja no tiene columnas libres para los enlaces.');
      book.cols[key] = ++right;
      const header = writeCell(book.header, right, titles[key]);
      const style = children(book.header,'c').find(c => cellCol(c) === book.cols.nombre)?.getAttribute('s');
      if (style) header.setAttribute('s', style);
      let widths = first(book.doc.documentElement,'cols');
      if (!widths) {widths = newEl(book.doc.documentElement,'cols'); book.doc.documentElement.insertBefore(widths,book.data);}
      if (!children(widths,'col').some(c => +c.getAttribute('min') <= right && +c.getAttribute('max') >= right)) {
        const col = newEl(widths,'col');
        col.setAttribute('min',right); col.setAttribute('max',right);
        col.setAttribute('width',key === 'enlace' ? 78 : 25); col.setAttribute('customWidth','1');
        widths.insertBefore(col, children(widths,'col').find(c => +c.getAttribute('min') > right) || null);
      }
    }
    return {before, right};
  }
  function appendOrdered(parent, node, laterTags) {
    parent.insertBefore(node, Array.from(parent.children).find(el => laterTags.includes(el.localName)) || null);
  }
  function addLinks(book, entries, passes) {
    const byFolio = new Map(passes.map(p => [p.folio,p.token]));
    const byRow = new Map(book.rows.map(r => [Number(r.getAttribute('r')),r]));
    const root = book.doc.documentElement;
    let links = first(root,'hyperlinks');
    if (!links) {
      links = newEl(root,'hyperlinks');
      appendOrdered(root,links,['printOptions','pageMargins','pageSetup','headerFooter','rowBreaks','colBreaks','customProperties','cellWatches','ignoredErrors','smartTags','drawing','legacyDrawing','legacyDrawingHF','drawingHF','picture','oleObjects','controls','webPublishItems','tableParts','extLst']);
    }
    const byRef = new Map(children(links,'hyperlink').map(el => [el.getAttribute('ref'), el]));
    const ids = new Set(children(book.rels.documentElement,'Relationship').map(r => r.getAttribute('Id')));
    let counter = 0;
    for (const entry of entries) {
      const url = CamilaPases.link(byFolio.get(entry.folio));
      const row = byRow.get(entry.fila);
      writeCell(row,book.cols.folio,entry.folio);
      const cell = writeCell(row,book.cols.enlace,'Ver invitación');
      const ref = cell.getAttribute('r'), old = byRef.get(ref);
      if (old) old.remove();
      let id;
      do { id = 'rIdCamila' + (++counter); } while (ids.has(id));
      ids.add(id);
      const rel = book.rels.createElementNS(relNs,'Relationship');
      rel.setAttribute('Id',id); rel.setAttribute('Type',book.idNs + '/hyperlink'); rel.setAttribute('Target',url); rel.setAttribute('TargetMode','External');
      book.rels.documentElement.append(rel);
      const h = newEl(links,'hyperlink'); h.setAttribute('ref',ref); h.setAttributeNS(book.idNs,'r:id',id); links.append(h);
    }
    const used = new Set(children(links,'hyperlink').map(h => h.getAttributeNS(book.idNs,'id')));
    for (const rel of children(book.rels.documentElement,'Relationship')) {
      if (rel.getAttribute('Type').endsWith('/hyperlink') && !used.has(rel.getAttribute('Id'))) rel.remove();
    }
  }
  function ensure(parent,tag,before) {
    let node=first(parent,tag);if(!node){node=newEl(parent,tag);parent.insertBefore(node,before||null);}return node;
  }
  async function styleBook(book) {
    const path=book.stylesPath;
    const styles=book.zip.file(path)?await part(book.zip,path):parse('<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="1"><font><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/></cellXfs></styleSheet>');
    const root=styles.documentElement;
    function add(group,tag,attrs={},content='') {
      const parent=first(root,group),node=newEl(parent,tag),index=parent.children.length;
      for(const [key,value]of Object.entries(attrs))node.setAttribute(key,value);
      if(content){const fragment=parse('<root xmlns="'+root.namespaceURI+'">'+content+'</root>');for(const child of [...fragment.documentElement.children])node.append(styles.importNode(child,true));}
      parent.append(node);parent.setAttribute('count',parent.children.length);return index;
    }
    const font=add('fonts','font',{},'<sz val="11"/><color rgb="FF173352"/><name val="Calibri"/>');
    const white=add('fonts','font',{},'<b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/>');
    const link=add('fonts','font',{},'<u/><sz val="11"/><color rgb="FF194F89"/><name val="Calibri"/>');
    const navy=add('fills','fill',{},'<patternFill patternType="solid"><fgColor rgb="FF173352"/><bgColor indexed="64"/></patternFill>');
    const alt=add('fills','fill',{},'<patternFill patternType="solid"><fgColor rgb="FFF0F4F8"/><bgColor indexed="64"/></patternFill>');
    let formats=first(root,'numFmts');if(!formats){formats=newEl(root,'numFmts');root.insertBefore(formats,root.firstChild);}const fmt=Math.max(163,...children(formats,'numFmt').map(n=>+n.getAttribute('numFmtId')))+1;
    const format=newEl(formats,'numFmt');format.setAttribute('numFmtId',fmt);format.setAttribute('formatCode','dd/mm/yyyy hh:mm');formats.append(format);formats.setAttribute('count',formats.children.length);
    const ids={};
    for(const [key,fontId,fillId,align,numFmtId]of [['header',white,navy,'left',0],['text',font,0,'left',0],['alternate',font,alt,'left',0],['number',font,0,'center',0],['numberAlt',font,alt,'center',0],['link',link,0,'left',0],['linkAlt',link,alt,'left',0],['date',font,0,'left',fmt],['dateAlt',font,alt,'left',fmt]]) {
      ids[key]=add('cellXfs','xf',{numFmtId,fontId,fillId,borderId:0,xfId:0,applyFont:1,applyFill:1,applyAlignment:1,applyNumberFormat:1},'<alignment horizontal="'+align+'" vertical="center" wrapText="1"/>');
    }
    let dxfs=first(root,'dxfs');if(!dxfs){dxfs=newEl(root,'dxfs');appendOrdered(root,dxfs,['tableStyles','colors','extLst']);}
    ids.states=[];
    for(const [fg,bg]of [['376858','EAF3ED'],['476C8A','EAF1F7'],['8B713F','F8F1E2'],['915B59','F8EEEC']]) {
      const i=dxfs.children.length,node=newEl(dxfs,'dxf');const frag=parse('<dxf xmlns="'+root.namespaceURI+'"><font><color rgb="FF'+fg+'"/></font><fill><patternFill patternType="solid"><fgColor rgb="FF'+bg+'"/><bgColor indexed="64"/></patternFill></fill></dxf>');for(const child of [...frag.documentElement.children])node.append(styles.importNode(child,true));dxfs.append(node);ids.states.push(i);
    }
    dxfs.setAttribute('count',dxfs.children.length);
    book.zip.file(path,xml(styles));
    const refs=await part(book.zip,'xl/_rels/workbook.xml.rels');
    if(!children(refs.documentElement,'Relationship').some(r=>r.getAttribute('Type').endsWith('/styles'))){const r=refs.createElementNS(relNs,'Relationship');r.setAttribute('Id','rIdCamilaStyles');r.setAttribute('Type',book.idNs+'/styles');r.setAttribute('Target','styles.xml');refs.documentElement.append(r);book.zip.file('xl/_rels/workbook.xml.rels',xml(refs));}
    const types=await part(book.zip,'[Content_Types].xml');addType(types,'/'+path,'application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml');book.zip.file('[Content_Types].xml',xml(types));
    return ids;
  }
  function addType(doc,path,type) {
    if(children(doc.documentElement,'Override').some(o=>o.getAttribute('PartName')===path))return;
    const o=newEl(doc.documentElement,'Override');o.setAttribute('PartName',path);o.setAttribute('ContentType',type);doc.documentElement.append(o);
  }
  function excelDate(value) {
    if(!value)return '';
    const parts=Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:'America/Mexico_City',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(new Date(value)).map(p=>[p.type,p.value]));
    return (Date.UTC(+parts.year,+parts.month-1,+parts.day,+parts.hour,+parts.minute,+parts.second)-Date.UTC(1899,11,30))/86400000;
  }
  async function finish(book,entries,passes) {
    const keys=Object.keys(titles);columns(book,keys);
    const byId=new Map(passes.map(p=>[p.folio,p]));
    const wanted=new Set(entries.map(e=>e.fila));const header=+book.header.getAttribute('r');
    // Conserva columnas adicionales y otras hojas; elimina filas vacías sobrantes de la plantilla.
    for(const row of [...book.rows])if(+row.getAttribute('r')>header && !wanted.has(+row.getAttribute('r')))row.remove();
    book.rows=children(book.data,'row');
    for(const entry of entries){const p=byId.get(entry.folio);if(!p)throw new Error('No se encontró una invitación guardada para exportar.');let row=book.rows.find(r=>+r.getAttribute('r')===entry.fila);if(!row){row=newEl(book.data,'row');row.setAttribute('r',entry.fila);book.data.append(row);book.rows.push(row);}
      for(const key of keys.filter(k=>!['folio','enlace'].includes(k))){let value=p[key]??'';if(key==='estado')value=p.estado==='asiste'?(p.confirmados<p.boletos?'Confirmación parcial':'Confirmado'):p.estado==='no_asiste'?'No asiste':'Pendiente';if(Array.isArray(value))value=value.join(', ');if(key==='confirmado_en')value=value?excelDate(value)-(book.date1904?1462:0):'';writeCell(row,book.cols[key],value);}
    }
    addLinks(book,entries,passes);
    const ids=await styleBook(book),root=book.doc.documentElement;
    const right=Math.max(...book.rows.flatMap(r=>children(r,'c').map(cellCol))),bottom=Math.max(header,...entries.map(e=>e.fila));
    const range='A'+header+':'+colName(right)+bottom;
    const views=ensure(root,'sheetViews',first(root,'sheetFormatPr')||first(root,'cols')||book.data),view=ensure(views,'sheetView');view.setAttribute('workbookViewId','0');view.setAttribute('showGridLines','0');view.replaceChildren();
    const pane=newEl(view,'pane');for(const [k,v]of Object.entries({ySplit:header,topLeftCell:'A'+(header+1),activePane:'bottomLeft',state:'frozen'}))pane.setAttribute(k,v);view.append(pane);
    const widths=ensure(root,'cols',book.data);widths.replaceChildren();
    for(let i=1;i<=right;i++){const key=Object.keys(book.cols).find(k=>book.cols[k]===i),col=newEl(widths,'col');for(const [k,v]of Object.entries({min:i,max:i,width:key==='nombre'?32:['mensaje','asistentes'].includes(key)?44:key==='confirmado_en'?24:key==='enlace'?20:key==='boletos'||key==='confirmados'?18:24,customWidth:1,hidden:key==='folio'?1:0}))col.setAttribute(k,v);widths.append(col);}
    const names=new Set();
    for(let c=1;c<=right;c++){let title=cellValue(children(book.header,'c').find(x=>cellCol(x)===c),book.strings)||'Columna '+c;const base=title;let n=2;while(names.has(title))title=base+' '+n++;names.add(title);writeCell(book.header,c,title).setAttribute('s',ids.header);}
    book.header.setAttribute('ht','32');book.header.setAttribute('customHeight','1');
    for(const [i,entry]of entries.entries()){const row=book.rows.find(r=>+r.getAttribute('r')===entry.fila);row.setAttribute('ht','32');row.setAttribute('customHeight','1');for(let c=1;c<=right;c++){let cell=children(row,'c').find(x=>cellCol(x)===c);if(!cell)cell=writeCell(row,c,'');const key=Object.keys(book.cols).find(k=>book.cols[k]===c);if(!key)continue;const kind=key==='enlace'?'link':key==='confirmado_en'?'date':['boletos','confirmados'].includes(key)?'number':'text';cell.setAttribute('s',ids[kind==='text'?(i%2?'alternate':'text'):kind+(i%2?'Alt':'')]);}}
    let dim=first(root,'dimension');if(!dim){dim=newEl(root,'dimension');root.insertBefore(dim,views);}dim.setAttribute('ref','A1:'+colName(right)+bottom);
    for(const tag of ['autoFilter','conditionalFormatting','tableParts'])children(root,tag).forEach(n=>n.remove());
    const filter=newEl(root,'autoFilter');filter.setAttribute('ref',range);appendOrdered(root,filter,['sortState','dataConsolidate','customSheetViews','mergeCells','phoneticPr','conditionalFormatting','dataValidations','hyperlinks','printOptions','pageMargins','pageSetup','headerFooter','drawing','extLst']);
    if(entries.length){const conditional=newEl(root,'conditionalFormatting');conditional.setAttribute('sqref',colName(book.cols.estado)+(header+1)+':'+colName(book.cols.estado)+bottom);['Confirmado','Confirmación parcial','Pendiente','No asiste'].forEach((label,i)=>{const rule=newEl(conditional,'cfRule');rule.setAttribute('type','cellIs');rule.setAttribute('operator','equal');rule.setAttribute('priority',i+1);rule.setAttribute('dxfId',ids.states[i]);const formula=newEl(rule,'formula');formula.textContent='"'+label+'"';rule.append(formula);conditional.append(rule);});appendOrdered(root,conditional,['dataValidations','hyperlinks','printOptions','pageMargins','pageSetup','headerFooter','drawing','extLst']);}
    const types=await part(book.zip,'[Content_Types].xml');
    // Reemplaza las tablas de la hoja de invitados, sin tocar tablas de otras hojas.
    for(const ref of children(book.rels.documentElement,'Relationship').filter(r=>r.getAttribute('Type').endsWith('/table'))){const path=resolvePart(book.path,ref.getAttribute('Target'));book.zip.remove(path);children(types.documentElement,'Override').filter(o=>o.getAttribute('PartName')==='/'+path).forEach(o=>o.remove());ref.remove();}
    if(entries.length){let tableId=1;for(const path of Object.keys(book.zip.files).filter(p=>/^xl\/tables\/.*\.xml$/.test(p))){const table=await part(book.zip,path);tableId=Math.max(tableId,+(table.documentElement.getAttribute('id')||0)+1);}
      const tablePath='xl/tables/camila'+tableId+'.xml',tableName='CamilaInvitados'+tableId;
      const table=parse('<table xmlns="'+root.namespaceURI+'" id="'+tableId+'" name="'+tableName+'" displayName="'+tableName+'" ref="'+range+'" totalsRowShown="0"><autoFilter ref="'+range+'"/><tableColumns/><tableStyleInfo name="TableStyleMedium2" showFirstColumn="0" showLastColumn="0" showRowStripes="1" showColumnStripes="0"/></table>');const list=first(table.documentElement,'tableColumns');let i=0;for(const title of names){const c=newEl(list,'tableColumn');c.setAttribute('id',++i);c.setAttribute('name',title);list.append(c);}list.setAttribute('count',i);book.zip.file(tablePath,xml(table));
      let rid='rIdCamilaTable';while(children(book.rels.documentElement,'Relationship').some(r=>r.getAttribute('Id')===rid))rid+='X';const rel=book.rels.createElementNS(relNs,'Relationship');rel.setAttribute('Id',rid);rel.setAttribute('Type',book.idNs+'/table');rel.setAttribute('Target','/'+tablePath);book.rels.documentElement.append(rel);
      const parts=newEl(root,'tableParts'),partNode=newEl(parts,'tablePart');parts.setAttribute('count','1');partNode.setAttributeNS(book.idNs,'r:id',rid);parts.append(partNode);appendOrdered(root,parts,['extLst']);addType(types,'/'+tablePath,'application/vnd.openxmlformats-officedocument.spreadsheetml.table+xml');
    }
    book.zip.file('[Content_Types].xml',xml(types));book.zip.file(book.path,xml(book.doc));book.zip.file(book.pathRels,xml(book.rels));
    return book.zip.generateAsync({type:'blob',compression:'DEFLATE',mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
  }
  async function exportList(imported,passes){return finish(imported.book,imported.entries,passes);}
  async function exportAll(passes){const response=await fetch('assets/excel/Plantilla_invitados.xlsx');if(!response.ok)throw new Error('No se pudo cargar la plantilla.');const book=await openBook(await response.arrayBuffer());return finish(book,passes.map((p,i)=>({fila:i+2,folio:p.folio})),passes);}
  window.CamilaExcel={readList,checkRow,exportList,exportAll};
})();
