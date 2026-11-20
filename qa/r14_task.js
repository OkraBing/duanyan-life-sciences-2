/* R14 · 任务记录自洽：一条任务记录里的数不能互相打架。
   研究员看任务详情是为了回答「这一次到底跑了什么、得到了什么」，
   输入说 110 残基、参数说 141、输出说残基 480–488，三句话不可能同时为真。 */
const {chromium}=require('../test-browser.cjs');
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1440,height:1000}});
await p.goto('file://'+process.argv[2]);await p.waitForTimeout(400);
const bad=await p.evaluate(()=>{
  const out=[];
  const nums=s=>[...String(s).matchAll(/(\d[\d,]*)\s*(aa|个残基|残基|条)/g)]
    .map(m=>[+m[1].replace(/,/g,''),m[2]]);
  TASKS.forEach(t=>{
    const all=[['in',t.in]].concat((t.params||[]).map(x=>['params:'+x[0],x[1]]))
      .concat((t.out2||[]).map(x=>['out2:'+x[0],x[1]]));
    // ① 残基数：同一条任务里出现的不同残基总数
    const lens=new Set();
    all.forEach(([k,v])=>nums(v).forEach(([n,u])=>{
      if(u==='aa'||u==='个残基')lens.add(n);
      if(/\//.test(String(v))){const m=String(v).match(/\/\s*(\d+)/);if(m)lens.add(+m[1])}
    }));
    /* 多链任务里「110 + 89 = 199」本来就该共存：
       某一个数等于其余之和时，算自洽，不算打架。 */
    const A=[...lens].sort((x,y)=>y-x);
    const sums=A.length>2&&A[0]===A.slice(1).reduce((a,b)=>a+b,0);
    if(lens.size>1&&!sums)out.push([t.id,'残基总数对不上',[...lens].join(' vs '),
      all.filter(([k,v])=>/aa|残基/.test(String(v))).map(x=>x[0]+'='+x[1]).join('　')]);
    // ② 残基编号不能超过链长
    const L=Math.max(...[...lens].filter(x=>x>0));  // 多链时按总长判越界
    all.forEach(([k,v])=>{
      const m=String(v).match(/残基\s*(\d+)\s*[–\-~]\s*(\d+)/);
      if(m&&isFinite(L)&&(+m[2]>L))out.push([t.id,'残基编号越界',k+'='+v,'链长只有 '+L]);
    });
  });
  return out;
});
if(bad.length){console.log('❌ 自相矛盾 '+bad.length+' 处');
  bad.forEach(x=>console.log('   '+x[0]+'　'+x[1]+'　｜　'+x[2]+'　｜　'+x[3]));process.exitCode=1}
else console.log('✅ 任务记录自洽');
await b.close()})();
