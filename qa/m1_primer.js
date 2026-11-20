/* 引物引擎：每个数都要能独立核对。
   Tm 用第三方算法重算一遍；位置、反向互补、产物长度用模板本身核对。 */
const {chromium}=require('../test-browser.cjs');

/* 独立实现一份 SantaLucia 1998，故意不复用产品里的那份 */
const H={AA:-7.9,TT:-7.9,AT:-7.2,TA:-7.2,CA:-8.5,TG:-8.5,GT:-8.4,AC:-8.4,
 CT:-7.8,AG:-7.8,GA:-8.2,TC:-8.2,CG:-10.6,GC:-9.8,GG:-8.0,CC:-8.0};
const Sx={AA:-22.2,TT:-22.2,AT:-20.4,TA:-21.3,CA:-22.7,TG:-22.7,GT:-22.4,AC:-22.4,
 CT:-21.0,AG:-21.0,GA:-22.2,TC:-22.2,CG:-27.2,GC:-24.4,GG:-19.9,CC:-19.9};
function tm(s,na){let dh=0,ds=0;
  for(let i=0;i<s.length-1;i++){dh+=H[s.substr(i,2)];ds+=Sx[s.substr(i,2)]}
  const ini=c=>(c==='G'||c==='C')?[0.1,-2.8]:[2.3,4.1];
  const a=ini(s[0]),b=ini(s[s.length-1]);
  dh+=a[0]+b[0];ds+=a[1]+b[1];
  ds+=0.368*(s.length-1)*Math.log(na);
  return (1000*dh)/(ds+1.9872*Math.log(50e-9/4))-273.15}
const RC={A:'T',T:'A',G:'C',C:'G'};
const rc=s=>s.split('').reverse().map(c=>RC[c]).join('');

(async()=>{const b=await chromium.launch();const p=await b.newPage();
const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto('file://'+process.argv[2]);await p.waitForTimeout(400);
const r=await p.evaluate(()=>{
  const tpl=backTranslate(PRJ_WT.p1||'');
  const o=primerRun({tpl:tpl,tgStart:Math.round(tpl.length/2)-30,tgLen:60,n:5});
  return {tpl:tpl,ok:o.ok,why:o.why,na:o.na,tg:o.tg,
    pairs:(o.pairs||[]).map(q=>({l:q.l.sq,lp:q.l.pos,ll:q.l.len,ltm:q.l.tm,lgc:q.l.gc,
      r:q.r.sq,rp:q.r.pos,rl:q.r.len,rtm:q.r.tm,prod:q.prod,dTm:q.dTm}))};
});
let bad=0;const say=(ok,m)=>{if(!ok)bad++;console.log((ok?'  ✓ ':'  ❌ ')+m)};
say(r.ok,'能跑出结果'+(r.ok?'':'：'+r.why));
if(r.ok){
  say(Math.abs(r.na*1000-163.8)<0.2,`等效一价盐 ${(r.na*1000).toFixed(1)} mM（应为 163.8）`);
  r.pairs.forEach((q,i)=>{
    const F=r.tpl.substr(q.lp,q.ll);
    const Rseg=r.tpl.substr(q.rp,q.rl);
    say(F===q.l,`第 ${i+1} 对 正向就是模板 ${q.lp}..${q.lp+q.ll}`);
    say(rc(Rseg)===q.r,`第 ${i+1} 对 反向是模板 ${q.rp}..${q.rp+q.rl} 的反向互补`);
    say(q.prod===(q.rp+q.rl)-q.lp,`第 ${i+1} 对 产物长度 ${q.prod} 对得上坐标`);
    say(q.lp<=r.tg[0]&&(q.rp+q.rl)>=r.tg[1],`第 ${i+1} 对 产物把目标 ${r.tg[0]}–${r.tg[1]} 包住`);
    const t1=tm(q.l,r.na),t2=tm(q.r,r.na);
    say(Math.abs(t1-q.ltm)<0.05,`第 ${i+1} 对 正向 Tm ${q.ltm.toFixed(2)} 与独立重算 ${t1.toFixed(2)} 一致`);
    say(Math.abs(t2-q.rtm)<0.05,`第 ${i+1} 对 反向 Tm ${q.rtm.toFixed(2)} 与独立重算 ${t2.toFixed(2)} 一致`);
    say(Math.abs(Math.abs(t1-t2)-q.dTm)<0.05,`第 ${i+1} 对 Tm 差 ${q.dTm.toFixed(2)} 算得对`);
    const gc=(q.l.match(/[GC]/g)||[]).length/q.l.length*100;
    say(Math.abs(gc-q.lgc)<0.01,`第 ${i+1} 对 正向 GC ${q.lgc.toFixed(1)}% 数得对`);
  });
  say(r.pairs.every((q,i,A)=>!i||A[i-1].prod!=null),'罚分排序没有空项');
}
console.log(bad?`\n❌ ${bad} 项对不上`:'\n✅ 引物的每个数都能独立核对');
console.log('JS 错误:',errs.length?errs.slice(0,3):'无');
if(bad||errs.length)process.exitCode=1;
await b.close()})();
