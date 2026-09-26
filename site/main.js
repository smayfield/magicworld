// Small progressive enhancements. The page is fully usable without this file.
(function () {
  document.documentElement.classList.add('js');

  var year = document.getElementById('year');
  if (year) year.textContent = new Date().getFullYear();

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Staggered, bouncy fade-in as elements scroll into view.
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

  // "Coming soon" cards shouldn't jump to the top of the page.
  document.querySelectorAll('.card.soon').forEach(function (card) {
    card.addEventListener('click', function (e) { e.preventDefault(); });
  });

  if (reduceMotion) return;

  // A little burst of sparkles wherever you click.
  var colors = ['#ffd76a', '#b6f36a', '#7cf2c8', '#2fbf71', '#f4ff9a'];
  document.addEventListener('pointerdown', function (e) {
    for (var i = 0; i < 8; i++) {
      var p = document.createElement('span');
      var angle = (Math.PI * 2 * i) / 8 + Math.random() * 0.5;
      var dist = 30 + Math.random() * 30;
      p.className = 'pop';
      p.setAttribute('aria-hidden', 'true');
      p.setAttribute('role', 'presentation');
      p.style.left = e.clientX + 'px';
      p.style.top = e.clientY + 'px';
      p.style.setProperty('--dx', Math.cos(angle) * dist + 'px');
      p.style.setProperty('--dy', Math.sin(angle) * dist + 'px');
      p.style.setProperty('--c', colors[i % colors.length]);
      document.body.appendChild(p);
      setTimeout(function (el) { el.remove(); }, 850, p);
    }
  });

  // Fireflies: wandering, softly pulsing lights that drift toward the cursor.
  var canvas = document.querySelector('.fireflies');
  if (!canvas || !canvas.getContext) return;
  var ctx = canvas.getContext('2d');
  var flies = [];
  var w = 0, h = 0;
  var mouse = null;
  var glowSprites = {};

  function getGlowSprite(radius) {
    var key = radius.toFixed(1);
    if (glowSprites[key]) return glowSprites[key];

    var glowRadius = radius * 7;
    var size = Math.ceil(glowRadius * 2);
    var sprite = document.createElement('canvas');
    var spriteCtx = sprite.getContext('2d');
    var center = size / 2;
    var gradient;

    sprite.width = size;
    sprite.height = size;

    gradient = spriteCtx.createRadialGradient(center, center, 0, center, center, glowRadius);
    gradient.addColorStop(0, 'rgba(244, 255, 154, 1)');
    gradient.addColorStop(0.25, 'rgba(182, 243, 106, 0.5)');
    gradient.addColorStop(1, 'rgba(182, 243, 106, 0)');

    spriteCtx.fillStyle = gradient;
    spriteCtx.beginPath();
    spriteCtx.arc(center, center, glowRadius, 0, Math.PI * 2);
    spriteCtx.fill();

    glowSprites[key] = sprite;
    return sprite;
  }

  function resize() {
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = canvas.clientWidth;
    h = canvas.clientHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    var count = Math.max(18, Math.min(60, Math.round((w * h) / 16000)));
    flies = [];
    for (var i = 0; i < count; i++) {
      var radius = Math.random() * 1.6 + 1.2;
      flies.push({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: 0,
        vy: 0,
        heading: Math.random() * Math.PI * 2,
        r: radius,
        sprite: getGlowSprite(radius),
        phase: Math.random() * Math.PI * 2,
        speed: Math.random() * 0.003 + 0.0015
      });
    }
  }

  function draw(t) {
    ctx.clearRect(0, 0, w, h);
    for (var i = 0; i < flies.length; i++) {
      var f = flies[i];
      // Wander: nudge the heading a little each frame.
      f.heading += (Math.random() - 0.5) * 0.3;
      var ax = Math.cos(f.heading) * 0.02;
      var ay = Math.sin(f.heading) * 0.02;
      // Gently drift toward the cursor when it's nearby.
      if (mouse) {
        var dx = mouse.x - f.x, dy = mouse.y - f.y;
        var d = Math.sqrt(dx * dx + dy * dy);
        if (d < 180 && d > 1) { ax += (dx / d) * 0.03; ay += (dy / d) * 0.03; }
      }
      f.vx = (f.vx + ax) * 0.96;
      f.vy = (f.vy + ay) * 0.96;
      f.x += f.vx;
      f.y += f.vy;
      if (f.x < -10) f.x = w + 10; else if (f.x > w + 10) f.x = -10;
      if (f.y < -10) f.y = h + 10; else if (f.y > h + 10) f.y = -10;

      var glow = 0.5 + 0.5 * Math.sin(t * f.speed + f.phase);
      var a = 0.15 + 0.85 * glow * glow;
      ctx.globalAlpha = a;
      ctx.drawImage(f.sprite, f.x - f.sprite.width / 2, f.y - f.sprite.height / 2);
      ctx.globalAlpha = 1;
    }
  }

  function loop(t) {
    draw(t);
    requestAnimationFrame(loop);
  }

  var hero = canvas.parentElement;
  hero.addEventListener('pointermove', function (e) {
    var r = canvas.getBoundingClientRect();
    mouse = { x: e.clientX - r.left, y: e.clientY - r.top };
  });
  hero.addEventListener('pointerleave', function () { mouse = null; });

  window.addEventListener('resize', resize);
  resize();
  requestAnimationFrame(loop);
})();
