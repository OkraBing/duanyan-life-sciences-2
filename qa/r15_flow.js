/* R15 · 产物流转：卡片上写「能接到 X」，点下去必须真的接到 X。
   声明（artConsumers/artSinks）与执行（artHandoff/S.feed）是两套代码，
   一致是现在凑巧一致，不是结构保证——所以要逐条点一遍。 */
const {chromium}=require('../test-browser.cjs');
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1440,height:1000}});
const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto('file://'+process.argv[2]);await p.waitForTimeout(400);
const R=await p.evaluate(()=>{
  const bad=[],ok=[];
  // ① 声明的下游节点必须真的 need 这个字段
  Object.keys(ARTS).forEach(f=>{
    artConsumers(f).forEach(c=>{
      const nd=(PIPE[c.cap]||[]).find(n=>n.id===c.nd.id);
      if(!nd){bad.push(['声明的节点不存在',f,c.cap+'.'+c.nd.id]);return}
      if((nd.need||[]).indexOf(f)<0)bad.push(['节点不吃这个字段',f,c.cap+'.'+nd.id+' need='+(nd.need||[]).join(',')]);
      else ok.push(f+' → '+c.cap+'.'+nd.id);
    });
  });
  // ② 每个 PIPE 节点 need 的字段，必须有人能给（上游节点 give、产物、或用户）
  Object.keys(PIPE).forEach(cap=>(PIPE[cap]||[]).forEach(nd=>{
    (nd.need||[]).forEach(f=>{
      if(!ARTS[f]&&fieldSupply(f)!=='user')
        bad.push(['字段没登记也没人给',cap+'.'+nd.id,f]);
    });
  }));
  // ③ 真的接一次：artHandoff(产物对象, 任务号)，feedNote 必须认出来
  S.pid='p1';fixRound();
  const t=TASKS.find(x=>x.pid==='p1'&&x.st==='done'&&artsOf(x).length);
  if(t)artsOf(t).forEach(a=>{
    const cs=artConsumers(a.f);if(!cs.length)return;
    S.feed=null;
    try{artHandoff(a,t.id);
      const html=feedNote(cs[0].cap);
      if(!html)bad.push(['接上了但下游不认',a.f,cs[0].cap]);
      else ok.push('接上 '+a.f+' → '+cs[0].cap);
    }catch(e){bad.push(['接的时候报错',a.f,e.message])}
  });
  // ④ 接好的输入不能跟着跑到别的项目去
  S.pid='p1';fixRound();
  const t2=TASKS.find(x=>x.pid==='p1'&&x.st==='done'&&artsOf(x).length);
  if(t2){const a=artsOf(t2).find(x=>artConsumers(x.f).length);
    if(a){artHandoff(a,t2.id);
      S.pid='p2';fixRound();
      const leak=feedNote(artConsumers(a.f)[0].cap);
      if(leak)bad.push(['接好的输入跟着跑到别的项目',a.f,'在 p2 上仍显示「输入已接上 '+a.name+'」']);
      else ok.push('切项目后输入不串台');
      S.feed=null;S.pid='p1';fixRound();}}
  return {bad,ok};
});
console.log('✓ 对上的 '+R.ok.length+' 条，抽样：');
R.ok.slice(0,6).forEach(x=>console.log('   '+x));
console.log('');
if(R.bad.length){console.log('❌ 对不上 '+R.bad.length+' 处');
  R.bad.forEach(x=>console.log('   '+x.join('　｜　')));process.exitCode=1}
else console.log('✅ 声明的下游与真正接得上的一致');
console.log('JS 错误:',errs.length?errs:'无');
await b.close()})();
