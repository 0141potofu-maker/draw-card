const http=require('http'),fs=require('fs'),path=require('path'),{WebSocketServer}=require('ws');
const PAGE=fs.readFileSync(path.join(__dirname,'index.html'));
const srv=http.createServer((q,r)=>{if(q.url==='/health'){r.writeHead(200);return r.end('ok')}r.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});r.end(PAGE)});
const wss=new WebSocketServer({server:srv,maxPayload:400000});
const BEATS={fire:'grass',grass:'water',water:'fire',dark:'dark'},mult=(a,d)=>BEATS[a]===d?1.5:BEATS[d]===a?0.5:1;
const SP={poison:'毒',burn:'やけど',paralyze:'麻痺',sleep:'眠り',weak:'弱体化',fear:'恐怖'};
const ELS=['fire','water','grass','dark','none'],SPS=Object.keys(SP),TRS=['regen','first','reflect','sturdy','rage','immune'];
const alive=g=>g.order.filter(u=>g.P[u].alive);
function resolve(g,picks){const log=[],act=[],ev=[];
 g.order.forEach(u=>g.P[u].cards.forEach(c=>{c.cdPrev=c.cd;c.cd=false}));
 for(const u of alive(g)){const P=g.P[u],pk=picks[u]&&picks[u].turn===g.turn?picks[u]:null;
  if(pk&&P.cards[pk.card]&&P.cards[pk.card].hp>0&&pk.card!==P.active){P.active=pk.card;ev.push({k:'sw',u,card:pk.card});log.push(`${P.name}は${P.cards[pk.card].name}に交代！`)}
  act.push({u,a:pk?pk.act:'pass',t:pk?pk.target:null})}
 const fs=x=>g.P[x.u].cards[g.P[x.u].active].trait==='first'?1:0;act.sort((a,b)=>fs(b)-fs(a));
 for(const x of act){const P=g.P[x.u],c=P.cards[P.active];if(c.hp<=0||x.a==='pass')continue;
  if(c.st&&c.st.k==='sleep'){c.st=null;ev.push({k:'skip',u:x.u,w:'眠り'});log.push(`${c.name}は眠っていて動けない！`);continue}
  if(c.st&&c.st.k==='paralyze'&&Math.random()<.3){ev.push({k:'skip',u:x.u,w:'麻痺'});log.push(`${c.name}は麻痺で動けない！`);continue}
  const others=alive(g).filter(u=>u!==x.u);let tu=others.includes(x.t)?x.t:others[Math.random()*others.length|0];if(!tu)continue;
  const tp=g.P[tu],tc=tp.cards[tp.active];if(tc.hp<=0)continue;
  let a=x.a;if(a==='sp'&&c.cdPrev)a='atk';if(a==='sp'&&c.st&&c.st.k==='fear'){a='atk';ev.push({k:'skip',u:x.u,w:'恐怖'});log.push(`${c.name}は恐怖で特殊技が使えない！`)}
  if(a==='sp'){c.cd=true;if(tc.trait==='immune'||tc.st)log.push(`${P.name}の${c.name}の${c.spName}は効かなかった`);else{tc.st={k:c.sp,n:c.sp==='sleep'?1:4};ev.push({k:'sp',f:x.u,t:tu,s:c.sp,el:c.el});log.push(`${P.name}の${c.name}の${c.spName}！ ${tp.name}の${tc.name}は${SP[c.sp]}状態に`)}}
  else{let d=c.power*mult(c.el,tc.el)*(c.st&&(c.st.k==='burn'||c.st.k==='weak')?.7:1)*(c.trait==='rage'&&c.hp<c.maxhp/2?1.5:1);d=Math.max(1,Math.round(d));
   if(tc.trait==='sturdy'&&!tc.sUsed&&tc.hp===tc.maxhp&&d>=tc.hp){d=tc.hp-1;tc.sUsed=true;log.push(`${tc.name}は頑丈で耐えた！`)}
   tc.hp=Math.max(0,tc.hp-d);const m=mult(c.el,tc.el);
   log.push(`${P.name}の${c.name}の${c.move}！ ${tp.name}の${tc.name}に${d}ダメージ${m>1?'（効果ばつぐん）':m<1?'（いまひとつ）':''}`);
   const ev0={k:'atk',f:x.u,t:tu,d,m,el:c.el,hp:tc.hp,fh:null};ev.push(ev0);if(tc.trait==='reflect'&&d>0){const r=Math.round(d*.25);c.hp=Math.max(0,c.hp-r);ev0.fh=c.hp;if(r)log.push(`${tc.name}の反射で${c.name}は${r}ダメージ`)}}}
 for(const u of alive(g)){const P=g.P[u],c=P.cards[P.active];if(c.hp<=0)continue;
  if(c.st&&c.st.k==='poison'){c.hp=Math.max(0,c.hp-6);ev.push({k:'dot',u,d:6,hp:c.hp});log.push(`${c.name}は毒で6ダメージ`)}
  if(c.st&&c.st.k==='burn'){c.hp=Math.max(0,c.hp-5);ev.push({k:'dot',u,d:5,hp:c.hp});log.push(`${c.name}はやけどで5ダメージ`)}
  if(c.hp>0&&c.trait==='regen'&&c.hp<c.maxhp){c.hp=Math.min(c.maxhp,c.hp+8);ev.push({k:'heal',u,d:8,hp:c.hp});log.push(`${c.name}は8回復`)}
  if(c.st&&c.st.k!=='sleep'&&--c.st.n<=0)c.st=null}
 for(const u of alive(g)){const P=g.P[u];if(P.cards[P.active].hp<=0){log.push(`${P.name}の${P.cards[P.active].name}は倒れた！`);P.cards[P.active].st=null;
  const n=P.cards.findIndex(c=>c.hp>0);ev.push({k:'faint',u,next:n});if(n<0){P.alive=false;log.push(`${P.name}は脱落！`)}else P.active=n}}
 g.order.forEach(u=>g.P[u].cards.forEach(c=>delete c.cdPrev));
 const al=alive(g);if(al.length<=1){g.phase='over';g.winner=al[0]||null}
 g.turn++;g.turnStart=Date.now();g.log=log.length?log:['なにも起きなかった'];g.ev=ev;return g}

const rooms={};
const str=(v,n)=>String(v==null?'':v).slice(0,n);
const num=(v,a,b)=>Math.min(b,Math.max(a,Math.round(+v)||a));
const code4=()=>{let c;do{c=Array.from({length:4},()=>'ABCDEFGHJKLMNPQRSTUVWXYZ'[Math.random()*24|0]).join('')}while(rooms[c]);return c};
const send=(ws,o)=>{if(ws&&ws.readyState===1)ws.send(JSON.stringify(o))};
const pickedOf=r=>{const o={};for(const u in r.picks)o[u]={turn:r.picks[u].turn};return o};
const bc=(r,o)=>{o.now=Date.now();for(const u in r.socks)send(r.socks[u],o)};
const roomMsg=r=>({t:'room',code:r.code,G:r.G,PL:r.PL,picked:pickedOf(r)});

function cleanCard(c){
  if(!c||typeof c!=='object')return null;
  const h=num((c.maxhp-30)/12,1,6),p=num((c.power-6)/3,1,6);
  if(h+p>8)return null;
  return{name:str(c.name,12),el:ELS.includes(c.el)?c.el:'grass',maxhp:30+h*12,power:6+p*3,move:str(c.move,12),
    sp:SPS.includes(c.sp)?c.sp:'weak',spName:str(c.spName,12),trait:TRS.includes(c.trait)?c.trait:'regen',traitName:str(c.traitName,12),
    desc:str(c.desc,60),img:typeof c.img==='string'&&c.img.startsWith('data:image/jpeg')&&c.img.length<60000?c.img:''};
}
function arm(r){clearTimeout(r.timer);const t=r.G.turn;r.timer=setTimeout(()=>{if(r.G.turn===t&&r.G.phase==='battle')step(r)},31000)}
function step(r){clearTimeout(r.timer);r.G=resolve(r.G,r.picks);r.picks={};bc(r,{t:'g',G:r.G});if(r.G.phase==='battle')arm(r)}
function enterRoom(ws,r,uid,name){
  r.socks[uid]=ws;ws.room=r;ws.uid=uid;r.last=Date.now();
  if(!r.PL[uid])r.PL[uid]={name,cards:[]};else r.PL[uid].name=name;
  bc(r,roomMsg(r));
}
function handle(ws,d){
  const uid=str(d.uid||ws.uid,24);
  if(d.t==='ping')return send(ws,{t:'pong'});
  if(d.t==='create'){
    const c=code4();const r=rooms[c]={code:c,G:{host:uid,phase:'lobby',turn:0},PL:{},picks:{},socks:{},last:Date.now()};
    return enterRoom(ws,r,uid,str(d.name,10)||'名無し');
  }
  if(d.t==='join'){
    const r=rooms[str(d.code,4).toUpperCase()];
    if(!r)return send(ws,{t:'err',m:'部屋が見つかりません',gone:true});
    if(r.G.phase!=='lobby'&&!r.G.P[uid])return send(ws,{t:'err',m:'この部屋はもうゲームが始まっています'});
    if(!r.PL[uid]&&Object.keys(r.PL).length>=8)return send(ws,{t:'err',m:'この部屋は満員です'});
    return enterRoom(ws,r,uid,str(d.name,10)||'名無し');
  }
  const r=ws.room;if(!r)return;const G=r.G;r.last=Date.now();
  if(d.t==='cards'&&G.phase==='lobby'){
    const cs=(Array.isArray(d.cards)?d.cards:[]).slice(0,3).map(cleanCard).filter(Boolean);
    r.PL[ws.uid]={name:str(d.name,10)||'名無し',cards:cs};bc(r,roomMsg(r));
  }else if(d.t==='start'&&G.host===ws.uid&&G.phase==='lobby'){
    const ids=Object.keys(r.PL).filter(u=>r.PL[u].cards.length===3).slice(0,4);
    if(ids.length<2)return send(ws,{t:'err',m:'2人以上の準備が必要です'});
    const P={};ids.forEach(u=>P[u]={name:r.PL[u].name,active:0,alive:true,cards:r.PL[u].cards.map(({img,...c})=>({...c,hp:c.maxhp,st:null,cd:false,sUsed:false}))});
    r.G={host:G.host,phase:'battle',turn:1,turnStart:Date.now(),order:ids,P,log:['バトル開始！'],winner:null};r.picks={};
    bc(r,roomMsg(r));arm(r);
  }else if(d.t==='pick'&&G.phase==='battle'&&G.P[ws.uid]&&G.P[ws.uid].alive){
    const card=num(d.card,0,2);if(G.P[ws.uid].cards[card].hp<=0)return;
    r.picks[ws.uid]={turn:G.turn,card,act:d.act==='sp'?'sp':'atk',target:str(d.target,24)};
    if(alive(G).every(u=>r.picks[u]))step(r);else bc(r,{t:'picked',picked:pickedOf(r)});
  }
}
wss.on('connection',ws=>{
  ws.on('message',m=>{let d;try{d=JSON.parse(m)}catch(e){return}try{handle(ws,d||{})}catch(e){console.error(e)}});
  ws.on('close',()=>{const r=ws.room;if(r&&r.socks[ws.uid]===ws){delete r.socks[ws.uid];r.last=Date.now()}});
  ws.on('error',()=>{});
});
setInterval(()=>{for(const c in rooms){const r=rooms[c];if(!Object.keys(r.socks).length&&Date.now()-r.last>30*60*1000){clearTimeout(r.timer);delete rooms[c]}}},5*60*1000);
srv.listen(process.env.PORT||3000,()=>console.log('listening'));
