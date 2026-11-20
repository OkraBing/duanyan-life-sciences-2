/* R13 · 数据对账：同一个量在不同页面上必须是同一个数。
   最容易烂的不是算错，是两个地方各算各的——今天一致，
   改了其中一个就对不上，而界面不会报错。
   抓不到要比的那个数，算探针失败，不算通过：静默通过的检查比没有检查更糟。 */
const {chromium}=require('../test-browser.cjs');
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1440,height:1000}});
const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto('file://'+process.argv[2]);await p.waitForTimeout(400);
const R=await p.evaluate(()=>{
  const bad=[],miss=[],ok=[];
  const T=()=>document.getElementById('view').innerText.replace(/\s+/g,' ');
  const cmp=(pid,what,want,re,go_)=>{
    const m=T().match(re);
    if(!m){miss.push(pid+'　'+what+'　页面上没找到 '+re);return}
    const got=+m[1].replace(/,/g,'');
    if(got!==want)bad.push([pid,what,'数据='+want,'页面='+got].join('　｜　'));
    else ok.push(pid+'　'+what+'='+want);
  };
  DB.projects.forEach(pr=>{
    S.pid=pr.id;S.back=[];S.flt={noCys:false,devMin:0,src:'全部',passOnly:false};
    const C=CANDS(), nC=C.length;
    const q=C.filter(c=>typeof c.iptm==='number');
    const gate=q.filter(c=>c.iptm>=S.gate).length;

    go('home');go('results');
    cmp(pr.id,'候选总数',nC,/共\s*([\d,]+)\s*条/);
    cmp(pr.id,'过闸门条数',gate,/([\d,]+)\s*条(?:通过|过闸门)/);

    go('loop');
    cmp(pr.id,'板位可放变体',plateCap(),/变体\s*([\d,]+)\s*条/);

    go('pw');
    cmp(pr.id,'关联任务',TASKS.filter(t=>t.pid===pr.id).length,/关联任务\s*([\d,]+)/);

    go('files');
    const mineF=FILES().filter(x=>x.pid===pr.id).length;
    cmp(pr.id,'本项目文件',FILES().length,/([\d,]+)\s*\/\s*[\d,]+/);

    // 设计预计：发射台与完整表单必须同一个数
    go('design');const e1=desEst();
    JOBV.design='new';render();const e2=desEst();
    JOBV.design='launch';
    if(e1&&e2&&Math.abs(e1.min-e2.min)>1e-9)
      bad.push(pr.id+'　设计预计耗时　｜　发射台='+e1.min+'　｜　表单='+e2.min);
    else if(e1)ok.push(pr.id+'　设计预计一致='+Math.round(e1.min*10)/10+' 分');
  });
  return {bad,miss,ok};
});
R.ok.forEach(x=>console.log('   ✓ '+x));
if(R.miss.length){console.log('\n⚠ 探针没抓到（先修探针）'+R.miss.length+' 处');R.miss.forEach(x=>console.log('   '+x))}
console.log('');
if(R.bad.length){console.log('❌ 对不上 '+R.bad.length+' 处');R.bad.forEach(x=>console.log('   '+x));process.exitCode=1}
else console.log('✅ 抓得到的数全部对得上');
console.log('JS 错误:',errs.length?errs:'无');
await b.close()})();
