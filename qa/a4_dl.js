/* 产出物要真能下：每条能力跑完之后，登记的产出必须能算出非空内容，
   而且要出现在输入框上方的产出条里。只有登记没有内容的，按钮必须是灰的。 */
const {chromium}=require('../test-browser.cjs');
const CASES=[['检索和这条序列同源的条目','seek'],['把这条序列折出来看看置信度','str'],
  ['在这个界面上设计一批结合蛋白','des'],['把这批候选送去测亲和力','lab'],
  ['用这个项目的实测数据训一个打分模型','train']];
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1280,height:1000}});
const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto('file://'+process.argv[2]);await p.waitForTimeout(500);
let bad=0;
for(const [say,cap] of CASES){
  const r=await p.evaluate(async(say)=>{
    S.sid='t'+Math.random();CONV[S.sid]=[];S.pid='p1';S.outOpen=true;go('chat');
    const ta=document.getElementById('ask');ta.value=say;agentSend();
    /* 等表单真的出来再点，不要赌一个毫秒数 */
    for(let k=0;k<60&&!document.querySelector('[data-kgo]');k++)
      await new Promise(r=>setTimeout(r,150));
    const f=document.querySelector('[data-kgo]');if(f){f.click();await new Promise(r=>setTimeout(r,5200))}
    /* 1. 会话产出 */
    const docs=convDocs().map(d=>{
      let n=-1,err=null;
      try{n=typeof d.make==='function'?String(d.make()).length:-1}catch(e){err=e.message}
      return {name:d.name,bytes:n,err:err};
    });
    /* 2. 运行卡上挂的产物必须就是登记本身：同一个对象，不是另抄一份 */
    const arts=[],strayed=[];const reg=convDocs();
    convOf().forEach(m=>(m.cards||[]).forEach(c=>(c.arts||[]).forEach(a=>{
      if(reg.indexOf(a)<0)strayed.push(a.name);
      arts.push(a.name)})));
    /* 3. 产出条在不在，下载钮灰不灰 */
    const strip=!!document.querySelector('.outbar-b');
    const btns=[...document.querySelectorAll('.outbar-l [data-docdl]')]
      .map(b=>({on:!b.disabled}));
    return {docs:docs,arts:arts,strayed:strayed,strip:strip,btns:btns};
  },say);
  const dead=r.docs.filter(x=>x.err||x.bytes<=0);
  const stripOk=r.strip&&r.btns.length===r.docs.length&&r.btns.every(b=>b.on);
  const ok=r.docs.length>0&&!dead.length&&stripOk&&!r.strayed.length
    &&r.arts.length===r.docs.length;
  if(!ok)bad++;
  console.log(`${ok?'  ✓':'  ❌'} ${cap}　产出 ${r.docs.length} 件：`
    +r.docs.map(x=>x.name+'('+(x.err?'报错 '+x.err:x.bytes+'B')+')').join('　')
    +(stripOk?'':`\n      产出条：${r.strip?'在':'没出来'}　下载钮 ${r.btns.filter(b=>b.on).length}/${r.btns.length} 可点，产出 ${r.docs.length} 条`)
    +(r.strayed.length?`\n      运行卡上这几件没进登记：${r.strayed.join('、')}`:'')
    +(r.arts.length===r.docs.length?'':`\n      运行卡 ${r.arts.length} 件 vs 登记 ${r.docs.length} 件，对不上`));
}
console.log(bad?`\n❌ ${bad} 条能力的产出下不了`:'\n✅ 五条能力的产出都能算出内容，产出条也在');
console.log('JS 错误:',errs.length?errs.slice(0,3):'无');
if(bad||errs.length)process.exitCode=1;
await b.close()})();
