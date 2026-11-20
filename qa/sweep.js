/* 用例一：可点击性全扫。
   判定「点下去真的发生了事」= 换页 / 开弹窗 / 开菜单 / 出 toast / 视图 DOM 变了 / 全局状态变了。
   只看有没有 data-act 处理函数不够——处理了但什么都没改，用户看到的就是点不动。 */
const {chromium}=require('../test-browser.cjs');
(async()=>{
 const b=await chromium.launch(),pg=await b.newPage({viewport:{width:1440,height:900}});
 const errs=[];pg.on('pageerror',e=>errs.push('['+e.message.slice(0,80)+']'));
 await pg.goto('file://'+process.argv[2]);await pg.waitForTimeout(500);

 await pg.evaluate(()=>{
  window.__snap=()=>{const v=document.getElementById('view');
   const h=s=>{let x=0;for(let i=0;i<s.length;i++)x=(x*31+s.charCodeAt(i))|0;return x};
   return {r:S.route,p:S.pid,rd:S.round,t:S.tid,
     dom:h(v.innerHTML),dlg:!!(document.getElementById('dlg')||{}).open,
     menu:!!document.querySelector('.menu'),toast:document.querySelectorAll('.toast').length,
     st:h(JSON.stringify([S.ptab,S.ptab2,S.cf,S.pf,S.dcap,S.shcap,S.shin,S.use,S.group,
       S.sel?S.sel.size:0,S.detail,S.gate,S.collapsed,S.capPick,S.dsid,S.toolN,S.ibf,S.jpf,
       JOBV,SK.mode,SK.phase,SK.fPct,SK.fAln,SK.fSrc,SK.open,SK.sort,AD.tab,
       PF.model,PF.samples,PF.recycle,PF.diff,PF.seqs.length,DF.mode,DF.blen,DF.hot,
       msaOf().mode,ENABLED().length,TASKS.length,DB.projects.length,
       (typeof TGOV==='function')?JSON.stringify(TGOV()):0]))};};
 });
 const ROUTES=await pg.evaluate(()=>Object.keys(V));
 const SUB={models:['launch','new','history'],design:['launch','new','history','assets','sites'],
   wet:['launch','history'],};
 const reset=async(r,s)=>{
   await pg.evaluate(()=>{const d=document.getElementById('dlg');if(d&&d.open)d.close();
     try{closeMenu()}catch(e){}});
   await pg.evaluate(([x,ss])=>{location.hash='#'+x;if(ss)JOBV[x]=ss;S.sel=S.sel||new Set();render()},[r,s]);
   await pg.waitForTimeout(80);
 };
 const rows=[];const seen=new Set();let id=0;
 for(const r of ROUTES) for(const sub of (SUB[r]||[null])){
   await reset(r,sub);
   const n=await pg.evaluate(()=>document.querySelectorAll(
     '#view button:not([disabled]),#view [role="button"]:not([disabled])').length);
   for(let i=0;i<Math.min(n,60);i++){
     const out=await pg.evaluate(i=>new Promise(res=>{
       const v=document.getElementById('view');
       const B=[...v.querySelectorAll('button:not([disabled]),[role="button"]:not([disabled])')];
       const el=B[i];if(!el)return res(null);
       const key=(el.dataset&&Object.keys(el.dataset).length
         ?Object.entries(el.dataset).map(([k,x])=>k+'='+x).join(',')
         :(el.className||'').toString()).slice(0,60);
       const label=(el.innerText||el.getAttribute('aria-label')||el.title||'?')
         .trim().replace(/\s+/g,' ').slice(0,22);
       /* 两类控件点下去本来就不该有 DOM 变化，不是死按钮：
            · 文件选择：点开的是浏览器原生对话框，页面里看不见
            · 已经选中的那一项：再点一次就是它自己，分段控件本来如此 */
       const act=(el.dataset||{}).act||'';
       if(['askfile','pfup','vwpick','kbadd'].indexOf(act)>=0)
         return res({label,key,豁免:'打开的是原生文件选择框'});
       if(el.getAttribute('aria-pressed')==='true'||el.getAttribute('aria-checked')==='true'
          ||/\bis-on\b|\bactive\b|\bsel\b/.test(el.className||''))
         return res({label,key,豁免:'它已经是当前选中项'});
       const b0=window.__snap();
       try{el.click()}catch(e){return res({label,key,err:String(e.message||e).slice(0,70)})}
       setTimeout(()=>{const a=window.__snap();
         res({label,key,
           nav:a.r!==b0.r||a.p!==b0.p||a.rd!==b0.rd||a.t!==b0.t,
           dlg:a.dlg&&!b0.dlg, menu:a.menu&&!b0.menu,
           toast:a.toast>b0.toast, dom:a.dom!==b0.dom, st:a.st!==b0.st});},160);
     }),i);
     if(!out)continue;
     const sig=r+'/'+sub+'|'+out.key+'|'+out.label;
     if(seen.has(sig)){await reset(r,sub);continue}
     seen.add(sig);
     rows.push(Object.assign({id:++id,view:r+(sub?'/'+sub:'')},out));
     await reset(r,sub);
   }
 }
 /* 快照路径是可选的：全量回归只关心有没有报错，不需要留快照。 */
if(process.argv[3])require('fs').writeFileSync(process.argv[3],JSON.stringify({rows,errs},null,0));
 const free=rows.filter(x=>x.豁免);
 const dead=rows.filter(x=>!x.err&&!x.豁免&&!x.nav&&!x.dlg&&!x.menu&&!x.toast&&!x.dom&&!x.st);
 const bad=rows.filter(x=>x.err);
 console.log(`用例一 · 可点击性：共 ${rows.length} 个控件`);
 console.log(`  ✅ 有效果 ${rows.length-dead.length-bad.length}`);
 console.log(`  — 按设计无变化 ${free.length}（文件框 / 已选中项）`);
 console.log(`  ⚠ 点下去没有任何变化 ${dead.length}`);
 dead.slice(0,40).forEach(x=>console.log(`     ${x.view.padEnd(16)} 「${x.label}」  ${x.key}`));
 console.log(`  ❌ 报错 ${bad.length}`);
 bad.forEach(x=>console.log(`     ${x.view} 「${x.label}」 ${x.err}`));
 if(errs.length)console.log('  JS 错误：',[...new Set(errs)].slice(0,8).join(' '));
 await b.close();
})();
