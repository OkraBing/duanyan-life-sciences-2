/* 第 13–22 轮 · 空态
   把每一种列表清空再渲染一遍。空态要么给下一步，要么说清为什么空——
   不能只留一张白纸，也不能报错。 */
const {chromium}=require('../test-browser.cjs');
const {blockExternalNetwork}=require('./offline-network.cjs');
(async()=>{
const b=await chromium.launch();const p=await b.newPage({viewport:{width:1440,height:950}});
await blockExternalNetwork(p);
const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto('file://'+process.argv[2]);await p.waitForTimeout(700);
const CASES=[
 ['没有数据集','dsets',()=>{DB.projects.forEach(p=>p.dsets=[]);S.dstab='own'}],
 ['没有资源库','dsets',()=>{DATASRC.forEach(d=>d.wired=0);S.dstab='res'}],
 ['没有模型','mdl',()=>{DB.projects.forEach(p=>p.models=[]);S.mtab='cur'}],
 ['没有训练任务','mdl',()=>{DB.projects.forEach(p=>p.models=[]);S.mtab='job'}],
 ['没有可评测模型','mdl',()=>{DB.projects.forEach(p=>p.models=[]);S.mtab='eval'}],
 ['没有批次','lab',()=>{BATCHES.length=0;S.ltab='wet';S.lflt='all'}],
 ['没有配方','lab',()=>{S.ltab='proto';DB.protos&&(DB.protos.length=0)}],
 ['没有对话','chats',()=>{SESSIONS.length=0}],
 ['没有项目文件','project',()=>{DB.projects.forEach(x=>{x.kb=[];x.arch=[]});TASKS.length=0;S.pjtab='kb'}],
 ['一个工具都没启用','project',()=>{LS.set('enabled',[]);LS.set('dsenabled',[]);S.pjtab='tool'}],
 ['没有工具','shelf',()=>{DB.tools.length=0}],
 ['没有候选','projects',()=>{DB.projects.forEach(x=>{x.cands=[]})}],
];
const bad=[];
for(const [name,route,setup] of CASES){
  await p.evaluate(()=>location.reload?0:0);
  await p.goto('file://'+process.argv[2]).catch(()=>{});
  await p.waitForTimeout(450);
  const r=await p.evaluate(a=>{
    S.pid='p1';S.bind='p1';S.back=[];
    try{ (new Function('return ('+a.fn+')'))()(); }catch(e){return ['setup 挂了：'+e.message]}
    try{go(a.route)}catch(e){return ['THROW: '+e.message]}
    const out=[];const v=document.getElementById('view');
    const tx=v.textContent.replace(/\s+/g,' ').trim();
    if(tx.length<40)out.push('这一屏几乎没字：「'+tx.slice(0,40)+'」');
    /* 空态要有一句说明，最好还有一个下一步 */
    const emp=v.querySelector('.empty,.pjx-empty');
    if(['没有数据集','没有模型','没有训练任务','没有可评测模型'].includes(a.name)&&!emp)
      out.push('清空所有项目后没有显示空态');
    if(emp){
      const t=emp.textContent.replace(/\s+/g,' ').trim();
      if(t.length<6)out.push('空态没说什么：「'+t+'」');
    }
    /* 不能出现 undefined / NaN / [object */
    const junk=tx.match(/undefined|NaN|\[object|null,|,null/g);
    if(junk)out.push('渲染出脏值：'+[...new Set(junk)].join(' '));
    return out;
  },{route,fn:setup.toString(),name});
  if(r.length)bad.push([name,r.join(' / ')]);
}
bad.forEach(x=>console.log('  ✗ ['+x[0]+'] '+x[1]));
if(errs.length)console.log('  JS 报错：'+[...new Set(errs)].slice(0,4).join(' | '));
console.log(bad.length||errs.length?('❌ '+bad.length+' 个空态有问题'):('✅ '+CASES.length+' 个空态都交代清楚了'));
if(bad.length||errs.length)process.exitCode=1;
await b.close()})();
