/* 第 5 轮 · 走一遍真实研究动作：产物能不能真的流到下一步，
   以及新建一个任务之后，四个该看到它的地方是不是都看到了。 */
const {chromium}=require('../test-browser.cjs');
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1440,height:1000}});
const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto('file://'+process.argv[2]);await p.waitForTimeout(500);
const bad=[];const say=(ok,m,d)=>{console.log((ok?'  ✅ ':'  ❌ ')+m+(d?'　'+d:''));if(!ok)bad.push(m)};

console.log('\n① 每个节点要的字段，上游真的有人产出吗');
let r=await p.evaluate(()=>{
  const out=[];
  Object.keys(PIPE).forEach(cap=>{
    const given={};
    (PIPE[cap]||[]).forEach((nd,i)=>{
      (nd.need||[]).forEach(f=>{
        const up=given[f];
        const fromArt=Object.keys(ARTS).indexOf(f)>=0&&
          TASKS.some(t=>t.st==='done'&&artsOf(t).some(a=>a.f===f));
        const user=fieldSupply(f)==='user';
        out.push({cap,nd:nd.n,f,来源:up?('上一步 '+up):fromArt?'已有产物':user?'你来给':'❌ 没人给'});
      });
      (nd.give||[]).forEach(f=>given[f]=nd.n);
    });
  });
  return out});
r.forEach(x=>console.log('   '+x.cap+' · '+x.nd+' 吃 '+x.f+' ← '+x.来源));
say(!r.some(x=>x.来源.indexOf('❌')>=0),'每个输入字段都有来源');

console.log('\n② 产物接到下一步：结构 → 设计，变体表 → 送检');
r=await p.evaluate(()=>{
  const out={};
  const t1=TASKS.find(t=>t.cap==='str'&&t.st==='done');
  const a1=artsOf(t1).find(a=>a.f==='structure');
  artHandoff(a1,t1.id);go('design');
  out.structure={fed:S.feed&&S.feed.f,note:!!feedNote('des'),
    txt:(document.querySelector('#view .launch')||{innerText:''}).innerText.replace(/\s+/g,' ').slice(0,90)};
  const t2=TASKS.find(t=>t.cap==='des'&&t.st==='done');
  const a2=artsOf(t2).find(a=>a.f==='variants');
  artHandoff(a2,t2.id);go('wet');
  out.variants={fed:S.feed&&S.feed.f,note:!!feedNote('wet')};
  S.feed=null;return out});
say(r.structure.fed==='structure'&&r.structure.note,'结构接到设计上，发射台认得出','「'+r.structure.txt.slice(0,60)+'」');
say(r.variants.fed==='variants'&&r.variants.note,'变体表接到送检上，发射台认得出');

console.log('\n③ 新建一个任务之后，四个地方是不是都看到了它');
r=await p.evaluate(()=>{
  S.pid='p1';S.round=5;go('models');
  PF.seqs=[{t:'protein',copy:1,seq:'MVLSPADKTNVKAAWGKVGAHAGEYGAEALERMFLSFPTTK',mods:0}];
  PF.name='闭环自测';setPick('str','fold','Protenix');PF.model='Protenix';
  act('qkpred');
  const t=TASKS[0];
  const inLaunch=()=>{go('models');return (document.getElementById('view').innerText||'').indexOf(t.n)>=0};
  const inTasks =()=>{go('tasks'); return (document.getElementById('view').innerText||'').indexOf(t.id)>=0};
  const inPw    =()=>{go('pw');S.ptab='tasks';render();return (document.getElementById('view').innerText||'').indexOf(t.n)>=0};
  const inFiles =()=>{go('files');return (document.getElementById('view').innerText||'').indexOf(t.id)>=0};
  return {id:t.id,n:t.n,st:t.st,params:(t.params||[]).length,
    launch:inLaunch(),tasks:inTasks(),pw:inPw(),files:inFiles(),arts:artsOf(t).length}});
console.log('   ',r.id,r.n,'状态',r.st,'参数',r.params,'项');
say(r.launch,'发射台的最近任务里有它');
say(r.tasks,'全部任务里有它');
say(r.pw,'项目的关联任务里有它');
say(r.arts===0&&!r.files,'还在排队，所以文件管理里没有它的产物（对）');
say(r.params>=5,'参数在创建那一刻就记下来了（'+r.params+' 项）');

console.log('\n④ 运行记录产物：记的是提交时那一份，不是现在的配置');
r=await p.evaluate(()=>{
  const t=TASKS[0];const before=JSON.parse(artRunJson(t)).provenance;
  PF.samples=25;PF.recycle=20;setPick('str','fold','ESMFold');render();
  const after=JSON.parse(artRunJson(t)).provenance;
  return {before,after,same:JSON.stringify(before)===JSON.stringify(after)}});
say(r.same,'改了发射台的参数，已建任务的运行记录不变','模型 '+(r.after&&r.after['模型']));

console.log('\nJS 错误:',errs.length?errs:'无');
console.log(bad.length?'\n❌ '+bad.length+' 处':'\n✅ 闭环走得通');
await b.close()})();
