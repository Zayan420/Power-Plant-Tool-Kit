const $=id=>document.getElementById(id);const now=new Date();const today=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
const esc=s=>String(s??'').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;');
const ls={get:k=>{try{return localStorage.getItem(k)}catch{return null}},set:(k,v)=>{try{localStorage.setItem(k,v)}catch{}},del:k=>{try{localStorage.removeItem(k)}catch{}}};

// ================= Settings, formulas, parameters =================
const SETTINGS_KEY='powerPlantToolkitSettingsV3';
const FORMULA_DEFS={
  feeder:{label:'Feeder Energy — Per Feeder',def:'(current-previous)*mf',vars:['previous','current','mf'],help:'previous / current = meter readings; mf = Multiplying Factor (MF).'},
  total:{label:'Feeder Energy — Total (Common MF)',def:'diffsum*mf',vars:['diffsum','mf'],help:'diffsum = sum of (current − previous) of all feeders; mf = Common MF. Used only when Common MF is ON.'},
  dailyMeter:{label:'Daily Meter Energy — Per Meter',def:'(end-start)*mf',vars:['start','end','mf'],help:'start = 00:00 reading; end = 24:00 reading; mf = Multiplying Factor (MF).'},
  auxPct:{label:'Auxiliary Consumption — % of Generation',def:'total/gen*100',vars:['total','gen'],help:'total = total auxiliary load (W); gen = total generation (W).'},
  opHours:{label:'Operating Hours — Daily Total (minutes)',def:'min(total,1440)',vars:['total'],help:'total = sum of all periods in minutes. Default limits the daily total to 24 h (1440 min). Use "total" alone for no limit.'}
};
const MATHF={abs:Math.abs,min:Math.min,max:Math.max,round:Math.round,sqrt:Math.sqrt,pow:Math.pow,floor:Math.floor,ceil:Math.ceil};
const PARAM_DEFS=[
  {k:'kilo',label:'Prefix multiplier — kilo (k)',def:1000,min:1e-12,int:false},
  {k:'mega',label:'Prefix multiplier — mega (M)',def:1000000,min:1e-12,int:false},
  {k:'energyDecimals',label:'Energy results — maximum decimals',def:4,min:0,max:10,int:true},
  {k:'auxDecimals',label:'Auxiliary results — decimals',def:2,min:0,max:10,int:true}
];
const TAB_LIST=[['hours','⏱️ Operating Hours'],['aux','⚡ Auxiliary Power'],['energy','📈 Feeder Energy'],['records','🗂️ Saved Records'],['formulas','🧮 Formulas']];
function defaultSettings(){const f={};Object.keys(FORMULA_DEFS).forEach(k=>f[k]=FORMULA_DEFS[k].def);const t={};TAB_LIST.forEach(([k])=>t[k]=true);const p={baseUnit:'kWh',showOther:false};PARAM_DEFS.forEach(d=>p[d.k]=d.def);return {tabs:t,formulas:f,params:p}}
function loadSettings(){const d=defaultSettings();try{const s=JSON.parse(ls.get(SETTINGS_KEY)||'{}');const p={...d.params,...(s.params||{})};if(!['Wh','kWh','MWh'].includes(p.baseUnit))p.baseUnit='kWh';return {tabs:{...d.tabs,...(s.tabs||{})},formulas:{...d.formulas,...(s.formulas||{})},params:p}}catch{return d}}
let settings=loadSettings();
const P=()=>settings.params;
function saveSettings(){ls.set(SETTINGS_KEY,JSON.stringify(settings));markDirty()}
function compileFormula(expr,vars){
  if(!expr||!expr.trim())throw new Error('Formula is empty');
  if(!/^[0-9A-Za-z_+\-*\/().,%<>=!&|?:\s]*$/.test(expr))throw new Error('Unsupported character');
  const ids=expr.replace(/\b\d+(\.\d+)?([eE][+-]?\d+)?\b/g,' ').match(/[A-Za-z_]\w*/g)||[];
  ids.forEach(id=>{if(!vars.includes(id)&&!(id in MATHF))throw new Error('Unknown name: '+id)});
  return new Function(...vars,...Object.keys(MATHF),'"use strict";return ('+expr+');');
}
function runFormula(expr,name,vals){const d=FORMULA_DEFS[name];return compileFormula(expr,d.vars)(...d.vars.map(v=>vals[v]),...Object.values(MATHF))}
function F(name,vals){try{return runFormula(settings.formulas[name],name,vals)}catch(e){return runFormula(FORMULA_DEFS[name].def,name,vals)}}

// ================= Time input =================
function timeMask(v){let d=String(v||'').replace(/\D/g,'');if(d.length&&d[0]>'2')d='0'+d;d=d.slice(0,4);if(d.length>2)d=d.slice(0,2)+':'+d.slice(2);return d}
function timeError(v,final){
  const d=String(v||'').replace(/\D/g,'');if(!d)return '';
  if(d.length>=2&&Number(d.slice(0,2))>24)return 'Hour must be 00–24 (e.g. 12:58)';
  if(d.length>=3&&Number(d[2])>5)return 'Minutes must be 00–59 (12:88 is invalid)';
  if(d.length===4&&Number(d.slice(2))>59)return 'Minutes must be 00–59';
  if(d.slice(0,2)==='24'&&d.length>=3&&Number(d.slice(2).padEnd(2,'0'))>0)return 'After 24:00 use 00:10 or 01:10';
  if(final&&d.length<4)return 'Enter full time: HH:MM';
  return '';
}
function showTimeError(inp,final){const m=timeError(inp.value,final);inp.classList.toggle('invalid',!!m);const l=inp.closest('label'),t=l&&l.querySelector('.terr');if(t)t.textContent=m;return !m}
function timeField(label,id){return `<label>${label}<div class="timewrap"><input id="${id}" type="text" inputmode="numeric" class="time-input" autocomplete="off" maxlength="5"><button type="button" class="secondary nowbtn" data-now="${id}">Now</button></div><small class="terr"></small></label>`}
document.addEventListener('input',e=>{const t=e.target;if(t.classList&&t.classList.contains('time-input')){let p=t.selectionStart,old=t.value;t.value=timeMask(old);if(old.length<t.value.length&&p===3)t.setSelectionRange(4,4);showTimeError(t,false)}});
document.addEventListener('focusout',e=>{const t=e.target;if(t.classList&&t.classList.contains('time-input'))showTimeError(t,true)});
document.addEventListener('click',e=>{const b=e.target.closest&&e.target.closest('[data-now]');if(!b)return;const i=$(b.dataset.now),d=new Date();i.value=String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0');showTimeError(i,true);i.dispatchEvent(new Event('input',{bubbles:true}))});
document.querySelectorAll('.tab').forEach(b=>b.addEventListener('click',()=>{document.querySelectorAll('.tab').forEach(x=>x.classList.toggle('active',x===b));document.querySelectorAll('.panel').forEach(x=>x.classList.toggle('active',x.id===b.dataset.tab));}));
function card(container,title,fields,remove=true){let d=document.createElement('div');d.className='rowcard';d.innerHTML=`<div class="rowhead"><span>${title}</span>${remove?'<button class="secondary remove">Remove</button>':''}</div><div class="rowfields">${fields}</div>`;if(remove)d.querySelector('.remove').onclick=()=>d.remove();$(container).appendChild(d);return d}
function field(label,id,placeholder='',type='number',value=''){return `<label>${label}<input id="${id}" type="${type}" ${type==='number'?'step="any"':''} placeholder="${placeholder}" value="${value}"></label>`}

// ================= Operating hours =================
let periodCount=0;function addPeriod(){let n=++periodCount;card('periods',`Period ${n}`,timeField('Start (HH:MM)',`hs${n}`)+timeField('Stop (HH:MM)',`he${n}`))}
addPeriod();$('addPeriod').onclick=addPeriod;
function mins(v){if(!/^\d{2}:\d{2}$/.test(v||''))return null;let [h,m]=v.split(':').map(Number);if(h>24||m>59||(h===24&&m!==0))return null;return h*60+m}
function calcHours(){
  let sum=0,err=false,periods=[];
  document.querySelectorAll('#periods .time-input').forEach(i=>showTimeError(i,true));
  document.querySelectorAll('#periods .rowcard').forEach(c=>{let ins=c.querySelectorAll('input'),a=mins(ins[0].value),b=mins(ins[1].value);if(!ins[0].value&&!ins[1].value)return;if(a===null||b===null){err=true;return}periods.push({start:ins[0].value,stop:ins[1].value});if(b<a)b+=1440;sum+=b-a});
  if(err){$('hoursTotal').textContent='Check time';$('hoursDecimal').textContent='Correct the highlighted time fields (e.g. 07:05).';return}
  const f=Number(F('opHours',{total:sum}));if(Number.isFinite(f)&&f>=0)sum=f;
  $('hoursTotal').textContent=`${String(Math.floor(sum/60)).padStart(2,'0')}:${String(Math.round(sum%60)).padStart(2,'0')}`;
  $('hoursDecimal').textContent=(sum/60).toFixed(2)+' hours';
  return {totalMinutes:sum,totalHours:Number((sum/60).toFixed(4)),periods}
}
$('calcHours').onclick=calcHours;
$('clearHours').onclick=()=>{if(!confirm('Clear all Operating Hours data in this tab?'))return;$('periods').innerHTML='';periodCount=0;addPeriod();$('hoursTotal').textContent='00:00';$('hoursDecimal').textContent='0.00 hours';$('hoursSaved').textContent=''};

// ================= Auxiliary power =================
let auxCount=0;function addAux(){let n=++auxCount;card('auxRows',`Bus ${n}`,field('Consumption',`av${n}`,'')+`<label>Unit<select id="au${n}"><option>kW</option><option>MW</option><option>W</option></select></label>`)}
function buildAux(){$('auxRows').innerHTML='';auxCount=0;for(let i=0;i<4;i++)addAux()}
buildAux();$('addAux').onclick=addAux;
function toW(v,u){return Number(v||0)*(u==='MW'?P().mega:u==='kW'?P().kilo:1)}
function calcAux(){
  let gen=toW($('generation').value,$('generationUnit').value),sum=0,items=[],d=P().auxDecimals;
  document.querySelectorAll('#auxRows .rowcard').forEach(c=>{let name=c.querySelector('.rowhead span').textContent,val=c.querySelector('input').value,unit=c.querySelector('select').value;sum+=toW(val,unit);items.push({name,value:Number(val||0),unit})});
  $('auxTotal').textContent=sum>=P().mega?(sum/P().mega).toFixed(d)+' MW':sum>=P().kilo?(sum/P().kilo).toFixed(d)+' kW':sum.toFixed(d)+' W';
  const pct=gen>0?Number(F('auxPct',{total:sum,gen})):0;
  $('auxPercent').textContent=pct.toFixed(d)+'% of generation';
  return {generationW:gen,items,totalW:sum,percent:pct,date:today}
}
$('calcAux').onclick=calcAux;
$('clearAux').onclick=()=>{if(!confirm('Clear all Auxiliary Power data in this tab?'))return;$('generation').value='';buildAux();$('auxTotal').textContent='0.00 W';$('auxPercent').textContent='0.00% of generation';$('auxSaved').textContent=''};

// ================= Energy units =================
const KIND_UNITS={active:['Wh','kWh','MWh'],reactive:['varh','kvarh','Mvarh']};
const UNIT_INFO={Wh:['active',0],kWh:['active',1],MWh:['active',2],varh:['reactive',0],kvarh:['reactive',1],Mvarh:['reactive',2]};
function uf(u){return [1,P().kilo,P().mega][UNIT_INFO[u][1]]}
function baseKey(kind){return KIND_UNITS[kind][['Wh','kWh','MWh'].indexOf(P().baseUnit)]}
function convertTo(v,disp){return v*uf(baseKey(UNIT_INFO[disp][0]))/uf(disp)}
function fmt(v){return Number(v).toLocaleString(undefined,{maximumFractionDigits:P().energyDecimals})}
function unitText(v,disp,showOthers){
  const main=`${fmt(convertTo(v,disp))} ${disp}`;
  if(!showOthers)return {main,others:''};
  return {main,others:KIND_UNITS[UNIT_INFO[disp][0]].filter(x=>x!==disp).map(x=>`${fmt(convertTo(v,x))} ${x}`).join(' | ')};
}
let energyCalculated=false,dailyCalculated=false;

// ================= Feeder energy: Common MF, feeders =================
function applyMf(){
  const on=$('mfCommonOn').checked;
  document.querySelectorAll('.mfwrap,.mfcol').forEach(e=>e.style.display=on?'none':'');
  $('commonMfWrap').style.display=on?'':'none';
}
function feederCards(){return [...document.querySelectorAll('#feederRows .rowcard')]}
function addFeeder(name='',prev='',cur='',mf=''){
  const c=card('feederRows',`<input class="fname" aria-label="Feeder name" value="${esc(name)}">`,
    `<label>Previous Reading<input class="fprev" type="number" step="any" value="${esc(prev)}"></label><label>Current Reading<input class="fcur" type="number" step="any" value="${esc(cur)}"></label><label class="mfwrap">MF<input class="fmf" type="number" min="0" step="any" value="${esc(mf)}"></label><div class="fres"></div>`);
  applyMf();return c;
}
function buildFeeders(){$('feederRows').innerHTML='';['TR1','TR2','TR3','TR4'].forEach(n=>addFeeder(n))}
buildFeeders();
$('addFeeder').onclick=()=>addFeeder(`TR${feederCards().length+1}`);

// ================= Daily meters (unlimited, Active / Reactive) =================
const DGROUPS=[{k:'dx',title:'Export',out:'dailyExport',sub:'dailyExportSub',key:'export'},{k:'di',title:'Import',out:'dailyImport',sub:'dailyImportSub',key:'import'}];
function fillUnits(sel,kind){sel.innerHTML=KIND_UNITS[kind].map(u=>`<option>${u}</option>`).join('');sel.value=KIND_UNITS[kind][1]}
function renumber(k){$(`grp_${k}`).querySelectorAll('tbody tr').forEach((tr,i)=>tr.querySelector('.mname').textContent='Meter '+(i+1))}
function addMeterRow(k){
  const tr=document.createElement('tr');
  tr.innerHTML='<td class="mname"></td><td><input class="ds" type="number" step="any"></td><td><input class="de" type="number" step="any"></td><td class="mfcol"><input class="dm" type="number" min="0" step="any"></td><td><button type="button" class="secondary rm" aria-label="Remove meter">✕</button></td>';
  tr.querySelector('.rm').onclick=()=>{tr.remove();renumber(k)};
  $(`grp_${k}`).querySelector('tbody').appendChild(tr);renumber(k);applyMf();
}
function buildDaily(){
  $('dailyMeters').innerHTML='';
  DGROUPS.forEach(g=>{
    const d=document.createElement('div');d.className='rowcard';d.id=`grp_${g.k}`;
    d.innerHTML=`<div class="rowhead">${g.title} — Meter Readings</div><div class="grid2"><label>Energy Type<select class="gtype"><option value="active">Active</option><option value="reactive">Reactive</option></select></label><label>Display Unit<select class="gunit"></select></label></div><div class="tablewrap"><table><thead><tr><th>Meter</th><th>00:00</th><th>24:00</th><th class="mfcol">MF</th><th></th></tr></thead><tbody></tbody></table></div><button type="button" class="secondary addm">＋ Add Meter</button>`;
    $('dailyMeters').appendChild(d);
    const ts=d.querySelector('.gtype'),us=d.querySelector('.gunit');fillUnits(us,'active');
    ts.onchange=()=>{fillUnits(us,ts.value);refreshEnergyViews()};us.onchange=refreshEnergyViews;
    d.querySelector('.addm').onclick=()=>addMeterRow(g.k);
    for(let i=0;i<4;i++)addMeterRow(g.k);
  });
}
buildDaily();
$('mfCommonOn').addEventListener('change',()=>{
  if(!$('mfCommonOn').checked){const v=$('commonMf').value;if(v!=='')document.querySelectorAll('.fmf,.dm').forEach(i=>{if(i.value==='')i.value=v})}
  applyMf();
});
applyMf();

// ================= Hourly calculation =================
function setEnergyError(msg){$('energyTotal').textContent='—';$('energySub').textContent=msg}
function calcEnergy(){
  ['pTime','cTime'].forEach(id=>showTimeError($(id),true));
  if(['pTime','cTime'].some(id=>timeError($(id).value,true))){setEnergyError('Check the reading times (HH:MM, 24-hour).');return {error:'time'}}
  const on=$('mfCommonOn').checked,cm=$('commonMf').value.trim();
  if(on&&cm===''){setEnergyError('Enter the Common MF.');return {error:'mf'}}
  const disp=$('hourUnit').value,feeders=[];let errs=0,diffsum=0,sumEnergy=0;
  feederCards().forEach(c=>{
    const name=c.querySelector('.fname').value.trim()||'Feeder',p=c.querySelector('.fprev').value.trim(),q=c.querySelector('.fcur').value.trim(),m=on?cm:c.querySelector('.fmf').value.trim(),res=c.querySelector('.fres');
    res.className='fres';res.textContent='';
    if(p===''&&q==='')return;
    let msg='';
    if(p===''||q==='')msg='Enter both Previous and Current readings.';
    else if(m==='')msg='Enter MF.';
    else if(Number(q)<Number(p))msg='Current reading is lower than Previous reading.';
    if(msg){res.className='fres bad';res.textContent=msg;errs++;return}
    const previous=Number(p),current=Number(q),mf=Number(m),diff=current-previous,energy=Number(F('feeder',{previous,current,mf}));
    diffsum+=diff;sumEnergy+=energy;feeders.push({name,previous,current,diff,mf,energy});
    const t=unitText(energy,disp,P().showOther);
    res.className='fres ok';res.textContent=`Δ ${fmt(diff)} × ${fmt(mf)} = ${t.main}`+(t.others?`  (${t.others})`:'');
  });
  if(errs){setEnergyError('Correct the highlighted feeders.');return {error:'feeder'}}
  if(!feeders.length){setEnergyError('Enter readings for at least one feeder.');return {error:'empty'}}
  const mfCommon=on?Number(cm):null,total=on?Number(F('total',{diffsum,mf:mfCommon})):sumEnergy,t=unitText(total,disp,P().showOther);
  $('energyTotal').textContent=t.main;
  $('energySub').textContent=`Total Δ ${fmt(diffsum)}`+(on?` × MF ${fmt(mfCommon)}`:' (individual MF)')+`  •  ${$('pTime').value||'--:--'} → ${$('cTime').value||'--:--'}`+(t.others?`\n${t.others}`:'');
  return {prevTime:$('pTime').value,curTime:$('cTime').value,unit:disp,commonMf:mfCommon,feeders,totalDifference:diffsum,total:Number(convertTo(total,disp).toFixed(6))}
}
$('calcEnergy').onclick=()=>{energyCalculated=true;calcEnergy()};

// ================= Daily calculation =================
function calcDailyMeters(silent){
  const on=$('mfCommonOn').checked,cm=$('commonMf').value.trim(),out={};
  try{
    DGROUPS.forEach(g=>{
      const root=$(`grp_${g.k}`),unit=root.querySelector('.gunit').value;let sum=0,meters=[];
      root.querySelectorAll('tbody tr').forEach((tr,i)=>{
        const sv=tr.querySelector('.ds').value.trim(),ev=tr.querySelector('.de').value.trim(),mv=on?cm:tr.querySelector('.dm').value.trim();
        if(sv===''&&ev==='')return;
        const lab=`${g.title} Meter ${i+1}`;
        if(sv===''||ev==='')throw new Error(`${lab}: enter both 00:00 and 24:00 readings.`);
        if(mv==='')throw new Error(on?'Enter the Common MF.':`${lab}: enter MF.`);
        const start=Number(sv),end=Number(ev),mf=Number(mv);
        if(end<start)throw new Error(`${lab}: 24:00 reading must not be lower than 00:00 reading.`);
        const energy=Number(F('dailyMeter',{start,end,mf}));sum+=energy;meters.push({start,end,mf,energy});
      });
      const t=unitText(sum,unit,P().showOther);
      $(g.out).textContent=t.main;$(g.sub).textContent=t.others;
      out[g.key]={type:root.querySelector('.gtype').value,unit,value:Number(convertTo(sum,unit).toFixed(6)),meters};
    });
    return out;
  }catch(e){if(silent!==true)alert(e.message)}
}
$('calcDailyMeters').onclick=()=>{dailyCalculated=true;calcDailyMeters()};
function refreshEnergyViews(){if(energyCalculated)calcEnergy();if(dailyCalculated)calcDailyMeters(true)}
$('hourUnit').addEventListener('change',refreshEnergyViews);

// ================= Remember readings / Next hour / Clear =================
const ENERGY_STATE_KEY='pptEnergyStateV3';
function saveEnergyState(){
  if(!$('rememberOn').checked){ls.set(ENERGY_STATE_KEY,JSON.stringify({on:false}));return}
  ls.set(ENERGY_STATE_KEY,JSON.stringify({on:true,pTime:$('pTime').value,cTime:$('cTime').value,unit:$('hourUnit').value,commonMf:$('commonMf').value,mfOn:$('mfCommonOn').checked,
    feeders:feederCards().map(c=>({name:c.querySelector('.fname').value,prev:c.querySelector('.fprev').value,cur:c.querySelector('.fcur').value,mf:c.querySelector('.fmf').value}))}));
}
function restoreEnergyState(){
  try{
    const s=JSON.parse(ls.get(ENERGY_STATE_KEY)||'null');if(!s||!s.on)return;
    $('rememberOn').checked=true;$('pTime').value=s.pTime||'';$('cTime').value=s.cTime||'';
    if(UNIT_INFO[s.unit])$('hourUnit').value=s.unit;
    $('commonMf').value=s.commonMf||'';$('mfCommonOn').checked=s.mfOn!==false;
    if(Array.isArray(s.feeders)&&s.feeders.length){$('feederRows').innerHTML='';s.feeders.forEach(f=>addFeeder(f.name,f.prev,f.cur,f.mf))}
    applyMf();
  }catch{}
}
restoreEnergyState();
['input','change'].forEach(ev=>$('energy').addEventListener(ev,saveEnergyState));
$('energy').addEventListener('click',()=>setTimeout(saveEnergyState,0));
function resetEnergyResults(){energyCalculated=false;dailyCalculated=false;$('energyTotal').textContent='0';$('energySub').textContent='Enter readings and press Calculate.';['dailyExport','dailyImport'].forEach(id=>$(id).textContent='0');['dailyExportSub','dailyImportSub'].forEach(id=>$(id).textContent='')}
$('nextHour').onclick=()=>{
  const cards=feederCards();
  if(!cards.some(c=>c.querySelector('.fcur').value.trim()!=='')){alert('Enter Current readings first, then use Next Hour.');return}
  $('pTime').value=$('cTime').value;$('cTime').value='';showTimeError($('pTime'),false);showTimeError($('cTime'),false);
  cards.forEach(c=>{c.querySelector('.fprev').value=c.querySelector('.fcur').value;c.querySelector('.fcur').value='';const r=c.querySelector('.fres');r.className='fres';r.textContent=''});
  energyCalculated=false;$('energyTotal').textContent='0';$('energySub').textContent='Enter the Current readings and press Calculate.';
  saveEnergyState();
};
$('clearEnergy').onclick=()=>{
  if(!confirm('Clear all Feeder Energy readings and results in this tab? (Common MF value is kept.)'))return;
  $('energyDate').value='';['pTime','cTime'].forEach(id=>{$(id).value='';showTimeError($(id),false)});
  buildFeeders();buildDaily();resetEnergyResults();$('energySaved').textContent='';saveEnergyState();
};

// ================= Saved records =================
const storeKey='powerPlantToolkitRecordsV1';function records(){try{return JSON.parse(ls.get(storeKey)||'[]')}catch{return []}}
function writeRecords(a){ls.set(storeKey,JSON.stringify(a));markDirty()}
function save(type,getter,outId){let data=getter();if(!data){alert('Please check inputs first');return}let all=records();all.unshift({id:Date.now(),type,savedAt:new Date().toISOString(),data});writeRecords(all);$(outId).textContent='Saved successfully on this device.';renderRecords()}
$('saveHours').onclick=()=>save('Operating Hours',calcHours,'hoursSaved');
$('saveAux').onclick=()=>save('Auxiliary Power',calcAux,'auxSaved');
$('saveEnergy').onclick=()=>save('Feeder Energy',()=>{const h=calcEnergy();if(h.error&&h.error!=='empty'){alert('Please correct the hourly readings first.');return null}return {date:$('energyDate').value,hourly:h.error?null:h,daily:calcDailyMeters(true)||null}},'energySaved');
function renderRecords(){$('recordList').innerHTML=records().map(r=>`<div class="record"><b>${esc(r.type)}</b> — ${esc(r.data&&(r.data.date||r.data.dg)||'')}<br>${new Date(r.savedAt).toLocaleString()} <button class="secondary" data-del="${r.id}">Delete</button></div>`).join('')||'<p class="muted">No saved records yet.</p>';$('recordList').querySelectorAll('[data-del]').forEach(b=>b.onclick=()=>{writeRecords(records().filter(r=>r.id!==Number(b.dataset.del)));renderRecords()})}
$('refreshRecords').onclick=renderRecords;
$('exportRecords').onclick=()=>{let blob=new Blob([JSON.stringify(records(),null,2)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='power-plant-toolkit-backup.json';a.click();URL.revokeObjectURL(a.href)};
$('clearRecords').onclick=()=>{if(confirm('Delete ALL saved records on this device? This cannot be undone.')){writeRecords([]);renderRecords()}};
renderRecords();

// ================= Tab visibility =================
function applyTabs(){
  let activeHidden=false,firstVisible=null;
  document.querySelectorAll('.tab').forEach(b=>{
    const k=b.dataset.tab,vis=k==='settings'||settings.tabs[k]!==false;
    b.style.display=vis?'':'none';
    if(vis&&!firstVisible)firstVisible=b;
    if(!vis&&b.classList.contains('active'))activeHidden=true;
  });
  if(activeHidden&&firstVisible)firstVisible.click();
}

// ================= Formulas tab (formulas + parameters) =================
function renderFormulas(){
  $('formulaList').innerHTML=Object.entries(FORMULA_DEFS).map(([k,d])=>`<div class="fbox"><b>${d.label}</b><small>${d.help}<br>Variables: ${d.vars.join(', ')} &nbsp;•&nbsp; Default: <code>${d.def}</code></small><input data-formula="${k}" value="${esc(settings.formulas[k])}" autocapitalize="off" autocomplete="off" spellcheck="false"><button class="secondary" data-reset="${k}">Restore Default</button></div>`).join('');
  $('formulaList').querySelectorAll('[data-formula]').forEach(inp=>inp.onchange=()=>{
    const k=inp.dataset.formula,d=FORMULA_DEFS[k];
    try{const fn=compileFormula(inp.value,d.vars);const r=fn(...d.vars.map(()=>1),...Object.values(MATHF));if(typeof r==='number'&&!Number.isFinite(r))throw new Error('Result is not a finite number');settings.formulas[k]=inp.value.trim();saveSettings();refreshEnergyViews()}
    catch(e){alert('Invalid formula: '+e.message);inp.value=settings.formulas[k]}
  });
  $('formulaList').querySelectorAll('[data-reset]').forEach(b=>b.onclick=()=>{settings.formulas[b.dataset.reset]=FORMULA_DEFS[b.dataset.reset].def;saveSettings();renderFormulas();refreshEnergyViews()});
  $('paramList').innerHTML=PARAM_DEFS.map(d=>`<label>${d.label} <small class="muted">(default ${d.def})</small><input data-param="${d.k}" type="number" step="any" value="${P()[d.k]}"></label>`).join('')+
   `<label>Meter reading × MF result is in<select id="baseUnit"><option value="Wh">Wh / varh</option><option value="kWh">kWh / kvarh</option><option value="MWh">MWh / Mvarh</option></select></label><label class="switch"><input type="checkbox" id="showOther"><span>Also show the other units in energy results</span></label>`;
  $('baseUnit').value=P().baseUnit;$('showOther').checked=P().showOther;
  $('paramList').querySelectorAll('[data-param]').forEach(inp=>inp.onchange=()=>{
    const d=PARAM_DEFS.find(x=>x.k===inp.dataset.param),v=Number(inp.value);
    if(inp.value.trim()===''||!Number.isFinite(v)||v<d.min||(d.max!==undefined&&v>d.max)||(d.int&&!Number.isInteger(v))){alert('Invalid value for: '+d.label);inp.value=P()[d.k];return}
    P()[d.k]=v;saveSettings();refreshEnergyViews();
  });
  $('baseUnit').onchange=()=>{P().baseUnit=$('baseUnit').value;saveSettings();refreshEnergyViews()};
  $('showOther').onchange=()=>{P().showOther=$('showOther').checked;saveSettings();refreshEnergyViews()};
}
$('resetFormulas').onclick=()=>{if(confirm('Restore ALL formulas and parameters to their defaults?')){const d=defaultSettings();settings.formulas=d.formulas;settings.params=d.params;saveSettings();renderFormulas();refreshEnergyViews()}};

// ================= Settings tab =================
function renderSettings(){
  $('tabToggles').innerHTML=TAB_LIST.map(([k,l])=>`<label class="switch"><input type="checkbox" data-tab-toggle="${k}" ${settings.tabs[k]!==false?'checked':''}><span>${l}</span></label>`).join('');
  $('tabToggles').querySelectorAll('[data-tab-toggle]').forEach(cb=>cb.onchange=()=>{settings.tabs[cb.dataset.tabToggle]=cb.checked;saveSettings();applyTabs()});
}
$('resetAllSettings').onclick=()=>{if(confirm('Reset tab visibility, formulas and parameters to default?')){settings=defaultSettings();saveSettings();renderSettings();renderFormulas();applyTabs();refreshEnergyViews()}};

// ================= Online backup (GitHub Gist) — offline-first =================
const BK={token:'pptBackupToken',id:'pptBackupGistId',auto:'pptBackupAuto',last:'pptBackupLast',dirty:'pptBackupDirty'};
const GIST_DESC='Power Plant Toolkit Backup',GIST_FILE='power-plant-toolkit-backup.json';
function mergeRecords(cur,incoming){const ids=new Set(cur.map(r=>r.id));return [...cur,...(incoming||[]).filter(r=>r&&!ids.has(r.id))].sort((a,b)=>b.id-a.id)}
function backupPayload(){return {app:'power-plant-toolkit',version:4,savedAt:new Date().toISOString(),records:records(),settings,energyState:ls.get(ENERGY_STATE_KEY)}}
function setBk(msg){$('bkStatus').textContent=msg}
function showBk(){
  if(!ls.get(BK.token)){setBk('Not connected. Offline use is fully available; add a token to enable online backup.');return}
  const l=ls.get(BK.last);
  setBk(`Connected • ${l?'Last backup: '+new Date(l).toLocaleString():'No backup yet'}${ls.get(BK.dirty)==='1'?' • Changes pending':''}${navigator.onLine?'':' • Offline'}`);
}
async function gh(path,opt={}){
  const t=ls.get(BK.token);if(!t)throw new Error('No token saved');
  const r=await fetch('https://api.github.com'+path,{...opt,headers:{'Accept':'application/vnd.github+json','Authorization':'Bearer '+t,'Content-Type':'application/json',...(opt.headers||{})}});
  if(!r.ok){let m='';try{m=(await r.json()).message}catch{}throw new Error(`GitHub ${r.status}${m?': '+m:''}`)}
  return r.json();
}
async function findGistId(){const g=(await gh('/gists?per_page=100')).find(x=>x.description===GIST_DESC);if(g){ls.set(BK.id,g.id);return g.id}return null}
let bkBusy=false,bkTimer=null;
async function backupNow(retry){
  if(!ls.get(BK.token)){setBk('Add a GitHub token first.');return false}
  if(!navigator.onLine){ls.set(BK.dirty,'1');showBk();return false}
  if(bkBusy)return false;bkBusy=true;
  try{
    setBk('Backing up…');
    const body={files:{[GIST_FILE]:{content:JSON.stringify(backupPayload(),null,2)}}};
    let id=ls.get(BK.id)||await findGistId();
    if(id){try{await gh('/gists/'+id,{method:'PATCH',body:JSON.stringify(body)})}catch(e){if(/GitHub 404/.test(e.message)&&!retry){ls.del(BK.id);bkBusy=false;return backupNow(true)}throw e}}
    else{const r=await gh('/gists',{method:'POST',body:JSON.stringify({description:GIST_DESC,public:false,...body})});ls.set(BK.id,r.id)}
    ls.set(BK.last,new Date().toISOString());ls.del(BK.dirty);showBk();return true;
  }catch(e){ls.set(BK.dirty,'1');setBk('Backup failed: '+e.message);return false}
  finally{bkBusy=false}
}
function markDirty(){
  if(!ls.get(BK.token))return;
  ls.set(BK.dirty,'1');
  if(ls.get(BK.auto)!=='0'){clearTimeout(bkTimer);bkTimer=setTimeout(()=>{if(navigator.onLine)backupNow()},5000)}
  try{showBk()}catch{}
}
async function restoreBackup(){
  if(!ls.get(BK.token)){setBk('Add a GitHub token first.');return}
  if(!navigator.onLine){setBk('You are offline. Connect to the internet to restore.');return}
  try{
    setBk('Looking for backup…');
    const id=ls.get(BK.id)||await findGistId();
    if(!id){setBk('No online backup found yet.');return}
    const g=await gh('/gists/'+id),f=g.files&&g.files[GIST_FILE];
    if(!f)throw new Error('Backup file not found in gist');
    const txt=f.truncated?await (await fetch(f.raw_url)).text():f.content,d=JSON.parse(txt);
    if(d.app!=='power-plant-toolkit')throw new Error('Not a Power Plant Toolkit backup');
    if(!confirm(`Restore backup from ${new Date(d.savedAt).toLocaleString()}?\nRecords are merged with the ones on this device; settings and formulas are replaced.`)){showBk();return}
    ls.set(storeKey,JSON.stringify(mergeRecords(records(),d.records)));
    if(d.settings)ls.set(SETTINGS_KEY,JSON.stringify(d.settings));
    if(d.energyState)ls.set(ENERGY_STATE_KEY,d.energyState);
    setBk('Restored. Reloading…');setTimeout(()=>location.reload(),700);
  }catch(e){setBk('Restore failed: '+e.message)}
}
$('bkConnect').onclick=async()=>{
  const t=$('bkToken').value.trim();if(!t){setBk('Paste your GitHub token first.');return}
  ls.set(BK.token,t);setBk('Checking token…');
  try{await gh('/gists?per_page=1');$('bkToken').value='';$('bkToken').placeholder='Token saved (hidden)';if(ls.get(BK.auto)===null)ls.set(BK.auto,'1');$('bkAuto').checked=ls.get(BK.auto)!=='0';await backupNow()}
  catch(e){ls.del(BK.token);setBk('Token rejected: '+e.message)}
};
$('bkNow').onclick=()=>backupNow();
$('bkRestore').onclick=restoreBackup;
$('bkAuto').onchange=()=>{ls.set(BK.auto,$('bkAuto').checked?'1':'0');if($('bkAuto').checked&&ls.get(BK.dirty)==='1')backupNow()};
$('bkDisconnect').onclick=()=>{if(confirm('Remove the token from this device? (The online backup itself is not deleted.)')){ls.del(BK.token);ls.del(BK.id);ls.del(BK.dirty);$('bkToken').placeholder='ghp_…';showBk()}};
window.addEventListener('online',()=>{if(ls.get(BK.dirty)==='1'&&ls.get(BK.auto)!=='0')backupNow();else showBk()});
window.addEventListener('offline',showBk);
$('bkAuto').checked=ls.get(BK.auto)!=='0';if(ls.get(BK.token))$('bkToken').placeholder='Token saved (hidden)';
setTimeout(()=>{if(ls.get(BK.token)&&ls.get(BK.dirty)==='1'&&ls.get(BK.auto)!=='0'&&navigator.onLine)backupNow()},3000);

renderSettings();renderFormulas();applyTabs();showBk();
if('serviceWorker'in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('sw.js').catch(()=>{}));
