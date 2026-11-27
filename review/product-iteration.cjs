/* Acceptance of the latest approved requirements. Never contacts live services. */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require('../test-browser.cjs');
const url='file://'+path.resolve(process.argv[2]||'index.html');
const out=path.resolve('work/qa/requirements-audit-20261120');fs.mkdirSync(out,{recursive:true});
const checks=[],failures=[],errors=[],network=[],retired=[];let browser,page,modelCalls=0;
/* 作废的条目留在这里，不是悄悄删掉：记下它测的是哪条要求、为什么不再适用。 */
function retire(id,name,why){retired.push({id,name,why});console.log('RETIRED '+id+' '+name+' — '+why);}
async function check(id,name,fn){
 try{await fn();checks.push({id,name,status:'passed'});console.log('PASS '+id+' '+name);}
 catch(e){failures.push({id,name,error:e.message});checks.push({id,name,status:'failed',error:e.message});console.error('FAIL '+id+' '+name+'\n'+e.stack);try{await page.screenshot({path:path.join(out,'failure-'+id+'.png')});}catch{}}
}
async function go(route){await page.evaluate(r=>go(r),route);await page.waitForTimeout(100);}
async function openOwned(){await go('shared');await page.locator('[data-rs-open="example-shared-owned"]').click();}
async function closeDialogs(){await page.evaluate(()=>{document.querySelector('#dlg[open]')?.close();iterationCloseDrawer(false);});}
async function actor(id){await page.evaluate(id=>{RS.actor=id;iterationCloseDrawer(false);render();},id);}
async function closeDrawer(){if(await page.locator('.asset-drawer-close').count())await page.locator('.asset-drawer-close').click();}
async function screenshot(name){await page.screenshot({path:path.join(out,name+'.png')});}
(async()=>{
 browser=await chromium.launch();const context=await browser.newContext({viewport:{width:1440,height:900},reducedMotion:'reduce'});page=await context.newPage();page.setDefaultTimeout(6500);
 page.on('pageerror',e=>errors.push(e.message));
 await page.route(/^https?:\/\//,r=>{network.push(r.request().url());if(r.request().url().includes('/api/model/chat'))modelCalls++;if(r.request().url().startsWith('https://api.crossref.org/works?'))return r.fulfill({contentType:'application/json',body:JSON.stringify({message:{items:[]}})});return r.abort('blockedbyclient');});
 await page.goto(url+'#workbench');await page.waitForFunction(()=>RS.seedReady||RS.error);assert.equal(await page.evaluate(()=>RS.error),'');
 await check('R02','default landing and navigation',async()=>{assert.equal(await page.evaluate(()=>S.route),'workbench');assert.equal(await page.locator('[data-navid="workbench"]').getAttribute('aria-current'),'page');assert.equal(modelCalls,0);});
 /* v2 的工作台模块：近期研究动态、我的课题、课题相关发现，外加待办、定时任务、学术助手三个入口。
    原来的三块面板（课题进展／今日灵感／学术资讯）在这一版拆掉了：灵感挪进右下角的学术助手，
    资讯并进「课题相关发现」的三个页签。 */
 await check('R03','workbench modules are present',async()=>{for(const title of [/近期研究动态/,/我的课题/,/课题相关发现/])assert(await page.getByRole('heading',{name:title}).first().isVisible(),String(title));const tabs=await page.locator('.rh-tabs [data-rh-tab]').allTextContents();assert.equal(tabs.length,3,tabs.join('/'));assert(tabs[0].startsWith('文献')&&tabs[1].startsWith('学术资讯')&&tabs[2].startsWith('平台资源更新'),tabs.join('/'));for(const sel of ['.rh-todo-btn','.rh-sched-btn','.rh-aide-fab'])assert(await page.locator(sel).first().isVisible(),sel);});
 await check('R06','experiment and model tasks use simultaneous headings',async()=>{for(const card of await page.locator('.wb-project-card').all())for(const kind of ['experiment','model'])assert(await card.locator('[data-task-kind="'+kind+'"]').isVisible());assert.equal(await page.locator('[data-wb-task],.wb-task-tabs').count(),0);});
 await check('R71','compact tasks show name state icon description and accessible identity',async()=>{
  assert.equal(await page.locator('.wb-project-card .wb-task-meta,.wb-project-card .wb-task-detail,.wb-project-card progress,.wb-project-card .lv-wb-progress').count(),0);
  for(const card of await page.locator('.wb-project-card').all()){
   const pid=await card.getAttribute('data-wb-project-id');
   for(const row of await card.locator('[data-wb-task-open]').all()){
    const t=await page.evaluate(key=>{const raw=workbenchData().tasks.find(t=>t.key===key),d=workbenchData({pid:raw.pid});return(raw.kind==='experiment'?d.experiments:d.modelTasks).find(t=>t.key===key)},await row.getAttribute('data-wb-task-open'));
    assert.equal(t.pid,pid);assert.equal(await row.locator('.wb-task-main strong').innerText(),t.name);
    assert(await row.locator('.wb-task-symbol svg').isVisible());assert(await row.locator('.wb-task-description').innerText());assert(await row.locator('.wb-tag-detail').innerText());assert((await row.locator('.wb-status').innerText()).length>0);
    assert((await row.getAttribute('aria-label')).includes(t.id));
   }
  }
 });
 await check('R07','removed stats and AI summary remain absent',async()=>{assert.equal(await page.locator('.wb-metric,.wb-task-overview,[data-wb-refresh-ai],.wb-project-progress').count(),0);});
 await check('R08','no letter-based topic grouping in any carousel',async()=>{assert.equal(await page.locator('.wb-topic,.wb-news-letter,.wb-topic-select,[data-wb-progress-project]').count(),0);assert(!await page.locator('.wb').evaluate(e=>[...e.querySelectorAll('button,option')].some(e=>/^[ABC]$|^[ABC] ·/.test(e.innerText.trim()))));const variants=await page.evaluate(()=>[3,6].map(count=>{const ps=Array.from({length:count},(_,i)=>({id:'topic-'+i,name:'课题名称 '+(i+1)}));const t=document.createElement('template');t.innerHTML=wbTopicPicker(ps,'topic-0','idea');return [...t.content.querySelectorAll('option,button')].map(e=>e.textContent.trim());}));for(const names of variants)assert.deepEqual(names,names.map((_,i)=>'课题名称 '+(i+1)));assert(!fs.readFileSync('src/index.html','utf8').includes('wbProjectLetter'));});
 /* 课题卡片一屏放三张，靠左右箭头翻；翻到头箭头要禁用，不许自动轮播。
    每张卡上列的任务必须是这张卡自己课题的——这是当初出问题的地方。 */
 await check('R05','project cards advance manually with bounded navigation and isolated task lists',async()=>{
  await go('workbench');await page.evaluate(()=>{RESEARCH_HOME.start=0;render();});await page.waitForTimeout(220);
  const ps=await page.evaluate(()=>workbenchData().projects.map(p=>p.id)),seen=new Set();
  const prev=()=>page.locator('[data-rh-project-page=prev]').first(),next=()=>page.locator('[data-rh-project-page=next]').first();
  assert(await prev().isDisabled(),'停在第一页时「上一页」要禁用');
  for(let guard=0;guard<=ps.length;guard++){
   const cards=await page.locator('.rh-project').all();assert(cards.length>0);assert(cards.length<=3,'一屏最多三张：'+cards.length);
   for(const card of cards){const pid=await card.getAttribute('data-wb-project-id');seen.add(pid);
    const keys=await card.locator('[data-wb-task-open]').evaluateAll(es=>es.map(e=>e.dataset.wbTaskOpen));
    assert(keys.length<=3,'一张卡最多列三条任务：'+keys.length);
    for(const key of keys)assert.equal(key.split(':')[1],pid,'卡片上串进了别的课题的任务：'+key);}
   if(await next().isDisabled())break;await next().click();await page.waitForTimeout(220);
  }
  assert(await next().isDisabled(),'翻到最后一页时「下一页」要禁用');
  assert.deepEqual([...seen].sort(),[...ps].sort(),'翻一轮要能看到每个课题');
  assert.equal(await page.locator('[data-wb-progress-auto],[data-wb-idea-auto],[data-wb-news-auto],.wb-carousel-count').count(),0,'不许自动轮播');
  await page.evaluate(()=>{RESEARCH_HOME.start=0;render();});await page.waitForTimeout(200);
 });
 /* R09 作废：「每天固定一条灵感、第二天自动换一条」这套在 v2 里没有了。
    灵感挪进右下角的学术助手，改成随时按「换一个」，不再按日期锁定，也不再存本地。 */
 retire('R09','one daily inspiration stays fixed across topic switches reloads and changes the next day','灵感挪进学术助手，改成随时「换一个」，不再按天锁定');
 /* 灵感现在在右下角的浮层里，不跟首屏其他模块比分量了；卡内的分量关系照旧：问句最重。 */
 await check('R69','the assistant keeps a small footprint and the question leads inside it',async()=>{await page.setViewportSize({width:1440,height:900});await go('workbench');const fab=await page.locator('.rh-aide-fab').boundingBox();assert(fab.height<=56,JSON.stringify(fab));await page.locator('[data-rh-aide-pop]').click();await page.waitForTimeout(300);const panel=await page.locator('.rh-aide').boundingBox();assert(panel.width<=440&&panel.height<=520,JSON.stringify(panel));const sizes=await page.evaluate(()=>({q:parseFloat(getComputedStyle(document.querySelector('.rh-aide-q')).fontSize),label:parseFloat(getComputedStyle(document.querySelector('.rh-aide-label')).fontSize),note:parseFloat(getComputedStyle(document.querySelector('.rh-aide-note')).fontSize)}));assert(sizes.q>sizes.label&&sizes.q>sizes.note,JSON.stringify(sizes));assert.equal(await page.locator('.rh-aide .btn-pri').count(),1,'这张卡只给一个主按钮');await screenshot('workbench-assistant');});
 await check('R10','the inspiration is one noninteractive sentence with refresh and exploration',async()=>{const text=(await page.locator('.rh-aide-q').innerText()).trim();assert(text.length>0);assert.equal(await page.locator('.rh-aide-q').evaluate(e=>e.tagName),'P');assert.equal(await page.locator('.rh-aide-q button,.rh-aide-q a').count(),0,'问句本身不该可点');assert(!/为什么想到|检查视角/.test(text));assert.equal(await page.locator('[data-rh-aide-next]').count(),1);assert.equal(await page.locator('[data-rh-aide-ask]').count(),1);await page.locator('[data-rh-aide-next]').click();await page.waitForTimeout(300);assert.notEqual((await page.locator('.rh-aide-q').innerText()).trim(),text,'「换一个」要真的换一句');});
 await check('R11','exploration binds an editable draft without sending',async()=>{const question=(await page.locator('.rh-aide-q').innerText()).trim(),pid=await page.evaluate(()=>wbAideIdea().project.id);await page.locator('[data-rh-aide-ask]').click();await page.waitForTimeout(350);assert.equal(await page.evaluate(()=>S.route),'chat');assert.equal(await page.evaluate(()=>S.pid),pid,'要落在这句追问所属的课题上');assert.equal((await page.locator('#ask').inputValue()).trim(),question);assert.equal(await page.evaluate(()=>convOf().length),0,'只填草稿，不许发出去');await page.locator('#ask').fill(question+'（进一步比较）');assert.equal(modelCalls,0);await go('workbench');});
 await check('R17','research chat opens without the former three-column project experiment model overview',async()=>{await page.evaluate(()=>{S.sid='new-audit-empty';S.bind=null;go('chat')});assert(await page.locator('.research-home #ask').isVisible());assert.equal(await page.locator('.research-home .land [data-proj],.research-home .land [data-labgo],.research-home .land [data-mid],.research-home .land .card').count(),0);assert(!/查看全部|Round 5|B-2412|M-002/.test(await page.locator('.research-home').innerText()));const quick=page.locator('[data-research-prompt]').first(),prompt=await quick.getAttribute('data-research-prompt');await quick.click();assert.equal(await page.locator('#ask').inputValue(),prompt);assert.equal(await page.evaluate(()=>convOf().length),0);await go('workbench');});
 /* 「文献」页签：每条要有标题、关联课题、来源，外链必须是 https 且带 noopener。 */
 await check('R12','paper rows carry a title, the related project, a source and a safe external link',async()=>{await go('workbench');await page.locator('[data-rh-tab=papers]').click();await page.waitForTimeout(320);const rows=await page.locator('.rh-discovery-row').all();assert(rows.length>=2,'至少两条：'+rows.length);for(const row of rows){assert((await row.locator('strong').innerText()).trim().length>0);const meta=await row.locator('small').innerText();assert.match(meta,/关联：/);assert.match(meta,/来源：/);assert.match(await row.getAttribute('href'),/^https:/);assert.match(await row.getAttribute('rel'),/noopener/);assert.equal(await row.getAttribute('target'),'_blank');}});
 await check('R13','no refresh, tuning or subscription controls',async()=>{assert.equal(await page.locator('[data-wb-refresh-ai],[data-wb-refresh-papers],[data-wb-subscriptions],.wb-metrics').count(),0);});
 /* R14 作废：文献这一版是本地种子数据，不再请求外部接口，没有「拉取失败」这个状态可测。
    断网行为归 offline-network 那一套管。 */
 retire('R14','paper failure is distinct and saved links remain available','文献改成本地种子数据，没有外部请求，也就没有失败态');
 await check('R16','each project card lists its own attention tasks and view all keeps that project',async()=>{await go('workbench');await page.evaluate(()=>{RESEARCH_HOME.start=0;render();});await page.waitForTimeout(220);
  for(const [kind,route,key] of [['experiment','lab','labProject'],['train','mdl','mdlProj']]){
   const button=page.locator('[data-rh-act-list="'+kind+'"][data-rh-act-pid=p1]').first();if(!await button.count())continue;
   const keys=await page.locator('[data-wb-project-id=p1] [data-wb-task-open]').evaluateAll(es=>es.map(e=>e.dataset.wbTaskOpen));assert(keys.length<=3);
   await button.click();await page.waitForTimeout(300);
   assert.deepEqual(await page.evaluate(k=>[S.route,S[k]],key),[route,'p1'],kind+' 的「查看全部」要带着课题走');
   await go('workbench');await page.evaluate(()=>{RESEARCH_HOME.start=0;render();});await page.waitForTimeout(220);}
 });
 /* 这一版工作台是会往下滚的研究首页，不再要求一屏装完；横向任何宽度都不许出滚动条。 */
 await check('R04','no horizontal overflow on the workbench at any supported width',async()=>{for(const [width,height] of [[1440,900],[1352,752],[1122,607],[390,844]]){await page.setViewportSize({width,height});await go('workbench');await page.waitForTimeout(200);const fit=await page.evaluate(()=>{const v=document.getElementById('view');return{view:v.scrollWidth-v.clientWidth,page:document.documentElement.scrollWidth-document.documentElement.clientWidth};});assert(fit.view<=1,JSON.stringify({width,height,fit}));assert(fit.page<=1,JSON.stringify({width,height,fit}));}await page.setViewportSize({width:1440,height:900});await go('workbench');await screenshot('workbench-final');});
 /* 两个种子共享课题方向相反：一个我是所有者、有人等我审批；另一个我是查看者、我申请的已批准待导入。
    方向按收件箱里真有哪几类操作来判，不按文案判。 */
 await check('R30','two seed projects have opposite request directions under one account',async()=>{const data=await page.evaluate(()=>RS.data.shared.map(s=>({id:s.id,owner:s.owner,role:s.members.find(m=>m.id==='me').role,pending:s.requests.filter(r=>r.state==='pending').length,approved:s.requests.filter(r=>r.actor==='me'&&r.state==='approved').length})));assert.equal(data.length,2);assert.equal(data[0].owner,'me');assert.equal(data[0].role,'owner');assert.equal(data[1].role,'viewer');assert.equal(data[0].pending,2);assert.equal(data[1].approved,1);await go('shared');assert.equal(await page.locator('[data-inbox-approve]').count(),2,'两条等我审批');assert.equal(await page.locator('[data-inbox-import]').count(),1,'一条我申请到、等我导入');assert.equal(await page.locator('[data-inbox-withdraw]').count(),1,'一条我还在申请、可以撤回');await screenshot('shared-projects-final');});
 /* 共享课题卡整张可点：卡里不再放「进入」按钮，键盘回车直接进详情。 */
 await check('R31','shared cards enter on whole-card keyboard activation with no entry button',async()=>{await go('projects');const card=page.locator('.shared-project-card').first();assert.equal(await card.locator('button').count(),0,'卡里不该再有按钮');assert.equal(await card.getAttribute('tabindex'),'0');await card.focus();await page.keyboard.press('Enter');await page.waitForTimeout(350);assert.equal(await page.evaluate(()=>S.route),'shareddetail');});
 /* 共享课题详情只做一件事（看资产），顶层页签整条去掉了；剩下的是按资产类型分的三个页签。 */
 await check('R21','shared detail has no competing top-level tab bar',async()=>{assert.equal(await page.evaluate(()=>S.route),'shareddetail');assert.equal(await page.locator('#view .rs-tabs').count(),0,'不该再有顶层页签');assert.deepEqual(await page.locator('[data-shared-asset-tab]').allTextContents(),['知识库','工具','实验']);});
 await check('R22','shared assets use a typed file browser with a typed preview',async()=>{assert(await page.locator('.shared-asset-list').isVisible());assert.equal(await page.locator('.rs-asset-sections,.rs-assets-grid').count(),0,'不再是一屏资产卡片');assert(await page.locator('[data-shared-asset-select]').count()>4);await page.locator('[data-shared-asset-select]').nth(4).click();await page.waitForTimeout(320);assert(await page.locator('.shared-asset-preview').isVisible());assert((await page.locator('.shared-asset-preview').innerText()).trim().length>0);await page.locator('[data-shared-asset-tab=exp]').click();await page.waitForTimeout(300);assert(await page.locator('[data-shared-asset-select]').first().isVisible(),'实验这一页也要有东西');await page.locator('[data-shared-asset-tab=kb]').click();await page.waitForTimeout(300);await screenshot('shared-assets-final');});
 await check('R27','owner reviews others and viewer cannot approve their own request',async()=>{await go('shared');await page.locator('[data-inbox-open="example-shared-owned"]').first().click();await page.waitForTimeout(350);await page.locator('[data-rs-requests]').click();await page.waitForTimeout(350);assert.equal(await page.locator('[data-request-approve]').count(),2);assert.equal(await page.locator('[data-request-withdraw]').count(),0);await screenshot('shared-owner-requests-final');await closeDrawer();await closeDialogs();await go('shared');await page.locator('[data-inbox-open="example-shared-joined"]').first().click();await page.waitForTimeout(350);assert.equal(await page.locator('[data-rs-publish]').count(),0,'查看者不该有发布入口');await page.locator('[data-rs-requests]').click();await page.waitForTimeout(350);assert.equal(await page.locator('[data-request-approve],[data-request-reject]').count(),0,'不能自己批自己的申请');assert.equal(await page.locator('[data-request-withdraw]').count(),1);await screenshot('shared-my-requests-final');await closeDrawer();await closeDialogs();});
 /* 导入入口挪到「与你共享」的收件箱里了。导进来的是一份独立草稿，而且只能导一次。 */
 await check('R28','approved acquisition imports an independent dataset draft once',async()=>{await go('shared');const before=await page.evaluate(()=>RS.data.imports.length);await page.locator('[data-inbox-import]').first().click();await page.waitForFunction(()=>RS.data.shared.some(s=>s.requests.some(r=>r.id==='example-outgoing-data'&&r.state==='imported')));const data=await page.evaluate(()=>{const s=RS.data.shared.find(s=>s.requests.some(r=>r.id==='example-outgoing-data')),r=s.requests.find(r=>r.id==='example-outgoing-data'),i=RS.data.imports.find(i=>i.id===r.importId),a=s.assets.find(a=>a.id===r.assetId);return{copy:i.copy,source:a.snapshot,version:i.version,target:i.target};});assert.equal(data.copy.st,'draft');assert.notEqual(data.copy.id,data.source.id);assert.equal(data.version,'v1');assert.equal(data.target,'example-personal-review');assert.equal(await page.evaluate(()=>RS.data.imports.length),before+1);assert.equal(await page.locator('[data-inbox-import]').count(),0,'导过的不该还能再导一次');});
 await check('R32','removed sharing prototype notices and role switch stay absent',async()=>{for(const route of ['shared','sharednew']){await go(route);assert(!/本机原型|共享之后会发生什么|角色演示/.test(await page.locator('#view').innerText()),route);}await go('shared');await page.locator('[data-inbox-open="example-shared-owned"]').first().click();await page.waitForTimeout(350);assert.equal(await page.locator('[data-rs-actor],.rs-local-note').count(),0);});
 /* 两种卡排在同一张网格里，看起来必须是同一种卡。边框和圆角画在 .project-card-wrap 上，
    卡自己 border:0，所以比的是外框的几何加卡内的间距与字号——比里层那个看不见的圆角没意义。 */
 await check('R38','shared and personal cards use the same geometry and type scale',async()=>{await go('projects');
  const read=async sel=>{const card=page.locator(sel).first(),wrap=card.locator('xpath=ancestor::div[contains(@class,"project-card-wrap")][1]');
   return{frame:await wrap.evaluate(e=>{const s=getComputedStyle(e);return{width:Math.round(e.getBoundingClientRect().width),radius:s.borderRadius,borderWidth:s.borderWidth,borderColor:s.borderColor};}),
    inner:await card.evaluate(e=>{const s=getComputedStyle(e),t=e.querySelector('strong');return{padding:s.padding,minHeight:s.minHeight,title:t?getComputedStyle(t).fontSize:null,titleWeight:t?getComputedStyle(t).fontWeight:null};})};};
  const own=await read('.pcard:not(.shared-project-card)'),shared=await read('.shared-project-card');
  assert.deepEqual(shared.frame,own.frame,JSON.stringify({own,shared}));assert.deepEqual(shared.inner,own.inner,JSON.stringify({own,shared}));
 });
 /* 课题卡不许挂左侧色条；窄屏下一列排开；头部的计数跟着标题走，不把标题顶成两行。
    （「创建项目副本」这个入口在 v2 里去掉了，相关断言并入 R37 的作废记录。） */
 await check('R38-layout','project cards stay neutral and keep header counts inside narrow layouts',async()=>{for(const width of [1440,390]){await page.setViewportSize({width,height:900});await page.evaluate(()=>{S.pq='';go('projects')});await page.waitForTimeout(300);assert(await page.locator('.projects-header h1').evaluate(e=>e.getBoundingClientRect().height<=parseFloat(getComputedStyle(e).lineHeight)*1.1),width+' 标题被挤成两行');const first=await page.locator('.project-card-wrap').nth(0).boundingBox(),second=await page.locator('.project-card-wrap').nth(1).boundingBox();if(width>900)assert.equal(first.y,second.y);else assert(second.y>=first.y+first.height-1,'窄屏要一列排开');for(const wrap of await page.locator('.project-card-wrap').all()){const inner=wrap.locator('.pcard,.shared-project-card').first();assert.equal(await inner.evaluate(e=>getComputedStyle(e,'::before').content),'none','课题卡不许挂色条');const box=await wrap.boundingBox();assert(box.x>=-1&&box.x+box.width<=width+1,JSON.stringify({width,box}));}}await page.setViewportSize({width:1440,height:900});});
 /* R37 作废：「创建项目副本」这个入口在 v2 里整条去掉了（列表、详情、弹窗三处都没有），
    文案一致性也就无从谈起。 */
 retire('R37','copy label is consistent in list detail and modal','「创建项目副本」入口已从课题列表和详情里移除');
 /* 「共享」这件事只许用墨蓝或中性灰，不许再借第三种色相。
    两层各有各的做法，都是定下来的：课题详情标题旁边那一个是墨蓝字、不带底色（挨着大标题，带底色会抢）；
    课题卡上的那一个跟卡上其他角标一样压成中性灰，让网格保持安静。 */
 await check('R34','the shared affordance keeps the blue semantic and borrows no other hue',async()=>{
  const dryInk=await page.evaluate(()=>{const e=document.createElement('span');e.style.color='var(--dry-ink)';document.body.append(e);const v=getComputedStyle(e).color;e.remove();return v;});
  await page.evaluate(()=>go('project',{pid:'p1'}));await page.waitForTimeout(400);
  const badge=page.locator('.pjx-title-row .project-shared-badge').first();
  assert(await page.locator('.project-shared-badge').count()>0,'课题详情上找不到共享角标：route='+(await page.evaluate(()=>S.route))+' pid='+(await page.evaluate(()=>S.pid))+' shared='+(await page.evaluate(()=>RS.data.shared.map(x=>x.id+':'+x.projectId).join(','))));
  assert.match((await badge.innerText()).trim(),/共享/);
  const title=await badge.evaluate(e=>{const s=getComputedStyle(e);return{color:s.color,bg:s.backgroundColor};});
  assert.equal(title.color,dryInk);assert.equal(title.bg,'rgba(0, 0, 0, 0)','标题旁边那一个按设计不带底色');
  await go('projects');const chip=page.locator('.shared-project-card .navigation-project-source').first();assert.match((await chip.innerText()).trim(),/共享/);
  const onCard=await chip.evaluate(e=>{const s=getComputedStyle(e);return{color:s.color,bg:s.backgroundColor};});
  const neutral=x=>{const v=(x.match(/[\d.]+/g)||[0,0,0]).slice(0,3).map(Number);return Math.max(...v)-Math.min(...v)<=24;};
  assert(neutral(onCard.color)&&neutral(onCard.bg),'课题卡上的共享角标要跟其他角标一样压成中性：'+JSON.stringify(onCard));
 });
 /* 设备管理这一版不在侧栏单列入口，从实验管理进；目录还是 12 台，卡片横排。 */
 await check('R39','the equipment catalog is reachable from the lab and keeps its protein instruments',async()=>{await go('lab');const entry=page.locator('[data-go=devices]').first();assert(await entry.isVisible());assert.equal((await entry.innerText()).trim(),'设备管理');await entry.click();await page.waitForTimeout(350);assert.equal(await page.evaluate(()=>S.route),'devices');assert.equal(await page.locator('.device-card').count(),12);assert.equal(await page.locator('.device-card').first().evaluate(e=>getComputedStyle(e).flexDirection),'row');});
 await check('R44','deleted equipment eyebrow banner count and footer remain absent',async()=>{const t=await page.locator('#view').innerText();assert(!/PROTEIN LAB|从样品到结论|参考型号 · 未接入|资料核对|12 个参考型号/.test(t));assert.equal(await page.locator('.lv-device-foot,.lv-footer').count(),0);});
 await check('R42','device whole-card and keyboard open typed detail',async()=>{await page.locator('.device-card[data-lv-device="octet"]').focus();await page.keyboard.press('Enter');assert.equal(await page.evaluate(()=>S.route),'devicedetail');assert.match(await page.locator('#view').innerText(),/亲和力表征.*输入要求.*预期输出/s);assert.match(await page.locator('.device-section a').getAttribute('href'),/^https:\/\/www.sartorius.com/);});
 await check('R43','equipment request does not auto-succeed and persists explicit confirmation',async()=>{await go('devices');await page.locator('[data-device-apply="flex"]').click();assert.equal(await page.evaluate(()=>S.route),'devices');await page.locator('#device-instance').fill('TEST-FLEX-01');assert(await page.getByText('申请说明',{exact:true}).isVisible());assert.equal(await page.locator('#device-request-note').getAttribute('maxlength'),'500');assert.equal(await page.locator('#device-request-note').getAttribute('required'),null);await page.locator('#device-request-note').fill('用于候选蛋白的表达与纯化验证');await page.locator('#dlg [value="ok"]').click();assert.equal(await page.evaluate(()=>iterationDeviceStatus('flex')),'pending');assert.equal(await page.evaluate(()=>DEVICE_CONNECTIONS.flex.requestNote),'用于候选蛋白的表达与纯化验证');await page.waitForTimeout(180);assert.equal(await page.evaluate(()=>iterationDeviceStatus('flex')),'pending');await page.reload();await page.waitForFunction(()=>RS.seedReady);assert.equal(await page.evaluate(()=>iterationDeviceStatus('flex')),'pending');await page.evaluate(()=>{LABUI.devicePick='flex';go('devicedetail')});assert.match(await page.locator('.device-detail aside').innerText(),/申请说明[\s\S]*用于候选蛋白的表达与纯化验证/);assert(!/设备位置/.test(await page.locator('.device-detail aside').innerText()));await page.locator('[data-device-confirm]').click();await page.locator('#device-verified').check();await page.locator('#dlg [value="ok"]').click();assert.equal(await page.evaluate(()=>iterationDeviceStatus('flex')),'connected');await go('devices');await screenshot('devices-final');});
 /* 「设计实验」这一版是五步向导（原来的画布编排器已经换掉）：
    左边点第几步，右边就只编辑这一步，aria-current 跟着走，每一步有自己的小标题。 */
 await check('R47','the experiment designer edits only the selected step',async()=>{await go('labnew');const steps=await page.locator('.al-plan-step').evaluateAll(es=>es.map(e=>e.dataset.alPlanStep));assert.deepEqual(steps,['0','1','2','3','4']);
  const current=()=>page.evaluate(()=>[...document.querySelectorAll('.al-plan-step')].filter(e=>e.getAttribute('aria-current')==='step').map(e=>e.dataset.alPlanStep));
  const seen=new Set();for(const step of steps){await page.locator('.al-plan-step[data-al-plan-step="'+step+'"]').click();await page.waitForTimeout(280);assert.deepEqual(await current(),[step]);const heading=(await page.locator('.al-plan-body h2,.al-plan-body h3').first().innerText()).trim();assert(heading.length>0);assert(!seen.has(heading),'每一步要有自己的小标题，现在重了：'+heading);seen.add(heading);}
 });
 /* 上一步／下一步要能走遍五步，走回来时填过的字还在，当前步在左边看得见。 */
 await check('R47-navigation','step navigation traverses every step and keeps what was typed',async()=>{await go('labnew');await page.locator('.al-plan-step[data-al-plan-step="0"]').click();await page.waitForTimeout(260);
  const prev=page.getByRole('button',{name:'上一步'}),next=page.getByRole('button',{name:'下一步'});
  const current=()=>page.evaluate(()=>[...document.querySelectorAll('.al-plan-step')].findIndex(e=>e.getAttribute('aria-current')==='step'));
  assert.equal(await current(),0);
  await page.locator('[data-al-field=name]').fill('脚本验收蛋白表征');await page.waitForTimeout(260);
  for(let i=1;i<=4;i++){await next.click();await page.waitForTimeout(280);assert.equal(await current(),i);}
  for(let i=3;i>=0;i--){await prev.click();await page.waitForTimeout(280);assert.equal(await current(),i);}
  assert.equal(await page.locator('[data-al-field=name]').inputValue(),'脚本验收蛋白表征','翻回来字段不该被清掉');
  const box=await page.locator('.al-plan-step[aria-current=step]').boundingBox();assert(box&&box.width>0&&box.height>0,'当前步要在左边看得见');
 });
 /* 「还有多少项待补全」就是这一版的必填点：补上一项，数就少一项。 */
 await check('R48','the pending-configuration count drops when a required field is filled',async()=>{await go('labnew');await page.locator('.al-plan-step[data-al-plan-step="0"]').click();await page.waitForTimeout(260);
  const read=async()=>{const t=await page.locator('[data-al-validation]').innerText(),n=t.match(/\d+/);return n?Number(n[0]):0;};
  const before=await read();assert(before>0,'一开始应该有待补全项：'+before);
  await page.locator('[data-al-field=goal]').fill('把 KD ≤ 0.5 pM 的候选挑出来');await page.waitForTimeout(320);
  const after=await read();assert.equal(after,before-1,'补一项要少一项：'+before+' → '+after);await screenshot('experiment-designer-final');
 });
 /* R45 作废：串行／并行这个开关在 v2 的「设计实验」里没有了——流程图是固定的工序图，
    依赖写在边上（data-al-focus-edge），不再由一个模式开关推导。 */
 retire('R45','serial vs parallel dependencies remain separate from sample lineage','串并行模式开关已随画布编排器一起换掉，依赖改成固定工序图上的边');
 /* 缺东西就不能创建任务：预检面板把缺的逐条列出来，而不是只说一句「信息不完整」。 */
 await check('R46','preflight blocks creating a task and names what is missing',async()=>{await go('labnew');await page.locator('[data-al-panel=preflight]').first().click();await page.waitForTimeout(400);const dialog=page.locator('dialog[open]');assert(await dialog.isVisible());const text=await dialog.innerText();assert.match(text,/待补全|预检/);const items=await dialog.locator('li').count();assert(items>=3,'缺的项要逐条列出来，现在只有 '+items+' 条');assert.match(text,/填写|登记|补全/);assert.equal(await page.evaluate(()=>S.route),'labnew','没补齐不该跳走');await closeDialogs();await page.waitForTimeout(200);});
 /* R53 作废：这一版的完整方案有 35 项必填（原来是 4 个工序各填实例和 SOP），
    「一路填满再提交」不再是一条界面断言能覆盖的事；预检的拦截归 R46，字段留存归 R47-navigation。 */
 retire('R53','create a fully specified plan and keep a frozen device contract','完整方案改成 35 项必填，逐项填满不适合当界面断言；拦截与字段留存已拆到 R46、R47-navigation');
 /* 实验卡是直接入口：卡上没有卡脚控件，点整张卡就进详情。 */
 await check('R50','experiment cards are direct entries without footer controls',async()=>{await go('lab');assert.equal(await page.locator('.lv-exp-footer').count(),0);const id=await page.locator('[data-labgo]').first().getAttribute('data-labgo');assert(id&&id!=='undefined',id);await page.locator('[data-labgo="'+id+'"]').first().click();await page.waitForTimeout(350);assert.equal(await page.evaluate(()=>S.labPick),id);assert.equal(await page.evaluate(()=>S.route),'labdet');});
 await check('R51','lab title and the equipment entry match final copy',async()=>{await go('lab');assert.equal((await page.locator('#view h1').innerText()).trim(),'实验管理');assert.equal((await page.locator('[data-go=devices]').first().innerText()).trim(),'设备管理');assert.equal(await page.locator('.lv-stats,.lv-eyebrow,.lv-footer,.lv-exp-footer').count(),0);await screenshot('experiments-final');});
 /* 目录页和「我的」用同一个标题，不要切一下页签标题就变了。 */
 await check('R54','resource naming holds in catalog and my submissions',async()=>{for(const [route,title] of [['shelf','科研工具'],['data','数据库']]){await go(route);assert.equal((await page.locator('#view h1').innerText()).trim(),title);await page.locator('[data-rs-market-tab=mine]').click();await page.waitForTimeout(280);assert.equal((await page.locator('#view h1').innerText()).trim(),title,route+' 切到「我的」标题变了');await page.locator('[data-rs-market-tab=catalog]').click();await page.waitForTimeout(280);}});
 await check('R60','all new page headings omit English eyebrows',async()=>{for(const route of ['shared','devices','lab','sharednew']){await go(route);assert(!/PROTEIN LAB|WORKFLOW PREVIEW/.test(await page.locator('#view').innerText()));}});
 await check('R04-responsive','new pages retain actions and avoid horizontal page overflow',async()=>{for(const width of [1122,390]){await page.setViewportSize({width,height:844});for(const route of ['shared','devices','lab','labnew','sharednew']){await go(route);assert(await page.locator('h1').isVisible());const w=await page.locator('#view').evaluate(e=>e.scrollWidth-e.clientWidth);assert(w<=1,route+' overflow at '+width+': '+w);}}await page.setViewportSize({width:1440,height:900});});
 await check('runtime','no runtime exceptions or real model/device traffic',async()=>{assert.deepEqual(errors,[]);assert.equal(modelCalls,0);});
 fs.writeFileSync(path.join(out,'product-iteration-results.json'),JSON.stringify({retired,checks,failures,errors,networkBlocked:network.length,realModelCalls:modelCalls},null,2));
 await browser.close();console.log('Retired: '+retired.length+' 条（'+retired.map(r=>r.id).join('、')+'）');console.log('Approved iteration: '+checks.filter(c=>c.status==='passed').length+' passed, '+failures.length+' failed.');if(failures.length)process.exitCode=1;
})().catch(async e=>{console.error(e);if(browser)await browser.close();process.exitCode=1;});
