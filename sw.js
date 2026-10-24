const CACHE='apex-pos-v6-enhanced';
const ASSETS=['./','./index.html','./app.js','./manifest.webmanifest','./icon.png','./icon-192.png','./icon-512.png','./install.js','./admin.html','./admin.js'];
const allowed=new Set(ASSETS.map(path=>new URL(path,self.location.href).href));
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('apex-pos-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{
 if(e.request.method!=='GET'||!allowed.has(e.request.url))return;
 e.respondWith(fetch(e.request).then(r=>{if(r.ok){const copy=r.clone();e.waitUntil(caches.open(CACHE).then(c=>c.put(e.request,copy)))}return r}).catch(async()=>await caches.match(e.request)||Response.error()));
});
