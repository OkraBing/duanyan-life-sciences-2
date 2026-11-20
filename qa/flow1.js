/* 每条能力都要能从一句话走到一组注册过的卡；有表单的必须有 SUBMIT。
   在真浏览器里跑：这几张卡里有的要读 DOM。 */
const {chromium}=require('../test-browser.cjs');
(async()=>{
const b=await chromium.launch();const p=await b.newPage({viewport:{width:1280,height:900}});
const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto('file://'+process.argv[2]);await p.waitForTimeout(400);
const r=await p.evaluate(()=>{
  const out=[],bad=[];
  ABIL.forEach(a=>{
    if(!FLOW[a.id]){bad.push(a.id+' 没有 FLOW');return}
    let cs;try{cs=FLOW[a.id]({})||[]}catch(e){bad.push(a.id+' FLOW 抛错：'+e.message);return}
    cs.forEach(c=>{if(!CARD[c.t])bad.push(a.id+' 产出未注册的卡 '+c.t)});
    if(cs.some(c=>c.t==='form')&&!SUBMIT[a.id])bad.push(a.id+' 有表单却没有 SUBMIT');
    /* 每张卡都要渲染得出来，不能抛 */
    cs.forEach(c=>{try{CARD[c.t](c)}catch(e){bad.push(a.id+' 的 '+c.t+' 渲染抛错：'+e.message)}});
    out.push(a.id+'　'+cs.map(c=>c.t).join(','));
  });
  return {out:out,bad:bad,cards:Object.keys(CARD).length,abil:ABIL.length};
});
r.out.forEach(x=>console.log('  ✓ '+x));
r.bad.forEach(x=>console.log('  ❌ '+x));
console.log('能力 '+r.abil+' 条，卡片 '+r.cards+' 种');
if(errs.length)console.log('❌ JS 报错：'+errs[0]);
console.log(r.bad.length||errs.length?'\n❌ 有走不通的':'\n✅ 每条能力都走得通');
await b.close();process.exit(r.bad.length||errs.length?1:0)})();
