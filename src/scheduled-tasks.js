/* Scheduled plans are local configuration; no fabricated runs or browser timer execution. */
const ST={items:null,form:null,pick:null,query:'',filter:'all',search:false,filters:false,errors:[]};
const ST_TEMPLATES=[
 ['data','每日文献追踪','每天追踪课题相关新论文，汇总关键发现与原文链接。'],
 ['lab','实验数据周报','每周整理新增实验数据，汇总结果、异常与待办。'],
 ['model','候选序列评分','按计划使用指定模型评分，保存排序结果与运行记录。'],
 ['layers','课题进展汇总','定期汇总实验与模型任务，梳理下一步研究安排。'],
 ['data','数据集更新检查','定期检查已接入数据源，提示新增数据与版本变化。'],
 ['clock','自定义科研任务','描述任务内容与执行周期，安排自己的科研计划。']
];
const ST_PERIODS={once:'仅一次',daily:'每天',weekly:'每周',monthly:'每月'};
const ST_ZONES=['Asia/Shanghai','UTC','America/New_York'];
const stIcon=k=>'<img class="st-icon" src="assets/tasks/'+k+'.svg" alt="" width="20" height="20">';
function stBlank(){return {name:'',pid:DB.projects[0]?.id||'',content:'',sources:'PubMed · arXiv · 课题文献库',period:'daily',time:'08:30',zone:'Asia/Shanghai',weekday:5,monthday:1,date:'',destination:'papers',notify:true,enabled:true};}
function stLoad(){
 if(ST.items)return;
 const data=LS.get('scheduled_plans_v1',null);
 if(Array.isArray(data)){ST.items=data.filter(t=>t&&typeof t.id==='string'&&typeof t.name==='string'&&ST_PERIODS[t.period]&&ST_ZONES.includes(t.zone)&&/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(t.time)).map(t=>({...t,enabled:t.enabled===true}));return;}
 ST.items=[0,1,2,3].map((i)=>({...stBlank(),id:'schedule-example-'+i,name:ST_TEMPLATES[i][1],content:ST_TEMPLATES[i][2],period:i===1||i===3?'weekly':'daily',enabled:i<2,example:true}));
}
function stPersist(items){
 try{localStorage.setItem('dy_scheduled_plans_v1',JSON.stringify(items));ST.items=items;return true;}
 catch(e){toast('保存失败：浏览器存储不可用或空间不足，请保留当前内容后重试。');return false;}
}
function stParts(value,zone){const parts=new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date(value));return Object.fromEntries(parts.filter(x=>x.type!=='literal').map(x=>[x.type,Number(x.value)]));}
function stInstant(y,m,d,time,zone){
 const [h,min]=time.split(':').map(Number),wall=Date.UTC(y,m-1,d,h,min);let at=wall;
 for(let i=0;i<4;i++){const p=stParts(at,zone),offset=Date.UTC(p.year,p.month-1,p.day,p.hour,p.minute)-at;at=wall-offset;}
 const p=stParts(at,zone);return p.year===y&&p.month===m&&p.day===d&&p.hour===h&&p.minute===min?at:null;
}
function stNext(f,now=Date.now()){
 if(!ST_ZONES.includes(f.zone)||!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(f.time))return null;
 if(f.period==='once'){if(!/^\d{4}-\d{2}-\d{2}$/.test(f.date||''))return null;const [y,m,d]=f.date.split('-').map(Number),at=stInstant(y,m,d,f.time,f.zone);return at>now?at:null;}
 const p=stParts(now,f.zone);
 for(let i=0;i<400;i++){
  const day=new Date(Date.UTC(p.year,p.month-1,p.day+i));
  if(f.period==='weekly'&&day.getUTCDay()!==Number(f.weekday))continue;
  if(f.period==='monthly'&&day.getUTCDate()!==Number(f.monthday))continue;
  const at=stInstant(day.getUTCFullYear(),day.getUTCMonth()+1,day.getUTCDate(),f.time,f.zone);if(at>now)return at;
 }return null;
}
function stWhen(at,zone){return at?new Intl.DateTimeFormat('zh-CN',{timeZone:zone,month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(at)):'无后续安排';}
function stPlan(t){return (t.period==='weekly'?'每周'+['日','一','二','三','四','五','六'][t.weekday]:t.period==='monthly'?'每月 '+t.monthday+' 日':t.period==='once'?t.date:ST_PERIODS[t.period])+' '+t.time;}
function stPreview(f){const next=stNext(f);return '<strong>'+esc(stPlan(f))+' 执行</strong><p>'+(next?'首次／下次计划：'+esc(stWhen(next,f.zone)):'请选择有效的未来执行时间')+' · '+esc(f.zone)+'</p>'+(f.period==='monthly'&&f.monthday>28?'<p>当月没有该日期时跳过该月。</p>':'');}
function stStart(index,task){ST.form=task?{...task}:{...stBlank(),...(index!=null?{name:ST_TEMPLATES[index][1],content:ST_TEMPLATES[index][2],period:index===1||index===3?'weekly':'daily'}:{})};ST.errors=[];stOpenDialog();}
function stSidebar(){
 /* 列表已按 已开启 / 已暂停 分组，不再另设状态筛选 */
 const rows=ST.items.filter(t=>t.name.toLowerCase().includes(ST.query.toLowerCase()));
 return '<aside class="st-list ms-sidebar" aria-label="定时任务列表"><div class="st-list-head"><h1>定时任务</h1><button class="st-icon-button" data-st-action="search" aria-label="搜索任务" aria-expanded="'+ST.search+'">'+stIcon('search')+'</button></div>'+
 (ST.search?'<input class="input st-search" id="st-search" placeholder="搜索任务名称" aria-label="搜索任务名称" value="'+esc(ST.query)+'">':'')+
 '<button class="st-new ms-nav" data-st-action="new">'+stIcon('plus')+'新建任务</button>'+[true,false].map(on=>'<h2>'+(on?'已开启':'已暂停')+'</h2>'+ (rows.filter(t=>t.enabled===on).map(t=>'<button class="st-row ms-nav" data-st-pick="'+esc(t.id)+'" aria-current="'+(S.route==='scheduledetail'&&ST.pick===t.id)+'">'+stIcon('clock')+'<span class="st-row-copy"><strong title="'+esc(t.name)+'">'+esc(t.name)+'</strong><small>'+(on?esc(stWhen(stNext(t),t.zone)):'已暂停')+' · '+esc(ST_PERIODS[t.period])+(t.example?' · 示例':'')+'</small></span></button>').join('')||'<p class="st-empty">'+(ST.query?'没有匹配的任务':on?'暂无已开启任务':'暂无已暂停任务')+'</p>')).join('')+'<p class="st-note">本机计划 · 后台调度还没接入</p></aside>';
}
function stHome(){return '<main class="st-main st-home"><div class="st-intro"><img src="assets/tasks/hero-clock.svg" alt="" width="62" height="62"><h2>安排任务</h2><p>让端砚按计划追踪文献、整理数据，持续跟进科研进展。</p></div><div class="st-grid">'+ST_TEMPLATES.map(([icon,name,desc],i)=>'<button class="st-card" data-st-template="'+i+'">'+stIcon(icon)+'<span><strong>'+name+'</strong><p>'+desc+'</p></span></button>').join('')+'</div></main>';}
function stField(label,key,value,type='text',extra=''){return '<label class="st-field"><span>'+label+'</span><input class="input" name="'+key+'" type="'+type+'" value="'+esc(value||'')+'" '+extra+'></label>';}
function stForm(){const f=ST.form||(ST.form=stBlank());return '<section class="st-modal-body"><header class="st-modal-head"><div><h2 id="st-dialog-title">'+(f.id?'编辑定时任务':'新建定时任务')+'</h2><p class="st-subtitle">告诉端砚要做什么，以及何时执行。</p></div><button type="button" class="st-close" data-st-action="cancel" aria-label="关闭任务设置">×</button></header><form id="st-form" class="st-form" novalidate>'+
 (ST.errors.length?'<div class="st-errors" role="alert" tabindex="-1">'+ST.errors.map(esc).join('<br>')+'</div>':'')+
 stField('任务名称 *','name',f.name,'text','required maxlength="80"')+
 '<label class="st-field"><span>关联课题 *</span><select class="input" name="pid" required><option value="">选择课题</option>'+DB.projects.map(p=>'<option value="'+esc(p.id)+'" '+(p.id===f.pid?'selected':'')+'>'+esc(p.name)+'</option>').join('')+'</select></label>'+
 '<label class="st-field"><span>任务内容 *</span><textarea class="input" name="content" required maxlength="5000" placeholder="描述希望按计划完成的科研任务">'+esc(f.content)+'</textarea></label>'+
 stField('数据来源','sources',f.sources,'text','maxlength="500"')+
 '<fieldset class="st-period"><legend>执行计划 *</legend><div class="st-period-options">'+Object.entries(ST_PERIODS).map(([key,label])=>'<label><input type="radio" name="period" value="'+key+'" '+(f.period===key?'checked':'')+'><span>'+label+'</span></label>').join('')+'</div></fieldset><div class="st-inline">'+
 (f.period==='once'?stField('执行日期 *','date',f.date,'date','required'):f.period==='weekly'?'<label class="st-field"><span>星期</span><select class="input" name="weekday">'+['日','一','二','三','四','五','六'].map((v,i)=>'<option value="'+i+'" '+(Number(f.weekday)===i?'selected':'')+'>星期'+v+'</option>').join('')+'</select></label>':f.period==='monthly'?stField('每月几日 *','monthday',f.monthday,'number','min="1" max="31" required'):'')+
 stField('执行时间 *','time',f.time,'time','required')+'<label class="st-field"><span>时区</span><select class="input" name="zone">'+ST_ZONES.map(z=>'<option '+(z===f.zone?'selected':'')+'>'+z+'</option>').join('')+'</select></label></div>'+
 '<label class="st-field"><span>结果保存至</span><select class="input" name="destination">'+[['papers','关联课题 / 数据与文献'],['report','关联课题 / 研究报告']].map(([v,n])=>'<option value="'+v+'" '+(f.destination===v?'selected':'')+'>'+n+'</option>').join('')+'</select></label>'+
 '<label class="st-check"><input name="notify" type="checkbox" '+(f.notify?'checked':'')+'>运行失败时提醒我</label><div class="st-preview" id="st-preview" aria-live="polite">'+stPreview(f)+'</div><p class="st-note">计划仅保存在当前浏览器；后台调度、自动运行与消息提醒还没接入。</p><div class="st-actions"><button class="btn" type="button" data-st-action="cancel">取消</button><button class="btn btn-pri" type="submit">'+(f.id?'保存修改': '创建并启用')+'</button></div></form></section>';}
function stDetail(){
 const t=ST.items.find(t=>t.id===ST.pick);if(!t)return '<main class="st-main"><button class="st-back" data-go="schedules">返回定时任务</button><h2>请选择一个任务</h2><p>可从左侧选择任务，或新建定时任务。</p></main>';
 const project=DB.projects.find(p=>p.id===t.pid),runs=Array.isArray(t.runs)?t.runs.filter(r=>r&&typeof r.content==='string'):[];
 return '<main class="st-main st-content-main"><header class="st-content-head"><div><h2>'+esc(t.name)+'</h2><p class="st-subtitle">'+(t.enabled?'已开启':'已暂停')+(t.example?' · 示例计划':' · 本机计划')+'</p></div><button class="btn" data-st-action="edit" aria-label="设置任务：'+esc(t.name)+'">'+stIcon('filter')+'任务设置</button></header><div class="st-content-columns"><section class="st-output" aria-label="任务内容"><h3>任务内容</h3><p class="st-instruction">'+esc(t.content)+'</p><h3>输出内容</h3>'+(runs.length?runs.map(r=>'<article class="st-run"><time>'+esc(r.at||'未记录时间')+'</time><p>'+esc(r.content)+'</p></article>').join(''):stSampleOutput(t))+'</section><aside class="st-summary" aria-label="任务摘要"><h3>定时任务</h3><p class="st-summary-plan">'+stIcon('clock')+esc(stPlan(t))+'</p><p class="st-note">'+esc(t.zone)+' · '+(t.enabled?'下次计划 '+esc(stWhen(stNext(t),t.zone)):'已暂停')+'</p><h3>关联课题</h3><p>'+esc(project?.name||'课题不可用，请在设置中重新选择')+'</p><h3>来源</h3><p>'+esc(t.sources||'未指定')+'</p><h3>结果保存至</h3><p>'+(t.destination==='report'?'关联课题 / 研究报告':'关联课题 / 数据与文献')+'</p><div class="st-summary-actions"><button class="btn" data-st-action="edit">编辑任务</button><button class="btn" data-st-action="toggle">'+(t.enabled?'暂停任务':'恢复任务')+'</button><button class="btn st-danger" data-st-action="delete">删除计划</button></div></aside></div></main>';
}
function stCloseDialog(){const d=document.getElementById('st-dialog');if(d){d.close();d.remove();}ST.form=null;ST.errors=[];ST.stay=false;if(S.route==='schedulenew')go(ST.pick?'scheduledetail':'schedules');}
function stOpenDialog(){
 let d=document.getElementById('st-dialog');if(d){stRenderDialog();return;}
 d=document.createElement('dialog');d.id='st-dialog';d.className='st-dialog';d.setAttribute('aria-labelledby','st-dialog-title');document.body.appendChild(d);
 d.addEventListener('cancel',e=>{e.preventDefault();stCloseDialog();});d.addEventListener('close',()=>{if(d.isConnected){d.remove();ST.form=null;ST.errors=[];ST.stay=false;}});
 stRenderDialog();d.showModal();d.querySelector('[name=name]')?.focus();
}
function stRenderDialog(){const d=document.getElementById('st-dialog');if(!d)return;const top=d.scrollTop,active=d.querySelector(':focus')?.name;d.innerHTML=stForm();stBindForm(d);d.querySelectorAll('[data-st-action=cancel]').forEach(b=>b.onclick=stCloseDialog);d.scrollTop=top;if(active)d.querySelector('[name="'+active+'"]')?.focus({preventScroll:true});}
function stBindForm(root){
 const form=root.querySelector('#st-form');if(!form)return;
 form.onsubmit=e=>{e.preventDefault();stSave();};
 form.addEventListener('input',e=>{const el=e.target;if(!el.name)return;ST.form[el.name]=el.type==='checkbox'?el.checked:el.value;ST.errors=[];root.querySelector('.st-errors')?.remove();root.querySelector('#st-preview').innerHTML=stPreview(ST.form);});
 form.addEventListener('change',e=>{const el=e.target;if(!el.name)return;ST.form[el.name]=el.type==='checkbox'?el.checked:el.value;if(['period','zone'].includes(el.name))stRenderDialog();});
}
function stPage(mode){stLoad();return '<div class="st-layout" data-mode="'+mode+'">'+stSidebar()+(mode==='detail'||mode==='new'&&ST.pick?stDetail():stHome())+'</div>';}
V.schedules=()=>stPage('home');V.schedulenew=()=>stPage('new');V.scheduledetail=()=>stPage('detail');
NAV_PARENT.schedulenew='schedules';NAV_PARENT.scheduledetail='schedules';
function stSave(){const f={...ST.form,name:ST.form.name.trim(),content:ST.form.content.trim()};ST.errors=[];
 if(!f.name||f.name.length>80)ST.errors.push('请填写 1–80 字的任务名称。');
 if(!DB.projects.some(p=>p.id===f.pid))ST.errors.push('请选择可用的关联课题。');
 if(!f.content||f.content.length>5000)ST.errors.push('请填写 1–5000 字的任务内容。');
 if(!ST_PERIODS[f.period]||!ST_ZONES.includes(f.zone)||!stNext(f))ST.errors.push('请选择有效的执行计划；一次性任务必须选择未来时间。');
 if(f.period==='monthly'&&(!Number.isInteger(Number(f.monthday))||f.monthday<1||f.monthday>31))ST.errors.push('每月日期应为 1–31 的整数。');
 if(ST.errors.length){stRenderDialog();document.querySelector('#st-dialog .st-errors')?.focus();return;}
 const old=ST.items.find(t=>t.id===f.id),item={...f,id:f.id||'schedule-'+crypto.randomUUID(),example:false,enabled:old?old.enabled:true,updatedAt:new Date().toISOString()};
 if(!stPersist(old?ST.items.map(t=>t.id===item.id?item:t):[item,...ST.items]))return;
 ST.pick=item.id;LS.set('scheduled_pick',item.id);if(ST.stay&&!old){ST.stay=false;stCloseDialog();render();toast('已设为定时任务：'+item.name+'（本机计划，后台调度还没接入）');return;}ST.stay=false;stCloseDialog();go('scheduledetail');toast(old?'计划修改已保存':'已保存本机计划，后台调度还没接入');
}
function schedulesBind(root){
 if(!['schedules','schedulenew','scheduledetail'].includes(S.route))return;
 root.querySelectorAll('[data-st-template]').forEach(b=>b.onclick=()=>stStart(Number(b.dataset.stTemplate)));
 root.querySelectorAll('[data-st-pick]').forEach(b=>b.onclick=()=>{ST.pick=b.dataset.stPick;LS.set('scheduled_pick',ST.pick);go('scheduledetail');});
 root.querySelectorAll('[data-st-action]').forEach(b=>b.onclick=()=>{
  const action=b.dataset.stAction,t=ST.items.find(t=>t.id===ST.pick);
  if(action==='new')stStart();
  if(action==='cancel')stCloseDialog();
  if(action==='search'){ST.search=!ST.search;if(!ST.search)ST.query='';render();view.querySelector('#st-search')?.focus();}
  if(action==='filters'){ST.filters=!ST.filters;if(!ST.filters)ST.filter='all';render();}
  if(action==='edit'&&t)stStart(null,t);
  if(action==='toggle'&&t){if(!t.enabled&&(!DB.projects.some(p=>p.id===t.pid)||!stNext(t))){toast('无法恢复，请先编辑并选择可用课题及未来执行时间。');return;}if(stPersist(ST.items.map(x=>x.id===t.id?{...x,enabled:!x.enabled}:x)))render();}
  if(action==='delete'&&t&&confirm('删除「'+t.name+'」的计划？历史成果不会被删除。')){if(stPersist(ST.items.filter(x=>x.id!==t.id))){ST.pick=null;go('schedules');}}
 });
 const search=root.querySelector('#st-search');if(search)search.oninput=()=>{ST.query=search.value;render();};
 const filter=root.querySelector('#st-filter');if(filter)filter.onchange=()=>{ST.filter=filter.value;render();};
 if(S.route==='schedulenew'&&!document.getElementById('st-dialog'))queueMicrotask(()=>{if(S.route==='schedulenew')stOpenDialog();});
}
ST.pick=LS.get('scheduled_pick',null);

/* ---------- 第二版：定时任务回到课题里 ----------
   定时任务必须关联课题、结果也写回课题，所以课题详情左栏多一个「定时」页签，只列本课题的计划。
   状态全部由计划本身推出来，不编运行结果：后台调度还没接入，原型里没有真实运行记录，
   所以「本次失败」只在 runs 里真有一条失败记录时才会出现。 */
function stState(t){
 if(!DB.projects.some(p=>p.id===t.pid))return {k:'orphan',label:'课题已删除',tone:'err'};
 const runs=Array.isArray(t.runs)?t.runs:[],last=runs[runs.length-1];
 if(t.period==='once'&&!stNext(t)&&runs.length)return {k:'done',label:'已结束',tone:'off'};
 if(!t.enabled)return {k:'paused',label:'已暂停',tone:'off'};
 if(last&&(last.ok===false||last.status==='failed'))return {k:'failed',label:'本次失败',tone:'err'};
 const next=stNext(t);
 if(!next)return {k:'stale',label:'没有下一次执行时间',tone:'off'};
 return {k:'on',label:'下次 '+stWhen(next,t.zone),tone:'on'};
}
function stForProject(pid){stLoad();return ST.items.filter(t=>t.pid===pid);}
/* 三个模板：每日文献追踪、实验数据周报、课题进展汇总 */
const ST_PROJECT_TEMPLATES=[0,1,3];
function stTemplateFor(i,pid){const T=ST_TEMPLATES[i];return {...stBlank(),pid,name:T[1],content:T[2],period:i===1||i===3?'weekly':'daily'};}
function pjSchedTab(p){
 const rows=stForProject(p.id);
 const head='<div class="pjx-side-h"><span class="lbl">本课题的计划</span><span class="grow"></span><span class="t-xs mut2 num">'+rows.length+'</span>'
  +'<button class="pjx-add" type="button" data-stp-new="'+esc(p.id)+'" aria-label="新建定时任务" title="新建定时任务"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M12 6v12M6 12h12"/></svg></button></div>';
 if(!rows.length)return head+'<div class="pjx-side-b"><div class="stp-empty"><strong class="t-md">这个课题还没有定时任务</strong><span class="t-sm mut">从常用的开始：</span>'
  +ST_PROJECT_TEMPLATES.map(i=>'<button class="stp-tpl" type="button" data-stp-tpl="'+i+'" data-stp-pid="'+esc(p.id)+'"><strong>'+esc(ST_TEMPLATES[i][1])+'</strong><span>'+esc(ST_TEMPLATES[i][2])+'</span></button>').join('')+'</div></div>';
 return head+'<div class="pjx-side-b">'+rows.map(t=>{const s=stState(t);
  return '<button class="pjx-f stp-row" type="button" data-stp-pick="'+esc(t.id)+'" title="'+esc(t.name)+'"><span class="stp-dot is-'+s.tone+'" aria-hidden="true"></span><span class="col grow" style="gap:1px;min-width:0"><span class="pjx-f-n">'+esc(t.name)+'</span><span class="t-xs mut2">'+esc(stPlan(t))+' · '+esc(s.label)+'</span></span>'+(s.tone==='err'?'<span class="stp-flag">'+esc(s.k==='failed'?'失败':'失效')+'</span>':'')+'</button>';
 }).join('')+'<button class="stp-all" type="button" data-go="schedules">全部课题的定时任务</button></div>';
}
/* 课题页、对话里的入口都走这里：带好课题与内容打开同一张表单。
   ST.stay=true 时保存后留在原地，不把人从课题或对话里带走。 */
function stStartHere(task){ST.stay=true;stStart(null,task);}
document.addEventListener('click',e=>{
 const el=e.target.closest('[data-stp-new],[data-stp-tpl],[data-stp-pick],[data-st-from-chat]');if(!el)return;
 if(el.dataset.stpNew!=null){stStartHere({...stBlank(),pid:el.dataset.stpNew});return;}
 if(el.dataset.stpTpl!=null){stStartHere(stTemplateFor(Number(el.dataset.stpTpl),el.dataset.stpPid));return;}
 if(el.dataset.stpPick!=null){ST.pick=el.dataset.stpPick;LS.set('scheduled_pick',ST.pick);go('scheduledetail');return;}
 if(el.dataset.stFromChat!=null){try{stStartHere(JSON.parse(el.dataset.stFromChat));}catch(err){stStartHere({...stBlank()});}}
});

/* ---------- 第二版：在对话里设定时 ----------
   用户的话里有周期，回答下方给一个「设为定时任务」。识别用本机规则，不交给模型：
   同一句话每次结果一样；识别不出周期就不出按钮。 */
const ST_WD={'一':1,'二':2,'三':3,'四':4,'五':5,'六':6,'日':0,'天':0,'末':6};
function stParsePeriod(text){
 const s=String(text||'');let period=null,weekday=1,monthday=1;
 let m;
 if(/每(天|日)|天天|每个?工作日/.test(s))period='daily';
 else if((m=s.match(/每(?:个)?(?:周|星期|礼拜)([一二三四五六日天末])/)))period='weekly',weekday=ST_WD[m[1]];
 else if(/每(?:个)?(?:周|星期|礼拜)/.test(s))period='weekly';
 else if((m=s.match(/每(?:个)?月(?:的)?(\d{1,2})\s*[号日]/)))period='monthly',monthday=Math.min(31,Math.max(1,+m[1]));
 else if(/每(?:个)?月/.test(s))period='monthly';
 else if(/定期|有新的?(?:论文|文献|数据|结果)?就(?:告诉|提醒|通知)我|持续(?:追踪|跟踪|关注)/.test(s))period='daily';
 if(!period)return null;
 let time='08:30';
 if((m=s.match(/(早上|上午|中午|下午|傍晚|晚上)?\s*(\d{1,2})\s*(?:点|:|：)\s*(半|\d{1,2})?/))){
  let h=+m[2],mi=m[3]==='半'?30:m[3]?+m[3]:0;
  if(/下午|傍晚|晚上/.test(m[1]||'')&&h<12)h+=12;
  if(h<=23&&mi<=59)time=String(h).padStart(2,'0')+':'+String(mi).padStart(2,'0');
 }
 return {period,weekday,monthday,time};
}
function stChatOffer(userText,pid){
 const r=stParsePeriod(userText);if(!r)return '';
 const text=String(userText).trim();
 const task={...stBlank(),pid:pid||stBlank().pid,name:text.replace(/\s+/g,' ').slice(0,24),content:text.slice(0,5000),
  period:r.period,weekday:r.weekday,monthday:r.monthday,time:r.time};
 return '<div class="st-offer"><button class="btn st-offer-b" type="button" data-st-from-chat="'+esc(JSON.stringify(task))+'">'
  +'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 7v5l3 2M12 21a9 9 0 1 1 0-18 9 9 0 0 1 0 18z"/></svg>'
  +'设为定时任务 · '+esc(stPlan(task))+'</button></div>';
}
