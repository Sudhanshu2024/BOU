/* Bunch of Us — landing page behaviour: mobile menu and contact form. */

(function () {
  'use strict';

  /* ---------- Mobile menu ---------- */

  var toggle = document.querySelector('.nav-toggle');
  var menu = document.getElementById('mobile-menu');

  function setMenu(open) {
    if (!toggle || !menu) return;
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    menu.hidden = !open;
  }

  if (toggle && menu) {
    toggle.addEventListener('click', function () {
      setMenu(toggle.getAttribute('aria-expanded') !== 'true');
    });

    menu.addEventListener('click', function (event) {
      if (event.target.closest('a')) setMenu(false);
    });

    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') {
        setMenu(false);
        toggle.focus();
      }
    });

    // The desktop nav takes over above 900px; drop the panel so it can't linger.
    window.matchMedia('(min-width: 901px)').addEventListener('change', function (event) {
      if (event.matches) setMenu(false);
    });
  }

  /* ---------- Contact form ---------- */
  /* Posts to the endpoint set in content.json (default /api/lead, the Cloudflare
     Pages Function). With JavaScript off the form still submits natively and the
     lead arrives, but the visitor sees the endpoint's JSON reply instead of a
     thank-you line. */

  var form = document.getElementById('contact-form');
  var status = document.getElementById('form-status');
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
        setStatus(copy.success, 'ok');
        if (window.turnstile) window.turnstile.reset();
      })
      .catch(function (error) {
        setStatus(error.message && error.message !== 'failed' ? error.message : copy.error, 'error');
      })
      .then(function () {
        if (submitButton) submitButton.disabled = false;
      });
  });
})();
