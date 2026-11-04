// Explicit opt-in: temporary accounts, owned private messages only. No checkout is allowed.
import {spawn,execFileSync} from 'node:child_process';
import {randomBytes} from 'node:crypto';
import {open,mkdir} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {createClient} from '@supabase/supabase-js';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url);require('@next/env').loadEnvConfig(process.cwd());
if(process.env.RUN_PREMIUM_E2E!=='1')throw new Error('RUN_PREMIUM_E2E=1 obligatoire');
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'/private/tmp/revanche-browser-harness/node_modules/playwright/index.mjs');
const base='http://localhost:3205',work='/private/tmp/revanche-premium-e2e';await mkdir(work,{recursive:true});
const admin=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const users=[],contexts=[];let server,browser,lastPage,checkouts=0;
async function account(name){const email=`rg-premium-audit-${Date.now()}-${name}@example.com`,password=randomBytes(24).toString('base64url')+'aA1!';const{data,error}=await admin.auth.admin.createUser({email,password,email_confirm:true,user_metadata:{username:`AuditPremium${name}`}});if(error)throw error;users.push(data.user.id);return{id:data.user.id,email,password};}
async function context(options={}){const c=await browser.newContext(options);contexts.push(c);await c.route('**/api/stripe/checkout',route=>{checkouts++;return route.abort();});return c;}
async function login(user,mobile=false){const c=await context(mobile?{viewport:{width:390,height:844},isMobile:true,hasTouch:true}:{}),page=await c.newPage();lastPage=page;await page.goto(base+'/sign-in');await page.getByLabel('Adresse e-mail').fill(user.email);await page.getByLabel('Mot de passe').fill(user.password);await page.getByRole('button',{name:'Se connecter',exact:true}).click();await page.waitForURL(url=>url.pathname==='/',{timeout:60000});await page.getByRole('heading',{name:'Accueil Revanche Games'}).waitFor();return page;}
async function noOverflow(page){assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth+1),'aucun débordement horizontal');}
try{
 const log=await open(work+'/platform.log','w');server=spawn('npm',['run','dev','--','--hostname','localhost','--port','3205'],{detached:true,env:{...process.env,INVITATION_E2E:'1',STRIPE_SITE_URL:base,NEXT_PUBLIC_SITE_URL:base,STRIPE_MODE:'test',STRIPE_SECRET_KEY:'rk_test_never_charge'},stdio:['ignore',log.fd,log.fd]});await log.close();
 let ready=false;for(let i=0;i<120;i++){try{if(execFileSync('curl',['--noproxy','*','--max-time','5','-s','-o','/dev/null','-w','%{http_code}',base],{encoding:'utf8'})==='200'){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,1000));}assert.ok(ready);
 browser=await chromium.launch({executablePath:process.env.CHROME_EXECUTABLE||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const guestContext=await context({viewport:{width:390,height:844},isMobile:true,hasTouch:true}),guest=await guestContext.newPage();lastPage=guest;
 await guest.goto('https://revanchegames-production.up.railway.app/');await guest.waitForTimeout(4500);await guest.screenshot({caret:'initial',path:work+'/before-home-mobile.png',fullPage:true});
 for(const [width,height]of[[320,568],[390,844],[768,1024],[1440,960]]){
  await guest.setViewportSize({width,height});await guest.goto(base);await guest.getByRole('heading',{name:'La Meute Noire',exact:true}).waitFor();
  await guest.getByRole('link',{name:'Jouer maintenant',exact:true}).waitFor();await noOverflow(guest);
  assert.equal(await guest.locator('[data-intro],#intro').count(),0);
  if(width<1024)assert.deepEqual(await guest.getByRole('navigation',{name:'Navigation principale'}).getByRole('link').allTextContents(),['Accueil','Jeux','Communauté','Messages','Profil']);
  if(width===390||width===1440)await guest.screenshot({caret:'initial',path:work+`/home-${width}.png`,fullPage:true});
  for(const route of['/library','/community','/messages','/profile','/shop','/settings']){await guest.goto(base+route);await guest.locator('h1:visible').first().waitFor();await noOverflow(guest);if(width===390)await guest.screenshot({caret:'initial',path:work+'/'+route.slice(1).replaceAll('/','-')+'-guest.png',fullPage:true});}
 }
 console.log('OK — accueil sans intro, cinq onglets, pages invité et desktop, aucun débordement 320/390/768/1440');
 await guest.goto(base+'/library');await guest.getByRole('textbox',{name:'Rechercher un jeu',exact:true}).fill('Bomb');await guest.getByRole('button',{name:'Lancer la recherche'}).click();await guest.waitForURL(url=>url.searchParams.get('q')==='Bomb');await guest.waitForFunction(()=>document.querySelectorAll('.rg-library-card').length===1);assert.equal(await guest.locator('.rg-library-card').count(),1);
 await guest.getByRole('button',{name:'Effacer la recherche'}).click();await guest.waitForURL(url=>!url.searchParams.has('q'));await guest.waitForFunction(()=>document.querySelectorAll('.rg-library-card').length>=17);await guest.getByRole('button',{name:'Disponibles',exact:true}).click();await guest.waitForURL('**availability=playable');await guest.waitForFunction(()=>document.querySelectorAll('.rg-library-card.is-upcoming').length===0);assert.equal(await guest.locator('.rg-library-card.is-upcoming').count(),0);
 await guest.getByRole('button',{name:'Tout le catalogue',exact:true}).click();await guest.waitForURL(url=>!url.searchParams.has('availability'));await guest.waitForFunction(()=>document.querySelectorAll('.rg-library-card').length>=17);assert.ok(await guest.locator('.rg-library-card').count()>=17);
 console.log('OK — tous les jeux conservés, recherche et filtres disponibles/à venir');
 const alice=await account('Alice'),bob=await account('Bob');const friendship=await admin.from('friendships').insert({requester_id:alice.id,addressee_id:bob.id,status:'accepted'});if(friendship.error)throw friendship.error;
 const a=await login(alice),b=await login(bob,true);lastPage=b;
 await a.goto(base+'/friends');await a.getByRole('button',{name:/^Discuter avec AuditPremiumBob/}).click();
 const dialogA=a.getByRole('dialog',{name:'Conversation avec AuditPremiumBob'});await dialogA.getByLabel('Votre message').fill('Message privé audit premium');await dialogA.getByRole('button',{name:'Envoyer',exact:true}).click();await dialogA.getByText('Message privé audit premium',{exact:true}).waitFor();
 await b.goto(base+'/messages');await b.getByRole('button',{name:/^Conversation avec AuditPremiumAlice/}).waitFor();await b.screenshot({caret:'initial',path:work+'/messages-mobile.png',fullPage:true});
 await b.getByRole('button',{name:/^Conversation avec AuditPremiumAlice/}).click();const dialogB=b.getByRole('dialog',{name:'Conversation avec AuditPremiumAlice'});await dialogB.getByText('Message privé audit premium',{exact:true}).waitFor();
 assert.ok(new URL(b.url()).searchParams.has('with'));await b.screenshot({caret:'initial',path:work+'/conversation-mobile.png'});
 await b.goBack();await dialogB.waitFor({state:'detached'});await b.getByRole('button',{name:/^Conversation avec AuditPremiumAlice/}).click();await dialogB.waitFor();
 await b.setViewportSize({width:390,height:430});await b.waitForFunction(()=>{const el=document.querySelector('[aria-label="Votre message"]');return el&&el.getBoundingClientRect().bottom<=innerHeight;});await noOverflow(b);
 await dialogB.getByLabel('Votre message').fill('Réponse après ouverture du clavier');await dialogB.getByRole('button',{name:'Envoyer',exact:true}).click();await dialogA.getByText('Réponse après ouverture du clavier',{exact:true}).waitFor();await b.setViewportSize({width:390,height:844});
 await dialogB.getByRole('button',{name:'Fermer la conversation'}).click();await b.getByRole('button',{name:'Groupes',exact:true}).click();await b.getByRole('button',{name:'Créer un groupe',exact:true}).waitFor();
 await b.goto(base+'/profile');await b.getByRole('button',{name:'Ajouter une couverture'}).waitFor();await noOverflow(b);assert.equal(await b.locator('table').count(),0);await b.screenshot({caret:'initial',path:work+'/profile-mobile.png',fullPage:true});
 const unauthBanner=await guest.context().request.post(base+'/api/profile/banner');assert.equal(unauthBanner.status(),401);
 let bannerUploadBytes=0;await b.route('**/api/profile/banner',async route=>{bannerUploadBytes=route.request().postDataBuffer()?.length??0;await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({url:'/images/la-meute-hero-refonte.webp'})});});
 await b.locator('input[aria-label="Choisir une bannière"]').setInputFiles('public/games/la-meute-cover.webp');const cropDialog=b.getByRole('dialog',{name:'Recadrer la bannière'});await cropDialog.waitFor();await cropDialog.getByRole('button',{name:'Enregistrer la couverture'}).click();await b.getByRole('button',{name:'Changer la couverture'}).waitFor();assert.ok(bannerUploadBytes>1000,'le recadrage fournit une image au serveur');
 await b.getByRole('button',{name:/^Notifications/}).click();await b.getByRole('region',{name:'Notifications',exact:true}).waitFor();await noOverflow(b);await b.getByRole('region',{name:'Notifications',exact:true}).getByRole('button',{name:'Fermer',exact:true}).click();
 console.log('OK — connexion directe à l’accueil, MP réel et réponse, non-lus, retour navigateur, champ accessible à 430px, groupes et profil');
 await b.goto(base+'/messages');await b.getByRole('button',{name:/^Conversation avec AuditPremiumAlice/}).click();await dialogB.waitFor();
 await b.context().setOffline(true);await dialogA.getByLabel('Votre message').fill('Message envoyé pendant la coupure');await dialogA.getByRole('button',{name:'Envoyer',exact:true}).click();await b.context().setOffline(false);await b.evaluate(()=>window.dispatchEvent(new Event('pageshow')));await dialogB.getByText('Message envoyé pendant la coupure',{exact:true}).waitFor({timeout:30000});
 console.log('OK — réconciliation de la messagerie au retour du réseau sans perte du message');
 await guest.setViewportSize({width:390,height:844});await guest.goto(base+'/play/bombshift');await guest.locator('iframe.rg-game-frame').waitFor();const element=await guest.locator('iframe.rg-game-frame').elementHandle();const frame=await element.contentFrame();await frame.getByRole('button',{name:'JOUER',exact:true}).waitFor({timeout:60000});
 const src=await element.getAttribute('src');let navigations=0;guest.on('framenavigated',f=>{if(f===frame)navigations++;});
 const cdp=await guest.context().newCDPSession(guest);await cdp.send('Page.setWebLifecycleState',{state:'frozen'});await new Promise(r=>setTimeout(r,1500));await cdp.send('Page.setWebLifecycleState',{state:'active'});await guest.evaluate(()=>window.dispatchEvent(new Event('pageshow')));
 assert.equal(await element.getAttribute('src'),src);assert.equal(navigations,0);await frame.getByRole('button',{name:'JOUER',exact:true}).click();await frame.locator('#map-list .map-card').first().waitFor();
 await guest.getByRole('button',{name:'Retour à l’accueil',exact:true}).click();await guest.getByRole('heading',{name:'La Meute Noire',exact:true}).waitFor();assert.equal(await element.getAttribute('src'),src);assert.equal(navigations,0);
 await guest.goto(base+'/recent');await guest.getByRole('link',{name:'Jouer à BombShift',exact:true}).waitFor();
 console.log('OK — retour après gel/reprise du navigateur, iframe conservée sans rechargement, jeu utilisable et historique réel');
 assert.equal(checkouts,0,'aucun appel de paiement');
 console.log('OK — aucun checkout ni débit réel');
}catch(error){if(lastPage)await lastPage.screenshot({caret:'initial',path:work+'/failure.png',fullPage:true}).catch(()=>{});throw error;}
finally{await browser?.close();for(const id of users){const{error}=await admin.auth.admin.deleteUser(id);if(error)console.error('Nettoyage compte temporaire à reprendre :',id);}if(server?.pid)try{process.kill(-server.pid,'SIGTERM');}catch{}}
