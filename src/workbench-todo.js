/* 工作台「待办」：把分散在各课题里的待处理任务按优先级排一遍。
   数据只来自 wbAttentionTasks（和课题卡片、课题项目页的待处理角标同一口径），
   不混进共享审批——那条线在侧栏消息里，混进来会让两处的数对不上，也是重复入口。 */
const WB_TODO_IC='<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 11l2 2 4-4M5 4h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z"/></svg>';
/* 三档优先级：要动手的、要看结论的、正在跑的。
   「正在跑」不需要我做什么，所以只报条数，不展开，也不计进按钮上的数字。 */
const WB_TODO_GROUPS=[
 {id:'act',name:'需要处理',hint:'实验或任务出了异常，停在那里等人',tone:'alert'},
 {id:'read',name:'结果待确认',hint:'已经有结论，还没人看过',tone:'ready'},
 {id:'run',name:'进行中',hint:'正在跑，不用现在动手',tone:'quiet'},
];
function wbTodoItems(){
 const data=(typeof workbenchData==='function')?workbenchData():null;
 if(!data)return {act:[],read:[],run:[]};
 const tasks=(typeof wbAttentionTasks==='function'?wbAttentionTasks(data.tasks||[]):(data.tasks||[]));
 const name=pid=>(data.projects||[]).find(p=>p.id===pid)?.name||'';
 const row=t=>({key:t.key,name:t.name||t.id,project:name(t.pid),pid:t.pid,at:t.at||'',
  /* 卡片上写过的「演示流程」后缀在这里不重复 */
  brief:String(t.detail||t.label||'').replace(/\s*·\s*演示流程\s*$/,'').trim()});
 const out={act:[],read:[],run:[]};
 tasks.forEach(t=>{
  if(t.status==='failed'||(t.needsAction&&t.status!=='done'))out.act.push(row(t));
  else if(t.status==='done'&&t.needsAction)out.read.push(row(t));
  else if(t.status==='active')out.run.push(row(t));
 });
 const late=(a,b)=>String(b.at||'').localeCompare(String(a.at||''));
 out.act.sort(late);out.read.sort(late);out.run.sort(late);
 return out;
}
function wbTodoCount(){const g=wbTodoItems();return g.act.length+g.read.length;}
function wbTodoButton(){
 const n=wbTodoCount(),open=!!RESEARCH_HOME.todoOpen;
 return '<div class="rh-todo-anchor"><button class="btn rh-todo-btn'+(n?' has-n':'')+'" type="button" data-rh-todo-pop aria-haspopup="dialog" aria-expanded="'+open+'">'+WB_TODO_IC+'待办'+(n?'<span class="rh-todo-n num">'+n+'</span>':'')+'</button>'+(open?wbTodoPop():'')+'</div>';
}
function wbTodoPop(){
 const g=wbTodoItems(),n=g.act.length+g.read.length;
 const row=(t,tone)=>'<button class="rh-todo-row" type="button" data-rh-todo-task="'+esc(t.key)+'"><span class="rh-todo-dot is-'+tone+'" aria-hidden="true"></span><span class="rh-todo-copy"><strong title="'+esc(t.name)+'">'+esc(t.name)+'</strong><small><span>'+esc(t.project)+'</span>'+(t.brief?'<span title="'+esc(t.brief)+'">'+esc(t.brief)+'</span>':'')+'</small></span></button>';
 const sec=grp=>{const items=g[grp.id];if(!items.length)return '';
  if(grp.id==='run')return '<div class="rh-todo-sec is-quiet"><p class="rh-todo-run">还有 <b class="num">'+items.length+'</b> 项任务正在跑，不用现在动手。<button class="rh-link" type="button" data-rh-todo-list>查看</button></p></div>';
  return '<div class="rh-todo-sec"><div class="rh-todo-sec-h"><h3>'+grp.name+' <span class="num">'+items.length+'</span></h3><small>'+grp.hint+'</small></div>'
   +items.slice(0,4).map(t=>row(t,grp.tone)).join('')
   +(items.length>4?'<button class="rh-todo-more" type="button" data-rh-todo-list>还有 '+(items.length-4)+' 项，去任务列表看</button>':'')+'</div>';};
 return '<div class="rh-todo-pop" role="dialog" aria-labelledby="rh-todo-title"><div class="rh-todo-pop-h"><h2 id="rh-todo-title">待办'+(n?' <span>('+n+')</span>':'')+'</h2><button class="rh-link" type="button" data-rh-todo-list>全部任务</button></div>'
  +(n||g.run.length?WB_TODO_GROUPS.map(sec).join(''):'<p class="rh-todo-empty">没有待办。异常和待确认的结果会出现在这里。</p>')
  +'</div>';
}

/* 学术助手：工作台右下角的悬浮入口。
   「今日灵感」是从你自己的课题目标生成的一句追问——对着目标里的取舍发问，
   不给结论、不编数据。换一句、拿去对话里接着问，都在这张卡上。 */
const WB_AIDE_IC='<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3a6 6 0 0 1 3.6 10.8c-.6.5-.9 1-.9 1.7v.5H9.3v-.5c0-.7-.3-1.2-.9-1.7A6 6 0 0 1 12 3zM9.8 19h4.4M10.5 21.5h3"/></svg>';
/* 追问的句式：每一句都只用课题自己的名字和目标里写着的指标，不引入外部数字。
   对抗式＝站在「这个结论可能不成立」的一侧发问。 */
const WB_AIDE_ASKS=[
 p=>'如果「'+p.first+'」是靠放松「'+p.second+'」换来的，你打算把后者的下限定在哪里？',
 p=>'把对照换成另一批样本，'+p.name+' 现在的结论还站得住吗？先看哪一项会先垮？',
 p=>'目前的候选如果只满足「'+p.first+'」而卡在别的约束上，这一轮算成功还是算失败？',
 p=>'有没有一个更省事的解释，能同样说明 '+p.name+' 这一轮的观察？怎么把它排除掉？',
 p=>''+p.name+'：如果下一批数据和这一批方向相反，你会改模型，还是先怀疑测定？',
 p=>'「'+p.first+'」这一项，是实验测得准，还是模型算得准？两者对不上时先信谁？',
 p=>'要推翻 '+p.name+' 当前的主假设，最便宜的一个实验是什么？',
];
/* 目标文本写成「A，且 B、C」，拆出前两项当追问的抓手；拆不出就只用课题名。 */
function wbAideGoalParts(project){
 const source=(typeof DB!=='undefined')?DB.projects.find(x=>x.id===project.id):null;
 const goal=(typeof goalText==='function'&&source)?goalText(source):(project.description||'');
 const parts=String(goal||'').split(/[，,、；;]|且/).map(s=>s.trim()).filter(Boolean);
 return {name:project.name,first:parts[0]||project.name,second:parts[1]||parts[0]||project.name};
}
function wbAideIdea(){
 const projects=(typeof workbenchData==='function'?workbenchData().projects:[])||[];
 if(!projects.length)return null;
 const step=RESEARCH_HOME.aideIdx|0;
 const project=projects[step%projects.length];
 const parts=wbAideGoalParts(project);
 return {project,text:WB_AIDE_ASKS[step%WB_AIDE_ASKS.length](parts)};
}
function wbAidePanel(){
 const idea=wbAideIdea();
 return '<div class="rh-aide" role="dialog" aria-labelledby="rh-aide-title"><div class="rh-aide-h"><h2 id="rh-aide-title">学术助手</h2><button class="rh-aide-x" type="button" data-rh-aide-close aria-label="收起学术助手"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg></button></div>'
  +(idea?'<div class="rh-aide-body"><p class="rh-aide-label">今日灵感 · 对着目标里的取舍发问</p><p class="rh-aide-q">'+esc(idea.text)+'</p><p class="rh-aide-src">来自课题：'+esc(idea.project.name)+'</p></div>'
   +'<div class="rh-aide-f"><button class="btn btn-gh rh-aide-next" type="button" data-rh-aide-next>换一个</button><button class="btn btn-pri rh-aide-go" type="button" data-rh-aide-ask>拿去问端砚</button></div>'
   :'<div class="rh-aide-body"><p class="rh-aide-q">还没有课题。创建第一个课题之后，这里会按你的研究目标出追问。</p></div>')
  +'<p class="rh-aide-note">这是追问，不是结论；端砚不替你判断结果。</p></div>';
}
function wbAideMount(){
 return '<div class="rh-aide-anchor">'+(RESEARCH_HOME.aideOpen?wbAidePanel():'')
  +'<button class="rh-aide-fab'+(RESEARCH_HOME.aideOpen?' is-on':'')+'" type="button" data-rh-aide-pop aria-haspopup="dialog" aria-expanded="'+!!RESEARCH_HOME.aideOpen+'" aria-label="学术助手">'+WB_AIDE_IC+'<span>学术助手</span></button></div>';
}

/* 挂到工作台：按钮插在定时任务右边，助手挂在页面右下角。 */
const wbTodoHomeView=V.workbench;
V.workbench=function(){
 let html=wbTodoHomeView();
 const anchor='<div class="rh-sched-anchor">';
 const close='</div><button class="rh-new"';
 /* 定时任务那块结束、进入对话开始的位置，就是待办要站的地方 */
 const at=html.indexOf(close);
 if(html.indexOf(anchor)>=0&&at>=0)html=html.slice(0,at+6)+wbTodoButton()+html.slice(at+6);
 const end=html.lastIndexOf('</div>');
 if(end>=0)html=html.slice(0,end)+wbAideMount()+html.slice(end);
 return html;
};
const wbTodoBind=wbBind;
wbBind=function(root){
 wbTodoBind(root);if(S.route!=='workbench')return;
 root.querySelectorAll('[data-rh-todo-pop]').forEach(b=>b.onclick=e=>{e.stopPropagation();
  RESEARCH_HOME.todoOpen=!RESEARCH_HOME.todoOpen;if(RESEARCH_HOME.todoOpen)RESEARCH_HOME.schedOpen=false;render();
  if(RESEARCH_HOME.todoOpen)setTimeout(()=>view.querySelector('.rh-todo-pop .rh-todo-row, .rh-todo-pop [data-rh-todo-list]')?.focus(),20);});
 root.querySelectorAll('[data-rh-todo-task]').forEach(b=>b.onclick=()=>{RESEARCH_HOME.todoOpen=false;workbenchOpenTask(b.dataset.rhTodoTask);});
 root.querySelectorAll('[data-rh-todo-list]').forEach(b=>b.onclick=()=>{RESEARCH_HOME.todoOpen=false;workbenchOpenList('experiment','all',null);});
 root.querySelectorAll('[data-rh-aide-pop]').forEach(b=>b.onclick=e=>{e.stopPropagation();RESEARCH_HOME.aideOpen=!RESEARCH_HOME.aideOpen;render();
  if(RESEARCH_HOME.aideOpen)setTimeout(()=>view.querySelector('[data-rh-aide-next]')?.focus(),20);});
 root.querySelectorAll('[data-rh-aide-close]').forEach(b=>b.onclick=()=>{RESEARCH_HOME.aideOpen=false;render();setTimeout(()=>view.querySelector('[data-rh-aide-pop]')?.focus(),20);});
 root.querySelectorAll('[data-rh-aide-next]').forEach(b=>b.onclick=()=>{RESEARCH_HOME.aideIdx=(RESEARCH_HOME.aideIdx|0)+1;render();setTimeout(()=>view.querySelector('[data-rh-aide-next]')?.focus(),20);});
 /* 拿去问端砚：把这句追问填进对话输入框，人自己决定发不发 */
 root.querySelectorAll('[data-rh-aide-ask]').forEach(b=>b.onclick=()=>{
  const idea=wbAideIdea();RESEARCH_HOME.aideOpen=false;
  if(idea&&idea.project)S.pid=idea.project.id;
  go('chat');
  setTimeout(()=>{const box=document.getElementById('ask');if(!box||!idea)return;box.value=idea.text;box.dispatchEvent(new Event('input',{bubbles:true}));box.focus();},80);
 });
};
/* 点外面、按 Esc 都收起待办 */
document.addEventListener('click',e=>{if(!RESEARCH_HOME.todoOpen||S.route!=='workbench')return;if(e.target.closest('.rh-todo-anchor'))return;RESEARCH_HOME.todoOpen=false;render();},true);
document.addEventListener('keydown',e=>{if(e.key!=='Escape'||S.route!=='workbench'||document.querySelector('dialog[open]'))return;
 if(RESEARCH_HOME.todoOpen){e.preventDefault();RESEARCH_HOME.todoOpen=false;render();setTimeout(()=>view.querySelector('[data-rh-todo-pop]')?.focus(),20);return}
 if(RESEARCH_HOME.aideOpen){e.preventDefault();RESEARCH_HOME.aideOpen=false;render();setTimeout(()=>view.querySelector('[data-rh-aide-pop]')?.focus(),20);}
},true);
