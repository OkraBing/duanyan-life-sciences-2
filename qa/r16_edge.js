/* R16 · 退化要诚实：数据不够时，产品该说「算不出」，不该给一个好看的 0。
   这一轮专查这次新加的派生量：预览条数、设计预计、板位、MSA、下载、文件类型、轮次、返回。 */
const {chromium}=require('../test-browser.cjs');
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1440,height:1000}});
const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto('file://'+process.argv[2]);await p.waitForTimeout(400);
const R=await p.evaluate(()=>{
  const bad=[],ok=[];
  const say=(c,m)=>{(c?ok:bad).push(m)};
  /* 用产品自己「新建项目」写出来的那个对象，一字不差——
     手搓一个缺字段的假项目，查出来的全是探针自己的毛病。
     这里要查的是：用户刚建完第一个项目，什么都还没跑，这时每一页长什么样。 */
  const T=PTYPES[0], D=DOMAINS[0], id='pX';
  DB.projects.push({id:id,name:'刚建的项目',target:T.n,ptype:T.k,dom:D.k,
    fields:T.f.slice(),tcp:null,desc:'',
    state:'active',model:'—',variants:0,returned:0,ink:0,owner:'我',updated:'刚刚',
    kb:[],tools:[],
    rounds:[{i:1,state:'open',v:0,r:0,mb:'—',ma:'—',note:'还没有开始',ctrl:0,failed:0,
      plan:{host:'',assay:[],reps:'n = 3',buffer:'',temp:''}}]});
  S.pid=id;S.round=1;fixRound();

  say(S.round!=null&&isFinite(S.round),'空项目的轮次：'+S.round);
  say(gateRate()===null,'没有候选时 gateRate()='+JSON.stringify(gateRate()));
  say(dfPreviewN()===null,'没有候选时 dfPreviewN()='+dfPreviewN());
  say(desEst()===null,'没有历史时 desEst()='+JSON.stringify(desEst()));
  say(isFinite(plateCap())&&plateCap()>0,'空项目 plateCap()='+plateCap());
  const m=msaOf();say(isFinite(m.total)&&m.total>=0,'空项目 MSA total='+m.total);
  say(!dlReady({id:'T-none',st:'done',pid:'pX',cap:'des'}),'没有产物时不画下载键');
  say(fileType({kind:'art',cap:'zzz'})==='etc','没登记的能力归「其他」');
  say(dfN()>0&&isFinite(dfN()),'空项目 dfN()='+dfN());

  // 全视图渲染，抓 NaN / undefined / null 字样
  const dirty=[];
  Object.keys(V).forEach(rt=>{
    try{go('home');go(rt)}catch(e){dirty.push(rt+' THROW '+e.message);return}
    const t=document.getElementById('view').innerText;
    if(/NaN|undefined|\[object |Infinity/.test(t))
      dirty.push(rt+' → '+(t.match(/.{0,34}(NaN|undefined|\[object |Infinity).{0,24}/)||[])[0]);
  });
  // 还原
  DB.projects.pop();S.pid='p1';fixRound();
  return {bad,ok,dirty};
});
R.ok.forEach(x=>console.log('   ✓ '+x));
if(R.bad.length){console.log('\n❌ 退化不诚实 '+R.bad.length+' 处');R.bad.forEach(x=>console.log('   '+x))}
if(R.dirty.length){console.log('\n❌ 渲染出脏值 '+R.dirty.length+' 处');R.dirty.forEach(x=>console.log('   '+x))}
if(!R.bad.length&&!R.dirty.length)console.log('\n✅ 空项目下每个派生量都退化得诚实，全视图无脏值');
else process.exitCode=1;
console.log('JS 错误:',errs.length?errs:'无');
await b.close()})();
