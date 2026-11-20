/* 只有 Cα 的结构：stick 画出来是断的（相邻 Cα 约 3.8Å，超出成键距离），
   所以它根本不该出现在选项里——以前是列出来、置灰、再写一句为什么，
   那是让人先读一段解释才知道这一档没用。
   球和轨迹都画得出来，不许少。只有主链和带侧链的，三档都要有。
   三维卡现在从对话里出，不再有独立的 viewer 页。 */
const {chromium}=require('../test-browser.cjs');
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1440,height:1000}});
await p.goto('file://'+process.argv[2]);await p.waitForTimeout(400);
const R=await p.evaluate(()=>{
  /* kind: 'ca' 只有 Cα；'bb' 只有主链；'full' 带侧链 */
  const mk=(kind)=>{const L=[];let n=0;
    const at=(an,x,y)=>L.push(`ATOM  ${String(++n).padStart(5)}  ${an.padEnd(3)} ALA A${String(Math.ceil(n/4)).padStart(4)}    ${x.toFixed(3).padStart(7)} ${y.toFixed(3).padStart(7)}   0.000  1.00 90.00`);
    for(let i=1;i<=6;i++){
      if(kind!=='ca')at('N',i*3.8-1.2,0);
      at('CA',i*3.8,0);
      if(kind!=='ca')at('C',i*3.8+0.9,0);
      if(kind==='full')at('CB',i*3.8,1.5);
    } return L.join('\n')};
  const probe=(txt,label)=>{
    VW.mode='sphere';loadStruct(txt,label,'测试','pdb');
    /* 直接把三维卡挂进当前会话再渲染——viewer 页已经没有了 */
    S.sid='v3';CONV.v3=[{role:'ai',text:'',cards:[mkCard('struct3',{title:'三维预览'})],at:nowStamp()}];
    go('chat');render();
    const sel=document.querySelector('[data-vwmode]');
    const opts=[...(sel?sel.options:[])].map(o=>o.value+(o.disabled?'(关)':''));
    const why=document.getElementById('vwmodewhy');
    return {label, caOnly:!!VW.caOnly, mode:VW.mode, opts,
      why:why?why.textContent.trim():null};
  };
  return [probe(mk('ca'),'只有 Cα'), probe(mk('bb'),'只有主链'), probe(mk('full'),'带侧链')];
});
let bad=0;
R.forEach(r=>{
  console.log(`【${r.label}】caOnly=${r.caOnly}  当前模式=${r.mode}`);
  console.log('   选项：'+r.opts.join('  ')+(r.why?'\n   说明："'+r.why+'"':''));
  if(r.label==='只有 Cα'){
    /* 实测（见 v13_3d）：Cα-only 上 stick 画不出来（相邻 Cα 约 3.8Å，连不成键），
       但 sphere 画得出来，cartoon 用 trace 样式也画得出来。
       这条断言一度写成「stick 和 sphere 都该禁」，那会把能画的球也砍掉，
       并把模式推到当时画不出来的普通 cartoon——等于锁死成空白。 */
    if(!r.caOnly){console.log('   ❌ 没认出这是只有 Cα 的结构');bad++}
    if(r.mode==='stick'){console.log('   ❌ 停在 stick 上，会看到空图');bad++}
    const names=r.opts.map(o=>o.replace('(关)',''));
    if(names.indexOf('stick')>=0){
      console.log('   ❌ stick 画不出来，不该出现在选项里');bad++}
    ['cartoon','sphere'].forEach(k=>{if(names.indexOf(k)<0){
      console.log('   ❌ 少了画得出来的 '+k);bad++}});
  }else{
    if(r.caOnly){console.log('   ❌ 不是只有 Cα 却被判成只有 Cα');bad++}
    if(r.opts.some(o=>/\(关\)/.test(o))){console.log('   ❌ 画得出来却关掉了选项');bad++}
    if(r.mode!=='sphere'){console.log('   ❌ 画得出来时不该改用户选的模式');bad++}
  }
});
console.log(bad?'\n❌ '+bad+' 处':'\n✅ 三种结构的显示模式都对');
if(bad)process.exitCode=1;
await b.close()})();
