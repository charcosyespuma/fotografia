// El Tiempo Esta Noche · aviso diario por ntfy
// Lo ejecuta GitHub Actions cada tarde. Lee sitios.json y envía una notificación
// si alguno de tus sitios tiene buena noche. El cálculo es el mismo que el de la app.
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
const WX_VARS='cloud_cover,cloud_cover_low,cloud_cover_mid,cloud_cover_high,relative_humidity_2m,dew_point_2m,temperature_2m,wind_speed_10m,wind_gusts_10m,visibility,precipitation_probability';
async function getForecast(pl){
  const aqP=fetch(`https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${pl.lat}&longitude=${pl.lng}&hourly=dust,aerosol_optical_depth&forecast_days=5&timezone=auto&timeformat=unixtime`).then(r=>r.json()).catch(()=>null);
  const wx=await (await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${pl.lat}&longitude=${pl.lng}&hourly=${WX_VARS}&forecast_days=8&timezone=auto&timeformat=unixtime`)).json();
  if(!wx.hourly)throw new Error(wx.reason||'sin datos');
  const aq=await aqP,aqIdx={};
  if(aq&&aq.hourly&&aq.hourly.time)aq.hourly.time.forEach((t,i)=>aqIdx[t]={dust:aq.hourly.dust[i],aod:aq.hourly.aerosol_optical_depth[i]});
  return{wx,aqIdx};
}
/* Agrupa las horas oscuras en noches y puntúa cada una por su mejor tramo de 2 h */
function nightsFor(pl,wx,aqIdx,mode){
  const H=wx.hourly,off=wx.utc_offset_seconds,now=Date.now(),g={};
  for(let i=0;i<H.time.length;i++){
    const ms=H.time[i]*1000;if(ms<now-3600e3)continue;
    const salt=sunAlt(ms,pl.lat,pl.lng);if(salt>-12)continue;
    const key=new Date(ms+off*1000-12*3600e3).toISOString().slice(0,10),mi=moonIllum(ms);
    const h={ms,salt,malt:moonAlt(ms,pl.lat,pl.lng),illum:mi.fraction,phase:mi.phase,
      low:H.cloud_cover_low[i]??0,mid:H.cloud_cover_mid[i]??0,high:H.cloud_cover_high[i]??0,total:H.cloud_cover[i]??0,
      rh:H.relative_humidity_2m[i]??0,td:H.dew_point_2m[i]??0,t:H.temperature_2m[i]??0,wind:H.wind_speed_10m[i]??0,
      gust:H.wind_gusts_10m[i]??0,vis:H.visibility?H.visibility[i]:null,pp:H.precipitation_probability[i]??0,
      dust:aqIdx[H.time[i]]?.dust??null,aod:aqIdx[H.time[i]]?.aod??null};
    h.s=hourScore(h,mode);(g[key]=g[key]||[]).push(h);
  }
  return Object.entries(g).filter(([,hs])=>hs.length>=3).slice(0,7).map(([key,hs])=>{
    let best=-1,bi=0;for(let i=0;i<hs.length-1;i++){const v=(hs[i].s+hs[i+1].s)/2;if(v>best){best=v;bi=i;}}
    const w=hs.slice(bi,bi+2);const wavg=k=>Math.round(w.reduce((a,h)=>a+h[k],0)/w.length);
    return{key,hs,best:Math.round(best),bi,bestms:hs[bi].ms+3600e3,start:hs[bi].ms,end:hs[Math.min(bi+1,hs.length-1)].ms+3600e3,
      cloud:wavg('total'),wind:wavg('wind'),rh:wavg('rh'),pp:Math.max(...hs.map(h=>h.pp)),
      illum:hs[Math.floor(hs.length/2)].illum,phase:hs[Math.floor(hs.length/2)].phase,moonUp:hs.filter(h=>h.malt>0).length,
      fog:w.some(h=>h.t-h.td<2),dust:w[0].dust==null?null:Math.round(Math.max(...w.map(h=>h.dust??0))),aod:w[0].aod==null?null:Math.max(...w.map(h=>h.aod??0)),
      tmin:Math.min(...hs.map(h=>h.t)),gust:Math.max(...hs.map(h=>h.gust))};
  });
}
const fmtHO=(ms,off)=>{const d=new Date(ms+off*1000);return String(d.getUTCHours()).padStart(2,'0')+':'+String(d.getUTCMinutes()).padStart(2,'0');};


const cfg=JSON.parse(fs.readFileSync(new URL('./sitios.json',import.meta.url),'utf8'));
const umbral=cfg.umbral||70, modo=cfg.modo||'deep';
if(!cfg.topic||!cfg.sitios?.length){console.log('sitios.json sin tema o sin sitios: nada que hacer');process.exit(0);}

const res=[];
for(const pl of cfg.sitios){
  try{const {wx,aqIdx}=await getForecast(pl);res.push({pl,n:nightsFor(pl,wx,aqIdx,modo),off:wx.utc_offset_seconds});}
  catch(e){console.error('Error en',pl.name,e.message);}
}
const linea=(r,n)=>{const c=calima(n);
  return `${r.pl.name}: ${n.best}/100 · ${fmtHO(n.start,r.off)}–${fmtHO(n.end,r.off)} · nubes ${n.cloud}% · luna ${Math.round(n.illum*100)}%${c.bad?' · calima '+['','leve','moderada','fuerte'][c.bad]:''}`;};

const hoy=res.filter(r=>r.n[0]&&r.n[0].best>=umbral).sort((a,b)=>b.n[0].best-a.n[0].best);
const manana=res.filter(r=>r.n[1]&&r.n[1].best>=umbral).sort((a,b)=>b.n[1].best-a.n[1].best);
let title,message,tags,priority=3;
if(hoy.length){
  title=`✨ Buena noche en ${hoy[0].pl.name} (${hoy[0].n[0].best}/100)`;
  message=hoy.map(r=>linea(r,r.n[0])).join('\n');
  if(manana.length)message+=`\nMañana también: ${manana.map(r=>r.pl.name+' '+r.n[1].best).join(', ')}`;
  tags=['milky_way'];priority=4;
}else if(manana.length){
  title=`🔭 Mañana pinta bien en ${manana[0].pl.name} (${manana[0].n[1].best}/100)`;
  message='Esta noche no llega a '+umbral+'.\n'+manana.map(r=>linea(r,r.n[1])).join('\n');
  tags=['telescope'];
}else if(cfg.avisarSiempre){
  title='☁️ Hoy no merece la pena';
  message=res.map(r=>r.n[0]?`${r.pl.name}: ${r.n[0].best}/100`:'').filter(Boolean).join('\n');
  tags=['cloud'];priority=2;
}else{console.log('Ninguna noche llega a',umbral,'— sin aviso');process.exit(0);}

console.log(title+'\n'+message);
const r=await fetch('https://ntfy.sh/',{method:'POST',headers:{'Content-Type':'application/json'},
  body:JSON.stringify({topic:cfg.topic,title,message,tags,priority,click:cfg.app||undefined})});
console.log('ntfy:',r.status);
