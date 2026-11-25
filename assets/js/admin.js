(() => {
  'use strict';
  const id = key => document.getElementById(key);
  let passes = new Map(), imported, edit, fileVersion = 0, lastUrl, saving = false;
  let signingOut = false, sessionVersion = 0;
  function notice(key, message = '', error = false) {
    const el = id(key); el.textContent = message; el.dataset.error = String(error);
  }
  function cell(row, value) {
    const td = document.createElement('td'); td.textContent = value; row.append(td); return td;
  }
  function download(blob, filename, offerAgain = false) {
    const url = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = url; a.download = filename; document.body.append(a); a.click(); a.remove();
    if (offerAgain) {
      if (lastUrl) URL.revokeObjectURL(lastUrl); lastUrl = url;
      const again = id('lastDownload'); again.href = url; again.download = filename; again.hidden = false;
    } else setTimeout(() => URL.revokeObjectURL(url), 60000);
  }
  function reset() {
    sessionVersion++;
    fileVersion++; imported = null; edit = null; passes = new Map();
    if (lastUrl) URL.revokeObjectURL(lastUrl); lastUrl = null;
    for (const key of ['panel','logout','preview','lastDownload','onePass']) id(key).hidden = true;
    id('loginBox').hidden = false; id('archivo').value = ''; id('password').value = '';
    id('saved').replaceChildren(); id('sample').replaceChildren(); id('onePass').reset();
    for (const key of ['tableStatus','fileStatus','loginStatus']) notice(key);
  }
  function action(label, handler) {
    const btn = document.createElement('button'); btn.type = 'button'; btn.className = 'link'; btn.textContent = label;
    btn.addEventListener('click',handler); return btn;
  }
  function editForm(pass) {
    edit = pass || null;
    id('onePass').reset(); id('onePass').hidden = false;
    id('editTitle').textContent = edit ? 'Editar pase' : 'Agregar un pase';
    id('oneName').value = edit?.nombre ?? ''; id('oneCount').value = edit?.boletos ?? 1;
    id('oneTable').value = edit?.mesa ?? ''; id('oneFolio').value = edit?.folio ?? '';
    id('oneFolio').readOnly = Boolean(edit); id('oneName').focus();
    notice('tableStatus');
  }
  async function refresh() {
    const version = sessionVersion;
    const all = await CamilaPases.rpc('listar');
    if (version !== sessionVersion) throw new Error('La sesión se cerró. Vuelve a iniciar sesión.');
    passes = new Map(all.map(p => [p.folio,p]));
    const total = all.reduce((sum,p) => sum+p.boletos,0);
    const confirmed = all.reduce((sum,p) => sum+p.confirmados,0);
    id('totals').textContent = all.length + ' pases · ' + total + ' boletos asignados · ' + confirmed + ' confirmados';
    id('downloadAll').disabled = !all.length;
    const body = id('saved'); body.replaceChildren();
    for (const p of all) {
      const tr = document.createElement('tr');
      cell(tr,p.nombre); cell(tr,p.boletos); cell(tr,p.mesa || '—');
      cell(tr,p.estado === 'asiste' ? 'Confirmados ' + p.confirmados + ' de ' + p.boletos : (p.estado === 'no_asiste' ? 'No asiste' : 'Pendiente'));
      const actions = cell(tr,''); actions.className = 'actions-cell';
      const open = document.createElement('a'); open.textContent = 'Ver'; open.href = CamilaPases.link(p.token);
      open.target = '_blank'; open.rel = 'noopener noreferrer';
      actions.append(open,action('Copiar',async () => {
        try {await navigator.clipboard.writeText(open.href); notice('tableStatus','Enlace copiado para ' + p.nombre + '.');}
        catch {notice('tableStatus','Copia el enlace de ' + p.nombre + ': ' + open.href);}
      }),action('Editar',() => editForm(p)),action('Eliminar',async event => {
        if (!confirm('¿Eliminar el pase de ' + p.nombre + '? Su enlace dejará de funcionar y se borrará su confirmación.')) return;
        event.currentTarget.disabled = true;
        try {
          await CamilaPases.rpc('eliminar',{p_folio:p.folio,p_token:p.token});
          if (edit?.folio === p.folio) {edit = null; id('onePass').hidden = true;}
          await refresh(); notice('tableStatus','Pase eliminado.');
        } catch (err) {notice('tableStatus',err.message,true); event.target.disabled = false;}
      }));
      body.append(tr);
    }
  }
  async function enter() {
    await refresh();
    id('loginBox').hidden = true; id('panel').hidden = false; id('logout').hidden = false;
  }
  async function start() {
    try {
      const auth = CamilaPases.client().auth;
      auth.onAuthStateChange(event => { if (event === 'SIGNED_OUT' && !signingOut) reset(); });
      const {data,error} = await auth.getSession();
      if (error) throw error;
      if (data.session) await enter();
    } catch (e) {notice('loginStatus',e.message,true);}
  }
  id('loginForm').addEventListener('submit',async e => {
    e.preventDefault(); const button = e.submitter || e.target.querySelector('button'); button.disabled = true;
    notice('loginStatus','Entrando…');
    try {
      const username = id('username').value.trim().toLowerCase();
      if (!/^[a-z0-9][a-z0-9._-]{0,49}$/.test(username)) {
        throw new Error('Escribe un usuario de hasta 50 caracteres con letras, números, puntos, guiones o guiones bajos.');
      }
      const {error} = await CamilaPases.client().auth.signInWithPassword({
        email:username + '@xv-camila.example',
        password:id('password').value
      });
      if (error) throw new Error(error.code === 'invalid_credentials' ? 'Revisa tu usuario y contraseña.' : error.message);
      id('password').value = ''; await enter(); notice('loginStatus');
    } catch (err) {notice('loginStatus',err.message,true);}
    finally {button.disabled = false;}
  });
  id('logout').addEventListener('click',async () => {
    signingOut = true; sessionVersion++; id('logout').disabled = true;
    notice('tableStatus','Cerrando sesión…');
    try {const {error} = await CamilaPases.client().auth.signOut({scope:'local'}); if (error) throw error; reset();}
    catch(e) {
      reset();
      notice('loginStatus','Se cerró el acceso en este navegador, pero no se pudo confirmar el cierre en el servidor. ' + e.message,true);
    }
    finally {signingOut = false; id('logout').disabled = false;}
  });
  function checkAgainstSaved(entry) {
    const previous = passes.get(entry.folio);
    if (entry.token && entry.token !== previous?.token) throw new Error('Fila ' + entry.fila + ' · El enlace y el folio no corresponden al mismo pase.');
    if (previous && entry.boletos < previous.confirmados) throw new Error('Fila ' + entry.fila + ' · ' + previous.nombre + ' ya confirmó ' + previous.confirmados + ' lugares.');
    if (!previous) return 'Crear';
    if (entry.nombre === previous.nombre && entry.boletos === previous.boletos && (entry.mesa === null || entry.mesa === previous.mesa)) return 'Conservar';
    return 'Actualizar';
  }
  id('archivo').addEventListener('change',async event => {
    const version = ++fileVersion, file = event.target.files[0];
    imported = null; id('preview').hidden = true; id('lastDownload').hidden = true; notice('fileStatus');
    if (!file) return;
    try {
      if (!/\.xlsx$/i.test(file.name)) throw new Error('Guarda el archivo en formato .xlsx.');
      if (file.size > 15*1024*1024) throw new Error('El archivo supera 15 MB. Usa una copia de la lista sin imágenes pesadas.');
      notice('fileStatus','Leyendo ' + file.name + '…');
      const result = await CamilaExcel.readList(await file.arrayBuffer());
      if (version !== fileVersion) return;
      const counts = {Crear:0,Actualizar:0,Conservar:0}, rows = document.createDocumentFragment();
      let total = 0;
      for (const [i,entry] of result.entries.entries()) {
        const op = checkAgainstSaved(entry); counts[op]++; total += entry.boletos;
        if (i < 12) {const tr = document.createElement('tr'); [entry.fila,entry.nombre,entry.boletos,op].forEach(value => cell(tr,value)); rows.append(tr);}
      }
      imported = {...result,filename:file.name.replace(/\.xlsx$/i,'')};
      id('sample').replaceChildren(rows);
      id('previewSummary').textContent = result.entries.length + ' familias · ' + total + ' boletos. Nuevos: ' + counts.Crear + '. Por actualizar: ' + counts.Actualizar + '. Sin cambios: ' + counts.Conservar + '.';
      id('partial').textContent = result.entries.length > 12 ? 'Se muestran las primeras 12 filas.' : '';
      id('preview').hidden = false; notice('fileStatus', 'Hoja seleccionada: ' + result.book.sheetName + '.');
    } catch (err) {if (version === fileVersion) notice('fileStatus',err.message,true);}
  });
  id('confirmImport').addEventListener('click',async () => {
    if (!imported || saving) return;
    const batch = imported;
    saving = true; id('archivo').disabled = true; id('confirmImport').disabled = true; id('logout').disabled = true;
    let committed = false;
    try {
      notice('fileStatus','Guardando los pases…');
      const result = await CamilaPases.rpc('importar',{filas:batch.entries});
      committed = true;
      const blob = await CamilaExcel.exportList(batch,result);
      download(blob,batch.filename + '_con_enlaces.xlsx',true);
      id('preview').hidden = true; imported = null; id('archivo').value = '';
      notice('fileStatus','Se guardaron ' + result.length + ' pases. Tu Excel incluye un enlace por familia.');
    } catch (err) {
      notice('fileStatus',(committed ? 'Los pases se guardaron. Puedes volver a descargar la lista o repetir la importación. ' : '') + err.message,true);
    } finally {
      saving = false; id('archivo').disabled = false; id('confirmImport').disabled = false; id('logout').disabled = false;
      if (committed) {try {await refresh();} catch(err) {notice('tableStatus',err.message,true);}}
    }
  });
  id('refresh').addEventListener('click',async () => {
    try {await refresh(); notice('tableStatus','Lista actualizada.');} catch(e) {notice('tableStatus',e.message,true);}
  });
  id('newPass').addEventListener('click',() => editForm(null));
  id('cancelEdit').addEventListener('click',() => {id('onePass').hidden = true; edit = null;});
  id('onePass').addEventListener('submit',async e => {
    e.preventDefault(); const button = e.target.querySelector('button[type="submit"]'); button.disabled = true;
    try {
      const row = await CamilaExcel.checkRow({nombre:id('oneName').value,boletos:id('oneCount').value,mesa:id('oneTable').value,folio:id('oneFolio').value},1);
      if (!edit && passes.has(row.folio)) throw new Error('Ese pase ya existe. Usa Editar o asigna otro folio para una familia distinta.');
      row.token = edit?.token || null;
      await CamilaPases.rpc('importar',{filas:[row]});
      id('onePass').hidden = true; edit = null; await refresh(); notice('tableStatus','Pase guardado para ' + row.nombre + '.');
    } catch(err) {notice('tableStatus',err.message,true);}
    finally {button.disabled = false;}
  });
  id('downloadAll').addEventListener('click',async () => {
    id('downloadAll').disabled = true;
    try {
      await refresh(); id('downloadAll').disabled = true;
      download(await CamilaExcel.exportAll([...passes.values()]),'Invitados_Camila_con_enlaces.xlsx');
      notice('tableStatus','Excel descargado con los pases y las confirmaciones.');
    } catch(e) {notice('tableStatus',e.message,true);}
    finally {id('downloadAll').disabled = !passes.size;}
  });
  start();
})();
