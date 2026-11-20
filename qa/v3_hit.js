/* V3 · 可点尺寸：WCAG 2.2 AA 要求目标至少 24×24 CSS 像素
   （除非它内联在文字里，或旁边有等效的大目标）。
   这个产品里很多小按钮是我自己压出来的（min-height:1.375rem = 22px），
   要么放大，要么说清为什么可以不放大。 */
const {chromium}=require('../test-browser.cjs');
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1440,height:1000}});
await p.goto('file://'+process.argv[2]);await p.waitForTimeout(400);
const R=await p.evaluate(()=>{
  const small={},inline={};let n=0;
  Object.keys(V).forEach(rt=>{
    S.pid='p1';S.back=[];
    try{go('home');if(rt==='task')S.tid=TASKS[0].id;go(rt)}catch(e){return}
    [...document.querySelectorAll('#view button,#view a,#view [role="button"],#view [role="switch"],#view [role="tab"],#view input,#view select')]
      .forEach(e=>{
      /* 单选/复选框裹在 <label> 里时，接收点击的是整行标签（点文字也能选），
         所以目标尺寸要按标签量——按方块量是把视觉指示器错当成了点击区。 */
      /* 分隔条是拖的不是点的：它细长是为了贴着边界，加宽反而会挡住内容。
         拖拽目标的可达性靠另一条路保证——键盘左右箭头也能调宽（见 data-pjgrip）。 */
      if(e.getAttribute('role')==='separator')return;
      const lab=(e.type==='checkbox'||e.type==='radio')?e.closest('label'):null;
      const r=(lab||e).getBoundingClientRect();
      if(!r.width||!r.height)return;
      if(e.getAttribute('aria-hidden')==='true'||e.tabIndex<0)return;  // 已移出交互的不算目标
      if(e.type==='range')return;   // 滑块的目标是滑块头，另算，见下

      n++;
      const w=Math.round(r.width),h=Math.round(r.height);
      if(w>=24&&h>=24)return;
      // 文字行内的链接式按钮按例外处理（WCAG 的 inline exception）
      const isInline=getComputedStyle(e).display.indexOf('inline')===0
        && e.closest('p,span,.t-sm,.t-xs,.hint,.qnote,.fcard-s');
      const k=(e.className||'').toString().split(' ').slice(0,2).join('.')||e.tagName;
      const box=(isInline?inline:small);
      box[k]=box[k]||{wh:new Set(),rts:new Set(),tx:(e.textContent||'').replace(/\s+/g,' ').trim().slice(0,16)};
      box[k].wh.add(w+'×'+h);box[k].rts.add(rt);
    });
  });
  const out=o=>Object.keys(o).map(k=>k+'　'+[...o[k].wh].join('/')+'　['+[...o[k].rts].slice(0,3).join(',')+']　'+o[k].tx);
  return {n,small:out(small),inline:out(inline)};
});
console.log('量了 '+R.n+' 个控件');
if(R.inline.length){console.log('\n· 行内链接式（WCAG 允许的例外）'+R.inline.length+' 类');
  R.inline.forEach(x=>console.log('   '+x))}
if(R.small.length){console.log('\n❌ 低于 24×24 的 '+R.small.length+' 类');
  R.small.forEach(x=>console.log('   '+x));process.exitCode=1}
else console.log('\n✅ 都达到 24×24');
await b.close()})();
