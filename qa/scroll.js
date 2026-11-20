const {chromium}=require('../test-browser.cjs');
(async()=>{const b=await chromium.launch(),pg=await b.newPage({viewport:{width:1280,height:820}});
 await pg.goto('file://'+process.argv[2]);await pg.waitForTimeout(400);
 const R=await pg.evaluate(()=>Object.keys(V));
 const out=[];
 for(const r of R){
   await pg.evaluate(x=>{location.hash=x},'#'+r);await new Promise(s=>setTimeout(s,220));
   const x=await pg.evaluate(()=>{
     const p=document.querySelector('#view .page')||document.querySelector('#view>*');
     if(!p)return null;
     const hd=p.querySelector('.pg-hd');
     const h1=p.querySelector('h1');
     const inHd=n=>!!(hd&&n&&hd.contains(n));
     const flt=[...p.querySelectorAll('.fltrow,.tabs,.seg,.pw-tabs')];
     const srch=[...p.querySelectorAll('input.input')].filter(i=>/搜/.test(i.placeholder||''));
     return {hasHd:!!hd, h1:h1?h1.textContent.trim().slice(0,14):null, h1in:inHd(h1),
       flt:flt.length, fltOut:flt.filter(n=>!inHd(n)).length,
       srch:srch.length, srchOut:srch.filter(n=>!inHd(n)).length,
       scroll:document.getElementById('view').scrollHeight>document.getElementById('view').clientHeight};
   });
   if(x)out.push([r,x]);
 }
 const bad=out.filter(([r,x])=>x.scroll&&x.h1&&(!x.h1in||x.fltOut||x.srchOut));
 console.log('有滚动且头部没固定住的页面：',bad.length,'/',out.filter(([,x])=>x.scroll).length);
 bad.forEach(([r,x])=>console.log(` ${r.padEnd(10)} 「${x.h1}」 标题在头部:${x.h1in} 筛选器在外:${x.fltOut}/${x.flt} 搜索框在外:${x.srchOut}/${x.srch}`));
 console.log('\n不滚动的页面（无需处理）：',out.filter(([,x])=>!x.scroll).map(([r])=>r).join(' '));
 await b.close()})();
