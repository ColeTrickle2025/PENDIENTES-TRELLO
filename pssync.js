/* ============================================================
   pssync.js  ·  Lógica compartida del Power-Up Power Supply
   Parsing del export, modelo de pendiente, diff y marcador.
   Expone window.PS
   ============================================================ */
(function(){
'use strict';

/* ---------- limpieza de celdas / encoding ---------- */
function cleanCell(v){
  if(v===undefined||v===null) return '';
  v=String(v).trim();
  const m=v.match(/^="(.*)"$/s);          // truco Excel ="0013"
  if(m) v=m[1];
  return v.replace(/""/g,'"').trim();
}
function decodeBytes(buf){
  const utf8=new TextDecoder('utf-8',{fatal:false}).decode(buf);
  if(utf8.includes('\uFFFD')) return new TextDecoder('windows-1252').decode(buf);
  return utf8;
}
function parseCSV(text){
  const fl=text.slice(0,2000);
  const delim=(fl.split(';').length>=fl.split(',').length)?';':',';
  const rows=[]; let row=[],field='',q=false;
  for(let i=0;i<text.length;i++){const c=text[i];
    if(q){ if(c==='"'){ if(text[i+1]==='"'){field+='"';i++;} else q=false; } else field+=c; }
    else{ if(c==='"')q=true; else if(c===delim){row.push(field);field='';}
      else if(c==='\n'){row.push(field);rows.push(row);row=[];field='';}
      else if(c==='\r'){} else field+=c; } }
  if(field.length||row.length){row.push(field);rows.push(row);}
  return rows.filter(r=>r.length>1||(r.length===1&&r[0].trim()!==''));
}
async function readFile(file){
  const buf=await file.arrayBuffer();
  let matrix;
  if(/\.xlsx?$/i.test(file.name) && window.XLSX){
    const wb=XLSX.read(buf,{type:'array'});
    const ws=wb.Sheets[wb.SheetNames[0]];
    matrix=XLSX.utils.sheet_to_json(ws,{header:1,raw:false,defval:''});
  }else{
    matrix=parseCSV(decodeBytes(new Uint8Array(buf)));
  }
  const headers=matrix[0].map(h=>String(h).trim());
  const rows=matrix.slice(1).map(r=>{const o={};headers.forEach((h,i)=>o[h]=cleanCell(r[i]));return o;})
    .filter(o=>col(o,'Pedido SAP')||col(o,'Puesto')||col(o,'Referencia'));
  return {headers,rows};
}

/* ---------- acceso tolerante a columnas ---------- */
const ALIASES={
  'Pedido SAP':['Pedido SAP','Pedido SAP / CSPS','Pedido SAP/CSPS'],
  'Puesto':['Puesto','Position','Poste'],
  'Referencia':['Referencia','Reference','Référence'],
  'Designacion':['Designacion','Designación','Designation','Détail','Detalle'],
  'Cantidad':['Cantidad','Qty','Quantité'],
  'Fecha de entrega':['Fecha de entrega','Detalle fecha','Delivery date'],
  'Estado':['Estado','Status','Statut'],
  'Prioridad':['Prioridad','Priority','Priorité'],
  'Aviso':['Aviso','Reclamacion','Reclamación','Ticket'],
  'Numero de pedido':['Numero de pedido','Número de pedido','Pedido local'],
  'OT':['Workshop Repare Order Number','Workshop Repair Order Number','Numero de Orden de Reparación','Orden de reparación','Repair Order'],
  'Fecha de pedido':['Fecha de pedido','Date','Fecha'],
  'VIN':['VIN'],'Model':['Model','Modelo'],
  'Tipo de pieza':['Tipo de pieza','Tipo de PR'],
  'Fiabilidad':['Fiabilidad','Fiabilité','Reliability'],
  'Alt. PNR':['Alt. PNR','Alternativa','Alternative'],
  'Reason For VOR - Explanation':['Reason For VOR - Explanation','Motivo VOR','Razón VOR'],
  'Reason For VOR - Category':['Reason For VOR - Category','Categoria VOR']
};
function col(o,name){ for(const a of (ALIASES[name]||[name])) if(a in o && o[a]!=='') return o[a]; return ''; }

/* ---------- traducción a castellano (normaliza EN/FR del export) ---------- */
var DICT={
  'en cours de preparation par psa':'En preparación por Stellantis',
  'being prepared by stellantis':'En preparación por Stellantis',
  'to be cancelled in the dms':'Anular en el DMS',
  'a annuler dans le dms':'Anular en el DMS',
  'not available (shortage)':'No disponible (penuria)',
  'unavailable (shortage)':'No disponible (penuria)',
  'initial part maintained':'Pieza inicial mantenida',
  'initial part retained':'Pieza inicial mantenida',
  'pending treatment':'Pendiente de tratar',
  'to be processed':'Pendiente de tratar',
  'no reliable forecast':'Sin previsión fiable',
  'incalculable delay':'Plazo incalculable',
  'en cours de réception':'En recepción',
  'en cours de reception':'En recepción',
  'non déterminé':'Sin determinar',
  'non determine':'Sin determinar',
  'not determined':'Sin determinar',
  'no forecast':'Sin previsión',
  'a traiter':'Pendiente de tratar',
  'in receipt':'En recepción'
};
function es(s){
  if(!s) return s; var x=String(s);
  for(var k in DICT){ x=x.replace(new RegExp(k.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'ig'), DICT[k]); }
  return x;
}

/* ---------- modelo ---------- */
function keyOf(o){ return (col(o,'Pedido SAP')+'-'+col(o,'Puesto')).trim(); }
function snapOf(o){ return {est:es(col(o,'Estado')),ent:es(col(o,'Fecha de entrega')),cant:col(o,'Cantidad'),prio:col(o,'Prioridad'),alt:col(o,'Alt. PNR'),ot:col(o,'OT')}; }
function snapDiff(a,b){
  const lab={est:'Estado',ent:'ETA/Entrega',cant:'Cantidad',prio:'Prioridad',alt:'Alternativa'};
  const out=[]; for(const k in lab){const x=es((a&&a[k])||''),y=es((b&&b[k])||''); if(x!==y) out.push({campo:lab[k],de:x||'∅',a:y||'∅'});}
  return out;
}
function cardName(o){
  const c=col(o,'Cantidad'),r=col(o,'Referencia'),d=col(o,'Designacion');
  return (r+' · '+d+(c&&c!=='1'?' ×'+c:'')).slice(0,250);
}
function isVI(o){ return !!col(o,'VIN'); }

/* ---------- detección de marca: 1º por cuenta cliente, 2º por modelo ---------- */
function detectBrand(rows){
  var acc=(typeof window!=='undefined' && window.PS_CONFIG && window.PS_CONFIG.ACCOUNTS) || {};
  for(var i=0;i<rows.length;i++){
    var c=String(col(rows[i],'Cuenta cliente')||'').split('-')[0].trim();
    if(acc[c]) return acc[c];
  }
  var rx=[['Opel',/\bOPEL\b/i],['Peugeot',/\bPEUGEOT\b/i],['Citroën',/\bCITRO/i],['DS',/\bDS\b/i],['Fiat',/\bFIAT\b/i]];
  for(var k=0;k<rows.length;k++){
    var m=(col(rows[k],'Model')||'')+' '+(rows[k]['Model & Chassis']||'');
    for(var j=0;j<rx.length;j++) if(rx[j][1].test(m)) return rx[j][0];
  }
  return '';
}

/* ---------- marcador en descripción ----------
   Bloque al final de la desc:
     ─── no editar ───
     PSKEY=sap-puesto
     PSSNAP={...}
     PSFLAG=YYYY-MM-DD            (fecha del último cambio; ausente si nunca cambió)
     PSLOG=[{d,c:[{campo,de,a}]}] (historial, máx 20)
*/
const SEP='─── no editar (Power Supply) ───';
function buildDesc(o,key,snap,flag,log,brand){
  const L=k=>col(o,k);
  const vor=L('VIN')?`\n**VI/VOR:** ${L('VIN')} — ${L('Model')||''}\n> ${L('Reason For VOR - Explanation')||''} (${L('Reason For VOR - Category')||''})`:'';
  const human=
`**Marca:** ${brand||'—'}
**Referencia:** ${L('Referencia')}  ·  **Cant.:** ${L('Cantidad')}
**Designación:** ${L('Designacion')}
**Estado:** ${es(L('Estado'))}
**Entrega / ETA:** ${es(L('Fecha de entrega'))}  ${L('Fiabilidad')?'· '+L('Fiabilidad'):''}
**Prioridad:** ${L('Prioridad')||'—'}  ·  **Tipo:** ${L('Tipo de pieza')||'—'}
**Pedido SAP:** ${L('Pedido SAP')} / Puesto ${L('Puesto')}  ·  **Aviso:** ${L('Aviso')||'—'}
**OT:** ${L('OT')||'—'}  ·  **Nº pedido:** ${L('Numero de pedido')||'—'}  ·  **Fecha pedido:** ${L('Fecha de pedido')||'—'}
${L('Alt. PNR')?'**Alternativa propuesta:** '+L('Alt. PNR'):''}${vor}`;
  let block='\n\n'+SEP+'\nPSKEY='+key;
  if(brand) block+='\nPSBRAND='+brand;
  block+='\nPSSNAP='+JSON.stringify(snap);
  if(flag) block+='\nPSFLAG='+flag;
  if(log && log.length) block+='\nPSLOG='+JSON.stringify(log.slice(-20));
  return (human+block).slice(0,16000);
}
function parseMarker(desc){
  desc=desc||'';
  const mk=desc.match(/PSKEY=([^\n]+)/); if(!mk) return null;
  const mbr=desc.match(/PSBRAND=([^\n]+)/);
  const ms=desc.match(/PSSNAP=(\{[\s\S]*?\})\s*(?:\n|$)/);
  const mf=desc.match(/PSFLAG=([0-9-]+)/);
  const ml=desc.match(/PSLOG=(\[[\s\S]*?\])\s*$/);
  let snap=null,log=[]; try{snap=ms?JSON.parse(ms[1]):null;}catch(e){} try{log=ml?JSON.parse(ml[1]):[];}catch(e){}
  return {key:mk[1].trim(), brand:mbr?mbr[1].trim():'', snap, flag:mf?mf[1]:null, log};
}

/* ---------- fechas ---------- */
function parseDue(eta){
  const iso=(eta||'').match(/\d{4}-\d{2}-\d{2}/g);
  if(iso&&iso.length) return iso[iso.length-1]+'T17:00:00.000Z';
  return null;
}
function today(){ const d=new Date(); return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); }

/* ---------- color de estado para badges ---------- */
function estadoColor(snap){
  const e=es((snap&&snap.est)||'').toLowerCase(), t=es((snap&&snap.ent)||'').toLowerCase();
  if(/anular/.test(e)) return 'red';
  if(/penuria|no disponible/.test(t)) return 'red';
  if(/incalculable|sin previs|sin determin|ninguna previs|no determin/.test(t)) return 'orange';
  if(/prepar/.test(e)) return 'green';
  if(/con clave|clave/.test(t)) return 'purple';
  return 'blue';
}
function etaShort(snap){
  const t=(snap&&snap.ent)||'';
  const iso=t.match(/\d{4}-\d{2}-\d{2}/g);
  if(iso) return iso[iso.length-1].split('-').reverse().join('/');
  return t.replace(/Distribucion controlada.*/i,'Campaña seg.').slice(0,22);
}

/* ---------- clasificación en columnas (cubos de estado) ---------- */
var BUCKETS=[
  {code:'prep',    label:'🟢 En preparación'},
  {code:'fecha',   label:'📅 Con fecha estimada'},
  {code:'sinprev', label:'🟠 Sin previsión'},
  {code:'stock',   label:'🔴 Sin stock / a anular'},
  {code:'alt',     label:'↔ Alternativa propuesta'},
  {code:'gone',    label:'✅ Resueltos / desaparecidos'}
];
function bucket(snap){
  var e=es((snap&&snap.est)||'').toLowerCase(), t=es((snap&&snap.ent)||'').toLowerCase(), a=(snap&&snap.alt)||'';
  if(a) return 'alt';
  if(/anular/.test(e)) return 'stock';
  if(/penuria|no disponible/.test(t)) return 'stock';
  if(/prepar/.test(e)) return 'prep';
  if(/\d{4}-\d{2}-\d{2}/.test(t)) return 'fecha';
  return 'sinprev';
}
function bucketLabel(code){ for(var i=0;i<BUCKETS.length;i++) if(BUCKETS[i].code===code) return BUCKETS[i].label; return code; }

window.PS={readFile,col,keyOf,snapOf,snapDiff,cardName,isVI,detectBrand,buildDesc,parseMarker,parseDue,today,estadoColor,etaShort,es,bucket,bucketLabel,BUCKETS,SEP};
})();
