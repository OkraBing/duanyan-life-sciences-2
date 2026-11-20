/* V2 · 键盘可达与焦点可见：
   逐页 Tab 一遍，每一跳都要看得见焦点落在哪。
   看不见焦点 = 用键盘的人在页面上瞎走。 */
const {chromium}=require('../test-browser.cjs');
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1440,height:1000}});
const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto('file://'+process.argv[2]);await p.waitForTimeout(400);
const routes=await p.evaluate(()=>Object.keys(V));
const bad=[],seen=new Set();let total=0;
for(const rt of routes){
  await p.evaluate(r=>{S.pid='p1';S.back=[];go('home');if(r==='task')S.tid=TASKS[0].id;try{go(r)}catch(e){}},rt);
  await p.waitForTimeout(120);
  await p.evaluate(()=>{const h=document.querySelector('#view');if(h)h.scrollTop=0;
    (document.activeElement||document.body).blur()});
  for(let i=0;i<28;i++){
    await p.keyboard.press('Tab');
    await p.waitForTimeout(200);   // 焦点环是 transition 出来的，读太早会读到过渡起点
    const r=await p.evaluate(async()=>{
      const e=document.activeElement;
      if(!e||e===document.body)return null;
      /* 焦点环可能画在祖先上（.ask:focus-within），也可能是卡片本来就有的阴影。
         所以不看「有没有环」，看「聚焦前后变不变」——变了才说明这一跳看得见。
         带 transition 的属性在 blur() 之后同步读还是旧值，所以失焦后要等过渡跑完。 */
      const chain=[];for(let n=e,i=0;n&&i<4;n=n.parentElement,i++)chain.push(n);
      const snap=()=>chain.map(n=>{const c=getComputedStyle(n);
        return [c.outlineStyle,c.outlineWidth,c.outlineColor,c.boxShadow,
                c.borderTopColor,c.borderTopWidth,c.backgroundColor].join('|')}).join('#');
      const settle=()=>new Promise(r=>setTimeout(r,260));
      const on=snap();
      e.blur();await settle();const off=snap();
      e.focus();await settle();
      const rect=e.getBoundingClientRect();
      return {tag:e.tagName,cls:(e.className||'').toString().split(' ')[0],
        vis:on!==off,w:Math.round(rect.width),h:Math.round(rect.height),
        inView:rect.width>0&&rect.height>0,
        tx:(e.textContent||'').replace(/\s+/g,' ').trim().slice(0,20)};
    });
    if(!r)break;
    total++;
    if(!r.vis){const k=r.tag+'.'+r.cls;
      if(!seen.has(k)){seen.add(k);bad.push([rt,'聚焦前后没有任何视觉变化',k,r.tx])}}
    if(!r.inView){const k2='零尺寸|'+r.tag+'.'+r.cls;
      if(!seen.has(k2)){seen.add(k2);bad.push([rt,'可聚焦但尺寸为零',r.tag+'.'+r.cls,r.tx])}}
  }
}
console.log('Tab 了 '+total+' 跳');
if(bad.length){console.log('❌ '+bad.length+' 类');
  bad.forEach(x=>console.log('   ['+x[0]+'] '+x[1]+'　'+x[2]+'　'+(x[3]||'')));process.exitCode=1}
else console.log('✅ 每一跳焦点都看得见');
console.log('JS 错误:',errs.length?errs:'无');
await b.close()})();
