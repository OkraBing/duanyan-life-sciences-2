/* V4 · 窄屏：400px 下不许横向滚动、不许重叠、不许控件被挤出可视区 */
const {chromium}=require('../test-browser.cjs');
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:400,height:900}});
await p.goto('file://'+process.argv[2]);await p.waitForTimeout(400);
const bad=[];
const routes=await p.evaluate(()=>Object.keys(V));
for(const rt of routes){
  await p.evaluate(r=>{S.pid='p1';S.back=[];go('home');if(r==='task')S.tid=TASKS[0].id;try{go(r)}catch(e){}},rt);
  await p.waitForTimeout(90);
  const r=await p.evaluate(()=>{
    const de=document.documentElement, v=document.getElementById('view');
    const over=[];
    [...document.querySelectorAll('#view *')].forEach(e=>{
      const b=e.getBoundingClientRect();
      if(b.width===0)return;
      /* 容器自己能横滚的（表格、筛选条），子元素比容器宽是设计使然，不算溢出；
         要抓的是把整页顶宽的那些。 */
      let anc=e.parentElement,scrollable=false;
      while(anc&&anc!==document.body){
        const oc=getComputedStyle(anc);
        if(oc.overflowX==='auto'||oc.overflowX==='scroll'){scrollable=true;break}
        anc=anc.parentElement}
      if(scrollable)return;
      if(b.right>innerWidth+1.5||b.left<-1.5){
        const k=(e.className||'').toString().split(' ')[0]||e.tagName;
        if(!over.some(x=>x.k===k))over.push({k,r:Math.round(b.right),l:Math.round(b.left),
          tx:(e.textContent||'').replace(/\s+/g,' ').trim().slice(0,20)});}
    });
    return {bodyScroll:de.scrollWidth>de.clientWidth+1,
      viewScroll:v?v.scrollWidth>v.clientWidth+1:false, over:over.slice(0,4)};
  });
  if(r.bodyScroll||r.viewScroll||r.over.length)
    bad.push([rt,(r.bodyScroll?'整页横滚 ':'')+(r.viewScroll?'内容区横滚 ':''),
      r.over.map(o=>o.k+'→'+o.r+'px「'+o.tx+'」').join(' / ')]);
}
if(bad.length){console.log('❌ '+bad.length+' 个页面在 400px 下溢出');
  bad.forEach(x=>console.log('   ['+x[0]+'] '+x[1]+x[2]));process.exitCode=1}
else console.log('✅ 400px 下 '+routes.length+' 个页面都不溢出');
await b.close()})();
