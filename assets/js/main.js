/* Bunch of Us — landing page behaviour.

   Everything here is an enhancement. With JavaScript off the page still reads
   top to bottom: nothing is hidden by CSS alone, the drawer links are ordinary
   anchors, the work cards fall back to the contact section, and the contact
   form submits natively to its endpoint. */

(function () {
  'use strict';

  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var hasIO = 'IntersectionObserver' in window;
  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };

  /* ---------- Scroll progress, sticky nav, parallax ---------- */

  var bar = $('#progress-bar');
  var nav = $('#nav');
  var pars = $$('[data-par]');
  var ticking = false;

  function frame() {
    var max = document.documentElement.scrollHeight - window.innerHeight;
    var p = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
    if (bar) bar.style.transform = 'scaleX(' + p + ')';
    if (nav) nav.classList.toggle('is-stuck', window.scrollY > 90);

    if (!reduce) {
      for (var i = 0; i < pars.length; i++) {
        var el = pars[i];
        var r = el.getBoundingClientRect();
        if (r.bottom < -200 || r.top > window.innerHeight + 200) continue;
        var mid = r.top + r.height / 2 - window.innerHeight / 2;
        var amount = parseFloat(el.getAttribute('data-par')) || 0.05;
        var img = el.firstElementChild;
        if (img) img.style.setProperty('--py', (-mid * amount).toFixed(1) + 'px');
      }
    }
    ticking = false;
  }

  function onScroll() {
    if (!ticking) { ticking = true; requestAnimationFrame(frame); }
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll);
  frame();

  /* ---------- The nav takes the colour of the band beneath it ---------- */

  if (hasIO && nav) {
    var navObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) nav.setAttribute('data-on', entry.target.getAttribute('data-nav'));
      });
    }, { rootMargin: '-70px 0px -94% 0px', threshold: 0 });
    $$('[data-nav]').forEach(function (band) { navObserver.observe(band); });
  }

  /* ---------- Reveal on scroll ----------
     Only elements still below the fold are hidden, so whatever is already on
     screen at load never flickers. */

  if (hasIO && !reduce) {
    var items = $$('[data-reveal]');
    items.forEach(function (el) {
      if (el.getBoundingClientRect().top > window.innerHeight * 0.88) el.classList.add('pre');
    });
    var revealObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.remove('pre');
          revealObserver.unobserve(entry.target);
        }
      });
    }, { rootMargin: '0px 0px -10% 0px', threshold: 0.06 });
    items.forEach(function (el) { revealObserver.observe(el); });
  }

  /* ---------- Media in view ----------
     Where there is a pointer, a picture comes into colour under it. Where there
     is none — touch, and the narrow layouts — scrolling it onto the screen is
     the nearest equivalent, so the invitation arrives before the tap rather
     than after it. The class goes on at every width; the stylesheet decides
     whether it means anything, which keeps rotating the phone honest. Once on,
     it stays on: a picture that fades back out on the way up is a distraction. */

  var nearItems = $$('.work-item, .member');

  if (hasIO) {
    var nearObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-near');
        nearObserver.unobserve(entry.target);
      });
    }, { rootMargin: '0px 0px -25% 0px', threshold: 0.25 });
    nearItems.forEach(function (el) { nearObserver.observe(el); });
  } else {
    nearItems.forEach(function (el) { el.classList.add('is-near'); });
  }

  /* ---------- Process stepper ---------- */

  var steps = $$('.step');
  var bigNum = $('#step-num');
  var bigTitle = $('#step-title');

  if (hasIO && steps.length) {
    steps[0].classList.add('is-active');
    var stepObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        steps.forEach(function (s) { s.classList.remove('is-active'); });
        entry.target.classList.add('is-active');
        if (bigNum) bigNum.textContent = entry.target.getAttribute('data-n');
        if (bigTitle) bigTitle.textContent = entry.target.getAttribute('data-title');
      });
    }, { rootMargin: '-46% 0px -46% 0px', threshold: 0 });
    steps.forEach(function (s) { stepObserver.observe(s); });
  } else {
    steps.forEach(function (s) { s.classList.add('is-active'); });
  }

  /* ---------- Mobile drawer ---------- */

  var toggle = $('.nav-toggle');
  var drawer = $('#drawer');
  var lastFocus = null;

  function setMenu(open) {
    if (!toggle || !drawer) return;
    if (open) {
      drawer.hidden = false;
      lastFocus = document.activeElement;
    }
    document.body.classList.toggle('menu-open', open);
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    document.documentElement.style.overflow = open ? 'hidden' : '';

    if (open) {
      var first = drawer.querySelector('a');
      if (first) first.focus();
    } else {
      // Keep it in the DOM until the clip-path transition has finished.
      window.setTimeout(function () {
        if (!document.body.classList.contains('menu-open')) drawer.hidden = true;
      }, 560);
      if (lastFocus && lastFocus.focus) lastFocus.focus();
    }
  }

  if (toggle && drawer) {
    toggle.addEventListener('click', function () {
      setMenu(!document.body.classList.contains('menu-open'));
    });
    drawer.addEventListener('click', function (event) {
      if (event.target.closest('a')) setMenu(false);
    });
    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && document.body.classList.contains('menu-open')) setMenu(false);
    });
    // The desktop nav takes over above 760px; drop the drawer so it can't linger.
    window.matchMedia('(min-width: 761px)').addEventListener('change', function (event) {
      if (event.matches && document.body.classList.contains('menu-open')) setMenu(false);
    });
  }

  /* ---------- Video media ----------
     Any media slot in content.json can hold a video instead of an image. A
     video plays while the pointer is over its box; where there is no hover —
     touch, and the narrow layouts — focus takes over, which is why the mute
     toggle is a real button sitting inside the box. Videos are muted until
     someone asks for sound, because that is the only way a browser will start
     one on its own. */

  var hoverPlays = window.matchMedia('(hover: hover) and (pointer: fine) and (min-width: 1001px)');
  var players = [];

  function play(video) {
    if (!video || !video.getAttribute('src')) return;
    var started = video.play();
    // Autoplay can still be refused; a still frame is a fine outcome.
    if (started && started.catch) started.catch(function () {});
  }

  function stop(video) {
    if (!video) return;
    video.pause();
    try { video.currentTime = 0; } catch (error) { /* not seekable yet */ }
  }

  function setSound(button, on) {
    if (!button) return;
    button.setAttribute('aria-pressed', String(on));
    button.setAttribute('aria-label', on ? button.dataset.labelMute : button.dataset.labelUnmute);
  }

  /* One video at a time may have sound. */
  function soloSound(video) {
    players.forEach(function (p) {
      if (p.video === video) return;
      p.video.muted = true;
      setSound(p.button, false);
    });
  }

  function wireSound(button, video) {
    if (!button || !video) return;
    players.push({ video: video, button: button });
    button.addEventListener('click', function () {
      if (video.muted) {
        soloSound(video);
        video.muted = false;
        play(video); // sound without picture would be a puzzle
      } else {
        video.muted = true;
      }
      setSound(button, !video.muted);
    });
  }

  /* Colour follows playback, so the stylesheet can leave a paused video looking
     like the stills around it. Driven by the video's own events, which covers
     hover, focus, the hero autoplaying and the overlay alike. */
  $$('video').forEach(function (video) {
    video.addEventListener('play', function () { video.classList.add('is-playing'); });
    video.addEventListener('pause', function () { video.classList.remove('is-playing'); });
    // The hero can start before this script runs, so catch up with it.
    if (!video.paused) video.classList.add('is-playing');
  });

  $$('[data-media="video"]').forEach(function (media) {
    var video = media.querySelector('video');
    if (!video) return;

    var button = media.querySelector('.sound');
    // The hero plays by itself; hovering the whole band should not stop it.
    var background = media.classList.contains('hero');

    if (!background) {
      media.addEventListener('mouseenter', function () {
        if (hoverPlays.matches && !reduce) play(video);
      });
      media.addEventListener('mouseleave', function () {
        if (hoverPlays.matches) stop(video);
      });
      // Focus is the trigger wherever hover is not, and for keyboards everywhere.
      media.addEventListener('focusin', function () { play(video); });
      media.addEventListener('focusout', function (event) {
        if (!media.contains(event.relatedTarget)) stop(video);
      });
    } else if (reduce) {
      video.removeAttribute('autoplay');
      video.pause();
    }

    wireSound(button, video);
  });

  /* ---------- Work case overlay ---------- */

  var dialog = $('#case');
  var canDialog = dialog && typeof dialog.showModal === 'function';

  function fill(id, value) {
    var el = $(id);
    if (el) el.textContent = value || '';
  }

  var caseImg = $('#case-img');
  var caseVideo = $('#case-video');
  var caseSound = $('#case-sound');

  function showCaseMedia(card) {
    var src = card.getAttribute('data-src');
    var alt = card.getAttribute('data-alt') || '';
    var poster = card.getAttribute('data-poster');

    if (card.getAttribute('data-type') === 'video') {
      if (caseImg) caseImg.hidden = true;
      if (!caseVideo) return;
      caseVideo.hidden = false;
      caseVideo.src = src;
      if (poster) caseVideo.poster = poster; else caseVideo.removeAttribute('poster');
      caseVideo.setAttribute('aria-label', alt);
      caseVideo.muted = true;
      if (caseSound) {
        caseSound.hidden = false;
        setSound(caseSound, false);
      }
      play(caseVideo);
      return;
    }

    if (caseVideo) {
      caseVideo.pause();
      caseVideo.hidden = true;
      caseVideo.removeAttribute('src');
      caseVideo.load();
    }
    if (caseSound) caseSound.hidden = true;
    if (caseImg) {
      caseImg.hidden = false;
      caseImg.src = src;
      caseImg.alt = alt;
    }
  }

  if (caseVideo && caseSound) wireSound(caseSound, caseVideo);

  $$('.work-card').forEach(function (card) {
    card.addEventListener('click', function () {
      if (!canDialog) { location.hash = '#contact'; return; }
      fill('#case-kind', card.getAttribute('data-kind'));
      fill('#case-title', card.getAttribute('data-title'));
      fill('#case-brief', card.getAttribute('data-brief'));
      fill('#case-did', card.getAttribute('data-did'));
      fill('#case-result', card.getAttribute('data-result'));
      showCaseMedia(card);
      dialog.showModal();
    });
  });

  if (canDialog) {
    var close = $('#case-close');
    var caseCta = $('#case-cta');

    /* Every way out of the overlay stops its video: the close event alone is
       not dependable enough to be the only place that does it. */
    function closeCase() {
      if (caseVideo) stop(caseVideo);
      dialog.close();
    }

    if (close) close.addEventListener('click', closeCase);
    if (caseCta) caseCta.addEventListener('click', closeCase);
    dialog.addEventListener('click', function (event) {
      if (event.target === dialog) closeCase();
    });
    dialog.addEventListener('cancel', function () { if (caseVideo) stop(caseVideo); });
    dialog.addEventListener('close', function () { if (caseVideo) stop(caseVideo); });
  }

  /* ---------- Contact form ----------
     Posts to the endpoint set in content.json (default /api/lead, the
     Cloudflare Pages Function). With JavaScript off the form still submits
     natively and the lead arrives, but the visitor sees the endpoint's JSON
     reply instead of the thank-you panel. */

  var form = $('#contact-form');
  var status = $('#form-status');
  var sent = $('#sent');
  if (!form || !status) return;

  var copy = { invalid: '', sending: '', success: '', error: '' };
  try {
    Object.assign(copy, JSON.parse(form.dataset.messages || '{}'));
  } catch (error) {
    // Keep the empty defaults; a missing message is better than a broken form.
  }

  function setStatus(text, state) {
    status.textContent = text;
    status.dataset.state = state || '';
  }

  form.addEventListener('submit', function (event) {
    event.preventDefault();

    if (!form.checkValidity()) {
      setStatus(copy.invalid, 'error');
      var firstInvalid = form.querySelector(':invalid');
      if (firstInvalid) firstInvalid.focus();
      return;
    }

    var submitButton = form.querySelector('button[type="submit"]');
    var payload = Object.fromEntries(new FormData(form).entries());

    if (submitButton) submitButton.disabled = true;
    setStatus(copy.sending, 'busy');

    fetch(form.action, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload)
    })
      .then(function (response) {
        return response.json().catch(function () {
          return { ok: response.ok };
        });
      })
      .then(function (result) {
        if (!result.ok) throw new Error(result.error || 'failed');
        form.reset();
        setStatus('', '');
        if (window.turnstile) window.turnstile.reset();
        if (sent) {
          form.hidden = true;
          sent.hidden = false;
          sent.focus();
        } else {
          setStatus(copy.success, 'ok');
        }
      })
      .catch(function (error) {
        setStatus(error.message && error.message !== 'failed' ? error.message : copy.error, 'error');
      })
      .then(function () {
        if (submitButton) submitButton.disabled = false;
      });
  });

  var again = $('#send-again');
  if (again && sent) {
    again.addEventListener('click', function () {
      sent.hidden = true;
      form.hidden = false;
      var name = $('#f-name');
      if (name) name.focus();
    });
  }
})();
