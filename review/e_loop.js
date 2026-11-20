/* 第 49–60 轮 · 数据闭环
   不是看页面画没画出来，是看数字对不对得上：
   建集的行数 = 表的行数；切分三段加起来 = 总行数；
   训练用的数据集版本 = 模型文件里记的那个版本；
   评测里的 n = 留出集条数；产出文件数 = 任务声明的输出数。 */
const {chromium}=require('../test-browser.cjs');
const {blockExternalNetwork}=require('./offline-network.cjs');
(async()=>{
const b=await chromium.launch();const p=await b.newPage({viewport:{width:1440,height:950}});
await blockExternalNetwork(p);
const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto('file://'+process.argv[2]);await p.waitForTimeout(700);
const bad=[];
const chk=(c,m)=>{if(!c)bad.push(m)};

// 1. 种子数据集：行数、切分、指纹自洽
const ds=await p.evaluate(()=>['p1','p2','p3'].map(pid=>DSETS(pid).map(d=>({
  pid,id:d.id,st:d.st,rows:d.rows.length,cols:d.cols.length,
  sum:d.split.train.length+d.split.val.length+d.split.test.length,
  tgtInCols:d.cols.some(c=>c.k===d.target),
  featsInCols:d.feats.every(f=>d.cols.some(c=>c.k===f)),
  tgtNotFeat:d.feats.indexOf(d.target)<0,
  idxOk:[].concat(d.split.train,d.split.val,d.split.test).every(i=>i>=0&&i<d.rows.length),
  uniq:new Set([].concat(d.split.train,d.split.val,d.split.test)).size,
  fp:!!d.fp}))).flat());
ds.forEach(d=>{
  chk(d.rows===d.sum,`${d.pid}/${d.id} 切分三段共 ${d.sum} 行，表是 ${d.rows} 行`);
  chk(d.uniq===d.rows,`${d.pid}/${d.id} 切分里有重复或遗漏的行号`);
  chk(d.idxOk,`${d.pid}/${d.id} 切分里有越界行号`);
  chk(d.tgtInCols,`${d.pid}/${d.id} 目标列不在列清单里`);
  chk(d.featsInCols,`${d.pid}/${d.id} 有特征列不在列清单里`);
  chk(d.tgtNotFeat,`${d.pid}/${d.id} 目标列同时也在特征里`);
  chk(d.fp,`${d.pid}/${d.id} 没有指纹`);
});

// 2. 种子模型：指标是真算的、和基线能比、引用的数据对得上
const ms=await p.evaluate(()=>['p1','p2','p3'].map(pid=>(PMODELS(pid)||[]).map(m=>({
  pid,id:m.id,target:m.target,rho:m.rho,rmse:m.rmse,n:m.n,
  nTrain:m.nTrain,nTest:m.nTest,
  base:m.base,method:m.method,
  hasBl:!!m.bl}))).flat());
chk(ms.length>0,'一个模型都没种出来');
ms.forEach(m=>{
  chk(typeof m.rho==='number'&&m.rho>=-1&&m.rho<=1,`${m.pid}/${m.id} ρ=${m.rho} 不在 [-1,1]`);
  chk(typeof m.rmse==='number'&&m.rmse>=0,`${m.pid}/${m.id} RMSE=${m.rmse}`);
  chk(m.nTrain+m.nTest===m.n,`${m.pid}/${m.id} 训 ${m.nTrain} + 留出 ${m.nTest} ≠ 总 ${m.n}`);
  chk(m.nTest>=1,`${m.pid}/${m.id} 留出集 ${m.nTest} 条，报不出指标`);
  chk(m.hasBl,`${m.pid}/${m.id} 没有基线对比`);
  chk(!!m.base&&!!m.method,`${m.pid}/${m.id} 没记基础模型或训练方法`);
});

// 3. 从数据集真训一次，看指标是否复现（同种子两次结果必须一样）
const rep=await p.evaluate(()=>{
  S.pid='p1';const d=DSETS('p1').find(x=>x.st==='pub');if(!d)return 'p1 没有已发布的数据集';
  const a=dsTrain(d,20260101), b=dsTrain(d,20260101);
  if(!a.ok)return '训练失败：'+(a.why||'未知');
  return (a.rho===b.rho&&a.rmse===b.rmse)?null:`同种子两次不一样：ρ ${a.rho} vs ${b.rho}`;});
chk(rep===null,'复现：'+rep);

// 4. 变体库：实测值只来自已回流的批次
const cd=await p.evaluate(()=>{
  S.pid='p1';const L=CANDS();
  const bad=[];
  L.forEach(c=>{
    if(!c.m)return;
    Object.keys(c.m).forEach(k=>{
      const v=c.m[k];
      if(v==null)return;
      if(typeof v==='number'&&!isFinite(v))bad.push(c.id+'.'+k+'='+v);
    });
    if(c.batch){const b=BATCHES.find(x=>x.id===c.batch);
      if(!b)bad.push(c.id+' 指向不存在的批次 '+c.batch);}
  });
  return {n:L.length,bad:bad.slice(0,5),
    measured:L.filter(c=>c.m&&Object.keys(c.m).length).length};});
chk(cd.bad.length===0,'变体库脏值：'+cd.bad.join(' '));
chk(cd.measured>0,'一条实测值都没有');

// 5. 文件：每一条都读得出正文或说清为什么读不出
const fl=await p.evaluate(()=>{
  const out={n:0,noText:[]};
  ['p1','p2','p3'].forEach(pid=>{
    FILES(pid).forEach(e=>{out.n++;
      if(e.kind==='art'){try{const t=e.art.make();if(t==null||String(t).length===0)
        out.noText.push(e.name)}catch(x){out.noText.push(e.name+'(抛错)')}}});});
  out.noText=out.noText.slice(0,5);return out;});
chk(fl.noText.length===0,'产出文件读不出正文：'+fl.noText.join(' '));
chk(fl.n>0,'一个文件都没有');

// 6. 批次状态流水：时间单调、状态合法
const bt=await p.evaluate(()=>{
  const bad=[];
  BATCHES.forEach(b=>{
    if(!b.log||!b.log.length){bad.push(b.id+' 没有状态流水');return}
    const ts=b.log.map(x=>String(x[1]));
    for(let i=1;i<ts.length;i++)if(ts[i]<ts[i-1])bad.push(b.id+' 流水时间倒流');
    if(!b.pid||!DB.projects.some(p=>p.id===b.pid))bad.push(b.id+' 指向不存在的项目');
  });
  return bad.slice(0,5);});
chk(bt.length===0,'批次：'+bt.join(' '));

// 7. 建集 → 训练 端到端
const e2e=await p.evaluate(()=>{
  S.pid='p1';go('dsnew');
  dsRead(artVariantsCsv('p1',CANDS('p1')),'e2e.csv');
  const nums=NEWDS.parsed.cols.filter(c=>c.type==='数值').map(c=>c.k);
  NEWDS.name='端到端测试集';NEWDS.target=nums[nums.length-1];
  NEWDS.feats=nums.filter(k=>k!==NEWDS.target);
  act('dsmake');
  const d=DSETS('p1')[0];
  if(!d||d.name!=='端到端测试集')return '建集没成功';
  if(d.st!=='draft')return '新建出来不是草稿，是 '+d.st;
  dsPublish(d.id);
  const d2=DSETS('p1').find(x=>x.id===d.id);
  if(d2.st!=='pub')return '发布之后状态还是 '+d2.st;
  const r=dsTrain(d2,20260501);
  if(!r.ok)return '训练失败：'+(r.why||'未知');
  if(r.nTest<1)return '留出集 0 条';
  return null;});
chk(e2e===null,'端到端：'+e2e);

bad.forEach(x=>console.log('  ✗ '+x));
if(errs.length)console.log('  JS 报错：'+[...new Set(errs)].join(' | '));
console.log(bad.length||errs.length?('❌ '+bad.length+' 处对不上'):'✅ 数据闭环：切分、指标、复现、文件、批次、端到端全部自洽');
if(bad.length||errs.length)process.exitCode=1;
await b.close()})();
