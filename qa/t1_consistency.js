/* 第 1 轮 · 同一个数在不同地方必须相等
   最难发现的错不是算错，是两处各算各的，平时看不出，哪天数据一变就互相打脸。 */
const {chromium}=require('../test-browser.cjs');
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1440,height:1000}});
const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto('file://'+process.argv[2]);await p.waitForTimeout(500);
const bad=[];
const r=await p.evaluate(()=>{
  const out={};
  DB.projects.forEach(pr=>{
    S.pid=pr.id;S.round=pr.rounds[pr.rounds.length-1].i;
    const all=CANDS(pr.id), q=all.filter(c=>typeof c.iptm==='number');
    out[pr.id]={
      候选总数:all.length,
      有ipTM:q.length,
      过闸门:q.filter(c=>c.iptm>=S.gate).length,
      通过率:q.length?Math.round(q.filter(c=>c.iptm>=S.gate).length/q.length*100):null,
      预览条数:dfModeN('preview'),
      批次条数:dfModeN('extended'),
      板位容量:plateCap(),
      板位算式:plateNote(),
      任务数:TASKS.filter(t=>t.pid===pr.id).length,
      文件数:FILES(pr.id).length,
      归档数:(pr.arch||[]).length,
      产物数:TASKS.filter(t=>t.pid===pr.id&&t.st==='done').reduce((a,t)=>a+artsOf(t).length,0)
    };
  });
  return out;
});
console.log(JSON.stringify(r,null,1));
/* 对账 */
Object.keys(r).forEach(k=>{const x=r[k];
  if(x.通过率!=null&&x.预览条数!=null){
    const want=Math.ceil(3/(x.通过率/100));
    if(Math.abs(want-x.预览条数)>1)bad.push(`${k} 预览条数 ${x.预览条数} 与通过率 ${x.通过率}% 对不上（应 ${want}）`);
  }
  if(x.批次条数!==x.板位容量)bad.push(`${k} 完整批次 ${x.批次条数} ≠ 板位容量 ${x.板位容量}`);
});
console.log('\nJS 错误:',errs.length?errs:'无');
console.log(bad.length?'❌ '+bad.join('\n❌ '):'✅ 跨页数字自洽');
await b.close()})();
