/* 全局搜索（第二版）
   侧栏收到七个入口之后，用户主动找东西的兜底就是这里：功能、课题、对话、任务、数据集、资料、定时任务。
   规则：
   - 只读本机已有的列表，不发任何请求，不写任何数据（「最近打开」存在 LS 里，是本机偏好）。
   - 功能按名字和别称匹配；别称写在功能旁边，加功能时一起加。
   - 功能排在最前；其余按类型分组，每组最多 5 条。 */
const GS_FEATURES=[
 {id:'workbench',grp:'研究',name:'工作台',where:'研究',alias:['首页','待处理','研究动态','主页'],go:()=>go('workbench')},
 {id:'chat',grp:'研究',name:'科研对话',where:'研究',alias:['对话','提问','助手','新对话','聊天'],go:()=>go('chat')},
 {id:'projects',grp:'研究',name:'课题项目',where:'研究',alias:['课题','项目','我的课题'],go:()=>go('projects')},
 {id:'lab',grp:'实验',name:'实验管理',where:'实验',alias:['实验','批次','湿实验','实验记录'],go:()=>go('lab')},
 {id:'mdl',grp:'资源',name:'模型制备',where:'资源',alias:['模型','模型库','模型训练','模型评测','模型推理','训练','评测','推理'],go:()=>{S.mtab='cur';go('mdl')}},
 {id:'shelf',grp:'资源',name:'科研工具',where:'资源',alias:['工具','工具市场'],go:()=>{RS.marketTab='catalog';go('shelf')}},
 {id:'data',grp:'资源',name:'数据库',where:'资源',alias:['公共数据库','数据源'],go:()=>{RS.marketTab='catalog';go('data')}},
 {id:'schedules',grp:'研究',name:'定时任务',where:'工作台右上 · 课题详情「定时」',alias:['定时','周报','每天','每周','每月','计划','提醒','自动','定期','追踪'],go:()=>go('schedules')},
 {id:'materials',grp:'研究',name:'资料空间',where:'课题项目右上',alias:['资料','文件','文献','上传文件','知识库','与你共享','附件'],go:()=>go('materials')},
 {id:'devices',grp:'实验',name:'设备管理',where:'实验管理右上',alias:['设备','仪器','接入设备','申请接入'],go:()=>go('devices')},
 {id:'dsets',grp:'资源',name:'数据集',where:'模型制备 · 数据集页签',alias:['训练数据','训练集','数据集列表'],go:()=>go('dsets')},
 {id:'tools',grp:'资源',name:'我的工具',where:'科研工具 · 我的',alias:['自建工具','接入工具','管理工具'],go:()=>go('tools')},
 {id:'mydata',grp:'资源',name:'我的数据库',where:'数据库 · 我的',alias:['自建数据库','接入数据库'],go:()=>{RS.marketTab='mine';go('data')}},
 {id:'set',grp:'账户',name:'模型接入',where:'账户 · 设置',alias:['密钥','API Key','apikey','key','模型配置','接入模型','大模型','凭证'],go:()=>go('set')},
 {id:'settings',grp:'账户',name:'设置',where:'账户',alias:['偏好','系统设置'],go:()=>go('settings')},
 {id:'me',grp:'账户',name:'个人中心',where:'账户',alias:['账户','账号','我的信息'],go:()=>go('me')},
 {id:'shared',grp:'研究',name:'共享课题',where:'课题详情 · 资料空间「与你共享」',alias:['共享','协作','申请','审批','共享给我'],go:()=>go('shared')},
 {id:'new-schedule',grp:'快捷新建',name:'新建定时任务',where:'带当前课题',alias:['设定时','新计划','定时提醒'],go:()=>gsNewSchedule()},
 {id:'new-project',grp:'快捷新建',name:'新建课题',where:'课题项目',alias:['创建课题','新课题'],go:()=>{go('projects');const b=document.querySelector('[data-act="newproj"]');if(b)act('newproj',b)}},
 {id:'new-dataset',grp:'资源',name:'新建数据集',where:'模型制备 · 数据集',alias:['上传数据集','导入数据集','创建数据集'],go:()=>go('dsnew')},
 {id:'new-lab',grp:'实验',name:'发起实验',where:'实验管理',alias:['新建实验','新实验'],go:()=>go('labnew')},
];
/* 每个功能一个自己的图标：侧栏七个入口取导航里同一个图形，其余按含义配 */
const GS_FIC={
 schedules:'M12 7v5l3 2M12 21a9 9 0 1 1 0-18 9 9 0 0 1 0 18z',
 materials:'M7 3h7l5 5v13H7zM14 3v5h5M10 13h6M10 17h4',
 shared:'M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM2.5 20c.6-3.4 3.3-5.5 6.5-5.5s5.9 2.1 6.5 5.5M16 4.3a3.5 3.5 0 0 1 0 6.4M18 14.8c2 .7 3.2 2.6 3.5 5.2',
 devices:'M4 6h16v10H4zM8 20h8M12 16v4M8 10h3',
 'new-lab':'M9 3h6M10 3v6l-5 9a2 2 0 0 0 1.7 3h10.6a2 2 0 0 0 1.7-3l-5-9V3M12 13v4M10 15h4',
 dsets:'M4 6c0-1.7 3.6-3 8-3s8 1.3 8 3-3.6 3-8 3-8-1.3-8-3zM4 6v12c0 1.7 3.6 3 8 3s8-1.3 8-3V6M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3',
 'new-dataset':'M4 6c0-1.7 3.6-3 8-3s8 1.3 8 3-3.6 3-8 3-8-1.3-8-3zM4 6v6c0 1.7 3.6 3 8 3M20 6v5M17 15v6M14 18h6',
 tools:'M14.7 6.3a4 4 0 0 0-5.4 5.2L3.5 17.3a1.8 1.8 0 0 0 2.6 2.6l5.8-5.8a4 4 0 0 0 5.2-5.4l-2.4 2.4-2.1-.4-.4-2.1z',
 mydata:'M4 6c0-1.7 3.6-3 8-3s8 1.3 8 3-3.6 3-8 3-8-1.3-8-3zM4 6v12c0 1.7 3.6 3 8 3M20 6v4M16.5 17a2.5 2.5 0 1 0 0-.1M13 22c.4-1.8 1.8-3 3.5-3s3.1 1.2 3.5 3',
 set:'M15.5 3.5a5 5 0 0 0-4.8 6.5L3 17.7V21h3.3v-2h2v-2h2l1.6-1.6a5 5 0 1 0 3.6-11.9zM16.5 7.5h.01',
 settings:'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z',
 me:'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4.5 21c.8-4 3.8-6.5 7.5-6.5s6.7 2.5 7.5 6.5',
 'new-schedule':'M12 7v5l3 2M20.5 13A8.5 8.5 0 1 1 12 3.5M18 3v6M15 6h6',
 'new-project':'M3.5 7.5A1.5 1.5 0 0 1 5 6h4l2 2h8a1.5 1.5 0 0 1 1.5 1.5v8A1.5 1.5 0 0 1 19 19H5a1.5 1.5 0 0 1-1.5-1.5zM12 11v5M9.5 13.5h5',
};
function gsFeatureIcon(id){
 let d=GS_FIC[id];
 if(!d&&typeof NAV!=='undefined'){for(const g of NAV)for(const it of g[2])if(it[0]===id)d=it[2];}
 return '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="'+(d||'M4 6h16M4 12h10M4 18h7')+'"/></svg>';
}
const GS={open:false,q:'',i:0,rows:[]};
function gsCurrentPid(){
 if(S.route==='project'&&S.pid)return S.pid;
 const sess=typeof SESSIONS!=='undefined'?SESSIONS.find(x=>x.id===S.sid):null;
 return sess?.pid||S.pid||DB.projects[0]?.id||'';
}
function gsNewSchedule(prefill){
 if(typeof stStart!=='function')return go('schedules');
 if(typeof stLoad==='function')stLoad();
 const pid=prefill?.pid||gsCurrentPid();
 stStart(null,Object.assign(stBlank(),{pid},prefill||{}));
}
function gsRecent(){try{const v=LS.get('gs_recent',[]);return Array.isArray(v)?v:[]}catch(e){return []}}
function gsRemember(row){
 if(!row||!row.key)return;
 const list=gsRecent().filter(x=>x.key!==row.key);
 list.unshift({key:row.key,kind:row.kind,label:row.label,sub:row.sub||''});
 LS.set('gs_recent',list.slice(0,6));
}
/* 一条结果：key 唯一，kind 决定分组，open 是点了以后做什么 */
function gsIndex(){
 const out=[];
 const add=(kind,key,label,sub,open,extra)=>out.push({kind,key,label,sub,open,hay:[label,sub,...(extra||[])].join(' ').toLowerCase()});
 /* 侧栏入口的第二行写它是做什么的（取导航自己的说明），不再重复一遍分组名 */
 const navDesc=id=>{if(typeof NAV==='undefined')return '';for(const g of NAV)for(const it of g[2])if(it[0]===id)return it[3]||'';return ''};
 GS_FEATURES.forEach(f=>out.push({kind:'功能',key:'f:'+f.id,label:f.name,sub:f.where===f.grp?(navDesc(f.id)||'侧栏入口'):f.where,open:f.go,feature:f,hay:[f.name,...f.alias].join(' ').toLowerCase()}));
 (DB.projects||[]).forEach(p=>add('课题','p:'+p.id,p.name||p.id,p.target||p.desc||'',()=>workbenchOpenProject(p.id),[p.dom||'']));
 if(typeof SESSIONS!=='undefined')SESSIONS.forEach(x=>{const p=DB.projects.find(p=>p.id===x.pid);
  add('对话','s:'+x.id,x.title||'未命名对话',[p?.name,x.at].filter(Boolean).join(' · '),()=>{go('chat');openSession(x)},[x.q||'']);});
 try{workbenchData().tasks.forEach(t=>add(t.kind==='experiment'?'实验':'模型任务','t:'+t.key,t.name,[t.projectName,t.statusText].filter(Boolean).join(' · '),()=>workbenchOpenTask(t.key)));}catch(e){}
 try{(typeof ALL_DSETS==='function'?ALL_DSETS():[]).forEach(d=>add('数据集','d:'+d.id,d.n||d.name||d.id,d.id,()=>{S.dsPick=d.id;go('dsets')}));}catch(e){}
 try{if(typeof stLoad==='function')stLoad();(ST.items||[]).forEach(t=>{const p=DB.projects.find(p=>p.id===t.pid);
  add('定时任务','st:'+t.id,t.name,[p?.name||'课题已删除',typeof stPlan==='function'?stPlan(t):'',typeof stState==='function'?stState(t).label:(t.enabled?'已开启':'已暂停')].filter(Boolean).join(' · '),()=>{ST.pick=t.id;LS.set('scheduled_pick',t.id);go('scheduledetail')},[t.content||'']);});}catch(e){}
 try{if(typeof materialsRows==='function')materialsRows().forEach(x=>{const p=DB.projects.find(p=>p.id===x.pid);
  add('资料','m:'+x.id,x.name,p?.name||'公共资料',()=>{Object.assign(MATERIALS,{tab:'all',space:'',type:'all',query:x.name});go('materials',{keepTab:1})});});}catch(e){}
 return out;
}
function gsScore(r,q){
 const name=r.label.toLowerCase();
 if(name===q)return 100;
 if(name.startsWith(q))return 80;
 if(name.includes(q))return 60;
 if(r.feature&&r.feature.alias.some(a=>a.toLowerCase()===q))return 70;
 if(r.feature&&r.feature.alias.some(a=>a.toLowerCase().includes(q)||q.includes(a.toLowerCase())&&a.length>=2))return 45;
 if(r.hay.includes(q))return 30;
 return 0;
}
const GS_ORDER=['功能','课题','定时任务','对话','实验','模型任务','数据集','资料'];
function gsSearch(q){
 q=q.trim().toLowerCase();
 const idx=gsIndex();
 if(!q){
  const byKey=new Map(idx.map(r=>[r.key,r]));
  const recent=gsRecent().map(x=>byKey.get(x.key)).filter(Boolean).map(r=>({...r,group:'最近打开'}));
  /* 空输入时把全部能力列出来，按 研究 / 实验 / 资源 / 账户 / 快捷新建 分组——不知道叫什么的时候，翻一遍就能找到 */
  const all=['研究','实验','资源','账户','快捷新建'].flatMap(g=>GS_FEATURES.filter(f=>f.grp===g).map(f=>({...byKey.get('f:'+f.id),group:'全部能力 · '+g})));
  return recent.concat(all);
 }
 const hits=idx.map(r=>({...r,score:gsScore(r,q)})).filter(r=>r.score>0);
 /* 组的先后按组里最好的那一条排；同分时功能在前。
    「文献追踪」这种只蹭到功能别称的词，会让名字真正命中的那条定时任务排到前面 */
 const groups=GS_ORDER.map((kind,o)=>{const g=hits.filter(r=>r.kind===kind).sort((a,b)=>b.score-a.score);return {kind,o,g,best:g[0]?.score||0}})
  .filter(x=>x.g.length).sort((a,b)=>b.best-a.best||a.o-b.o);
 const rows=[];
 groups.forEach(({kind,g})=>g.slice(0,5).forEach(r=>rows.push({...r,group:kind})));
  return rows;
}
function gsIcon(kind){
 const p={'功能':'M4 6h16M4 12h10M4 18h7','课题':'M3.5 7.5A1.5 1.5 0 0 1 5 6h4l2 2h8a1.5 1.5 0 0 1 1.5 1.5v8A1.5 1.5 0 0 1 19 19H5a1.5 1.5 0 0 1-1.5-1.5z',
  '对话':'M4 5.5A1.5 1.5 0 0 1 5.5 4h13A1.5 1.5 0 0 1 20 5.5v9a1.5 1.5 0 0 1-1.5 1.5H9l-4.5 4v-4H5.5A1.5 1.5 0 0 1 4 14.5z',
  '定时任务':'M12 7v5l3 2M12 21a9 9 0 1 1 0-18 9 9 0 0 1 0 18z','实验':'M9 3h6M10 3v6l-5 9a2 2 0 0 0 1.7 3h10.6a2 2 0 0 0 1.7-3l-5-9V3',
  '模型任务':'M6.5 5a2 2 0 1 1 0 4 2 2 0 0 1 0-4zM17.5 5a2 2 0 1 1 0 4 2 2 0 0 1 0-4zM12 15a2 2 0 1 1 0 4 2 2 0 0 1 0-4zM8 8.5l3 5M16 8.5l-3 5',
  '数据集':'M4 6c0-1.7 3.6-3 8-3s8 1.3 8 3-3.6 3-8 3-8-1.3-8-3zM4 6v12c0 1.7 3.6 3 8 3s8-1.3 8-3V6M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3',
  '资料':'M7 3h7l5 5v13H7zM14 3v5h5','搜索':'M11 18a7 7 0 1 1 0-14 7 7 0 0 1 0 14zM20 20l-4-4'}[kind]||'M4 6h16M4 12h10M4 18h7';
 return '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="'+p+'"/></svg>';
}
function gsPaint(){
 const d=document.getElementById('gs-dlg');if(!d)return;
 const list=d.querySelector('.gs-list');
 GS.rows=gsSearch(GS.q);
 if(GS.i>=GS.rows.length)GS.i=Math.max(0,GS.rows.length-1);
 if(!GS.rows.length){
  list.innerHTML='<div class="gs-empty"><p>没有找到「'+esc(GS.q.trim())+'」</p><button type="button" class="gs-ask" data-gs-ask>在科研对话里问「'+esc(GS.q.trim().slice(0,20))+'」</button></div>';
  list.querySelector('[data-gs-ask]').onclick=()=>{const text=GS.q.trim();gsClose();go('chat');setTimeout(()=>{const a=document.getElementById('ask');if(a){a.value=text;a.focus();a.dispatchEvent(new Event('input',{bubbles:true}))}},60)};
  d.querySelector('.gs-input').setAttribute('aria-activedescendant','');
  return;
 }
 let last='';
 list.innerHTML=GS.rows.map((r,i)=>{
  const head=r.group!==last?'<div class="gs-group" role="presentation">'+esc(r.group)+'</div>':'';last=r.group;
  return head+'<div class="gs-row'+(i===GS.i?' is-on':'')+'" role="option" id="gs-opt-'+i+'" aria-selected="'+(i===GS.i)+'" data-gs-i="'+i+'"><span class="gs-ic">'+(r.feature?gsFeatureIcon(r.feature.id):gsIcon(r.kind))+'</span><span class="gs-tx"><span class="gs-label">'+esc(r.label)+'</span>'+(r.sub?'<span class="gs-sub">'+esc(r.sub)+'</span>':'')+'</span>'+(i===GS.i?'<span class="gs-enter" aria-hidden="true">↵</span>':'')+'</div>';
 }).join('');
 d.querySelector('.gs-input').setAttribute('aria-activedescendant','gs-opt-'+GS.i);
 list.querySelectorAll('[data-gs-i]').forEach(el=>{
  el.onmousemove=()=>{const i=+el.dataset.gsI;if(i!==GS.i){GS.i=i;gsPaint()}};
  el.onclick=()=>gsPick(+el.dataset.gsI);
 });
 list.querySelector('.is-on')?.scrollIntoView({block:'nearest'});
}
function gsPick(i){
 const r=GS.rows[i];if(!r)return;
 gsRemember(r);gsClose();
 try{r.open()}catch(e){toast('打不开这一项，它可能已经被删除')}
 /* 打开后把焦点交给目标页的标题，读屏和键盘都从新页面开始 */
 setTimeout(()=>{if(document.querySelector('dialog[open]'))return;const h=document.querySelector('#view h1');if(h){h.setAttribute('tabindex','-1');h.focus({preventScroll:true})}},80);
}
function gsOpen(){
 if(document.getElementById('gs-dlg')?.open)return;
 /* 别的弹窗开着时不叠第二层 */
 if(document.querySelector('dialog[open]:not(#gs-dlg)'))return;
 let d=document.getElementById('gs-dlg');
 if(!d){
  d=document.createElement('dialog');d.id='gs-dlg';d.className='gs-dlg';d.setAttribute('aria-label','搜索');
  d.innerHTML='<div class="gs-box"><div class="gs-bar">'+gsIcon('搜索')+'<input class="gs-input" type="text" role="combobox" aria-expanded="true" aria-controls="gs-list" aria-autocomplete="list" placeholder="搜索功能、课题、对话、任务、资料…" autocomplete="off" spellcheck="false"><kbd class="gs-esc">esc</kbd></div><div class="gs-list" id="gs-list" role="listbox" aria-label="搜索结果"></div><div class="gs-foot"><span><kbd>↑</kbd><kbd>↓</kbd> 选择</span><span><kbd>↵</kbd> 打开</span><span><kbd>esc</kbd> 关闭</span></div></div>';
  document.body.appendChild(d);
  const input=d.querySelector('.gs-input');
  input.addEventListener('input',()=>{GS.q=input.value;GS.i=0;gsPaint()});
  input.addEventListener('keydown',e=>{
   if(e.isComposing)return;
   if(e.key==='ArrowDown'){e.preventDefault();if(GS.rows.length){GS.i=(GS.i+1)%GS.rows.length;gsPaint()}}
   else if(e.key==='ArrowUp'){e.preventDefault();if(GS.rows.length){GS.i=(GS.i-1+GS.rows.length)%GS.rows.length;gsPaint()}}
   else if(e.key==='Enter'){e.preventDefault();if(GS.rows.length)gsPick(GS.i);else d.querySelector('[data-gs-ask]')?.click()}
  });
  d.addEventListener('click',e=>{if(e.target===d)gsClose()});
  d.addEventListener('close',()=>{GS.open=false;const t=document.querySelector('.gs-trigger');t?.setAttribute('aria-expanded','false')});
 }
 GS.q='';GS.i=0;GS.open=true;
 const input=d.querySelector('.gs-input');input.value='';
 d.showModal();gsPaint();input.focus();
 document.querySelector('.gs-trigger')?.setAttribute('aria-expanded','true');
}
function gsClose(){const d=document.getElementById('gs-dlg');if(d?.open)d.close();}
/* 侧栏顶部的搜索框：放在品牌行下面、导航分组上面；折叠时只剩放大镜，位置不变 */
(function gsMount(){
 const side=document.getElementById('side'),brand=side?.querySelector('.brand');
 if(!brand||side.querySelector('.gs-trigger'))return;
 const mac=/Mac|iPhone|iPad/.test(navigator.platform||'');
 const b=document.createElement('button');
 b.type='button';b.className='gs-trigger';b.setAttribute('aria-haspopup','dialog');b.setAttribute('aria-expanded','false');
 b.setAttribute('aria-label','搜索（'+(mac?'⌘K':'Ctrl K')+'）');b.title='搜索（'+(mac?'⌘K':'Ctrl K')+'）';
 b.innerHTML='<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" aria-hidden="true"><path d="M11 18a7 7 0 1 1 0-14 7 7 0 0 1 0 14zM20 20l-4-4"/></svg><span class="nav-tx gs-ph">搜索</span><kbd class="nav-tx gs-kbd">'+(mac?'⌘K':'Ctrl K')+'</kbd>';
 b.onclick=gsOpen;
 brand.insertAdjacentElement('afterend',b);
})();
document.addEventListener('keydown',e=>{
 if((e.metaKey||e.ctrlKey)&&!e.altKey&&!e.shiftKey&&(e.key==='k'||e.key==='K')){
  e.preventDefault();
  if(document.getElementById('gs-dlg')?.open)gsClose();else gsOpen();
 }
},true);
