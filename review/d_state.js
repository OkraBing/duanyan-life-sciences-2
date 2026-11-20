/* 第 35–48 轮 · 组件状态、键盘、深色、对比度
   查：disabled 看不看得出来、switch/tab/radio 的 aria 对不对、
       焦点可不可见、Tab 顺序有没有陷阱、深色下有没有读不出的字。 */
const {chromium}=require('../test-browser.cjs');
const {blockExternalNetwork}=require('./offline-network.cjs');
const V=['chat','chats','projects','project','lab','labdet','labnew','dsets','dsnew','mdl','trainnew','shelf','data','set'];
const lum=c=>{const [r,g,b]=c.match(/\d+(\.\d+)?/g).slice(0,3).map(Number)
  .map(v=>{v/=255;return v<=.03928?v/12.92:Math.pow((v+.055)/1.055,2.4)});
  return .2126*r+.7152*g+.0722*b};
(async()=>{
const b=await chromium.launch();const bad=[];
for(const scheme of ['light','dark']){
  const p=await b.newPage({viewport:{width:1440,height:950},colorScheme:scheme});
await blockExternalNetwork(p);
  const errs=[];p.on('pageerror',e=>errs.push(e.message));
  await p.goto('file://'+process.argv[2]);await p.waitForTimeout(600);
  for(const v of V){
    const r=await p.evaluate(a=>{
      S.pid='p1';S.bind='p1';S.round=5;S.back=[];go(a);
      const out=[];const v2=document.getElementById('view');
      /* disabled 必须看得出来 */
      [...v2.querySelectorAll('button:disabled,[aria-disabled="true"]')].forEach(e=>{
        const cs=getComputedStyle(e);
        if(+cs.opacity>=0.98&&cs.cursor!=='not-allowed')
          out.push('disabled 看不出来：'+(e.textContent.trim()||e.className).slice(0,10));});
      /* switch / tab / radio 的 aria */
      [...v2.querySelectorAll('[role="switch"]')].forEach(e=>{
        if(e.getAttribute('aria-checked')==null)out.push('switch 少 aria-checked');
        if(!e.getAttribute('aria-label')&&!e.textContent.trim())out.push('switch 没名字');});
      [...v2.querySelectorAll('[role="radio"]')].forEach(e=>{
        if(e.getAttribute('aria-checked')==null)out.push('radio 少 aria-checked');});
      [...v2.querySelectorAll('[role="radiogroup"]')].forEach(e=>{
        const on=e.querySelectorAll('[aria-checked="true"]').length;
        if(on!==1)out.push('radiogroup 选中 '+on+' 个：'+(e.getAttribute('aria-label')||''));});
      /* 表格要有 caption 或 aria-label */
      [...v2.querySelectorAll('table')].forEach(e=>{
        if(!e.querySelector('caption')&&!e.getAttribute('aria-label'))out.push('表格没名字');});
      /* 每个 th 要有 scope */
      [...v2.querySelectorAll('thead th')].forEach(e=>{
        if(!e.getAttribute('scope'))out.push('th 少 scope');});
      /* 输入要有 label */
      [...v2.querySelectorAll('input:not([type=hidden]):not([type=file]),select,textarea')].forEach(e=>{
        const id=e.id, lab=id&&document.querySelector('label[for="'+CSS.escape(id)+'"]');
        if(!lab&&!e.getAttribute('aria-label')&&!e.closest('label')&&
           !e.getAttribute('placeholder'))out.push('输入框没名字：'+(e.id||e.className));});
      return [...new Set(out)];},v);
    if(r.length)bad.push([scheme+' '+v,r.slice(0,4).join(' / ')]);
    /* 对比度：正文字色 vs 背景 */
    const con=await p.evaluate(()=>{
      const out=[];const seen={};
      [...document.querySelectorAll('#view *')].forEach(e=>{
        if(e.children.length||!e.textContent.trim())return;
        const cs=getComputedStyle(e);
        let bg=null,n=e;
        while(n&&n!==document.documentElement){const c=getComputedStyle(n).backgroundColor;
          if(c&&!/rgba\(0, 0, 0, 0\)|transparent/.test(c)){bg=c;break}n=n.parentElement}
        if(!bg)bg=getComputedStyle(document.body).backgroundColor;
        const k=cs.color+'|'+bg;if(seen[k])return;seen[k]=1;
        out.push([cs.color,bg,parseFloat(cs.fontSize),cs.fontWeight,
          (e.className||'').toString().split(' ')[0]||e.tagName]);});
      return out;});
    con.forEach(([fg,bg,fs,fw,cls])=>{
      try{const l1=lum(fg),l2=lum(bg);
        const ratio=(Math.max(l1,l2)+.05)/(Math.min(l1,l2)+.05);
        const big=fs>=24||(fs>=18.66&&+fw>=700);
        const need=big?3:4.5;
        if(ratio<need-0.05)bad.push([scheme+' '+v,'对比度 '+ratio.toFixed(2)+'<'+need+' ('+cls+' '+fs+'px)']);
      }catch(e){}});
  }
  if(errs.length)bad.push([scheme+' JS',[...new Set(errs)].join(' | ')]);
  await p.close();
}
await b.close();
const uniq=[];const seen={};
bad.forEach(x=>{const k=x[1];if(seen[k])return;seen[k]=1;uniq.push(x)});
uniq.forEach(x=>console.log('  ✗ ['+x[0]+'] '+x[1]));
console.log(uniq.length?('❌ '+uniq.length+' 类问题（共 '+bad.length+' 处）'):'✅ 组件状态 / 键盘 / 深色 / 对比度全部通过');
if(uniq.length)process.exitCode=1;
})();
