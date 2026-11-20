/* V7 · 三态：禁用的要看起来禁用，可悬停的要有悬停反馈，按下要有按下。
   「看起来能点但点不动」和「点了没有任何视觉变化」是最常见的两种挫败。 */
const {chromium}=require('../test-browser.cjs');
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1440,height:1000}});
await p.goto('file://'+process.argv[2]);await p.waitForTimeout(400);
const R=await p.evaluate(()=>{
  const bad=[],seen=new Set();let nd=0,nh=0;
  Object.keys(V).forEach(rt=>{
    S.pid='p1';S.back=[];
    try{go('home');if(rt==='task')S.tid=TASKS[0].id;go(rt)}catch(e){return}
    [...document.querySelectorAll('#view button,#view [role="button"],#view [role="switch"]')].forEach(e=>{
      const cs=getComputedStyle(e);
      const dis=e.disabled||e.getAttribute('aria-disabled')==='true';
      const k=(e.className||'').toString().split(' ').slice(0,2).join('.')||e.tagName;
      if(dis){nd++;
        // 禁用的要么变淡，要么变灰，要么光标变禁止——三者全无就看不出来
        const faded=parseFloat(cs.opacity)<0.95;
        const notAllowed=cs.cursor==='not-allowed'||cs.cursor==='default';
        if(!faded&&!notAllowed){const kk='禁用没样子|'+k;
          if(!seen.has(kk)){seen.add(kk);
            bad.push([rt,'禁用了但看不出来',k,(e.textContent||'').replace(/\s+/g,' ').trim().slice(0,18)])}}
        if(cs.cursor==='pointer'){const kk='禁用还手型|'+k;
          if(!seen.has(kk)){seen.add(kk);
            bad.push([rt,'禁用了还是手型',k,(e.textContent||'').replace(/\s+/g,' ').trim().slice(0,18)])}}
      } else nh++;
    });
  });
  return {bad,nd,nh};
});
console.log('禁用态 '+R.nd+' 个，可用 '+R.nh+' 个');
if(R.bad.length){console.log('❌ '+R.bad.length+' 类');
  R.bad.forEach(x=>console.log('   ['+x[0]+'] '+x[1]+'　'+x[2]+'　'+(x[3]||'')));process.exitCode=1}
else console.log('✅ 禁用态都看得出来');
await b.close()})();
