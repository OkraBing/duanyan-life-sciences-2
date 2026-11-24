/* Workbench matched to the approved researcher desktop reference.
 * Uses existing project/task records and read receipts; no simulated new activity. */
const RESEARCH_HOME={query:'',tab:'papers',start:0,feedPage:0};
function rhIcon(kind){ /* 本模块自己的图标集；不要叫 researchIcon，对话页有同名函数 */
 const paths={calendar:'M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14H3V6a2 2 0 0 1 2-2M7 14h3M14 14h3M7 18h3',layers:'m12 3 10 5-10 5L2 8l10-5zm-10 9 10 5 10-5M2 16l10 5 10-5',goal:'M12 2v3M12 19v3M2 12h3M19 12h3M19 12a7 7 0 1 1-14 0 7 7 0 0 1 14 0zm-4 0a3 3 0 1 1-6 0 3 3 0 0 1 6 0z',chart:'M4 20V10M9 20V4M14 20v-7M19 20V7',search:'M21 21l-5-5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0',bell:'M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4',book:'M12 5C8 2 4 2 2 3v17c3-1 6-1 10 2 4-3 7-3 10-2V3c-2-1-6-1-10 2v17',protein:'M8 6l8 12M8 18 16 6M8 6a3 3 0 1 1-6 0 3 3 0 0 1 6 0zm14 0a3 3 0 1 1-6 0 3 3 0 0 1 6 0zM8 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0zm14 0a3 3 0 1 1-6 0 3 3 0 0 1 6 0z'};
 return paths[kind]?'<svg class="rh-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="'+paths[kind]+'"/></svg>':wbViewIcon(kind);
}
function researchTime(value){return String(value||'未记录时间').replace(/^\d{4}-/,'');}
function researchProjectState(p){
 const scope=workbenchData({pid:p.id}),pending=wbAttentionTasks(scope.tasks||[]),failed=pending.filter(t=>t.status==='failed'||t.needsAction),done=pending.filter(t=>t.status==='done'),active=pending.filter(t=>t.status==='active');
 const task=failed[0]||done[0]||active[0];
 const draft=(scope.experiments||[]).find(t=>t.status==='draft');
 const latest=task||(scope.tasks||[]).filter(t=>t.isTask!==false)[0];
 const tone=failed.length?'alert':done.length?'ready':draft?'confirm':'quiet';
 const badge=failed.length?failed.length+' 项待处理':done.length?done.length+' 份结果待查看':active.length?active.length+' 项进行中':draft?'实验方案待完善':'暂无待处理事项';
 const next=failed.length?'处理'+(task.kind==='experiment'?'实验异常':'任务异常'):done.length?'查看'+(task.kind==='experiment'?'实验结论':'候选评测结果'):active.length?'查看任务进度':draft?'完善实验方案':'查看课题记录';
 const description=latest?dashboardDescription(latest).description||latest.name:'尚无研究记录，进入课题开始研究。';
 return {tone,badge,next,description,task,draft,latest};
}
function researchActivities(){
 const projects=workbenchData().projects;
 const entries=(DB.acts||[]).map((a,i)=>{const p=projects.find(p=>p.id===a.pid||p.name===a.p);return {id:'activity-'+i,title:a.t||'研究记录已更新',by:a.by||'我',at:a.at,pid:p?.id,project:p?.name||a.p||'研究记录'};}).filter(a=>a.pid);
 if(entries.length){const rank=a=>{const m=String(a.at||'').match(/(今天|昨天)\s*(\d{1,2}):(\d{2})/);return m?(m[1]==='今天'?1440:0)+Number(m[2])*60+Number(m[3]):0;};return entries.sort((a,b)=>rank(b)-rank(a));}
 return workbenchData().tasks.filter(t=>t.at&&t.isTask!==false).slice(0,8).map(t=>({id:t.key,title:t.name+' · '+t.statusText,by:'记录',at:t.at,pid:t.pid,project:t.projectName}));
}
function researchActivityHTML(a,i){return '<button class="rh-activity" type="button" data-wb-project="'+esc(a.pid)+'"><span class="rh-avatar color-'+i%3+'" title="'+esc(a.by)+'">'+esc(a.by.slice(0,1))+'</span><span class="rh-activity-copy"><strong title="'+esc(a.title)+'">'+esc(a.title)+'</strong><small><span>'+esc(a.project)+'</span><span>'+esc(researchTime(a.at))+'</span></small></span></button>';}
function researchResources(projects){
 return researchPublished(projects).concat(researchCatalog(projects));
}
function researchPublished(projects){
 return (RS.data.resources||[]).filter(r=>r.state==='published'&&r.visibility==='public').map(r=>{
  const terms=[r.name,r.description,...(r.tags||[])].join(' ').toLowerCase();
  const matched=projects.filter(p=>[p.target,p.name].filter(Boolean).some(t=>terms.includes(t.toLowerCase())));
  return {id:r.id,name:r.name,kind:r.kind==='tool'?'工具':'数据库',project:matched.map(p=>p.name).join('、'),pid:matched[0]?.id,at:r.review?.at||r.at,route:'resdetail'};
 }).filter(r=>r.pid).sort((a,b)=>String(b.at||'').localeCompare(String(a.at||'')));
}
/* 平台自带的公共数据库目录里，与蛋白类课题对口的那些：它们是产品里真实存在的条目（见「公共数据库」页），不是另编的 */
function researchCatalog(projects){
 if(typeof DATASRC==='undefined'||!projects.length)return [];
 return DATASRC.filter(d=>/蛋白质/.test(d.mode||'')).map(d=>({id:'cat:'+d.ab,name:d.n,kind:'公共数据库',project:'蛋白类课题',pid:projects[0].id,meta:d.mode+' · '+(d.wired?'已接入':'未接入'),route:'data'}));
}
function researchDiscoveries(projects){
 if(RESEARCH_HOME.tab==='resources')return researchResources(projects).map(r=>'<button class="rh-discovery-row" type="button" data-rh-resource="'+esc(r.id)+'" data-rh-pid="'+esc(r.pid)+'" data-rh-route="'+r.route+'"><span class="rh-discovery-icon">'+rhIcon(r.kind==='模型'?'model':'paper')+'</span><span class="rh-discovery-copy"><strong>'+esc(r.name)+'</strong><small>'+esc(r.kind)+' · 关联：'+esc(r.project)+' · '+esc(r.meta||researchTime(r.at))+'</small></span>'+rhIcon('right')+'</button>');
 if(RESEARCH_HOME.tab==='news')return [];
 return dashboardPapers(projects).map(p=>{const source=WB_PAPERS.find(x=>x.id===p.id),names=projects.filter(x=>(p.pids||[p.pid]).includes(x.id)).map(x=>x.name);return '<a class="rh-discovery-row" href="'+esc(wbViewHref(p.url))+'" target="_blank" rel="noopener noreferrer"><span class="rh-discovery-icon">'+rhIcon('paper')+'</span><span class="rh-discovery-copy"><strong>'+esc(source?.shortTitle||p.shortTitle||p.title)+'</strong><small>关联：'+esc(names.join('、'))+(source?.journal?'　|　来源：'+esc(source.journal):'')+'</small></span>'+rhIcon('right')+'</a>';});
}
function researchCard(p,i){
 const state=researchProjectState(p),source=DB.projects.find(x=>x.id===p.id),goal=source?goalText(source):p.description;
 return '<article class="rh-project '+(i===0?'is-featured ':'')+'tone-'+state.tone+'" data-wb-project-id="'+esc(p.id)+'"><header><span class="rh-project-symbol color-'+i%3+'">'+rhIcon(i===1?'model':i===2?'settings':'protein')+'</span><h3 title="'+esc(p.name)+'">'+esc(p.name)+'</h3><span class="rh-badge '+state.tone+'">'+esc(state.badge)+'</span></header><div class="rh-card-section">'+rhIcon('goal')+'<div><h4>研究目标</h4><p title="'+esc(goal)+'">'+esc(goal||'尚未设置研究目标')+'</p></div></div><div class="rh-card-section">'+rhIcon('chart')+'<div><h4>最近进展</h4><p title="'+esc(state.description)+'">'+esc(state.description)+'</p></div></div><div class="rh-next">'+rhIcon('calendar')+'<button class="rh-next-action" type="button" '+(state.task||state.draft?'data-wb-task-open="'+esc((state.task||state.draft).key)+'"':'data-wb-project="'+esc(p.id)+'"')+'>下一步：<strong>'+esc(state.next)+'</strong></button><span class="rh-badge '+state.tone+'">'+esc(state.tone==='alert'?'待处理':state.tone==='ready'?'待查看':state.draft?'待完善':'进行中')+'</span></div><button class="rh-enter" type="button" data-wb-project="'+esc(p.id)+'" aria-label="进入课题：'+esc(p.name)+'">进入课题 '+rhIcon('arrow')+'</button></article>';
}
V.workbench=()=>{
 const data=wbPrepare(),all=data.projects||[],ps=all.filter(p=>(p.name+' '+p.description+' '+p.target).toLowerCase().includes(RESEARCH_HOME.query.toLowerCase()));
 const start=Math.min(RESEARCH_HOME.start,Math.max(0,Math.ceil(ps.length/3)-1)*3);RESEARCH_HOME.start=start;
 const items=ps.slice(start,start+3),activities=researchActivities(),rows=researchDiscoveries(all);
 const date=new Date().toLocaleDateString('zh-CN',{month:'long',day:'numeric',weekday:'short',timeZone:'Asia/Shanghai'}),resources=researchResources(all);
 return '<div class="page wb wb-workstation"><header class="rh-header"><div><h1>工作台</h1><p>聚焦课题进展，推进下一步研究</p></div><div class="rh-header-actions"><button class="rh-link" type="button" data-go="schedules">定时任务</button><button class="rh-new" data-wb-start type="button">＋ 发起研究</button></div></header><section class="rh-activities-wrap" aria-labelledby="rh-activity-title"><div class="rh-project-toolbar"><h2 id="rh-activity-title">'+rhIcon('calendar')+'近期研究动态</h2><button class="rh-link" data-rh-activities type="button">查看全部 '+rhIcon('right')+'</button></div><div class="rh-activities"><div class="rh-activity-grid">'+activities.slice(0,3).map(researchActivityHTML).join('')+(!activities.length?'<p class="rh-empty">暂无研究动态，进入课题开始记录研究。</p>':'')+'</div></div></section><section class="rh-projects" aria-labelledby="rh-projects-title"><div class="rh-project-toolbar"><h2 id="rh-projects-title">'+rhIcon('layers')+'我的课题 <span>('+all.length+')</span></h2>'+(ps.length>3?'<div class="rh-pager"><button class="rh-pager-btn" type="button" data-rh-project-page="prev" aria-label="上一页课题"'+(start<=0?' disabled':'')+'><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 6l-6 6 6 6"/></svg></button><span class="rh-pager-n num" aria-live="polite">'+(Math.floor(start/3)+1)+' / '+Math.max(1,Math.ceil(ps.length/3))+'</span><button class="rh-pager-btn" type="button" data-rh-project-page="next" aria-label="下一页课题"'+(start+3>=ps.length?' disabled':'')+'><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg></button></div>':'')+''+(all.length>6||RESEARCH_HOME.query?'<label class="rh-search">'+rhIcon('search')+'<input type="search" aria-label="搜索课题名称或关键词" placeholder="搜索课题名称或关键词" value="'+esc(RESEARCH_HOME.query)+'" data-rh-search></label>':'')+'<button class="rh-link" data-rh-projects type="button">查看全部 '+rhIcon('right')+'</button></div><div class="rh-project-grid">'+items.map(researchCard).join('')+(!items.length?'<div class="rh-empty"><p>'+(all.length?'没有匹配课题，请调整搜索词。':'还没有课题，创建第一个研究课题。')+'</p><button class="rh-new" data-wb-create-project type="button">新建课题</button></div>':'')+'</div>'+'</section><section class="rh-discoveries-wrap" aria-labelledby="rh-discover-title"><div class="rh-project-toolbar"><h2 id="rh-discover-title">'+rhIcon('book')+'课题相关发现</h2></div><div class="rh-discoveries"><div class="rh-discover-heading"><div class="rh-tabs" role="tablist" aria-label="相关发现类型">'+[['papers','文献'],['news','学术资讯'],['resources','平台资源更新']].map(([k,n])=>'<button id="rh-tab-'+k+'" role="tab" aria-selected="'+(RESEARCH_HOME.tab===k)+'" aria-controls="rh-feed" tabindex="'+(RESEARCH_HOME.tab===k?'0':'-1')+'" data-rh-tab="'+k+'" type="button">'+n+(k==='resources'?'<span>'+resources.length+'</span>':'')+'</button>').join('')+'</div></div><div id="rh-feed" role="tabpanel" aria-labelledby="rh-tab-'+RESEARCH_HOME.tab+'">'+rows.slice(0,6).join('')+(!rows.length?'<p class="rh-empty">'+(RESEARCH_HOME.tab==='news'?'暂无学术资讯，相关研究论文可在“文献”中查看。':RESEARCH_HOME.tab==='resources'?'暂无与课题匹配的已发布平台资源更新。':'暂无匹配文献。')+'</p>':'')+'</div></div>'+'</section></div>';
};
const researchOriginalBind=wbBind;
wbBind=function(root){
 researchOriginalBind(root);if(S.route!=='workbench')return;wbLayoutObserver?.disconnect();
 const allActivities=()=>{const entries=researchActivities();modal('近期研究动态',entries.length?'<div class="rh-activity-history">'+entries.map((a,i)=>'<p><strong>'+esc(a.title)+'</strong><br>'+esc(a.project)+' · '+esc(researchTime(a.at))+'</p>').join('')+'</div>':'暂无研究记录。','关闭',()=>true);};
 root.querySelectorAll('[data-rh-activities],[data-rh-notifications]').forEach(b=>b.onclick=allActivities);
 root.querySelector('[data-rh-projects]')?.addEventListener('click',()=>go('projects'));
 root.querySelectorAll('[data-wb-start]').forEach(b=>b.onclick=()=>rhStartDialog());
 const search=root.querySelector('[data-rh-search]');search?.addEventListener('input',()=>{const pos=search.selectionStart;RESEARCH_HOME.query=search.value;RESEARCH_HOME.start=0;render();const next=view.querySelector('[data-rh-search]');next.focus();try{next.setSelectionRange(pos,pos)}catch(e){}});
 root.querySelectorAll('[data-rh-tab]').forEach(b=>{b.onclick=()=>{RESEARCH_HOME.tab=b.dataset.rhTab;RESEARCH_HOME.feedPage=0;render();view.querySelector('[data-rh-tab="'+RESEARCH_HOME.tab+'"]')?.focus();};b.onkeydown=e=>{const keys=['papers','news','resources'];let i=keys.indexOf(RESEARCH_HOME.tab);if(e.key==='ArrowRight')i=(i+1)%3;else if(e.key==='ArrowLeft')i=(i+2)%3;else if(e.key==='Home')i=0;else if(e.key==='End')i=2;else return;e.preventDefault();RESEARCH_HOME.tab=keys[i];RESEARCH_HOME.feedPage=0;render();view.querySelector('[data-rh-tab="'+keys[i]+'"]')?.focus();};});
 /* 课题翻页：一页三个，到头即停（按钮同时置灰），不再绕回第一页。
    计数要用过滤后的列表，否则搜索时页码和实际条数对不上。 */
 root.querySelectorAll('[data-rh-project-page]').forEach(b=>b.addEventListener('click',()=>{
  const q=RESEARCH_HOME.query.toLowerCase();
  const n=(workbenchData().projects||[]).filter(p=>(p.name+' '+p.description+' '+p.target).toLowerCase().includes(q)).length;
  const last=Math.max(0,Math.ceil(n/3)-1)*3,dir=b.dataset.rhProjectPage==='next'?3:-3;
  RESEARCH_HOME.start=Math.max(0,Math.min(RESEARCH_HOME.start+dir,last));render();
  const same=view.querySelector('[data-rh-project-page="'+b.dataset.rhProjectPage+'"]');
  (same&&!same.disabled?same:view.querySelector('[data-rh-project-page]:not([disabled])'))?.focus();
 }));
 root.querySelectorAll('[data-rh-resource]').forEach(b=>b.onclick=()=>{if(b.dataset.rhRoute==='data'){go('data');return;}if(b.dataset.rhRoute==='resdetail'){RS.resourcePick=b.dataset.rhResource;RS.resourceVersion=null;go('resdetail');}else if(b.dataset.rhRoute==='mdl')go('mdl',{pid:b.dataset.rhPid,mdlProj:b.dataset.rhPid,mtab:'cur'});else go('dsets',{pid:b.dataset.rhPid,dsProj:b.dataset.rhPid});});
};

/* 「发起研究」中间页：两条路——自由探索去对话，新建课题去建课题 */
function rhStartDialog(){
 const ic={chat:'<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 5.5A1.5 1.5 0 0 1 5.5 4h13A1.5 1.5 0 0 1 20 5.5v9a1.5 1.5 0 0 1-1.5 1.5H9l-4.5 4v-4H5.5A1.5 1.5 0 0 1 4 14.5z"/><path d="M12 7.5v5M9.5 10h5"/></svg>',
  project:'<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3.5 7.5A1.5 1.5 0 0 1 5 6h4l2 2h8a1.5 1.5 0 0 1 1.5 1.5v8A1.5 1.5 0 0 1 19 19H5a1.5 1.5 0 0 1-1.5-1.5z"/></svg>'};
 modal('发起研究','<div class="rh-start-grid"><button type="button" class="rh-start-opt" data-rh-start="chat"><span class="rh-start-ic">'+ic.chat+'</span><strong>自由探索</strong><small>直接提问，先不建课题；对话随时可以关联课题</small></button><button type="button" class="rh-start-opt" data-rh-start="project"><span class="rh-start-ic">'+ic.project+'</span><strong>新建课题</strong><small>定下研究目标，资料、任务、对话都归在课题下</small></button></div>','关闭',()=>true);
 const d=document.getElementById('dlg');const cancel=d.querySelector('button[value="cancel"]');if(cancel)cancel.hidden=true;
 d.querySelectorAll('[data-rh-start]').forEach(b=>b.onclick=()=>{const k=b.dataset.rhStart;d.close();
  if(k==='chat'){go('chat');setTimeout(()=>document.getElementById('ask')?.focus(),60);}
  else{go('projects');const nb=document.querySelector('[data-act="newproj"]');act('newproj',nb);}});
}
