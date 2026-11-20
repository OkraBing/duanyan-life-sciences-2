/* 界面上说「未接入」「跑不了」的，必须真的跑不了；
   说「能用于排序」的，必须真的打得出分。断言和行为要对得上（R17）。 */
const {chromium}=require('../test-browser.cjs');
(async()=>{const b=await chromium.launch();const p=await b.newPage();
const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto('file://'+process.argv[2]);await p.waitForTimeout(400);
let bad=0;const say=(ok,m)=>{if(!ok)bad++;console.log((ok?'  ✓ ':'  ❌ ')+m)};
const r=await p.evaluate(async()=>{
  const cs=()=>{const L=[];convOf().forEach(m=>(m.cards||[]).forEach(c=>L.push(c)));return L};
  S.sid='c1';CONV.c1=[];S.pid='p1';go('chat');
  /* 1. 选一个未接入的基础模型 */
  document.getElementById('ask').value='用这个项目的实测数据训一个打分模型';agentSend();
  for(let k=0;k<80&&!document.querySelector('[data-kgo]');k++)
    await new Promise(r=>setTimeout(r,120));
  const f=cs().find(x=>x.cap==='train');
  const 模型前=PMODELS().length;   /* 开页时已经种了几个模型，要比增量不是比总数 */
  const bad1=BASE_MODELS.filter(x=>!x.ok);
  allFields(f).find(x=>x.k==='base').v=bad1[0].n+'（未接入）';
  render();await new Promise(r=>setTimeout(r,120));
  [...document.querySelectorAll('[data-kgo]')].pop().click();
  await new Promise(r=>setTimeout(r,2600));
  const 出了指标=cs().some(x=>x.t==='metric'||x.t==='scat');
  const 出了模型=PMODELS().length-模型前;
  const 回答=convOf().filter(x=>x.role==='ai').map(x=>x.text).filter(Boolean).slice(-1)[0]||'';
  /* 2. 能用于排序的必须打得出分 */
  S.sid='c2';CONV.c2=[];go('chat');
  document.getElementById('ask').value='用这个项目的实测数据训一个打分模型';agentSend();
  for(let k=0;k<80&&!document.querySelector('[data-kgo]');k++)
    await new Promise(r=>setTimeout(r,120));
  [...document.querySelectorAll('[data-kgo]')].pop().click();
  await new Promise(r=>setTimeout(r,5200));
  const ok=PMODELS().filter(canScore), no=PMODELS().filter(x=>!canScore(x));
  const 打得出分=ok.every(m=>CANDS().slice(0,6).every(c=>scoreWith(m,c)!=null));
  const 打不出分=no.every(m=>CANDS().slice(0,3).every(c=>scoreWith(m,c)==null));
  const 下拉条数=SCORERS().length;
  return {出了指标:出了指标,出了模型:出了模型,回答:回答,
    未接入条数:bad1.length,未接入说明:bad1.every(x=>x.why&&x.why.length>5),
    能排序:ok.length,不能排序:no.length,打得出分:打得出分,打不出分:打不出分,
    下拉条数:下拉条数,提示:SCORER_HINT()};
});
say(!r.出了指标,'选未接入的基础模型，不出任何指标卡');
say(r.出了模型===0,'选未接入的基础模型，不往模型列表里写东西');
say(/跑不了|没接|未接入/.test(r.回答),`回答里说清了跑不了：「${r.回答.slice(0,40)}…」`);
say(r.未接入说明,`${r.未接入条数} 个未接入的都写了缺什么`);
say(r.打得出分,`标为能排序的 ${r.能排序} 个，对候选都算得出分`);
say(r.打不出分,`标为不能排序的 ${r.不能排序} 个，对候选确实算不出分`);
say(r.下拉条数===r.能排序+1,`排序下拉 ${r.下拉条数} 项 = 能排序的 ${r.能排序} 个 + 「不用」`);
say(r.提示.length>10,`下拉提示说明了情况：「${r.提示.slice(0,50)}…」`);
console.log(bad?`\n❌ ${bad} 条断言和行为对不上`:'\n✅ 说跑不了的真跑不了，说能排序的真打得出分');
console.log('JS 错误:',errs.length?errs.slice(0,3):'无');
if(bad||errs.length)process.exitCode=1;
await b.close()})();
