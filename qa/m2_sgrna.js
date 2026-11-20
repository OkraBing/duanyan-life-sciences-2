/* sgRNA：位置、PAM、GC、poly-T、序列内近似匹配都要能在模板上核对；
   而且**不许**出现在靶分——没有权重就不能给分。 */
const {chromium}=require('../test-browser.cjs');
const RC={A:'T',T:'A',G:'C',C:'G'};
const rc=s=>s.split('').reverse().map(c=>RC[c]).join('');
(async()=>{const b=await chromium.launch();const p=await b.newPage();
const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto('file://'+process.argv[2]);await p.waitForTimeout(400);
const r=await p.evaluate(()=>{
  const sq=backTranslate(PRJ_WT.p1||'');
  const o=sgrnaRun({seq:sq,pam:'NGG',glen:20,n:10});
  return {sq:sq,ok:o.ok,why:o.why,nAll:o.nAll,
    g:(o.guides||[]).map(h=>({g:h.g,pam:h.pam,st:h.strand,pos:h.pos,gc:h.gc,
      polyT:h.polyT,near:h.near}))};
});
let bad=0;const say=(ok,m)=>{if(!ok)bad++;console.log((ok?'  ✓ ':'  ❌ ')+m)};
say(r.ok,'能跑出结果'+(r.ok?'':'：'+r.why));
if(r.ok){
  const plus=r.sq, minus=rc(r.sq);
  r.g.forEach((h,i)=>{
    const str=h.st==='+'?plus:minus;
    /* pos 是在原链坐标系里报的，正链直接取，负链要换算回去 */
    const at=h.st==='+'?h.pos:(r.sq.length-h.pos-20-3);
    const got=str.substr(at,20), pam=str.substr(at+20,3);
    say(got===h.g,`第 ${i+1} 条 protospacer 在 ${h.st} 链 ${at} 处对得上`);
    say(/^[ACGT]GG$/.test(h.pam),`第 ${i+1} 条 PAM ${h.pam} 符合 NGG`);
    say(pam===h.pam,`第 ${i+1} 条 PAM 紧跟在 protospacer 之后`);
    const gc=(h.g.match(/[GC]/g)||[]).length/h.g.length*100;
    say(Math.abs(gc-h.gc)<0.01,`第 ${i+1} 条 GC ${h.gc.toFixed(1)}% 数得对`);
    say(h.polyT===/TTTT/.test(h.g),`第 ${i+1} 条 poly-T 判得对`);
    /* 近似匹配：自己在两条链上重数一遍 */
    const cnt=[0,0,0,0];
    [plus,minus].forEach(s2=>{for(let k=0;k+20<=s2.length;k++){
      let d=0;const w=s2.substr(k,20);
      for(let q=0;q<20;q++)if(w[q]!==h.g[q]){d++;if(d>3)break}
      if(d<=3)cnt[d]++}});
    cnt[0]--; /* 减掉它自己 */
    say(JSON.stringify(cnt)===JSON.stringify(h.near),
      `第 ${i+1} 条 近似匹配 ${JSON.stringify(h.near)} 与独立重数一致`);
  });
  say(r.g.every(h=>h.near[0]>=0),'0 错配计数减掉了它自己，没有负数');
}
/* 产品里任何地方都不许出现在靶分 */
const txt=require('fs').readFileSync(process.argv[2],'utf8');
const banned=['在靶分 0','on_target_score','azimuth_score','rule_set_2_score'];
banned.forEach(k=>say(txt.indexOf(k)<0,`没有伪造的在靶分字段「${k}」`));
say(/没有它的权重|不给在靶分|不给分/.test(txt),'界面上写明了为什么不给在靶分');
console.log(bad?`\n❌ ${bad} 项对不上`:'\n✅ sgRNA 的每个数都能核对，且没有编造的在靶分');
console.log('JS 错误:',errs.length?errs.slice(0,3):'无');
if(bad||errs.length)process.exitCode=1;
await b.close()})();
