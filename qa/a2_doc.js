/* 对话里跑完的东西要落到项目的知识库，换页回来还在、点得开。
   项目页从「主体 + 右栏」改成「知识库 + 对话」两栏之后，文档的位置也跟着变了：
   现在它和上传的文献、任务产物并排在左边那一栏里，点开在右栏上方展开。
   查的还是同一件事——产出落没落下来、点不点得开。 */
const {chromium}=require('../test-browser.cjs');
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1400,height:1000}});
const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto('file://'+process.argv[2]);await p.waitForTimeout(500);
const R=await p.evaluate(async()=>{
  S.pid='p1';S.sid='t1';CONV.t1=[];go('chat');
  const before=DOCS('p1').length;
  const ta=document.getElementById('ask');ta.value='把这条序列折出来';agentSend();
  /* 卡片是一张一张放出来的，还要先过一段占位——等它真出来，别赌毫秒数 */
  let kgo=null;for(let k=0;k<80&&!kgo;k++){kgo=document.querySelector('[data-kgo]');
    if(!kgo)await new Promise(r=>setTimeout(r,120))}
  kgo.click();
  await new Promise(r=>setTimeout(r,5200));
  const after=DOCS('p1').length;
  go('project');
  S.pjtab='kb';render();
  const side=document.querySelector('.pjx-side-b');
  const cards=side?side.querySelectorAll('[data-docpick]').length:0;
  const first=side?side.querySelector('[data-docpick]'):null;
  if(first)first.click();
  await new Promise(r=>setTimeout(r,160));
  const open=document.querySelector('.pjx-doc');
  return {before:before,after:after,cards:cards,
    打开了:open?open.textContent.replace(/\s+/g,' ').trim().slice(0,60):'没打开'};
});
console.log(`文档数 ${R.before} → ${R.after}　知识库里 ${R.cards} 条`);
console.log('点开：'+R.打开了);
const ok=R.after>R.before&&R.cards>0&&R.打开了!=='没打开';
console.log(ok?'\n✅ 对话产出落到了项目知识库，并且点得开':'\n❌ 没落下来');
console.log('JS 错误:',errs.length?errs.slice(0,2):'无');
if(!ok||errs.length)process.exitCode=1;
await b.close()})();
