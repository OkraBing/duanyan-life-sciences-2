/* 产出必须落进「跑它的那个项目」，不能落到别处。
   这条不变量曾经栽在一个运算符优先级上：x.id===(from&&from.pid)||S.pid
   被读成 (x.id===from.pid)||S.pid，S.pid 恒真，find 永远返回第一个项目。
   改造成 Agent 之后「存入项目」这个按钮没有了——产出是跑完就自动登记的，
   所以同一条不变量改在这儿守：在哪个项目里跑，就只能写进哪个项目。 */
const {chromium}=require('../test-browser.cjs');
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1280,height:900}});
const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto('file://'+process.argv[2]);await p.waitForTimeout(400);
let bad=0;const say=(ok,m)=>{if(!ok)bad++;console.log((ok?'  ✓ ':'  ❌ ')+m)};

const CASES=[['检索和这条序列同源的条目','seek'],['在这个界面上设计一批结合蛋白','des'],
  ['把这批候选送去测亲和力','lab']];
for(const pid of ['p1','p2','p3']){
  for(const [say2,cap] of CASES){
    const r=await p.evaluate(async([pid,s])=>{
      DB.projects.forEach(x=>{x.docs=[]});
      S.sid='a'+Math.random();CONV[S.sid]=[];S.pid=pid;go('chat');
      document.getElementById('ask').value=s;agentSend();
      for(let k=0;k<90&&!document.querySelector('[data-kgo]');k++)
        await new Promise(r=>setTimeout(r,120));
      const g=document.querySelector('[data-kgo]');
      if(g){g.click();await new Promise(r=>setTimeout(r,5600))}
      /* 哪些项目被写进了东西 */
      const landed=DB.projects.filter(x=>(x.docs||[]).length).map(x=>x.id);
      const names=(DB.projects.find(x=>x.id===pid).docs||[]).map(d=>d.name);
      /* 运行卡上挂的产物，必须就是这个项目的登记本身 */
      const reg=DOCS(pid);
      let strayed=0;
      convOf().forEach(m=>(m.cards||[]).forEach(c=>(c.arts||[]).forEach(a=>{
        if(reg.indexOf(a)<0)strayed++})));
      return {landed:landed,n:names.length,strayed:strayed};
    },[pid,say2]);
    const ok=r.n>0&&r.landed.length===1&&r.landed[0]===pid&&r.strayed===0;
    say(ok,`${pid} 里跑 ${cap}：产出 ${r.n} 件，落在 ${r.landed.join('、')||'（没落下）'}`
      +(r.strayed?`，运行卡上有 ${r.strayed} 件没进登记`:''));
  }
}
console.log(bad?`\n❌ ${bad} 次写错了项目`:'\n✅ 产出只落进跑它的那个项目');
console.log('JS 错误:',errs.length?errs.slice(0,3):'无');
if(bad||errs.length)process.exitCode=1;
await b.close()})();
