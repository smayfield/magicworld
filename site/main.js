// Small progressive enhancements. The page is fully usable without this file.
(function () {
  document.documentElement.classList.add('js');

  var year = document.getElementById('year');
  if (year) year.textContent = new Date().getFullYear();

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Staggered fade-in as elements scroll into view.
  var reveals = document.querySelectorAll('.reveal');
  reveals.forEach(function (el, i) { el.style.setProperty('--i', i % 6); });
  if ('IntersectionObserver' in window && !reduceMotion) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
      });
    }, { threshold: 0.1 });
    reveals.forEach(function (el) { io.observe(el); });
  } else {
    reveals.forEach(function (el) { el.classList.add('in'); });
  }

  // Cursor-following glow on cards.
  document.querySelectorAll('.card').forEach(function (card) {
    card.addEventListener('pointermove', function (e) {
      var r = card.getBoundingClientRect();
      card.style.setProperty('--mx', (e.clientX - r.left) + 'px');
      card.style.setProperty('--my', (e.clientY - r.top) + 'px');
    });
  });

  // "Coming soon" cards shouldn't jump to the top of the page.
  document.querySelectorAll('.card.soon').forEach(function (card) {
    card.addEventListener('click', function (e) { e.preventDefault(); });
  });

  // Twinkling starfield with a little parallax.
  var canvas = document.querySelector('.stars');
  if (!canvas || !canvas.getContext) return;
  var ctx = canvas.getContext('2d');
  var stars = [];
  var w = 0, h = 0, dpr = 1;
  var px = 0, py = 0, tx = 0, ty = 0;

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = canvas.clientWidth;
    h = canvas.clientHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    var count = Math.round((w * h) / 5000);
    stars = [];
    for (var i = 0; i < count; i++) {
      stars.push({
        x: Math.random() * w,
        y: Math.random() * h,
        r: Math.random() * 1.3 + 0.3,
        depth: Math.random() * 0.8 + 0.2,
        phase: Math.random() * Math.PI * 2,
        speed: Math.random() * 0.002 + 0.0006
      });
    }
    if (reduceMotion) draw(0);
  }

  function draw(t) {
    ctx.clearRect(0, 0, w, h);
    px += (tx - px) * 0.05;
    py += (ty - py) * 0.05;
    for (var i = 0; i < stars.length; i++) {
      var s = stars[i];
      var a = reduceMotion ? 0.8 : 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(t * s.speed + s.phase));
      var x = s.x + px * s.depth * 20;
      var y = s.y + py * s.depth * 20;
      ctx.globalAlpha = a;
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(x, y, s.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function loop(t) {
    draw(t);
    requestAnimationFrame(loop);
  }

  window.addEventListener('resize', resize);
  resize();

  if (!reduceMotion) {
    window.addEventListener('pointermove', function (e) {
      tx = e.clientX / window.innerWidth - 0.5;
      ty = e.clientY / window.innerHeight - 0.5;
    });
    requestAnimationFrame(loop);
  }
})();
