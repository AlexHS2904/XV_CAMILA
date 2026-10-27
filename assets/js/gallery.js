
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

