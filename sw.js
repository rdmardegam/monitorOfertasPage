/* Service worker mínimo do Monitor Ofertas.
   HTML (navegação) = network-first com {cache:'no-store'}: o catálogo é regerado
   a cada publicação, então a página SEMPRE vem fresca da rede (sem passar pelo
   cache HTTP do navegador, que servia produtos/horário velhos). O cache só entra
   como fallback offline. Assets estáticos (ícones/og) = cache-first (rápidos). */
const CACHE = 'mo-v3';
const SHELL = ['/', '/index.html', '/og.jpg', '/icon-192.png', '/icon-512.png'];

self.addEventListener('install', function (e) {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(SHELL).catch(function () {}); }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (ks) {
      return Promise.all(ks.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;

  // Navegação / HTML: sempre da rede, ignorando o cache HTTP (no-store). Assim o
  // app abre com os produtos e o horário mais novos. Cache só se a rede falhar.
  var isNav = req.mode === 'navigate'
    || (req.headers.get('accept') || '').indexOf('text/html') !== -1;
  if (isNav) {
    e.respondWith(
      fetch(req, { cache: 'no-store' }).then(function (res) {
        var copy = res.clone();
        caches.open(CACHE).then(function (c) { c.put(req, copy); }).catch(function () {});
        return res;
      }).catch(function () {
        return caches.match(req).then(function (r) {
          return r || caches.match('/index.html') || caches.match('/');
        });
      })
    );
    return;
  }

  // Assets estáticos (ícones, og, fontes): cache-first — rápido e raramente muda.
  e.respondWith(
    caches.match(req).then(function (r) {
      return r || fetch(req).then(function (res) {
        var copy = res.clone();
        caches.open(CACHE).then(function (c) { c.put(req, copy); }).catch(function () {});
        return res;
      });
    })
  );
});
