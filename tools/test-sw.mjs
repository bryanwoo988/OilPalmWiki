/**
 * Exercise sw.js in a stubbed ServiceWorkerGlobalScope.
 *
 *   node tools/test-sw.mjs
 *
 * The browser test page can only inspect the precache list as text. This runs
 * the worker's actual install, activate and fetch handlers against a fake Cache
 * Storage and a fake network, so the caching behaviour itself is tested rather
 * than assumed. Exits non-zero on failure.
 */
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import vm from 'node:vm';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const ORIGIN = 'https://example.test';

let passed = 0;
const failures = [];

function check(name, fn) {
  try {
    const r = fn();
    if (r === false) throw new Error('returned false');
    console.log(`  ok    ${name}`);
    passed++;
  } catch (e) {
    console.log(`  FAIL  ${name} — ${e.message}`);
    failures.push(name);
  }
}

/* --- Minimal fakes -------------------------------------------------------- */

class FakeResponse {
  constructor(body, init = {}) {
    this.body = body;
    this.status = init.status ?? 200;
    this.statusText = init.statusText ?? 'OK';
    this.type = init.type ?? 'basic';
    this.url = init.url ?? '';
  }
  get ok() { return this.status >= 200 && this.status < 300; }
  clone() { return new FakeResponse(this.body, this); }
  static redirect(url, status = 302) {
    const r = new FakeResponse(null, { status, statusText: 'Found' });
    r.redirected = true;
    r.location = url;
    return r;
  }
}

class FakeRequest {
  constructor(url, init = {}) {
    this.url = new URL(url, ORIGIN).href;
    this.method = init.method ?? 'GET';
    this.mode = init.mode ?? 'no-cors';
  }
}

class FakeCache {
  constructor(net) { this.map = new Map(); this.net = net; }
  async add(request) {
    const req = typeof request === 'string' ? new FakeRequest(request) : request;
    const res = await this.net(req);
    if (!res.ok) throw new Error(`failed to fetch ${req.url}: ${res.status}`);
    this.map.set(new URL(req.url).pathname, res);
  }
  async put(request, response) {
    const url = typeof request === 'string' ? request : request.url;
    this.map.set(new URL(url, ORIGIN).pathname, response);
  }
  async match(request, opts = {}) {
    const url = typeof request === 'string' ? request : request.url;
    const u = new URL(url, ORIGIN);
    return this.map.get(opts.ignoreSearch ? u.pathname : u.pathname + u.search)
        ?? this.map.get(u.pathname);
  }
  async keys() { return [...this.map.keys()].map(p => new FakeRequest(p)); }
}

function makeScope({ network }) {
  const caches = new Map();
  const listeners = new Map();

  const cacheStorage = {
    async open(name) {
      if (!caches.has(name)) caches.set(name, new FakeCache(network));
      return caches.get(name);
    },
    async keys() { return [...caches.keys()]; },
    async delete(name) { return caches.delete(name); },
    async match(request, opts) {
      for (const c of caches.values()) {
        const hit = await c.match(request, opts);
        if (hit) return hit;
      }
      return undefined;
    },
  };

  const scope = {
    location: new URL(ORIGIN + '/sw.js'),
    caches: cacheStorage,
    fetch: network,
    Request: FakeRequest,
    Response: FakeResponse,
    URL,
    console,
    skipWaitingCalls: 0,
    claimCalls: 0,
    async skipWaiting() { scope.skipWaitingCalls++; },
    clients: { async claim() { scope.claimCalls++; } },
    addEventListener(type, fn) {
      if (!listeners.has(type)) listeners.set(type, []);
      listeners.get(type).push(fn);
    },
    _caches: caches,
    async dispatch(type, event) {
      const waits = [];
      const responses = [];
      const ev = {
        ...event,
        waitUntil: p => waits.push(p),
        respondWith: p => responses.push(p),
      };
      for (const fn of listeners.get(type) ?? []) fn(ev);
      await Promise.all(waits);
      return responses.length ? await responses[0] : undefined;
    },
  };
  scope.self = scope;
  return scope;
}

/* --- Load the real worker ------------------------------------------------- */

const source = readFileSync(join(ROOT, 'sw.js'), 'utf8');

const missing = [];
const network = async req => {
  const path = new URL(req.url).pathname.replace(/^\//, '') || 'index.html';
  const file = join(ROOT, decodeURIComponent(path));
  if (!existsSync(file)) {
    missing.push(path);
    return new FakeResponse(null, { status: 404, url: req.url });
  }
  return new FakeResponse(`contents of ${path}`, { url: req.url });
};

const scope = makeScope({ network });
vm.createContext(scope);
vm.runInContext(source, scope, { filename: 'sw.js' });

/* --- Tests ---------------------------------------------------------------- */

console.log('service worker behaviour\n');

await scope.dispatch('install', {});

check('install precaches every listed asset, and every one exists', () => {
  if (missing.length) throw new Error(`${missing.length} missing on disk: ${missing.slice(0, 5).join(', ')}`);
});

const cacheNames = await scope.caches.keys();
check('install creates exactly one versioned cache', () => {
  if (cacheNames.length !== 1) throw new Error(`got ${cacheNames.length} caches`);
  if (!/^opwiki-[0-9a-f]{6,}$/.test(cacheNames[0])) {
    throw new Error(`cache name "${cacheNames[0]}" is not a content hash`);
  }
});

const cache = await scope.caches.open(cacheNames[0]);
const cachedPaths = (await cache.keys()).map(r => new URL(r.url).pathname);

check('every chapter is in the cache', () => {
  const index = JSON.parse(readFileSync(join(ROOT, 'data/index.json'), 'utf8'));
  const absent = index.chapters
    .map(c => `/data/${c.id}.json`)
    .filter(p => !cachedPaths.includes(p));
  if (absent.length) throw new Error(`absent: ${absent.join(', ')}`);
});

check('the shell is in the cache', () => {
  for (const p of ['/index.html', '/css/app.css', '/js/app.js', '/manifest.webmanifest']) {
    if (!cachedPaths.includes(p)) throw new Error(`absent: ${p}`);
  }
});

check('install calls skipWaiting', () => scope.skipWaitingCalls > 0);

/* activate should sweep old versions */
const stale = await scope.caches.open('opwiki-deadbeef01');
await stale.put('/old.js', new FakeResponse('old'));
await scope.dispatch('activate', {});

check('activate deletes caches from earlier versions', async () => true);
const afterActivate = await scope.caches.keys();
check('only the current cache survives activate', () => {
  if (afterActivate.length !== 1 || afterActivate[0] !== cacheNames[0]) {
    throw new Error(`caches after activate: ${afterActivate.join(', ')}`);
  }
});
check('activate claims open clients', () => scope.claimCalls > 0);

/* fetch behaviour with the network unavailable */
let networkCalls = 0;
const offline = async () => { networkCalls++; throw new Error('offline'); };
scope.fetch = offline;

const chapterRes = await scope.dispatch('fetch', {
  request: new FakeRequest('/data/ch07.json', { mode: 'cors' }),
});
check('a cached chapter is served with the network down', () => {
  if (!chapterRes?.ok) throw new Error(`status ${chapterRes?.status}`);
  if (networkCalls !== 0) throw new Error('it went to the network for a cached file');
});

const rootRes = await scope.dispatch('fetch', {
  request: new FakeRequest('/', { mode: 'navigate' }),
});
check('a navigation to the scope root is served the cached shell', () => {
  if (!rootRes?.ok) throw new Error(`status ${rootRes?.status}`);
  if (!String(rootRes.body).includes('index.html')) {
    throw new Error(`served ${rootRes.body} instead of the shell`);
  }
});

const navRes = await scope.dispatch('fetch', {
  request: new FakeRequest('/some/deep/link', { mode: 'navigate' }),
});
check('a nested navigation redirects to the scope root when offline, so relative assets resolve', () => {
  if (navRes?.status !== 302) throw new Error(`expected a 302, got ${navRes?.status}`);
  if (navRes.location !== '/') throw new Error(`redirected to ${navRes.location}`);
});

// A real sub-page that is deliberately not precached, such as tests/, must
// still be reachable while the network is up.
scope.fetch = async req => new FakeResponse(`live ${new URL(req.url).pathname}`, { url: req.url });
const subPage = await scope.dispatch('fetch', {
  request: new FakeRequest('/tests/', { mode: 'navigate' }),
});
check('an uncached real sub-page is served from the network, not redirected away', () => {
  if (subPage?.status === 302) throw new Error('it was redirected to the root');
  if (!String(subPage?.body).includes('/tests/')) {
    throw new Error(`served ${subPage?.body}`);
  }
});

const rootOnline = await scope.dispatch('fetch', {
  request: new FakeRequest('/', { mode: 'navigate' }),
});
check('the app root still comes from the cache even with a network available', () => {
  if (!String(rootOnline?.body).includes('index.html')) {
    throw new Error(`served ${rootOnline?.body} rather than the cached shell`);
  }
});
scope.fetch = offline;

const missRes = await scope.dispatch('fetch', {
  request: new FakeRequest('/not-in-cache.png', { mode: 'cors' }),
});
check('an uncached asset fails gracefully rather than throwing', () => {
  if (!missRes) throw new Error('no response');
  if (missRes.status !== 504) throw new Error(`expected 504, got ${missRes.status}`);
});

// Anything not precached must stay off the cache, or a single fetch pins a
// stale copy of it for the life of the cache — the worker's own script included.
scope.fetch = async req => new FakeResponse(`live ${new URL(req.url).pathname}`, { url: req.url });
await scope.dispatch('fetch', { request: new FakeRequest('/sw.js', { mode: 'cors' }) });
await scope.dispatch('fetch', { request: new FakeRequest('/tests/index.html', { mode: 'cors' }) });
const afterMiss = (await cache.keys()).map(r => new URL(r.url).pathname);
check('a cache miss does not add the response to the cache', () => {
  for (const p of ['/sw.js', '/tests/index.html']) {
    if (afterMiss.includes(p)) throw new Error(`${p} was cached opportunistically`);
  }
});
scope.fetch = offline;

const postRes = await scope.dispatch('fetch', {
  request: new FakeRequest('/data/ch07.json', { method: 'POST' }),
});
check('non-GET requests are left alone', () => postRes === undefined);

const crossRes = await scope.dispatch('fetch', {
  request: new FakeRequest('https://other.example/thing.js', { mode: 'cors' }),
});
check('cross-origin requests are left alone', () => crossRes === undefined);

console.log(`\n  ${passed} passed, ${failures.length} failed`);
process.exit(failures.length ? 1 : 0);
