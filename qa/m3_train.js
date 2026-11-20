/* 训练这块最容易出假象，所以逐条验：
   ① 留出集真的没参与任何一步 ② 基线和模型用同一个留出集
   ③ 单特征基线是在训练集上挑的 ④ 同种子同切分可复现 ⑤ 数据集指纹认得出内容变化 */
const {chromium}=require('../test-browser.cjs');
(async()=>{const b=await chromium.launch();const p=await b.newPage();
const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto('file://'+process.argv[2]);await p.waitForTimeout(400);
let bad=0;const say=(ok,m)=>{if(!ok)bad++;console.log((ok?'  ✓ ':'  ❌ ')+m)};

const r=await p.evaluate(()=>{
  const A=trainRun('p1','dTm',0.75,null,20260113);
  const B=trainRun('p1','dTm',0.75,null,20260113);
  const C=trainRun('p1','dTm',0.75,null,777);
  /* 建两个数据集：内容相同 / 内容差一行 */
  const csv=artVariantsCsv('p1',CANDS());
  const q1=parseTable(csv,'a.csv');
  const q2=parseTable(csv.split('\n').slice(0,-2).join('\n')+'\n','a.csv');
  const sp1=makeSplit(q1.rows.length,[0.7,0.15,0.15],20260113);
  const sp2=makeSplit(q1.rows.length,[0.7,0.15,0.15],20260113);
  const sp3=makeSplit(q1.rows.length,[0.7,0.15,0.15],999);
  const ds={id:'T',rows:q1.rows,cols:q1.cols,target:'dTm_℃',
    feats:['iptm','rmsd','kd_pM'],split:sp1,ratio:[0.7,0.15,0.15],seed:1,fp:q1.fp};
  const D=dsTrain(ds,{});
  return {A:{rho:A.rho,rmse:A.rmse,nTr:A.nTrain,nTe:A.nTest,lam:A.lam,
      base:A.base.map(x=>({n:x.n,rmse:x.rmse,rho:x.rho})),
      pred:A.pred.length,act:A.act.length,w:A.w.length,cols:A.cols.length},
    同种子一致:JSON.stringify([A.rho,A.rmse,A.lam])===JSON.stringify([B.rho,B.rmse,B.lam]),
    换种子不同:JSON.stringify([A.rho,A.rmse])!==JSON.stringify([C.rho,C.rmse]),
    指纹相同:q1.fp===parseTable(csv,'a.csv').fp,
    指纹不同:q1.fp!==q2.fp,
    切分同种子一致:JSON.stringify(sp1)===JSON.stringify(sp2),
    切分换种子不同:JSON.stringify(sp1)!==JSON.stringify(sp3),
    切分无重叠:(()=>{const s=new Set();let dup=0;
      [].concat(sp1.train,sp1.val,sp1.test).forEach(i=>{if(s.has(i))dup++;s.add(i)});
      return dup===0&&s.size===q1.rows.length})(),
    D:D.ok?{rho:D.rho,rmse:D.rmse,lam:D.lam,lamBy:D.lamBy,nVal:D.nVal,
      base:D.base.length,cols:D.cols.length,w:D.w.length}:{why:D.why}};
});

say(r.A.pred===r.A.nTe&&r.A.act===r.A.nTe,`预测与实测各 ${r.A.pred} 条，等于留出集 ${r.A.nTe} 条`);
say(r.A.w===r.A.cols,`权重 ${r.A.w} 个对上列名 ${r.A.cols} 个`);
say(r.A.base.length===2,`算了 ${r.A.base.length} 条基线（应为 2）`);
say(r.A.base[0].rho===null,'常数基线的 ρ 是 null，不是 0');
say(r.A.base.every(x=>isFinite(x.rmse)),'两条基线的 RMSE 都算得出来');
say(/训练集上选/.test(r.A.base[1].n),`单特征基线在训练集上挑：「${r.A.base[1].n}」`);
say(r.同种子一致,'同种子两次训练结果完全一致');
say(r.换种子不同,'换种子结果会变（说明切分真的在用种子）');
say(r.指纹相同,'同内容指纹相同');
say(r.指纹不同,'差一行指纹就不同');
say(r.切分同种子一致,'同种子切分一致');
say(r.切分换种子不同,'换种子切分不同');
say(r.切分无重叠,'训/验/留出三段无重叠且覆盖全部行');
say(r.D.rho!=null,'数据集也能训'+(r.D.why?'：'+r.D.why:''));
if(r.D.rho!=null){
  say(r.D.w===r.D.cols,`数据集模型权重 ${r.D.w} 个对上列名 ${r.D.cols} 个`);
  say(/验证集/.test(r.D.lamBy),`λ 在验证集上选：「${r.D.lamBy}」`);
  say(r.D.nVal>=3,`验证集 ${r.D.nVal} 行，够用来选 λ`);
}
console.log(bad?`\n❌ ${bad} 项不对`:'\n✅ 留出集干净、基线齐、切分可复现、指纹认得出内容变化');
console.log('JS 错误:',errs.length?errs.slice(0,3):'无');
if(bad||errs.length)process.exitCode=1;
await b.close()})();
