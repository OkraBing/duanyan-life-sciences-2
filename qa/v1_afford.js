/* V1 · 可点性诚实：
   有点击行为的，必须看起来可点（cursor:pointer / 是按钮或链接）；
   看起来可点的（有 hover 变化、有 pointer），必须真的有行为。
   「点了没反应」和「看着能点其实不能」是同一类伤害：都让人不敢再点。 */
const {chromium}=require('../test-browser.cjs');
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1440,height:1000}});
const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto('file://'+process.argv[2]);await p.waitForTimeout(400);
const R=await p.evaluate(()=>{
  const bad=[],seen=new Set();let n=0;
  const DATA=/^(act|go|task|tool|dsid|jlist|jlaunch|jnew|jhist|round|nodepick|nodeskip|artdl|artzip|artarch|artuse|archdl|fdel|ffl|projpick|roundpick|dfmode|advt|advf|advreset|seekmode|seekeg|kweg|msa|use|shcap|dcap|siteuse|ptool|kbrm|pfs|pfbond|bond|dson|as|asrole|estatus|vwstyle|vwmode|vdsel|pfmt|bsrc|dtab|ptab|capmenu|sessmenu|rmfile|rmtool|ati|pick|crumb|back|jmode|seeksort|jpf|ibf|fk|fm|fsrc)$/;
  Object.keys(V).forEach(rt=>{
    S.pid='p1';S.back=[];
    try{go('home');if(rt==='task')S.tid=TASKS[0].id;go(rt)}catch(e){return}
    [...document.querySelectorAll('#view *')].forEach(e=>{
      /* 分隔条（role="separator"）是拖的不是点的：col-resize 光标、细长、
         没有文字标签——那是它本来就该有的样子，不按可点控件量。 */
      if(e.getAttribute('role')==='separator')return;
      const cs=getComputedStyle(e);
      const tag=e.tagName;
      const isCtl=tag==='BUTTON'||tag==='A'||tag==='SELECT'||tag==='INPUT'||tag==='TEXTAREA'
        ||e.getAttribute('role')==='button'||e.getAttribute('role')==='tab'
        ||e.getAttribute('role')==='radio'||e.getAttribute('role')==='switch';
      const hasData=[...e.attributes].some(a=>a.name.startsWith('data-')&&DATA.test(a.name.slice(5)));
      const ptr=cs.cursor==='pointer';
      const disabled=e.disabled||e.getAttribute('aria-disabled')==='true';
      if(hasData&&!isCtl){
        const k='非控件却挂了行为|'+tag+'.'+(e.className||'').split(' ')[0];
        if(!seen.has(k)){seen.add(k);bad.push([rt,'非控件却挂了点击行为',tag+' .'+(e.className||'').split(' ')[0],
          (e.textContent||'').replace(/\s+/g,' ').trim().slice(0,24)])}
      }
      if(isCtl&&!disabled&&tag!=='INPUT'&&tag!=='TEXTAREA'&&tag!=='SELECT'){
        n++;
        if(!ptr){const k='控件没有手型|'+(e.className||'').split(' ')[0];
          if(!seen.has(k)){seen.add(k);bad.push([rt,'可点但不是手型',tag+' .'+(e.className||'').split(' ')[0],
            (e.textContent||'').replace(/\s+/g,' ').trim().slice(0,24)])}}
      }
      /* 看着能点其实不能：有手型，而且沿祖先链找不到任何真正绑了 onclick 的人。
         （手型会从父级继承下来，所以必须按「谁拥有这次点击」判断，不能只看自己。） */
      const owned=(()=>{let x=e;while(x&&x!==document.body){
        if(x.onclick||x.onmousedown||x.onkeydown)return true;
        const t=x.tagName;
        if(['BUTTON','A','SELECT','INPUT','TEXTAREA','LABEL','SUMMARY','DETAILS'].indexOf(t)>=0)return true;
        if(x.classList&&(x.classList.contains('ctl-sel')||x.classList.contains('dressed')))return true;
        if(['button','tab','radio','switch','option'].indexOf(x.getAttribute('role'))>=0)return true;
        if([...x.attributes].some(a=>a.name.startsWith('data-')&&DATA.test(a.name.slice(5))))return true;
        x=x.parentElement}return false})();
      if(ptr&&!owned){
        const k='假手型|'+(e.className||'').split(' ')[0];
        if(!seen.has(k)){seen.add(k);bad.push([rt,'有手型却点不了',tag+' .'+(e.className||'').split(' ')[0],
          (e.textContent||'').replace(/\s+/g,' ').trim().slice(0,24)])}}
    });
  });
  return {bad,n};
});
console.log('检查了 '+R.n+' 个可点控件');
if(R.bad.length){console.log('❌ '+R.bad.length+' 类问题');
  R.bad.forEach(x=>console.log('   ['+x[0]+'] '+x[1]+'　'+x[2]+'　'+(x[3]||'')));process.exitCode=1}
else console.log('✅ 可点性一致');
console.log('JS 错误:',errs.length?errs:'无');
await b.close()})();
