/* Global navigation groups and settings routes. */
Object.assign(NAV_PARENT,{shared:'projects',sharednew:'projects',shareddetail:'projects',me:'settings',set:'mdl',files:'materials',chats:'chat',project:'projects',pw:'projects'});
Object.assign(NAVNAME,{projects:'课题项目',shared:'共享课题',dsets:'数据集',mdl:'模型制备',tools:'我的工具',data:'数据库',materials:'资料空间',devices:'设备管理',schedules:'定时任务',shelf:'科研工具',data:'公共数据库',settings:'设置'});
Object.assign(BACKNAME,{projects:'课题项目',settings:'设置'});
NAV_ROUTE.shared=1;
NAV_ROUTE.settings=NAV_ROUTE.me=NAV_ROUTE.set=1;
const navigationProjectViews={projects:V.projects,shared:V.shared};
function navigationProjectSharedLabel(card,shared){
 card.querySelector('.pcard-st')?.remove();
 if(shared)card.querySelector('.pcard-t')?.insertAdjacentHTML('beforeend','<span class="navigation-project-source">共享</span>');
}
function navigationProjectProgress(p,shared){
 let kind='',label='',title='',detail='',action='',task=null,at='',percent=null,pendingCount=0;
 if(!p){
  return '';/* 没有进展就不放这张卡；卡片等高由网格撑开 */
 }else
 {
  const tasks=(workbenchData({pid:p.id}).tasks||[]).filter(t=>t.pid===p.id&&t.isTask!==false&&!['canceled'].includes(t.status));
  const member=shared?.members.find(m=>m.id==='me'&&m.status==='active');
  const editable=shared?['owner','admin','editor'].includes(member?.role):can('edit')&&(p.ownerId||'me')==='me';
  /* 与工作台卡片同一口径：先过 wbAttentionTasks（已读回执等），再取失败/待动作 */
  const attention=typeof wbAttentionTasks==='function'?wbAttentionTasks(tasks):tasks;
  const pending=editable?attention.filter(t=>t.needsAction||t.status==='failed'):[];
  const active=tasks.filter(t=>['active','queued'].includes(t.status));
  const completed=tasks.filter(t=>t.status==='done').sort((a,b)=>String(b.at||'').localeCompare(String(a.at||'')));
  if(pending.length){
   task=pending[0];kind='confirm';label='待我处理';title=pending.length+' 项任务待处理';pendingCount=pending.length;
   detail=(task.name||task.id)+' · '+(task.detail||task.label||'请查看并处理');action='查看并处理';
  }else if(active.length){
   task=active[0];kind='running';label='正在执行';title=task.name||task.id;
   detail=task.detail||task.label||'任务正在执行';action='查看任务';
   if(Number.isFinite(task.progress))percent=Math.min(100,Math.max(0,task.progress));
  }else if(completed.length){
   task=completed[0];kind='summary';label='最近进展';title=task.name||task.id;
   detail=task.detail||task.label||'已有任务结果可查看';action='查看进展';
  }else if((p.returned||0)>0){
   kind='summary';label='进展概括';title='已积累 '+p.returned+' 条回流结果';
   detail='共 '+(p.rounds?.length||1)+' 轮研究记录，可进入课题查看已有结果。';action='查看进展';at=p.updated||'';
  }else if(!tasks.length&&!(p.kb||[]).length&&!(p.tools||[]).length&&!(p.arch||[]).length&&!(p.models||[]).length&&!(p.dsets||[]).length&&!(p.variants||0)){
   if(!editable)return '';
   return '<div class="project-start"><span>从一个研究问题开始</span><button class="project-update-action" type="button" data-project-progress-pid="'+esc(p.id)+'">开始科研对话 →</button></div>';
  }else return '';
  if(task)at=task.at||'';
 }
 if(kind==='confirm')return '<div class="navigation-progress project-update is-confirm is-mini"><span class="project-update-mini-label"><b class="project-update-count">'+pendingCount+'</b> 项待处理</span><button class="project-update-action" type="button" data-project-progress-pending="'+esc(p.id)+'" aria-label="处理 '+pendingCount+' 项待处理" title="处理 '+pendingCount+' 项待处理">处理</button></div>';
 const attrs=kind==='confirm'?'data-project-progress-pending="'+esc(p.id)+'"':task?'data-project-progress-task="'+esc(task.key)+'"':p?'data-project-progress-pid="'+esc(p.id)+'"':'data-project-progress-shared="'+esc(shared.id)+'"';
 return '<div class="navigation-progress project-update is-'+kind+'"><div class="project-update-head"><span>'+label+'</span>'+(at?'<time>'+esc(at)+'</time>':'')+'</div><strong>'+esc(title)+'</strong><p>'+esc(detail)+'</p>'+(percent!==null?'<div class="project-task-progress"><span>当前任务进度 '+percent+'%</span><progress value="'+percent+'" max="100" aria-label="当前任务进度 '+percent+'%"></progress></div>':'')+'<button class="project-update-action" type="button" '+attrs+'>'+action+' →</button></div>';
}
/* 课题项目只放项目卡；资源共享是侧栏里自己的一项，不做成这一页的页签。 */
V.projects=()=>navigationProjectsPage('projects');
/* 资源共享不再是独立页面：共享的往来并入资料空间「与你共享」。旧链接 #shared 直接落到那里。 */
V.shared=()=>{Object.assign(MATERIALS,{tab:'shared',space:'',query:'',type:'all'});return V.materials();};
function navigationProjectsPage(mode){
 const template=document.createElement('template');template.innerHTML=navigationProjectViews.projects();
 const heading=template.content.querySelector('h1');if(heading)heading.textContent=mode==='resources'?'资源共享':'课题项目';
 const create=template.content.querySelector('[data-act="newproj"]');
 /* 第二版：资料空间没有左侧入口了，它的家在课题项目页右上角——
    资料本来就按课题归档，从课题列表进去比从导航进去顺。 */
 if(create){create.textContent='＋ 新建课题';create.insertAdjacentHTML('beforebegin','<button class="btn" type="button" data-go="materials">资料空间</button><button class="btn" type="button" data-project-join>申请加入课题</button>');}
 const description=template.content.querySelector('.projects-header p');if(description)description.textContent='我的课题 · 包含我创建的和共享给我的课题';
 const projTab=mode==='resources'?'resources':'projects';
 let grid=template.content.querySelector('.pgrid');
 if(!grid){const section=template.content.querySelector('section');if(section){section.querySelector('.empty')?.remove();grid=document.createElement('div');grid.className='pgrid';section.appendChild(grid);}}
 if(!grid)return template.innerHTML;
 const ownIds=new Set();
 grid.querySelectorAll('[data-proj]').forEach(card=>{
  const p=rsProject(card.dataset.proj);ownIds.add(card.dataset.proj);
  card.querySelectorAll('[data-project-shared]').forEach(b=>b.remove());
  navigationProjectSharedLabel(card,!!rsProjectShared(p.id));
  card.insertAdjacentHTML('afterend',navigationProjectProgress(p,rsProjectShared(p.id)));
  card.parentElement.insertAdjacentHTML('beforeend',navigationProjectTeam(p,rsProjectShared(p.id)));
 });
 const shared=document.createElement('template');shared.innerHTML=navigationProjectViews.shared();
 const inbox=shared.content.querySelector('.request-inbox');
 if(inbox)grid.before(inbox);
 const query=(S.pq||'').trim().toLowerCase();
 shared.content.querySelectorAll('[data-rs-open]').forEach(card=>{
  const record=RS.data.shared.find(x=>x.id===card.dataset.rsOpen);
  if(!record||ownIds.has(record.projectId))return;
  // Ownership is independent of whether the project has been shared.
  if(record.owner==='me'&&DB.projects.some(p=>p.id===record.projectId&&(p.ownerId||'me')==='me'))return;
  if(query&&!(record.name+' '+(record.goal||'')+' '+card.textContent).toLowerCase().includes(query))return;
  card.querySelectorAll('[data-project-shared]').forEach(b=>b.remove());
  navigationProjectSharedLabel(card,true);
  card.querySelector('.pcard-f')?.insertAdjacentHTML('beforebegin',navigationProjectProgress(rsProject(record.projectId),record));
  const wrap=document.createElement('div');wrap.className='project-card-wrap is-shared-project';wrap.appendChild(card);wrap.insertAdjacentHTML('beforeend',navigationProjectTeam(rsProject(record.projectId),record));grid.appendChild(wrap);
 });
 grid.querySelectorAll('.project-card-wrap').forEach(wrap=>{
  const stats=wrap.querySelector('.pcard-f'),team=wrap.querySelector('.project-team-row');
  const update=wrap.querySelector('.project-update');if(update)wrap.querySelector('.pcard')?.after(update);
  if(stats&&team){const footer=document.createElement('div');footer.className='project-card-footer';stats.before(footer);wrap.appendChild(footer);footer.append(stats,team);}
 });
 template.content.querySelector('.sec-h')?.remove();
 if(projTab==='resources'){
  // 资源共享：三个页签——待我审批 / 我的申请 / 共享课题，每个页签只放自己的内容
  grid.querySelectorAll('.project-card-wrap:not(.is-shared-project), [data-proj]').forEach(el=>{
   const wrap=el.closest('.project-card-wrap');(wrap||el).remove();});
  const counts=iterationRequestInbox(RS.data.shared||[]);
  const tabs=[['incoming','待我审批',counts.incoming.length],['mine','我的申请',counts.mine.length],['projects','共享课题',grid.children.length]];
  const cur=tabs.some(t=>t[0]===S.sharedTab)?S.sharedTab:(tabs.find(t=>t[2])||tabs[0])[0];
  template.content.querySelector('.projects-header')?.insertAdjacentHTML('afterend','<div class="proj-tabs" role="tablist" aria-label="资源共享内容">'
   +tabs.map(([k,n,c])=>'<button role="tab" type="button" data-shared-tab="'+k+'" aria-selected="'+(cur===k)+'" tabindex="'+(cur===k?'0':'-1')+'">'+n+(c?'<span>'+c+'</span>':'')+'</button>').join('')+'</div>');
  const groups=inbox?[...inbox.querySelectorAll('.inbox-group')]:[];
  const groupOf=name=>groups.find(g=>(g.querySelector('h2')?.textContent||'').startsWith(name));
  if(cur!=='incoming')groupOf('待我审批')?.remove();
  if(cur!=='mine')groupOf('我的申请')?.remove();
  if(cur!=='projects')grid.remove();
  if(cur!=='projects'&&inbox&&!inbox.querySelector('.inbox-group'))inbox.insertAdjacentHTML('beforeend','<div class="empty">'+(cur==='incoming'?'目前没有待你审批的申请。':'你还没有发出申请。')+'</div>');
  if(cur!=='projects'&&!inbox)template.content.querySelector('.proj-tabs').insertAdjacentHTML('afterend','<div class="empty">'+(cur==='incoming'?'目前没有待你审批的申请。':'你还没有发出申请。')+'</div>');
  // 这一页签下搜课题没有意义，新建课题也不属于这里
  template.content.querySelector('.projects-header .fbar-q')?.remove();
  template.content.querySelector('.projects-header [data-act="newproj"]')?.remove();
  if(description)description.textContent='资产的申请与审批往来，以及共享给我的课题';
  if(cur==='projects'&&!grid.children.length)
   grid.insertAdjacentHTML('afterend','<div class="empty">还没有共享给你的课题。</div>');
 }else{
  inbox?.remove();
  if(!grid.children.length)grid.insertAdjacentHTML('afterend',(S.pq||'').trim()?'<div class="empty">没有匹配的课题，请换个关键词试试。<button class="btn" type="button" data-project-clear-query>清除搜索</button></div>':'<div class="empty">还没有课题。新建第一个课题，或申请加入组里已有的课题。<button class="btn btn-pri" type="button" data-act="newproj">＋ 新建课题</button></div>');
 }
 return template.innerHTML;
};

function settingsLayout(current,content){
 const items=[['settings','常规设置'],['set','模型接入']];
 return `<div class="settings-layout">
  <nav class="settings-menu" aria-label="设置分类">
   ${items.map(([route,name])=>`<a href="#${route}" data-go="${route}"${route===current?' aria-current="page"':''}>${name}</a>`).join('')}
  </nav>
  ${content}
 </div>`;
}
const navigationGeneralSettings=V.me;
V.me=V.settings=()=>{
 const template=document.createElement('template');template.innerHTML=navigationGeneralSettings();
 const heading=template.content.querySelector('h1');
 heading.classList.remove('sr');
 heading.textContent='设置';
 return settingsLayout('settings',template.innerHTML);
};
const navigationModelSettings=V.set;
V.set=()=>settingsLayout('set',navigationModelSettings());
// One fixed tooltip escapes the sidebar scroll container, including short window heights.
const navigationTip=document.createElement('div');navigationTip.id='navigation-tooltip';navigationTip.className='navigation-tooltip';navigationTip.setAttribute('role','tooltip');navigationTip.hidden=true;document.body.appendChild(navigationTip);
function navigationHideTip(){navigationTip.hidden=true;document.querySelectorAll('[aria-describedby="navigation-tooltip"]').forEach(b=>b.removeAttribute('aria-describedby'));}
function navigationShowTip(button){
 navigationHideTip();if(!S.collapsed||matchMedia('(max-width:860px)').matches)return;
 const rect=button.getBoundingClientRect();navigationTip.textContent=button.getAttribute('aria-label')||button.textContent.trim();
 navigationTip.hidden=false;navigationTip.style.left=(rect.right+12)+'px';navigationTip.style.top=Math.max(8,Math.min(innerHeight-navigationTip.offsetHeight-8,rect.top+(rect.height-navigationTip.offsetHeight)/2))+'px';button.setAttribute('aria-describedby','navigation-tooltip');
}
const navigationOriginalPaint=paintNav;
paintNav=function(force){
 navigationHideTip();navigationOriginalPaint(force);
 document.querySelectorAll('#side .nav[data-navid]').forEach(b=>{
  const label=b.querySelector('.nav-tx')?.textContent||b.textContent.trim();b.setAttribute('aria-label',label);b.removeAttribute('title');/* 展开时标签可见，原生 title 会盖在字上；收起时由自定义 tip 负责 */
  if(b.dataset.navigationBound)return;b.dataset.navigationBound='1';
  b.addEventListener('mouseenter',()=>navigationShowTip(b));b.addEventListener('mouseleave',navigationHideTip);
  b.addEventListener('focus',()=>navigationShowTip(b));b.addEventListener('blur',navigationHideTip);b.addEventListener('click',navigationHideTip);
 });
};
document.getElementById('side').addEventListener('scroll',navigationHideTip);
window.addEventListener('resize',navigationHideTip);
document.addEventListener('keydown',e=>{if(e.key==='Escape')navigationHideTip();});

function navigationProjectTeam(p,s){
 const members=s?s.members.filter(m=>m.status==='active'):[{name:'我'}];
 const role=s?.members.find(m=>m.id==='me'&&m.status==='active')?.role;
 const manage=s?['owner','admin'].includes(role):can('edit')&&(p?.ownerId||'me')==='me';
 const add=manage?'<span class="project-team-add" aria-hidden="true">＋</span>':'';
 const avatars=members.slice(0,3).map(m=>'<span class="project-team-avatar" title="'+esc(m.name)+'">'+esc(m.name.slice(0,1))+'</span>').join('');
 return '<div class="project-team-row"><button class="project-team-avatars" type="button" data-project-members="'+esc(s?.id||'')+'" data-project-members-pid="'+esc(p?.id||'')+'" aria-label="查看成员：'+esc(s?.name||p?.name||'课题')+'" title="'+members.length+' 位成员">'+avatars+add+'</button></div>';
}
function navigationTeamOpen(s,invite){
 RS.sharedPick=s.id;LS.set('rs_shared_pick',s.id);RS.actor='me';
 if(!rsCan(s,'read'))throw new Error('当前账号没有成员访问权限');
 if(invite&&rsCan(s,'manage'))rsInviteDialog();else rsMembersDialog();
}
function navigationJoinDialog(){
 if(!RS.ready||RS.error){toast(RS.error||'课题数据仍在加载，请稍后重试');return;}
 modal('申请加入课题','<label class="rs-field"><span>课题编号 *</span><input class="input" id="project-join-code" placeholder="请输入课题创建者提供的共享课题编号" maxlength="100"></label><label class="rs-field"><span>申请说明</span><textarea class="input" id="project-join-reason" maxlength="500" rows="3" placeholder="介绍研究方向与协作目的"></textarea></label><p class="rs-help">申请通过后加入课题。</p>','提交申请',()=>rsModalSave(async()=>{
 const code=document.getElementById('project-join-code').value.trim(),reason=document.getElementById('project-join-reason').value.trim();
 if(!code)throw new Error('请填写课题编号');
 const shared=RS.data.shared.find(s=>s.id===code);
 if(!shared)throw new Error('未找到该课题，请核对共享课题编号');
 if(shared.members.some(m=>m.id==='me'&&m.status==='active'))throw new Error('你已加入该课题');
 if((shared.joinRequests||[]).some(r=>r.actor==='me'&&r.state==='pending'))throw new Error('已有待审批申请，请等待创建者处理');
 const next=rsClone(RS.data),target=next.shared.find(s=>s.id===code);
 (target.joinRequests||(target.joinRequests=[])).push({id:rsId('join'),actor:'me',name:'我',reason,state:'pending',at:nowStamp()});await rsSave(next);toast('加入申请已保存，等待审批');
 }));
}
const navigationMembersDialog=rsMembersDialog;
rsMembersDialog=function(){
 navigationMembersDialog();const s=rsShared(),d=document.getElementById('dlg');if(!s||!d.open)return;
 const body=d.querySelector('.card-b');body.insertAdjacentHTML('afterbegin','<p class="rs-help">共享课题编号：<code>'+esc(s.id)+'</code></p>');
 if(!rsCan(s,'manage'))return;
 const requests=(s.joinRequests||[]).filter(r=>r.state==='pending');
 if(requests.length)body.insertAdjacentHTML('beforeend','<h3>加入申请</h3>'+requests.map(r=>'<div class="rs-member"><div><strong>'+esc(r.name)+'</strong><p>'+esc(r.reason||'未填写申请说明')+'</p></div><button class="btn" type="button" data-project-review="'+esc(r.id)+'" data-decision="rejected">拒绝</button><button class="btn btn-pri" type="button" data-project-review="'+esc(r.id)+'" data-decision="approved">同意加入</button></div>').join(''));
 body.querySelectorAll('[data-project-review]').forEach(button=>button.onclick=()=>{const sid=s.id;rsModalSave(async()=>{const live=RS.data.shared.find(x=>x.id===sid);if(!rsCan(live,'manage'))throw new Error('没有成员管理权限');const next=rsClone(RS.data),target=next.shared.find(x=>x.id===sid),request=target.joinRequests.find(r=>r.id===button.dataset.projectReview&&r.state==='pending');if(!request)throw new Error('该申请已处理');request.state=button.dataset.decision;request.reviewAt=nowStamp();if(request.state==='approved'){let member=target.members.find(m=>m.id===request.actor);if(member&&member.status==='active')throw new Error('该成员已加入');if(member)Object.assign(member,{status:'active',role:'viewer'});else target.members.push({id:request.actor,name:request.name,email:'',role:'viewer',status:'active',at:nowStamp()});}await rsSave(next);toast(request.state==='approved'?'已同意加入，默认仅查看':'已拒绝加入申请');});});
};
const navigationTeamBind=wbBind;
wbBind=function(root){
 navigationTeamBind(root);
 /* 待处理角标放进标签行右侧：原来的迷你块只留作数据与处理入口，不再占位 */
 root.querySelectorAll('.project-card-wrap').forEach(w=>{const mini=w.querySelector(':scope > .project-update.is-mini'),labels=w.querySelector('.pcard-labels');if(!mini||!labels||labels.querySelector('[data-pending-pill]'))return;
  const n=mini.querySelector('.project-update-count')?.textContent||'';const pill=document.createElement('span');pill.className='project-update-mini-label';pill.setAttribute('data-pending-pill','');pill.setAttribute('role','button');pill.tabIndex=0;pill.title='处理 '+n+' 项待处理';pill.innerHTML='<b class="project-update-count">'+esc(n)+'</b> 项待处理';labels.appendChild(pill);
  const fire=e=>{e.stopPropagation();e.preventDefault();mini.querySelector('.project-update-action')?.click();};pill.addEventListener('click',fire);pill.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' ')fire(e);});});
 /* 课题卡整张可点：点到底栏或迷你卡的空白处也进课题，点到里面的按钮/链接则各归各 */
 root.querySelectorAll('.project-card-wrap:not(.is-shared-project)').forEach(w=>{if(w.dataset.wrapBound)return;w.dataset.wrapBound='1';w.addEventListener('click',e=>{if(e.target.closest('button,a,[data-act],select,input,label'))return;w.querySelector('.pcard')?.click();});});
 root.querySelectorAll('[data-project-clear-query]').forEach(b=>b.onclick=()=>{S.pq='';render();});
 root.querySelectorAll('[data-project-progress-pending]').forEach(button=>button.onclick=()=>{
 const pid=button.dataset.projectProgressPending;
 /* 与角标同一口径：先过 wbAttentionTasks，再取失败/待动作，弹窗里的条数才和角标上的数一致 */
 const base=(workbenchData({pid}).tasks||[]).filter(t=>t.pid===pid&&t.isTask!==false&&t.status!=='canceled');
 const tasks=(typeof wbAttentionTasks==='function'?wbAttentionTasks(base):base).filter(t=>t.needsAction||t.status==='failed');
 if(tasks.length===1){workbenchOpenTask(tasks[0].key);return;}/* 只有一项就直接进去，不用多点一层 */
 /* 待处理弹窗：一行一项，整行可点；不再每项配一个「查看并处理」按钮，页脚只留一个关闭 */
 const brief=t=>String(t.detail||t.label||'').replace(/\s*·\s*演示流程\s*$/,'').trim();
 modal(tasks.length+' 项待处理','<ul class="pending-list">'+tasks.map(t=>'<li><button class="pending-row" type="button" data-project-pending-task="'+esc(t.key)+'"><span class="pending-main"><strong>'+esc(t.name||t.id)+'</strong>'+(brief(t)?'<small title="'+esc(brief(t))+'">'+esc(brief(t))+'</small>':'')+'</span><span class="chip '+(t.status==='failed'?'c-err':'c-mut')+'">'+(t.status==='failed'?'异常':'待确认')+'</span><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg></button></li>').join('')+'</ul>','关闭',()=>{});
 (()=>{const d=document.getElementById('dlg'),c=d.querySelector('button[value="cancel"]'),ok=d.querySelector('button[value="ok"]');if(c)c.hidden=true;if(ok)ok.classList.remove('btn-pri');})();
 document.querySelectorAll('#dlg [data-project-pending-task]').forEach(item=>item.onclick=()=>{document.getElementById('dlg').close();workbenchOpenTask(item.dataset.projectPendingTask);});
 });
 root.querySelectorAll('[data-project-progress-task]').forEach(button=>button.onclick=()=>workbenchOpenTask(button.dataset.projectProgressTask));
 root.querySelectorAll('[data-project-progress-pid]').forEach(button=>button.onclick=()=>{S.pid=button.dataset.projectProgressPid;go('project');});
 root.querySelectorAll('[data-project-progress-shared]').forEach(button=>button.onclick=()=>{RS.sharedPick=button.dataset.projectProgressShared;RS.actor='me';go('shareddetail');});
 root.querySelectorAll('[data-project-join]').forEach(button=>button.onclick=()=>navigationJoinDialog());
 root.querySelectorAll('[data-shared-tab]').forEach(button=>button.onclick=()=>{S.sharedTab=button.dataset.sharedTab;render();});
 root.querySelectorAll('[data-project-members]').forEach(button=>button.onclick=e=>{e.stopPropagation();const s=RS.data.shared.find(x=>x.id===button.dataset.projectMembers);if(s){try{navigationTeamOpen(s,false);}catch(error){toast(error.message);}}else {const pid=button.dataset.projectMembersPid;modal('团队成员','<div class="rs-member"><span class="rs-avatar">我</span><div><strong>我</strong><small>研究院未填写</small></div><span class="rs-tag">创建者</span></div>'+(can('edit')?'<button class="btn btn-pri" type="button" id="project-team-start">增加协作者</button>':''),'完成',()=>{});const start=document.getElementById('project-team-start');if(start)start.onclick=async()=>{start.disabled=true;try{const shared=await rsShareProject(pid);document.getElementById('dlg').close();go('projects');navigationTeamOpen(shared,true);}catch(error){toast(error.message);start.disabled=false;}};}});
};

/* 资料空间「与你共享」：除了共享给我的文件，还放资产的申请与审批往来（原资源共享页的内容）。 */
const materialsViewBeforeInbox=V.materials;
V.materials=function(){let html=materialsViewBeforeInbox();
 if(!RS.seedReady){const i=html.indexOf('<section class="ms-main">');if(i>0)html=html.slice(0,i+25)+'<p class="ms-loading" role="status">正在读取课题资料，计数稍后更新…</p>'+html.slice(i+25);}/* 课题还没水合完，先说明一下，别让人把半份数当真 */
 if(MATERIALS.tab==='shared'&&!MATERIALS.space){const inbox=iterationRequestInboxView(RS.data.shared||[]);
  if(inbox){const i=html.indexOf('</header>');if(i>0)html=html.slice(0,i+9)+'<div class="ms-inbox">'+inbox+'</div>'+html.slice(i+9);}}
 return html;};
V.files=V.materials;

/* 三栏页面（科研对话、定时任务）进入时默认折叠侧栏，离开时恢复进入前的状态；
   用户在三栏页里手动展开过，就尊重那次选择，不再反复折。 */
(function(){
 const THREE_COL=new Set(['chat','schedules','schedulenew','scheduledetail']);
 const original=go;let before=null,userOverrode=false;
 go=function(r,o){
  const wasThree=THREE_COL.has(S.route),isThree=THREE_COL.has(r);
  if(isThree&&!wasThree){before=S.collapsed?1:0;userOverrode=false;if(!S.collapsed&&!matchMedia('(max-width:860px)').matches){S.collapsed=1;}}
  else if(!isThree&&wasThree&&before!==null&&!userOverrode){S.collapsed=before;before=null;}
  return original(r,o);
 };
 document.addEventListener('click',e=>{if(THREE_COL.has(S.route)&&e.target.closest('[data-a="side"],[data-act="side"]'))userOverrode=true;},true);
 /* 直接以 #chat / #schedules 打开页面时也一样折叠 */
 setTimeout(()=>{if(THREE_COL.has(S.route)&&!S.collapsed&&!matchMedia('(max-width:860px)').matches){before=0;S.collapsed=1;render();}},0);
})();

/* 点已经选中的筛选胶囊 / 页签：状态不会变，不该触发整页重绘（会闪）。捕获阶段直接拦下。
   对话与课题页里的胶囊是多选开关，不在此列。 */
document.addEventListener('click',e=>{
 if(['chat','project'].includes(S.route))return;
 const t=e.target&&e.target.closest&&e.target.closest('#view .pill.is-on,#view .pill.on,#view [role="tab"][aria-selected="true"],#view .seg-i.on');
 if(!t||t.closest('form,dialog'))return;
 e.stopPropagation();e.preventDefault();
},true);
