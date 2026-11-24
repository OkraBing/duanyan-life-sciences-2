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
const ST_PERIODS={daily:'每天',weekdays:'工作日',weekly:'每周',monthly:'每月',once:'仅一次'};
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
  if(f.period==='weekdays'&&[0,6].includes(day.getUTCDay()))continue;
  if(f.period==='weekly'&&day.getUTCDay()!==Number(f.weekday))continue;
  if(f.period==='monthly'&&day.getUTCDate()!==Number(f.monthday))continue;
  const at=stInstant(day.getUTCFullYear(),day.getUTCMonth()+1,day.getUTCDate(),f.time,f.zone);if(at>now)return at;
 }return null;
}
function stWhen(at,zone){return at?new Intl.DateTimeFormat('zh-CN',{timeZone:zone,month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(at)):'无后续安排';}
function stPlan(t){return (t.period==='weekly'?'每周'+['日','一','二','三','四','五','六'][t.weekday]:t.period==='monthly'?'每月 '+t.monthday+' 日':t.period==='once'?t.date:ST_PERIODS[t.period])+' '+t.time;}
function stPreview(f){const next=stNext(f);return '<strong>'+esc(stPlan(f))+'</strong><p>'+(next?'下次执行：'+esc(stWhen(next,f.zone)):'请选择一个将来的时间')+'</p>'+(f.period==='monthly'&&f.monthday>28?'<p>当月没有这一天时跳过。</p>':'');}
function stStart(index,task){ST.form=task?{...task}:{...stBlank(),...(index!=null?{name:ST_TEMPLATES[index][1],content:ST_TEMPLATES[index][2],period:index===1||index===3?'weekly':'daily'}:{})};ST.errors=[];stOpenDialog();}
function stSidebar(){
 /* 列表已按 已开启 / 已暂停 分组，不再另设状态筛选 */
 const rows=ST.items.filter(t=>t.name.toLowerCase().includes(ST.query.toLowerCase()));
 return '<aside class="st-list ms-sidebar" aria-label="定时任务列表"><button class="ms-back" type="button" data-go="workbench"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 6l-6 6 6 6"/></svg>工作台</button><div class="st-list-head"><h1>定时任务</h1><button class="st-icon-button" data-st-action="search" aria-label="搜索任务" aria-expanded="'+ST.search+'">'+stIcon('search')+'</button></div>'+
 (ST.search?'<input class="input st-search" id="st-search" placeholder="搜索任务名称" aria-label="搜索任务名称" value="'+esc(ST.query)+'">':'')+
 '<button class="st-new ms-nav" data-st-action="new">'+stIcon('plus')+'新建任务</button>'+[true,false].map(on=>'<h2>'+(on?'已开启':'已暂停')+'</h2>'+ (rows.filter(t=>t.enabled===on).map(t=>'<button class="st-row ms-nav" data-st-pick="'+esc(t.id)+'" aria-current="'+(S.route==='scheduledetail'&&ST.pick===t.id)+'">'+stIcon('clock')+'<span class="st-row-copy"><strong title="'+esc(t.name)+'">'+esc(t.name)+'</strong><small>'+(on?esc(stWhen(stNext(t),t.zone)):'已暂停')+' · '+esc(ST_PERIODS[t.period])+(t.example?' · 示例':'')+'</small></span></button>').join('')||'<p class="st-empty">'+(ST.query?'没有匹配的任务':on?'暂无已开启任务':'暂无已暂停任务')+'</p>')).join('')+'</aside>';
}
function stHome(){return '<main class="st-main st-home"><div class="st-intro"><img src="assets/tasks/hero-clock.svg" alt="" width="62" height="62"><h2>安排任务</h2><p>让端砚按计划追踪文献、整理数据，持续跟进科研进展。</p></div><div class="st-grid">'+ST_TEMPLATES.map(([icon,name,desc],i)=>'<button class="st-card" data-st-template="'+i+'">'+stIcon(icon)+'<span><strong>'+name+'</strong><p>'+desc+'</p></span></button>').join('')+'</div></main>';}
function stField(label,key,value,type='text',extra=''){return '<label class="st-field"><span>'+label+'</span><input class="input" name="'+key+'" type="'+type+'" value="'+esc(value||'')+'" '+extra+'></label>';}
/* 第二版：新建只问三件事——要做什么（一句话）、归哪个课题、什么时候做（选项）。
   任务名从那句话里取，不再单独填；数据来源、时区、保存位置用默认值，不在表单里摆出来。 */
function stTitleFrom(text){
 let t=String(text||'').replace(/\s+/g,' ').trim();
 t=t.replace(/^(请|帮我|麻烦|每(天|日)|每个?(周|星期|礼拜)[一二三四五六日天末]?|每个?月(\d{1,2}[号日])?|工作日|定期|(早上|上午|中午|下午|傍晚|晚上)?\s*\d{1,2}\s*(点|:|：)\s*(半|\d{1,2})?(分)?|早上|上午|中午|下午|傍晚|晚上)+/,'');
 t=t.replace(/^[，,、\s]+/,'').replace(/^(帮我|请|给我)/,'');
 return (t||String(text||'').trim()).slice(0,20)||'定时任务';
}
function stScheduleFields(f,prefix=''){
 const wd=['一','二','三','四','五','六','日'],wv=[1,2,3,4,5,6,0];
 return '<fieldset class="st-freq"><legend>频次</legend><div class="st-pills">'+Object.entries(ST_PERIODS).map(([k,n])=>'<label class="st-pill"><input type="radio" name="'+prefix+'period" value="'+k+'" '+(f.period===k?'checked':'')+'><span>'+n+'</span></label>').join('')+'</div></fieldset>'
  +'<div class="st-when">'
  +(f.period==='weekly'?'<fieldset class="st-freq"><legend>星期</legend><div class="st-pills is-days">'+wd.map((d,i)=>'<label class="st-pill"><input type="radio" name="'+prefix+'weekday" value="'+wv[i]+'" '+(Number(f.weekday)===wv[i]?'checked':'')+'><span>'+d+'</span></label>').join('')+'</div></fieldset>':'')
  +(f.period==='monthly'?'<label class="st-field"><span>日期</span><select class="input" name="'+prefix+'monthday">'+Array.from({length:31},(_,i)=>'<option value="'+(i+1)+'" '+(Number(f.monthday)===i+1?'selected':'')+'>每月 '+(i+1)+' 日</option>').join('')+'</select></label>':'')
  +(f.period==='once'?'<label class="st-field"><span>日期</span><input class="input" type="date" name="'+prefix+'date" value="'+esc(f.date||'')+'"></label>':'')
  +'<label class="st-field"><span>时间</span><input class="input" type="time" name="'+prefix+'time" value="'+esc(f.time)+'" step="300"></label>'
  +'</div>';
}
function stForm(){const f=ST.form||(ST.form=stBlank());return '<section class="st-modal-body"><header class="st-modal-head"><div><h2 id="st-dialog-title">新建定时任务</h2><p class="st-subtitle">用一句话告诉端砚要定期做什么。</p></div><button type="button" class="st-close" data-st-action="cancel" aria-label="关闭">×</button></header><form id="st-form" class="st-form" novalidate>'+
 (ST.errors.length?'<div class="st-errors" role="alert" tabindex="-1">'+ST.errors.map(esc).join('<br>')+'</div>':'')+
 '<label class="st-field"><span>要做什么</span><textarea class="input st-ask" name="content" required maxlength="2000" rows="3" placeholder="例如：追踪 Barnase–Barstar 结合界面相关的新论文，汇总关键发现和原文链接">'+esc(f.content)+'</textarea></label>'+
 '<label class="st-field"><span>关联课题</span><select class="input" name="pid" required><option value="">选择课题</option>'+DB.projects.map(p=>'<option value="'+esc(p.id)+'" '+(p.id===f.pid?'selected':'')+'>'+esc(p.name)+'</option>').join('')+'</select></label>'+
 stScheduleFields(f)+
 '<div class="st-preview" id="st-preview" aria-live="polite">'+stPreview(f)+'</div><div class="st-actions"><button class="btn" type="button" data-st-action="cancel">取消</button><button class="btn btn-pri" type="submit">创建</button></div></form></section>';}
function stDetail(){
 const t=ST.items.find(t=>t.id===ST.pick);if(!t)return '<main class="st-main st-home"><div class="st-intro"><h2>选择一个定时任务</h2><p>从左侧选择，或新建一个。</p></div></main>';
 const project=DB.projects.find(p=>p.id===t.pid),runs=Array.isArray(t.runs)?t.runs.filter(r=>r&&typeof r.content==='string'):[],st=stState(t);
 const revs=Array.isArray(t.revisions)?t.revisions:[],hist=Array.isArray(t.history)?t.history:[];
 return '<main class="st-main st-content-main st-v2"><header class="st-content-head"><div><h2>'+esc(t.name)+'</h2><p class="st-subtitle"><span class="st-state is-'+st.tone+'">'+esc(st.label)+'</span>'+(project?'<button class="lv-link ce-inline" type="button" data-st-project="'+esc(project.id)+'">'+esc(project.name)+'</button>':'<span>课题已删除</span>')+(t.example?'<span class="st-tag">示例</span>':'')+'</p></div>'
  +'<div class="st-head-actions"><button class="st-switch" type="button" role="switch" data-st-action="toggle" aria-checked="'+t.enabled+'" aria-label="'+(t.enabled?'暂停这个任务':'开启这个任务')+'"><i></i><span>'+(t.enabled?'已开启':'已暂停')+'</span></button><button class="btn st-danger" type="button" data-st-action="delete">删除</button></div></header>'
  +'<section class="st-card2"><h3>任务</h3><p class="st-instruction">'+esc(t.content)+'</p>'
  +(revs.length?'<div class="st-revs"><h4>补充要求<small>按添加顺序执行，后加的优先</small></h4><ul>'+revs.map((r,i)=>'<li><span>'+esc(r.text)+'</span><button class="st-rev-x" type="button" data-st-rev-del="'+i+'" aria-label="撤回这条补充要求">撤回</button></li>').join('')+'</ul></div>':'')
  +'<form class="st-nl" data-st-nl><input class="input" name="nl" maxlength="300" autocomplete="off" placeholder="用一句话修改，例如「只看近一周发表的论文」「改成每周五早上 9 点」「暂停」"><button class="btn" type="submit">修改</button></form>'
  +(hist.length?'<details class="st-hist"><summary>修改记录 '+hist.length+'</summary><ul>'+hist.slice().reverse().map(h=>'<li><time>'+esc(h.at)+'</time><span>「'+esc(h.text)+'」</span><em>'+esc(h.effect)+'</em></li>').join('')+'</ul></details>':'')
  +'</section>'
  +'<section class="st-card2"><h3>执行计划</h3><form class="st-plan" data-st-plan>'+stScheduleFields(t,'p_')+'</form><p class="st-next">'+(t.enabled?(stNext(t)?'下次执行：'+esc(stWhen(stNext(t),t.zone)):'没有下一次执行时间，请重新选择'):'已暂停，开启后按这个计划执行')+'</p></section>'
  +'<section class="st-card2"><h3>运行记录</h3>'+(runs.length?runs.slice().reverse().map(r=>'<article class="st-run'+(r.ok===false?' is-failed':'')+'"><time>'+esc(r.at||'')+'</time><p>'+esc(r.content)+'</p></article>').join(''):'<p class="st-empty-runs">还没有运行记录。</p>'+(t.example&&typeof stSampleOutput==='function'?'<details class="st-sample"><summary>示例输出（不是运行结果）</summary>'+stSampleOutput(t)+'</details>':''))+'</section>'
  +'</main>';
}
/* 一句话修改：能识别的指令（暂停 / 恢复 / 删除 / 频次 / 时间）直接改计划；
   其余的话作为「补充要求」记在任务下面，不改写原句——改写需要模型，规则做不到就不假装做到。 */
function stApplyNL(t,text){
 const s=String(text||'').trim();if(!s)return null;
 const now=typeof nowStamp==='function'?nowStamp():new Date().toLocaleString('zh-CN');
 let next={...t},effect='';
 if(/^(删除|删掉)(这个|该)?(任务|计划)?$/.test(s))return {del:true};
 if(/^(暂停|先停|停一下|停掉)/.test(s)){next.enabled=false;effect='已暂停';}
 else if(/^(恢复|继续|开启|重新开启|打开)/.test(s)){
  if(!DB.projects.some(p=>p.id===t.pid)||!stNext(t))return {err:'恢复前请先在执行计划里选一个将来的时间，并确认关联课题还在。'};
  next.enabled=true;effect='已开启';}
 else{
  const r=typeof stParsePeriod==='function'?stParsePeriod(s):null;
  const wkd=/工作日/.test(s);
  const tm=s.match(/(早上|上午|中午|下午|傍晚|晚上)?\s*(\d{1,2})\s*(?:点|:|：)\s*(半|\d{1,2})?/);
  if(r||wkd){Object.assign(next,{period:wkd?'weekdays':r.period,weekday:r?r.weekday:next.weekday,monthday:r?r.monthday:next.monthday,time:tm&&r?r.time:(r&&r.time!=='08:30'?r.time:next.time)});
   if(tm&&!r){let h=+tm[2],mi=tm[3]==='半'?30:tm[3]?+tm[3]:0;if(/下午|傍晚|晚上/.test(tm[1]||'')&&h<12)h+=12;if(h<24&&mi<60)next.time=String(h).padStart(2,'0')+':'+String(mi).padStart(2,'0');}
   effect='执行计划改为 '+stPlan(next);}
  else if(tm&&/^(改|换|挪|调)?(到|成|为)?/.test(s)&&s.length<=16){let h=+tm[2],mi=tm[3]==='半'?30:tm[3]?+tm[3]:0;if(/下午|傍晚|晚上/.test(tm[1]||'')&&h<12)h+=12;
   if(h<24&&mi<60){next.time=String(h).padStart(2,'0')+':'+String(mi).padStart(2,'0');effect='执行时间改为 '+next.time;}}
  if(!effect){next.revisions=[...(Array.isArray(t.revisions)?t.revisions:[]),{at:now,text:s}];effect='加为补充要求';}
 }
 next.history=[...(Array.isArray(t.history)?t.history:[]),{at:now,text:s,effect}].slice(-30);
 return {next,effect};
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
function stSave(){const f={...ST.form,content:String(ST.form.content||'').trim()};f.name=String(f.name||'').trim()||stTitleFrom(f.content);ST.errors=[];
 if(!DB.projects.some(p=>p.id===f.pid))ST.errors.push('选一个关联课题。');
 if(!f.content)ST.errors.push('用一句话写下要做什么。');
 if(!ST_PERIODS[f.period]||!ST_ZONES.includes(f.zone)||!stNext(f))ST.errors.push('选一个将来的执行时间。');
 if(f.period==='monthly'&&(!Number.isInteger(Number(f.monthday))||f.monthday<1||f.monthday>31))ST.errors.push('每月日期应为 1–31 的整数。');
 if(ST.errors.length){stRenderDialog();document.querySelector('#st-dialog .st-errors')?.focus();return;}
 const old=ST.items.find(t=>t.id===f.id),item={...f,id:f.id||'schedule-'+crypto.randomUUID(),example:false,enabled:old?old.enabled:true,updatedAt:new Date().toISOString()};
 if(!stPersist(old?ST.items.map(t=>t.id===item.id?item:t):[item,...ST.items]))return;
 ST.pick=item.id;LS.set('scheduled_pick',item.id);if(ST.stay&&!old){ST.stay=false;stCloseDialog();render();toast('已设为定时任务：'+item.name);return;}ST.stay=false;stCloseDialog();go('scheduledetail');toast(old?'已保存修改':'已创建定时任务');
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
  if(action==='toggle'&&t){if(!t.enabled&&(!DB.projects.some(p=>p.id===t.pid)||!stNext(t))){toast('开启前请先在执行计划里选一个将来的时间，并确认关联课题还在。');return;}if(stPersist(ST.items.map(x=>x.id===t.id?{...x,enabled:!x.enabled}:x)))render();}
  if(action==='delete'&&t)stConfirmDelete(t);
 });
 const t0=ST.items.find(t=>t.id===ST.pick);
 const nl=root.querySelector('[data-st-nl]');if(nl&&t0)nl.onsubmit=e=>{e.preventDefault();const v=nl.querySelector('input').value;const r=stApplyNL(t0,v);if(!r)return;
  if(r.err){toast(r.err);return}if(r.del){stConfirmDelete(t0);return}
  if(stPersist(ST.items.map(x=>x.id===t0.id?r.next:x))){render();toast(r.effect);setTimeout(()=>view.querySelector('[data-st-nl] input')?.focus(),30);}};
 const plan=root.querySelector('[data-st-plan]');if(plan&&t0)plan.onchange=e=>{const el=e.target;if(!el.name||!el.name.startsWith('p_'))return;const k=el.name.slice(2);
  const next={...t0,[k]:el.value};if(!stNext(next)&&k!=='period'){toast('这个时间已经过去，选一个将来的时间');render();return}
  const at=typeof nowStamp==='function'?nowStamp():'';next.history=[...(Array.isArray(t0.history)?t0.history:[]),{at,text:'在执行计划里修改',effect:'执行计划改为 '+stPlan(next)}].slice(-30);
  if(stPersist(ST.items.map(x=>x.id===t0.id?next:x))){render();toast('已保存：'+stPlan(next));}};
 root.querySelectorAll('[data-st-rev-del]').forEach(b=>b.onclick=()=>{if(!t0)return;const i=+b.dataset.stRevDel;const revs=(t0.revisions||[]).filter((_,k)=>k!==i);
  if(stPersist(ST.items.map(x=>x.id===t0.id?{...x,revisions:revs}:x))){render();toast('已撤回这条补充要求');}});
 root.querySelectorAll('[data-st-project]').forEach(b=>b.onclick=()=>{go('project',{pid:b.dataset.stProject});S.pjtab='st';render();});
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

/* 删除用站内确认，写清楚删了什么、留下什么 */
function stConfirmDelete(t){
 modal('删除定时任务？','<p style="margin:0;line-height:1.7">「'+esc(t.name)+'」会停止执行并从列表中移除；已经写进课题的运行结果不受影响。</p>','删除',()=>{
  if(stPersist(ST.items.filter(x=>x.id!==t.id))){ST.pick=null;LS.set('scheduled_pick',null);go('schedules');toast('已删除「'+t.name+'」');}return true;});
}
