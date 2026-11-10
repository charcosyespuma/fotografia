// El Tiempo Esta Noche · avisos diarios por ntfy
// GitHub Actions lo ejecuta dos veces al día:
//   mañana (08:00 UTC): atardecer de hoy y tormentas del día
//   tarde  (17:00 UTC): noche de hoy, amanecer de mañana y tormentas de la noche
// Lee sitios.json (lo mantiene la app) y usa el mismo cálculo que la app.
import fs from 'node:fs';

/* CORE-START */
/* ===== Astronomía ===== */
const PI=Math.PI,rad=PI/180,dayMs=864e5,J1970=2440588,J2000=2451545,e=rad*23.4397;
const toDays=d=>d/dayMs-0.5+J1970-J2000;
const RA=(l,b)=>Math.atan2(Math.sin(l)*Math.cos(e)-Math.tan(b)*Math.sin(e),Math.cos(l));
const DEC=(l,b)=>Math.asin(Math.sin(b)*Math.cos(e)+Math.cos(b)*Math.sin(e)*Math.sin(l));
const ALT=(H,phi,dec)=>Math.asin(Math.sin(phi)*Math.sin(dec)+Math.cos(phi)*Math.cos(dec)*Math.cos(H));
const sidereal=(d,lw)=>rad*(280.16+360.9856235*d)-lw;
function sunCoords(d){const M=rad*(357.5291+0.98560028*d),C=rad*(1.9148*Math.sin(M)+0.02*Math.sin(2*M)+0.0003*Math.sin(3*M)),L=M+C+rad*102.9372+PI;return{dec:DEC(L,0),ra:RA(L,0)};}
function moonCoords(d){const L=rad*(218.316+13.176396*d),M=rad*(134.963+13.064993*d),F=rad*(93.272+13.229350*d);
  const l=L+rad*6.289*Math.sin(M),b=rad*5.128*Math.sin(F);return{ra:RA(l,b),dec:DEC(l,b),dist:385001-20905*Math.cos(M)};}
function sunAlt(ms,lat,lng){const d=toDays(ms),c=sunCoords(d);return ALT(sidereal(d,rad*-lng)-c.ra,rad*lat,c.dec)/rad;}
function moonAlt(ms,lat,lng){const d=toDays(ms),c=moonCoords(d);return ALT(sidereal(d,rad*-lng)-c.ra,rad*lat,c.dec)/rad;}
function moonIllum(ms){const d=toDays(ms),s=sunCoords(d),m=moonCoords(d),sd=149598000;
  const phi=Math.acos(Math.sin(s.dec)*Math.sin(m.dec)+Math.cos(s.dec)*Math.cos(m.dec)*Math.cos(s.ra-m.ra));
  const inc=Math.atan2(sd*Math.sin(phi),m.dist-sd*Math.cos(phi));
  const ang=Math.atan2(Math.cos(s.dec)*Math.sin(s.ra-m.ra),Math.sin(s.dec)*Math.cos(m.dec)-Math.cos(s.dec)*Math.sin(m.dec)*Math.cos(s.ra-m.ra));
  return{fraction:(1+Math.cos(inc))/2,phase:0.5+0.5*inc*(ang<0?-1:1)/PI};}
const moonEmoji=p=>['🌑','🌒','🌓','🌔','🌕','🌖','🌗','🌘'][Math.round(p*8)%8];
const moonName=p=>['Luna nueva','Creciente','Cuarto creciente','Gibosa creciente','Luna llena','Gibosa menguante','Cuarto menguante','Menguante'][Math.round(p*8)%8];
function sunVec(ms){const s=sunCoords(toDays(ms));return[Math.cos(s.dec)*Math.cos(s.ra),Math.cos(s.dec)*Math.sin(s.ra),Math.sin(s.dec)];}
function radec(ms,lat,lng,raH,dec){const d=toDays(ms),phi=lat*rad,dr=dec*rad,H=sidereal(d,rad*-lng)-raH*15*rad;
  return{alt:ALT(H,phi,dr)/rad,az:(Math.atan2(Math.sin(H),Math.cos(H)*Math.sin(phi)-Math.tan(dr)*Math.cos(phi))/rad+180+360)%360};}
const cDeg=a=>['N','NE','E','SE','S','SO','O','NO'][Math.round(a/45)%8];

const CONST=[['Orión',5.6,5],['Tauro',4.7,15],['Géminis',7.1,22],['Auriga',6,42],['Can Mayor',6.8,-22],['Can Menor',7.6,6],['Cáncer',8.6,20],['Leo',10.7,13],['Virgo',13.4,-4],['Boyero',14.7,31],['Corona Boreal',15.8,30],['Libra',15.2,-15],['Escorpio',16.9,-27],['Ofiuco',17.4,-8],['Hércules',17.4,27],['Sagitario',19.1,-25],['Lira',18.9,36],['Cisne',20.6,44],['Águila',19.7,3],['Capricornio',21,-18],['Acuario',22.3,-11],['Pegaso',22.7,19],['Andrómeda',0.8,37],['Piscis',0.5,13],['Aries',2.6,21],['Perseo',3.2,45],['Casiopea',1.3,62],['Cefeo',22,71],['Osa Mayor',11.3,51],['Osa Menor',15,78],['Dragón',17,65],['Ballena',1.7,-7],['Erídano',3.3,-29],['Popa',7.3,-31],['Centauro',13.1,-47],['Cruz del Sur',12.4,-60],['Carina',8.7,-63]];
const OBJ=[['Nebulosa de Orión',5.59,-5.4],['Pléyades',3.79,24.1],['Galaxia de Andrómeda',0.71,41.3],['Doble Cúmulo',2.33,57.1],['Nebulosa Norteamérica',20.98,44.3],['Nebulosa de la Laguna',18.06,-24.4],['Rho Ophiuchi',16.49,-26.4],['Nebulosa Roseta',6.53,5],['Cúmulo de Hércules',16.69,36.5],['Galaxia del Remolino',13.5,47.2]];
const MW=[['🌌','Núcleo galáctico','Vía Láctea de verano · Sagitario',17.76,-29],['🦢','Brazo del Cisne','Vía Láctea de verano · Cisne',20.4,40],['❄️','Vía Láctea de invierno','Auriga · Orión · Monoceros',6.3,15]];

/* ===== Puntuación ===== */
function hourScore(h,mode){
  const cloud=Math.min(100,h.low+h.mid*0.75+h.high*0.45);
  let f=Math.pow(1-cloud/100,1.3);
  f*=1-0.85*(h.pp/100);
  if(h.rh>80)f*=1-0.4*Math.min(1,(h.rh-80)/20);
  if(h.t-h.td<2)f*=0.7;
  if(h.wind>15)f*=Math.max(0.5,1-(h.wind-15)/40);
  if(h.gust>40)f*=0.85;
  if(h.vis!=null&&h.vis<10000)f*=0.5+0.5*h.vis/10000;
  /* Calima: polvo (µg/m³) y espesor óptico de aerosoles; resta transparencia y oscurece el cielo */
  if(h.aod!=null&&h.aod>0.15)f*=Math.max(0.3,1-(h.aod-0.15)*1.3);
  else if(h.dust!=null&&h.dust>30)f*=Math.max(0.4,1-(h.dust-30)/200);
  if(mode==='deep'){if(h.malt>0)f*=1-0.8*h.illum*Math.min(1,0.35+h.malt/40);if(h.salt>-18)f*=0.82;}
  else if(h.salt>-18)f*=0.95;
  return Math.round(100*Math.max(0,f));
}
const col=s=>s>=70?'var(--good)':s>=45?'var(--ok)':'var(--bad)';
function verdict(s){return s>=80?['¡Noche excelente!','Sal a fotografiar']:s>=65?['Buena noche','Merece la pena salir']:s>=45?['Noche regular','Puede valer, con paciencia']:s>=25?['Mala noche','Mejor no cargar el coche']:['Quédate en casa','El cielo no acompaña'];}

function calima(n){if(n.dust==null)return{t:'—',l:'sin datos',bad:0};
  const v=Math.max(n.dust,(n.aod||0)*200);
  return v<25?{t:'No',l:'sin calima',bad:0}:v<60?{t:'Leve',l:'calima',bad:1}:v<120?{t:'Mod.',l:'calima',bad:2}:{t:'Fuerte',l:'calima',bad:3};}

/* Previsión de un lugar: meteorología (8 días) + calima (5 días) */
const WX_VARS='weather_code,cape,cloud_cover,cloud_cover_low,cloud_cover_mid,cloud_cover_high,relative_humidity_2m,dew_point_2m,temperature_2m,wind_speed_10m,wind_gusts_10m,visibility,precipitation_probability';
async function getForecast(pl){
  const aqP=fetch(`https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${pl.lat}&longitude=${pl.lng}&hourly=dust,aerosol_optical_depth&forecast_days=5&timezone=auto&timeformat=unixtime`).then(r=>r.json()).catch(()=>null);
  const wx=await (await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${pl.lat}&longitude=${pl.lng}&hourly=${WX_VARS}&forecast_days=8&timezone=auto&timeformat=unixtime`)).json();
  if(!wx.hourly)throw new Error(wx.reason||'sin datos');
  const aq=await aqP,aqIdx={};
  if(aq&&aq.hourly&&aq.hourly.time)aq.hourly.time.forEach((t,i)=>aqIdx[t]={dust:aq.hourly.dust[i],aod:aq.hourly.aerosol_optical_depth[i]});
  return{wx,aqIdx};
}
/* Agrupa las horas oscuras en noches y puntúa cada una por su mejor tramo de 2 h */
function nightsFor(pl,wx,aqIdx,mode,win=2,thr=70){
  const H=wx.hourly,off=wx.utc_offset_seconds,now=Date.now(),g={};
  for(let i=0;i<H.time.length;i++){
    const ms=H.time[i]*1000;if(ms<now-3600e3)continue;
    const salt=sunAlt(ms,pl.lat,pl.lng);if(salt>-12)continue;
    const key=new Date(ms+off*1000-12*3600e3).toISOString().slice(0,10),mi=moonIllum(ms);
    const h={ms,salt,malt:moonAlt(ms,pl.lat,pl.lng),illum:mi.fraction,phase:mi.phase,
      low:H.cloud_cover_low[i]??0,mid:H.cloud_cover_mid[i]??0,high:H.cloud_cover_high[i]??0,total:H.cloud_cover[i]??0,
      rh:H.relative_humidity_2m[i]??0,td:H.dew_point_2m[i]??0,t:H.temperature_2m[i]??0,wind:H.wind_speed_10m[i]??0,
      gust:H.wind_gusts_10m[i]??0,vis:H.visibility?H.visibility[i]:null,pp:H.precipitation_probability[i]??0,
      dust:aqIdx[H.time[i]]?.dust??null,aod:aqIdx[H.time[i]]?.aod??null,code:H.weather_code?.[i]??0,cape:H.cape?.[i]??0};
    h.s=hourScore(h,mode);(g[key]=g[key]||[]).push(h);
  }
  return Object.entries(g).filter(([,hs])=>hs.length>=3).slice(0,7).map(([key,hs])=>{
    /* Mejor tramo de «win» horas seguidas (toda la noche si win es mayor que la noche) */
    const W=Math.max(1,Math.min(win,hs.length));let best=-1,bi=0;
    for(let i=0;i+W<=hs.length;i++){let sum=0;for(let k=i;k<i+W;k++)sum+=hs[k].s;const v=sum/W;if(v>best){best=v;bi=i;}}
    /* Racha más larga de horas buenas (puntuación >= thr) */
    let run=0,gH=0,gS=0,gE=0,rs=0;hs.forEach((h,i)=>{if(h.s>=thr){if(!run)rs=i;run++;if(run>gH){gH=run;gS=hs[rs].ms;gE=h.ms+3600e3;}}else run=0;});
    const w=hs.slice(bi,bi+W);const wavg=k=>Math.round(w.reduce((a,h)=>a+h[k],0)/w.length);
    return{key,hs,W,best:Math.round(best),bi,bestms:hs[bi].ms+W*1800e3,start:hs[bi].ms,end:hs[bi+W-1].ms+3600e3,goodH:gH,goodS:gS,goodE:gE,dark:hs.length,
      cloud:wavg('total'),wind:wavg('wind'),rh:wavg('rh'),pp:Math.max(...hs.map(h=>h.pp)),
      illum:hs[Math.floor(hs.length/2)].illum,phase:hs[Math.floor(hs.length/2)].phase,moonUp:hs.filter(h=>h.malt>0).length,
      fog:w.some(h=>h.t-h.td<2),dust:w[0].dust==null?null:Math.round(Math.max(...w.map(h=>h.dust??0))),aod:w[0].aod==null?null:Math.max(...w.map(h=>h.aod??0)),
      tmin:Math.min(...hs.map(h=>h.t)),gust:Math.max(...hs.map(h=>h.gust)),storm:stormInfo(hs)};
  });
}
/* Tormentas: código meteorológico 95-99 = tormenta prevista; CAPE alta + lluvia probable = posible */
function stormLevel(h){return h.code>=96?3:h.code>=95?2:(h.cape>=800&&h.pp>=30)||(h.cape>=1500)?1:0;}
function stormInfo(hs){const st=hs.filter(h=>stormLevel(h)>0);if(!st.length)return null;
  return{level:Math.max(...st.map(stormLevel)),start:st[0].ms,end:st[st.length-1].ms+3600e3,hours:st.length,cape:Math.max(...st.map(h=>h.cape))};}
function sunAz(ms,lat,lng){const d=toDays(ms),c=sunCoords(d),phi=lat*rad,H=sidereal(d,rad*-lng)-c.ra;
  return(Math.atan2(Math.sin(H),Math.cos(H)*Math.sin(phi)-Math.tan(c.dec)*Math.cos(phi))/rad+180+360)%360;}
/* Momento en que el Sol cruza una altura, buscando minuto a minuto */
function sunCross(pl,t0,t1,alt,up){let prev=sunAlt(t0,pl.lat,pl.lng);
  for(let t=t0+60e3;t<=t1;t+=60e3){const a=sunAlt(t,pl.lat,pl.lng);if(up?(prev<alt&&a>=alt):(prev>alt&&a<=alt))return t;prev=a;}return null;}
/* Atardecer (tarde del día key) y amanecer (mañana siguiente), con hora dorada y azul */
function sunEvents(pl,key,off){const noon=Date.parse(key+'T12:00:00Z')-off*1000;
  const set={gold:sunCross(pl,noon,noon+12*3600e3,6,false),sun:sunCross(pl,noon,noon+12*3600e3,-0.833,false),
    blue:sunCross(pl,noon,noon+12*3600e3,-4,false),blueEnd:sunCross(pl,noon,noon+12*3600e3,-6,false)};
  const m0=noon+12*3600e3,m1=noon+24*3600e3;
  const rise={blue:sunCross(pl,m0,m1,-6,true),blueEnd:sunCross(pl,m0,m1,-4,true),sun:sunCross(pl,m0,m1,-0.833,true),gold:sunCross(pl,m0,m1,6,true)};
  set.az=set.sun?sunAz(set.sun,pl.lat,pl.lng):270;rise.az=rise.sun?sunAz(rise.sun,pl.lat,pl.lng):90;return{set,rise};}
/* Potencial de color: nubes medias/altas encima (el «lienzo») y horizonte despejado hacia el sol */
function glowScore(L,Hz){
  const hm=Math.min(100,L.high+0.7*L.mid);
  let f=hm<10?0.35:hm<30?0.35+(hm-10)/20*0.55:hm<=70?1:hm<=90?1-(hm-70)/20*0.5:0.45;
  if(L.low>30)f*=Math.max(0.2,1-(L.low-30)/100*1.3);
  let hb=null;if(Hz){hb=Hz.low+0.6*Hz.mid;if(hb>40)f*=Math.max(0.25,1-(hb-40)/80);}
  f*=1-0.7*(L.pp||0)/100;
  const why=[];
  if(hb!=null&&hb>60)why.push('horizonte tapado hacia el sol');
  if(hm>=30&&hm<=70)why.push('nubes medias y altas que pueden encenderse');
  else if(hm<10)why.push('cielo limpio: tonos suaves, sin nubes que se iluminen');
  else if(hm>85)why.push('cielo muy cubierto');
  if(L.low>50)why.push('muchas nubes bajas');
  if((L.pp||0)>=40)why.push('posible lluvia');
  return{score:Math.round(100*f),why};}
function destPoint(lat,lng,az,km){const R=6371,d=km/R,b=az*rad,p1=lat*rad,l1=lng*rad;
  const p2=Math.asin(Math.sin(p1)*Math.cos(d)+Math.cos(p1)*Math.sin(d)*Math.cos(b));
  const l2=l1+Math.atan2(Math.sin(b)*Math.sin(d)*Math.cos(p1),Math.cos(d)-Math.sin(p1)*Math.sin(p2));
  return[+(p2/rad).toFixed(3),+(l2/rad).toFixed(3)];}
/* Nubes bajas y medias a 80 km hacia el ocaso y hacia el orto */
async function getHorizonPts(pl,setAz,riseAz){
  try{const W=destPoint(pl.lat,pl.lng,setAz,80),E=destPoint(pl.lat,pl.lng,riseAz,80);
    const j=await (await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${W[0]},${E[0]}&longitude=${W[1]},${E[1]}&hourly=cloud_cover_low,cloud_cover_mid&forecast_days=8&timezone=auto&timeformat=unixtime`)).json();
    if(!Array.isArray(j))return null;
    const idx=o=>{const m={};o.hourly.time.forEach((t,i)=>m[t]={low:o.hourly.cloud_cover_low[i]??0,mid:o.hourly.cloud_cover_mid[i]??0});return m;};
    return{set:idx(j[0]),rise:idx(j[1])};}catch(_){return null;}}
/* Potencial de color usando la hora previa al ocaso (o posterior al orto) */
function glowFromHourly(H,hz,ms,which){const t=Math.round((ms+(which==='set'?-1800e3:1800e3))/3600e3)*3600,i=H.time.indexOf(t);if(i<0)return null;
  const L={low:H.cloud_cover_low[i]??0,mid:H.cloud_cover_mid[i]??0,high:H.cloud_cover_high[i]??0,pp:H.precipitation_probability[i]??0};
  const Hz=hz?hz[t]:null;return Object.assign(glowScore(L,Hz),{hz:!!Hz});}
/* Tormentas en un intervalo, a partir de la previsión horaria */
function stormsBetween(H,t0,t1){const hs=[];for(let i=0;i<H.time.length;i++){const ms=H.time[i]*1000;if(ms<t0||ms>=t1)continue;
  hs.push({ms,code:H.weather_code?.[i]??0,cape:H.cape?.[i]??0,pp:H.precipitation_probability[i]??0});}return stormInfo(hs);}
const fmtHO=(ms,off)=>{const d=new Date(ms+off*1000);return String(d.getUTCHours()).padStart(2,'0')+':'+String(d.getUTCMinutes()).padStart(2,'0');};


/* ---- Usuarios: todos los de Supabase (si está configurado) o el sitios.json del repositorio ---- */
const SB_URL=process.env.SUPABASE_URL, SB_KEY=process.env.SUPABASE_SERVICE_KEY;
let usuarios=[];
if(SB_URL&&SB_KEY){
  const h={apikey:SB_KEY};if(SB_KEY.startsWith('eyJ'))h.Authorization='Bearer '+SB_KEY;
  const r=await fetch(`${SB_URL.replace(/\/$/,'')}/rest/v1/perfiles?select=email,config`,{headers:h});
  if(!r.ok){console.error('Supabase',r.status,await r.text());process.exit(1);}
  usuarios=(await r.json()).map(x=>Object.assign({email:x.email},x.config||{}));
  console.log('Usuarios en Supabase:',usuarios.length);
}else{
  usuarios=[JSON.parse(fs.readFileSync(new URL('./sitios.json',import.meta.url),'utf8'))];
}
const momento=process.env.MOMENTO||(new Date().getUTCHours()<12?'manana':'tarde');
console.log('Momento:',momento);

/* La previsión de un mismo sitio se descarga una sola vez aunque lo tengan varios usuarios */
const cacheF=new Map(),cacheH=new Map();
const prev=pl=>{const k=pl.lat.toFixed(3)+','+pl.lng.toFixed(3);if(!cacheF.has(k))cacheF.set(k,getForecast(pl));return cacheF.get(k);};
const horiz=(pl,a,b)=>{const k=pl.lat.toFixed(3)+','+pl.lng.toFixed(3);if(!cacheH.has(k))cacheH.set(k,getHorizonPts(pl,a,b));return cacheH.get(k);};

async function procesar(cfg){
  const umbral=cfg.umbral||70, modo=cfg.modo||'deep', ventana=cfg.ventana||2;
  const av=Object.assign({noche:true,atardecer:true,amanecer:true,tormentas:true},cfg.avisos||{});
  const toca=k=>av[k]&&(momento==='todo'||(momento==='manana'?['atardecer','tormentas']:['noche','amanecer','tormentas']).includes(k));
  if(!cfg.topic||/PEGA/i.test(cfg.topic)||!cfg.sitios?.length)return'sin tema o sin sitios';
  const items=[],manana=[];
  for(const pl of cfg.sitios){
    let f;try{f=await prev(pl);}catch(e){console.error('Error en',pl.name,e.message);continue;}
    const {wx,aqIdx}=f,off=wx.utc_offset_seconds,H=wx.hourly,fh=ms=>fmtHO(ms,off);
    const today=new Date(Date.now()+off*1000).toISOString().slice(0,10);
    const ev=sunEvents(pl,today,off);
    const n=nightsFor(pl,wx,aqIdx,modo,ventana,umbral);
    if(toca('noche')&&n[0]){
      if(n[0].best>=umbral){const c=calima(n[0]);
        items.push({prio:3,icon:'✨',site:pl.name,score:n[0].best,text:`${pl.name}: noche ${n[0].best}/100 · ${n[0].W>=n[0].dark?'toda la noche':'tramo de '+n[0].W+' h'} ${fh(n[0].start)}–${fh(n[0].end)} · ${n[0].goodH} h buenas seguidas · nubes ${n[0].cloud}% · luna ${Math.round(n[0].illum*100)}%${c.bad?' · calima '+['','leve','moderada','fuerte'][c.bad]:''}`});}
      else if(n[1]&&n[1].best>=umbral)manana.push(`${pl.name} ${n[1].best}`);
    }
    if(toca('atardecer')||toca('amanecer')){
      const hz=await horiz(pl,ev.set.az,ev.rise.az);
      if(toca('atardecer')&&ev.set.sun&&ev.set.sun>Date.now()){const g=glowFromHourly(H,hz?hz.set:null,ev.set.sun,'set');
        if(g&&g.score>=umbral)items.push({prio:2,icon:'🌅',site:pl.name,score:g.score,text:`${pl.name}: atardecer ${g.score}/100 a las ${fh(ev.set.sun)} (hora dorada desde ${fh(ev.set.gold)}) · ${g.why.join(', ')}`});}
      if(toca('amanecer')&&ev.rise.sun){const g=glowFromHourly(H,hz?hz.rise:null,ev.rise.sun,'rise');
        if(g&&g.score>=umbral)items.push({prio:2,icon:'🌄',site:pl.name,score:g.score,text:`${pl.name}: amanecer ${g.score}/100 a las ${fh(ev.rise.sun)} (hora azul desde ${fh(ev.rise.blue)}) · ${g.why.join(', ')}`});}
    }
    if(toca('tormentas')){
      const t0=Date.now(),t1=momento==='manana'?t0+18*3600e3:t0+16*3600e3;
      const st=stormsBetween(H,t0,t1);
      if(st&&st.level>=2)items.push({prio:4,icon:'⚡',site:pl.name,score:st.level,text:`${pl.name}: ${st.level>=3?'tormenta fuerte (posible granizo)':'tormenta prevista'} ${fh(st.start)}–${fh(st.end)}`});
    }
  }
  if(!items.length&&!manana.length)return'nada que avisar';
  items.sort((a,b)=>b.prio-a.prio||b.score-a.score);
  let title,tags,priority=3;
  if(items.length){const t=items[0],kinds=[...new Set(items.map(i=>i.icon))].join('');
    title=t.icon==='⚡'?`⚡ Tormenta en ${t.site}`:t.icon==='✨'?`✨ Buena noche en ${t.site} (${t.score}/100)`:t.icon==='🌅'?`🌅 Buen atardecer en ${t.site} (${t.score}/100)`:`🌄 Buen amanecer en ${t.site} (${t.score}/100)`;
    if(items.length>1)title+=` ${kinds}`;
    tags=[t.icon==='⚡'?'zap':t.icon==='✨'?'milky_way':'sunrise'];priority=t.prio>=3?4:3;}
  else{title=`🔭 Mañana pinta bien en ${manana[0].replace(/ \d+$/,'')}`;tags=['telescope'];}
  let message=items.map(i=>i.icon+' '+i.text).join('\n');
  if(manana.length)message+=(message?'\n':'')+`🔭 Noche de mañana: ${manana.join(', ')}`;
  const r=await fetch('https://ntfy.sh/',{method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({topic:cfg.topic,title,message,tags,priority,click:cfg.app||undefined})});
  return `aviso enviado (${r.status}): ${title}`;
}

let i=0;
for(const u of usuarios){i++;
  try{console.log(`Usuario ${i}:`,await procesar(u));}catch(e){console.error(`Usuario ${i}: error`,e.message);}
}
