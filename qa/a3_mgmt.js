/* 两个管理面：批次/配方看得到、模型训完要登记进去、管理面的按钮把话送进对话。 */
const {chromium}=require('../test-browser.cjs');
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1300,height:1000}});
const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto('file://'+process.argv[2]);await p.waitForTimeout(500);
const R=await p.evaluate(async()=>{
  const o={};
  S.pid='p1';go('lab');
  /* 实验管理改版之后，批次是整块可点的卡，不再是 .krow */
  o.批次=document.querySelectorAll('#view [data-labgo]').length;
  S.ltab='proto';render();
  o.配方=document.querySelectorAll('#view tbody tr').length;S.ltab='wet';render();
  go('mdl');o.模型前=PMODELS('p1').length;
  // 在对话里训一个
  S.sid='m';CONV.m=[];go('chat');
  const ta=document.getElementById('ask');ta.value='用这个项目的实测数据训一个打分模型';agentSend();
  let kgo=null;for(let k=0;k<80&&!kgo;k++){kgo=document.querySelector('[data-kgo]');
    if(!kgo)await new Promise(r=>setTimeout(r,120))}
  kgo.click();
  await new Promise(r=>setTimeout(r,5200));
  o.模型后=PMODELS('p1').length;
  go('mdl');
  /* 模型制备页改版之后，训练任务是一张表，不再是 .krow */
  o.模型面显示=/M-001/.test(document.getElementById('view').textContent);
  /* 管理面的主按钮要能把人带到「发起这件事」的地方。
     训练和建数据集现在各有一张表单页，不再是把一句话塞进对话框。 */
  S.mtab='job';render();
  const btn=document.querySelector('.pg-hd .btn-pri');
  if(btn)btn.click();await new Promise(r=>setTimeout(r,200));
  o.跳到发起页=S.route==='trainnew';
  go('lab');const lb=document.querySelector('.pg-hd .btn-pri');
  if(lb)lb.click();await new Promise(r=>setTimeout(r,200));
  o.跳到发起页=o.跳到发起页&&S.route==='labnew';
  return o;
});
console.log(`批次 ${R.批次} 条　配方 ${R.配方} 个　模型 ${R.模型前} → ${R.模型后}`);
console.log(`模型面列出 M-001：${R.模型面显示}　管理面主按钮进发起页：${R.跳到发起页}`);
const ok=R.批次>0&&R.配方>0&&R.模型后>R.模型前&&R.模型面显示&&R.跳到发起页;
console.log(ok?'\n✅ 两个管理面都通':'\n❌ 有没通的');
console.log('JS 错误:',errs.length?errs.slice(0,2):'无');
if(!ok||errs.length)process.exitCode=1;
await b.close()})();
