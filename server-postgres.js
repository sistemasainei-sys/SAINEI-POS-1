'use strict';
/* SAINEI POS PostgreSQL backend. Legacy SQLite remains available for local installs without DATABASE_URL. */
const http=require('http'),fs=require('fs'),path=require('path'),crypto=require('crypto'),os=require('os');
const {Pool}=require('pg');
const PORT=Number(process.env.PORT||process.env.SAINEI_PORT||8080),ROOT=__dirname;
const APP=path.resolve(fs.existsSync(path.join(ROOT,'index.html'))?path.join(ROOT,'index.html'):path.join(ROOT,'app','index.html'));
const DEMO=process.argv.includes('--demo'),MAXB=25*1024*1024;
const pool=new Pool({connectionString:process.env.DATABASE_URL,ssl:process.env.PGSSLMODE==='disable'?false:{rejectUnauthorized:false},max:10});
const log=m=>console.log(new Date().toISOString()+' '+m),nowIso=()=>new Date().toISOString();
const COLLS={products:'prod',sales:'sale',clients:'client',purchases:'purch',payments:'pay',expenses:'exp',shifts:'shift',moves:'move',spay:'spay',budgets:'budget'};
const ORDER=['products','clients','budgets','purchases','expenses','spay','shifts','sales','payments','moves'];
const SING=['shop','scale','print','scan','sec','check'],DELETABLE={products:1,clients:1};
const PERM={cajero:{sales:{ins:1},moves:{ins:1},clients:{ins:1,upd:1},budgets:{ins:1,upd:1},payments:{ins:1},shifts:{ins:1,upd:1}},encargado:{products:{ins:1,upd:1,del:1},sales:{ins:1,upd:1},clients:{ins:1,upd:1,del:1},budgets:{ins:1,upd:1},purchases:{ins:1,upd:1},payments:{ins:1},expenses:{ins:1,upd:1},shifts:{ins:1,upd:1},moves:{ins:1},spay:{ins:1,upd:1}}};
const round3=n=>Math.round(n*1000)/1000,ROLES=['admin','encargado','cajero'];
const LICENSE_PUBLIC_KEY=`-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAoaGt4FXqgVp3aehlIJGh
Job3e1PkuucaLpICYHHIlId4TfO1RbYO2pjo7OYBvNE1sGAgiTyWYgIo78ojGqh/
BobbJuYRo7uqMK0Twf7qEUlHeZSUVLowkRt3a2ga+9blMuuBGrhCWmJ8XVPV7cDv
BEX85l4c+0ev8bbyYo/nxBhsa8g0OdeX36Qog749mh04+jN7PhkoUWSH4RGP2y/i
G27FPmXlmXdyiQdOm+hj4kT11gNIyHCkZ/RklF+EGTPR5jTCnnoR5WegMM6Wh56M
Vj1lHKEcgIdrkMFwGfI1RbmLYIH2X9JBD59IZicO5x13ywqKC8LTUKMC/JpyjNwM
hwIDAQAB
-----END PUBLIC KEY-----`;
const sessions=new Map(),fails=new Map(),SES_MS=12*3600*1000;
const hashPin=(pin,salt)=>crypto.scryptSync(String(pin),salt,32).toString('hex');
function mkPin(pin){const salt=crypto.randomBytes(16).toString('hex');return {salt,hash:hashPin(pin,salt)}}
function checkPin(u,pin){if(!u||!u.salt||!u.hash)return false;const a=Buffer.from(hashPin(pin,u.salt),'hex'),b=Buffer.from(u.hash,'hex');return a.length===b.length&&crypto.timingSafeEqual(a,b)}
const weakPin=p=>String(p).length<4||/^(.)\1+$/.test(p)||['1234','12345','123456','0123','4321'].includes(p);
const pubUser=u=>({id:Number(u.id),name:u.name,role:u.role,active:!!u.active});
const normCode=c=>String(c||'').toUpperCase().replace(/[^A-Z0-9]/g,'');
function newRecCode(){const al='ABCDEFGHJKLMNPQRSTUVWXYZ23456789',b=crypto.randomBytes(16);let o='';for(let i=0;i<16;i++){o+=al[b[i]%al.length];if(i%4===3&&i<15)o+='-';}return o}
const q=(s,v=[])=>pool.query(s,v);
async function meta(k){const r=await q('SELECT v FROM sainei_pos_meta WHERE k=$1',[k]);return r.rowCount?r.rows[0].v:null}
async function setMeta(k,v){await q('INSERT INTO sainei_pos_meta(k,v) VALUES($1,$2) ON CONFLICT(k) DO UPDATE SET v=EXCLUDED.v',[k,String(v)])}
async function allUsers(){return (await q('SELECT * FROM sainei_pos_users ORDER BY id')).rows}
async function hasAdmin(){return (await q("SELECT 1 FROM sainei_pos_users WHERE role='admin' AND active=true LIMIT 1")).rowCount>0}
async function audit(who,what,client=pool){await client.query('INSERT INTO sainei_pos_audit(t,u,a) VALUES($1,$2,$3)',[nowIso(),String(who||'-').slice(0,60),String(what||'').slice(0,300)])}
async function init(){
 await q(`CREATE TABLE IF NOT EXISTS sainei_pos_meta(k TEXT PRIMARY KEY,v TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS sainei_pos_records(coll TEXT NOT NULL,id BIGINT NOT NULL,j JSONB NOT NULL,rev BIGINT NOT NULL,del BOOLEAN NOT NULL DEFAULT FALSE,PRIMARY KEY(coll,id));
 CREATE INDEX IF NOT EXISTS sainei_pos_records_rev ON sainei_pos_records(rev);
 CREATE TABLE IF NOT EXISTS sainei_pos_settings(k TEXT PRIMARY KEY,j JSONB NOT NULL,rev BIGINT NOT NULL);
 CREATE TABLE IF NOT EXISTS sainei_pos_counters(kind TEXT PRIMARY KEY,n BIGINT NOT NULL);
 CREATE TABLE IF NOT EXISTS sainei_pos_users(id BIGINT PRIMARY KEY,name TEXT NOT NULL,role TEXT NOT NULL,active BOOLEAN NOT NULL,salt TEXT,hash TEXT);
 CREATE TABLE IF NOT EXISTS sainei_pos_audit(id BIGSERIAL PRIMARY KEY,t TEXT,u TEXT,a TEXT);
 CREATE TABLE IF NOT EXISTS sainei_pos_backups(name TEXT PRIMARY KEY,at TEXT NOT NULL,state JSONB NOT NULL);`);
 if(!await meta('installId'))await setMeta('installId',crypto.randomBytes(12).toString('hex').toUpperCase());
 if(!await meta('epoch'))await setMeta('epoch',crypto.randomBytes(6).toString('hex'));
 if(!await meta('rev'))await setMeta('rev','0');
}
let INSTALL_ID='';
async function licenseState(){
 const raw=await meta('licenseToken');if(!raw)return {active:false,installId:INSTALL_ID};
 try{const p=raw.split('.');if(p.length!==2)throw 0;const payload=Buffer.from(p[0],'base64url').toString('utf8'),sig=Buffer.from(p[1],'base64url');if(!crypto.verify('RSA-SHA256',Buffer.from(p[0]),LICENSE_PUBLIC_KEY,sig))throw 0;const d=JSON.parse(payload);if(d.installId!==INSTALL_ID)throw 0;if(d.type==='monthly'&&(!d.expiresAt||Date.now()>d.expiresAt))return {active:false,expired:true,installId:INSTALL_ID,type:d.type,expiresAt:d.expiresAt};if(!['permanent','monthly'].includes(d.type))throw 0;return {active:true,installId:INSTALL_ID,type:d.type,expiresAt:d.expiresAt||null,customer:d.customer||''}}catch{return {active:false,invalid:true,installId:INSTALL_ID}}
}
function newSession(u){const t=crypto.randomBytes(24).toString('hex');sessions.set(t,{uid:Number(u.id),name:u.name,role:u.role,exp:Date.now()+SES_MS});return t}
function auth(req){const h=req.headers.authorization||'',t=h.startsWith('Bearer ')?h.slice(7):'',s=sessions.get(t);if(!s||s.exp<Date.now())return null;s.exp=Date.now()+SES_MS;return Object.assign({token:t},s)}
function failWait(k){const f=fails.get(k);return f&&f.until>Date.now()?Math.ceil((f.until-Date.now())/1000):0}
function failAdd(k){const f=fails.get(k)||{n:0,until:0};f.n++;if(f.n>=5)f.until=Date.now()+Math.min(300,30*Math.pow(2,f.n-5))*1000;fails.set(k,f);return f.n}
const failClear=k=>fails.delete(k);
function readBody(req){return new Promise((resolve,reject)=>{const a=[];let n=0;req.on('data',d=>{n+=d.length;if(n>MAXB){reject(Object.assign(new Error('Demasiado grande'),{code:413}));req.destroy()}else a.push(d)});req.on('end',()=>{try{resolve(a.length?JSON.parse(Buffer.concat(a).toString('utf8')):{})}catch{reject(Object.assign(new Error('JSON invalido'),{code:400}))}});req.on('error',reject)})}
function send(res,code,obj,extra){res.writeHead(code,Object.assign({'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'},extra||{}));res.end(typeof obj==='string'?obj:JSON.stringify(obj))}
const fail=(res,code,msg,more)=>send(res,code,Object.assign({error:msg},more||{}));
async function getRec(coll,id,client=pool){const r=await client.query('SELECT j,del FROM sainei_pos_records WHERE coll=$1 AND id=$2',[coll,id]);return r.rowCount?r.rows[0]:null}
async function putRec(coll,id,obj,rev,del,client=pool){await client.query('INSERT INTO sainei_pos_records(coll,id,j,rev,del) VALUES($1,$2,$3::jsonb,$4,$5) ON CONFLICT(coll,id) DO UPDATE SET j=EXCLUDED.j,rev=EXCLUDED.rev,del=EXCLUDED.del',[coll,id,JSON.stringify(obj),rev,!!del])}
async function bumpCounter(kind,id,client=pool){await client.query('INSERT INTO sainei_pos_counters(kind,n) VALUES($1,$2) ON CONFLICT(kind) DO UPDATE SET n=GREATEST(sainei_pos_counters.n,EXCLUDED.n)',[kind,id])}
function allowed(user,coll,op,rec,existing){if(user.role==='admin')return true;const p=(PERM[user.role]||{})[coll];if(!p||!p[op])return false;if(coll==='moves'&&user.role==='cajero'&&!(rec.type==='venta'&&Number(rec.qty)<0))return false;if(coll==='shifts'&&user.role==='cajero'){if(op==='ins'&&rec.uid!==user.uid)return false;if(op==='upd'&&existing&&existing.uid&&existing.uid!==user.uid)return false}return true}
async function collect(since,rejected){
 const recs={},dels={},sing={};
 for(const coll of Object.keys(COLLS)){recs[coll]=[];dels[coll]=[];const r=await q('SELECT id,j,del FROM sainei_pos_records WHERE coll=$1 AND rev>$2',[coll,since]);for(const x of r.rows){if(x.del){if(since>0)dels[coll].push(Number(x.id))}else recs[coll].push(x.j)}}
 const sr=await q('SELECT k,j FROM sainei_pos_settings WHERE rev>$1',[since]);for(const x of sr.rows)sing[x.k]=x.j;
 for(const x of (rejected||[])){if(x.sing){const r=await q('SELECT j FROM sainei_pos_settings WHERE k=$1',[x.sing]);if(r.rowCount)sing[x.sing]=r.rows[0].j;continue}const row=await getRec(x.coll,x.id);if(row&&!row.del){if(!recs[x.coll].some(o=>o.id===x.id))recs[x.coll].push(row.j)}else dels[x.coll].push(x.id)}
 return {recs,dels,sing}
}
async function processSync(user,body){
 const client=await pool.connect(),res={rejected:[]};let rev=Number(await meta('rev')||0),wrote=false;
 const R=()=>{if(!wrote){wrote=true;rev++}return rev};
 try{
 await client.query('BEGIN');
 const changes=body.changes||{};
 for(const coll of ORDER){const c=changes[coll];if(!c)continue;const kind=COLLS[coll];
  for(const rec of (Array.isArray(c.up)?c.up:[])){const id=Number(rec&&rec.id);if(!rec||!Number.isInteger(id)||id<=0){res.rejected.push({coll,id});continue}
   const row=await getRec(coll,id,client);if(row&&row.del){res.rejected.push({coll,id});continue}
   const ex=row?row.j:null,op=ex?'upd':'ins';if(!allowed(user,coll,op,rec,ex)){res.rejected.push({coll,id});continue}
   let out=rec;if(coll==='products')out=Object.assign({},rec,{stock:ex?ex.stock:0});else if(coll==='sales'&&ex){if(ex.void||!rec.void)continue;out=Object.assign({},ex,{void:true,voidBy:String(rec.voidBy||user.name)})}else if((coll==='payments'||coll==='moves')&&ex)continue;else if(coll==='clients'&&user.role==='cajero')out=Object.assign({},rec,{limit:ex?ex.limit:0});if(coll==='sales'&&!ex)out=Object.assign({},rec,{uname:rec.uname||user.name});
   await putRec(coll,id,out,R(),false,client);await bumpCounter(kind,id,client);
   if(coll==='moves'&&!ex){const pr=await getRec('products',Number(rec.pid),client);if(pr&&!pr.del){const p=pr.j;p.stock=Math.max(0,round3((p.stock||0)+Number(rec.qty||0)));await putRec('products',p.id,p,R(),false,client)}}
  }
  for(const id0 of (Array.isArray(c.del)?c.del:[])){const id=Number(id0),row=await getRec(coll,id,client);if(!row||row.del)continue;if(!DELETABLE[coll]||!allowed(user,coll,'del',{},null)){res.rejected.push({coll,id});continue}await client.query('UPDATE sainei_pos_records SET del=true,rev=$1 WHERE coll=$2 AND id=$3',[R(),coll,id])}
 }
 if(body.sing&&typeof body.sing==='object')for(const k of SING){if(!(k in body.sing))continue;if(user.role!=='admin'){res.rejected.push({sing:k});continue}const v=Object.assign({},body.sing[k]);if(k==='sec')delete v.rec;await client.query('INSERT INTO sainei_pos_settings(k,j,rev) VALUES($1,$2::jsonb,$3) ON CONFLICT(k) DO UPDATE SET j=EXCLUDED.j,rev=EXCLUDED.rev',[k,JSON.stringify(v),R()])}
 for(const e of (Array.isArray(body.audit)?body.audit.slice(0,200):[]))await audit(user.name,e&&e.a,client);
 if(wrote)await client.query("INSERT INTO sainei_pos_meta(k,v) VALUES('rev',$1) ON CONFLICT(k) DO UPDATE SET v=EXCLUDED.v",[String(rev)]);
 await client.query('COMMIT');return res
 }catch(e){await client.query('ROLLBACK');throw e}finally{client.release()}
}
async function fullState(){const c=await collect(0,null),st={v:2,exportedAt:nowIso()};Object.assign(st,c.sing,c.recs);st.users=(await allUsers()).map(pubUser);return st}
async function resetEpoch(){await setMeta('epoch',crypto.randomBytes(6).toString('hex'))}
async function restoreJson(s){
 const client=await pool.connect();try{await client.query('BEGIN');const rev=Number(await meta('rev')||0)+1;await client.query('DELETE FROM sainei_pos_records');for(const coll of Object.keys(COLLS))for(const rec of (Array.isArray(s[coll])?s[coll]:[])){const id=Number(rec&&rec.id);if(!Number.isInteger(id)||id<=0)continue;await putRec(coll,id,rec,rev,false,client);await bumpCounter(COLLS[coll],id,client)}for(const k of SING)if(s[k]&&typeof s[k]==='object'){const v=Object.assign({},s[k]);if(k==='sec')delete v.rec;await client.query('INSERT INTO sainei_pos_settings(k,j,rev) VALUES($1,$2::jsonb,$3) ON CONFLICT(k) DO UPDATE SET j=EXCLUDED.j,rev=EXCLUDED.rev',[k,JSON.stringify(v),rev])}await client.query("INSERT INTO sainei_pos_meta(k,v) VALUES('rev',$1) ON CONFLICT(k) DO UPDATE SET v=EXCLUDED.v",[String(rev)]);await client.query('COMMIT');await resetEpoch()}catch(e){await client.query('ROLLBACK');throw e}finally{client.release()}
}
async function backup(name){const state=await fullState(),nm=name||'manual-'+Date.now();await q('INSERT INTO sainei_pos_backups(name,at,state) VALUES($1,$2,$3::jsonb) ON CONFLICT(name) DO NOTHING',[nm,nowIso(),JSON.stringify(state)]);await setMeta('lastBackup',nowIso());return nm}
async function info(){const sh=await q("SELECT j FROM sainei_pos_settings WHERE k='shop'");return {server:true,demo:DEMO,version:1,hasAdmin:await hasAdmin(),shopName:sh.rowCount?(sh.rows[0].j.name||''):'',users:(await allUsers()).filter(u=>u.active).map(pubUser),lastBackup:await meta('lastBackup')}}
const CT={'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.png':'image/png','.ico':'image/x-icon','.svg':'image/svg+xml'};
async function handle(req,res){
 const url=new URL(req.url,'http://x'),p=url.pathname,m=req.method,ip=(req.socket.remoteAddress||'').replace('::ffff:','');
 if(!p.startsWith('/api/')){if(m!=='GET'&&m!=='HEAD')return fail(res,405,'Metodo no permitido');if(p==='/'||p==='/index.html'){if(!fs.existsSync(APP))return fail(res,500,'Falta index.html');res.writeHead(200,{'Content-Type':CT['.html'],'Cache-Control':'no-store'});return res.end(fs.readFileSync(APP))}if(/^\/sainei-mod-[a-z0-9_-]+\.js$/i.test(p)){const f=path.join(ROOT,p.slice(1));if(!fs.existsSync(f))return fail(res,404,'Modulo no encontrado');res.writeHead(200,{'Content-Type':'text/javascript; charset=utf-8','Cache-Control':'no-cache'});return res.end(fs.readFileSync(f))}const ST={'/manifest.webmanifest':'application/manifest+json','/sw.js':'text/javascript; charset=utf-8','/icon-192.png':'image/png','/icon-512.png':'image/png','/icon-maskable-512.png':'image/png','/apple-touch-icon.png':'image/png'};if(ST[p]){const f=path.join(path.dirname(APP),p.slice(1));if(!fs.existsSync(f))return fail(res,404,'No encontrado');res.writeHead(200,{'Content-Type':ST[p],'Cache-Control':'no-cache','Service-Worker-Allowed':'/'});return res.end(fs.readFileSync(f))}if(p==='/favicon.ico'){res.writeHead(204);return res.end()}return fail(res,404,'No encontrado')}
 if(p==='/api/ping')return send(res,200,{ok:true,server:true,database:'postgresql'});
 if(p==='/api/modules'&&m==='GET'){const modules=fs.readdirSync(ROOT).filter(f=>/^sainei-mod-[a-z0-9_-]+\.js$/i.test(f)).sort();return send(res,200,{modules})}
 if(p==='/api/license/status'&&m==='GET')return send(res,200,await licenseState());
 if(p==='/api/license/activate'&&m==='POST'){const b=await readBody(req),token=String(b.code||'').trim(),parts=token.split('.');if(parts.length!==2)return fail(res,400,'Código de activación inválido.');try{const payload=Buffer.from(parts[0],'base64url').toString('utf8'),sig=Buffer.from(parts[1],'base64url');if(!crypto.verify('RSA-SHA256',Buffer.from(parts[0]),LICENSE_PUBLIC_KEY,sig))return fail(res,400,'Código no válido.');const d=JSON.parse(payload);if(d.installId!==INSTALL_ID)return fail(res,400,'Este código pertenece a otra instalación.');if(!['permanent','monthly'].includes(d.type))return fail(res,400,'Tipo de licencia inválido.');if(d.type==='monthly'&&(!d.expiresAt||Date.now()>d.expiresAt))return fail(res,400,'La licencia mensual ya venció.');await setMeta('licenseToken',token);await audit('LICENCIA','Activación '+d.type+' para '+String(d.customer||'cliente'));return send(res,200,{ok:true,license:await licenseState()})}catch{return fail(res,400,'No se pudo verificar el código.')}}
 if(p==='/api/info'&&m==='GET')return send(res,200,await info());
 if(p==='/api/setup'&&m==='POST'){if(!(await licenseState()).active)return fail(res,403,'Activá SAINEI POS con tu código de licencia.');const b=await readBody(req);if(await hasAdmin())return fail(res,409,'Ya existe un usuario principal.');const name=String(b.name||'').trim().slice(0,40),pin=String(b.pin||'');if(!name)return fail(res,400,'Escribí el nombre.');if(weakPin(pin))return fail(res,400,'La clave es muy fácil. Usá al menos 4 caracteres y evita 1234 o repetidos.');const code=newRecCode(),rc=mkPin(normCode(code)),client=await pool.connect();let id;try{await client.query('BEGIN');const r=await client.query("INSERT INTO sainei_pos_counters(kind,n) VALUES('user',1) ON CONFLICT(kind) DO UPDATE SET n=sainei_pos_counters.n+1 RETURNING n");id=Number(r.rows[0].n);const k=mkPin(pin);await client.query('INSERT INTO sainei_pos_users(id,name,role,active,salt,hash) VALUES($1,$2,$3,true,$4,$5)',[id,name,'admin',k.salt,k.hash]);await client.query('COMMIT')}catch(e){await client.query('ROLLBACK');throw e}finally{client.release()}await setMeta('recSalt',rc.salt);await setMeta('recHash',rc.hash);await audit(name,'Creó el usuario principal');return send(res,200,{ok:true,code,userId:id})}
 if(p==='/api/login'&&m==='POST'){if(!(await licenseState()).active)return fail(res,403,'La licencia no está activa.');const b=await readBody(req),uid=Number(b.userId),key=ip+'|'+uid,w=failWait(key);if(w>0)return fail(res,429,'Demasiados intentos. Esperá '+w+' segundos.',{wait:w});const u=(await q('SELECT * FROM sainei_pos_users WHERE id=$1',[uid])).rows[0];if(!u||!u.active||!checkPin(u,String(b.pin||''))){const n=failAdd(key);await audit(u?u.name:'-','Clave incorrecta (intento '+n+')');const w2=failWait(key);return fail(res,401,w2>0?'Demasiados intentos. Esperá '+w2+' segundos.':'Clave incorrecta.',{wait:w2})}failClear(key);const t=newSession(u);await audit(u.name,'Ingreso al sistema ('+ip+')');return send(res,200,{token:t,user:pubUser(u)})}
 if(p==='/api/recover'&&m==='POST'){const b=await readBody(req),uid=Number(b.userId),key=ip+'|rec',w=failWait(key);if(w>0)return fail(res,429,'Demasiados intentos. Esperá '+w+' segundos.',{wait:w});const u=(await q('SELECT * FROM sainei_pos_users WHERE id=$1',[uid])).rows[0],rc={salt:await meta('recSalt'),hash:await meta('recHash')};if(!u||u.role!=='admin'||!u.active||!checkPin(rc,normCode(b.code))){failAdd(key);await audit(u?u.name:'-','Código de recuperación incorrecto');return fail(res,401,'El código no es correcto.')}if(weakPin(String(b.pin||'')))return fail(res,400,'La clave nueva es muy fácil.');failClear(key);const k=mkPin(String(b.pin));await q('UPDATE sainei_pos_users SET salt=$1,hash=$2 WHERE id=$3',[k.salt,k.hash,uid]);await audit(u.name,'Cambió su clave con el código de recuperación');return send(res,200,{ok:true})}
 const me=auth(req);if(!me)return fail(res,401,'Sesión vencida');const admin=me.role==='admin';
 if(p==='/api/logout'&&m==='POST'){sessions.delete(me.token);return send(res,200,{ok:true})}
 if(p==='/api/me'&&m==='GET')return send(res,200,{user:{id:me.uid,name:me.name,role:me.role}})
 if(p==='/api/ids'&&m==='GET'){const kind=url.searchParams.get('kind'),n=Math.min(500,Math.max(1,parseInt(url.searchParams.get('n')||'1',10)));if(!Object.values(COLLS).includes(kind))return fail(res,400,'Tipo inválido');const r=await q('INSERT INTO sainei_pos_counters(kind,n) VALUES($1,$2) ON CONFLICT(kind) DO UPDATE SET n=sainei_pos_counters.n+EXCLUDED.n RETURNING n',[kind,n]);return send(res,200,{start:Number(r.rows[0].n)-n+1,end:Number(r.rows[0].n)})}
 if(p==='/api/sync'&&m==='POST'){const b=await readBody(req),since=Math.max(0,parseInt(b.since||0,10)||0),epoch=await meta('epoch'),rev=Number(await meta('rev')||0);if(b.epoch&&b.epoch!==epoch){const c=await collect(0,null);return send(res,200,{reset:true,rev,epoch,recs:c.recs,dels:c.dels,sing:c.sing,lastBackup:await meta('lastBackup')})}const r=await processSync({uid:me.uid,name:me.name,role:me.role},b),c=await collect(since,r.rejected);return send(res,200,{rev:Number(await meta('rev')||0),epoch,recs:c.recs,dels:c.dels,sing:c.sing,rejected:r.rejected,lastBackup:await meta('lastBackup')})}
 if(p==='/api/mypin'&&m==='POST'){const b=await readBody(req),u=(await q('SELECT * FROM sainei_pos_users WHERE id=$1',[me.uid])).rows[0];if(!checkPin(u,String(b.old||'')))return fail(res,400,'La clave actual no es correcta.');if(weakPin(String(b.pin||'')))return fail(res,400,'La clave nueva es muy fácil.');const k=mkPin(String(b.pin));await q('UPDATE sainei_pos_users SET salt=$1,hash=$2 WHERE id=$3',[k.salt,k.hash,me.uid]);await audit(me.name,'Cambió su clave');return send(res,200,{ok:true})}
 if(!admin)return fail(res,403,'Solo el usuario principal puede hacer esto.');
 if(p==='/api/users'&&m==='GET')return send(res,200,{users:(await allUsers()).map(pubUser)});
 if(p==='/api/users'&&m==='POST'){const b=await readBody(req),name=String(b.name||'').trim().slice(0,40),role=String(b.role),pin=String(b.pin||''),id=b.id?Number(b.id):0,ex=id?(await q('SELECT * FROM sainei_pos_users WHERE id=$1',[id])).rows[0]:null,active=b.active===false?false:true;if(!name)return fail(res,400,'Escribí el nombre.');if(!ROLES.includes(role))return fail(res,400,'Tipo inválido.');if((await allUsers()).some(o=>o.name.toLowerCase()===name.toLowerCase()&&(!ex||Number(o.id)!==Number(ex.id))))return fail(res,400,'Ya existe un usuario con ese nombre.');if((!ex&&weakPin(pin))||(ex&&pin&&weakPin(pin)))return fail(res,400,'La clave es muy fácil.');if(ex){if(ex.id===me.uid&&(role!=='admin'||!active))return fail(res,400,'No podés quitarte tu propio permiso.');if(ex.role==='admin'&&ex.active&&(role!=='admin'||!active)&&(await q("SELECT COUNT(*)::int n FROM sainei_pos_users WHERE role='admin' AND active=true AND id<>$1",[ex.id])).rows[0].n===0)return fail(res,400,'Tiene que quedar al menos un usuario principal activo.');const k=pin?mkPin(pin):{salt:ex.salt,hash:ex.hash};await q('UPDATE sainei_pos_users SET name=$1,role=$2,active=$3,salt=$4,hash=$5 WHERE id=$6',[name,role,active,k.salt,k.hash,ex.id]);for(const [t,s] of sessions){if(s.uid===Number(ex.id)){if(!active)sessions.delete(t);else{s.role=role;s.name=name}}}await audit(me.name,'Editó al usuario '+name)}else{const r=await q("INSERT INTO sainei_pos_counters(kind,n) VALUES('user',1) ON CONFLICT(kind) DO UPDATE SET n=sainei_pos_counters.n+1 RETURNING n"),nid=Number(r.rows[0].n),k=mkPin(pin);await q('INSERT INTO sainei_pos_users(id,name,role,active,salt,hash) VALUES($1,$2,$3,true,$4,$5)',[nid,name,role,k.salt,k.hash]);await audit(me.name,'Creó el usuario '+name+' ('+role+')')}return send(res,200,{users:(await allUsers()).map(pubUser)})}
 if(p==='/api/newrec'&&m==='POST'){const code=newRecCode(),rc=mkPin(normCode(code));await setMeta('recSalt',rc.salt);await setMeta('recHash',rc.hash);await audit(me.name,'Generó un nuevo código de recuperación');return send(res,200,{code})}
 if(p==='/api/audit'&&m==='GET'){const lim=Math.min(1000,parseInt(url.searchParams.get('limit')||'200',10)||200),r=await q('SELECT t,u,a FROM sainei_pos_audit ORDER BY id DESC LIMIT $1',[lim]);return send(res,200,{rows:r.rows})}
 if(p==='/api/export'&&m==='GET'){await audit(me.name,'Descargó una copia de seguridad');return send(res,200,await fullState(),{'Content-Disposition':'attachment; filename="copia-sainei-'+new Date().toISOString().slice(0,10)+'.json"'})}
 if(p==='/api/restore'&&m==='POST'){const b=await readBody(req),s=b.state;if(!s||!Array.isArray(s.products)||!Array.isArray(s.sales))return fail(res,400,'El archivo no es una copia válida.');await backup('antes-'+Date.now());await restoreJson(s);await audit(me.name,'Restauró una copia desde archivo');return send(res,200,{ok:true})}
 if(p==='/api/clear'&&m==='POST'){await backup('antes-'+Date.now());const client=await pool.connect();try{await client.query('BEGIN');const rv=Number(await meta('rev')||0)+1;await client.query('DELETE FROM sainei_pos_records');await client.query("INSERT INTO sainei_pos_meta(k,v) VALUES('rev',$1) ON CONFLICT(k) DO UPDATE SET v=EXCLUDED.v",[String(rv)]);await client.query('COMMIT');await resetEpoch()}catch(e){await client.query('ROLLBACK');throw e}finally{client.release()}await audit(me.name,'Vació todos los datos del negocio');return send(res,200,{ok:true})}
 if(p==='/api/backups'&&m==='GET'){const r=await q('SELECT name,at,pg_column_size(state) size FROM sainei_pos_backups ORDER BY at DESC LIMIT 50');return send(res,200,{list:r.rows.map(x=>({name:x.name,size:Number(x.size||0),at:x.at})),dir:'PostgreSQL'})}
 if(p==='/api/backups/make'&&m==='POST'){const n=await backup('manual-'+Date.now());await audit(me.name,'Hizo una copia manual '+n);return send(res,200,{name:n})}
 if(p==='/api/backups/restore'&&m==='POST'){const b=await readBody(req),r=await q('SELECT state FROM sainei_pos_backups WHERE name=$1',[String(b.name||'')]);if(!r.rowCount)return fail(res,404,'No existe esa copia.');await backup('antes-'+Date.now());await restoreJson(r.rows[0].state);await audit(me.name,'Restauró la copia '+b.name);return send(res,200,{ok:true})}
 return fail(res,404,'No encontrado');
}
const server=http.createServer((req,res)=>handle(req,res).catch(e=>{log('ERROR '+req.method+' '+req.url+': '+(e.stack||e));if(!res.headersSent)fail(res,e.code===413?413:e.code===400?400:500,e.code?e.message:'Error interno del servidor')}));server.on('error',e=>{log('ERROR servidor '+e.message);process.exit(1)});
init().then(async()=>{INSTALL_ID=await meta('installId');await q('SELECT 1');server.listen(PORT,'0.0.0.0',()=>log('SAINEI POS PostgreSQL escuchando en '+PORT))}).catch(e=>{log('No se pudo iniciar PostgreSQL: '+e.message);process.exit(1)});
setInterval(async()=>{try{const n=new Date().toISOString().slice(0,10),k='auto-'+n;if(!(await q('SELECT 1 FROM sainei_pos_backups WHERE name=$1',[k])).rowCount)await backup(k)}catch(e){log('ERROR copia automática: '+e.message)}},3600000).unref();
process.on('SIGTERM',async()=>{server.close();await pool.end();process.exit(0)});
