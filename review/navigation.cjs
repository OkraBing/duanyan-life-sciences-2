const assert=require('node:assert/strict');
const {chromium}=require('../test-browser.cjs');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const out=path.join(os.tmpdir(),'duanyan-navigation-qa');fs.mkdirSync(out,{recursive:true});
async function checkExperimentSelection(page){
 const selected=page.locator('#side [aria-current="page"]');
 const appearance=()=>selected.evaluate(async item=>{
  await Promise.allSettled(item.getAnimations({subtree:true}).map(animation=>animation.finished));
  const style=getComputedStyle(item);
  return [style.backgroundColor,style.color,style.fontWeight,style.borderRadius,getComputedStyle(item.querySelector('svg')).color];
 });
 await page.locator('#side [data-navid="workbench"]').click();
 const expected=await appearance();
 /* 第二版：设备管理没有导航入口了，选中态改用资源组的两个入口验证 */
 for(const route of ['lab','mdl']){
  await page.locator('#side [data-navid="'+route+'"]').click();
  assert.equal(await selected.getAttribute('data-navid'),route);
  assert.deepEqual(await appearance(),expected,route+' selected appearance');
 }
}
(async()=>{const b=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--disable-gpu']});
const p=await b.newPage({viewport:{width:1440,height:960},reducedMotion:'reduce'});const errors=[];p.on('pageerror',e=>errors.push(e.message));await p.route(/^https?:/,r=>r.abort());
await p.goto(require('node:url').pathToFileURL(path.resolve(__dirname,'../index.html')).href+'#projects');await p.waitForFunction(()=>RS.seedReady);
await p.locator('#navA [data-navid="projects"]').click();
assert.equal(await p.locator('#view h1').first().innerText(),'课题项目');
assert.equal(await p.locator('#navA [data-navid="shared"]').count(),0);
/* 第二版：导航只剩三组七个入口；资料空间 / 设备 / 数据集 / 我的工具 / 定时任务 / 设置都改在页内进 */
assert.deepEqual(await p.locator('#navA .nav-tx').allTextContents(),['工作台','科研对话','课题项目']);
assert.deepEqual(await p.locator('#navB .nav-tx').allTextContents(),['实验管理']);
assert.equal(await p.locator('#navC .lbl').innerText(),'资源');
assert.deepEqual(await p.locator('#navC .nav-tx').allTextContents(),['模型制备','科研工具','数据库']);
assert.equal(await p.locator('#navD').count(),0,'市场分组应已并入资源');
assert.equal(await p.locator('#side [data-navid="settings"]').count(),0,'设置不该再占导航');
assert.equal(await p.locator('#view .navigation-tab').count(),0);
assert(await p.locator('#view .navigation-project-source').count()>0);
assert(await p.locator('#view .navigation-project-source').allTextContents().then(rows=>rows.every(text=>text==='共享')));
assert(await p.locator('#view .project-update').count()>0);
await p.waitForTimeout(300);await p.screenshot({path:out+'/expanded.png'});await checkExperimentSelection(p);
await p.locator('.side-toggle').click();assert.equal(Math.round((await p.locator('#side').boundingBox()).width),72);
await p.locator('[data-navid="mdl"]').hover();await p.waitForTimeout(100);assert.equal(await p.locator('#navigation-tooltip').innerText(),'模型制备');assert(await p.locator('#navigation-tooltip').isVisible());
await p.screenshot({path:out+'/collapsed.png'});await p.keyboard.press('Escape');assert(!(await p.locator('#navigation-tooltip').isVisible()));
/* 资料空间的入口搬到了课题项目页右上角，从那里进去，导航高亮课题项目 */
await p.locator('[data-navid="projects"]').click();await p.waitForTimeout(200);
await p.locator('#view [data-go="materials"]').click();await p.waitForTimeout(300);
assert.match(await p.locator('#view').innerText(),/资料空间/);assert.equal(await p.locator('#side [aria-current="page"]').getAttribute('data-navid'),'projects');
await p.reload();assert.equal(Math.round((await p.locator('#side').boundingBox()).width),72);
await checkExperimentSelection(p);
const settingsMenu=p.getByRole('navigation',{name:'设置分类'});
const currentSetting=settingsMenu.locator('[aria-current="page"]');
/* 第二版：设置从侧栏底部的账户进 */
await p.locator('#side .acct-b').click();await p.waitForTimeout(250);
assert.equal(await p.locator('#view h1').first().innerText(),'设置');
assert.equal(await currentSetting.innerText(),'常规设置');
assert((await settingsMenu.boundingBox()).x < (await p.locator('#view h1').boundingBox()).x);
await settingsMenu.getByRole('link',{name:'模型接入'}).click();
assert.equal(await p.locator('#view h1').first().innerText(),'模型接入');
assert.equal(await currentSetting.innerText(),'模型接入');
/* 第二版：「模型接入」归到模型制备（入口在模型制备右上角），所以侧栏高亮模型制备 */
assert.equal(await p.locator('#side .nav[aria-current="page"]').getAttribute('data-navid'),'mdl','模型接入页应高亮模型制备');
assert.equal(await p.locator('#view .navigation-tab, #view [role="tablist"]').count(),0);
await p.screenshot({path:out+'/settings-desktop.png'});
await p.goBack();
assert.equal(await currentSetting.innerText(),'常规设置');
await p.setViewportSize({width:390,height:844});
await settingsMenu.getByRole('link',{name:'模型接入'}).click();
assert.equal(await currentSetting.innerText(),'模型接入');
assert(await p.getByRole('button',{name:'接入外部大模型'}).isVisible());
assert(await p.evaluate(()=>view.scrollWidth<=view.clientWidth),'settings mobile horizontal overflow');
await p.screenshot({path:out+'/settings-mobile.png'});
await p.setViewportSize({width:1440,height:960});
for(const route of ['tools','mdl','shelf','data','schedules','lab','devices','dsets','shared','materials']){await p.evaluate(r=>go(r),route);assert((await p.locator('#view').innerText()).trim().length>20,route+' blank');}
await p.setViewportSize({width:390,height:844});await p.evaluate(()=>go('projects'));assert(await p.locator('#view h1').isVisible());const size=await p.evaluate(()=>({scroll:document.documentElement.scrollWidth,viewport:innerWidth}));assert(size.scroll<=size.viewport,'mobile horizontal overflow');await p.waitForTimeout(300);await p.screenshot({path:out+'/mobile.png'});
await checkExperimentSelection(p);
assert.deepEqual(errors,[]);console.log('PASS navigation: unified projects without tabs, source labels and progress, parent highlight, materials, settings/model access, collapsed width, tooltip, Escape, persisted state, 10 routes, mobile overflow, runtime errors.');await b.close();})().catch(e=>{console.error(e);process.exit(1)});
