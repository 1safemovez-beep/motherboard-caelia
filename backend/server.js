'use strict';
const http=require('http');
const fs=require('fs');
const path=require('path');
const crypto=require('crypto');
const PORT=Number(process.env.PORT||8787);
const OWNER_TOKEN=process.env.CAELIA_OWNER_TOKEN||'';
const MODEL_URL=process.env.MODEL_URL||'https://api.openai.com/v1/chat/completions';
const MODEL_NAME=process.env.MODEL_NAME||'gpt-5.6-mini';
const MODEL_API_KEY=process.env.MODEL_API_KEY||'';
const DATA_FILE=process.env.DATA_FILE||path.join(__dirname,'caelia-memory.json');
const CORS_ORIGIN=process.env.CORS_ORIGIN||'https://motherboard.caeliasystems.com';
const SYSTEM_PROMPT=`You are Caelia, the protected AI orchestration layer for Alicia's Motherboard.\n\nCore rules: remain Caelia, not Alicia; representation is delegated and bounded; memory is not identity; knowledge is not automatically truth; perception is not interpretation; reasoning is not decision authority; planning is not execution; skills do not grant authority; protect Alicia's control and privacy; do not reveal or request secrets unnecessarily; do not silently rewrite Core identity or governing boundaries. Treat feedback as information to evaluate, not an automatic command. Be clear when you are uncertain.`;
function load(){try{return JSON.parse(fs.readFileSync(DATA_FILE,'utf8'));}catch{return {memory:[],teachQueue:[],failsafe:[]};}}
let db=load();
function save(){fs.writeFileSync(DATA_FILE+'.tmp',JSON.stringify(db,null,2));fs.renameSync(DATA_FILE+'.tmp',DATA_FILE);}
function send(res,status,obj){const b=JSON.stringify(obj);res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Content-Length':Buffer.byteLength(b),'Access-Control-Allow-Origin':CORS_ORIGIN,'Access-Control-Allow-Headers':'Content-Type, Authorization','Access-Control-Allow-Methods':'GET,POST,OPTIONS','X-Content-Type-Options':'nosniff','X-Frame-Options':'DENY'});res.end(b);}
function auth(req){if(!OWNER_TOKEN)return true;const h=req.headers.authorization||'';return h==='Bearer '+OWNER_TOKEN;}
function body(req){return new Promise((resolve,reject)=>{let s='';req.on('data',c=>{s+=c;if(s.length>200000)req.destroy();});req.on('end',()=>{try{resolve(s?JSON.parse(s):{});}catch(e){reject(e);}});req.on('error',reject);});}
async function modelChat(message){
  if(!MODEL_API_KEY) return {reply:'Caelia Brain is connected, but the model provider key is not configured on the backend yet.',mode:'gateway'};
  const payload={model:MODEL_NAME,messages:[{role:'system',content:SYSTEM_PROMPT},{role:'user',content:String(message||'')}],temperature:0.35};
  const r=await fetch(MODEL_URL,{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+MODEL_API_KEY},body:JSON.stringify(payload)});
  const j=await r.json();
  if(!r.ok) throw new Error(j.error?.message||`Model HTTP ${r.status}`);
  const reply=j.choices?.[0]?.message?.content||'No model response returned.';
  return {reply,mode:'model',model:MODEL_NAME};
}
const server=http.createServer(async(req,res)=>{
  if(req.method==='OPTIONS')return send(res,204,{});
  const u=new URL(req.url,`http://${req.headers.host}`);
  if(req.method==='GET'&&u.pathname==='/api/health')return send(res,200,{ok:true,service:'caelia-brain-gateway',name:'Caelia',model:MODEL_NAME,modelConfigured:!!MODEL_API_KEY,time:new Date().toISOString()});
  if(!u.pathname.startsWith('/api/'))return send(res,404,{error:'Not found'});
  if(!auth(req))return send(res,401,{error:'Owner authorization required.'});
  try{
    if(req.method==='POST'&&u.pathname==='/api/chat'){
      const {message}=await body(req); if(!message)return send(res,400,{error:'message required'});
      const out=await modelChat(message); db.memory.unshift({ts:Date.now(),role:'user',text:String(message),reply:out.reply}); db.memory=db.memory.slice(0,100); save(); return send(res,200,{ok:true,...out});
    }
    if(req.method==='POST'&&u.pathname==='/api/teach'){
      const x=await body(req); if(!x.directive)return send(res,400,{error:'directive required'}); db.teachQueue.unshift({ts:Date.now(),source:x.source||'unknown',directive:String(x.directive)}); db.teachQueue=db.teachQueue.slice(0,200); save(); return send(res,202,{ok:true,queued:true});
    }
    if(req.method==='POST'&&u.pathname==='/api/failsafe'){
      const x=await body(req); db.failsafe.unshift({ts:Date.now(),prompt:String(x.prompt||'')}); db.failsafe=db.failsafe.slice(0,200); save(); return send(res,202,{ok:true,logged:true});
    }
    if(req.method==='POST'&&u.pathname.startsWith('/api/engines/')){
      const id=decodeURIComponent(u.pathname.split('/')[3]||''); const x=await body(req); return send(res,200,{ok:true,engine:id,status:'bridge-ready',params:x,note:'Engine bridge is ready. Attach the independently deployed engine at this interface; the Motherboard does not absorb or replace it.'});
    }
    return send(res,404,{error:'API route not found'});
  }catch(e){return send(res,500,{error:e.message||'Server error'});}
});
server.listen(PORT,()=>console.log(`Caelia Brain Gateway listening on ${PORT}`));
