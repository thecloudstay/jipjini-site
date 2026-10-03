// 집지니 콘솔 앱 껍데기용 서비스 워커 — 설치 가능 조건만 채운다(캐시 없음, 콘솔 데이터는 항상 실시간).
self.addEventListener('install', function () { self.skipWaiting(); });
self.addEventListener('activate', function (e) { e.waitUntil(self.clients.claim()); });
self.addEventListener('fetch', function () {});
