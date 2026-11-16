// Première ouverture, avec un faux serveur : choix, création de l'espace, proposition de connecter sa banque, « Plus tard ».
// Lancer : npm run web:export puis node tests/parcours-accueil.js [dossier] (demande Playwright et Chromium).
const http=require('http'),fs=require('fs'),path=require('path');const {chromium,devices}=require('playwright');
const RAC=process.argv[2]||path.join(__dirname,'..','dist');const T={'.js':'text/javascript','.html':'text/html','.ttf':'font/ttf','.png':'image/png'};
(async()=>{const srv=http.createServer((q,r)=>{let f=path.join(RAC,decodeURIComponent(q.url.split('?')[0]));if(!fs.existsSync(f)||fs.statSync(f).isDirectory())f=path.join(RAC,'index.html');r.writeHead(200,{'content-type':T[path.extname(f)]||'application/octet-stream'});r.end(fs.readFileSync(f))}).listen(0);
const base=`http://127.0.0.1:${srv.address().port}`;const b=await chromium.launch();const c=await b.newContext({...devices['iPhone 14']});
const user={id:'u1',aud:'authenticated',role:'authenticated',is_anonymous:true};
const session={access_token:'faux',refresh_token:'faux',token_type:'bearer',expires_in:3600,expires_at:Math.floor(Date.now()/1000)+3600,user};
const vus=[];
await c.route('**/*',async(r)=>{const u=r.request().url();if(u.startsWith(base))return r.continue();
 const json=(o,s=200)=>r.fulfill({status:s,contentType:'application/json',body:JSON.stringify(o)});
 if(u.includes('/auth/v1/signup'))return json(session);
 if(u.includes('/auth/v1/user'))return json(user);
 if(u.includes('/rest/v1/profils')&&r.request().method()==='POST'){vus.push('profil '+r.request().postData());return json(null,201);}
 if(u.includes('/rest/v1/profils'))return json({pret:true,situation:'salarie',objectif:'finDeMois',style_lumi:'expert'});
 if(u.includes('/rest/v1/eb_banks'))return json([{name:'Caisse d’Épargne'},{name:'Crédit Agricole'},{name:'Boursorama'}]);
 if(u.includes('/rest/v1/droits'))return json(null);
 if(u.includes('/rest/v1/'))return json([]);
 if(u.includes('/functions/v1/bank/u/banques')){vus.push('banques');return json({ok:true});}
 if(u.includes('/functions/v1/bank/u/connecter')){vus.push('connecter '+r.request().postData());return json({ok:false,code:'pas_activee'},503);}
 return r.abort();});
const p=await c.newPage();const err=[];p.on('pageerror',e=>err.push(e.message));
await p.goto(base+'/');await p.waitForTimeout(2500);
await p.getByText('Salarié').click();await p.getByText('Finir le mois sereinement').click();await p.getByText('Expert sobre').click();
await p.getByText('Commencer',{exact:true}).click();await p.waitForTimeout(2500);
const t1=await p.textContent('body');console.log('page banque proposée :',/Connecte ta banque/.test(t1),'| banques listées :',/Crédit Agricole/.test(t1));
await p.screenshot({path:'/home/claude/captures/mobile/9-banque.png'});
await p.getByPlaceholder('Chercher ma banque').fill('crédit');await p.waitForTimeout(300);
console.log('recherche filtre :',!(/Boursorama/.test(await p.textContent('body'))));
await p.getByText('Crédit Agricole').click();await p.waitForTimeout(800);
console.log('message si banque pas activée :',/pas encore activée/.test(await p.textContent('body')));
await p.getByText('Plus tard').click();await p.waitForTimeout(1500);
const t2=await p.textContent('body');console.log('arrivée sur Aujourd’hui avec la carte banque :',/Connecter ma banque/.test(t2));
console.log('appels :',vus.join(' | '));console.log('erreurs :',JSON.stringify(err));await b.close();srv.close();})();
