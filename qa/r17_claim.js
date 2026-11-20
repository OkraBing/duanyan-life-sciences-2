/* R17 · 界面上写出来的算式，当场验一遍。
   「96 孔 − 8 对照 = 88 孔位」这种句子最危险：它看起来像推导，
   所以读的人不会怀疑，而它只要有一个数来自别处就会错，并且永远不报错。 */
const {chromium}=require('../test-browser.cjs');
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1440,height:1000}});
const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto('file://'+process.argv[2]);await p.waitForTimeout(400);
const R=await p.evaluate(()=>{
  const bad=[],ok=[];
  // ① 全站扫「a − b = c」「a ÷ b = c」「(a − b) ÷ c」这类写在界面上的算式
  const seen=new Set();
  DB.projects.forEach(pr=>{S.pid=pr.id;fixRound();
    Object.keys(V).forEach(rt=>{
      try{go('home');go(rt)}catch(e){return}
      const t=document.getElementById('view').innerText.replace(/\s+/g,' ');
      [...t.matchAll(/(\d[\d,]*)\s*孔\s*−\s*(\d[\d,]*)\s*对照\s*=\s*(\d[\d,]*)\s*孔位/g)]
        .forEach(m=>{const k='plate'+m[0];if(seen.has(k))return;seen.add(k);
          const a=+m[1],c=+m[2],d=+m[3];
          if(a-c!==d)bad.push([pr.id+'/'+rt,'板位算式',m[0],a+'−'+c+'≠'+d]);
          else if(a!==plateOf().fmt||c!==plateOf().ctrl)
            bad.push([pr.id+'/'+rt,'板位算式用的不是本项目的板',m[0],'本项目='+plateOf().fmt+'/'+plateOf().ctrl]);
          else ok.push(pr.id+' 板位算式 '+m[0]);});
      [...t.matchAll(/\((\d[\d,]*)\s*−\s*(\d[\d,]*)\)\s*÷\s*(\d+)/g)]
        .forEach(m=>{const k='div'+m[0];if(seen.has(k))return;seen.add(k);
          const v=Math.floor((+m[1]-+m[2])/+m[3]);
          if(v!==plateCap())bad.push([pr.id+'/'+rt,'容量算式',m[0],'算得 '+v+'，plateCap()='+plateCap()]);
          else ok.push(pr.id+' 容量算式 '+m[0]);});
      [...t.matchAll(/(\d[\d,]*)\s*条候选里\s*(\d[\d,]*)\s*条过闸门（(\d+)%）/g)]
        .forEach(m=>{const k='gate'+m[0]+pr.id;if(seen.has(k))return;seen.add(k);
          const g=gateRate();
          if(!g){bad.push([pr.id+'/'+rt,'说了通过率但算不出',m[0],'gateRate()=null']);return}
          if(+m[1]!==g.n||+m[2]!==g.pass||Math.round(g.r*100)!==+m[3])
            bad.push([pr.id+'/'+rt,'闸门算式',m[0],'真值 '+g.n+'/'+g.pass+'/'+Math.round(g.r*100)+'%']);
          else ok.push(pr.id+' 闸门算式 '+m[0]);});
    });
  });
  /* 原先这里验「打包这 N 个」按钮承诺的数和真能打的份数一致。
     那颗按钮已经从文件管理页去掉了，断言跟着去掉——
     留着它只会让探针去找一个不该存在的东西。 */
  /* 任务卡上「打包下载 N 个产物」的提示，N 要和真有的份数一致。
     （t 原先在上面那段已删的代码里取，这里自己取一个带产物的已完成任务。） */
  const t=TASKS.find(x=>x.st==='done'&&artsOf(x).length);
  if(t){const n=(dlTitle(t).match(/打包下载\s*(\d+)\s*个/)||[])[1];
    if(+n!==artsOf(t).length)bad.push(['task','下载提示数对不上',dlTitle(t).slice(0,40),'真有 '+artsOf(t).length]);
    else ok.push('下载提示 '+n+' 个，真有 '+artsOf(t).length+' 个');}
  return {bad,ok};
});
R.ok.slice(0,10).forEach(x=>console.log('   ✓ '+x));
console.log('   …共验证 '+R.ok.length+' 条');
console.log('');
if(R.bad.length){console.log('❌ 对不上 '+R.bad.length+' 处');
  R.bad.forEach(x=>console.log('   '+x.join('　｜　')));process.exitCode=1}
else console.log('✅ 界面上写出来的算式与承诺，全部当场验过');
console.log('JS 错误:',errs.length?errs:'无');
await b.close()})();
