/* 差异表达：统计必须经得起独立核对。
   ① t 分布 p 值对 R 的 2*pt(-|t|,df) ② BH 校正的定义 ③ 随机数据校正后几乎不剩
   ④ 分组反过来 log2FC 要变号 ⑤ 被独立过滤的 padj 是 NA 不是 1 */
const {chromium}=require('../test-browser.cjs');
(async()=>{const b=await chromium.launch();const p=await b.newPage();
const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto('file://'+process.argv[2]);await p.waitForTimeout(400);
let bad=0;const say=(ok,m)=>{if(!ok)bad++;console.log((ok?'  ✓ ':'  ❌ ')+m)};

/* ① t 分布：拿 R 算好的值来对 */
const T=await p.evaluate(()=>[[2,10],[2.228,10],[1.96,1e6],[3,20],[0.5,5]]
  .map(([t,df])=>tPval(t,df)));
[[2,10,0.073391],[2.228,10,0.050005],[1.96,1e6,0.049998],[3,20,0.007135],[0.5,5,0.638310]]
  .forEach(([t,df,want],i)=>say(Math.abs(T[i]-want)<0.001,
    `t=${t} df=${df} → p=${T[i].toFixed(5)}（R 给 ${want}）`));

/* ② BH：按定义重算一遍 */
const B=await p.evaluate(()=>{
  const ps=[0.001,0.008,0.039,0.041,0.042,0.06,0.074,0.205,0.212,0.216,0.222,0.251,
    0.269,0.275,0.34,0.341,0.384,0.569,0.594,0.696,0.762,0.94,0.942,0.975,0.986];
  return {ps:ps,q:bh(ps)};
});
const ref=(ps=>{const n=ps.length,ix=ps.map((v,i)=>[v,i]).sort((a,b)=>a[0]-b[0]);
  const q=new Array(n);let prev=1;
  for(let k=n-1;k>=0;k--){const v=Math.min(prev,ix[k][0]*n/(k+1));prev=v;q[ix[k][1]]=Math.min(1,v)}
  return q})(B.ps);
say(B.q.every((v,i)=>Math.abs(v-ref[i])<1e-12),'BH 校正和定义一致');
say(B.q.every((v,i,a)=>!i||a[i-1]<=v+1e-12),'BH 结果随 p 单调不减');
say(B.q.every(v=>v>=B.ps[B.q.indexOf(v)]-1e-12||true)&&B.q.every((v,i)=>v>=B.ps[i]-1e-12),
  'padj 不小于原始 p');

/* ③④⑤ 随机矩阵：没有真实差异，校正后应该几乎不剩 */
const R=await p.evaluate(()=>{
  const txt=demoMatrix(400,3,20260113);
  const q=parseTable(txt,'m.csv');
  const g={},gr={};
  q.cols.slice(1).forEach(c=>{g[c.k]=/ctrl/.test(c.k)?'对照':'处理';
    gr[c.k]=/ctrl/.test(c.k)?'处理':'对照'});
  const a=degRun(q.rows,q.cols,g,{padj:0.05,lfc:0,filt:true,minCpm:1});
  const b2=degRun(q.rows,q.cols,gr,{padj:0.05,lfc:0,filt:true,minCpm:1});
  const noFilt=degRun(q.rows,q.cols,g,{padj:0.05,lfc:0,filt:false});
  /* 随机矩阵里每个基因的 CPM 都远高于 1，过滤那条路跑不到。
     把下限抬到中位数上去，强制让一半基因被剔掉，才测得到 NA 那条路。 */
  const bases=a.all.map(x=>x.base).sort((p1,p2)=>p1-p2);
  const med=bases[Math.floor(bases.length/2)];
  const hi=degRun(q.rows,q.cols,g,{padj:0.05,lfc:0,filt:true,minCpm:med});
  const rawSig=a.all.filter(x=>x.p<0.05).length;
  return {ok:a.ok,n:a.all.length,kept:a.kept,filtered:a.filtered,
    sig:a.sig.length,rawSig:rawSig,
    naQ:a.all.filter(x=>x.q==null).length,
    /* 分组互换：同一个基因的 log2FC 要正好相反 */
    flip:a.all.slice(0,50).every((x,i)=>Math.abs(x.lfc+b2.all[i].lfc)<1e-9),
    flipP:a.all.slice(0,50).every((x,i)=>Math.abs(x.p-b2.all[i].p)<1e-12),
    noFiltNa:noFilt.all.filter(x=>x.q==null).length,
    hiFiltered:hi.filtered, hiNa:hi.all.filter(x=>x.q==null).length,
    hiKept:hi.kept, hiNaNotOne:hi.all.filter(x=>x.q==null).every(x=>x.q!==1),
    /* 独立过滤对**单个基因**的 padj 没有单调性保证：检验数少了（分母小），
       但这个基因在剩下那批里的排名也变了（分子的 j 小了）。两边一起动，哪边赢不一定。
       我连着写错了两版断言——先说「最小 padj 一定变小」，再说「每个都不会变大」，
       两个都是想当然。能验的只有定义本身：
       剩下那批的 padj，必须正好等于在这批 p 值上重算一遍 BH。 */
    bhOnKept:(()=>{const kept=hi.all.filter(x=>x.q!=null);
      const ps=kept.map(x=>x.p);
      const n=ps.length,ix=ps.map((v,i)=>[v,i]).sort((p1,p2)=>p1[0]-p2[0]);
      const q=new Array(n);let prev=1;
      for(let k=n-1;k>=0;k--){const v=Math.min(prev,ix[k][0]*n/(k+1));prev=v;q[ix[k][1]]=Math.min(1,v)}
      return {n:n, 一致:kept.every((x,i)=>Math.abs(x.q-q[i])<1e-12)}})(),
    掉队的:(()=>{const keep={};hi.all.forEach(x=>{if(x.q!=null)keep[x.id]=1});
      return a.all.filter(x=>x.q!=null&&!keep[x.id]).length})()};
});
say(R.ok,'随机矩阵跑得通');
say(R.n>=380,`算出 ${R.n} 个基因的 p 值`);
say(R.rawSig>0,`未校正时有 ${R.rawSig} 个 p<0.05（${(R.rawSig/R.n*100).toFixed(1)}%，随机数据下本就该有约 5%）`);
say(R.sig<=2,`BH 校正之后只剩 ${R.sig} 个显著——随机数据就该是这样`);
say(R.naQ===R.filtered,`被独立过滤的 ${R.filtered} 个基因 padj 是 NA（不是 1）`);
say(R.hiFiltered>50,`把下限抬到中位数：剔掉了 ${R.hiFiltered} 个基因（这条路真的跑到了）`);
say(R.hiNa===R.hiFiltered,`剔掉的 ${R.hiFiltered} 个 padj 全是 NA`);
say(R.hiNaNotOne,'被剔掉的 padj 写的是 NA，不是 1');
say(R.hiKept+R.hiFiltered===R.n,`留下 ${R.hiKept} + 剔掉 ${R.hiFiltered} = 总共 ${R.n}`);
say(R.bhOnKept.一致,
  `剩下的 ${R.bhOnKept.n} 个基因，padj 正好等于在这批 p 值上重算一遍 BH`
  +'——过滤之后校正只在留下的那批里做，没有拿被剔掉的去充分母');
say(R.掉队的>0,
  `同时也有 ${R.掉队的} 个基因被滤掉、不再有 padj——独立过滤是拿「少测几个」`
  +'换「校正松一点」，它也会剔掉真发现，这个代价要测得到');
say(R.noFiltNa===0,'关掉独立过滤之后没有 NA');
say(R.flip,'对照和处理互换，log2FC 正好变号');
say(R.flipP,'互换之后 p 值不变（双尾检验本该如此）');

console.log(bad?`\n❌ ${bad} 项对不上`:'\n✅ 差异表达的统计经得起独立核对');
console.log('JS 错误:',errs.length?errs.slice(0,3):'无');
if(bad||errs.length)process.exitCode=1;
await b.close()})();
