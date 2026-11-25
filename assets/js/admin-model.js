// Reglas compartidas por el panel y sus pruebas. Sin acceso a datos ni al DOM.
(function (root) {
  const normalize = value => String(value ?? '').normalize('NFD').replace(/\p{M}/gu,'').trim().toLocaleLowerCase('es');
  function state(p) {
    return p.estado === 'asiste' ? (p.confirmados < p.boletos ? 'parcial' : 'confirmado') : p.estado === 'no_asiste' ? 'rechazado' : 'pendiente';
  }
  const labels = {parcial:'Confirmación parcial',confirmado:'Confirmado',rechazado:'No asiste',pendiente:'Pendiente'};
  function stats(passes) {
    const s={invitaciones:passes.length,asignados:0,confirmados:0,pendientes:0,noUtilizados:0,respondidas:0,familiasPendientes:0,noAsisten:0};
    for (const p of passes) {
      s.asignados+=p.boletos; s.confirmados+=p.confirmados;
      if (p.estado==='pendiente') {s.pendientes+=p.boletos;s.familiasPendientes++;}
      else {s.respondidas++;s.noUtilizados+=p.boletos-p.confirmados;}
      if (p.estado==='no_asiste') s.noAsisten++;
    }
    s.confirmacion=s.asignados ? s.confirmados/s.asignados*100 : 0;
    s.respuesta=s.invitaciones ? s.respondidas/s.invitaciones*100 : 0;
    return s;
  }
  function select(passes,{search='',filter='todos',sort='nombre',direction='asc'}={}) {
    const query=normalize(search);
    return passes.filter(p=>normalize(p.nombre).includes(query) && (filter==='todos' || (filter==='confirmados' ? p.estado==='asiste' : state(p)===filter)))
      .sort((a,b)=>{
        let comparison;
        if (sort==='boletos') comparison=a.boletos-b.boletos;
        else comparison=String(sort==='estado'?labels[state(a)]:a[sort] ?? '').localeCompare(String(sort==='estado'?labels[state(b)]:b[sort] ?? ''),'es',{numeric:true,sensitivity:'base'});
        return (comparison || a.nombre.localeCompare(b.nombre,'es') || a.folio.localeCompare(b.folio))*(direction==='desc'?-1:1);
      });
  }
  function plan(entries,passes,choices={}) {
    const byId=new Map(passes.map(p=>[p.folio,p]));
    const byToken=new Map(passes.map(p=>[p.token,p]));
    const used=new Set();
    return entries.map(entry=>{
      let row={...entry}, previous=byId.get(row.folio), conflict='';
      const choice=choices[row.fila];
      if (choice && !choice.startsWith('new:')) {
        previous=byId.get(choice);
        if (!previous) conflict='La invitación seleccionada ya no existe.';
        else {row.folio=previous.folio;row.token=previous.token;}
      } else if (choice?.startsWith('new:') && !row.explicitId && !row.token) {previous=undefined;row.folio=choice.slice(4);}
      else if (row.token) {
        const owner=byToken.get(row.token);
        if (!owner || (row.explicitId && owner.folio!==row.folio)) conflict='El enlace no corresponde a una invitación guardada. Usa una exportación vigente.';
        else {previous=owner;row.folio=owner.folio;}
      } else if (row.explicitId && !previous) conflict='Esta invitación ya no existe. No se recreará automáticamente.';
      const candidates=passes.filter(p=>normalize(p.nombre)===normalize(row.nombre));
      if (!previous && !conflict && !choice && !row.explicitId && candidates.length) conflict='Hay invitaciones con este nombre. Elige cuál actualizar o crea otra familia.';
      if (previous && previous.confirmados>row.boletos) conflict='Ya confirmó '+previous.confirmados+' boletos. No puedes asignar menos.';
      if (used.has(row.folio)) conflict='Dos filas apuntan a la misma invitación. Revisa el archivo.';
      used.add(row.folio);
      const operation=conflict?'Conflicto':!previous?'Nueva':previous.nombre===row.nombre && previous.boletos===row.boletos && (row.mesa===null || previous.mesa===row.mesa)?'Sin cambios':'Actualizar';
      return {row,previous,candidates,conflict,operation};
    });
  }
  const model={normalize,state,labels,stats,select,plan};
  if (typeof module!=='undefined' && module.exports) module.exports=model;
  else root.CamilaAdmin=model;
})(globalThis);
