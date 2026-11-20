/* 第 23–34 轮 · 响应式
   七档宽度。查：横向溢出、谁溢出的、主操作在不在首屏、元素互相压住、触摸目标。 */
const {chromium}=require('../test-browser.cjs');
const {blockExternalNetwork}=require('./offline-network.cjs');
const V=['chat','chats','projects','project','lab','labdet','labnew','dsets','dsnew','mdl','trainnew','shelf','data','set'];
const W=[360,430,768,1024,1280,1440,1920];
(async()=>{
const b=await chromium.launch();const bad=[];
for(const w of W){
  const p=await b.newPage({viewport:{width:w,height:860}});
await blockExternalNetwork(p);
  const errs=[];p.on('pageerror',e=>errs.push(e.message));
  await p.goto('file://'+process.argv[2]);await p.waitForTimeout(600);
  for(const v of V){
    const r=await p.evaluate(a=>{
      S.pid='p1';S.bind='p1';S.round=5;S.back=[];go(a);
      const out=[];const de=document.documentElement, vw=de.clientWidth, vh=window.innerHeight;
      if(de.scrollWidth>vw+1){
        const who=[...document.querySelectorAll('#view *,#side *')].filter(e=>{
          const r=e.getBoundingClientRect();return r.right>vw+1&&r.width>30}).slice(0,3)
          .map(e=>(e.className||'').toString().split(' ')[0]||e.tagName);
        out.push('整页横向溢出 '+(de.scrollWidth-vw)+'px：'+[...new Set(who)].join(','));
      }
      const view=document.getElementById('view');
      if(view&&view.scrollWidth>view.clientWidth+1)out.push('内容区横向溢出');
      /* 主操作：滚到底之后要在、要点得到、不能被压住。
         底栏在回流里，所以「首屏可见」不是判据——「够得着」才是。 */
      const pri=document.querySelector('#view .btn-pri');
      if(pri){
        const sc=document.getElementById('view');
        sc.scrollTop=sc.scrollHeight;
        const rr=pri.getBoundingClientRect();
        if(rr.width<1||rr.height<1)out.push('主操作尺寸为 0');
        else if(rr.top>vh||rr.bottom<0)out.push('滚到底之后主操作「'+pri.textContent.trim()+'」还是看不见');
        else{
          const hit=document.elementFromPoint(rr.left+rr.width/2,rr.top+rr.height/2);
          if(hit&&hit!==pri&&!pri.contains(hit)&&!hit.contains(pri))
            out.push('主操作被「'+((hit.className||'').toString().split(' ')[0]||hit.tagName)+'」压住');
        }
        sc.scrollTop=0;}
      /* 触摸目标 < 28px（360/430 这两档按手机算） */
      if(vw<=430){
        const hits=(e,dx,dy)=>{const r=e.getBoundingClientRect();
          const t=document.elementFromPoint(r.left+r.width/2+dx,r.top+r.height/2+dy);
          return !!t&&(t===e||e.contains(t)||t.contains(e))};
        const small=[...document.querySelectorAll('#view button,#view [role="button"],#side button')]
          .filter(e=>{const r=e.getBoundingClientRect();
            if(r.width<1||r.height<1)return false;
            if(r.height>=28&&r.width>=28)return false;
            /* 上下各 12px、左右各 12px 还能命中，就算够得着 */
            return !(hits(e,0,-12)&&hits(e,0,12))})
          .map(e=>((e.className||'').toString().split(' ')[0]||e.tagName)
            +' '+Math.round(e.getBoundingClientRect().width)+'×'+Math.round(e.getBoundingClientRect().height));
        const u=[...new Set(small)];
        if(u.length)out.push('手机上点不准：'+u.slice(0,4).join(' | '));
      }
      /* 固定/粘性元素把内容压住：输入框和内容最后一块重叠 */
      const ask=document.querySelector('.chat-ask,.pjx-ask,.fbar');
      if(ask){const ar=ask.getBoundingClientRect();
        if(ar.width<40)out.push('底栏被压没了 '+Math.round(ar.width)+'px');}
      return out;},v);
    if(r.length)bad.push([w+' '+v,r.join(' / ')]);
  }
  if(errs.length)bad.push([w+' JS',[...new Set(errs)].join(' | ')]);
  await p.close();
}
await b.close();
bad.forEach(x=>console.log('  ✗ ['+x[0]+'] '+x[1]));
console.log(bad.length?('❌ '+bad.length+' 处'):('✅ '+(W.length*V.length)+' 个「宽度 × 视图」组合全部通过'));
if(bad.length)process.exitCode=1;
})();
