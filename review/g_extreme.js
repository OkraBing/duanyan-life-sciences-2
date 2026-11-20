/* 第 71–80 轮 · 极端数据 + 滚动/粘性 + 刷新恢复
   现实里不会刚好是设计稿里那个数：名字会很长，数据集可能只有 1 行，
   候选可能一条都没有，数字可能是 1e9。还有：刷新之后人回到哪里。 */
const {chromium}=require('../test-browser.cjs');
const {blockExternalNetwork}=require('./offline-network.cjs');
const V=['chat','chats','projects','project','lab','labdet','labnew','dsets','dsnew','mdl','trainnew','shelf','data'];
(async()=>{
const b=await chromium.launch();const bad=[];
// —— 极端数据 ——
{const p=await b.newPage({viewport:{width:1280,height:900}});
await blockExternalNetwork(p);
 const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.goto('file://'+process.argv[2]);await p.waitForTimeout(600);
 await p.evaluate(()=>{
   const L='Barnase–Barstar 结合界面亲和力与热稳定性双目标协同优化第七轮扩展批次（含共价连接与多链复合物）';
   DB.projects[0].name=L;DB.projects[0].owner=L;DB.projects[0].target=L;
   DB.projects[0].kb=[L.replace(/[^\w一-龥]/g,'_')+'_附录_v12_final_修订稿.pdf',
     'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.csv'];
   SESSIONS.forEach(s=>{s.title=L;s.q=L+L});
   const d=DSETS('p1')[0];
   if(d){d.name=L;d.rows=d.rows.slice(0,1);
     d.split={train:[0],val:[],test:[]};d.fp='f'.repeat(40);}
   (PMODELS('p1')||[]).forEach(m=>{m.name=L;m.rho=0.9999999;m.rmse=1234567890.123;m.n=1e9});
 });
 for(const v of V){
   const r=await p.evaluate(a=>{S.pid='p1';S.bind='p1';S.back=[];go(a);
     const out=[];const de=document.documentElement;
     if(de.scrollWidth>de.clientWidth+1)out.push('被长名字顶宽 '+(de.scrollWidth-de.clientWidth)+'px');
     const view=document.getElementById('view');
     if(view&&view.scrollWidth>view.clientWidth+1)out.push('内容区被顶宽');
     const tx=view?view.textContent:'';
     if(/undefined|NaN|Infinity|\[object/.test(tx))
       out.push('脏值：'+(tx.match(/undefined|NaN|Infinity|\[object/g)||[]).slice(0,2).join(' '));
     return out},v);
   if(r.length)bad.push(['极端 '+v,r.join(' / ')]);
 }
 if(errs.length)bad.push(['极端','JS 报错：'+[...new Set(errs)].join(' | ')]);
 await p.close();}

// —— 滚到底，粘性元素还在不在 ——
{const p=await b.newPage({viewport:{width:1280,height:800}});
await blockExternalNetwork(p);
 await p.goto('file://'+process.argv[2]);await p.waitForTimeout(600);
 for(const v of V){
   const r=await p.evaluate(async a=>{S.pid='p1';S.bind='p1';S.back=[];go(a);
     await new Promise(r=>setTimeout(r,120));
     const sc=document.getElementById('view');
     const inner=sc.querySelector('.pjx-flow,.pjx-side-b');
     const box=inner&&inner.scrollHeight>inner.clientHeight+2?inner:sc;
     box.scrollTop=box.scrollHeight;
     await new Promise(r=>setTimeout(r,120));
     const out=[];const vh=window.innerHeight;
     document.querySelectorAll('#view .fbar,#view .pg-hd,#view .chat-ask,#view .pjx-ask,#view .pjx-chat-h')
       .forEach(e=>{const r=e.getBoundingClientRect();
         const cls=(e.className||'').split(' ')[0];
         if(r.bottom<0||r.top>vh)out.push(cls+' 滚到底就看不见了');
         if(r.height<1)out.push(cls+' 高度塌了');});
     /* 滚到底之后主操作还在不在 */
     const pri=document.querySelector('#view .btn-pri');
     if(pri){const rr=pri.getBoundingClientRect();
       if(rr.bottom<0||rr.top>vh)out.push('滚到底之后「'+pri.textContent.trim()+'」不见了');}
     return out},v);
   if(r.length)bad.push(['滚动 '+v,r.join(' / ')]);
 }
 await p.close();}

// —— 刷新恢复 ——
{const p=await b.newPage({viewport:{width:1280,height:900}});
await blockExternalNetwork(p);
 await p.goto('file://'+process.argv[2]);await p.waitForTimeout(600);
 for(const v of ['dsets','mdl','lab','project','shelf']){
   await p.evaluate(a=>{S.pid='p2';go(a)},v);
   await p.waitForTimeout(150);
   await p.reload();await p.waitForTimeout(600);
   const r=await p.evaluate(a=>{
     const out=[];
     if(ROUTE_HOME(S.route)!==a)out.push('刷新后跑到了 '+S.route+'，不是 '+a);
     if(S.pid!=='p2')out.push('刷新后项目变成了 '+S.pid);
     const view=document.getElementById('view');
     if(!view||view.innerHTML.length<200)out.push('刷新后这一屏是空的');
     return out},v);
   if(r.length)bad.push(['刷新 '+v,r.join(' / ')]);
 }
 await p.close();}
await b.close();
const seen={};const uniq=[];
bad.forEach(x=>{const k=x[1];if(seen[k])return;seen[k]=1;uniq.push(x)});
uniq.forEach(x=>console.log('  ✗ ['+x[0]+'] '+x[1]));
console.log(uniq.length?('❌ '+uniq.length+' 类'):'✅ 极端数据 / 滚动粘性 / 刷新恢复全部通过');
if(uniq.length)process.exitCode=1;
})();
