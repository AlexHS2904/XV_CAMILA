
(function() {
  // Initial Guest & Ticket Database
  const defaultGuests = [
    {
      code: 'FAM-GARCIA',
      name: 'Familia García López',
      assignedTickets: 4,
      table: 'Mesa 1',
      status: 'pending',
      confirmedTickets: 0,
      attendees: ['Sr. Carlos García', 'Sra. Elena López', 'Diego García', 'Valeria García'],
      phone: '',
      song: '',
      message: ''
    },
    {
      code: 'FAM-MARTINEZ',
      name: 'Tíos Martínez Soto',
      assignedTickets: 3,
      table: 'Mesa 2',
      status: 'pending',
      confirmedTickets: 0,
      attendees: ['Tío Jorge Martínez', 'Tía Laura Soto', 'Mateo Martínez'],
      phone: '',
      song: '',
      message: ''
    },
    {
      code: 'INV-SOFIA',
      name: 'Sofía Hernández y Acompañante',
      assignedTickets: 2,
      table: 'Mesa Jóvenes 1',
      status: 'pending',
      confirmedTickets: 0,
      attendees: ['Sofía Hernández', 'Acompañante'],
      phone: '',
      song: '',
      message: ''
    },
    {
      code: 'FAM-RAMIREZ',
      name: 'Familia Ramírez Castillo (Padrinos)',
      assignedTickets: 5,
      table: 'Mesa de Honor',
      status: 'attending',
      confirmedTickets: 5,
      attendees: ['Roberto Ramírez', 'Lucía Castillo', 'Sebastián Ramírez', 'Emilia Ramírez', 'Abuelita Carmen'],
      phone: '222 456 7890',
      song: 'Tiempo de Vals - Chayanne',
      message: '¡Con todo nuestro cariño para nuestra ahijada Camila!'
    },
    {
      code: 'INV-CARLOS',
      name: 'Carlos Eduardo Mendoza (Pase Individual)',
      assignedTickets: 1,
      table: 'Mesa Jóvenes 2',
      status: 'pending',
      confirmedTickets: 0,
      attendees: ['Carlos Eduardo Mendoza'],
      phone: '',
      song: '',
      message: ''
    }
  ];

  let guests = [];
  let currentGuestCode = 'FAM-GARCIA';
  let targetEventDate = new Date('2027-02-20T13:00:00-06:00');

  function loadState() {
    try {
      const saved = localStorage.getItem('xv_camila_guests_v1');
      if (saved) {
        guests = JSON.parse(saved);
      } else {
        guests = JSON.parse(JSON.stringify(defaultGuests));
      }
    } catch (e) {
      guests = JSON.parse(JSON.stringify(defaultGuests));
    }
  }

  function saveState() {
    try {
      localStorage.setItem('xv_camila_guests_v1', JSON.stringify(guests));
    } catch (e) {
      // Ignore storage error in restricted iframe
    }
  }

  function showToast(msg) {
    const toast = document.getElementById('toastNotification');
    const label = document.getElementById('toastMessage');
    if (!toast || !label) return;
    label.textContent = msg;
    toast.classList.remove('hidden');
    if (window._toastTimer) clearTimeout(window._toastTimer);
    window._toastTimer = setTimeout(function() {
      toast.classList.add('hidden');
    }, 3800);
  }

  function copyText(text, successMsg) {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(function() {
          showToast(successMsg);
        }).catch(function() {
          fallbackCopy(text, successMsg);
        });
      } else {
        fallbackCopy(text, successMsg);
      }
    } catch (e) {
      fallbackCopy(text, successMsg);
    }
  }

  function fallbackCopy(text, successMsg) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand('copy');
      showToast(successMsg);
    } catch (e) {
      showToast('Copiado: ' + text);
    }
    document.body.removeChild(ta);
  }

  // Countdown Timer to February 20, 2027
  function updateCountdown() {
    const now = new Date();
    const diff = targetEventDate.getTime() - now.getTime();
    const elDays = document.getElementById('cdDays');
    const elHours = document.getElementById('cdHours');
    const elMinutes = document.getElementById('cdMinutes');
    const elSeconds = document.getElementById('cdSeconds');
    if (!elDays) return;

    if (diff <= 0) {
      elDays.textContent = '00';
      elHours.textContent = '00';
      elMinutes.textContent = '00';
      elSeconds.textContent = '00';
      return;
    }
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
    const mins = Math.floor((diff / 1000 / 60) % 60);
    const secs = Math.floor((diff / 1000) % 60);

    elDays.textContent = String(days).padStart(2, '0');
    elHours.textContent = String(hours).padStart(2, '0');
    elMinutes.textContent = String(mins).padStart(2, '0');
    elSeconds.textContent = String(secs).padStart(2, '0');
  }

  // Render Guest Dropdown, Ticket Stub, RSVP Form, and Admin Table
  function renderAllGuestViews() {
    const guest = guests.find(function(g) { return g.code === currentGuestCode; }) || guests[0];
    if (!guest) return;
    currentGuestCode = guest.code;

    document.getElementById('summaryGuest').textContent = guest.name;
    document.getElementById('summaryCount').textContent = guest.assignedTickets;
    try { localStorage.setItem('xv_camila_current', currentGuestCode); } catch(e) {}

    // 1. Top Banner
    document.getElementById('bannerGuestName').textContent = guest.name;
    document.getElementById('bannerTicketBadge').textContent = guest.assignedTickets + (guest.assignedTickets === 1 ? ' boleto asignado' : ' boletos asignados');

    // 2. Dropdown Selector
    const select = document.getElementById('guestSelectDropdown');
    select.innerHTML = '';
    guests.forEach(function(g) {
      const opt = document.createElement('option');
      opt.value = g.code;
      opt.textContent = g.name + ' (' + g.assignedTickets + (g.assignedTickets === 1 ? ' boleto' : ' boletos') + ')';
      if (g.code === guest.code) opt.selected = true;
      select.appendChild(opt);
    });

    // 3. Ticket Stub Details
    document.getElementById('ticketCodeBadge').textContent = 'Código: ' + guest.code;
    document.getElementById('ticketTableBadge').textContent = guest.table || 'Mesa Asignada';
    document.getElementById('ticketGuestTitle').textContent = guest.name;
    document.getElementById('ticketAssignedText').innerHTML =
      'Hemos reservado <strong class="text-royal-900 underline">' +
      guest.assignedTickets +
      (guest.assignedTickets === 1 ? ' boleto' : ' boletos') +
      '</strong> especialmente para ti / tu familia.';
    document.getElementById('ticketCountBig').textContent = String(guest.assignedTickets);
    document.getElementById('ticketCountLabel').textContent = guest.assignedTickets === 1 ? 'Boleto' : 'Boletos';

    const statusBadge = document.getElementById('ticketStatusBadge');
    if (guest.status === 'attending') {
      statusBadge.textContent = ' Confirmado (' + guest.confirmedTickets + ' de ' + guest.assignedTickets + ' boletos)';
      statusBadge.className = 'text-xs font-semibold text-emerald-800 bg-emerald-100 border border-emerald-300 rounded-full px-3 py-1 inline-block';
    } else if (guest.status === 'declined') {
      statusBadge.textContent = 'No podrá asistir';
      statusBadge.className = 'text-xs font-semibold text-rose-800 bg-rose-100 border border-rose-300 rounded-full px-3 py-1 inline-block';
    } else {
      statusBadge.textContent = 'Pendiente de confirmar';
      statusBadge.className = 'text-xs font-medium text-amber-800 bg-amber-50 border border-amber-200 rounded-full px-3 py-1 inline-block';
    }

    // Visual Ticket Stubs
    const stubsContainer = document.getElementById('visualTicketsContainer');
    stubsContainer.innerHTML = '';
    for (let i = 1; i <= guest.assignedTickets; i++) {
      const stub = document.createElement('span');
      stub.className = 'inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-white border border-royal-200 text-xs text-royal-800 shadow-sm';
      const personName = (guest.attendees && guest.attendees[i - 1]) ? guest.attendees[i - 1] : ('Boleto #' + i);
      stub.innerHTML = ' <strong>Boleto ' + i + ':</strong> <span>' + personName + '</span>';
      stubsContainer.appendChild(stub);
    }

    // 4. RSVP Seat Selector (Strictly 1 .. guest.assignedTickets)
    document.getElementById('labelMaxTickets').textContent = String(guest.assignedTickets);
    const seatsSelect = document.getElementById('rsvpSeatsSelect');
    seatsSelect.innerHTML = '';
    const selectedSeats = guest.confirmedTickets > 0 ? guest.confirmedTickets : guest.assignedTickets;
    for (let i = 1; i <= guest.assignedTickets; i++) {
      const opt = document.createElement('option');
      opt.value = String(i);
      opt.textContent = i + (i === 1 ? ' boleto (1 persona)' : ' boletos (' + i + ' personas)');
      if (i === selectedSeats) opt.selected = true;
      seatsSelect.appendChild(opt);
    }

    // Set Radio status
    const radios = document.querySelectorAll('input[name="rsvpStatus"]');
    radios.forEach(function(r) {
      r.checked = (guest.status === 'declined' ? r.value === 'declined' : r.value === 'attending');
    });

    document.getElementById('rsvpPhone').value = guest.phone || '';
    document.getElementById('rsvpSong').value = guest.song || '';
    document.getElementById('rsvpMessage').value = guest.message || '';

    renderAttendeeInputs(guest, selectedSeats);
    toggleRsvpAttendanceFields();
    renderAdminTable();
  }

  function renderAttendeeInputs(guest, count) {
    const grid = document.getElementById('attendeeInputsGrid');
    grid.innerHTML = '';
    for (let i = 0; i < count; i++) {
      const wrapper = document.createElement('div');
      const defaultVal = (guest.attendees && guest.attendees[i]) ? guest.attendees[i] : '';
      wrapper.innerHTML =
        '<label class="block text-[11px] font-medium text-royal-600 mb-1"> Boleto ' + (i + 1) + ' de ' + guest.assignedTickets + '</label>' +
        '<input type="text" data-attendee-index="' + i + '" value="' + defaultVal.replace(/"/g, '&quot;') + '" placeholder="Nombre completo del asistente ' + (i + 1) + '" required class="attendee-name-input w-full px-3.5 py-2 rounded-xl border border-royal-300 bg-white text-xs sm:text-sm text-royal-900 focus:outline-none focus:ring-2 focus:ring-royal-500" />';
      grid.appendChild(wrapper);
    }
  }

  function toggleRsvpAttendanceFields() {
    const checkedRadio = document.querySelector('input[name="rsvpStatus"]:checked');
    const isAttending = !checkedRadio || checkedRadio.value === 'attending';
    const seatWrapper = document.getElementById('rsvpSeatCountWrapper');
    const namesWrapper = document.getElementById('attendeeNamesContainer');
    namesWrapper.querySelectorAll('input').forEach(input => { input.disabled = !isAttending; });
    if (isAttending) {
      seatWrapper.classList.remove('opacity-40', 'pointer-events-none');
      namesWrapper.classList.remove('hidden');
    } else {
      seatWrapper.classList.add('opacity-40', 'pointer-events-none');
      namesWrapper.classList.add('hidden');
    }
  }

  function renderAdminTable() {
    const tbody = document.getElementById('guestAdminTableBody');
    tbody.innerHTML = '';

    let totalTickets = 0;
    let confirmedTickets = 0;
    let pendingTickets = 0;

    guests.forEach(function(g) {
      totalTickets += g.assignedTickets;
      if (g.status === 'attending') {
        confirmedTickets += g.confirmedTickets;
      } else if (g.status === 'pending') {
        pendingTickets += g.assignedTickets;
      }

      const tr = document.createElement('tr');
      tr.className = (g.code === currentGuestCode) ? 'bg-royal-50/70' : 'hover:bg-cream-50';

      let statusHtml = '<span class="px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200 text-[11px]">Pendiente</span>';
      if (g.status === 'attending') {
        statusHtml = '<span class="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 text-[11px] font-semibold">Confirmado (' + g.confirmedTickets + '/' + g.assignedTickets + ')</span>';
      } else if (g.status === 'declined') {
        statusHtml = '<span class="px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-800 border border-rose-300 text-[11px]">No asiste</span>';
      }

      tr.innerHTML =
        '<td class="py-3 px-4 font-mono text-xs text-royal-600">' + g.code + '</td>' +
        '<td class="py-3 px-4 font-medium text-royal-900">' + g.name + '</td>' +
        '<td class="py-3 px-4 text-center">' +
          '<div class="inline-flex items-center gap-1.5 bg-white border border-royal-200 rounded-lg px-2 py-0.5">' +
            '<button type="button" data-action="dec-ticket" data-code="' + g.code + '" class="text-royal-600 hover:text-royal-900 font-bold px-1" title="Reducir boletos">−</button>' +
            '<span class="font-semibold text-royal-800 min-w-[1.5rem] text-center">' + g.assignedTickets + '</span>' +
            '<button type="button" data-action="inc-ticket" data-code="' + g.code + '" class="text-royal-600 hover:text-royal-900 font-bold px-1" title="Aumentar boletos">+</button>' +
          '</div>' +
        '</td>' +
        '<td class="py-3 px-4 text-center text-royal-600">' + (g.table || '-') + '</td>' +
        '<td class="py-3 px-4 text-center">' + statusHtml + '</td>' +
        '<td class="py-3 px-4 text-right space-x-1">' +
          '<button type="button" data-action="select-guest" data-code="' + g.code + '" class="px-2.5 py-1 rounded-lg bg-royal-600 hover:bg-royal-700 text-white text-[11px] font-medium transition">Ver pase</button>' +
        '</td>';
      tbody.appendChild(tr);
    });

    document.getElementById('statTotalPasses').textContent = String(guests.length);
    document.getElementById('statTotalTickets').textContent = String(totalTickets);
    document.getElementById('statConfirmedTickets').textContent = String(confirmedTickets);
    document.getElementById('statPendingTickets').textContent = String(pendingTickets);
  }

  // Reproductor de audio local.
  // El navegador exige una interacción del visitante para comenzar.
  const bgMusic = document.getElementById('bgMusic');
  const musicButton = document.getElementById('btnHeroMusic');
  const musicWaves = document.getElementById('musicWaves');
  const musicLabel = document.getElementById('musicLabel');

  function syncMusicButton() {
    const playing = Boolean(bgMusic && !bgMusic.paused && !bgMusic.ended);
    if (musicWaves) musicWaves.classList.toggle('playing', playing);
    if (musicLabel) musicLabel.textContent = playing ? 'Pausar vals' : 'Escucha mi vals';
    if (musicButton) musicButton.setAttribute('aria-pressed', String(playing));
  }

  async function toggleMusic() {
    if (!bgMusic) return;
    if (!bgMusic.paused) {
      bgMusic.pause();
      return;
    }
    try {
      await bgMusic.play();
    } catch (error) {
      syncMusicButton();
      showToast('No se pudo reproducir el vals. Verifica assets/audio/vals.mp3.');
      console.warn('No se pudo reproducir vals.mp3:', error);
    }
  }

  if (bgMusic) {
    ['play', 'pause', 'ended'].forEach(function(type) {
      bgMusic.addEventListener(type, syncMusicButton);
    });
    bgMusic.addEventListener('error', function() {
      syncMusicButton();
      showToast('No se encontró el vals. Revisa assets/audio/vals.mp3.');
    });
  }

  // Initialize Event Listeners
  window.addEventListener('DOMContentLoaded', function() {
    loadState();
    try {
      currentGuestCode = new URLSearchParams(location.search).get('invitado') ||
        localStorage.getItem('xv_camila_current') || currentGuestCode;
    } catch(e) {}
    renderAllGuestViews();
    updateCountdown();
    setInterval(updateCountdown, 1000);

    // Music toggles
    document.getElementById('btnHeroMusic')?.addEventListener('click', toggleMusic);

    // Save Calendar (.ics download)
    document.getElementById('btnSaveCalendar')?.addEventListener('click', function() {
      const quinceName = document.getElementById('heroQuinceName').textContent || 'Camila';
      const church = document.getElementById('churchNameDisplay').textContent;
      const venue = document.getElementById('venueNameDisplay').textContent;
      const icsContent = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'BEGIN:VEVENT',
        'DTSTART:20270220T190000Z',
        'DTEND:20270221T050000Z',
        'SUMMARY:Mis XV Años - ' + quinceName,
        'DESCRIPTION:Ceremonia en ' + church + ' y recepción en el Salón Bellagio, ' + venue,
        'LOCATION:' + venue + ', ' + document.getElementById('venueAddressDisplay').textContent.trim(),
        'END:VEVENT',
        'END:VCALENDAR'
      ].join('\r\n');
      const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'XV_Anos_' + quinceName + '_20_Febrero_2027.ics';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      showToast(' Evento descargado para tu calendario (20 de Febrero de 2027)');
    });

    // Hero Photo Upload
    document.getElementById('inputHeroPhotoUpload')?.addEventListener('change', function(e) {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = function(ev) {
        document.getElementById('heroMainImg').src = ev.target.result;
        showToast(' Foto principal de la quinceañera actualizada');
      };
      reader.readAsDataURL(file);
    });

    // Gallery Category Filters
    document.querySelectorAll('.gallery-filter-btn').forEach(function(btn) {
      btn.addEventListener('click', function() {
        const filter = btn.getAttribute('data-filter');
        document.querySelectorAll('.gallery-filter-btn').forEach(function(b) {
          b.className = 'gallery-filter-btn px-3.5 py-1.5 rounded-full text-xs font-medium bg-white text-royal-700 border border-royal-200 hover:bg-royal-50 transition';
        });
        btn.className = 'gallery-filter-btn px-3.5 py-1.5 rounded-full text-xs font-medium bg-royal-600 text-white transition';

        document.querySelectorAll('#galleryGrid .gallery-item').forEach(function(item) {
          if (filter === 'all' || item.getAttribute('data-category') === filter) {
            item.classList.remove('hidden');
          } else {
            item.classList.add('hidden');
          }
        });
      });
    });

    // Visor inmersivo de fotos: imagen sin marco, tarjeta ni descripción visible.
    const lightbox = document.getElementById('lightboxModal');
    const lightboxImg = document.getElementById('lightboxImg');
    const lightboxCaption = document.getElementById('lightboxCaption');
    const closeLightboxButton = document.getElementById('btnCloseLightbox');
    let previousFocus = null;

    function openLightbox(trigger) {
      if (!lightbox || !lightboxImg || !trigger) return;
      const src = trigger.currentSrc || trigger.getAttribute('src');
      if (!src || src.includes('pendientes/')) return;
      const caption = trigger.getAttribute('data-caption') || trigger.getAttribute('alt') || 'Fotografía de Camila';
      previousFocus = document.activeElement;
      lightboxImg.src = src;
      lightboxImg.alt = caption;
      if (lightboxCaption) lightboxCaption.textContent = caption;
      lightbox.classList.remove('hidden');
      document.body.classList.add('modal-open');
      closeLightboxButton?.focus({ preventScroll: true });
    }

    function closeLightbox() {
      if (!lightbox || lightbox.classList.contains('hidden')) return;
      lightbox.classList.add('hidden');
      document.body.classList.remove('modal-open');
      if (previousFocus && typeof previousFocus.focus === 'function') {
        previousFocus.focus({ preventScroll: true });
      }
      previousFocus = null;
    }

    document.body.addEventListener('click', function(e) {
      const trigger = e.target.closest('.lightbox-trigger');
      if (trigger) openLightbox(trigger);
    });
    document.body.addEventListener('keydown', function(e) {
      if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('.lightbox-trigger[role="button"]')) {
        e.preventDefault();
        openLightbox(e.target);
      }
    });
    closeLightboxButton?.addEventListener('click', closeLightbox);
    lightbox?.addEventListener('click', function(e) {
      if (e.target === lightbox) closeLightbox();
    });
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape') closeLightbox();
    });

    // Copy Church & Venue Addresses
    document.getElementById('btnCopyVenueAddress')?.addEventListener('click', function() {
      const addr = document.getElementById('venueAddressDisplay').textContent.trim();
      copyText(addr, ' Dirección copiada al portapapeles');
    });

    // Admin / Customizer Modal
    function openAdminModal() {
      document.getElementById('adminModal').classList.remove('hidden');
    }
    document.getElementById('btnOpenAdminModal')?.addEventListener('click', openAdminModal);
    document.getElementById('btnAddGuestRow')?.addEventListener('click', openAdminModal);
    document.getElementById('btnCloseAdminModal')?.addEventListener('click', function() {
      document.getElementById('adminModal').classList.add('hidden');
    });

    // Guest Select Dropdown
    document.getElementById('guestSelectDropdown')?.addEventListener('change', function(e) {
      currentGuestCode = e.target.value;
      renderAllGuestViews();
      showToast(' Mostrando pase y boletos de: ' + e.target.options[e.target.selectedIndex].text);
    });

    // Guest Search Input
    document.getElementById('btnSearchGuest')?.addEventListener('click', function() {
      const q = document.getElementById('guestSearchInput').value.trim().toLowerCase();
      if (!q) {
        showToast('Escribe tu nombre, apellido o código para buscar tu pase.');
        return;
      }
      const found = guests.find(function(g) {
        return g.name.toLowerCase().includes(q) || g.code.toLowerCase().includes(q);
      });
      if (found) {
        currentGuestCode = found.code;
        renderAllGuestViews();
        showToast(' Pase encontrado: ' + found.name + ' (' + found.assignedTickets + ' boletos)');
      } else {
        showToast('No encontramos ese nombre exacto. Puedes seleccionarlo en la lista o agregarlo en Personalizar.');
      }
    });

    // RSVP Attendance Radio Change
    document.querySelectorAll('input[name="rsvpStatus"]').forEach(function(radio) {
      radio.addEventListener('change', toggleRsvpAttendanceFields);
    });

    // RSVP Number of Tickets Change
    document.getElementById('rsvpSeatsSelect')?.addEventListener('change', function(e) {
      const guest = guests.find(function(g) { return g.code === currentGuestCode; }) || guests[0];
      const count = parseInt(e.target.value, 10) || 1;
      renderAttendeeInputs(guest, count);
    });

    // RSVP Form Submit
    document.getElementById('rsvpForm')?.addEventListener('submit', function(e) {
      e.preventDefault();
      const guest = guests.find(function(g) { return g.code === currentGuestCode; });
      if (!guest) return;

      const checkedRadio = document.querySelector('input[name="rsvpStatus"]:checked');
      const status = checkedRadio ? checkedRadio.value : 'attending';
      guest.status = status;

      if (status === 'attending') {
        const seats = parseInt(document.getElementById('rsvpSeatsSelect').value, 10) || guest.assignedTickets;
        guest.confirmedTickets = Math.min(seats, guest.assignedTickets);
        const nameInputs = document.querySelectorAll('.attendee-name-input');
        const names = [];
        nameInputs.forEach(function(inp) {
          if (inp.value.trim()) names.push(inp.value.trim());
        });
        if (names.length > 0) guest.attendees = names;
      } else {
        guest.confirmedTickets = 0;
      }

      guest.phone = document.getElementById('rsvpPhone').value.trim();
      guest.song = document.getElementById('rsvpSong').value.trim();
      guest.message = document.getElementById('rsvpMessage').value.trim();

      saveState();
      renderAllGuestViews();

      if (status === 'attending') {
        showToast('Respuesta guardada en este navegador para ' + guest.name + ' (' + guest.confirmedTickets + ' boletos)!');
      } else {
        showToast('Respuesta guardada en este navegador. ¡Gracias por avisarnos!');
      }
    });

    // Admin Table Actions (Increment/Decrement Tickets or Switch Guest View)
    document.getElementById('guestAdminTableBody')?.addEventListener('click', function(e) {
      const btn = e.target.closest('button[data-action]');
      if (!btn) return;
      const action = btn.getAttribute('data-action');
      const code = btn.getAttribute('data-code');
      const guest = guests.find(function(g) { return g.code === code; });
      if (!guest) return;

      if (action === 'inc-ticket') {
        guest.assignedTickets = Math.min(15, guest.assignedTickets + 1);
        saveState();
        renderAllGuestViews();
        showToast('Boletos de ' + guest.name + ' actualizados a ' + guest.assignedTickets);
      } else if (action === 'dec-ticket') {
        guest.assignedTickets = Math.max(1, guest.assignedTickets - 1);
        if (guest.confirmedTickets > guest.assignedTickets) {
          guest.confirmedTickets = guest.assignedTickets;
        }
        saveState();
        renderAllGuestViews();
        showToast('Boletos de ' + guest.name + ' actualizados a ' + guest.assignedTickets);
      } else if (action === 'select-guest') {
        currentGuestCode = guest.code;
        renderAllGuestViews();
        location.hash = 'boletos-rsvp';
        showToast('Mostrando invitación personalizada para ' + guest.name);
      }
    });

    // Customize Event Form Submit
    document.getElementById('customEventForm')?.addEventListener('submit', function(e) {
      e.preventDefault();
      const qName = document.getElementById('inputQuinceName').value.trim() || 'Camila';
      const father = document.getElementById('inputFatherName').value.trim();
      const mother = document.getElementById('inputMotherName').value.trim();
      const godfather = document.getElementById('inputGodfatherName').value.trim();
      const godmother = document.getElementById('inputGodmotherName').value.trim();
      const churchName = document.getElementById('inputChurchName').value.trim();
      const venueName = document.getElementById('inputVenueName').value.trim();
      const venueAddr = document.getElementById('inputVenueAddress').value.trim();
      const dateVal = document.getElementById('inputEventDate').value;

      document.getElementById('heroQuinceName').textContent = qName;
      document.getElementById('displayFatherName').textContent = father;
      document.getElementById('displayMotherName').textContent = mother;
      document.getElementById('displayGodfatherName').textContent = godfather;
      document.getElementById('displayGodmotherName').textContent = godmother;

      document.getElementById('churchNameDisplay').textContent = churchName;
      document.getElementById('churchAddressDisplay').textContent = venueAddr;
      document.getElementById('venueNameDisplay').textContent = venueName;
      document.getElementById('venueAddressDisplay').textContent = venueAddr;

      // Mantener el enlace exacto compartido mientras se conserve esta ubicación.
      // Al personalizar la dirección, se genera un nuevo enlace de búsqueda.
      const defaultVenueName = 'SEEM ESPECTÁCULOS';
      const defaultVenueAddress = 'Cam. Viejo a Capultitlan s/n, San Felipe Tlalmimilolpan, 50260 Toluca de Lerdo, Méx.';
      const mapsUrl = venueName === defaultVenueName && venueAddr === defaultVenueAddress
        ? 'https://maps.app.goo.gl/5PFnmmpCfRpmnmj1A'
        : 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(venueName + ' ' + venueAddr);
      document.getElementById('venueMapsLink').href = mapsUrl;

      if (dateVal) {
        const parsed = new Date(dateVal);
        if (!isNaN(parsed.getTime())) {
          targetEventDate = parsed;
          updateCountdown();
        }
      }

      document.getElementById('adminModal').classList.add('hidden');
      showToast(' Datos del evento y mapas de Google Maps actualizados');
    });

    // Add New Guest Form Submit
    document.getElementById('addGuestForm')?.addEventListener('submit', function(e) {
      e.preventDefault();
      const name = document.getElementById('newGuestName').value.trim();
      const tickets = parseInt(document.getElementById('newGuestTickets').value, 10) || 2;
      const table = document.getElementById('newGuestTable').value.trim() || 'Por asignar';
      if (!name) return;

      const slug = name.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6) || 'INV';
      const code = 'PASE-' + slug + '-' + Math.floor(10 + Math.random() * 89);

      const newGuest = {
        code: code,
        name: name,
        assignedTickets: Math.min(15, Math.max(1, tickets)),
        table: table,
        status: 'pending',
        confirmedTickets: 0,
        attendees: [name],
        phone: '',
        song: '',
        message: ''
      };
      guests.push(newGuest);
      currentGuestCode = newGuest.code;
      saveState();
      renderAllGuestViews();

      document.getElementById('newGuestName').value = '';
      document.getElementById('adminModal').classList.add('hidden');
      showToast(' Pase creado para ' + name + ' con ' + newGuest.assignedTickets + ' boletos');
    });

    // Export Guest List to CSV
    document.getElementById('btnExportCsv')?.addEventListener('click', function() {
      const rows = [
        ['Codigo', 'Invitado_Familia', 'Boletos_Asignados', 'Boletos_Confirmados', 'Estado_RSVP', 'Mesa', 'Telefono', 'Cancion_Sugerida', 'Mensaje']
      ];
      guests.forEach(function(g) {
        rows.push([
          g.code,
          '"' + (g.name || '').replace(/"/g, '""') + '"',
          g.assignedTickets,
          g.confirmedTickets,
          g.status,
          '"' + (g.table || '').replace(/"/g, '""') + '"',
          '"' + (g.phone || '').replace(/"/g, '""') + '"',
          '"' + (g.song || '').replace(/"/g, '""') + '"',
          '"' + (g.message || '').replace(/"/g, '""') + '"'
        ]);
      });
      const csv = rows.map(function(r) { return r.join(','); }).join('\r\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'Lista_Invitados_Boletos_XV_Camila.csv';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      showToast(' Lista de invitados y boletos descargada en CSV');
    });
  });
})();
