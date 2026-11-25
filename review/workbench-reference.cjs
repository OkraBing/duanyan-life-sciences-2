/* 工作台（研究主页版式）的结构、状态与交互，隔离存储、论文请求离线。 */
/* 取代了 workbench-dashboard.cjs：那一份测的是「今日灵感 + 课题进展 + 学术资讯」三栏布局，
   该版式已整体替换，今日灵感不再保留，所以不是改断言而是换一份。 */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require('../test-browser.cjs');
const out=path.resolve('work/qa/workbench-reference');fs.mkdirSync(out,{recursive:true});
const url=process.env.DUANYAN_TEST_URL||'file://'+path.resolve('index.html');
const checks=[],errors=[];let browser;
async function settle(p){await p.waitForTimeout(180);}
async function fresh(){
 const context=await browser.newContext({viewport:{width:1440,height:900},reducedMotion:'reduce'}),p=await context.newPage();p.setDefaultTimeout(6500);p.on('pageerror',e=>errors.push(e.message));
 await context.route(/^https?:/,r=>new URL(r.request().url()).origin===new URL(url).origin?r.continue():r.request().url().includes('api.crossref.org')?r.fulfill({contentType:'application/json',body:JSON.stringify({message:{items:[]}})}):r.abort());
 await p.goto(url+'#workbench',{waitUntil:'domcontentloaded'});await p.waitForFunction(()=>RS.seedReady);await p.waitForTimeout(550);return{context,p};
}
async function check(name,fn){const{context,p}=await fresh();try{await fn(p);checks.push(name);console.log('PASS '+name);}finally{await context.close();}}
function contrast(a,b){const lum=c=>c.slice(0,3).map(v=>(v/=255)<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((s,n,i)=>s+n*[.2126,.7152,.0722][i],0),x=lum(a),y=lum(b);return(Math.max(x,y)+.05)/(Math.min(x,y)+.05);}
(async()=>{
 browser=await chromium.launch();

 await check('01 页头一行现状 → 待你处理（主）+ 最近动态（侧）→ 我的课题 → 相关发现',async p=>{
  for(const name of ['最近动态','课题相关发现'])assert(await p.getByRole('heading',{name,exact:true}).isVisible(),name);
  assert(await p.getByRole('heading',{name:/^待你处理/}).isVisible());
  assert(await p.getByRole('heading',{name:/^我的课题/}).isVisible());
  const r=await p.evaluate(()=>{const box=s=>{const b=document.querySelector(s).getBoundingClientRect();return{y:b.y,bottom:b.bottom,x:b.x,right:b.right}};
   return{q:box('.rh-queue'),act:box('.rh-activities-wrap'),proj:box('.rh-projects'),disc:box('.rh-discoveries')}});
  assert(Math.abs(r.q.y-r.act.y)<=1,'待你处理与最近动态不在同一行：'+JSON.stringify(r));
  assert(r.q.right<=r.act.x,'待你处理应在左、最近动态在右');
  assert(Math.max(r.q.bottom,r.act.bottom)<=r.proj.y+1,JSON.stringify(r));
  assert(r.proj.bottom<=r.disc.y+1,JSON.stringify(r));
  assert.equal(Math.round(r.q.x),Math.round(r.proj.x));assert.equal(Math.round(r.q.x),Math.round(r.disc.x));
  await p.screenshot({path:path.join(out,'desktop.png')});
 });

 await check('02 课题一行一个，行里没有被撑开的空档',async p=>{
  const rows=await p.evaluate(()=>[...document.querySelectorAll('.rh-prow')].map(r=>Math.round(r.getBoundingClientRect().height)));
  assert(rows.length>0,'没有课题行');
  assert(rows.every(h=>h<=110),'课题行太高：'+rows.join(','));
 });

 await check('03 每行的轮次、状态、进入三列竖向对齐',async p=>{
  const cols=await p.evaluate(()=>[...document.querySelectorAll('.rh-prow')].map(r=>['.rh-prow-round','.rh-prow-state','.rh-enter'].map(s=>Math.round(r.querySelector(s).getBoundingClientRect().left))));
  assert(cols.length>1);
  for(let i=0;i<3;i++)assert.equal(new Set(cols.map(c=>c[i])).size,1,'第 '+(i+1)+' 列没对齐：'+JSON.stringify(cols));
 });

 await check('04 课题不超过 6 个时全部直接列出，不再翻页',async p=>{
  const expected=await p.evaluate(()=>workbenchData().projects.map(x=>x.id));
  const ids=await p.locator('[data-wb-project-id]').evaluateAll(es=>es.map(e=>e.dataset.wbProjectId));
  if(expected.length<=6)assert.deepEqual(new Set(ids),new Set(expected),'有课题没列出来');
  else assert.equal(ids.length,6,'超过 6 个时只列 6 个');
  assert.equal(await p.locator('[data-rh-project-page]').count(),0,'新版不该有翻页控件');
 });

 await check('05 每行都能进到自己的课题；待你处理每一条都能直达那件事',async p=>{
  const row=p.locator('.rh-prow').last(),pid=await row.getAttribute('data-wb-project-id');
  await row.locator('.rh-enter').click();await settle(p);
  assert.equal(await p.evaluate(()=>S.pid),pid);assert.equal(await p.evaluate(()=>S.route),'project');
  await p.evaluate(()=>go('workbench'));await settle(p);
  const keys=await p.locator('.rh-q').evaluateAll(es=>es.map(e=>e.dataset.wbTaskOpen));
  assert(keys.length&&keys.every(Boolean),'待你处理有行没挂任务');
  await p.locator('.rh-q').first().click();await settle(p);
  assert(['labdet','lab','mdl','task','project'].includes(await p.evaluate(()=>S.route)),'点待你处理没进到任务：'+await p.evaluate(()=>S.route));
 });

 await check('06 页上的数都是本机算出来的那个数，三处口径一致',async p=>{
  for(const row of await p.locator('.rh-prow').all()){
   const pid=await row.getAttribute('data-wb-project-id');
   const s=await p.evaluate(pid=>{const proj=workbenchData().projects.find(x=>x.id===pid);const st=researchProjectState(proj);return{badge:st.badge,next:st.next}},pid);
   assert.equal(await row.locator('.rh-badge').innerText(),s.badge,pid+' 的角标和本机算的不一致');
   assert.match(await row.locator('.rh-next-action').innerText(),new RegExp(s.next.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')),pid+' 的下一步和本机算的不一致');
  }
  const n=await p.evaluate(()=>{const each=workbenchData().projects.map(x=>wbAttentionTasks(workbenchData({pid:x.id}).tasks||[]).filter(t=>t.status==='failed'||t.needsAction).length).reduce((a,b)=>a+b,0);
   return {each,queue:rhPending().length,title:document.getElementById('rh-queue-title').textContent,header:document.querySelector('.rh-header p').textContent}});
  assert.equal(n.queue,n.each,'待你处理的总数和各课题加起来不一致：'+JSON.stringify(n));
  assert(n.title.includes('('+n.queue+')')&&n.header.includes(n.queue+' 项待你处理'),'标题或页头的数不对：'+JSON.stringify(n));
 });

 await check('07 文献外链只走 https，且带 noopener',async p=>{
  const links=await p.locator('#rh-feed a[href^="http"]').all();
  for(const a of links){
   assert.match(await a.getAttribute('href'),/^https:/);
   assert.equal(await a.getAttribute('target'),'_blank');
   assert.match(await a.getAttribute('rel'),/noopener/);
  }
 });

 await check('08 发现页签各自给出自己的空状态，不互相顶替',async p=>{
  const seen=new Set();
  for(const key of ['papers','news','resources']){
   await p.locator('[data-rh-tab="'+key+'"]').click();await settle(p);
   assert.equal(await p.locator('[data-rh-tab="'+key+'"]').getAttribute('aria-selected'),'true');
   const rows=await p.locator('#rh-feed .rh-discovery-row').count();
   if(!rows){
    const txt=await p.locator('#rh-feed .rh-empty').innerText();
    assert(txt.trim(),key+' 空了却没有说明');
    assert(!seen.has(txt),'空状态文案和别的页签重复：'+txt);
    seen.add(txt);
   }
  }
 });

 await check('09 搜索只筛课题，搜不到时给出可恢复的说明',async p=>{
  // 课题不超过 6 个时不出搜索框（4 个课题一眼看完，搜索是多余控件）；超过才出
  if(!await p.locator('[data-rh-search]').count()){const n=await p.evaluate(()=>workbenchData().projects.length);assert(n<=6,'课题 '+n+' 个却没有搜索框');return;}
  await p.locator('[data-rh-search]').fill('不可能匹配的课题名');await settle(p);
  assert.equal(await p.locator('.rh-prow').count(),0);
  assert.match(await p.locator('.rh-projects .rh-empty').innerText(),/搜索词|没有匹配/);
  await p.locator('[data-rh-search]').fill('');await settle(p);
  assert(await p.locator('.rh-prow').count()>0);
 });

 await check('10 页面不随定时器自己变',async p=>{
  const before=await p.evaluate(()=>[RESEARCH_HOME.start,RESEARCH_HOME.tab,RESEARCH_HOME.query]);
  await p.clock.install();await p.clock.runFor(60000);
  assert.deepEqual(await p.evaluate(()=>[RESEARCH_HOME.start,RESEARCH_HOME.tab,RESEARCH_HOME.query]),before);
 });

 await check('11 各宽度不出现横向滚动',async p=>{
  for(const[width,height]of[[1920,1080],[1440,900],[1366,768],[1280,720],[1122,607],[768,900],[390,844]]){
   await p.setViewportSize({width,height});await settle(p);
   const over=await p.evaluate(()=>view.scrollWidth-view.clientWidth);
   assert(over<=1,width+' 宽出现了 '+over+'px 横向滚动');
   if(width===390)await p.screenshot({path:path.join(out,'mobile.png')});
  }
 });

 await check('12 浅深两套都达到 4.5 对比度',async p=>{
  for(const theme of['light','dark']){
   await p.evaluate(t=>{document.documentElement.dataset.theme=t;render()},theme);await settle(p);
   for(const selector of['.rh-prow-main h3','.rh-prow-main p','.rh-q-copy strong','.rh-q-copy small','.rh-next-action','.rh-discovery-copy strong','.rh-activity-copy strong']){
    if(!await p.locator(selector).count())continue;
    const c=await p.locator(selector).first().evaluate(e=>{const rgb=s=>(s.match(/[\d.]+/g)||[]).map(Number);
     let n=e,bg;while(n){bg=rgb(getComputedStyle(n).backgroundColor);if(bg.length===3||bg[3]===1)break;n=n.parentElement;}
     return{fg:rgb(getComputedStyle(e).color),bg}});
    assert(contrast(c.fg,c.bg)>=4.5,theme+' '+selector+' 只有 '+contrast(c.fg,c.bg).toFixed(2));
   }
   if(theme==='dark')await p.screenshot({path:path.join(out,'dark.png')});
  }
 });

 await check('13 没有课题时给创建入口，而不是一片空白',async p=>{
  await p.evaluate(()=>{DB.projects=[];render()});await settle(p);
  assert.equal(await p.locator('.rh-prow').count(),0);
  assert(await p.locator('.rh-projects .rh-empty [data-wb-create-project]').count());
  await p.locator('.rh-projects .rh-empty [data-wb-create-project]').click();await settle(p);
  assert.equal(await p.evaluate(()=>S.route),'projects');
 });

 assert.deepEqual(errors,[]);
 fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({generatedAt:new Date().toISOString(),checks,errors,scope:'隔离环境下的界面验证；不发真实模型或设备请求。'},null,2));
 await browser.close();console.log('工作台：'+checks.length+' 组通过。');
})().catch(async e=>{console.error(e);fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({checks,errors,error:e.stack},null,2));await browser?.close();process.exitCode=1;});
