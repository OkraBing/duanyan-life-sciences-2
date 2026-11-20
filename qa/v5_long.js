/* V5 · 长文本：真实世界里项目名、文件名、模型名都会很长。
   撑破布局的从来不是设计稿里那个刚好合适的名字。 */
const {chromium}=require('../test-browser.cjs');
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1440,height:1000}});
await p.goto('file://'+process.argv[2]);await p.waitForTimeout(400);
await p.evaluate(()=>{
  const L='Barnase–Barstar 结合界面亲和力与热稳定性双目标协同优化第七轮扩展批次';
  DB.projects[0].name=L;
  TASKS[0].n=L+'（含共价连接与多链复合物）';
  DB.projects[0].kb=(DB.projects[0].kb||[]).concat([L.replace(/[^\w一-龥]/g,'_')+'_附录_v12_final_修订稿.pdf']);
});
const bad=[];
const routes=await p.evaluate(()=>Object.keys(V));
for(const rt of routes){
  await p.evaluate(r=>{S.pid='p1';S.back=[];go('home');if(r==='task')S.tid=TASKS[0].id;try{go(r)}catch(e){}},rt);
  await p.waitForTimeout(90);
  const r=await p.evaluate(()=>{
    const out=[];const de=document.documentElement;
    if(de.scrollWidth>de.clientWidth+1)out.push('整页被顶宽到 '+de.scrollWidth+'px');
    const v=document.getElementById('view');
    if(v&&v.scrollWidth>v.clientWidth+1)out.push('内容区被顶宽');
    // 固定高度的容器里文字溢出
    [...document.querySelectorAll('#view *')].forEach(e=>{
      if(e.children.length)return;
      const cs=getComputedStyle(e);
      if(cs.overflow!=='visible')return;
      if(e.scrollWidth>e.clientWidth+2&&cs.textOverflow!=='ellipsis'&&cs.whiteSpace==='nowrap'){
        const k=(e.className||'').toString().split(' ')[0]||e.tagName;
        if(!out.some(x=>x.indexOf(k)>=0))out.push('文字被裁没有省略号：'+k)}
    });
    return out;
  });
  if(r.length)bad.push([rt,r.join(' / ')]);
}
if(bad.length){console.log('❌ '+bad.length+' 个页面扛不住长文本');
  bad.forEach(x=>console.log('   ['+x[0]+'] '+x[1]));process.exitCode=1}
else console.log('✅ '+routes.length+' 个页面都扛住了超长名字');
await b.close()})();
