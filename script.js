// Tabs de formularios (nuevos / con experiencia)
const tabNuevos = document.getElementById('tabNuevos');
const tabExperiencia = document.getElementById('tabExperiencia');
const panelNuevos = document.getElementById('panelNuevos');
const panelExperiencia = document.getElementById('panelExperiencia');

function activarTab(tabActivo, tabInactivo, panelActivo, panelInactivo) {
  tabActivo.classList.add('is-active');
  tabActivo.setAttribute('aria-selected', 'true');
  tabInactivo.classList.remove('is-active');
  tabInactivo.setAttribute('aria-selected', 'false');
  panelActivo.hidden = false;
  panelInactivo.hidden = true;
}

if (tabNuevos && tabExperiencia) {
  tabNuevos.addEventListener('click', () => activarTab(tabNuevos, tabExperiencia, panelNuevos, panelExperiencia));
  tabExperiencia.addEventListener('click', () => activarTab(tabExperiencia, tabNuevos, panelExperiencia, panelNuevos));
}

// Envío de formularios a Formspree sin recargar la página
document.querySelectorAll('.club-form').forEach(form => {
  const statusEl = form.querySelector('.form-status');
  const submitBtn = form.querySelector('button[type="submit"]');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    statusEl.textContent = 'Enviando...';
    statusEl.className = 'form-status';
    submitBtn.disabled = true;

    try {
      const response = await fetch(form.action, {
        method: 'POST',
        body: new FormData(form),
        headers: { 'Accept': 'application/json' }
      });

      if (response.ok) {
        statusEl.textContent = form.dataset.success || 'Listo, recibimos tu inscripción. Nos vemos en el club.';
        statusEl.className = 'form-status success';
        form.reset();
      } else {
        statusEl.textContent = 'No se pudo enviar. Probá de nuevo en un momento.';
        statusEl.className = 'form-status error';
      }
    } catch (err) {
      statusEl.textContent = 'Hubo un problema de conexión. Probá de nuevo.';
      statusEl.className = 'form-status error';
    } finally {
      submitBtn.disabled = false;
    }
  });
});

// Carrusel de fotos del club
const carousel = document.getElementById('clubCarousel');
if (carousel) {
  const track    = carousel.querySelector('.carousel-track');
  const slides   = carousel.querySelectorAll('.carousel-slide');
  const dots     = carousel.querySelectorAll('.carousel-dot');
  const prevBtn  = carousel.querySelector('.carousel-prev');
  const nextBtn  = carousel.querySelector('.carousel-next');
  let current = 0;
  let timer;

  function goTo(n) {
    dots[current].classList.remove('is-active');
    current = (n + slides.length) % slides.length;
    dots[current].classList.add('is-active');
    track.style.transform = `translateX(-${current * 100}%)`;
  }

  function startTimer() { timer = setInterval(() => goTo(current + 1), 4500); }
  function stopTimer()  { clearInterval(timer); }

  prevBtn.addEventListener('click', () => { stopTimer(); goTo(current - 1); startTimer(); });
  nextBtn.addEventListener('click', () => { stopTimer(); goTo(current + 1); startTimer(); });
  dots.forEach((dot, i) => dot.addEventListener('click', () => { stopTimer(); goTo(i); startTimer(); }));

  carousel.addEventListener('mouseenter', stopTimer);
  carousel.addEventListener('mouseleave', startTimer);

  // Swipe táctil
  let touchStartX = 0;
  carousel.addEventListener('touchstart', e => { touchStartX = e.touches[0].clientX; }, { passive: true });
  carousel.addEventListener('touchend', e => {
    const diff = touchStartX - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 40) { stopTimer(); goTo(current + (diff > 0 ? 1 : -1)); startTimer(); }
  });

  startTimer();
}

// Menú móvil
const navToggle = document.getElementById('navToggle');
const mainNav = document.getElementById('mainNav');

if (navToggle && mainNav) {
  navToggle.addEventListener('click', () => {
    const isOpen = mainNav.classList.toggle('is-open');
    navToggle.classList.toggle('is-open', isOpen);
    navToggle.setAttribute('aria-expanded', String(isOpen));
  });

  function closeNav() {
    mainNav.classList.remove('is-open');
    navToggle.classList.remove('is-open');
    navToggle.setAttribute('aria-expanded', 'false');
  }

  mainNav.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', closeNav);
  });

  // Cerrar menú al tocar fuera en móvil
  document.addEventListener('click', (e) => {
    if (mainNav.classList.contains('is-open') &&
        !mainNav.contains(e.target) &&
        !navToggle.contains(e.target)) {
      closeNav();
    }
  });
}

// Botón flotante: aparece al salir del hero
const floatBtn = document.querySelector('.float-contact');
if (floatBtn) {
  const toggle = () => {
    const pastHero   = window.scrollY > window.innerHeight * 0.6;
    const nearBottom = window.scrollY + window.innerHeight > document.body.scrollHeight - 120;
    floatBtn.classList.toggle('is-visible', pastHero && !nearBottom);
  };
  window.addEventListener('scroll', toggle, { passive: true });
  toggle();
}

// Animación de aparición al hacer scroll
const revealEls = document.querySelectorAll('.reveal');

if ('IntersectionObserver' in window && revealEls.length) {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.15 });

  revealEls.forEach(el => observer.observe(el));
} else {
  revealEls.forEach(el => el.classList.add('is-visible'));
}
