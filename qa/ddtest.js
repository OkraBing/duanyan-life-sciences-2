const {chromium}=require('../test-browser.cjs');
(async()=>{const b=await chromium.launch();
const p=await b.newPage({viewport:{width:1360,height:900},deviceScaleFactor:2});
const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto('file://'+process.argv[2]);await p.waitForTimeout(400);
// 全视图扫一遍：还有没有没被换掉的原生 select
/* 改造成 Agent 之后只剩这几个视图，旧清单里的页面已经不存在了 */
const views=['chat','projects','project','lab','mdl','shelf','data'];
let raw=0,dd=0;
// 先在对话里开一张带各种控件的表单，否则扫到的全是空页
/* 排实验那张表单上选择器、滑块、开关都有，一张就能把控件渲染路径走全 */
await p.evaluate(async()=>{S.sid='d0';CONV.d0=[];S.pid='p1';go('chat');
  document.getElementById('ask').value='把这批候选送去测亲和力';agentSend();
  await new Promise(r=>setTimeout(r,1100));
  const cs=[];convOf().forEach(m=>(m.cards||[]).forEach(c=>cs.push(c)));
  const f=cs.find(x=>x.t==='form');if(f)f.advOpen=true;render();});
await p.waitForTimeout(400);
{const r0=await p.evaluate(()=>({
  raw:document.querySelectorAll('#view select:not(.sel-raw):not(.ctl-sel select)').length,
  sel:document.querySelectorAll('#view .ctl-sel select').length,
  rng:document.querySelectorAll('#view input[type=range]').length,
  sw:document.querySelectorAll('#view .sw[data-ksw]').length}));
 console.log(`表单卡上：包好的 select ${r0.sel} 个，滑块 ${r0.rng} 个，开关 ${r0.sw} 个，`
   +`漏在外面的原生 select ${r0.raw} 个`);
 if(r0.raw){console.log('❌ 有漏在外面的原生 select');process.exitCode=1}
 if(!r0.sel||!r0.rng||!r0.sw){console.log('❌ 表单卡上的控件没渲染出来');process.exitCode=1}}
for(const v of views){
  await p.evaluate(h=>{location.hash=h},v);await p.waitForTimeout(140);
  const r=await p.evaluate(()=>({
    /* .ctl-sel 里的原生 select 是故意留的：表单卡要的是键盘可达和手机上的原生选择器。
       要查的是「被产品下拉替换过、却漏在外面」的那些。 */
    raw:document.querySelectorAll('#view select:not(.sel-raw):not(.ctl-sel select)').length,
    dd:document.querySelectorAll('#view .ctl-dd').length}));
  raw+=r.raw;dd+=r.dd;
  if(r.raw)console.log('  ⚠',v,'还有原生 select',r.raw);
}
console.log(`扫 ${views.length} 个视图：产品下拉 ${dd} 个，未替换的原生 select ${raw} 个`);
// 真点开一个：流程卡上的节点模型选择，现在从对话里唤起
await p.evaluate(async()=>{S.sid='d1';CONV.d1=[];S.pid='p1';go('chat');
  document.getElementById('ask').value='把这条序列折出来';agentSend();
  await new Promise(r=>setTimeout(r,1100));});
await p.waitForTimeout(400);
// 指名点模型下拉：发射台上第一个下拉现在是「算在哪个项目」，
// 按位置取控件的测试，一加控件就会指到别的东西上
const btn=await p.$('#view [data-nodepick]');
if(btn){await btn.click();await p.waitForTimeout(260);
  const m=await p.$('#menu');
  console.log('点开后 menu 存在：',!!m);
  if(m){const items=await p.$$eval('#menu .menu-i',e=>e.length);console.log('菜单项',items);}
  await p.screenshot({path:require('../test-browser.cjs').testOutput('shot-dd.png'),clip:{x:380,y:150,width:760,height:420}});
  // 选第二项，确认 change 真的派发了
  // 模型选择器背后不是原生 select，选中之后看真值变没变
  const its=await p.$$('#menu .menu-i[data-pick]');
  if(its.length>1){const want=await its[1].$eval('.nm',e=>e.textContent.trim());
    await its[1].click();await p.waitForTimeout(260);
    const got=await p.evaluate(()=>nodePick('str','fold'));
    console.log('选第二项：想要 '+want+'，真值 '+got+(want===got?' ✅':' ❌'));
    if(want!==got)process.exitCode=1;}
}
// 三维卡上的显示模式：被包装过的原生 select 要还能回写 select.value
await p.evaluate(async()=>{S.sid='d2';CONV.d2=[];S.pid='p1';go('chat');
  document.getElementById('ask').value='把这条序列折出来';agentSend();
  await new Promise(r=>setTimeout(r,1100));
  const g=document.querySelector('[data-kgo]');if(g)g.click();
  await new Promise(r=>setTimeout(r,4600));});
await p.waitForTimeout(500);
const raw2=await p.$("#view select.sel-raw");
if(!raw2){console.log('⚠ 这一版三维卡没有被包装的原生 select，跳过这一项')}
else{const dd2=await p.$('#view .ctl-dd');
  if(dd2){await dd2.click();await p.waitForTimeout(240);
    const its2=await p.$$('#menu .menu-i[data-pick]');
    if(its2.length>1){await its2[1].click();await p.waitForTimeout(240);
      console.log('包装后的 select.value =',await p.$eval('#view select.sel-raw',e=>e.value));}}}
console.log('JS 错误：',errs.length?errs:'无');
await b.close();})();
