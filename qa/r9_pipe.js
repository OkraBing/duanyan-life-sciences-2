/* 轮次九：契约驱动的节点，在「工具被停掉」之后会不会变成死胡同。
   研究员真的会停工具：换服务商、模型下线、合规不让用公共服务。
   每个节点必须要么还有可选项，要么说清楚缺什么——不能给一个空下拉。 */
const {chromium}=require('../test-browser.cjs');
(async()=>{const b=await chromium.launch(),pg=await b.newPage({viewport:{width:1400,height:900}});
 const errs=[];pg.on('pageerror',e=>errs.push(e.message));
 await pg.goto('file://'+process.argv[2]);await pg.waitForTimeout(500);

 const nodes=await pg.evaluate(()=>Object.keys(PIPE).flatMap(c=>PIPE[c].map(n=>[c,n.id,n.n,!!n.fixed])));
 console.log('节点共',nodes.length,'个\n');

 // ① 全部停掉：每个节点要么固定不需要工具，要么明说没有可接的
 const all=await pg.evaluate(()=>{
   const before=ENABLED().slice();
   // 注册表级停用：一个一个停掉，模拟「模型下线 / 服务商换了 / 合规不让用」
   ALL_TOOLS().forEach(t=>{try{setGov(t.n,{pub:0})}catch(e){}});
   return {before, 还启用着:ENABLED().length, 注册表里还发布着:ALL_TOOLS().filter(t=>pubOK(t.n)).length};
 });
 console.log('① 停掉全部工具：',JSON.stringify(all).slice(0,160));
 const r1=await pg.evaluate(()=>Object.keys(PIPE).flatMap(c=>PIPE[c].map(n=>({
   节点:c+'/'+n.id+' '+n.n, 固定:n.fixed||null,
   可选:(typeof nodeTools==='function')?nodeTools(c,n.id).length:'没有 nodeTools',
   选中:(typeof nodePick==='function')?(nodePick(c,n.id)||null):'?'}))));
 const dead=r1.filter(x=>!x.固定&&x.可选===0);
 console.log('   没有可选工具的节点：',dead.length?dead.map(x=>x.节点).join('、'):'无');

 // ② 这种状态下界面说了什么
 for(const h of ['#models','#design','#wet']){
   await pg.evaluate(x=>{location.hash=x;render()},h);await pg.waitForTimeout(300);
   const t=await pg.evaluate(()=>{
     const v=document.getElementById('view');
     const n=[...v.querySelectorAll('.pipe-n')].map(x=>x.innerText.replace(/\n+/g,' / ').slice(0,80));
     const go=[...v.querySelectorAll('.ctl-go,.btn-pri')].map(b=>({t:b.innerText.trim(),禁用:b.disabled}));
     return {节点:n,主按钮:go};
   });
   console.log(`\n   ${h}`);
   t.节点.forEach(x=>console.log('     ·',x));
   console.log('     主按钮：',t.主按钮.map(x=>x.t+(x.禁用?'（已禁用）':'（可点）')).join(' ｜ ')||'（无）');
 }
 console.log('\nJS 错误:',errs.length?errs.slice(0,3).join(' | '):'无');
 await b.close()})();
