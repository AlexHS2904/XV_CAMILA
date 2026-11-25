(() => {
  'use strict';
  const id = name => document.getElementById(name);
  const token = new URLSearchParams(location.search).get('invitado');
  let pass;
  const tickets = n => n === 1 ? '1 boleto' : n + ' boletos';
  function attendeeFields(count, names) {
    const grid = id('attendeeInputsGrid');
    grid.replaceChildren();
    for (let i = 0; i < count; i++) {
      const label = document.createElement('label');
      label.className = 'block text-xs text-royal-700';
      label.textContent = 'Asistente ' + (i + 1);
      const input = document.createElement('input');
      input.className = 'attendee-name-input w-full px-3.5 py-2 rounded-xl border border-royal-300 bg-white text-sm';
      input.value = names[i] || ''; input.maxLength = 160; input.required = true;
      label.append(input); grid.append(label);
    }
  }
  function attendanceFields() {
    const yes = document.querySelector('input[name="rsvpStatus"]:checked')?.value === 'attending';
    id('rsvpSeatCountWrapper').hidden = !yes;
    id('attendeeNamesContainer').hidden = !yes;
    id('rsvpSeatsSelect').disabled = !yes;
    id('attendeeInputsGrid').querySelectorAll('input').forEach(input => {input.disabled = !yes;});
  }
  function view() {
    const showingForm = Boolean(pass && location.hash === '#confirmar-asistencia');
    document.querySelectorAll('[data-invitation]').forEach(section => {section.hidden = showingForm;});
    id('confirmar-asistencia').hidden = !showingForm;
    if (showingForm) window.scrollTo(0,0);
    else if (location.hash === '#boletos-rsvp') id('boletos-rsvp').scrollIntoView();
  }
  function render() {
    id('heroPass').textContent = pass.nombre + ' · ' + tickets(pass.boletos);
    id('heroPass').hidden = false;
    id('summaryGuest').textContent = pass.nombre;
    id('summaryCount').textContent = pass.boletos;
    id('summaryLabel').textContent = pass.boletos === 1 ? 'boleto asignado' : 'boletos asignados';
    for (const name of ['summaryCount','summaryLabel','openRsvp']) id(name).hidden = false;
    id('ticketGuestTitle').textContent = pass.nombre;
    id('ticketTableBadge').textContent = pass.mesa;
    id('ticketTableBadge').hidden = !pass.mesa;
    id('ticketAssignedText').textContent = 'Hemos reservado ' + tickets(pass.boletos) + ' para esta invitación.';
    id('ticketCountBig').textContent = pass.boletos;
    id('ticketCountLabel').textContent = pass.boletos === 1 ? 'Boleto' : 'Boletos';
    id('ticketStatusBadge').textContent = {pendiente:'Pendiente de confirmar',no_asiste:'No asistirá',asiste:'Confirmados ' + pass.confirmados + ' de ' + pass.boletos}[pass.estado];
    id('visualTicketsContainer').replaceChildren();
    for (const [i,name] of pass.asistentes.entries()) {
      const label = document.createElement('span');
      label.className = 'px-3 py-1 rounded-xl bg-white border border-royal-200 text-xs text-royal-800';
      label.textContent = (i+1) + '. ' + name; id('visualTicketsContainer').append(label);
    }
    id('labelMaxTickets').textContent = pass.boletos;
    const seats = id('rsvpSeatsSelect'); seats.replaceChildren();
    for (let i=1; i<=pass.boletos; i++) seats.add(new Option(tickets(i),i));
    seats.value = pass.confirmados || pass.boletos;
    document.querySelector('input[name="rsvpStatus"][value="' + (pass.estado === 'no_asiste' ? 'declined' : 'attending') + '"]').checked = true;
    id('rsvpPhone').value = pass.telefono;
    id('rsvpSong').value = pass.cancion;
    id('rsvpMessage').value = pass.mensaje;
    attendeeFields(Number(seats.value),pass.asistentes);
    attendanceFields(); view();
  }
  async function loadPass() {
    id('retryPass').hidden = true;
    if (!token) {view(); return;}
    if (!CamilaPases.uuid.test(token)) {
      id('summaryGuest').textContent = 'Este enlace no es válido. Pídele a Camila tu enlace personal.'; view(); return;
    }
    id('summaryGuest').textContent = 'Cargando tu pase…';
    try {
      pass = await CamilaPases.rpc('ver',{p_token:token});
      if (!pass) {id('summaryGuest').textContent = 'No encontramos este pase. Pídele a Camila tu enlace personal.'; view(); return;}
      render();
    } catch {
      id('summaryGuest').textContent = 'No pudimos cargar tu pase. Revisa tu conexión e inténtalo de nuevo.';
      id('retryPass').hidden = false;
    }
  }
  id('retryPass').addEventListener('click', loadPass);
  window.addEventListener('hashchange',view);
  document.querySelectorAll('input[name="rsvpStatus"]').forEach(radio => radio.addEventListener('change',attendanceFields));
  id('rsvpSeatsSelect').addEventListener('change',e => {
    const current = Array.from(id('attendeeInputsGrid').querySelectorAll('input'),i => i.value);
    attendeeFields(Number(e.target.value),current);
  });
  id('rsvpForm').addEventListener('submit',async e => {
    e.preventDefault();
    if (!pass || id('saveRsvp').disabled) return;
    const yes = document.querySelector('input[name="rsvpStatus"]:checked').value === 'attending';
    const respuesta = {estado:yes ? 'asiste' : 'no_asiste', asistentes:yes ? Array.from(id('attendeeInputsGrid').querySelectorAll('input'),i => i.value.trim()) : [],
      telefono:id('rsvpPhone').value, cancion:id('rsvpSong').value, mensaje:id('rsvpMessage').value};
    id('saveRsvp').disabled = true; id('rsvpFeedback').textContent = 'Guardando tu respuesta…';
    try {
      pass = await CamilaPases.rpc('responder',{p_token:token,respuesta}); render();
      id('rsvpFeedback').textContent = yes ? 'Gracias. Quedaron confirmados ' + tickets(pass.confirmados) + '.' : 'Tu respuesta quedó guardada. Gracias por avisarnos.';
    } catch (err) {id('rsvpFeedback').textContent = err.message;}
    finally {id('saveRsvp').disabled = false;}
  });
  loadPass();
})();
