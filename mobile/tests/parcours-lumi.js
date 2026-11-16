// Parcours de Lumi qui fouille, avec un faux serveur : le téléphone exécute la recherche et renvoie le résultat.
// Lancer : npm run web:export puis node tests/parcours-lumi.js (demande Playwright et Chromium).
const http=require('http'),fs=require('fs'),path=require('path');const {chromium,devices}=require('playwright');
const RAC=process.argv[2]||require('path').join(__dirname,'..','dist');const T={'.js':'text/javascript','.html':'text/html','.ttf':'font/ttf','.png':'image/png'};
const ops=[];for(let m=1;m<=10;m++){const mm=String(m).padStart(2,'0');ops.push({id:'l'+m,date:`2026-${mm}-05`,montant:-640,libelle:'PRLV SEPA LOYER AGENCE',compte_id:'cc'});if(m>=3)ops.push({id:'c'+m,date:`2026-${mm}-10`,montant:-189.9,libelle:'PRLV CETELEM CREDIT AUTO',compte_id:'cc'});ops.push({id:'s'+m,date:`2026-${mm}-28`,montant:2150,libelle:'VIR SALAIRE',compte_id:'cc'});}
(async()=>{const srv=http.createServer((q,r)=>{let f=path.join(RAC,decodeURIComponent(q.url.split('?')[0]));if(!fs.existsSync(f)||fs.statSync(f).isDirectory())f=path.join(RAC,'index.html');r.writeHead(200,{'content-type':T[path.extname(f)]||'application/octet-stream'});r.end(fs.readFileSync(f))}).listen(0);
const base=`http://127.0.0.1:${srv.address().port}`;const b=await chromium.launch();const c=await b.newContext({...devices['iPhone 14']});
const session={access_token:'faux',refresh_token:'faux',token_type:'bearer',expires_in:3600,expires_at:Math.floor(Date.now()/1000)+3600,user:{id:'u1',aud:'authenticated',role:'authenticated',is_anonymous:true}};
await c.addInitScript((s)=>localStorage.setItem('sb-yyxudhwlduznoteuddmp-auth-token',JSON.stringify(s)),session);
const recus=[];let appel=0;
await c.route('**/*',async(r)=>{const u=r.request().url();if(u.startsWith(base))return r.continue();
 const json=(o)=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(o)});
 if(u.includes('/rest/v1/profils'))return json({prenom:'Matéo',coussin:500,pret:true,situation:'salarie',objectif:'projet',style_lumi:'direct'});
 if(u.includes('/rest/v1/comptes'))return json([{id:'cc',nom:'Compte courant',type:'courant',solde:900,source:'banque',banque:'Test',inclus:true}]);
 if(u.includes('/rest/v1/operations'))return json(ops);
 if(u.includes('/rest/v1/droits'))return json(null);
 if(u.includes('/rest/v1/'))return json([]);
 if(u.includes('/functions/v1/lumi')){const corps=JSON.parse(r.request().postData());recus.push(corps);appel++;
   if(appel===1)return json({fin:'tool_use',contenu:[{type:'text',text:'Je regarde.'},{type:'tool_use',id:'t1',name:'chercher_operations',input:{mots:['LOYER'],tri:'ancien',limite:1}}]});
   const res=JSON.parse(corps.messages[corps.messages.length-1].content[0].content);
   return json({fin:'end_turn',contenu:[{type:'text',text:`Ton premier loyer : le ${res.premiere.date}, ${-res.premiere.montant} €. ${res.nombre} loyers en tout.`}]});}
 if(u.includes('/auth/v1/'))return json(session.user);
 return r.abort();});
const p=await c.newPage();const err=[];p.on('pageerror',e=>err.push(e.message));
await p.goto(base+'/');await p.waitForTimeout(3000);
await p.goto(base+'/lumi');await p.waitForTimeout(2000);
await p.getByText('Quand était mon premier loyer ?').click();await p.waitForTimeout(2500);
const t=await p.textContent('body');console.log('réponse:',(t.match(/Ton premier loyer[^.]*\.[^.]*\./)||['?'])[0]);console.log('recherches affichées:',/1 recherche dans tes comptes/.test(t));
console.log('style envoyé:',recus[0]&&recus[0].style,'| outil renvoyé au serveur:',recus[1]&&recus[1].messages.at(-1).content[0].type);
console.log('erreurs:',JSON.stringify(err));await b.close();srv.close();})();
