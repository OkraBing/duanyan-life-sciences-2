/* 第二版 10 轮 tricky review：专挑第二版新加、改过的东西找茬。
   每轮一张新页面；每条检查独立失败、独立报告。跑构建产物。
   node review/v2-tricky.cjs          全跑
   node review/v2-tricky.cjs 4        只跑第 4 轮 */
const {chromium}=require('../test-browser.cjs');
const {blockExternalNetwork}=require('./offline-network.cjs');
const path=require('node:path');
const FILE='file://'+path.resolve(__dirname,'..','index.html');
const ONLY=process.argv[2]||'';
const ROUNDS=[];const R=(n,title,checks)=>ROUNDS.push({n,title,checks});
const res=[];
async function fresh(b,vp={width:1440,height:900},init){const p=await b.newPage({viewport:vp});p.__errs=[];p.on('pageerror',e=>p.__errs.push(String(e).slice(0,160)));
 if(init)await p.addInitScript(init);
 /* 外网一律拦掉：CDN、文献接口都不该让本地回归卡在 load 上 */
 await blockExternalNetwork(p);await p.goto('about:blank');await p.goto(FILE,{waitUntil:'domcontentloaded'});await p.waitForTimeout(1200);return p}
const route=p=>p.evaluate(()=>S.route);
function must(c,d){if(!c)throw new Error(d||'断言失败')}

/* ===== 第 1 轮：导航与入口 ===== */
R(1,'导航与入口',[
 ['侧栏六个入口各自打开并高亮自己',async p=>{for(const id of ['workbench','chat','projects','lab','shelf','data']){await p.click('#side .nav[data-navid="'+id+'"]');await p.waitForTimeout(200);
   const cur=await p.evaluate(()=>document.querySelector('#side .nav[aria-current="page"]')?.dataset.navid);must(cur===id,id+' 高亮成了 '+cur);}}],
 /* 模型制备从侧栏收走后，它和数据集一起归到「科研工具」 */
 ['子页面高亮所属父入口',async p=>{const want={materials:'projects',devices:'lab',mdl:'shelf',dsets:'shelf',schedules:'workbench',scheduledetail:'workbench',shareddetail:'projects',tools:'shelf'};
   for(const [r,par] of Object.entries(want)){await p.evaluate(r=>go(r),r);await p.waitForTimeout(200);const cur=await p.evaluate(()=>document.querySelector('#side .nav[aria-current="page"]')?.dataset.navid);must(cur===par,r+' 高亮 '+cur+'，应为 '+par);}}],
 ['从模型制备进「模型接入」后，侧栏停在科研工具（模型制备的新归属）',async p=>{await p.evaluate(()=>go('mdl'));await p.waitForTimeout(200);await p.click('#view [data-go="set"]');await p.waitForTimeout(300);
   const cur=await p.evaluate(()=>document.querySelector('#side .nav[aria-current="page"]')?.dataset.navid||'');must(cur==='shelf','模型接入页侧栏高亮：'+(cur||'无'));}],
 ['模型接入页有回到模型制备的路',async p=>{await p.evaluate(()=>go('mdl'));await p.waitForTimeout(200);await p.click('#view [data-go="set"]');await p.waitForTimeout(300);
   const back=await p.evaluate(()=>[...document.querySelectorAll('#view button,#view a')].map(e=>e.textContent.trim()).find(t=>/^←?\s*模型制备/.test(t))||'');must(back,'找不到回模型制备的按钮');}],
 ['折叠按钮的读屏名随状态变化',async p=>{const a=await p.getAttribute('.side-toggle','aria-label');await p.click('.side-toggle');await p.waitForTimeout(200);const b=await p.getAttribute('.side-toggle','aria-label');await p.click('.side-toggle');
   must(a&&b&&a!==b&&/折叠|收起/.test(a)&&/展开/.test(b),a+' / '+b);}],
]);
/* ===== 第 2 轮：全局搜索 ===== */
R(2,'全局搜索',[
 ['正则特殊字符不报错',async p=>{for(const q of ['(','[','*','\\','.*','?+']){await p.evaluate(q=>gsSearch(q),q);}must(!p.__errs.length,p.__errs.join(';'));}],
 ['搜不到时回显的词经过转义',async p=>{await p.evaluate(()=>gsOpen());await p.fill('.gs-input','<img src=x onerror=window.__x=1>');await p.waitForTimeout(150);
   must(await p.evaluate(()=>!window.__x&&!document.querySelector('.gs-empty img')),'注入的标签被执行了');}],
 ['「最近打开」里已删除的对象自动跳过',async p=>{await p.evaluate(()=>{LS.set('gs_recent',[{key:'st:not-exist',kind:'定时任务',label:'幽灵计划'},{key:'f:materials',kind:'功能',label:'资料空间'}])});
   const r=await p.evaluate(()=>gsSearch('').filter(x=>x.group==='最近打开').map(x=>x.label));must(r.length===1&&r[0]==='资料空间',r.join('|'));}],
 ['「最近打开」存储被写坏也能打开',async p=>{for(const bad of [{},'x',[null,1,'a',{}]]){await p.evaluate(v=>{LS.set('gs_recent',v)},bad);await p.evaluate(()=>gsSearch(''));}must(!p.__errs.length,p.__errs.join(';'));}],
 ['输入法组字时回车不打开结果',async p=>{await p.evaluate(()=>go('lab'));await p.evaluate(()=>gsOpen());await p.fill('.gs-input','定时');await p.waitForTimeout(100);
   await p.evaluate(()=>document.querySelector('.gs-input').dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',isComposing:true,bubbles:true})));await p.waitForTimeout(150);
   must(await route(p)==='lab'&&await p.evaluate(()=>document.getElementById('gs-dlg').open),'组字回车把结果打开了');}],
 ['关掉搜索后焦点回到原来的位置',async p=>{await p.evaluate(()=>go('chat'));await p.waitForTimeout(300);await p.focus('#ask');await p.keyboard.press('Control+k');await p.waitForTimeout(100);
   if(!await p.evaluate(()=>document.getElementById('gs-dlg')?.open)){await p.keyboard.press('Meta+k');await p.waitForTimeout(100);}
   await p.keyboard.press('Escape');await p.waitForTimeout(100);must(await p.evaluate(()=>document.activeElement?.id)==='ask','焦点落在 '+await p.evaluate(()=>document.activeElement?.className||document.activeElement?.tagName));}],
]);
/* ===== 第 3 轮：定时任务表单 ===== */
R(3,'定时任务表单',[
 ['空内容不能创建，并给出原因',async p=>{await p.evaluate(()=>go('schedules'));await p.waitForTimeout(200);const n0=await p.evaluate(()=>{stLoad();return ST.items.length});
   await p.click('#view [data-st-action="new"]');await p.waitForTimeout(150);await p.fill('#st-dialog [name="content"]','   ');await p.click('#st-dialog .btn-pri');await p.waitForTimeout(150);
   must(await p.evaluate(()=>ST.items.length)===n0&&await p.locator('#st-dialog .st-errors').count()===1,'空内容被创建了或没有提示');await p.keyboard.press('Escape');}],
 ['仅一次 + 过去的日期不能创建',async p=>{await p.click('#view [data-st-action="new"]');await p.waitForTimeout(150);await p.fill('#st-dialog [name="content"]','一次性任务');
   await p.check('#st-dialog input[name="period"][value="once"]',{force:true});await p.waitForTimeout(150);await p.fill('#st-dialog [name="date"]','2020-01-01');await p.dispatchEvent('#st-dialog [name="date"]','change');
   const n0=await p.evaluate(()=>ST.items.length);await p.click('#st-dialog .btn-pri');await p.waitForTimeout(150);must(await p.evaluate(()=>ST.items.length)===n0,'过去日期被创建了');await p.keyboard.press('Escape');}],
 ['内容里的 HTML 在列表、详情、工作台卡片里都按文字显示',async p=>{await p.click('#view [data-st-action="new"]');await p.waitForTimeout(150);
   await p.fill('#st-dialog [name="content"]','<b id="inj">粗体</b>追踪论文');await p.click('#st-dialog .btn-pri');await p.waitForTimeout(250);
   must(await p.evaluate(()=>!document.getElementById('inj')),'详情页渲染了标签');await p.evaluate(()=>go('workbench'));await p.waitForTimeout(300);must(await p.evaluate(()=>!document.getElementById('inj')),'工作台渲染了标签');}],
 ['只写时间的一句话也能得到非空任务名',async p=>{const t=await p.evaluate(()=>[stTitleFrom('每天早上9点'),stTitleFrom('每周五'),stTitleFrom('  ')]);must(t.every(x=>x&&x.trim()),JSON.stringify(t));}],
 ['每月 31 日：下一次执行落在有 31 日的月份',async p=>{const d=await p.evaluate(()=>{const f={...stBlank(),period:'monthly',monthday:31,time:'08:30'};const n=stNext(f,Date.UTC(2026,1,1));return new Date(n).getUTCDate()});must(d===31,'落在 '+d+' 日');}],
 ['连点两次「创建」只建一个',async p=>{await p.evaluate(()=>go('schedules'));await p.waitForTimeout(200);await p.click('#view [data-st-action="new"]');await p.waitForTimeout(150);await p.fill('#st-dialog [name="content"]','连点测试');
   const n0=await p.evaluate(()=>ST.items.length);await p.evaluate(()=>{const b=document.querySelector('#st-dialog .btn-pri');b.click();b.click();});await p.waitForTimeout(250);
   must(await p.evaluate(()=>ST.items.length)===n0+1,'建了 '+(await p.evaluate(()=>ST.items.length)-n0)+' 个');}],
]);
/* ===== 第 4 轮：一句话修改 ===== */
const NL=async(p,s)=>{await p.fill('[data-st-nl] input',s);await p.click('[data-st-nl] button');await p.waitForTimeout(220);return p.evaluate(()=>{const t=ST.items.find(x=>x.id===ST.pick);return t?{period:t.period,weekday:Number(t.weekday),monthday:Number(t.monthday),time:t.time,enabled:t.enabled,revs:(t.revisions||[]).map(r=>r.text)}:null})};
R(4,'一句话修改',[
 ['「删除」先确认，不直接删',async p=>{await p.evaluate(()=>{stLoad();ST.pick=ST.items[0].id;go('scheduledetail')});await p.waitForTimeout(250);const id=await p.evaluate(()=>ST.pick);
   await p.fill('[data-st-nl] input','删除');await p.click('[data-st-nl] button');await p.waitForTimeout(200);
   must(await p.evaluate(id=>ST.items.some(x=>x.id===id),id)&&await p.evaluate(()=>document.getElementById('dlg').open),'没确认就删了');await p.keyboard.press('Escape');}],
 ['「每周三下午2点」「改成每月15号」各自落对',async p=>{const a=await NL(p,'每周三下午2点');must(a.period==='weekly'&&a.weekday===3&&a.time==='14:00',JSON.stringify(a));
   const b=await NL(p,'改成每月15号');must(b.period==='monthly'&&b.monthday===15,JSON.stringify(b));}],
 ['「不要暂停」不会把任务暂停',async p=>{await NL(p,'恢复');const a=await NL(p,'不要暂停，继续每天跑');must(a.enabled===true,'被暂停了');}],
 ['带周期词的内容要求不会悄悄改掉执行计划',async p=>{const before=await NL(p,'改成每周五早上9点');const a=await NL(p,'每天的新论文只看 Nature 和 Cell');
   must(a.period===before.period&&a.weekday===before.weekday&&a.time===before.time,'执行计划被改成了 '+JSON.stringify(a));must(a.revs.includes('每天的新论文只看 Nature 和 Cell'),'这句话没记成补充要求');}],
 ['补充要求里的 HTML 按文字显示',async p=>{await NL(p,'<img src=x onerror=window.__y=1>');must(await p.evaluate(()=>!window.__y&&!document.querySelector('.st-revs img')),'被执行了');}],
 ['空输入什么也不改',async p=>{const n0=await p.evaluate(()=>(ST.items.find(x=>x.id===ST.pick).history||[]).length);await p.fill('[data-st-nl] input','   ');await p.click('[data-st-nl] button');await p.waitForTimeout(150);
   must(await p.evaluate(()=>(ST.items.find(x=>x.id===ST.pick).history||[]).length)===n0,'空输入也记了一条');}],
]);
/* ===== 第 5 轮：共享 ===== */
R(5,'共享',[
 ['工作空间没读好时点共享给提示、不报错',async p=>{await p.evaluate(()=>{RS.ready=false;ceShareAsset('experiment','B-2409','p1','x');RS.ready=true});must(!p.__errs.length,p.__errs.join(';'));}],
 ['别人的课题不能从我这里开启共享',async p=>{const r=await p.evaluate(()=>{const s=RS.data.shared.find(s=>!rsCan(s,'approve'));if(!s)return 'skip';const before=S.route;ceShareProject(s.projectId);return S.route});must(r==='skip'||r!=='sharednew','别人的课题进了开启共享');}],
 ['共享弹窗里连点两次「共享」只加一条',async p=>{const id=await p.evaluate(()=>{const s=rsProjectShared('p1');const a=s.assets.find(a=>a.kind==='experiment');s.assets=s.assets.filter(x=>x!==a);return a.sourceId});
   await p.evaluate(()=>go('lab'));await p.waitForTimeout(400);await p.click('[data-ce-share^="experiment|'+id+'|"]');await p.waitForTimeout(200);
   await p.evaluate(()=>{const b=document.querySelector('#dlg button[value="ok"]');b.click();b.click()});await p.waitForTimeout(700);
   const n=await p.evaluate(id=>rsProjectShared('p1').assets.filter(a=>a.kind==='experiment'&&a.sourceId===id).length,id);must(n===1,'加了 '+n+' 条');}],
 ['「已共享」悬停文字里的引号被转义',async p=>{const t=await p.evaluate(()=>{const s=rsProjectShared('p1');const old=s.name;s.name='A"B<c>';const h=ceSharedTag('experiment',s.assets.find(a=>a.kind==='experiment').sourceId,'p1');s.name=old;return h});
   must(!/title="[^"]*"B/.test(t)&&!/<c>/.test(t),t);}],
 ['共享后在共享课题详情里能看到这一条',async p=>{const id=await p.evaluate(()=>rsProjectShared('p1').assets.find(a=>a.kind==='experiment').name);await p.evaluate(()=>{RS.sharedPick=rsProjectShared('p1').id;go('shareddetail')});await p.waitForTimeout(400);
   /* 共享资产按类型分页签，实验在「实验」那一页；默认停在知识库，先切过去再找 */
   await p.click('[data-shared-asset-tab="exp"]');await p.waitForTimeout(300);
   must((await p.locator('#view').innerText()).includes(id),'共享课题里找不到 '+id);}],
]);
/* ===== 第 6 轮：对话 ===== */
R(6,'对话',[
 ['回答还在生成时不出「设为定时任务」',async p=>{const r=await p.evaluate(()=>{go('project',{pid:'p1'});const k=pjSid('p1');CONV[k]=[{role:'me',text:'每天追踪新论文'},{role:'ai',text:'正在',_live:1,_full:'正在整理'}];render();return !!document.querySelector('.st-offer-b')});must(!r,'生成中就出了按钮');}],
 ['用户原话带引号和尖括号，设定时照样能打开预填表单',async p=>{await p.evaluate(()=>{const k=pjSid('p1');CONV[k]=[{role:'me',text:'每天追踪 "Barnase" <论文> & 专利'},{role:'ai',text:'好的。'}];render()});
   await p.click('.st-offer-b');await p.waitForTimeout(200);must((await p.inputValue('#st-dialog [name="content"]'))==='每天追踪 "Barnase" <论文> & 专利','预填内容走样');await p.keyboard.press('Escape');}],
 ['附件菜单按 Esc 关闭，焦点回到附件按钮',async p=>{await p.click('[data-act="askfile"]');await p.waitForTimeout(150);await p.keyboard.press('Escape');await p.waitForTimeout(100);
   must(await p.evaluate(()=>!document.getElementById('menu')&&document.activeElement?.dataset?.act==='askfile'),'没关或焦点丢了');}],
 ['改绑项目：键盘右方向键展开、回车选中',async p=>{await p.evaluate(()=>{LS.set('chat_hist_collapsed',0);go('chat')});await p.waitForTimeout(500);
   await p.click('.history-more >> nth=0');await p.waitForTimeout(150);await p.focus('[data-sess-sub]');await p.keyboard.press('ArrowRight');await p.waitForTimeout(150);
   const f=await p.evaluate(()=>document.activeElement?.dataset?.flyPid!==undefined);must(f,'右方向键没把焦点送进右侧列表');await p.keyboard.press('Escape');}],
 ['没绑课题的对话，菜单写「添加到项目」',async p=>{const id=await p.evaluate(()=>{const x=SESSIONS.find(s=>!s.arch);x.pid=null;render();return x.id});await p.waitForTimeout(200);
   await p.click('[data-history-more="'+id+'"]');await p.waitForTimeout(150);must((await p.locator('[data-sess-sub] .nm').innerText())==='添加到项目','文案不对');await p.keyboard.press('Escape');}],
]);
/* ===== 第 7 轮：工作台 ===== */
R(7,'工作台',[
 ['一个定时任务都没有：区块给新建入口，点开是新建表单',async p=>{await p.evaluate(()=>{stLoad();ST.items=[];RESEARCH_HOME.schedOpen=true;go('workbench')});await p.waitForTimeout(300);
   must(await p.locator('[data-rh-sched-new]').count()===1,'没有新建入口');await p.click('[data-rh-sched-new]');await p.waitForTimeout(200);must(await p.evaluate(()=>!!document.getElementById('st-dialog')?.open),'没打开新建表单');await p.keyboard.press('Escape');}],
 ['区块标题的个数与卡片口径一致（不数课题已删除的）',async p=>{const r=await p.evaluate(()=>{ST.items=null;LS.set('scheduled_plans_v1',null);stLoad();const t=ST.items[0];ST.items.push({...t,id:'orphan-x',pid:'no-such'});RESEARCH_HOME.schedOpen=true;go('workbench');
   const title=document.getElementById('rh-sched-title').textContent;const valid=ST.items.filter(t=>DB.projects.some(p=>p.id===t.pid)).length;return {title,valid}});must(r.title.includes('('+r.valid+')'),JSON.stringify(r));}],
 ['只有暂停的任务：卡片写「已暂停」',async p=>{const r=await p.evaluate(()=>{ST.items=ST.items.filter(t=>t.id!=='orphan-x').map(t=>({...t,enabled:false}));RESEARCH_HOME.schedOpen=true;go('workbench');return [...document.querySelectorAll('.rh-sched-state')].map(e=>e.textContent)});must(r.length&&r.every(x=>x==='已暂停'),r.join('|'));}],
 ['学术资讯：键盘在页签间切换，详情能关掉',async p=>{await p.evaluate(()=>{RESEARCH_HOME.schedOpen=false;render()});await p.focus('[data-rh-tab="papers"]');await p.keyboard.press('ArrowRight');await p.waitForTimeout(200);
   must(await p.evaluate(()=>RESEARCH_HOME.tab)==='news','右方向键没切到学术资讯');await p.click('.rh-news-row >> nth=0');await p.waitForTimeout(150);await p.keyboard.press('Escape');await p.waitForTimeout(100);must(await p.evaluate(()=>!document.getElementById('dlg').open),'详情关不掉');}],
 ['研究动态对不上任务时落到课题的任务列表',async p=>{await p.evaluate(()=>{DB.acts=[{k:'wet',t:'测试动态',p:DB.projects[0].name,at:'今天 23:58',by:'我'}];RESEARCH_HOME.tab='papers';go('workbench')});await p.waitForTimeout(300);
   await p.click('.rh-activity >> nth=0');await p.waitForTimeout(300);must(['lab','labdet'].includes(await route(p)),'落到 '+await route(p));}],
]);
/* ===== 第 8 轮：模型制备与数据集 ===== */
R(8,'模型制备与数据集',[
 ['每个页签右上角都有「模型接入」',async p=>{for(const k of ['cur','dset','job','eval','batch']){await p.click('#view [data-mtab="'+k+'"]').catch(async()=>{await p.evaluate(()=>go('mdl'));await p.waitForTimeout(200);await p.click('#view [data-mtab="'+k+'"]')});await p.waitForTimeout(200);
   must(await p.locator('#view .pg-hd [data-go="set"]').count()===1,k+' 页签没有模型接入');}}],
 ['草稿数据集的「共享」置灰并写明原因',async p=>{await p.evaluate(()=>go('dsets'));await p.waitForTimeout(300);const r=await p.evaluate(()=>{const d=ALL_DSETS().find(d=>d.st!=='pub');if(!d)return 'skip';const b=document.querySelector('[data-ce-share^="dataset|'+d.id+'|"]');return b?(b.disabled||b.getAttribute('aria-disabled')==='true')+'|'+(b.title||b.dataset.tip||''):'nobtn'});
   must(r==='skip'||/^true\|.*发布后/.test(r),r);}],
 ['训练表单「新建数据集」带着当前课题过去',async p=>{await p.evaluate(()=>{S.pid='p2';go('trainnew')});await p.waitForTimeout(300);await p.click('[data-ce-new-ds]');await p.waitForTimeout(300);must((await p.evaluate(()=>S.route+'|'+S.pid))==='dsnew|p2','没带上课题');}],
 ['搜「模型接入」第一条直达',async p=>{const r=await p.evaluate(()=>gsSearch('模型接入')[0]?.label);must(r==='模型接入',r);}],
 ['页签切换不重置页面滚动以外的状态（课题筛选保留）',async p=>{await p.evaluate(()=>{go('dsets');S.dsProj='p1';render()});await p.waitForTimeout(200);await p.click('#view [data-mtab="cur"]');await p.waitForTimeout(200);await p.click('#view [data-mtab="dset"]');await p.waitForTimeout(200);
   const v=await p.evaluate(()=>S.dsProj);must(v==='p1','课题筛选被清掉：'+v);}],
]);
/* ===== 第 9 轮：视觉与可访问性 ===== */
const contrast=(p,sel)=>p.evaluate(sel=>{const e=document.querySelector(sel);if(!e)return null;const c=getComputedStyle(e);const parse=s=>{const m=s.match(/[\d.]+/g).map(Number);if(/^color\(srgb/.test(s))return [m[0]*255,m[1]*255,m[2]*255,m.length>3?m[3]:1];return m};
 let bg=null,x=e;while(x){const b=getComputedStyle(x).backgroundColor;const v=parse(b);if(v.length<4||v[3]>0.5){bg=v;break}x=x.parentElement}
 const L=v=>{const a=v.slice(0,3).map(u=>{u/=255;return u<=0.03928?u/12.92:Math.pow((u+0.055)/1.055,2.4)});return 0.2126*a[0]+0.7152*a[1]+0.0722*a[2]};
 const f=parse(c.color),l1=L(f),l2=L(bg||[255,255,255]);return +( (Math.max(l1,l2)+0.05)/(Math.min(l1,l2)+0.05) ).toFixed(2)},sel);
R(9,'视觉与可访问性',[
 ['浅色：已共享标签、定时卡片状态、页签数量对比度 ≥ 4.5',async p=>{await p.evaluate(()=>go('lab'));await p.waitForTimeout(400);const a=await contrast(p,'.shared-tag');await p.evaluate(()=>{RESEARCH_HOME.schedOpen=true;go('workbench')});await p.waitForTimeout(300);const b=await contrast(p,'.rh-sched-state');
   await p.evaluate(()=>go('mdl'));await p.waitForTimeout(300);const c=await contrast(p,'.tl-seg-b .num, #view .tab .tab-c');must([a,b,c].every(x=>x==null||x>=4.5),JSON.stringify({a,b,c}));}],
 ['深色：同样三处对比度 ≥ 4.5',async p=>{await p.emulateMedia({colorScheme:'dark'});await p.evaluate(()=>go('lab'));await p.waitForTimeout(400);const a=await contrast(p,'.shared-tag');await p.evaluate(()=>{RESEARCH_HOME.schedOpen=true;go('workbench')});await p.waitForTimeout(300);const b=await contrast(p,'.rh-sched-state');
   await p.evaluate(()=>{S.mtab='cur';go('mdl')});await p.waitForTimeout(300);const c=await contrast(p,'#view .tab .tab-c');await p.emulateMedia({colorScheme:'light'});must([a,b,c].every(x=>x==null||x>=4.5),JSON.stringify({a,b,c}));}],
 ['新控件键盘聚焦时有可见的焦点环',async p=>{const out=[];for(const [r,sel] of [['workbench','[data-rh-sched-pop]'],['lab','.lv-share'],['scheduledetail','.st-switch'],['schedules','#side .side-toggle']]){
   await p.evaluate(r=>{if(r==='scheduledetail'){stLoad();ST.pick=ST.items[0].id}go(r)},r);await p.waitForTimeout(250);await p.focus(sel).catch(()=>{});await p.keyboard.press('Shift+Tab');await p.keyboard.press('Tab');
   const ok=await p.evaluate(sel=>{const e=document.activeElement;if(!e||!e.matches(sel))return 'nofocus';const c=getComputedStyle(e);return c.outlineStyle!=='none'&&parseFloat(c.outlineWidth)>0||c.boxShadow!=='none'},sel);out.push(sel+':'+ok);}
   must(out.every(x=>x.endsWith(':true')),out.join(' '));}],
 ['360 宽：工作台、定时任务详情、科研工具没有横向溢出',async p=>{await p.setViewportSize({width:360,height:780});const out=[];for(const r of ['workbench','scheduledetail','shelf','dsets']){await p.evaluate(r=>{if(r==='scheduledetail'){stLoad();ST.pick=ST.items[0].id}go(r)},r);await p.waitForTimeout(300);
   const o=await p.evaluate(()=>{const v=document.getElementById('view');return v.scrollWidth-v.clientWidth});if(o>2)out.push(r+':'+o);}await p.setViewportSize({width:1440,height:900});must(!out.length,out.join(' '));}],
 ['同一排的小按钮高度一致（实验卡片「共享」与课题页「共享」）',async p=>{await p.evaluate(()=>go('lab'));await p.waitForTimeout(300);const a=await p.evaluate(()=>Math.round(document.querySelector('.lv-share')?.getBoundingClientRect().height||0));
   await p.evaluate(()=>go('project',{pid:'p2'}));await p.waitForTimeout(300);const b=await p.evaluate(()=>Math.round(document.querySelector('.pj-share-btn')?.getBoundingClientRect().height||0));must(a===b&&a>0,a+' vs '+b);}],
]);
/* ===== 第 10 轮：旧数据与刷新 ===== */
R(10,'旧数据与刷新',[
 ['旧版计划（没有 history / revisions / runs）照常显示',async p=>{await p.evaluate(()=>{const t={...stBlank(),id:'legacy-1',name:'旧计划',content:'旧内容',period:'weekly',weekday:2,time:'09:00',enabled:true};delete t.history;LS.set('scheduled_plans_v1',[t]);ST.items=null;stLoad();ST.pick='legacy-1';go('scheduledetail')});
   await p.waitForTimeout(250);must((await p.locator('#view .st-content-head h2').first().innerText())==='旧计划'&&!p.__errs.length,p.__errs.join(';'));}],
 ['计划存储被写坏（不是数组）也能打开定时任务页',async p=>{await p.evaluate(()=>{LS.set('scheduled_plans_v1',{bad:1});ST.items=null;go('schedules')});await p.waitForTimeout(250);must(!p.__errs.length&&await route(p)==='schedules',p.__errs.join(';'));}],
 ['刷新后停在已删除计划的详情：给出空状态，不报错',async p=>{await p.evaluate(()=>{LS.set('scheduled_pick','gone');LS.set('route','scheduledetail')});await p.goto('about:blank');await p.goto(FILE+'#scheduledetail',{waitUntil:'domcontentloaded'});await p.waitForTimeout(900);
   must(!p.__errs.length&&/选择一个定时任务|定时任务/.test(await p.locator('#view').innerText()),p.__errs.join(';'));}],
 ['课题「定时」页签刷新后还停在定时',async p=>{await p.evaluate(()=>{go('project',{pid:'p1'});S.pjtab='st';render()});await p.waitForTimeout(200);await p.reload({waitUntil:'domcontentloaded'});await p.waitForTimeout(900);
   const r=await p.evaluate(()=>S.route+'|'+(S.pjtab||''));must(r==='project|st',r);}],
 ['对话列表折叠状态刷新后保留，且只在对话页出现',async p=>{await p.evaluate(()=>{LS.set('chat_hist_collapsed',1);go('chat')});await p.reload({waitUntil:'domcontentloaded'});await p.waitForTimeout(900);await p.evaluate(()=>go('chat'));await p.waitForTimeout(300);
   const a=await p.evaluate(()=>document.getElementById('chatHistory')?.classList.contains('is-collapsed'));await p.evaluate(()=>go('materials'));await p.waitForTimeout(200);
   const b=await p.evaluate(()=>{const e=document.getElementById('chatHistory');return e?getComputedStyle(e).display:'none'});must(a&&b==='none',a+' / '+b);}],
]);

(async()=>{
 const b=await chromium.launch();
 for(const r of ROUNDS){if(ONLY&&String(r.n)!==ONLY)continue;
  const p=await fresh(b);
  for(const [name,fn] of r.checks){const e0=p.__errs.length;let ok=true,d='';
   try{await fn(p)}catch(e){ok=false;d=String(e.message||e).split('\n')[0].slice(0,220)}
   if(ok&&p.__errs.length>e0){ok=false;d='运行时报错：'+p.__errs.slice(e0).join(';')}
   res.push({r:r.n,t:r.title,name,ok,d});}
  await p.close();}
 await b.close();
 let last=0;for(const x of res){if(x.r!==last){console.log('\n第 '+x.r+' 轮 · '+x.t);last=x.r}console.log('  '+(x.ok?'PASS ':'FAIL ')+x.name+(x.ok?'':'\n        → '+x.d))}
 const bad=res.filter(x=>!x.ok).length;console.log('\n10 轮 tricky：'+(bad?bad+' 条未过 / '+res.length:res.length+' 条全部通过'));process.exitCode=bad?1:0;
})();
