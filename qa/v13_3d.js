/* 三维视图必须真的画出东西。此前它是一张空图：
   内置坐标只有 Cα，而普通 cartoon 需要主链 N/C 才画得出来，3Dmol 不报错、只是不画。
   所以这里不看「有没有 canvas」，看画布上有没有非背景像素。 */
const {chromium}=require('../test-browser.cjs');
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1200,height:1000}});
const errs=[];p.on('pageerror',e=>errs.push(e.message));
// Set a pinned local fixture for offline checks; otherwise use the page's pinned CDN.
if(process.env.DUANYAN_3DMOL_FIXTURE) await p.route('**/3Dmol-min.js', r=>r.fulfill({path:require('path').resolve(process.env.DUANYAN_3DMOL_FIXTURE),contentType:'application/javascript'}));
await p.goto('file://'+process.argv[2]);await p.waitForTimeout(700);
const R=await p.evaluate(async()=>{
  const out=[];
  go('viewer');
  await new Promise(r=>setTimeout(r,400));
  const ink=()=>{const c=document.querySelector('#mol canvas');if(!c)return -1;
    const g=document.createElement('canvas');g.width=c.width;g.height=c.height;
    const x=g.getContext('2d');x.drawImage(c,0,0);
    const d=x.getImageData(0,0,g.width,g.height).data;let n=0;
    for(let i=0;i<d.length;i+=4){if(d[i+3]>0&&(d[i]<235||d[i+1]<235||d[i+2]<235))n++}
    return n};
  const sel=document.querySelector('[data-vwmode]');
  const modes=[...(sel?sel.options:[])].map(o=>[o.value,o.disabled]);
  for(const [m,dis] of modes){
    if(dis){out.push([m,'已禁用',null]);continue}
    VW.mode=m;render();await new Promise(r=>setTimeout(r,450));
    out.push([m,'可选',ink()]);
  }
  return {out, caOnly:!!VW.caOnly, noB:!!VW.noB, 残基数:(VW.per||[]).length};
});
console.log(`caOnly=${R.caOnly}  无置信度列=${R.noB}  解析出残基 ${R.残基数}`);
let bad=0;
R.out.forEach(([m,st,n])=>{
  if(st==='已禁用'){console.log(`  — ${m}：已禁用（这个结构画不出来）`);return}
  const ok=n>500;
  console.log(`  ${ok?'✓':'❌'} ${m}：非背景像素 ${n}`);
  if(!ok)bad++;
});
if(!R.残基数)  {console.log('❌ 一个残基都没解析出来');bad++}
console.log(bad?`\n❌ ${bad} 处画不出来`:'\n✅ 每个可选的显示模式都真的画出了东西');
console.log('JS 错误:',errs.length?errs.slice(0,2):'无');
if(bad)process.exitCode=1;
await b.close()})();
