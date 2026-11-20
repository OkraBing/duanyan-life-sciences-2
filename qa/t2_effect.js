/* 第 2 轮 · 今天新加的控件，到底有没有改变「最后被创建出来的那个东西」
   控件变了、界面变了，但提交出去的任务没变——这是最像做完了的没做完。 */
const {chromium}=require('../test-browser.cjs');
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1440,height:1000}});
const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto('file://'+process.argv[2]);await p.waitForTimeout(500);
const bad=[];const say=(ok,m)=>{console.log((ok?'  ✅ ':'  ❌ ')+m);if(!ok)bad.push(m)};

console.log('\n① 结构预测：换模型之后，发起出来的任务记的是不是那个模型');
let r=await p.evaluate(()=>{
  S.pid='p1';go('models');PF.seqs[0].seq='MVLSPADKTNVKAAWGKVGAHAGEYGAEALERMFLSFPTTK';
  setPick('str','fold','ESMFold');PF.model='ESMFold';render();
  const n0=TASKS.length;act('qkpred');
  const t=TASKS[0];
  return {n0,n1:TASKS.length,cap:t&&t.cap,params:t&&t.params,inTx:t&&t.in};
});
say(r.n1===r.n0+1,'发起预测真的建了一个任务');
const mdl=(r.params||[]).find(x=>x[0]==='模型');
say(!!mdl&&mdl[1]==='ESMFold','任务参数里的模型 = ESMFold（实际 '+(mdl?mdl[1]:'没有「模型」这一项')+'）');

console.log('\n② 蛋白质设计：换模式之后，发起出来的任务记的是不是那个条数');
r=await p.evaluate(()=>{
  S.pid='p1';go('design');DF.acc='1BRS';VW.sel=new Set([27,59]);
  DF.mode='preview';DF.n=dfModeN('preview');render();
  const want=dfN();act('qkdes');
  const t=TASKS[0];
  return {want,cap:t&&t.cap,inTx:t&&t.in,out:t&&t.out,params:t&&t.params};
});
console.log('   期望条数',r.want,'｜任务 in =',r.inTx);
say(String(r.inTx||'').indexOf(String(r.want))>=0,'任务的输入描述里带着这一次的条数');

console.log('\n③ 输入框里挂的工具，提交时有没有真的带走');
r=await p.evaluate(()=>{
  go('home');S.ask='把这批候选送检';S.askTools=['MSA 构建'];render();
  let body=null;const old=MC.chat;MC.chat=(ms,o)=>{body=ms[1].content;return Promise.resolve({text:'{}'})};
  act('plan');MC.chat=old;return {body};
});
say(/MSA 构建/.test(r.body||''),'请求正文里带着 MSA 构建');

console.log('\n④ 换模型之后，高级参数里不适用的字段会不会跟着收起来');
r=await p.evaluate(()=>{
  go('models');S.advOpen={str:1};
  setPick('str','fold','ESMFold');PF.model='ESMFold';render();
  const a=[...document.querySelectorAll('#view [data-advf]')].map(e=>e.dataset.advf);
  const msa1=!!document.querySelector('#view [data-advmsa]');
  setPick('str','fold','Protenix');PF.model='Protenix';render();
  const bb=[...document.querySelectorAll('#view [data-advf]')].map(e=>e.dataset.advf);
  const msa2=!!document.querySelector('#view [data-advmsa]');
  return {esm:a,esmMsa:msa1,pro:bb,proMsa:msa2};
});
console.log('   ESMFold:',r.esm.join(','),'MSA 开关',r.esmMsa,'｜Protenix:',r.pro.join(','),'MSA 开关',r.proMsa);
say(r.esm.indexOf('pf.diff')<0&&r.pro.indexOf('pf.diff')>=0,'扩散步数只在支持扩散的模型下出现');
say(r.esmMsa===false&&r.proMsa===true,'MSA 开关只在用 MSA 的模型下出现');

console.log('\n⑤ 任务卡上的下载，打的是不是这个任务的产物');
r=await p.evaluate(()=>{
  const t=TASKS.find(x=>x.st==='done'&&artsOf(x).length);
  const A=artsOf(t);return {tid:t.id,names:A.map(a=>a.name),n:A.length}});
console.log('   ',r.tid,'→',r.names.join('、'));
say(r.names.every(n=>n.indexOf(r.tid.replace('-','_'))>=0||n.indexOf(r.tid)>=0),'产物文件名都带着这个任务号');

console.log('\nJS 错误:',errs.length?errs:'无');
console.log(bad.length?'\n❌ '+bad.length+' 处没做到':'\n✅ 新控件都改变了最终产物');
await b.close()})();
