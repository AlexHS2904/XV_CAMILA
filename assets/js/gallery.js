
/* Fotos repetidas: se copian de la original para no cargarlas dos veces */
document.querySelectorAll('img[data-same-as]').forEach(function(img) {
  var src = document.getElementById(img.dataset.sameAs);
  if (src) img.src = src.getAttribute('src');
});

/* Carrusel de retratos (móvil) */
(function() {
  var track = document.getElementById('portraitTrack');
  var prev = document.getElementById('portraitPrev');
  var next = document.getElementById('portraitNext');
  var pos = document.getElementById('portraitPosition');

  if (!track || !prev || !next) return;

  var slides = Array.prototype.slice.call(track.children);
  var total = slides.length;

  function pad(n) {
    return (n < 10 ? '0' : '') + n;
  }

  function current() {
    var center = track.scrollLeft + track.clientWidth / 2;
    var best = 0;
    var dist = Infinity;

    slides.forEach(function(el, i) {
      var d = Math.abs(el.offsetLeft + el.offsetWidth / 2 - center);
      if (d < dist) {
        dist = d;
        best = i;
      }
    });

    return best;
  }

  function update() {
    var i = current();
    if (pos) pos.textContent = pad(i + 1) + ' / ' + pad(total);
    prev.disabled = i === 0;
    next.disabled = i === total - 1;
  }

  function go(i) {
    i = Math.max(0, Math.min(total - 1, i));
    var el = slides[i];

    track.scrollTo({
      left: el.offsetLeft - (track.clientWidth - el.offsetWidth) / 2,
      behavior: 'smooth'
    });
  }

  prev.addEventListener('click', function() {
    go(current() - 1);
  });

  next.addEventListener('click', function() {
    go(current() + 1);
  });

  var ticking = false;

  track.addEventListener('scroll', function() {
    if (ticking) return;
    ticking = true;

    requestAnimationFrame(function() {
      update();
      ticking = false;
    });
  }, { passive: true });

  window.addEventListener('resize', update);
  update();
})();

/* Galería de la sesión: la misma tira responde al avance automático y al gesto nativo. */
(function() {
  const track = document.getElementById('galleryTrack');
  if (!track) return;
  const photos = Array.from(track.children);
  const controls = track.parentElement.querySelector('.memory-controls');
  const previous = document.getElementById('galleryPrev');
  const next = document.getElementById('galleryNext');
  const playback = document.getElementById('galleryPlayback');
  const label = playback.querySelector('span');
  const lightbox = document.getElementById('lightboxModal');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const pixelsPerSecond = 23;
  const interactionDelay = 4200;
  let paused = reducedMotion.matches;
  let visible = !('IntersectionObserver' in window);
  let direction = 1;
  let frame = 0;
  let resumeTimer = 0;
  let manualScroll = false;
  let maxLeft = 0;
  let pointerId = null;
  let drag = null;
  let ignoreClick = false;

  function stopDrift() {
    cancelAnimationFrame(frame);
    frame = 0;
  }

  function waitToResume(delay, manual = false) {
    stopDrift();
    clearTimeout(resumeTimer);
    manualScroll = manual;
    resumeTimer = setTimeout(() => {
      resumeTimer = 0;
      manualScroll = false;
      syncDrift();
    }, delay);
  }

  function syncDrift() {
    stopDrift();
    if (paused || !visible || document.hidden || !maxLeft || resumeTimer ||
        pointerId !== null || (lightbox && !lightbox.classList.contains('hidden')) ||
        track.matches(':focus-visible') || track.querySelector(':focus-visible')) return;

    // Los navegadores pueden redondear scrollLeft. Conservamos el avance fraccionario.
    let position = Math.max(0, Math.min(maxLeft, track.scrollLeft));
    let lastTime;
    function advance(time) {
      if (lastTime !== undefined) {
        position += direction * pixelsPerSecond * Math.min(time - lastTime, 64) / 1000;
        if (direction > 0 ? position >= maxLeft : position <= 0) {
          track.scrollLeft = direction > 0 ? maxLeft : 0;
          direction *= -1;
          waitToResume(1300);
          return;
        }
        track.scrollLeft = position;
      }
      lastTime = time;
      frame = requestAnimationFrame(advance);
    }
    frame = requestAnimationFrame(advance);
  }

  function updateEdges() {
    const left = track.scrollLeft;
    previous.disabled = left <= 1;
    next.disabled = left >= maxLeft - 1;
    track.classList.toggle('has-previous', !previous.disabled);
    track.classList.toggle('has-next', !next.disabled);
  }

  function measure() {
    maxLeft = Math.max(0, track.scrollWidth - track.clientWidth);
    updateEdges();
    syncDrift();
  }

  function updatePlayback() {
    label.textContent = paused ? 'Reproducir' : 'Pausar';
    playback.setAttribute('aria-label', label.textContent + ' el recorrido automático');
    playback.classList.toggle('is-paused', paused);
  }

  function photoStart(photo) {
    return photo.offsetLeft - photos[0].offsetLeft;
  }

  function scrollTo(left) {
    waitToResume(interactionDelay, true);
    track.scrollTo({
      left: Math.max(0, Math.min(maxLeft, left)),
      behavior: reducedMotion.matches ? 'auto' : 'smooth'
    });
  }

  function step(sign) {
    const ordered = sign > 0 ? photos : photos.slice().reverse();
    const target = ordered.find(photo => sign * (photoStart(photo) - track.scrollLeft) > 6);
    scrollTo(target ? photoStart(target) : (sign > 0 ? maxLeft : 0));
  }

  previous.addEventListener('click', () => step(-1));
  next.addEventListener('click', () => step(1));
  playback.addEventListener('click', () => {
    paused = !paused;
    clearTimeout(resumeTimer);
    resumeTimer = 0;
    manualScroll = false;
    updatePlayback();
    syncDrift();
  });
  reducedMotion.addEventListener('change', () => {
    if (reducedMotion.matches) paused = true;
    updatePlayback();
    syncDrift();
  });

  track.addEventListener('keydown', event => {
    const sign = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
    if (!sign) return;
    event.preventDefault();
    const index = photos.indexOf(event.target);
    if (index === -1) {
      step(sign);
      return;
    }
    const photo = photos[Math.max(0, Math.min(photos.length - 1, index + sign))];
    photo.focus({ preventScroll: true });
    scrollTo(photoStart(photo));
  });
  track.addEventListener('focusin', syncDrift);
  track.addEventListener('focusout', () => queueMicrotask(syncDrift));
  track.addEventListener('wheel', event => {
    if (event.deltaX || event.shiftKey) waitToResume(interactionDelay, true);
  }, { passive: true });
  track.addEventListener('scroll', () => {
    updateEdges();
    if (manualScroll) waitToResume(interactionDelay, true);
  }, { passive: true });

  track.addEventListener('pointerdown', event => {
    if (!event.isPrimary || event.button !== 0) return;
    pointerId = event.pointerId;
    stopDrift();
    if (event.pointerType === 'mouse' && event.target.closest('.memory-photo')) {
      drag = { x: event.clientX, left: track.scrollLeft, moved: false };
    }
  });
  window.addEventListener('pointermove', event => {
    if (!drag || event.pointerId !== pointerId) return;
    const distance = event.clientX - drag.x;
    if (!drag.moved && Math.abs(distance) < 6) return;
    if (!drag.moved) {
      drag.moved = true;
      track.setPointerCapture(pointerId);
      track.classList.add('is-dragging');
    }
    track.scrollLeft = drag.left - distance;
  });
  function endPointer(event) {
    if (event.pointerId !== pointerId) return;
    if (drag && drag.moved) {
      track.classList.remove('is-dragging');
      ignoreClick = true;
      setTimeout(() => { ignoreClick = false; }, 0);
    }
    pointerId = null;
    drag = null;
    waitToResume(interactionDelay, true);
  }
  window.addEventListener('pointerup', endPointer);
  window.addEventListener('pointercancel', endPointer);
  track.addEventListener('click', event => {
    if (ignoreClick) { event.preventDefault(); event.stopPropagation(); }
  }, true);

  document.addEventListener('visibilitychange', syncDrift);
  if (lightbox) new MutationObserver(syncDrift).observe(lightbox, { attributeFilter: ['class'] });
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting && entry.intersectionRatio >= .15;
      syncDrift();
    }, { threshold: [0, .15] }).observe(track);
  }
  if ('ResizeObserver' in window) new ResizeObserver(measure).observe(track);
  else window.addEventListener('resize', measure);
  controls.hidden = false;
  updatePlayback();
  measure();
})();

/* Paleta de inspiración: el recuadro cambia suavemente de tonalidad sin perder el papel. */
(function() {
  var card = document.getElementById('dressCard');
  var buttons = card ? card.querySelectorAll('[data-color]') : [];
  var note = document.getElementById('dressColorNote');

  // Tonalidades diluidas para no comprometer el contraste del texto.
  var tints = {
    '#154C99': 'rgba(21, 76, 153, .18)',
    '#8AB4E1': 'rgba(138, 180, 225, .33)',
    '#FAF7F2': 'rgba(192, 168, 138, .23)',
    '#E8E2D9': 'rgba(177, 151, 117, .27)',
    '#6B8473': 'rgba(107, 132, 115, .27)'
  };

  buttons.forEach(function(btn) {
    btn.addEventListener('click', function() {
      var wasOn = btn.getAttribute('aria-pressed') === 'true';

      buttons.forEach(function(b) {
        b.setAttribute('aria-pressed', 'false');
      });

      if (wasOn) {
        card.removeAttribute('data-selected-color');
        if (note) note.textContent = 'Toca un color para ver una idea.';
        return;
      }

      var selected = btn.getAttribute('data-color').toUpperCase();

      card.style.setProperty(
        '--dress-tint',
        tints[selected] || 'rgba(138, 180, 225, .20)'
      );

      card.setAttribute('data-selected-color', selected);
      btn.setAttribute('aria-pressed', 'true');

      if (note) {
        note.textContent = 'Vista previa: ' +
          btn.getAttribute('aria-label') +
          '. Toca de nuevo para quitar el color.';
      }
    });
  });
})();

