(() => {
  'use strict';
  const relNs = 'http://schemas.openxmlformats.org/package/2006/relationships';
  const normal = text => String(text).normalize('NFKD').replace(/\p{M}/gu, '').trim().toLowerCase().replace(/[\s_/.-]+/g, ' ');
  const fields = {
    nombre: ['familia o invitado','invitado o familia','invitado familia','familia invitado','nombre','familia','invitado','nombre de familia','nombre del invitado'],
    boletos: ['boletos','boletos asignados','pases','lugares','cupo','cantidad de boletos','numero de boletos'],
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
    return {zip, doc, path, pathRels, rels, idNs:idAttr.namespaceURI, rows, data, header, cols, strings, sheetName:sheet.getAttribute('name')};
  }
  async function defaultFolio(name) {
    const data = new TextEncoder().encode(normal(name));
    const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', data));
    return 'F-' + Array.from(hash.slice(0, 9), n => n.toString(16).padStart(2, '0')).join('').toUpperCase();
  }
  async function checkRow(values, rowNumber) {
    const nombre = String(values.nombre ?? '').trim();
    const boletos = Number(String(values.boletos ?? '').trim());
    const mesa = values.mesa == null ? null : String(values.mesa).trim();
    if (!nombre || nombre.length > 160) throw new Error('Escribe un nombre de hasta 160 caracteres.');
    if (!Number.isInteger(boletos) || boletos < 1 || boletos > 15) throw new Error('Los boletos deben ser un número entero entre 1 y 15.');
    if (mesa && mesa.length > 80) throw new Error('La mesa admite hasta 80 caracteres.');
    const folio = String(values.folio ?? '').trim().toUpperCase() || await defaultFolio(nombre);
    if (!/^[A-Z0-9][A-Z0-9._-]{0,49}$/.test(folio)) throw new Error('Usa un folio de hasta 50 letras, números, puntos, guiones o guiones bajos.');
    let token = null;
    if (values.enlace) {
      try { token = new URL(String(values.enlace)).searchParams.get('invitado'); } catch {}
      if (!CamilaPases.uuid.test(token)) throw new Error('La columna Enlace debe contener un pase generado por este panel.');
    }
    return {fila:rowNumber, folio, nombre, boletos, mesa, token};
  }
  async function readList(bytes) {
    const book = await openBook(bytes);
    const entries = [], errors = [], seen = new Map();
    const headerNumber = Number(book.header.getAttribute('r'));
    for (const row of book.rows) {
      const rowNumber = Number(row.getAttribute('r'));
      if (rowNumber <= headerNumber) continue;
      const cells = new Map(children(row, 'c').map(c => [cellCol(c), c]));
      const values = {};
      let formula = false;
      for (const [field,index] of Object.entries(book.cols)) {
        const cell = cells.get(index);
        values[field] = cellValue(cell, book.strings);
        if (first(cell,'f')) formula = true;
      }
      if (!formula && Object.values(values).every(v => !String(v).trim())) continue;
      try {
        if (formula) throw new Error('Pega los campos del pase como valores antes de importar.');
        const entry = await checkRow(values, rowNumber);
        if (seen.has(entry.folio)) throw new Error('Comparte folio con la fila ' + seen.get(entry.folio) + '. Para familias distintas, escribe folios diferentes.');
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
  const titles = {nombre:'Familia o invitado',boletos:'Boletos',mesa:'Mesa',folio:'Folio',enlace:'Enlace',estado:'Asistencia',confirmados:'Boletos confirmados',asistentes:'Asistentes',telefono:'Teléfono',cancion:'Canción',mensaje:'Mensaje'};
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
      const cell = writeCell(row,book.cols.enlace,url);
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
  function newRight(ref, start, end) {
    const range = /^([A-Z]+)(\d+):([A-Z]+)(\d+)$/.exec(ref || '');
    if (!range || colIndex(range[3]) !== start) return ref;
    return range[1] + range[2] + ':' + colName(end) + range[4];
  }
  async function extendTables(book, before, right) {
    if (before === right) return;
    const header = book.header.getAttribute('r');
    const root = book.doc.documentElement;
    const updateFilter = el => { if (el) el.setAttribute('ref',newRight(el.getAttribute('ref'),before,right)); };
    updateFilter(first(root,'autoFilter'));
    for (const rel of children(book.rels.documentElement,'Relationship').filter(r => r.getAttribute('Type').endsWith('/table'))) {
      const path = resolvePart(book.path,rel.getAttribute('Target'));
      const doc = await part(book.zip,path), table = doc.documentElement;
      const old = table.getAttribute('ref'), next = newRight(old,before,right);
      if (old === next || !old.startsWith(old.match(/^[A-Z]+/)[0] + header + ':')) continue;
      const list = first(table,'tableColumns');
      let id = Math.max(0,...children(list,'tableColumn').map(c => +c.getAttribute('id')));
      for (let n = before+1; n <= right; n++) {
        const col = newEl(list,'tableColumn');
        col.setAttribute('id',++id);
        col.setAttribute('name',titles[Object.keys(book.cols).find(k => book.cols[k] === n)]);
        list.append(col);
      }
      list.setAttribute('count',children(list,'tableColumn').length);
      table.setAttribute('ref',next); updateFilter(first(table,'autoFilter')); book.zip.file(path,xml(doc));
    }
  }
  async function finish(book, entries, passes, keys) {
    const {before,right} = columns(book,keys);
    await extendTables(book,before,right);
    addLinks(book,entries,passes);
    const dim = first(book.doc.documentElement,'dimension');
    if (dim) {
      const end = dim.getAttribute('ref').split(':').pop().match(/([A-Z]+)(\d+)/);
      const maxRow = Math.max(Number(end[2]),...entries.map(e => e.fila));
      dim.setAttribute('ref','A1:' + colName(Math.max(colIndex(end[1]),right)) + maxRow);
    }
    book.zip.file(book.path,xml(book.doc)); book.zip.file(book.pathRels,xml(book.rels));
    return book.zip.generateAsync({type:'blob',compression:'DEFLATE',mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
  }
  async function exportList(imported, passes) {
    return finish(imported.book,imported.entries,passes,['folio','enlace']);
  }
  async function exportAll(passes) {
    const response = await fetch('assets/excel/Plantilla_invitados.xlsx');
    if (!response.ok) throw new Error('No se pudo cargar la plantilla.');
    const book = await openBook(await response.arrayBuffer());
    const keys = Object.keys(titles);
    columns(book,keys);
    const entries = [];
    for (const [index,pass] of passes.entries()) {
      const fila = index + 2;
      let row = book.rows.find(r => Number(r.getAttribute('r')) === fila);
      if (!row) { row = newEl(book.data,'row'); row.setAttribute('r',fila); book.data.append(row); book.rows.push(row); }
      for (const key of keys.filter(k => !['folio','enlace'].includes(k))) {
        let value = pass[key] ?? '';
        if (key === 'estado') value = {pendiente:'Pendiente',asiste:'Asiste',no_asiste:'No asiste'}[value] || value;
        if (Array.isArray(value)) value = value.join(', ');
        writeCell(row,book.cols[key],value);
      }
      entries.push({fila,folio:pass.folio});
    }
    return finish(book,entries,passes,keys);
  }
  window.CamilaExcel = {readList,checkRow,exportList,exportAll};
})();
