/* 轮次一：种子数据能不能被研究员当真。只看 DB 的数，不看界面。 */
const {chromium}=require('../test-browser.cjs');
(async()=>{
const b=await chromium.launch();const p=await b.newPage();
const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto('file://'+process.argv[2],{waitUntil:'load'});
await p.waitForTimeout(600);
const r=await p.evaluate(()=>{
  const C=DB.cands,out={};
  const z=a=>{const m=a.reduce((s,x)=>s+x,0)/a.length;
    const sd=Math.sqrt(a.reduce((s,x)=>s+(x-m)*(x-m),0)/a.length)||1;return a.map(x=>(x-m)/sd)};
  const corr=(a,bb)=>{const x=z(a),y=z(bb);return +(x.reduce((s,v,i)=>s+v*y[i],0)/x.length).toFixed(3)};
  const rng=a=>a.length?[+Math.min(...a).toPrecision(3),+Math.max(...a).toPrecision(3),a.length]:null;
  out.量级={};
  ['p1','p2','p3'].forEach(pid=>{const s=C.filter(c=>c.pid===pid);if(!s.length)return;
    const g=f=>rng(s.map(f).filter(x=>typeof x==='number'&&isFinite(x)));
    out.量级[pid]={n:s.length,iptm:g(c=>c.iptm),rmsd:g(c=>c.rmsd),dev:g(c=>c.dev),
      dTm:g(c=>c.m&&c.m.dTm),kd:g(c=>c.m&&c.m.kd),kcat:g(c=>c.m&&c.m.kcat),km:g(c=>c.m&&c.m.km),
      有实测:s.filter(c=>c.m&&Object.keys(c.m).length).length};});
  out.预测对实测=[];
  [['iptm','kd'],['iptm','dTm'],['dev','kd'],['dims.aff','kd'],['dims.str','dTm'],['rmsd','dTm']].forEach(([a,bb])=>{
    const get=(c,k)=>k.indexOf('.')>0?(c.dims||{})[k.split('.')[1]]:(c[k]!==undefined?c[k]:(c.m||{})[k]);
    const s=C.filter(c=>typeof get(c,a)==='number'&&typeof (c.m||{})[bb]==='number');
    const lg=(k,v)=>(k==='kd'||k==='km')?Math.log10(v):v;   // 对数字段在对数空间比
    if(s.length>8)out.预测对实测.push([a,bb,s.length,corr(s.map(c=>get(c,a)),s.map(c=>lg(bb,c.m[bb])))]);});
  out.维度之间=[];
  const DK=['seq','str','con','aff','dev'];
  for(let i=0;i<DK.length;i++)for(let j=i+1;j<DK.length;j++){
    const s=C.filter(c=>c.dims&&typeof c.dims[DK[i]]==='number'&&typeof c.dims[DK[j]]==='number');
    if(s.length>8){const v=corr(s.map(c=>c.dims[DK[i]]),s.map(c=>c.dims[DK[j]]));
      if(Math.abs(v)>0.9)out.维度之间.push([DK[i],DK[j],s.length,v]);}}
  // 单位：野生型是什么，界面写的是什么
  out.野生型参照=(typeof WT!=='undefined')?WT:(typeof PRJ_WT!=='undefined'?Object.keys(PRJ_WT):'没有 WT 常量');
  out.遗留字段=['pos','from','to','mut'].map(k=>{
    const 多突变 = C.filter(c=>(c.muts||[]).length>1);
    const 对不上 = 多突变.filter(c=>k==='pos'?c.pos!==+(/\d+/.exec(c.muts[0])||[0])[0]:false);
    return [k, C.filter(c=>c[k]!==undefined).length, k==='pos'?'多突变里和第一个突变对不上 '+对不上.length:''];});
  out.突变问题=[];
  C.forEach(c=>(c.muts||[]).forEach(m=>{const mm=/^([A-Z])(\d+)([A-Z])$/.exec(m);
    if(!mm)out.突变问题.push([c.id,m,'格式']);
    else if(mm[1]===mm[3])out.突变问题.push([c.id,m,'同义']);}));
  out.轮次倒挂=(()=>{const by={};C.forEach(c=>by[c.id]=c);
    return C.filter(c=>c.parent&&by[c.parent]&&!(c.firstRound>by[c.parent].firstRound)).map(c=>c.id)})();
  out.批次时间戳=(typeof DB.batches!=='undefined')?DB.batches.slice(0,2):'没有 DB.batches';
  return out;
});
console.log(JSON.stringify(r,null,1));
console.log('JS错误:',errs.length?errs:'无');
await b.close()})();
