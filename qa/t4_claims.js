/* 第 4 轮 · 界面上写的断言，和代码真做的事对不对得上
   「打包这 21 个」如果打出来 19 个，没人会发现，但它是个谎。 */
const {chromium}=require('../test-browser.cjs');
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1440,height:1000}});
const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto('file://'+process.argv[2]);await p.waitForTimeout(500);
const bad=[];const say=(ok,m,d)=>{console.log((ok?'  ✅ ':'  ❌ ')+m+(d?'　'+d:''));if(!ok)bad.push(m)};

console.log('\n① 「打包这 N 个」打出来的真是 N 个吗');
let r=await p.evaluate(()=>{
  S.ft=S.fp=S.fx='全部';S.fq='';go('files');
  const btn=document.querySelector('#view [data-act="fzip"]');
  const claim=btn?+(btn.textContent.match(/\d+/)||[0])[0]:null;
  const L=filesNow(), real=L.filter(x=>x.kind==='art'||x.kind==='arch').length;
  return {claim,real,total:L.length}});
say(r.claim===r.real,'按钮上的数 = 真能打出来的数','说 '+r.claim+'，实际 '+r.real+'（筛出 '+r.total+'）');

console.log('\n② 「按本项目 N 个同类任务的耗时中位数」里的 N 对不对');
r=await p.evaluate(()=>{
  const out={};['str','des'].forEach(c=>{
    S.pid='p1';const H=histRun(c);
    const real=TASKS.filter(t=>t.cap===c&&t.st==='done'&&t.pid==='p1'&&tookMin(t.took)!=null).length;
    go({str:'models',des:'design'}[c]);
    const el=[...document.querySelectorAll('#view .t-sm')].find(e=>/同类任务/.test(e.textContent));
    out[c]={claim:el?(el.textContent.match(/(\d+) 个同类/)||[0,H.n===1?1:null])[1]:null,
      n:H.n,real,txt:el?el.textContent.replace(/\s+/g,' '):null};
  });return out});
Object.keys(r).forEach(c=>{const x=r[c];
  say(x.n===x.real,c+' 口径里的任务数算对了','histRun '+x.n+' / 实际 '+x.real+'　「'+(x.txt||'').slice(0,60)+'」')});

console.log('\n③ 板位算式写的和算出来的一致吗');
r=await p.evaluate(()=>({note:plateNote(),cap:plateCap(),wells:plateWells(),reps:repsNow(),fmt:plateOf().fmt,ctrl:plateOf().ctrl}));
say(r.wells===r.fmt-r.ctrl&&r.cap===Math.floor(r.wells/r.reps),
  '板位：'+r.note+' → '+r.cap+' 条','（'+r.fmt+'−'+r.ctrl+')÷'+r.reps+'='+Math.floor(r.wells/r.reps));

console.log('\n④ 周转天数：写出来的中位数与区间，和批次流水算出来的一致吗');
r=await p.evaluate(()=>{S.pid='p1';const t=turnaround('p1');
  const done=BATCHES.filter(b=>b.pid==='p1'&&batchSpanDays(b)!=null).map(b=>batchSpanDays(b)).sort((a,b)=>a-b);
  return {t,done}});
console.log('   走完的批次天数',JSON.stringify(r.done),'｜turnaround',JSON.stringify(r.t));
say(!!r.t&&r.done.length>0&&r.t.n===r.done.length,'只数走完的批次','n='+(r.t&&r.t.n));

console.log('\n⑤ 同一个动作有没有两种叫法');
r=await p.evaluate(()=>{
  const src=document.documentElement.innerHTML;
  const pairs=[['清空筛选','清除筛选'],['复制被拒绝','复制被浏览器拒绝']];
  return pairs.map(([a,bb])=>({a,b:bb,
    na:(src.match(new RegExp(a,'g'))||[]).length,nb:(src.match(new RegExp(bb,'g'))||[]).length}))});
r.forEach(x=>say(!(x.na&&x.nb),'「'+x.a+'」与「'+x.b+'」不并存',x.na+' / '+x.nb));

console.log('\nJS 错误:',errs.length?errs:'无');
console.log(bad.length?'\n❌ '+bad.length+' 处':'\n✅ 断言与行为一致');
await b.close()})();
