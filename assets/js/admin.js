(() => {
  'use strict';
  const id=key=>document.getElementById(key), model=CamilaAdmin;
  let passes=new Map(), imported, edit, created, fileVersion=0, lastUrl, busy=false, active=false;
  let signingOut=false, sessionVersion=0, refreshTask, page=1, filter='todos', direction='asc', choices={};
  const pageSize=12;
  const date=value=>value ? new Intl.DateTimeFormat('es-MX',{dateStyle:'medium',timeStyle:'short',timeZone:'America/Mexico_City'}).format(new Date(value)) : 'Sin fecha registrada';
  function notice(key,message='',error=false) {const el=id(key);el.textContent=message;el.dataset.error=String(error);}
  function el(tag,text,className) {const node=document.createElement(tag);if(text!==undefined)node.textContent=text;if(className)node.className=className;return node;}
  function action(text,handler,className='') {const b=el('button',text,className);b.type='button';b.addEventListener('click',handler);return b;}
  function download(blob,filename,offerAgain=false) {
    const url=URL.createObjectURL(blob),a=el('a');a.href=url;a.download=filename;document.body.append(a);a.click();a.remove();
    if(offerAgain){if(lastUrl)URL.revokeObjectURL(lastUrl);lastUrl=url;Object.assign(id('lastDownload'),{href:url,download:filename,hidden:false});}
    else setTimeout(()=>URL.revokeObjectURL(url),60000);
  }
  async function copy(url,key='tableStatus') {
    try{await navigator.clipboard.writeText(url);notice(key,'Enlace copiado. Listo para compartir.');}
    catch{notice(key,'Copia este enlace: '+url);}
  }
  function reset() {
    sessionVersion++;fileVersion++;active=false;imported=null;edit=null;created=null;passes=new Map();choices={};
    if(lastUrl)URL.revokeObjectURL(lastUrl);lastUrl=null;
    for(const key of ['panel','logout','preview','lastDownload','createdLink'])id(key).hidden=true;
    id('loginBox').hidden=false;id('archivo').value='';id('fileName').textContent='Ningún archivo seleccionado';id('password').value='';
    for(const key of ['saved','guestCards','sample','metrics','detailsBody'])id(key).replaceChildren();
    id('onePass').reset();id('editPass').reset();document.querySelectorAll('dialog[open]').forEach(d=>d.close());
    for(const key of ['tableStatus','fileStatus','loginStatus','createStatus'])notice(key);
  }
  function badge(p){const state=model.state(p);return el('span',model.labels[state],'badge '+state);}
  function metrics() {
    const s=model.stats([...passes.values()]);
    const definitions=[['Invitaciones generadas',s.invitaciones],['Boletos asignados',s.asignados],['Boletos confirmados',s.confirmados],['Boletos pendientes de respuesta',s.pendientes],['Boletos no utilizados',s.noUtilizados],['Familias que han respondido',s.respondidas],['Familias pendientes',s.familiasPendientes],['Familias que no asistirán',s.noAsisten],['Confirmación · boletos confirmados / asignados',s.confirmacion.toFixed(1)+' %'],['Respuesta · invitaciones respondidas / total',s.respuesta.toFixed(1)+' %']];
    id('metrics').replaceChildren(...definitions.map(([label,value],i)=>{const node=el('div',undefined,'metric'+(i===2?' featured':'')+(i>=8?' wide':''));node.append(el('span',label),el('strong',value));return node;}));
    const confirmed=s.asignados?s.confirmados/s.asignados*100:0,pending=s.asignados?s.pendientes/s.asignados*100:0;
    id('ticketChart').style.background=s.asignados?`conic-gradient(#537c70 0 ${confirmed}%, #c4a66d ${confirmed}% ${confirmed+pending}%, #b7c3cf ${confirmed+pending}% 100%)`:'#e1e6eb';
    id('ticketChart').setAttribute('aria-label',`${s.confirmados} boletos confirmados, ${s.pendientes} pendientes y ${s.noUtilizados} no utilizados. Total ${s.asignados}.`);
    id('chartTotal').textContent=s.asignados;id('invitationCount').textContent=s.invitaciones;
    id('chartLegend').replaceChildren(...[['Confirmados',s.confirmados,'#537c70'],['Pendientes',s.pendientes,'#c4a66d'],['No utilizados',s.noUtilizados,'#b7c3cf']].map(([label,n,color])=>{const row=el('div'),dot=el('i',undefined,'dot');dot.style.background=color;row.append(dot,el('span',label),el('strong',n));return row;}));
    id('downloadAll').disabled=!passes.size || busy;
  }
  function details(p) {
    id('detailsTitle').textContent=p.nombre;
    const list=el('dl',undefined,'details-list');
    const values=[['Boletos asignados',p.boletos],['Boletos confirmados',p.confirmados],['Mesa',p.mesa||'Sin asignar'],['Asistencia',model.labels[model.state(p)]],['Última confirmación',date(p.confirmado_en)],['Asistentes',p.asistentes.join('\n')||'Sin asistentes registrados'],['Teléfono',p.telefono||'No proporcionado'],['Canción',p.cancion||'No proporcionada'],['Mensaje',p.mensaje||'Sin mensaje']];
    for(const [label,value] of values){const item=el('div',undefined,['Asistentes','Mensaje','Última confirmación'].includes(label)?'full':'');item.append(el('dt',label),el('dd',value));list.append(item);}
    id('detailsBody').replaceChildren(badge(p),list);id('detailsDialog').showModal();
  }
  function editForm(p) {
    edit=p;id('editName').value=p.nombre;id('editCount').value=p.boletos;id('editTable').value=p.mesa;notice('editStatus');id('editDialog').showModal();
  }
  async function remove(p) {
    if(busy || !confirm('¿Eliminar la invitación de '+p.nombre+'? Su enlace dejará de funcionar y su respuesta se eliminará.'))return;
    busy=true;let committed=false;
    try{await CamilaPases.rpc('eliminar',{p_folio:p.folio,p_token:p.token});committed=true;if(created?.folio===p.folio)id('createdLink').hidden=true;await refresh(true);notice('tableStatus','Invitación eliminada.');}
    catch(e){notice('tableStatus',(committed?'La invitación se eliminó. Actualiza la lista para ver el cambio. ':'')+e.message,true);}finally{busy=false;metrics();}
  }
  function actions(p) {
    const row=el('div',undefined,'row-actions'),url=CamilaPases.link(p.token),open=el('a','Abrir ↗');Object.assign(open,{href:url,target:'_blank',rel:'noopener noreferrer'});
    row.append(action('Detalles',()=>details(p)),action('Copiar',()=>copy(url)),open,action('Editar',()=>editForm(p)),action('Eliminar',()=>remove(p),'danger'));return row;
  }
  function renderList() {
    const selected=model.select([...passes.values()],{search:id('guestSearch').value,filter,sort:id('sortBy').value,direction});
    const pages=Math.max(1,Math.ceil(selected.length/pageSize));page=Math.min(page,pages);
    id('saved').replaceChildren();id('guestCards').replaceChildren();
    for(const p of selected.slice((page-1)*pageSize,page*pageSize)){
      const row=el('tr');const name=el('td',p.nombre),tickets=el('td',undefined,'ticket-cell');tickets.append(el('strong',p.confirmados+' / '+p.boletos),el('small','confirmados / asignados'));
      const status=el('td');status.append(badge(p));const controls=el('td');controls.append(actions(p));row.append(name,tickets,el('td',p.mesa||'Sin asignar'),status,el('td',date(p.confirmado_en),'date-cell'),controls);id('saved').append(row);
      const card=el('article',undefined,'guest-card'),top=el('div',undefined,'card-top');top.append(el('h3',p.nombre),badge(p));const stats=el('div',undefined,'card-stats');for(const [label,value] of [['Confirmados / asignados',p.confirmados+' / '+p.boletos],['Mesa',p.mesa||'Sin asignar']]){const block=el('div');block.append(el('span',label),el('strong',value));stats.append(block);}card.append(top,stats,el('div',date(p.confirmado_en),'date-cell'),actions(p));id('guestCards').append(card);
    }
    id('emptyState').hidden=Boolean(selected.length);id('guestTable').hidden=!selected.length;id('pagination').hidden=!selected.length;
    id('emptyTitle').textContent=passes.size?'No encontramos coincidencias':'Tu lista comienza aquí';
    id('emptyText').textContent=passes.size?'Prueba otro nombre o cambia el filtro de asistencia.':'Agrega tu primera familia arriba o importa tu lista de Excel.';
    id('emptyAction').textContent=passes.size?'Limpiar búsqueda y filtros':'Agregar una invitación';
    id('pageInfo').textContent=`${selected.length ? (page-1)*pageSize+1:0}–${Math.min(page*pageSize,selected.length)} de ${selected.length} invitaciones · Página ${page} de ${pages}`;
    id('previousPage').disabled=page===1;id('nextPage').disabled=page===pages;
  }
  async function refresh(fresh=false) {
    if(refreshTask){if(!fresh)return refreshTask;try{await refreshTask;}catch{ /* Una operación guardada necesita una lectura nueva. */ }}
    const version=sessionVersion;
    refreshTask=(async()=>{const all=await CamilaPases.rpc('listar');if(version!==sessionVersion)throw new Error('La sesión se cerró. Vuelve a iniciar sesión.');passes=new Map(all.map(p=>[p.folio,p]));metrics();renderList();id('lastSync').textContent='Actualizado '+new Intl.DateTimeFormat('es-MX',{hour:'2-digit',minute:'2-digit',second:'2-digit'}).format(new Date());if(imported && !busy)renderPreview();})();
    try{await refreshTask;}finally{refreshTask=null;}
  }
  async function backgroundRefresh(){if(!active || busy || document.hidden)return;try{await refresh();}catch{id('lastSync').textContent='No se pudo actualizar. Se muestran los últimos datos recibidos.';}}
  async function enter(){await refresh();active=true;id('loginBox').hidden=true;id('panel').hidden=false;id('logout').hidden=false;}
  async function start(){try{const auth=CamilaPases.client().auth;auth.onAuthStateChange(event=>{if(event==='SIGNED_OUT'&&!signingOut)reset();});const {data,error}=await auth.getSession();if(error)throw error;if(data.session)await enter();}catch(e){notice('loginStatus',e.message,true);}}
  id('loginForm').addEventListener('submit',async e=>{
    e.preventDefault();const button=e.target.querySelector('button');button.disabled=true;notice('loginStatus','Entrando…');
    try{const username=id('username').value.trim().toLowerCase();if(!/^[a-z0-9][a-z0-9._-]{0,49}$/.test(username))throw new Error('Revisa tu nombre de usuario.');const {error}=await CamilaPases.client().auth.signInWithPassword({email:username+'@admin.com',password:id('password').value});if(error)throw new Error(error.code==='invalid_credentials'?'Revisa tu usuario y contraseña.':error.message);id('password').value='';await enter();notice('loginStatus');}catch(err){notice('loginStatus',err.message,true);}finally{button.disabled=false;}
  });
  id('logout').addEventListener('click',async()=>{
    if(busy)return;signingOut=true;sessionVersion++;id('logout').disabled=true;notice('tableStatus','Cerrando sesión…');
    try{const {error}=await CamilaPases.client().auth.signOut({scope:'local'});if(error)throw error;reset();}catch(e){reset();notice('loginStatus','Se cerró el acceso local, pero no se pudo confirmar el cierre en el servidor. '+e.message,true);}finally{signingOut=false;id('logout').disabled=false;}
  });
  id('onePass').addEventListener('submit',async e=>{
    e.preventDefault();if(busy)return;busy=true;const button=e.target.querySelector('button');button.disabled=true;notice('createStatus','Creando invitación…');let committed=false;
    try{const row=await CamilaExcel.checkRow({nombre:id('oneName').value,boletos:id('oneCount').value,mesa:id('oneTable').value},1);const result=await CamilaPases.rpc('importar',{filas:[row]});created=result[0];committed=true;id('onePass').reset();id('createdLink').hidden=false;id('openCreated').href=CamilaPases.link(created.token);notice('createStatus','Invitación creada para '+row.nombre+'.');await refresh(true);}catch(err){notice('createStatus',(committed?'La invitación se creó y su enlace está disponible. Actualiza la lista. ':'')+err.message,true);}finally{busy=false;button.disabled=false;metrics();}
  });
  id('copyCreated').addEventListener('click',()=>{if(created)copy(CamilaPases.link(created.token),'createStatus');});
  id('editPass').addEventListener('submit',async e=>{
    e.preventDefault();if(busy||!edit)return;busy=true;const button=e.target.querySelector('button[type=submit]');button.disabled=true;let committed=false;
    try{const row=await CamilaExcel.checkRow({nombre:id('editName').value,boletos:id('editCount').value,mesa:id('editTable').value,folio:edit.folio},1);row.token=edit.token;await CamilaPases.rpc('importar',{filas:[row]});committed=true;id('editDialog').close();await refresh(true);notice('tableStatus','Cambios guardados. El enlace y la respuesta se conservaron.');}catch(err){notice(committed?'tableStatus':'editStatus',(committed?'Los cambios se guardaron. Actualiza la lista. ':'')+err.message,true);}finally{busy=false;button.disabled=false;metrics();}
  });
  document.querySelectorAll('[data-close]').forEach(button=>button.addEventListener('click',()=>id(button.dataset.close).close()));
  function renderPreview() {
    if(!imported)return;
    const plan=model.plan(imported.entries,[...passes.values()],choices),counts={Nueva:0,Actualizar:0,'Sin cambios':0,Conflicto:0};
    const body=id('sample');body.replaceChildren();
    for(const item of plan){counts[item.operation]++;const tr=el('tr'),cell=el('td');cell.append(el('strong',item.operation));if(item.conflict)cell.append(el('span',item.conflict,'conflict-note'));
      const source=imported.entries.find(entry=>entry.fila===item.row.fila);
      if(!source.explicitId&&!source.token&&item.candidates.length&&(!item.previous||choices[item.row.fila])){const select=el('select');select.setAttribute('aria-label','Resolver fila '+item.row.fila);select.add(new Option('Elegir una invitación…',''));select.add(new Option('Crear otra familia independiente','new'));for(const [i,p]of item.candidates.entries())select.add(new Option(p.nombre+' · '+p.boletos+' boletos · Mesa '+(p.mesa||'sin asignar')+' · '+(i+1),p.folio));select.value=choices[item.row.fila]?.startsWith('new:')?'new':choices[item.row.fila]||'';select.addEventListener('change',()=>{choices[item.row.fila]=select.value==='new'?'new:F-'+crypto.randomUUID().toUpperCase():select.value;renderPreview();});cell.append(select);}
      tr.append(el('td',item.row.fila),el('td',item.row.nombre),el('td',item.row.boletos),cell);body.append(tr);
    }
    id('previewSummary').textContent=`${plan.length} invitaciones · ${counts.Nueva} nuevas · ${counts.Actualizar} por actualizar · ${counts['Sin cambios']} sin cambios · ${counts.Conflicto} con conflictos`;
    id('confirmImport').disabled=Boolean(counts.Conflicto)||busy;id('preview').hidden=false;return plan;
  }
  id('archivo').addEventListener('change',async e=>{
    const version=++fileVersion,file=e.target.files[0];imported=null;choices={};id('preview').hidden=true;id('lastDownload').hidden=true;notice('fileStatus');id('fileName').textContent=file?.name||'Ningún archivo seleccionado';if(!file)return;
    try{if(!/\.xlsx$/i.test(file.name))throw new Error('Selecciona un archivo .xlsx.');if(file.size>15*1024*1024)throw new Error('El archivo supera 15 MB.');notice('fileStatus','Leyendo tu lista…');await refresh();const result=await CamilaExcel.readList(await file.arrayBuffer());if(version!==fileVersion)return;imported={...result,filename:file.name.replace(/\.xlsx$/i,'')};renderPreview();notice('fileStatus','Hoja: '+result.book.sheetName+'. Revisa los cambios antes de guardar.');}catch(err){if(version===fileVersion)notice('fileStatus',err.message,true);}
  });
  id('confirmImport').addEventListener('click',async()=>{
    if(!imported||busy)return;busy=true;id('confirmImport').disabled=true;id('archivo').disabled=true;id('logout').disabled=true;let committed=false;
    try{await refresh();const plan=renderPreview();if(plan.some(x=>x.conflict))throw new Error('Resuelve los conflictos antes de importar.');const batch=imported;const rows=plan.map(item=>({...item.row,token:item.previous?.token||item.row.token}));notice('fileStatus','Guardando invitaciones…');await CamilaPases.rpc('importar',{filas:rows});committed=true;await refresh(true);const result=rows.map(row=>passes.get(row.folio));const blob=await CamilaExcel.exportList({...batch,entries:rows},result);download(blob,batch.filename+'_con_enlaces.xlsx',true);imported=null;choices={};id('preview').hidden=true;id('archivo').value='';id('fileName').textContent='Ningún archivo seleccionado';notice('fileStatus','Se guardaron '+rows.length+' invitaciones. Las confirmaciones existentes se conservaron.');}catch(err){notice('fileStatus',(committed?'Los datos se guardaron. Puedes descargar la lista completa. ':'')+err.message,true);}finally{busy=false;id('archivo').disabled=false;id('logout').disabled=false;if(imported)renderPreview();metrics();}
  });
  id('downloadAll').addEventListener('click',async()=>{if(busy)return;busy=true;id('downloadAll').disabled=true;try{await refresh();download(await CamilaExcel.exportAll([...passes.values()]),'Invitados_Camila_con_enlaces.xlsx');notice('fileStatus','Excel descargado con todos los enlaces y las respuestas actuales.');}catch(e){notice('fileStatus',e.message,true);}finally{busy=false;metrics();}});
  id('refresh').addEventListener('click',async()=>{if(busy)return;id('refresh').disabled=true;try{await refresh();notice('tableStatus','Lista y estadísticas actualizadas.');}catch(e){notice('tableStatus',e.message,true);}finally{id('refresh').disabled=false;}});
  function listChanged(){page=1;renderList();}
  id('guestSearch').addEventListener('input',listChanged);id('sortBy').addEventListener('change',listChanged);
  id('sortDirection').addEventListener('click',()=>{direction=direction==='asc'?'desc':'asc';id('sortDirection').textContent=direction==='asc'?'↑ Ascendente':'↓ Descendente';id('sortDirection').setAttribute('aria-label','Cambiar a orden '+(direction==='asc'?'descendente':'ascendente'));listChanged();});
  id('filters').addEventListener('click',e=>{const button=e.target.closest('[data-filter]');if(!button)return;filter=button.dataset.filter;id('filters').querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));listChanged();});
  id('emptyAction').addEventListener('click',()=>{if(passes.size){id('guestSearch').value='';id('filters').querySelector('[data-filter=todos]').click();}else id('oneName').focus();});
  id('previousPage').addEventListener('click',()=>{page--;renderList();});id('nextPage').addEventListener('click',()=>{page++;renderList();});
  setInterval(backgroundRefresh,30000);window.addEventListener('focus',backgroundRefresh);document.addEventListener('visibilitychange',backgroundRefresh);
  start();
})();
