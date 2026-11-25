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

 await check('01 三个区块自上而下排列，各自标题可见',async p=>{
  for(const name of ['近期研究动态','课题相关发现'])assert(await p.getByRole('heading',{name,exact:true}).isVisible());
  assert(await p.getByRole('heading',{name:/^我的课题/}).isVisible());
  const r=await p.evaluate(()=>{const box=s=>{const b=document.querySelector(s).getBoundingClientRect();return{y:b.y,bottom:b.bottom,x:b.x}};
   return{act:box('.rh-activities'),proj:box('.rh-projects'),disc:box('.rh-discoveries')}});
  assert(r.act.bottom<=r.proj.y+1,JSON.stringify(r));
  assert(r.proj.bottom<=r.disc.y+1,JSON.stringify(r));
  assert.equal(Math.round(r.act.x),Math.round(r.disc.x));
  await p.screenshot({path:path.join(out,'desktop.png')});
 });

 await check('02 课题卡片不把富余高度摊进正文块',async p=>{
  // 这一条守着一个真实回归：卡片曾经被页面网格拉满，两段正文各吸收上百像素空白。
  const m=await p.evaluate(()=>{const c=document.querySelector('.rh-project'),cr=c.getBoundingClientRect();
   const leaves=[...c.querySelectorAll('*')].filter(e=>!e.children.length&&(e.textContent||'').trim())
     .map(e=>{const r=e.getBoundingClientRect();return[r.top,r.bottom,r.height]}).filter(x=>x[2]>0)   // 隐藏元素矩形为 0，不算墨迹
     .map(x=>[x[0],x[1]]).sort((a,b)=>a[0]-b[0]);
   const merged=[];leaves.forEach(iv=>{const last=merged[merged.length-1];
    if(last&&iv[0]<=last[1]+1)last[1]=Math.max(last[1],iv[1]);else merged.push([...iv])});
   const ink=merged.reduce((s,iv)=>s+(iv[1]-iv[0]),0);
   const gaps=merged.slice(1).map((iv,i)=>iv[0]-merged[i][1]);
   return{h:cr.height,inkPct:ink/cr.height,maxGap:Math.max(...gaps)}});
  assert(m.inkPct>=.4,'卡片墨迹占比只有 '+Math.round(m.inkPct*100)+'%：'+JSON.stringify(m));
  assert(m.maxGap<=60,'卡片内出现 '+Math.round(m.maxGap)+'px 的空档：'+JSON.stringify(m));
 });

 await check('03 三张卡的同名区块横向对齐',async p=>{
  const rows=await p.evaluate(()=>[...document.querySelectorAll('.rh-project')]
   .map(c=>[...c.querySelectorAll('.rh-card-section h4')].map(h=>Math.round(h.getBoundingClientRect().top))));
  assert(rows.length>1);
  for(let i=0;i<rows[0].length;i++){
   const tops=new Set(rows.map(r=>r[i]));
   assert.equal(tops.size,1,'第 '+(i+1)+' 个区块标题没对齐：'+JSON.stringify(rows));
  }
 });

 await check('04 上一页 / 下一页能走遍全部课题，到头即禁用',async p=>{
  const expected=await p.evaluate(()=>workbenchData().projects.map(x=>x.id)),seen=new Set();
  const ids=()=>p.locator('[data-wb-project-id]').evaluateAll(es=>es.map(e=>e.dataset.wbProjectId));
  (await ids()).forEach(id=>seen.add(id));
  const prev=p.locator('[data-rh-project-page="prev"]'),next=p.locator('[data-rh-project-page="next"]');
  if(expected.length>3){
   assert.equal(await next.count(),1,'课题多于一页却没有翻页控件');
   assert.equal(await prev.isDisabled(),true,'第一页的「上一页」应该是禁用的');
   for(let i=0;i<10&&!(await next.isDisabled());i++){await next.click();await settle(p);
    for(const id of await ids())seen.add(id);}
   assert.deepEqual(seen,new Set(expected),'一路翻到底没能走遍全部课题');
   assert.equal(await next.isDisabled(),true,'最后一页的「下一页」应该是禁用的');
   // 往回翻一页，「下一页」要重新可用；页码跟着走
   await prev.click();await settle(p);
   assert.equal(await next.isDisabled(),false,'退回上一页后「下一页」仍然禁用');
   assert.match(await p.locator('.rh-pager-n').innerText(),/^\d+ \/ \d+$/);
  }else assert.equal(await next.count(),0,'课题不足一页时不该出现翻页控件');
 });

 await check('05 每张卡都能进到自己的课题',async p=>{
  const card=p.locator('.rh-project').last(),pid=await card.getAttribute('data-wb-project-id');
  await card.locator('.rh-enter').click();await settle(p);
  assert.equal(await p.evaluate(()=>S.pid),pid);
  assert.equal(await p.evaluate(()=>S.route),'project');
 });

 await check('06 卡片上的数就是本机算出来的那个数',async p=>{
  // 不在这里重算一遍口径（重算等于把实现抄一份），直接对本机算出的结果。
  for(const card of await p.locator('.rh-project').all()){
   const pid=await card.getAttribute('data-wb-project-id');
   const s=await p.evaluate(pid=>{const proj=workbenchData().projects.find(x=>x.id===pid);
    const st=researchProjectState(proj);return{badge:st.badge,next:st.next}},pid);
   assert.equal(await card.locator('header .rh-badge').innerText(),s.badge,pid+' 的角标和本机算的不一致');
   assert.match(await card.locator('.rh-next-action').innerText(),new RegExp(s.next.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')),pid+' 的下一步和本机算的不一致');
  }
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
  assert.equal(await p.locator('.rh-project').count(),0);
  assert.match(await p.locator('.rh-projects .rh-empty').innerText(),/搜索词|没有匹配/);
  await p.locator('[data-rh-search]').fill('');await settle(p);
  assert(await p.locator('.rh-project').count()>0);
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
   for(const selector of['.rh-project header h3','.rh-card-section h4','.rh-card-section p','.rh-next','.rh-discovery-copy strong','.rh-activity-copy strong']){
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
  assert.equal(await p.locator('.rh-project').count(),0);
  assert(await p.locator('.rh-projects .rh-empty [data-wb-create-project]').count());
  await p.locator('.rh-projects .rh-empty [data-wb-create-project]').click();await settle(p);
  assert.equal(await p.evaluate(()=>S.route),'projects');
 });

 assert.deepEqual(errors,[]);
 fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({generatedAt:new Date().toISOString(),checks,errors,scope:'隔离环境下的界面验证；不发真实模型或设备请求。'},null,2));
 await browser.close();console.log('工作台：'+checks.length+' 组通过。');
})().catch(async e=>{console.error(e);fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({checks,errors,error:e.stack},null,2));await browser?.close();process.exitCode=1;});
