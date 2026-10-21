import { getStore } from '@netlify/blobs';
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

const json = (statusCode, value) => ({ statusCode, headers: { 'content-type':'application/json; charset=utf-8', 'cache-control':'no-store', 'x-content-type-options':'nosniff' }, body: JSON.stringify(value) });
const required = (name) => { if(!process.env[name]) throw new Error(`Configuration manquante : ${name}`); return process.env[name]; };
const hash = (value) => createHmac('sha256', required('LICENCE_SIGNING_SECRET')).update(value).digest('hex');
const eq = (a,b) => { const aa=Buffer.from(a||''),bb=Buffer.from(b||''); return aa.length===bb.length && timingSafeEqual(aa,bb); };
// Explicit credentials avoid MissingBlobsEnvironmentError when Netlify's
// automatic Blobs context is not injected into the deployed Function.
const store = () => getStore({
  name: 'gants-licences',
  siteID: required('BLOBS_SITE_ID'),
  token: required('BLOBS_TOKEN'),
  consistency: 'strong'
});
const key = () => 'GANTS-' + Array.from({length:2},()=>randomBytes(3).toString('hex').toUpperCase()).join('-');
const days = (n) => new Date(Date.now()+n*86400000).toISOString();
const bodyJson = (event) => { try {return JSON.parse(event.body||'{}');} catch {return {};} };
const admin = (event) => eq(event.headers['x-admin-key'], required('ADMIN_MASTER_KEY'));
const publicRecord = (r) => ({ id:r.id, name:r.name, email:r.email||'', createdAt:r.createdAt, expiresAt:r.expiresAt, revoked:r.revoked, origin:r.origin, stripeSession:r.stripeSession||'' });
const getRecord = async (id) => id ? await store().get(`licence:${id}`,{type:'json'}) : null;
const saveRecord = async (r) => store().setJSON(`licence:${r.id}`,r);
async function createLicense({name='',email='',duration=365,origin='admin',stripeSession=''}) {
  const licenseKey=key(), id=hash(licenseKey), createdAt=new Date().toISOString();
  const record={id,name:String(name).slice(0,120),email:String(email).slice(0,180),createdAt,expiresAt:days(duration),revoked:false,origin,stripeSession};
  await saveRecord(record);
  const persisted=await getRecord(id);
  if(!persisted || persisted.id!==id) throw new Error('Enregistrement de la licence non confirmé');
  return {licenseKey,record};
}
export async function handler(event) {
 try {
  const route=(event.path||'').replace(/^.*\/api\/?/,'').replace(/^\//,'');
  const method=event.httpMethod||'GET';
  if(route==='health') return json(200,{ok:true,configured:{admin:!!process.env.ADMIN_MASTER_KEY,licences:!!process.env.LICENCE_SIGNING_SECRET,blobs:!!process.env.BLOBS_SITE_ID&&!!process.env.BLOBS_TOKEN}});
  if(route==='verify' && method==='POST') {
    const token=String(bodyJson(event).licenseKey||'').trim().toUpperCase();
    if(!/^GANTS-(?:[A-F0-9]{6}-){1,3}[A-F0-9]{6}$/.test(token)) return json(403,{ok:false,error:'Clé invalide'});
    const r=await getRecord(hash(token));
    return r&&!r.revoked&&Date.parse(r.expiresAt)>Date.now()?json(200,{ok:true,expiresAt:r.expiresAt,name:r.name}):json(403,{ok:false,error:'Licence introuvable, expirée ou révoquée'});
  }
  if(route.startsWith('admin/')) {
    if(!admin(event)) return json(401,{error:'Accès administrateur refusé'});
    const data=bodyJson(event);
    if(route==='admin/list') {
      const {blobs}=await store().list({prefix:'licence:'});
      const records=(await Promise.all(blobs.map(b=>getRecord(b.key.replace(/^licence:/,''))))).filter(Boolean).map(publicRecord).sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
      return json(200,{records});
    }
    if(route==='admin/create' && method==='POST') {
      const duration=Math.max(1,Math.min(3650,Number(data.days)||365));
      const {licenseKey,record}=await createLicense({name:data.name||'',email:data.email||'',duration});
      return json(200,{licenseKey,record:publicRecord(record)});
    }
    if(route==='admin/delete' && method==='POST') {
      const id=String(data.id||'');
      if(!/^[a-f0-9]{64}$/.test(id)) return json(400,{error:'Identifiant incorrect'});
      const r=await getRecord(id);
      if(!r) return json(404,{error:'Licence introuvable'});
      await store().delete(`licence:${id}`);
      if(await getRecord(id)) return json(500,{error:'Suppression non confirmée'});
      return json(200,{ok:true});
    }
    if((route==='admin/revoke'||route==='admin/restore'||route==='admin/extend')&&method==='POST') {
      const r=await getRecord(String(data.id||'')); if(!r) return json(404,{error:'Licence introuvable'});
      if(route==='admin/revoke') r.revoked=true;
      if(route==='admin/restore') r.revoked=false;
      if(route==='admin/extend') { const n=Math.max(1,Math.min(3650,Number(data.days)||365));r.expiresAt=new Date(Math.max(Date.now(),Date.parse(r.expiresAt))+n*86400000).toISOString(); }
      await saveRecord(r);return json(200,{record:publicRecord(r)});
    }
  }
  return json(404,{error:'Route introuvable'});
 } catch(err) {console.error('API Les Gants',err);return json(500,{error: /Configuration manquante/.test(err.message)?err.message:'Erreur serveur ; consulter les journaux Netlify'});}
}
