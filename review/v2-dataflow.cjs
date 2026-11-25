/* 第二版：需求核对 + 新功能数据流用例
   A 组：本轮与之前提过的每一条需求，在构建产物里逐条核对「做了没有、做对没有」。
   B 组：新功能的数据流——数据从哪来、写到哪去、改了以后各处是否同步、失败或取消后状态是否干净。
   每组用一张新页面，组内按用例顺序推进。跑构建产物，不跑 src。
   node review/v2-dataflow.cjs          全跑
   node review/v2-dataflow.cjs --list   只列用例 */
const {chromium}=require('../test-browser.cjs');
const {blockExternalNetwork}=require('./offline-network.cjs');
const path=require('node:path');
const FILE='file://'+path.resolve(__dirname,'..','index.html');
const CASES=[];const T=(id,name,fn)=>CASES.push({id,name,fn});
const R=[];
async function fresh(b,opt={}){const p=await b.newPage({viewport:{width:1440,height:900}});p.__errs=[];p.on('pageerror',e=>p.__errs.push(String(e).slice(0,160)));
 if(opt.keep)await p.addInitScript(()=>{try{localStorage.dy_keepTest='1'}catch(e){}});
 await blockExternalNetwork(p);await p.goto('about:blank');await p.goto(FILE,{waitUntil:'domcontentloaded'});await p.waitForTimeout(1200);return p}
const $route=p=>p.evaluate(()=>S.route);
function expect(cond,detail){if(!cond)throw new Error(detail||'断言失败')}

/* ================= A 组：需求核对 ================= */
T('A01','侧栏三组七个入口，名字与顺序',async p=>{
 const g=await p.evaluate(()=>['navA','navB','navC'].map(id=>({lbl:document.querySelector('#'+id+' .lbl')?.textContent.trim(),items:[...document.querySelectorAll('#'+id+' .nav-tx')].map(e=>e.textContent.trim())})));
 expect(JSON.stringify(g)===JSON.stringify([{lbl:'研究',items:['工作台','科研对话','课题项目']},{lbl:'实验',items:['实验管理']},{lbl:'资源',items:['模型制备','科研工具','数据库']}]),JSON.stringify(g));
});
T('A02','资料空间：课题项目右上可进，资料空间侧栏顶可回',async p=>{
 await p.evaluate(()=>go('projects'));await p.waitForTimeout(300);
 await p.click('#view [data-go="materials"]');await p.waitForTimeout(300);expect(await $route(p)==='materials','没进资料空间');
 await p.click('#view .ms-back');await p.waitForTimeout(300);expect(await $route(p)==='projects','没回到课题项目');
});
T('A03','实验管理有「设备管理」，没有「查看设备列表」',async p=>{
 await p.evaluate(()=>go('lab'));await p.waitForTimeout(300);
 const t=await p.locator('#view').innerText();expect(/设备管理/.test(t)&&!/查看设备列表/.test(t),'文案不对');
});
T('A04','设置不在侧栏，账户可达；工作台右上角有定时任务',async p=>{
 expect(await p.locator('#side .nav[data-navid="settings"]').count()===0,'侧栏还有设置');
 await p.click('#side .acct-b');await p.waitForTimeout(300);expect(['me','settings'].includes(await $route(p)),'账户没去个人中心');
 await p.evaluate(()=>go('workbench'));await p.waitForTimeout(300);expect(await p.locator('#view .rh-header [data-rh-sched-pop]').count()===1,'工作台右上角没有定时任务按钮');
});
T('A05','科研工具「市场 / 我的」，数据库「公共数据集 / 我的数据集」；#tools 落到科研工具·我的',async p=>{
 for(const [r,want] of [['shelf',['市场','我的']],['data',['公共数据集','我的数据集']]]){await p.evaluate(r=>go(r),r);await p.waitForTimeout(300);
  const tabs=await p.$$eval('#view [data-rs-market-tab]',es=>es.map(e=>e.textContent.trim()));expect(JSON.stringify(tabs)===JSON.stringify(want),r+'：'+tabs.join('|'));}
 await p.evaluate(()=>go('tools'));await p.waitForTimeout(300);expect((await p.evaluate(()=>S.route+'|'+RS.marketTab))==='shelf|mine','#tools 没落到我的');
});
T('A06','模型制备：标题、页签顺序与名字；数据集页签无返回键',async p=>{
 await p.evaluate(()=>go('mdl'));await p.waitForTimeout(300);
 const tabs=await p.$$eval('#view [data-mtab]',es=>es.map(e=>e.textContent.replace(/\d+$/,'').trim()));
 expect(JSON.stringify(tabs)==='["模型库","数据集","模型训练","模型评测","模型推理"]',tabs.join('|'));
 expect((await p.locator('#view h1').first().innerText())==='模型制备','标题');
 await p.click('#view [data-mtab="dset"]');await p.waitForTimeout(300);
 expect(await p.locator('#view .pg-back').count()===0,'数据集页签出现了返回键');
 expect((await p.locator('#side .nav[aria-current="page"]').getAttribute('data-navid'))==='mdl','侧栏高亮不是模型制备');
});
T('A07','工作台「进入对话」直达对话、无中间弹窗、输入框聚焦',async p=>{
 await p.evaluate(()=>go('workbench'));await p.waitForTimeout(300);
 expect((await p.locator('#view [data-wb-start]').innerText()).trim()==='进入对话','按钮文案');
 await p.click('#view [data-wb-start]');await p.waitForTimeout(400);
 expect(await $route(p)==='chat'&&!(await p.evaluate(()=>document.querySelector('dialog[open]'))),'没直达或有弹窗');
 expect(await p.evaluate(()=>document.activeElement?.id)==='ask','输入框没聚焦');
});
T('A08','工作台课题「上一页 / 下一页」分页，首页上一页禁用、末页下一页禁用',async p=>{
 await p.evaluate(()=>go('workbench'));await p.waitForTimeout(300);
 const prev=p.locator('[data-rh-project-page="prev"]'),next=p.locator('[data-rh-project-page="next"]');
 expect(await prev.isDisabled(),'第一页上一页没禁用');
 let guard=0;while(!(await next.isDisabled())&&guard++<10){await next.click();await p.waitForTimeout(150);}
 expect(await next.isDisabled()&&/^\d+ \/ \d+$/.test(await p.locator('.rh-pager-n').innerText()),'末页状态不对');
});
T('A09','研究动态点进任务（详情或列表），不进课题对话流',async p=>{
 await p.evaluate(()=>go('workbench'));await p.waitForTimeout(300);
 await p.locator('#view .rh-activity').first().click();await p.waitForTimeout(400);
 expect(['lab','labdet','mdl'].includes(await $route(p)),'落到 '+await $route(p));
});
T('A10','对话切换面板：当前对话在最上 → 其他对话 → 新建对话',async p=>{
 await p.evaluate(()=>go('project',{pid:DB.projects[0].id}));await p.waitForTimeout(400);
 await p.click('[data-act="pjswitch"]');await p.waitForTimeout(200);
 const L=await p.$$eval('#menu .menu-l',es=>es.map(e=>e.textContent));const last=await p.$$eval('#menu .nm',es=>es.map(e=>e.textContent).pop());
 expect(L[0]==='当前对话'&&/其他对话/.test(L[1]||'')&&last==='新建对话',L.join('|')+' / '+last);
});
T('A11','共享：页头写明范围；可共享资产不含对话；未批准看不到正文',async p=>{
 await p.evaluate(()=>{RS.sharedPick=RS.data.shared.find(s=>!rsCan(s,'approve')).id;go('shareddetail')});await p.waitForTimeout(500);
 const scope=await p.locator('#view .shared-scope').innerText();expect(/对话流/.test(scope)&&/申请/.test(scope),scope);
 const kinds=await p.evaluate(()=>[...new Set(rsCandidates(DB.projects[0].id).map(a=>a.kind))]);expect(!kinds.some(k=>/chat|conv|session/i.test(k)),kinds.join(','));
 const g=await p.evaluate(()=>{const s=RS.data.shared.find(x=>!rsCan(x,'approve'));const a=s.assets.find(a=>!iterationAuthorized(s,a));return a?/申请通过后可查看完整内容/.test(iterationAssetBody(s,a)):true});expect(g,'未授权能看到正文');
});
T('A12','侧栏：入口行高 34、间距 3px；折叠前后 logo / 搜索 / 入口不跳位',async p=>{
 const h=await p.$$eval('#side .nav-group .nav',es=>es.map(e=>Math.round(e.getBoundingClientRect().height)));expect(h.every(x=>x===34),h.join(','));
 const g=()=>p.evaluate(()=>[document.querySelector('.brand-mark'),document.querySelector('.gs-trigger svg'),...document.querySelectorAll('#side .nav')].map(e=>{const r=e.getBoundingClientRect();return Math.round(r.x)+','+Math.round(r.y)}).join(' '));
 const a=await g();await p.click('.side-toggle');await p.waitForTimeout(250);await p.mouse.move(700,500);const c=await g();await p.click('.side-toggle');
 expect(a===c,a+' → '+c);
});
T('A13','老链接全部能打开并有标题',async p=>{
 const bad=[];for(const r of ['materials','files','shared','devices','dsets','dsnew','schedules','schedulenew','settings','tools','set']){
  await p.goto('about:blank');await p.goto(FILE+'#'+r,{waitUntil:'domcontentloaded'});await p.waitForTimeout(600);
  if(!(await p.locator('#view h1, #view h2').count()))bad.push(r);}
 expect(!bad.length,'打不开：'+bad.join(','));
});

/* ================= B 组：数据流用例 ================= */
T('UC01','新建课题 → 全局搜索立刻能搜到（索引不缓存）',async p=>{
 await p.evaluate(()=>go('projects'));await p.waitForTimeout(300);
 await p.evaluate(()=>{const b=document.querySelector('[data-act="newproj"]');act('newproj',b)});await p.waitForTimeout(200);
 await p.fill('#pn','数据流用例课题');await p.click('#dlg button[value="ok"]');await p.waitForTimeout(400);
 const hit=await p.evaluate(()=>gsSearch('数据流用例课题').filter(r=>r.kind==='课题').map(r=>r.label));
 expect(hit.includes('数据流用例课题'),'搜不到：'+hit.join('|'));
});
T('UC02','课题页签新建计划 → 写入本机存储 → 课题页签 / 定时任务总览 / 全局搜索三处一致',async p=>{
 const pid=await p.evaluate(()=>DB.projects[0].id);
 await p.evaluate(pid=>{go('project',{pid});S.pjtab='st';render()},pid);await p.waitForTimeout(300);
 await p.click('[data-stp-new]');await p.waitForTimeout(200);
 await p.fill('#st-dialog [name="content"]','UC02 计划');
 await p.click('#st-dialog .btn-pri');await p.waitForTimeout(300);
 const stored=await p.evaluate(()=>(LS.get('scheduled_plans_v1',[])||[]).find(t=>t.name==='UC02 计划'));
 expect(stored&&stored.pid===pid&&stored.enabled===true,'存储：'+JSON.stringify(stored));
 const inTab=await p.$$eval('.stp-row .pjx-f-n',es=>es.map(e=>e.textContent)).then(a=>a.includes('UC02 计划'));
 await p.evaluate(()=>go('schedules'));await p.waitForTimeout(300);
 const inList=(await p.locator('#view').innerText()).includes('UC02 计划');
 const inSearch=await p.evaluate(()=>gsSearch('UC02').some(r=>r.kind==='定时任务'&&r.label==='UC02 计划'));
 expect(inTab&&inList&&inSearch,JSON.stringify({inTab,inList,inSearch}));
});
T('UC03','暂停计划 → 课题页签与全局搜索同时显示「已暂停」',async p=>{
 const id=await p.evaluate(()=>ST.items.find(t=>t.name==='UC02 计划').id);
 await p.evaluate(id=>{ST.pick=id;go('scheduledetail')},id);await p.waitForTimeout(300);
 const tg=p.locator('#view [data-st-action="toggle"]');expect(await tg.count()>0,'找不到暂停按钮');await tg.first().click();await p.waitForTimeout(300);
 const st=await p.evaluate(id=>{const t=ST.items.find(t=>t.id===id);return {enabled:t.enabled,state:stState(t).label,search:gsSearch('UC02').find(r=>r.kind==='定时任务')?.sub||''}},id);
 await p.evaluate(()=>{go('project',{pid:DB.projects[0].id});S.pjtab='st';render()});await p.waitForTimeout(300);
 const row=await p.evaluate(()=>[...document.querySelectorAll('.stp-row')].find(r=>/UC02 计划/.test(r.textContent))?.textContent||'');
 expect(st.enabled===false&&st.state==='已暂停'&&/已暂停/.test(st.search)&&/已暂停/.test(row),JSON.stringify({st,row}));
});
T('UC04','关联课题不在了 → 计划显示「课题已删除」，并且不能直接恢复',async p=>{
 const r=await p.evaluate(()=>{const t=ST.items.find(t=>t.name==='UC02 计划');const keep=DB.projects.slice();DB.projects=DB.projects.filter(x=>x.id!==t.pid);
  const label=stState(t).label,sub=gsSearch('UC02').find(x=>x.kind==='定时任务')?.sub||'';
  ST.pick=t.id;go('scheduledetail');const b=document.querySelector('#view [data-st-action="toggle"]');let blocked=false;if(b){b.click();blocked=ST.items.find(x=>x.id===t.id).enabled===false;}
  DB.projects=keep;render();return {label,sub,blocked}});
 expect(r.label==='课题已删除'&&r.blocked,JSON.stringify(r));
 expect(/课题已删除/.test(r.sub),'全局搜索里没有标出课题已删除：'+r.sub);
});
T('UC05','对话设定时：原话 → 预填 → 保存；计划字段与识别结果一致，保存后留在原页',async p=>{
 const pid=await p.evaluate(()=>DB.projects[0].id);
 await p.evaluate(pid=>{go('project',{pid});const k=pjSid(pid);CONV[k]=[{role:'me',text:'每个星期五晚上8点帮我整理本周新增的测定数据'},{role:'ai',text:'好的。'}];render()},pid);await p.waitForTimeout(300);
 await p.click('.st-offer-b');await p.waitForTimeout(250);await p.click('#st-dialog .btn-pri');await p.waitForTimeout(300);
 const t=await p.evaluate(()=>ST.items.find(t=>t.content==='每个星期五晚上8点帮我整理本周新增的测定数据'));
 expect(t&&t.pid===pid&&t.period==='weekly'&&Number(t.weekday)===5&&t.time==='20:00','计划：'+JSON.stringify(t&&{pid:t.pid,period:t.period,weekday:t.weekday,time:t.time}));
 expect(await $route(p)==='project','保存后离开了课题页');
});
T('UC06','预填表单取消（取消键 / Esc / 切页）后不残留「留在原地」：之后正常新建仍跳到计划详情',async p=>{
 for(const how of ['cancel','esc','nav']){
  await p.evaluate(()=>{go('project',{pid:DB.projects[0].id});S.pjtab='st';render()});await p.waitForTimeout(250);
  await p.click('[data-stp-new]');await p.waitForTimeout(200);
  if(how==='cancel')await p.click('#st-dialog [data-st-action="cancel"]');
  else if(how==='esc')await p.keyboard.press('Escape');
  else await p.evaluate(()=>go('lab'));
  await p.waitForTimeout(200);
  expect(await p.evaluate(()=>!ST.stay),how+' 之后 ST.stay 仍为 true');
 }
 await p.evaluate(()=>go('schedules'));await p.waitForTimeout(250);
 await p.click('#view [data-st-action="new"]');await p.waitForTimeout(200);
 await p.fill('#st-dialog [name="content"]','UC06 计划');
 await p.click('#st-dialog .btn-pri');await p.waitForTimeout(300);
 expect(await $route(p)==='scheduledetail','定时任务页新建后没跳到详情：'+await $route(p));
});
T('UC07','从资料空间选文件 → 挂到输入框；重复选不重复；回收站里的不出现',async p=>{
 await p.evaluate(()=>go('project',{pid:DB.projects[0].id}));await p.waitForTimeout(300);
 const pick=async()=>{await p.click('[data-act="askfile"]');await p.waitForTimeout(120);await p.click('#menu [data-go="__mat"]');await p.waitForTimeout(150);};
 await pick();const name=await p.$eval('#menu [data-go^="m:"] .nm',e=>e.textContent);await p.click('#menu [data-go^="m:"]');await p.waitForTimeout(200);
 await pick();await p.click('#menu [data-go="m:'+name+'"]');await p.waitForTimeout(200);
 const n=await p.evaluate(n=>(S.askFiles||[]).filter(x=>x===n).length,name);expect(n===1,'重复了 '+n+' 次');
 const trashOk=await p.evaluate(()=>{const rows=materialsRows();const x=rows[0];const was=LS.get('materials_prefs',{stars:[],trash:[],recent:[]});
  LS.set('materials_prefs',{...was,trash:[...(was.trash||[]),x.id]});
  const btn=document.querySelector('[data-act="askfile"]');ceMaterialsMenu(btn);const names=[...document.querySelectorAll('#menu .nm')].map(e=>e.textContent);closeMenu();LS.set('materials_prefs',was);
  return !names.includes(x.name)||rows.filter(r=>r.name===x.name).length>1});
 expect(trashOk,'回收站里的文件出现在选择器里');
});
T('UC08','实验结论 → 数据集：带入测定表 → 建立 → 数据集页签与全局搜索都能看到',async p=>{
 await p.evaluate(()=>alVisitBatch('B-2409'));await p.waitForTimeout(400);
 await p.click('[data-ce-batch-ds]');await p.waitForTimeout(400);
 const f=await p.evaluate(()=>({src:NEWDS.src,from:NEWDS.from,rows:NEWDS.parsed?.rows?.length||0,cols:NEWDS.parsed?.cols?.length||0}));
 expect(f.src==='proj'&&/B-2409/.test(f.from)&&f.rows>0,'预填：'+JSON.stringify(f));
 const made=await p.evaluate(()=>{if(!NEWDS.name)NEWDS.name='B-2409 测定数据';if(!NEWDS.target){const c=NEWDS.parsed.cols.find(c=>/dTm|ΔTm|kd|KD/i.test(c))||NEWDS.parsed.cols[NEWDS.parsed.cols.length-1];NEWDS.target=c;}
  const before=ALL_DSETS().length;act('dsmake',document.body);return {before,after:ALL_DSETS().length,route:S.route,pick:S.dsPick}});
 expect(made.after===made.before+1&&made.route==='dsets','建立：'+JSON.stringify(made));
 const s=await p.evaluate(id=>gsSearch(id).some(r=>r.kind==='数据集'),made.pick);expect(s,'全局搜索搜不到新数据集 '+made.pick);
});
T('UC09','共享：审批一条 → 消息「待你审批」减一、角标同步；导入已批准的 → 「申请已批准」消失',async p=>{
 const before=await p.evaluate(()=>({n:INBOX().filter(x=>x.tag==='待你审批').length,u:inboxUnread()}));
 await p.evaluate(async()=>{const s=RS.data.shared.find(s=>rsCan(s,'approve'));const r=s.requests.find(r=>r.state==='pending');RS.sharedPick=s.id;await rsDecide(s.id,r.id,true,'同意');render()});await p.waitForTimeout(300);
 const mid=await p.evaluate(()=>({n:INBOX().filter(x=>x.tag==='待你审批').length,u:inboxUnread(),badge:document.getElementById('bellN').textContent.trim()}));
 expect(mid.n===before.n-1&&mid.u===before.u-1&&String(mid.u)===mid.badge,JSON.stringify({before,mid}));
 await p.evaluate(async()=>{const s=RS.data.shared.find(s=>!rsCan(s,'approve'));const r=s.requests.find(r=>r.state==='approved'&&r.actor===RS.actor);RS.sharedPick=s.id;await rsImport(s.id,r.id);render()});await p.waitForTimeout(300);
 expect(await p.evaluate(()=>!INBOX().some(x=>x.tag==='申请已批准')),'导入后「申请已批准」还在');
});
T('UC10','消息已读：点开一条后记为已读，角标减一，刷新后仍是已读',async p=>{
 const id=await p.evaluate(()=>INBOX().find(x=>/^s[ra]-/.test(x.id)&&!x.read)?.id);expect(id,'没有可用的共享消息');
 await p.evaluate(()=>go('lab'));await p.waitForTimeout(300);/* 上一条留下的抽屉先关掉 */
 const u0=await p.evaluate(()=>inboxUnread());
 await p.click('#bell');await p.waitForTimeout(300);
 await p.click('#menu [data-go="'+id+'"]');
 await p.waitForTimeout(300);
 const u1=await p.evaluate(()=>inboxUnread());expect(u1===u0-1,u0+' → '+u1);
 await blockExternalNetwork(p);await p.goto('about:blank');await p.goto(FILE,{waitUntil:'domcontentloaded'});await p.waitForTimeout(900);
 expect(await p.evaluate(id=>INBOX().find(x=>x.id===id)?.read===true,id),'刷新后不是已读');
});
T('UC11','最近打开：搜索打开一个对象 → 记入本机 → 重载后空输入第一条就是它',async p=>{
 await p.evaluate(()=>{gsOpen();GS.q='文献追踪';gsPaint();const i=GS.rows.findIndex(r=>r.kind==='定时任务');gsPick(i)});await p.waitForTimeout(400);
 await blockExternalNetwork(p);await p.goto('about:blank');await p.goto(FILE,{waitUntil:'domcontentloaded'});await p.waitForTimeout(900);
 const first=await p.evaluate(()=>{const r=gsSearch('');return r[0]?.group+'|'+r[0]?.label});
 expect(/^最近打开\|每日文献追踪$/.test(first),first);
});
T('UC12','全局搜索全程不发网络请求',async p=>{
 /* 工作台会去拉文献：先离开工作台并等它的请求发完，再只数搜索期间的请求 */
 await p.evaluate(()=>go('lab'));await p.waitForTimeout(1500);
 const reqs=[];p.on('request',r=>{const u=r.url();if(!/^(file|data|blob|about):/.test(u))reqs.push(u)});
 await p.evaluate(()=>gsOpen());for(const s of ['定','定时','设备','B-24','UC']){await p.fill('.gs-input',s);await p.waitForTimeout(120);}
 await p.keyboard.press('Escape');
 expect(!reqs.length,'发出了请求：'+reqs.slice(0,3).join(','));
});
T('UC13','只在缺密钥 / 凭证被拒时给「去配置模型接入」，其他错误不给',async p=>{
 const out=[];
 for(const [err,want] of [['NOKEY',true],['HTTP 401 unauthorized',true],['EMPTY',false],['HTTP 500',false]]){
  await p.evaluate(e=>{go('chat');CONV[S.sid]=[];MC.chat=()=>Promise.reject(new Error(e));render()},err);await p.waitForTimeout(200);
  await p.fill('#ask','你好，今天天气怎么样');await p.click('[data-act="chatsend"]');await p.waitForTimeout(1200);
  const has=await p.evaluate(()=>{const L=convOf();return L[L.length-1]?.fix==='set'});out.push(err+':'+has);
  if(has!==want)throw new Error(out.join(' / '));
 }
});
T('UC14','定时任务有真实运行记录 → 工作台动态出现带「定时」的条目，点进去是这个计划',async p=>{
 const id=await p.evaluate(()=>{stLoad();const t=ST.items.find(t=>t.enabled&&DB.projects.some(p=>p.id===t.pid));t.runs=[{at:'今天 23:59',content:'本次新增 3 篇相关文献',ok:true}];return t.id});
 await p.evaluate(()=>go('workbench'));await p.waitForTimeout(400);
 const row=p.locator('#view .rh-activity.is-schedule').first();expect(await row.count()===1,'动态里没有定时条目');
 expect(/定时/.test(await row.innerText()),'没有「定时」标记');
 await row.click();await p.waitForTimeout(300);
 expect((await p.evaluate(()=>S.route+'|'+ST.pick))==='scheduledetail|'+id,'没进到计划详情');
});
T('UC15','运行记录失败 → 课题页签标「失败」，状态为「本次失败」',async p=>{
 const r=await p.evaluate(()=>{stLoad();const t=ST.items.find(t=>t.enabled&&DB.projects.some(p=>p.id===t.pid));t.runs=[{at:'今天 08:30',content:'数据源不可用',ok:false}];
  go('project',{pid:t.pid});S.pjtab='st';render();const row=[...document.querySelectorAll('.stp-row')].find(e=>e.textContent.includes(t.name));return {state:stState(t).label,flag:row?.querySelector('.stp-flag')?.textContent||''}});
 expect(r.state==='本次失败'&&r.flag==='失败',JSON.stringify(r));
});

T('UC16','定时任务：一句话修改 → 补充要求 / 频次 / 时间 / 暂停 / 恢复各落到对应字段，修改记录逐条留下，刷新后仍在',async p=>{
 const id=await p.evaluate(()=>{stLoad();const t=ST.items.find(t=>t.enabled&&DB.projects.some(p=>p.id===t.pid));ST.pick=t.id;go('scheduledetail');return t.id});await p.waitForTimeout(300);
 const say=async s=>{await p.fill('[data-st-nl] input',s);await p.click('[data-st-nl] button');await p.waitForTimeout(250);return p.evaluate(id=>{const t=ST.items.find(x=>x.id===id);return {period:t.period,weekday:Number(t.weekday),time:t.time,enabled:t.enabled,revs:(t.revisions||[]).map(r=>r.text),hist:(t.history||[]).length}},id)};
 const a=await say('只看近一周发表的论文');expect(a.revs.includes('只看近一周发表的论文'),'补充要求：'+JSON.stringify(a));
 const b=await say('改成每周五早上9点');expect(b.period==='weekly'&&b.weekday===5&&b.time==='09:00'&&b.revs.length===a.revs.length,'频次：'+JSON.stringify(b));
 const c=await say('改到下午3点半');expect(c.time==='15:30'&&c.period==='weekly','时间：'+JSON.stringify(c));
 const d=await say('暂停');expect(d.enabled===false,'暂停');
 const e=await say('恢复');expect(e.enabled===true,'恢复');
 const f=await say('改成工作日');expect(f.period==='weekdays','工作日：'+f.period);
 const stored=await p.evaluate(id=>(LS.get('scheduled_plans_v1',[])||[]).find(t=>t.id===id),id);
 expect(stored&&stored.period==='weekdays'&&stored.time==='15:30'&&(stored.history||[]).length===f.hist&&f.hist>=6,'存储：'+JSON.stringify(stored&&{p:stored.period,t:stored.time,h:(stored.history||[]).length}));
 await p.click('[data-st-rev-del="0"]');await p.waitForTimeout(250);
 expect(await p.evaluate(id=>!(ST.items.find(x=>x.id===id).revisions||[]).length,id),'撤回补充要求失败');
});
T('UC17','定时任务：执行计划用选项修改即存；选到过去的一次性时间会被拦下',async p=>{
 await p.check('input[name="p_period"][value="monthly"]',{force:true});await p.waitForTimeout(250);
 expect(await p.evaluate(()=>ST.items.find(x=>x.id===ST.pick).period)==='monthly','没存上每月');
 await p.selectOption('select[name="p_monthday"]','15');await p.waitForTimeout(250);
 expect(await p.evaluate(()=>Number(ST.items.find(x=>x.id===ST.pick).monthday))===15,'没存上 15 日');
 await p.check('input[name="p_period"][value="once"]',{force:true});await p.waitForTimeout(250);
 await p.fill('input[name="p_date"]','2020-01-01');await p.dispatchEvent('input[name="p_date"]','change');await p.waitForTimeout(250);
 expect(await p.evaluate(()=>ST.items.find(x=>x.id===ST.pick).date)!=='2020-01-01','过去的日期被存下了');
});
T('UC18','工作台定时任务：右上角按钮展开列表，开启的、下次执行早的在前；点卡片进详情；数据与定时任务列表一致',async p=>{
 await p.evaluate(()=>{RESEARCH_HOME.schedOpen=true;go('workbench')});await p.waitForTimeout(400);
 const shown=await p.$$eval('.rh-sched strong',es=>es.map(e=>e.textContent));
 const want=await p.evaluate(()=>(ST.items||[]).filter(t=>DB.projects.some(p=>p.id===t.pid)).map(t=>({t,n:stNext(t)||Infinity})).sort((a,b)=>(b.t.enabled-a.t.enabled)||(a.n-b.n)).map(x=>x.t.name));
 expect(JSON.stringify(shown)===JSON.stringify(want),JSON.stringify({shown,want}));
 const total=await p.evaluate(()=>ST.items.length);expect((await p.locator('#rh-sched-title').innerText()).includes('('+total+')'),'总数不对');
 await p.locator('.rh-sched').first().click();await p.waitForTimeout(300);
 expect((await p.evaluate(()=>S.route+'|'+ST.items.find(x=>x.id===ST.pick)?.name))==='scheduledetail|'+shown[0],'没进到对应详情');
});
T('UC19','删除定时任务：站内确认 → 从本机存储、定时任务列表、工作台卡片、课题页签同时消失',async p=>{
 const t=await p.evaluate(()=>{const t=ST.items.find(x=>x.id===ST.pick);return {id:t.id,name:t.name,pid:t.pid}});
 await p.click('[data-st-action="delete"]');await p.waitForTimeout(200);
 expect(await p.evaluate(()=>document.getElementById('dlg').open),'没有确认弹窗');
 await p.click('#dlg button[value="ok"]');await p.waitForTimeout(300);
 const r=await p.evaluate(t=>({store:(LS.get('scheduled_plans_v1',[])||[]).some(x=>x.id===t.id),mem:ST.items.some(x=>x.id===t.id),route:S.route}),t);
 expect(!r.store&&!r.mem&&r.route==='schedules',JSON.stringify(r));
 await p.evaluate(()=>{RESEARCH_HOME.schedOpen=true;go('workbench')});await p.waitForTimeout(300);
 expect(!(await p.$$eval('.rh-sched strong',es=>es.map(e=>e.textContent))).includes(t.name),'工作台还显示已删除的任务');
 await p.evaluate(pid=>{go('project',{pid});S.pjtab='st';render()},t.pid);await p.waitForTimeout(300);
 expect(!(await p.$$eval('.stp-row .pjx-f-n',es=>es.map(e=>e.textContent))).includes(t.name),'课题页签还显示已删除的任务');
});

T('UC20','共享：课题页常驻「共享」——没共享过的进「开启共享」，已共享的进共享课题',async p=>{
 const un=await p.evaluate(()=>DB.projects.find(x=>!rsProjectShared(x.id)&&(x.ownerId||'me')==='me')?.id);
 await p.evaluate(pid=>go('project',{pid}),un);await p.waitForTimeout(400);
 expect((await p.locator('.pj-share-btn').innerText()).trim()==='共享','未共享课题按钮文案');
 await p.click('.pj-share-btn');await p.waitForTimeout(400);
 expect((await p.evaluate(()=>S.route+'|'+RS.sharedForm?.pid))==='sharednew|'+un,'没进开启共享');
 await p.evaluate(()=>go('project',{pid:'p1'}));await p.waitForTimeout(400);
 expect(await p.locator('.pj-share-btn').count()===0&&await p.locator('.project-shared-badge').count()===1,'已共享课题的页头应只有「共享课题」标识');
});
T('UC21','共享：在资产所在处共享 → 写进共享课题 → 那一行出现「已共享」（悬停写共享到哪）→ 移出共享后标签消失',async p=>{
 const id=await p.evaluate(()=>{const s=rsProjectShared('p1');const a=s.assets.find(a=>a.kind==='experiment');s.assets=s.assets.filter(x=>x!==a);return a.sourceId});
 await p.evaluate(()=>go('lab'));await p.waitForTimeout(500);
 expect(!(await p.evaluate(id=>!!document.querySelector('[data-labgo="'+id+'"] .shared-tag'),id)),'未共享时就有标签');
 await p.click('[data-ce-share^="experiment|'+id+'|"]');await p.waitForTimeout(250);
 expect(await p.evaluate(()=>S.route)==='lab','点共享时卡片把人带走了');
 await p.click('#dlg button[value="ok"]');await p.waitForTimeout(700);
 const tag=await p.evaluate(id=>document.querySelector('[data-labgo="'+id+'"] .shared-tag')?.title||'',id);
 expect(/Barnase/.test(tag),'标签或悬停说明不对：'+tag);
 expect(await p.evaluate(id=>rsProjectShared('p1').assets.some(a=>a.kind==='experiment'&&a.sourceId===id),id),'没写进共享课题');
 await p.evaluate(id=>{const s=rsProjectShared('p1');s.assets=s.assets.filter(a=>!(a.kind==='experiment'&&a.sourceId===id));render()},id);await p.waitForTimeout(300);
 expect(!(await p.evaluate(id=>!!document.querySelector('[data-labgo="'+id+'"] .shared-tag'),id)),'移出共享后标签还在');
});
T('UC22','共享：标签只挂在真正共享出去的那一条；草稿数据集不能共享；别人共享给我的课题里的东西不挂',async p=>{
 await p.evaluate(()=>go('dsets'));await p.waitForTimeout(400);
 const r=await p.evaluate(()=>{const mine=new Set(RS.data.shared.filter(s=>rsCan(s,'approve')).flatMap(s=>s.assets.filter(a=>a.kind==='dataset').map(a=>a.sourceId)));
  const rows=[...document.querySelectorAll('#view tbody tr')].map(tr=>{const b=tr.querySelector('[data-ce-share^="dataset|"]');if(!b)return null;const id=b.dataset.ceShare.split('|')[1];return {id,tag:!!tr.querySelector('.shared-tag'),shared:mine.has(id),off:b.disabled||b.getAttribute('aria-disabled')==='true'}}).filter(Boolean);
  const wrong=rows.filter(x=>x.tag!==x.shared);const draft=DSETS?ALL_DSETS().filter(d=>d.st!=='pub').map(d=>d.id):[];
  const draftOk=rows.filter(x=>draft.includes(x.id)).every(x=>x.off);
  return {n:rows.length,wrong:wrong.map(x=>x.id),draftOk}});
 expect(r.n>0&&!r.wrong.length&&r.draftOk,JSON.stringify(r));
 const leak=await p.evaluate(()=>{const s=RS.data.shared.find(s=>!rsCan(s,'approve'));return s?s.assets.filter(a=>ceSharedOf(a.kind,a.sourceId,s.projectId).length).length:0});
 expect(leak===0,'别人的共享课题也被算成我共享的：'+leak);
});

(async()=>{
 if(process.argv.includes('--list')){CASES.forEach(c=>console.log(c.id+'  '+c.name));return}
 const b=await chromium.launch();
 /* A 组每条独立；B 组按顺序共用一张页面（UC02→UC04 依赖同一个计划） */
 for(const c of CASES.filter(c=>c.id.startsWith('A'))){const p=await fresh(b);try{await c.fn(p);R.push({...c,ok:!p.__errs.length,d:p.__errs.join(';')})}catch(e){R.push({...c,ok:false,d:e.message})}await p.close()}
 const pb=await fresh(b);
 for(const c of CASES.filter(c=>c.id.startsWith('UC'))){const before=pb.__errs.length;try{await c.fn(pb);R.push({...c,ok:pb.__errs.length===before,d:pb.__errs.slice(before).join(';')})}catch(e){R.push({...c,ok:false,d:e.message})}}
 await b.close();
 R.forEach(r=>console.log((r.ok?'PASS ':'FAIL ')+r.id+'  '+r.name+(r.ok?'':'\n      → '+r.d)));
 const bad=R.filter(r=>!r.ok).length;console.log(bad?'需求核对与数据流：'+bad+' 条未过 / '+R.length:'需求核对与数据流：'+R.length+' 条全部通过');
 process.exitCode=bad?1:0;
})();
