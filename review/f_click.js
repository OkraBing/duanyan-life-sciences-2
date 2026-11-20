/* 第 61–70 轮 · 把能点的都点一遍
   每个视图里逐个点可见控件，点完查：有没有抛错、页面有没有变空、
   路由有没有跑到一个不存在的页、有没有弹窗关不掉。
   点完一个就复位，免得前一个的后果算到后一个头上。 */
const {chromium}=require('../test-browser.cjs');
const {blockExternalNetwork}=require('./offline-network.cjs');
const V=['chat','chats','projects','project','lab','labdet','labnew','dsets','dsnew','mdl','trainnew','shelf','data','set'];
(async()=>{
const b=await chromium.launch();const p=await b.newPage({viewport:{width:1440,height:950}});
await blockExternalNetwork(p);
let errs=[];p.on('pageerror',e=>errs.push(e.message));
p.on('dialog',d=>d.dismiss().catch(()=>{}));
await p.goto('file://'+process.argv[2]);await p.waitForTimeout(700);
const bad=[];let n=0;
for(const v of V){
  const total=await p.evaluate(a=>{S.pid='p1';S.bind='p1';S.round=5;S.back=[];go(a);
    return document.querySelectorAll('#view button:not(:disabled),#view [role="button"]').length},v);
  for(let i=0;i<Math.min(total,40);i++){
    errs=[];
    const r=await p.evaluate(async a=>{
      S.pid='p1';S.bind='p1';S.round=5;S.back=[];S.sid='probe';CONV.probe=[];
      try{go(a.v)}catch(e){return ['go 抛错 '+e.message]}
      const L=[...document.querySelectorAll('#view button:not(:disabled),#view [role="button"]')];
      const el=L[a.i];if(!el)return [];
      const label=(el.getAttribute('aria-label')||el.textContent.trim()||el.className).slice(0,16);
      const r0=el.getBoundingClientRect();
      if(r0.width<1||r0.height<1)return [];
      try{el.click()}catch(e){return ['点「'+label+'」抛错：'+e.message]}
      await new Promise(r=>setTimeout(r,60));
      const out=[];
      const view=document.getElementById('view');
      if(!view||view.innerHTML.length<150)out.push('点「'+label+'」之后这一屏空了');
      if(!V[ROUTE_HOME(S.route)])out.push('点「'+label+'」跑到了不存在的路由 '+S.route);
      /* 弹窗开了要能关 */
      const d=document.getElementById('dlg');
      if(d&&d.open){const c=d.querySelector('[value="cancel"],[value="ok"]');
        if(!c)out.push('点「'+label+'」开了一个关不掉的弹窗');else c.click();}
      closeMenu&&closeMenu();
      return out;},{v,i});
    n++;
    if(r.length)bad.push([v,r.join(' / ')]);
    if(errs.length)bad.push([v,'JS 报错：'+[...new Set(errs)].join(' | ')]);
  }
}
const seen={};const uniq=[];
bad.forEach(x=>{const k=x[0]+x[1];if(seen[k])return;seen[k]=1;uniq.push(x)});
uniq.forEach(x=>console.log('  ✗ ['+x[0]+'] '+x[1]));
console.log(uniq.length?('❌ '+uniq.length+' 处（点了 '+n+' 下）'):('✅ 点了 '+n+' 下，没有抛错、没有空屏、没有坏路由'));
if(uniq.length)process.exitCode=1;
await b.close()})();
