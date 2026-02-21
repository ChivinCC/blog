// 百倍机会攻略 Service Worker
// 策略：Shell 文件永久缓存，API 请求网络优先+缓存兜底

var CACHE_NAME = 'baibei-v3';
var SHELL_CACHE = 'baibei-shell-v3';

// 需要预缓存的核心文件
var SHELL_FILES = [
  '/',
  '/index.html',
];

// 安装时预缓存 shell
self.addEventListener('install', function(e) {
  e.waitUntil(
    caches.open(SHELL_CACHE).then(function(cache) {
      return cache.addAll(SHELL_FILES);
    }).then(function() {
      return self.skipWaiting();
    })
  );
});

// 激活时清理旧缓存
self.addEventListener('activate', function(e) {
  e.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(
        keys.filter(function(k) {
          return k !== CACHE_NAME && k !== SHELL_CACHE;
        }).map(function(k) {
          return caches.delete(k);
        })
      );
    }).then(function() {
      return self.clients.claim();
    })
  );
});

self.addEventListener('fetch', function(e) {
  var url = e.request.url;

  // Supabase API：网络优先，失败时返回缓存
  if (url.indexOf('supabase.co') !== -1) {
    e.respondWith(
      fetch(e.request.clone()).then(function(res) {
        if (res && res.status === 200) {
          var resClone = res.clone();
          caches.open(CACHE_NAME).then(function(cache) {
            cache.put(e.request, resClone);
          });
        }
        return res;
      }).catch(function() {
        return caches.match(e.request);
      })
    );
    return;
  }

  // Google Fonts CSS：缓存优先（字体文件基本不变）
  if (url.indexOf('fonts.googleapis.com') !== -1 || url.indexOf('fonts.gstatic.com') !== -1) {
    e.respondWith(
      caches.match(e.request).then(function(cached) {
        if (cached) return cached;
        return fetch(e.request).then(function(res) {
          var resClone = res.clone();
          caches.open(CACHE_NAME).then(function(cache) {
            cache.put(e.request, resClone);
          });
          return res;
        });
      })
    );
    return;
  }

  // Supabase Storage 图片：缓存优先（图片基本不变）
  if (url.indexOf('storage/v1/object/public') !== -1) {
    e.respondWith(
      caches.match(e.request).then(function(cached) {
        if (cached) return cached;
        return fetch(e.request).then(function(res) {
          var resClone = res.clone();
          caches.open(CACHE_NAME).then(function(cache) {
            cache.put(e.request, resClone);
          });
          return res;
        }).catch(function() { return new Response('', {status: 404}); });
      })
    );
    return;
  }

  // index.html：网络优先，离线时用缓存
  if (url.indexOf('/index.html') !== -1 || e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request).then(function(res) {
        var resClone = res.clone();
        caches.open(SHELL_CACHE).then(function(cache) {
          cache.put(e.request, resClone);
        });
        return res;
      }).catch(function() {
        return caches.match('/index.html');
      })
    );
    return;
  }

  // 其他请求：默认走网络
  e.respondWith(fetch(e.request));
});
