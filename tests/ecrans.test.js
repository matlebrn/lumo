// Parcours des écrans avec les données d'exemple (aucun compte, aucun réseau) : node --test tests/
// Demande Playwright et Chromium.
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { chromium, devices } = require('playwright');

const PUB = path.join(__dirname, '..', 'public');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.png': 'image/png', '.webmanifest': 'application/json' };
let serveur, nav, page, erreurs = [];

test.before(async () => {
  serveur = http.createServer((q, r) => {
    const f = path.join(PUB, q.url.split('?')[0] === '/' ? 'index.html' : q.url.split('?')[0]);
    if (!f.startsWith(PUB) || !fs.existsSync(f)) { r.writeHead(404); return r.end(); }
    r.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' }); r.end(fs.readFileSync(f));
  }).listen(0);
  nav = await chromium.launch();
  const ctx = await nav.newContext({ ...devices['iPhone 14'], serviceWorkers: 'block' });
  await ctx.route('**/*', (r) => (r.request().url().startsWith('http://127.0.0.1') ? r.continue() : r.abort()));
  page = await ctx.newPage();
  page.on('pageerror', (e) => erreurs.push(e.message));
  await page.goto(`http://127.0.0.1:${serveur.address().port}/?exemple`);
  await page.waitForSelector('.hero');
});
test.after(async () => { await nav.close(); serveur.close(); });

test('aujourd’hui montre les comptes, le mois en cours et les opérations', async () => {
  const t = await page.textContent('#app');
  assert.match(t, /Sur tous tes comptes/);
  assert.match(t, /Depuis ta paie du 28/);
  assert.match(t, /Tu peux encore dépenser/);
  assert.match(t, /Où part ton argent/);
  assert.ok(await page.locator('.spark path').count() >= 2);
  assert.equal(await page.locator('.groupe').count(), 3); // disponible, épargne, placements
});

test('la prévision affiche un montant et une courbe', async () => {
  await page.click('.onglets [data-v=prevision]');
  assert.match(await page.textContent('.hero .gros'), /\d.*€/);
  assert.ok(await page.locator('#courbe svg path').count() >= 2);
  assert.match(await page.textContent('#app'), /Ce qui arrive/);
  await page.click('[data-a=detail]');
  assert.equal(await page.locator('.mois-ligne').count(), 37);
  await page.click('[data-a=fermer]');
  await page.click('[data-a=horizon][data-k="120"]');
  assert.match(await page.textContent('.hero .phrase'), /10 ans/);
});

test('un projet se crée et répond en direct', async () => {
  await page.click('.onglets [data-v=projets]');
  await page.click('[data-a=nouveau-projet] >> nth=0');
  await page.click('[data-a=type-projet][data-t=achat]');
  await page.fill('[data-f=nom]', 'Voyage');
  await page.fill('[data-f="params.montant"]', '1500');
  assert.match(await page.textContent('#apercu'), /Possible dès/);
  await page.click('[data-a=choix][data-v=date]');
  await page.fill('[data-f="params.date"]', '2026-01'); // date passée : pas de plantage
  await page.click('[data-a=enregistrer-projet]');
  await page.waitForFunction(() => document.querySelectorAll('.projet').length === 3);
  // priorité : le studio passe avant la voiture, qui recule
  const avant = await page.textContent('.projet >> nth=0');
  await page.click('.projet >> nth=1');
  assert.match(await page.textContent('.feuille'), /pèsent/);
  await page.click('[data-a=deplacer][data-sens="-1"]');
  await page.click('[data-a=fermer]');
  assert.match(await page.textContent('.projet >> nth=0'), /Studio locatif/);
  assert.notEqual(await page.textContent('.projet >> nth=1'), avant);
});

test('le budget se modifie et change le reste mensuel', async () => {
  await page.click('.onglets [data-v=budget]');
  const avant = await page.textContent('.entete .sous');
  await page.click('[data-a=nouveau-flux][data-sens=revenu]');
  await page.fill('[data-f=montant]', '200');
  await page.click('[data-a=enregistrer-flux]');
  await page.waitForFunction((a) => document.querySelector('.entete .sous').textContent !== a, avant);
  assert.match((await page.textContent('.entete .sous')).replace(/\s/g, ''), /657€/);
});

test('les réglages et Lumi s’ouvrent, sans erreur de page', async () => {
  await page.click('.onglets [data-v=prevision]');
  await page.click('[data-a=reglages]');
  assert.match(await page.textContent('.feuille'), /coussin de sécurité/);
  await page.click('[data-a=fermer]');
  await page.click('.onglets [data-v=lumi]');
  await page.click('[data-a=idee] >> nth=0');
  await page.waitForSelector('.mot.lumi:not(.attente)');
  assert.deepEqual(erreurs, []);
});
