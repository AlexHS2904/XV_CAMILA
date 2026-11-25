
(function() {
  let targetEventDate = new Date('2027-02-20T13:00:00-06:00');

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
        const hero = document.getElementById('heroMainImg');
        hero.removeAttribute('srcset');
        hero.src = ev.target.result;
        showToast(' Foto principal de la quinceañera actualizada');
      };
      reader.readAsDataURL(file);
    });

    // Visor inmersivo de fotos: imagen sin marco, tarjeta ni descripción visible.
    const lightbox = document.getElementById('lightboxModal');
    const lightboxImg = document.getElementById('lightboxImg');
    const lightboxCaption = document.getElementById('lightboxCaption');
    const closeLightboxButton = document.getElementById('btnCloseLightbox');
    let previousFocus = null;

    function openLightbox(trigger) {
      if (!lightbox || !lightboxImg || !trigger) return;
      const photo = trigger.matches('img') ? trigger : trigger.querySelector('img');
      if (!photo) return;
      const caption = photo.dataset.caption || photo.alt || 'Fotografía de Camila';
      previousFocus = trigger;
      lightboxImg.src = photo.currentSrc || photo.src;
      if (photo.dataset.full) {
        const full = new Image();
        full.decoding = 'async';
        full.onload = function() {
          if (previousFocus === trigger) lightboxImg.src = full.src;
        };
        full.src = photo.dataset.full;
      }
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
      if (e.key === 'Tab' && lightbox && !lightbox.classList.contains('hidden')) {
        e.preventDefault();
        closeLightboxButton?.focus({ preventScroll: true });
      }
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
    if (new URLSearchParams(location.search).get('vista') === 'ajustes') {
      CamilaPases.rpc('listar').then(openAdminModal).catch(() => showToast('Inicia sesión en el panel de invitados.'));
    }
    document.getElementById('btnCloseAdminModal')?.addEventListener('click', function() {
      document.getElementById('adminModal').classList.add('hidden');
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

  });
})();
