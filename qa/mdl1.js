// 模型制备：五个 tab 能跑通一条 bootcamp 式的路
const {chromium}=require('../test-browser.cjs');
const {blockExternalNetwork}=require('../review/offline-network.cjs');
(async()=>{
const b=await chromium.launch();const p=await b.newPage({viewport:{width:1360,height:900}});
await blockExternalNetwork(p);
const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto('file://'+process.argv[2]);await p.waitForTimeout(400);
let bad=0;const ck=(c,m)=>{console.log((c?'  ok  ':'  ✗   ')+m);if(!c)bad++};

await p.evaluate(()=>{location.hash='#mdl'});await p.waitForTimeout(400);
const tabs=await p.$$eval('[data-mtab]',e=>e.map(x=>x.textContent.replace(/\s+/g,' ').trim()));
const tabIds=await p.$$eval('[data-mtab]',e=>e.map(x=>x.dataset.mtab));
ck(JSON.stringify(tabIds)===JSON.stringify(['cur','base','job','eval','set']),'五个 tab：'+tabs.join(' / '));

for(const [k,n,act] of [['cur','我的模型',null],['base','基础模型',null],
                        ['job','模型训练','新建训练任务'],['eval','模型评测',null],
                        ['set','模型接入',null]]){
  await p.click(`[data-mtab="${k}"]`);await p.waitForTimeout(260);
  const r=await p.evaluate(()=>{
    const pr=document.querySelector('.pg-hd .btn-pri');
    return {on:(document.querySelector('[data-mtab].is-on')||{}).dataset_||'',
      onk:document.querySelector('[data-mtab].is-on').dataset.mtab,
      act:pr?pr.textContent.trim():null,
      secs:[...document.querySelectorAll('.page>section .card-h strong')].map(x=>x.textContent.trim()),
      h:document.querySelector('.page').scrollHeight}});
  ck(r.onk===k,n+' 选中');
  ck(r.act===act,n+' 右上角动作 '+(r.act===null?'（无）':r.act)+(act===r.act?'':'  该是 '+act));
  ck(r.h>200,n+' 有内容（'+r.h+'px）');
  console.log('        区块：'+r.secs.join(' | '));
}
// 训一个模型，看三张表是不是都跟着变
/* 训练改成在表单页发起 */
const n0=await p.evaluate(()=>PMODELS().length);
await p.evaluate(()=>{S.mtab='job';location.hash='#mdl';render()});await p.waitForTimeout(350);
await p.click('.pg-hd .btn-pri');await p.waitForTimeout(400);
ck(await p.evaluate(()=>S.route)==='trainnew','新建训练任务进的是表单页');
await p.fill('#trname','回归测试用的打分器');await p.waitForTimeout(200);
const opts=await p.evaluate(()=>[...document.querySelectorAll('#trtgt option')].map(o=>o.value).filter(Boolean));
if(opts.length)await p.selectOption('#trtgt',opts[0]);
await p.waitForTimeout(300);
await p.click('[data-act="trgo"]');await p.waitForTimeout(900);
const n=await p.evaluate(()=>PMODELS().length);
ck(n>n0,'训练任务记录 '+n0+' → '+n+' 条');
const m=await p.evaluate(()=>{const x=PMODELS()[0];
  return {id:x.id,pid:S.pid,ms:x.ms,base:x.base,method:x.method,w:x.w?x.w.length:null,st:x.st,bl:(x.bl||[]).length}});
console.log('        最新：',JSON.stringify(m));
ck(typeof m.ms==='number'&&m.ms>=0,'用时是量出来的 '+m.ms+' ms');
ck(!!m.base&&!!m.method,'基础模型/训练方法记下来了');
ck(m.st!=='failed'?m.bl>0:true,'基线存下来了');
const rep=await p.evaluate(()=>mdlReport(PMODELS().find(x=>x.st!=='failed')||PMODELS()[0]));
ck(rep.indexOf('留出集评测报告')>=0&&rep.indexOf('和基线比')>=0,'报告有正文（'+rep.length+' 字）');
await p.evaluate(()=>{location.hash='#mdl'});await p.waitForTimeout(400);
for(const k of ['cur','job','eval']){
  await p.click(`[data-mtab="${k}"]`);await p.waitForTimeout(240);
  const row=await p.evaluate(({id,pid})=>{
    const tr=[...document.querySelectorAll('.page tbody tr')].find(e=>e.textContent.includes(id));
    return {found:!!tr,project:!!tr?.querySelector('[data-proj="'+pid+'"]')};
  },m);
  ck(row.found,k+' 里能看到刚训的模型 '+m.id);
  ck(row.project,k+' 的模型关联正确项目 '+m.pid);
}
ck(!errs.length,'无 JS 报错'+(errs.length?'：'+errs[0]:''));
console.log(bad?'\n✗ '+bad+' 处不对':'\n✅ 模型制备全通');
await p.screenshot({path:require('../test-browser.cjs').testOutput('mdl.png')});
await b.close();process.exit(bad?1:0)})();
