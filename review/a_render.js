/* 第 1–12 轮 · 渲染 × 页签 × 筛选 × 空态
   把每个视图的每一种内部状态都走一遍：页签、筛选标签、选中项、有数据 / 没数据。
   查四件事：报错、内容为空、按钮点不动（没有绑定）、aria 对不上。 */
const {chromium}=require('../test-browser.cjs');
const {blockExternalNetwork}=require('./offline-network.cjs');
const P=process.argv[2];
const STATES=[];
['p1','p2','p3'].forEach(pid=>{
  ['chat','chats','projects','project','labnew','dsnew','trainnew','shelf','data','labdet'].forEach(v=>
    STATES.push({pid,v}));
  [['mdl','mtab',['cur','base','job','eval','set']],
   ['lab','ltab',['wet','proto']],
   ['dsets','dstab',['own','res']],
   ['project','pjtab',['kb','tool']]].forEach(([v,k,ks])=>
    ks.forEach(t=>STATES.push({pid,v,k,t})));
  [['lab','lflt',['all','run','past']]].forEach(([v,k,ks])=>
    ks.forEach(t=>STATES.push({pid,v,k,t,extra:{ltab:'wet'}})));
});
(async()=>{
const b=await chromium.launch();
const p=await b.newPage({viewport:{width:1440,height:950}});
await blockExternalNetwork(p);
const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto('file://'+P);await p.waitForTimeout(700);
const bad=[];
for(const st of STATES){
  const r=await p.evaluate(o=>{
    S.pid=o.pid;S.bind=o.pid;S.back=[];
    if(o.extra)Object.assign(S,o.extra);
    if(o.k)S[o.k]=o.t;
    try{go(o.v)}catch(e){return ['THROW go: '+e.message]}
    const out=[];
    const v=document.getElementById('view');
    if(!v||v.innerHTML.length<200)out.push('内容为空');
    /* 死控件：有 data-* 动作名但一个 onclick 都没挂上的 */
    const dead=[...v.querySelectorAll('button,[role="button"]')].filter(e=>{
      if(e.onclick||e.onkeydown)return false;
      if(e.closest('form'))return false;
      if(e.type==='submit')return false;
      const has=[...e.attributes].some(a=>/^data-/.test(a.name));
      return has;
    }).map(e=>(e.className||'').toString().split(' ')[0]+'['+
      ([...e.attributes].find(a=>/^data-/.test(a.name))||{}).name+']');
    if(dead.length)out.push('点不动：'+[...new Set(dead)].slice(0,3).join(' '));
    /* 空的可点元素（没文字也没 aria-label） */
    const mute=[...v.querySelectorAll('button,[role="button"]')].filter(e=>
      !e.textContent.trim()&&!e.getAttribute('aria-label')&&!e.getAttribute('title')
      &&e.getBoundingClientRect().width>0).length;
    if(mute)out.push('没有名字的按钮 ×'+mute);
    /* 页签选中态：必须正好一个 */
    const tabs=v.querySelectorAll('.tab,[role="tab"]');
    if(tabs.length){const on=[...tabs].filter(e=>e.classList.contains('is-on')
      ||e.getAttribute('aria-selected')==='true').length;
      if(on!==1)out.push('页签选中态 '+on+' 个');}
    return out;
  },st);
  if(r.length)bad.push([JSON.stringify(st),r.join(' / ')]);
}
bad.forEach(x=>console.log('  ✗ '+x[0]+'  '+x[1]));
if(errs.length)console.log('  JS 报错：'+[...new Set(errs)].join(' | '));
console.log(bad.length||errs.length?('❌ '+bad.length+' 个状态有问题'):('✅ '+STATES.length+' 个状态全部干净'));
if(bad.length||errs.length)process.exitCode=1;
await b.close()})();
