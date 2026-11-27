/* 工作台。
   这一套原来测的是改版前那个三面板工作台（.wb-panel、今日灵感轮播、文献订阅），
   那一整块在 v2 里换掉了，所以原来的十二条全部落空。工作台本身现在由
   workbench-reference.cjs 覆盖（13 组：区块排布、翻页、卡片上的数、文献外链、
   空状态、不随定时器自己变、各宽度不横滚、明暗对比度），
   课题卡分档、灵感、文献、注意力任务由 product-iteration.cjs 的 R02–R16 覆盖。

   这里只留那两套都没管、又确实还成立的几条：
   旧的 hash 深链、从卡片点进具体任务、模型库页签、进工作台不自动调模型。

   跑构建产物：node review/workbench.cjs [index.html] */
const assert=require('node:assert/strict'),path=require('node:path');
const {chromium}=require('../test-browser.cjs');
const F='file://'+path.resolve(process.argv[2]||'index.html');
let browser;
(async()=>{
 browser=await chromium.launch();
 const page=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
 page.setDefaultTimeout(6500);
 const errors=[],report=[];let models=0;
 page.on('pageerror',e=>errors.push(e.message));
 /* 外网一律拦掉，顺便数一下有没有人偷偷调模型 */
 await page.route(/^https?:\/\//,r=>{
  if(new URL(r.request().url()).pathname.endsWith('/api/model/chat'))models++;
  return r.abort('blockedbyclient');
 });
 const check=async(name,fn)=>{await fn();report.push(name);console.log('PASS '+name)};
 const home=async()=>{await page.evaluate(()=>go('workbench'));await page.waitForTimeout(600)};
 await page.goto(F);await page.waitForFunction(()=>RS.seedReady);await page.waitForTimeout(600);

 await check('默认落地在工作台，侧栏跟着高亮，进来不调模型',async()=>{
  await home();
  assert.equal(await page.evaluate(()=>S.route),'workbench');
  assert.equal(await page.locator('[data-navid="workbench"]').getAttribute('aria-current'),'page');
  assert.equal(models,0,'打开工作台不该调模型');
 });

 /* 这几个 hash 是外面发出去的链接，改版不能把它们打断 */
 await check('旧的 hash 深链还能用',async()=>{
  for(const [hash,expect] of [['#chat',{route:'chat'}],['#dsets',{route:'dsets'}],
   ['#infer',{route:'mdl',mtab:'infer'}],['#home',{route:'workbench'}]]){
   await page.goto(F+hash);await page.waitForFunction(()=>RS.seedReady);await page.waitForTimeout(500);
   const got=await page.evaluate(()=>({route:S.route,mtab:S.mtab}));
   assert.equal(got.route,expect.route,hash);
   if(expect.mtab)assert.equal(got.mtab,expect.mtab,hash);
   assert((await page.locator('#view').innerText()).trim().length>0,hash+' 落在一张空页面上');
  }
 });

 await check('工作台卡片上的任务点进去就落在那一条上',async()=>{
  await home();
  const keys=await page.locator('[data-wb-task-open]').evaluateAll(es=>es.map(e=>e.dataset.wbTaskOpen));
  assert(keys.length>0,'卡片上应该列着任务');
  const [kind,pid,id]=keys[0].split(':');
  assert.equal(kind,'experiment');
  await page.locator('[data-wb-task-open="'+keys[0]+'"]').first().click();await page.waitForTimeout(500);
  assert.deepEqual(await page.evaluate(()=>[S.route,S.labPick,S.pid]),['labdet',id,pid]);
  assert((await page.locator('#view h1').innerText()).trim().length>0);
 });

 await check('模型库五个页签都在，切过去都能生效',async()=>{
  await page.evaluate(()=>go('mdl'));await page.waitForTimeout(400);
  /* 按「点了之后这一格是不是选中的」判，不按 S.mtab 判：
     数据集那一格点下去会换路由，内部那个字段未必跟着叫同一个名字。 */
  for(const tab of ['cur','dset','job','eval','batch']){
   const button=page.locator('[data-mtab="'+tab+'"]');
   assert.equal(await button.count(),1,'缺页签 '+tab);
   await button.click();await page.waitForTimeout(350);
   const on=page.locator('[data-mtab="'+tab+'"]');
   assert.match(String(await on.getAttribute('class')),/is-on/,tab+' 点了没选中');
   assert.equal(await page.locator('[data-mtab].is-on').count(),1,tab+' 同时亮了不止一格');
   assert((await page.locator('#view').innerText()).trim().length>0,tab+' 页签是空的');
  }
 });

 await check('全程没有运行时报错，也没有真的调模型',async()=>{
  assert.deepEqual(errors,[]);
  assert.equal(models,0);
 });

 await browser.close();
 console.log('工作台：'+report.length+' 组通过。');
/* 断言失败时也要把浏览器关掉，不然 node 退不出去，看着像卡死 */
})().catch(async e=>{console.error(e);await browser?.close();process.exitCode=1;});
