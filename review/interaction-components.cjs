/* Cross-page component contracts, compared with the established project UI.
   Exercises visible controls in isolated browser storage; no external writes. */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('../test-browser.cjs');
const out=path.resolve('work/qa/interaction-components');fs.mkdirSync(out,{recursive:true});
const checks=[],errors=[],measurements={};let browser,page;
const visible=':visible:not(.sel-raw)';
async function go(route){await page.evaluate(r=>{document.querySelector('#component-harness')?.remove();iterationCloseDrawer(false);if(r==='shareddetail')RS.sharedPick='example-shared-owned';go(r)},route);if(route==='workbench'){await page.waitForTimeout(300);await page.waitForFunction(()=>!WB.papersBusy);}}
async function style(locator){return locator.evaluate(e=>{const s=getComputedStyle(e),r=e.getBoundingClientRect();return {height:r.height,font:s.fontSize,radius:s.borderRadius,bg:s.backgroundColor,color:s.color,border:s.borderColor};});}
async function check(name,fn){try{await fn();checks.push({name,status:'passed'});console.log('PASS '+name);}catch(e){checks.push({name,status:'failed',error:e.stack});console.error('FAIL '+name+'\n'+e.stack);await page.screenshot({path:path.join(out,'failure-'+checks.length+'.png')}).catch(()=>{});}}
async function shot(name){await page.screenshot({path:path.join(out,'after-'+name+'.png')});}
(async()=>{
 browser=await chromium.launch();const context=await browser.newContext({viewport:{width:1440,height:900},reducedMotion:'reduce'});page=await context.newPage();page.setDefaultTimeout(6000);page.on('pageerror',e=>errors.push(e.message));
 await context.route(/^https?:\/\//,r=>r.request().url().startsWith('https://api.crossref.org/works?')?r.fulfill({contentType:'application/json',body:JSON.stringify({message:{items:[]}})}):r.abort('blockedbyclient'));
 await page.goto('file://'+path.resolve(process.argv[2]||'index.html')+'#projects');await page.waitForFunction(()=>RS.seedReady);
 /* 工作台没有 .btn-pri：那一页的主操作是「进入对话」(.rh-new)。底色得跟全站主按钮一个色。 */
 await check('primary actions match across project pages including the workbench entry action',async()=>{
  for(const theme of ['light','dark']){await page.evaluate(t=>document.documentElement.dataset.theme=t,theme);await go('projects');await page.mouse.move(0,0);const old=await style(page.locator('#view .btn-pri').first());await page.locator('#view .btn-pri').first().hover();await page.waitForTimeout(180);const hover=await style(page.locator('#view .btn-pri').first());await go('shared');await page.mouse.move(0,0);const current=await style(page.locator('#view .btn-pri').first());assert.deepEqual(current,old);await page.locator('#view .btn-pri').first().hover();await page.waitForTimeout(180);assert.deepEqual(await style(page.locator('#view .btn-pri').first()),hover);await go('workbench');await page.mouse.move(0,0);await page.waitForTimeout(120);const entry=await style(page.locator('.rh-new').first());assert.equal(entry.bg,old.bg,theme+' 工作台主操作底色');assert.equal(entry.font,old.font,theme+' 工作台主操作字号');assert.equal(entry.height,old.height,theme+' 工作台主操作高度');measurements['primary-'+theme]={established:old,shared:current,workbench:entry};}await page.evaluate(()=>document.documentElement.dataset.theme='light');await shot('workbench');
 });
 /* 「设计实验」用的是 .al-field，也要进这套尺度：它跟发起训练、新建数据库是同一类表单。 */
 await check('new form inputs and dropdowns share the established 32px desktop scale',async()=>{
  await go('trainnew');const established=await style(page.locator('input.input'+visible).first());assert.equal(established.height,32);
  const field='.lv-field input.input'+visible+',.rs-field input.input'+visible+',.al-field input.input'+visible+',.lv-field>.ctl-dd'+visible+',.rs-field>.ctl-dd'+visible+',.al-field>.ctl-dd'+visible;
  for(const route of ['labnew','sharednew','toolnew','databasenew']){await go(route);const fields=page.locator(field);assert(await fields.count()>0,route);for(const one of await fields.all()){const s=await style(one);for(const key of ['height','font','radius'])assert.equal(s[key],established[key],route+' '+key);}measurements[route]=await fields.evaluateAll(es=>es.map(e=>({label:e.getAttribute('aria-label')||e.closest('label')?.querySelector('span')?.textContent,height:e.getBoundingClientRect().height})));}await shot('resource-form');
 });
 await check('device modal retains a stable frame and multiline application note',async()=>{
  await go('devices');await page.locator('[data-device-apply="flex"]').click();assert.equal((await style(page.locator('#device-instance'))).height,32);assert((await style(page.locator('#device-request-note'))).height>=76);const bounds=await page.locator('#dlg .card-h').last().boundingBox();await page.locator('#device-instance').fill('LAB-COMPONENT-01');await page.locator('#device-request-note').fill('用于蛋白样品分装\n需要记录样本交接信息');assert.deepEqual(await page.locator('#dlg .card-h').last().boundingBox(),bounds);await shot('device-modal');await page.locator('#dlg [value=cancel]').click();assert.equal(await page.evaluate(()=>iterationDeviceStatus('flex')),'available');
 });
 /* 编排器那套「错误落到控件上」的机制现在活在资源表单里：提交后红框加一行提示，
    顶上一条汇总可以点回字段；改一个字就把那一条清掉，不用等下次提交。 */
 await check('required fields receive error semantics and clear them after a valid entry',async()=>{
  await go('databasenew');await page.locator('[data-rs-save-resource=create]').click();await page.waitForTimeout(260);
  const invalid=page.locator('#view [aria-invalid=true]');assert(await invalid.count()>0,'必填没填要落到具体控件上');
  const first=invalid.first(),described=await first.getAttribute('aria-describedby');assert(described,'要有 aria-describedby 指到错误文案');
  const message=page.locator('#'+described);assert(await message.isVisible());assert((await message.innerText()).trim().length>0);
  const summary=page.locator('.rs-error-summary');assert(await summary.isVisible(),'顶部要有一条错误汇总');
  const key=await first.getAttribute('data-rs-resource-field');assert(await summary.locator('[data-resource-error="'+key+'"]').count(),'汇总里要有这个字段');
  assert(await summary.evaluate(e=>e===document.activeElement),'提交失败后焦点要落在汇总上');
  /* 用字段名定位，不要复用 [aria-invalid=true] 那个选择器：清掉之后它就指到下一个还红着的字段了。 */
  const before=await invalid.count(),field=page.locator('[data-rs-resource-field="'+key+'"]');await field.fill('端砚测试数据库');await page.waitForTimeout(200);
  assert.equal(await field.getAttribute('aria-invalid'),null,'改过的字段不该还红着');
  assert.equal((await message.innerText()).trim(),'','改过的字段下面不该还挂着提示');
  assert.equal(await summary.locator('[data-resource-error="'+key+'"]').count(),0,'汇总里也要去掉这一条');
  assert.equal(await invalid.count(),before-1);await shot('resource-validation');
 });
 await check('dropdown keyboard navigation skips hidden native controls and Escape returns focus',async()=>{
  await go('labnew');const trigger=page.locator('.ctl-dd[data-review-select="select-0"]');await trigger.focus();await page.keyboard.press('Enter');assert.equal(await trigger.getAttribute('aria-expanded'),'true');await page.keyboard.press('End');assert.equal(await page.evaluate(()=>document.activeElement.dataset.pick),String(await page.locator('#menu button[data-pick]').count()-1));await page.keyboard.press('Home');assert.equal(await page.evaluate(()=>document.activeElement.dataset.pick),'0');await page.keyboard.press('ArrowDown');assert.equal(await page.evaluate(()=>document.activeElement.dataset.pick),'1');await page.keyboard.press('Escape');assert(await trigger.evaluate(e=>e===document.activeElement));assert.equal(await trigger.getAttribute('aria-expanded'),'false');assert((await page.locator('select.sel-raw').evaluateAll(es=>es.every(e=>e.tabIndex===-1&&e.getAttribute('aria-hidden')==='true'))));
 });
 /* 「设计实验」的样品来源是一组单选卡片：焦点看得见（原生单选点自己有描边），
    选中看得见（卡片边框落在墨蓝上，底色换成淡蓝），两件事不能互相替代。 */
 await check('choice cards keep selection and keyboard focus distinguishable',async()=>{
  await go('labnew');const radios=page.locator('[data-al-origin]');assert(await radios.count()>=2);
  await page.keyboard.press('Tab');const idle=page.locator('[data-al-origin]:not(:checked)').first();const key=await idle.getAttribute('data-al-origin');
  await idle.focus();const ring=await idle.evaluate(e=>{const own=getComputedStyle(e),card=getComputedStyle(e.closest('label'));return own.outlineStyle!=='none'||card.outlineStyle!=='none';});assert(ring,'键盘焦点要看得见');
  await page.keyboard.press('Space');const picked=page.locator('[data-al-origin="'+key+'"]');assert(await picked.isChecked());
  const card=picked.locator('xpath=ancestor::label[1]');assert((await card.getAttribute('class')||'').includes('is-on'),'选中的卡片要有 is-on');
  const accent=await page.evaluate(()=>{const e=document.createElement('span');e.style.color='var(--dry-ink)';document.body.append(e);const v=getComputedStyle(e).color;e.remove();return v;});
  const look=await card.evaluate(e=>{const s=getComputedStyle(e);return{border:s.borderColor,bg:s.backgroundColor};});assert.equal(look.border,accent,'选中态的边框要落在墨蓝上');
  const idleCard=page.locator('[data-al-origin]:not(:checked)').first().locator('xpath=ancestor::label[1]');assert.notEqual((await idleCard.evaluate(e=>getComputedStyle(e).backgroundColor)),look.bg,'选中和未选中的底色要分得开');
 });
 /* 共享课题详情现在只做一件事（看资产），顶层页签整条去掉了；
    剩下的按类型分页签跟课题详情用的是同一个 .pjx-tab，两处必须长一样。 */
 await check('shared asset tabs match the established project tabs and keep the preview pane',async()=>{
  await go('projects');await page.locator('[data-proj=p1]').first().click();await page.waitForTimeout(300);const old=await style(page.locator('.pjx-tab.is-on').first());
  await go('shareddetail');assert.equal(await page.locator('#view .rs-tabs').count(),0,'这一页不该再有顶层页签');
  const current=await style(page.locator('.pjx-tab.is-on').first());assert.deepEqual(current,old);
  assert.equal(await page.locator('[data-shared-asset-tab=kb]').getAttribute('aria-current'),'page');
  await page.locator('[data-shared-asset-tab=exp]').click();await page.waitForTimeout(260);
  assert.equal(await page.locator('[data-shared-asset-tab=exp]').getAttribute('aria-current'),'page');
  assert.equal(await page.locator('[data-shared-asset-tab=kb]').getAttribute('aria-current'),'false');
  assert(await page.locator('.shared-asset-list').isVisible());assert(await page.locator('.shared-asset-preview').isVisible());
  await page.locator('[data-shared-asset-tab=kb]').click();await page.waitForTimeout(260);assert(await page.locator('[data-shared-asset-select]').first().isVisible());
  measurements.tabs={established:old,shared:current};await shot('shared-assets');
 });
 await check('closing panels stays neutral while destructive actions remain red',async()=>{
  const result=await page.evaluate(()=>{const temp=document.createElement('div');temp.id='component-harness';temp.innerHTML=drawer({title:'检查详情',close:'component-review',body:'<button class="icx" id="component-delete" aria-label="删除">×</button>'});document.body.append(temp);return true;});assert(result);const close=page.locator('.dw-h>.panel-close');await close.hover();await page.waitForTimeout(180);const neutral=await close.evaluate(e=>{const x=document.createElement('span');x.style.color='var(--ink)';document.body.append(x);const result=getComputedStyle(e).color===getComputedStyle(x).color;x.remove();return result;});assert(neutral);await page.locator('#component-delete').hover();await page.waitForTimeout(180);assert(await page.locator('#component-delete').evaluate(e=>{const x=document.createElement('span');x.style.color='var(--err)';document.body.append(x);const result=getComputedStyle(e).color===getComputedStyle(x).color;x.remove();return result;}));await page.locator('#component-harness').evaluate(e=>e.remove());
 });
 await check('experiment hover stays neutral while the compact error label stays red',async()=>{
  await go('lab');for(const theme of ['light','dark']){await page.evaluate(t=>document.documentElement.dataset.theme=t,theme);const card=page.locator('.lv-exp.is-exception').first();await page.mouse.move(0,0);const bounds=await card.boundingBox();assert.equal(await card.evaluate(e=>getComputedStyle(e).borderLeftWidth),'1px');await card.hover();await page.waitForTimeout(180);assert.deepEqual(await card.boundingBox(),bounds);assert(await card.evaluate(e=>{const span=document.createElement('span');span.style.color='var(--err)';document.body.append(span);const result=getComputedStyle(e.querySelector('.lv-state')).color===getComputedStyle(span).color;span.remove();return result;}),theme+' 异常标签要是红的');
   /* 悬停时卡片边框只许在中性色里换一档，不许借状态色——借了整张卡就在喊。 */
   const border=await card.evaluate(e=>getComputedStyle(e).borderColor);const channels=border.match(/[\d.]+/g).slice(0,3).map(Number);assert(Math.max(...channels)-Math.min(...channels)<=24,theme+' 悬停边框要中性：'+border);}await page.evaluate(()=>document.documentElement.dataset.theme='light');
 });
 await check('narrow layouts retain actions, readable forms and fixed resource form bars',async()=>{
  for(const width of [1122,390]){await page.setViewportSize({width,height:844});for(const route of ['workbench','labnew','sharednew','toolnew','databasenew','shareddetail']){await go(route);assert(await page.locator('h1').first().isVisible());assert(await page.locator('#view').evaluate(e=>e.scrollWidth<=e.clientWidth+1),route+' '+width);}
   if(width===390){await go('labnew');assert.equal((await style(page.locator('[data-al-field=name]'))).height,40,'窄屏输入框要放大到 40px');
    await go('shareddetail');await page.locator('[data-shared-asset-tab=exp]').click();await page.waitForTimeout(260);await page.locator('[data-shared-asset-select]').first().click();await page.waitForTimeout(300);assert(await page.locator('.shared-asset-preview').isVisible(),'窄屏下也要能看到资产详情');assert(await page.locator('#view').evaluate(e=>e.scrollWidth<=e.clientWidth+1),'shareddetail 390');}}
  await page.setViewportSize({width:1440,height:900});await go('toolnew');const head=await page.locator('.rs-form-frame-head').count()?page.locator('.rs-form-frame-head'):page.locator('.rs-head');const footer=page.locator('.rs-form-footer'),before={head:await head.boundingBox(),footer:await footer.boundingBox()};await page.locator('.rs-form-scroll').evaluate(e=>e.scrollTop=e.scrollHeight);assert.deepEqual(await head.boundingBox(),before.head);assert.deepEqual(await footer.boundingBox(),before.footer);await shot('resource-form-scroll');
 });
 await check('no runtime exceptions or restoration of removed controls',async()=>{assert.deepEqual(errors,[]);await go('workbench');assert.equal(await page.locator('.wb-topic-select,.wb-task-tabs,[data-wb-progress-auto],[data-wb-idea-auto],[data-wb-news-auto]').count(),0);});
 fs.writeFileSync(path.join(out,'components-results.json'),JSON.stringify({generatedAt:new Date().toISOString(),baseline:'5a38eb6 — established project controls',checks,measurements,errors},null,2));await browser.close();console.log('Components: '+checks.filter(x=>x.status==='passed').length+' passed, '+checks.filter(x=>x.status==='failed').length+' failed.');if(checks.some(x=>x.status==='failed'))process.exitCode=1;
})().catch(async e=>{console.error(e);await browser?.close();process.exitCode=1;});
