// Renders videos.json. "Reviewed" ticks are kept in this browser's localStorage.
(function () {
  var KEY = 'tiktok-review:done';
  var done = {};
  try { done = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) { done = {}; }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(done)); } catch (e) {} }

  var filter = 'todo', query = '', items = [], updated = '';
  var out = document.getElementById('rv-out');
  var count = document.getElementById('rv-count');
  var foot = document.getElementById('rv-foot');
  var search = document.getElementById('rv-search');

  var dayFmt = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  var timeFmt = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit' });

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  function matches(v) {
    if (filter === 'todo' && done[v.id]) return false;
    if (filter === 'ai' && v.topic !== 'ai') return false;
    if (!query) return true;
    var hay = [v.note, v.creator, v.caption, v.summary].join(' ').toLowerCase();
    return hay.indexOf(query) !== -1;
  }

  function render() {
    var shown = items.filter(matches);
    var left = items.filter(function (v) { return !done[v.id]; }).length;
    count.textContent = left + ' to review · ' + items.length + ' total';
    out.textContent = '';
    if (!shown.length) { out.appendChild(el('p', 'rv-empty', 'Nothing here.')); return; }
    var lastDay = '', list = null;
    shown.forEach(function (v) {
      var d = new Date(v.sent);
      var day = dayFmt.format(d);
      if (day !== lastDay) {
        out.appendChild(el('h2', 'rv-day', day));
        list = el('ul', 'rv-list');
        out.appendChild(list);
        lastDay = day;
      }
      var li = el('li', 'rv-item' + (done[v.id] ? ' done' : ''));
      var box = document.createElement('input');
      box.type = 'checkbox';
      box.checked = !!done[v.id];
      box.setAttribute('aria-label', 'Reviewed: ' + v.note);
      box.addEventListener('change', function () {
        if (box.checked) done[v.id] = new Date().toISOString(); else delete done[v.id];
        save();
        if (filter === 'todo') render(); else li.classList.toggle('done', box.checked);
        count.textContent = items.filter(function (x) { return !done[x.id]; }).length + ' to review · ' + items.length + ' total';
      });
      li.appendChild(box);
      var head = el('div', 'rv-head');
      var note = el('span', 'rv-note');
      var a = el('a', null, v.note || 'TikTok video');
      a.href = v.url; a.target = '_blank'; a.rel = 'noopener';
      note.appendChild(a);
      head.appendChild(note);
      var meta = [timeFmt.format(d)];
      if (v.creator) meta.push('@' + v.creator);
      head.appendChild(el('span', 'rv-meta', meta.join(' · ')));
      if (v.topic === 'ai') head.appendChild(el('span', 'rv-tag', 'AI & dev'));
      li.appendChild(head);
      var s = v.summary || 'Not summarized yet.';
      li.appendChild(el('p', 'rv-sum' + (v.summary ? '' : ' unknown'), s));
      list.appendChild(li);
    });
  }

  document.querySelectorAll('.rv-chip').forEach(function (b) {
    b.addEventListener('click', function () {
      filter = b.getAttribute('data-filter');
      document.querySelectorAll('.rv-chip').forEach(function (x) { x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); });
      render();
    });
  });
  search.addEventListener('input', function () { query = search.value.trim().toLowerCase(); render(); });

  fetch('videos.json', { cache: 'no-cache' }).then(function (r) { return r.json(); }).then(function (data) {
    items = (data.videos || []).slice().sort(function (a, b) { return a.sent < b.sent ? 1 : -1; });
    updated = data.updated || '';
    if (updated) foot.textContent = 'Last updated ' + dayFmt.format(new Date(updated)) + ', ' + timeFmt.format(new Date(updated)) + ' ET. Reviewed ticks are saved in this browser only.';
    render();
  }).catch(function () { count.textContent = 'Could not load the list.'; });
})();
