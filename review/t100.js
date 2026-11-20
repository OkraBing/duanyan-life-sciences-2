/* ===== 100 轮 tricky review =====
   按研究员真实走过的路排：研究路线 → 数据上传 → 训练 → 部署调用 → 日常使用。
   每一条用独立浏览器上下文，条内按需真重载；模型一律用桩，不打任何真实接口。 */
const {chromium,testOutput}=require('../test-browser.cjs');
const path=require('path'), fs=require('fs');
const {blockExternalNetwork}=require('./offline-network.cjs');
const F='file://'+path.resolve(process.argv[2]||'index.html');
const ONLY=process.argv[3]||'';
const T=[]; const C=(id,g,name,fn)=>T.push({id,g,name,fn});

const CSV_OK=['variant,kd_nM,dTm_C,expr',
  'WT,12.4,0.0,1.00','A12G,6.1,1.8,0.93','K27E,31.0,-0.4,1.11',
  'T45S,4.8,2.9,0.88','R60Q,19.2,0.6,1.04','L8M,7.7,1.2,0.97'].join('\n');
const TMP=testOutput('t100-fixtures'); fs.mkdirSync(TMP,{recursive:true});
const fx=(n,s)=>{const p=path.join(TMP,n);fs.writeFileSync(p,s);return p};

function H(pg){
  const ev=(f,a)=>pg.evaluate(f,a);
  return {
    ev,
    /* 必须真重载。只换 hash 的话页面不重新执行，NEWDS / S / CONV 这些模块状态
       会带着上一条检查的结果跨过来——「空文件却读出 6 行」就是这么来的。 */
    go:async(h)=>{await pg.goto('about:blank');
      await pg.goto(F+(h||'#chat'));await pg.waitForTimeout(340)},
    local:()=>pg.evaluate(()=>{
      window.DUANYAN_CONFIG={...window.DUANYAN_CONFIG,managedProxy:false};render();
    }),
    stub:(reply,opt)=>pg.evaluate(([r,o])=>{
      MC.save({mode:'direct'});MC.setKey('TESTKEY-not-a-real-credential');
      window.__req=[];
      window.fetch=(u,x)=>{window.__req.push(JSON.parse(x.body));
        return Promise.resolve({ok:true,status:200,json:()=>Promise.resolve(
          {choices:[{message:{content:r}}],usage:{}})})};
      if(o&&o.off){MC.setKey('');window.fetch=()=>Promise.reject(new TypeError('x'))}
    },[reply,opt||null]),
    say:async(t,ms)=>{await pg.fill('#ask',t);await pg.keyboard.press('Enter');
      await pg.waitForTimeout(ms||1500)},
    cards:()=>pg.evaluate(()=>{const L=convOf();
      for(let i=L.length-1;i>=0;i--)if(L[i].role==='ai'&&(L[i].cards||[]).length)
        return L[i].cards.map(c=>({t:c.t,cap:c.cap||null,id:c.id,title:c.title||'',
          fields:(c.fields||[]).map(f=>f.k),go:c.go||'',done:!!c.done}));
      return []}),
    lastTxt:()=>pg.evaluate(()=>{const L=convOf();
      for(let i=L.length-1;i>=0;i--)if(L[i].role==='ai')return L[i]._full||L[i].text||'';
      return ''}),
    set:async(cid,k,v)=>{const sel='[data-kf="'+cid+'.'+k+'"]';
      const el=await pg.$(sel); if(!el)return false;
      const tag=await el.evaluate(e=>e.tagName);
      if(tag==='SELECT')await pg.selectOption(sel,String(v));
      else {await pg.fill(sel,String(v));await pg.dispatchEvent(sel,'change')}
      await pg.waitForTimeout(140);return true},
    submit:async(cid,ms)=>{const b=await pg.$('[data-kgo="'+cid+'"]');
      if(!b)return false; await b.click();await pg.waitForTimeout(ms||1400);return true},
    view:()=>pg.evaluate(()=>document.querySelector('#view').textContent.replace(/\s+/g,' ')),
    nav:async(id)=>{await pg.click('.nav[data-navid="'+id+'"]');await pg.waitForTimeout(400)},
    proj:async(p)=>{await pg.click('[data-proj="'+p+'"]');await pg.waitForTimeout(500)},
    toast:()=>pg.evaluate(()=>{const t=document.querySelector('.toast-host');
      return t?t.textContent.trim():''}),
  };
}

/* ============ A 研究路线（1–30） ============ */
const CAPS=['deg','seek','str','des','lab','primer','sgrna','train','dset','file'];

/* 1–10：十条能力各自的例句必须命中自己，且弹出带控件的卡 */
CAPS.forEach((cap,i)=>C(1+i,'A','例句命中自己 · '+cap,async(pg,h)=>{
  await h.go();
  const eg=await h.ev(c=>ABIL_OF(c).eg,cap);
  const hit=await h.ev(c=>routeIntent(ABIL_OF(c).eg).cap,cap);
  if(hit!==cap)return '自己的例句「'+eg+'」判成了 '+hit;
  await h.say(eg,1800);
  const cs=await h.cards();
  if(!cs.length)return '没出卡';
  const ctl=await h.ev(()=>{const k=[...document.querySelectorAll('.kard:not(.is-skel)')].pop();
    return k?k.querySelectorAll('button,input,select,textarea').length:0});
  if(!ctl)return '卡里一个控件都没有';
}));

/* 11–18：表单能提交并产出结果 */
const SUBS=[
 [11,'deg','比一下处理组和对照组哪些基因变了',true],
 [12,'primer','给这段模板设一对 PCR 引物',false],
 [13,'sgrna','在这段序列上选 sgRNA',false],
 [14,'str','把这条序列折出来',false],
 [15,'des','在这个界面上设计一批结合蛋白',false],
 [16,'lab','把这批候选送去测亲和力',false],
 [17,'train','用这个项目的实测数据训一个打分模型',false],
 [18,'seek','检索和这条序列同源的条目',false]];
SUBS.forEach(([id,cap,q,needFile])=>C(id,'A','表单跑通 · '+cap,async(pg,h)=>{
  await h.go();await h.say(q,1800);
  let cs=await h.cards();
  const form=cs.find(c=>c.t==='form');
  if(!form)return '没出表单卡（出的是 '+cs.map(c=>c.t).join('/')+'）';
  if(needFile){
    const fi=await pg.$('.kard input[type=file]');
    if(!fi)return '要文件却没有文件输入框';
    await fi.setInputFiles(fx('m.csv',CSV_OK));await pg.waitForTimeout(900);
  }
  const okGo=await h.submit(form.id,2600);
  if(!okGo)return '找不到提交按钮';
  const after=await h.cards();
  const grew=JSON.stringify(after)!==JSON.stringify(cs);
  const t=await h.lastTxt();
  if(!grew&&!(await h.toast())&&!t)return '点了提交，什么都没发生';
}));

/* 19–25：路由的刁钻处 */
C(19,'A','性质词归实验不归设计',async(pg,h)=>{await h.go();
  const c=await h.ev(()=>routeIntent('把这批候选送去测亲和力和热稳').cap);
  if(c!=='lab')return '判成了 '+c;});
C(20,'A','「训练集」是对象归 dset',async(pg,h)=>{await h.go();
  const c=await h.ev(()=>routeIntent('把这份训练集传上来').cap);
  if(c!=='dset')return '判成了 '+c;});
C(21,'A','ipTM 不该被当成引物的 tm',async(pg,h)=>{await h.go();
  const c=await h.ev(()=>routeIntent('我想知道 ipTM 是什么意思').cap);
  if(c==='primer')return 'ipTM 把整句判成了引物设计';});
C(22,'A','空输入不发任何东西',async(pg,h)=>{await h.go();
  const n0=await h.ev(()=>convOf().length);
  await pg.fill('#ask','');await pg.keyboard.press('Enter');await pg.waitForTimeout(500);
  const n1=await h.ev(()=>convOf().length);
  if(n1!==n0)return '空输入也往对话里塞了东西';});
C(23,'A','只有空白也不发',async(pg,h)=>{await h.go();
  const n0=await h.ev(()=>convOf().length);
  await h.say('   　  ',600);
  const n1=await h.ev(()=>convOf().length);
  if(n1!==n0)return '全空白也发出去了';});
C(24,'A','超长输入不炸',async(pg,h)=>{await h.go();
  await h.say('差异表达'.repeat(400),2200);
  if(!(await h.cards()).length&&!(await h.lastTxt()))return '超长输入后什么都没有';});
C(25,'A','夹杂表情和换行不炸',async(pg,h)=>{await h.go();
  await h.say('比一下\n处理组 🧬 和对照组\t哪些基因变了',2000);
  const cs=await h.cards(); if(!cs.length)return '没出卡';});

/* 26–30：流程中途的意外 */
/* 侧栏那个「新建对话」点下去本来就该开一段新的，所以不能拿它当「切回去」。
   真正要守的是：开了新的之后，刚才那一段还找得回来，而且卡原样在。 */
C(26,'A','开了新对话，旧的还找得回来且卡没丢',async(pg,h)=>{await h.go();
  await h.say('比一下处理组和对照组哪些基因变了',1800);
  const before=await h.cards(); if(!before.length)return '一开始就没出卡';
  await h.nav('chat');                       // 新建对话
  const now=await h.cards();
  if(now.length)return '开了新对话，上一段的卡还跟过来了';
  const hist=await h.ev(()=>SESSIONS.map(s=>s.id));
  if(!hist.length)return '旧对话没进历史，等于丢了';
  const back=await h.ev(i=>{const s=SESSIONS.find(x=>x.id===i);if(!s)return null;
    openSession(s);return (CONV[S.sid]||[]).filter(m=>m.role==='ai')
      .flatMap(m=>(m.cards||[]).map(c=>c.t))},hist[0]);
  if(!back)return '历史里点不开';
  if(JSON.stringify(back)!==JSON.stringify(before.map(x=>x.t)))
    return '从历史点回去，卡变了：'+JSON.stringify(back)+' vs '+JSON.stringify(before.map(x=>x.t));});
C(27,'A','刷新后对话不假装还在',async(pg,h)=>{await h.go();
  await h.say('比一下处理组和对照组哪些基因变了',1800);
  await h.go();
  const n=await h.ev(()=>convOf().length);
  if(n>0)return '刷新后对话还在，但卡里的运行态是假的';});
C(28,'A','项目页的对话和首页各自独立',async(pg,h)=>{await h.go('#projects');
  await h.proj('p1');
  await h.say('比一下处理组和对照组哪些基因变了',1800);
  const inProj=await h.ev(()=>convOf().length);
  await h.nav('chat');
  const inChat=await h.ev(()=>convOf().length);
  if(inProj>0&&inChat>0&&inProj===inChat)return '两处共用了同一段对话';});
C(29,'A','@ 挂工具改得了路由',async(pg,h)=>{await h.go();
  const ok=await h.ev(()=>{S.useTools=[ABIL[6].n];return S.useTools.length});
  if(!ok)return '挂不上';
  await h.say('随便说点什么',1800);
  const cs=await h.cards();
  if(!cs.length)return '挂了工具也没出卡';});
C(30,'A','十条能力都有 when，提示词里没有空条目',async(pg,h)=>{await h.go();
  const miss=await h.ev(()=>ABIL.filter(a=>!a.when).map(a=>a.id));
  if(miss.length)return '这几条没写 when：'+miss.join(',');
  const p=await h.ev(()=>sysRoute());
  if(p.indexOf('还没写 when')>=0)return '提示词里出现了占位文字';
  for(const c of ['deg','seek','str','des','lab','primer','sgrna','train','dset','file'])
    if(p.indexOf(c+'（')<0)return '提示词里缺 '+c;});

/* ============ B 数据上传（31–50） ============ */
const CSV_HDR='variant,kd_nM\n';
const CSV_DUP='variant,kd_nM,kd_nM\nWT,1,2\nA1G,3,4\n';
const CSV_BAD='variant,kd_nM\nWT,abc\nA1G,def\n';
const dsnew=async h=>{await h.go('#dsnew')};
/* 在页面内直接造 File，不走 Playwright 的 setInputFiles——
   后者在这个容器里传非 ASCII 文件名会**静默失败**：input.files 是空的，
   change 根本不触发，于是看起来像「应用不认中文名」，其实应用是对的。
   在页面里造文件还顺带省掉一次磁盘往返。 */
const upload=async(pg,h,name,body)=>{
  const sel=await pg.$('input[type=file]');
  if(!sel)return '页面上没有文件输入框';
  const ok=await pg.evaluate(([n,t])=>{
    const el=document.querySelector('input[type=file]');if(!el)return false;
    const dt=new DataTransfer();dt.items.add(new File([t],n,{type:'text/csv'}));
    el.files=dt.files;el.dispatchEvent(new Event('change',{bubbles:true}));return true;
  },[name,body]);
  if(!ok)return '放不进文件输入框';
  await pg.waitForTimeout(800);return null};

C(31,'B','传一份正常 CSV，行列数要对得上',async(pg,h)=>{await dsnew(h);
  const e=await upload(pg,h,'ok.csv',CSV_OK); if(e)return e;
  const q=await h.ev(()=>NEWDS.parsed?{rows:NEWDS.parsed.rows.length,cols:NEWDS.parsed.cols.length}:null);
  if(!q)return '传了但没读出来';
  if(q.rows!==6)return '行数读成 '+q.rows+'，实际 6';
  if(q.cols!==4)return '列数读成 '+q.cols+'，实际 4';});
C(32,'B','传个不是表的文件，要说清楚而不是崩',async(pg,h)=>{await dsnew(h);
  await upload(pg,h,'x.txt','这不是表格，只是一段话。');
  const err=await h.ev(()=>NEWDS.err||'');
  const v=await h.view();
  if(!err&&!/读不出来|不是|格式/.test(v))return '既没读出来也没说为什么';});
C(33,'B','空文件',async(pg,h)=>{await dsnew(h);
  await upload(pg,h,'e.csv','');
  const bad=await h.ev(()=>({err:NEWDS.err||'',rows:NEWDS.parsed?NEWDS.parsed.rows.length:null}));
  if(!bad.err&&bad.rows)return '空文件却读出了 '+bad.rows+' 行';});
C(34,'B','只有表头没有数据',async(pg,h)=>{await dsnew(h);
  await upload(pg,h,'h.csv',CSV_HDR);
  const r=await h.ev(()=>({err:NEWDS.err||'',rows:NEWDS.parsed?NEWDS.parsed.rows.length:null}));
  if(!r.err&&r.rows>0)return '没有数据行却读出了 '+r.rows+' 行';});
C(35,'B','重名列不能悄悄吞掉一列',async(pg,h)=>{await dsnew(h);
  await upload(pg,h,'d.csv',CSV_DUP);
  const r=await h.ev(()=>NEWDS.parsed?NEWDS.parsed.cols.map(c=>c.k):null);
  if(r&&r.length===2&&!(await h.ev(()=>NEWDS.err||'')))
    return '三列里重名的两列被合成一列，也没提示';});
C(36,'B','数值列里混了文字',async(pg,h)=>{await dsnew(h);
  await upload(pg,h,'b.csv',CSV_BAD);
  const r=await h.ev(()=>{if(!NEWDS.parsed)return null;
    return NEWDS.parsed.rows.map(x=>x['kd_nM'])});
  if(r&&r.some(x=>x!=null&&x!==''&&typeof x==='number'&&isNaN(x)))return '文字被转成了 NaN 还往下走';});
C(37,'B','传完能选目标列',async(pg,h)=>{await dsnew(h);
  const e=await upload(pg,h,'ok.csv',CSV_OK); if(e)return e;
  const sels=await pg.$$eval('select',e=>e.length);
  if(!sels)return '传完没有任何下拉可选列';});
C(38,'B','数据集 ID 跨项目唯一',async(pg,h)=>{await h.go();
  const ids=await h.ev(()=>{const o=[];DB.projects.forEach(p=>(p.dsets||[]).forEach(d=>o.push(d.id)));return o});
  const dup=ids.filter((x,i)=>ids.indexOf(x)!==i);
  if(dup.length)return '重复的数据集 ID：'+[...new Set(dup)].join(',');});
C(39,'B','草稿不能拿去训',async(pg,h)=>{await h.go();
  const r=await h.ev(()=>{const all=[];DB.projects.forEach(p=>(p.dsets||[]).forEach(d=>all.push(d)));
    const draft=all.filter(d=>d.st!=='pub').map(d=>d.id);
    const usable=(typeof ALL_DSETS==='function'?ALL_DSETS():all).filter(d=>d.st==='pub').map(d=>d.id);
    return {draft:draft,usable:usable}});
  const leak=r.draft.filter(x=>r.usable.indexOf(x)>=0);
  if(leak.length)return '草稿出现在可训练列表里：'+leak.join(',');});
C(40,'B','发布之后内容锁死',async(pg,h)=>{await h.go();
  const r=await h.ev(()=>{const all=[];DB.projects.forEach(p=>(p.dsets||[]).forEach(d=>all.push(d)));
    const pub=all.filter(d=>d.st==='pub')[0];
    if(!pub)return {none:1};
    return {id:pub.id,hasPubAt:!!pub.pubAt,hasSeed:pub.seed!=null,
      hasSplit:!!(pub.split&&pub.split.train&&pub.split.test)}});
  if(r.none)return null;
  if(!r.hasSeed)return r.id+' 没记种子，复现不了';
  if(!r.hasSplit)return r.id+' 没记切分';});
C(41,'B','同一份文件指纹稳定',async(pg,h)=>{await dsnew(h);
  await upload(pg,h,'ok.csv',CSV_OK);
  const a=await h.ev(()=>NEWDS.parsed?NEWDS.parsed.fp:null);
  await dsnew(h);
  await upload(pg,h,'ok.csv',CSV_OK);
  const b=await h.ev(()=>NEWDS.parsed?NEWDS.parsed.fp:null);
  if(a&&b&&a!==b)return '同一份文件两次指纹不同：'+a+' vs '+b;});
C(42,'B','不同文件指纹必须不同',async(pg,h)=>{await dsnew(h);
  await upload(pg,h,'ok.csv',CSV_OK);
  const a=await h.ev(()=>NEWDS.parsed?NEWDS.parsed.fp:null);
  await dsnew(h);
  await upload(pg,h,'ok2.csv',CSV_OK.replace('12.4','99.9'));
  const b=await h.ev(()=>NEWDS.parsed?NEWDS.parsed.fp:null);
  if(a&&b&&a===b)return '改了数指纹却没变：'+a;});
C(43,'B','✖ 移掉文件后回到拖放区',async(pg,h)=>{await dsnew(h);
  await upload(pg,h,'ok.csv',CSV_OK);
  const x=await pg.$('[data-act="dsclear"]'); if(!x)return '没有移除按钮';
  await x.click();await pg.waitForTimeout(500);
  const still=await h.ev(()=>NEWDS.fileName||'');
  if(still)return '点了移除还留着 '+still;});
C(44,'B','移掉之后还能再传',async(pg,h)=>{await dsnew(h);
  await upload(pg,h,'ok.csv',CSV_OK);
  const x=await pg.$('[data-act="dsclear"]'); if(x){await x.click();await pg.waitForTimeout(400)}
  const e=await upload(pg,h,'ok.csv',CSV_OK); if(e)return e;
  const n=await h.ev(()=>NEWDS.parsed?NEWDS.parsed.rows.length:0);
  if(n!==6)return '第二次传读成 '+n+' 行';});
C(45,'B','数据集页能按项目筛',async(pg,h)=>{await h.go();await h.nav('shelf').catch(()=>{});
  await h.go('#dsets');
  const has=await pg.$('#dsproj')||await pg.$('[data-dsproj]');
  if(!has)return '数据集页没有项目筛选器';});
C(46,'B','数据集页默认展示全部项目的',async(pg,h)=>{await h.go('#dsets');
  const r=await h.ev(()=>{const pid=new Set();
    document.querySelectorAll('[data-dspick],[data-dsrow]').forEach(e=>{});
    const all=[];DB.projects.forEach(p=>(p.dsets||[]).forEach(d=>all.push(p.id)));
    return {proj:new Set(all).size}});
  const v=await h.view();
  if(r.proj>1&&!/全部/.test(v))return '多个项目有数据集，页面上却没有「全部」这个选项';});
C(47,'B','上传的文件名原样显示，不被截断成别的词',async(pg,h)=>{await dsnew(h);
  await upload(pg,h,'我的-数据 v2.final.csv',CSV_OK);
  const v=await h.view();
  if(v.indexOf('我的-数据 v2.final.csv')<0)return '文件名没原样出现';});
C(48,'B','传完立刻能看到行列和指纹',async(pg,h)=>{await dsnew(h);
  await upload(pg,h,'ok.csv',CSV_OK);
  const v=await h.view();
  if(!/行/.test(v)||!/列/.test(v))return '没报行列数';
  if(!/指纹/.test(v))return '没报指纹';});
C(49,'B','建数据集页不该混进公共库',async(pg,h)=>{await h.go('#dsnew');
  const v=await h.view();
  if(/已接入的公共库|公共库列表/.test(v))return '建数据集页里混进了公共库';});
C(50,'B','数据集能接到训练',async(pg,h)=>{await h.go('#dsets');
  const b=await pg.$('[data-askthis*="训"]');
  if(!b)return '数据集上没有「在这上面训一个」的去处';});

/* ============ C 训练（51–70） ============ */
const toTrain=async(pg,h)=>{await h.go();await h.say('用这个项目的实测数据训一个打分模型',1900);
  const cs=await h.cards();return cs.find(c=>c.t==='form')||null};

C(51,'C','训练表单出得来，字段齐',async(pg,h)=>{const f=await toTrain(pg,h);
  if(!f)return '没出训练表单';
  for(const k of ['method','target','ratio'])
    if(f.fields.indexOf(k)<0)return '缺字段 '+k;});
C(52,'C','训练方法只有 SFT 和 RL',async(pg,h)=>{await h.go();
  const m=await h.ev(()=>TRAIN_METHOD.map(x=>x.n));
  if(m.length!==2||m.indexOf('SFT')<0||m.indexOf('RL')<0)
    return '训练方法是 '+m.join('/')+'，不是 SFT / RL';});
C(53,'C','没接入的方法要说明为什么',async(pg,h)=>{await h.go();
  const bad=await h.ev(()=>TRAIN_METHOD.filter(x=>!x.ok&&!x.why).map(x=>x.n));
  if(bad.length)return bad.join(',')+' 标了未接入却没说原因';});
C(54,'C','算法记在方法上，没在界面上冒充 SFT',async(pg,h)=>{await h.go();
  const sft=await h.ev(()=>TRAIN_METHOD.find(x=>x.id==='sft'));
  if(!sft.algo||!/岭回归/.test(sft.algo))return 'SFT 没记真实算法';});
C(55,'C','切分滑杆不能滑出非法区间',async(pg,h)=>{const f=await toTrain(pg,h);
  if(!f)return '没出表单';
  await h.set(f.id,'ratio',0.9);
  const r=await h.ev(()=>{const c=convOf().flatMap(m=>m.cards||[]).find(c=>c.t==='form'&&c.cap==='train');
    if(!c)return null;const g=k=>(c.fields.concat(c.adv||[])).find(f=>f.k===k);
    const tr=g('ratio'),va=g('val');
    return {tr:tr?tr.v:null,va:va?{v:va.v,max:va.max}:null}});
  if(r&&r.va&&r.tr!=null&&(r.tr+r.va.max)>0.96)
    return '训练 '+r.tr+' + 验证上限 '+r.va.max+' 已经吃掉留出集';});
C(56,'C','能真的跑起来并出指标',async(pg,h)=>{const f=await toTrain(pg,h);
  if(!f)return '没出表单';
  await h.submit(f.id,3200);
  const cs=await h.cards();
  const has=cs.some(c=>c.t==='run'||c.t==='metric');
  if(!has)return '点了开始训练，没有运行或指标卡：'+cs.map(c=>c.t).join('/');});
C(57,'C','指标必须来自留出集',async(pg,h)=>{await h.go();
  const bad=await h.ev(()=>PMODELS('p1').filter(canScore).filter(m=>!m.ds&&m.rho==null).map(m=>m.id));
  const v=await h.ev(()=>{const m=PMODELS('p1').filter(canScore)[0];return m?Object.keys(m):[]});
  if(v.length&&v.indexOf('rho')<0)return '模型上没有 rho 这个留出指标';});
C(58,'C','同种子同切分可复现',async(pg,h)=>{await h.go();
  const r=await h.ev(()=>{const m=PMODELS('p1').filter(canScore)[0];
    if(!m)return {none:1};return {seed:m.seed!=null,ds:!!m.ds}});
  if(r.none)return null;
  if(!r.seed)return '模型没记种子';});
C(59,'C','两个模型不能共用同一份数据集还报不同目标',async(pg,h)=>{await h.go();
  const r=await h.ev(()=>PMODELS('p1').filter(canScore).map(m=>({id:m.id,ds:m.ds,t:m.target})));
  const by={};let bad='';
  r.forEach(m=>{if(!m.ds)return;if(by[m.ds]&&by[m.ds]!==m.t)bad=m.ds+' 同一份数据集训出了两个目标';
    by[m.ds]=m.t});
  if(bad)return bad;});
C(60,'C','模型 ID 跨项目唯一',async(pg,h)=>{await h.go();
  const ids=await h.ev(()=>{const o=[];DB.projects.forEach(p=>PMODELS(p.id).forEach(m=>o.push(m.id)));return o});
  const dup=ids.filter((x,i)=>ids.indexOf(x)!==i);
  if(dup.length)return '重复的模型 ID：'+[...new Set(dup)].join(',');});
C(61,'C','模型名字要像模型名，不是一串代号',async(pg,h)=>{await h.go();
  const bad=await h.ev(()=>{const o=[];DB.projects.forEach(p=>PMODELS(p.id).forEach(m=>{
    if(!m.name||/^M-\d+$/.test(m.name))o.push(m.id)}));return o});
  if(bad.length)return '这些模型没有可读的名字：'+bad.join(',');});
C(62,'C','基础模型都是真 checkpoint',async(pg,h)=>{await h.go();
  const bad=await h.ev(()=>BASE_MODELS.filter(m=>m.id!=='none'&&!/\//.test(m.ck||'')).map(m=>m.id));
  if(bad.length)return '这些基础模型没有 org/name 形式的 checkpoint：'+bad.join(',');});
C(63,'C','未接入的基础模型不能被选中就跑',async(pg,h)=>{await h.go();
  const r=await h.ev(()=>BASE_MODELS.filter(m=>!m.ok).map(m=>m.id));
  if(!r.length)return null;
  const p=await h.ev(()=>{const c=FLOW.train({}).find(c=>c.t==='form');
    const f=(c.fields||[]).find(f=>f.k==='base');
    return f?(f.opts||[]).join('|'):''});
  if(p&&!/未接入/.test(p))return '未接入的基础模型在下拉里没有标注';});
C(64,'C','训练目标只能是这个项目有的字段',async(pg,h)=>{await h.go();
  const r=await h.ev(()=>{S.pid='p1';const c=FLOW.train({}).find(c=>c.t==='form');
    const f=(c.fields||[]).find(f=>f.k==='target');
    return {opts:f?f.opts:[],fields:projFields(DB.projects.find(p=>p.id==='p1'))}});
  const extra=(r.opts||[]).filter(o=>r.fields.indexOf(o)<0);
  if(extra.length)return '目标里有本项目没有的字段：'+extra.join(',');});
C(65,'C','训练数据直接写明引用了哪份数据集',async(pg,h)=>{await h.go();
  const c=await h.ev(()=>{S.pid='p1';const c=FLOW.train({}).find(c=>c.t==='form');
    return JSON.stringify((c.fields||[]).concat(c.adv||[]))});
  if(!/ds|数据集/.test(c))return '训练表单里看不出用的是哪份数据';});
C(66,'C','正则 λ 的默认是自动，且说明为什么',async(pg,h)=>{await h.go();
  const r=await h.ev(()=>{const c=FLOW.train({}).find(c=>c.t==='form');
    const f=(c.adv||[]).find(f=>f.k==='lam');return f?{v:f.v,hint:f.hint||''}:null});
  if(!r)return 'λ 不在高级项里';
  if(r.v!=='自动')return 'λ 默认不是自动';
  if(!/留出|偷看|折/.test(r.hint))return 'λ 没说明为什么要自动';});
C(67,'C','种子字段必须能写死',async(pg,h)=>{await h.go();
  const r=await h.ev(()=>{const c=FLOW.train({}).find(c=>c.t==='form');
    return (c.adv||[]).some(f=>f.k==='seed')});
  if(!r)return '没有种子字段';});
C(68,'C','训不出可用打分器时要说清楚',async(pg,h)=>{await h.go();
  const r=await h.ev(()=>{const o=[];DB.projects.forEach(p=>PMODELS(p.id).forEach(m=>{
    if(!canScore(m))o.push({id:m.id,why:m.why||m.note||''})}));return o});
  const silent=r.filter(m=>!m.why);
  if(silent.length)return '这些模型不能打分却没说原因：'+silent.map(m=>m.id).join(',');});
C(69,'C','训练卡提交两次不会训出两个一样的',async(pg,h)=>{const f=await toTrain(pg,h);
  if(!f)return '没出表单';
  const n0=await h.ev(()=>PMODELS(S.pid).length);
  await h.submit(f.id,2600);
  const again=await pg.$('[data-kgo="'+f.id+'"]');
  if(again){await again.click();await pg.waitForTimeout(2200);}
  const n1=await h.ev(()=>PMODELS(S.pid).length);
  if(n1-n0>1)return '一张卡提交两次，建出了 '+(n1-n0)+' 个模型';});
C(70,'C','模型制备页列得出已训的',async(pg,h)=>{await h.go('#models');
  const v=await h.view();
  const n=await h.ev(()=>{let c=0;DB.projects.forEach(p=>c+=PMODELS(p.id).length);return c});
  if(n>0&&v.replace(/\s/g,'').length<30)return '有模型但页面几乎是空的';});

/* ============ D 部署与调用（71–85） ============ */
C(71,'D','能把自己训的模型加成工具',async(pg,h)=>{await h.go();
  const ok=await h.ev(()=>typeof toggleMdl==='function'&&typeof MY_TOOLS==='function');
  if(!ok)return '没有「加到模型能力」这套函数';});
C(72,'D','开关只影响被点的那一个',async(pg,h)=>{await h.go();
  const r=await h.ev(()=>{
    const all=[];DB.projects.forEach(p=>PMODELS(p.id).forEach(m=>{if(canScore(m))all.push(m.id)}));
    if(all.length<2)return {few:1};
    LS.set('mdlon',[]);toggleMdl(all[0]);
    return {on:all.filter(mdlOn),first:all[0]}});
  if(r.few)return null;
  if(r.on.length!==1||r.on[0]!==r.first)return '点一个开关，开起来的是 '+r.on.join(',');});
C(73,'D','跨项目同名模型不会被一起打开',async(pg,h)=>{await h.go();
  const r=await h.ev(()=>{
    const byId={};DB.projects.forEach(p=>PMODELS(p.id).forEach(m=>{
      byId[m.id]=(byId[m.id]||0)+1}));
    return Object.keys(byId).filter(k=>byId[k]>1)});
  if(r.length)return '这些模型 ID 在多个项目里重复：'+r.join(',');});
C(74,'D','启用的模型出现在能力清单里',async(pg,h)=>{await h.go();
  const r=await h.ev(()=>{
    const all=[];DB.projects.forEach(p=>PMODELS(p.id).forEach(m=>{if(canScore(m))all.push(m.id)}));
    if(!all.length)return {none:1};
    LS.set('mdlon',[all[0]]);
    return {want:all[0],tools:MY_TOOLS().map(t=>t.id)}});
  if(r.none)return null;
  if(r.tools.indexOf(r.want)<0)return '启用了 '+r.want+' 但工具清单里没有它';});
C(75,'D','不能打分的模型不许被当工具启用',async(pg,h)=>{await h.go();
  const r=await h.ev(()=>{
    const bad=[];DB.projects.forEach(p=>PMODELS(p.id).forEach(m=>{if(!canScore(m))bad.push(m.id)}));
    if(!bad.length)return {none:1};
    LS.set('mdlon',bad);
    return {bad:bad,tools:MY_TOOLS().map(t=>t.id)}});
  if(r.none)return null;
  const leak=r.tools.filter(t=>r.bad.indexOf(t)>=0);
  if(leak.length)return '不能打分的模型混进了工具清单：'+leak.join(',');});
C(76,'D','打分器真能给候选打分',async(pg,h)=>{await h.go();
  const r=await h.ev(()=>{S.pid='p1';const m=PMODELS('p1').filter(canScore)[0];
    if(!m)return {none:1};
    const cs=CANDS().slice(0,5).map(c=>scoreWith(m,c));
    return {vals:cs}});
  if(r.none)return null;
  if(r.vals.some(v=>v==null||(typeof v==='number'&&isNaN(v))))
    return '打分结果里有空值或 NaN：'+JSON.stringify(r.vals);
  if(new Set(r.vals.map(v=>Math.round(v*1e6))).size===1)
    return '五条候选打出同一个分，等于没打';});
C(77,'D','留出 ρ 必须在 [-1,1]',async(pg,h)=>{await h.go();
  const bad=await h.ev(()=>{const o=[];DB.projects.forEach(p=>PMODELS(p.id).forEach(m=>{
    if(typeof m.rho==='number'&&(m.rho<-1||m.rho>1||isNaN(m.rho)))o.push(m.id+':'+m.rho)}));return o});
  if(bad.length)return '越界的 ρ：'+bad.join(',');});
/* 不是每个模型都来自某份已发布的数据集：拿本项目实测值直接训的那一类，
   ds 本来就该是空的。要守的是「说得出数据从哪来」，不是「必须有 ds」。 */
C(78,'D','每个模型都说得出数据从哪来、预测什么',async(pg,h)=>{await h.go('#models');
  const bad=await h.ev(()=>{const o=[];
    DB.projects.forEach(p=>PMODELS(p.id).forEach(m=>{
      if(!(m.ds||m.src))o.push(m.id+' 没记数据来源');
      if(!m.target)o.push(m.id+' 没记预测目标');
      if(m.seed==null)o.push(m.id+' 没记种子');
      if(!canScore(m)&&!whyNoScore(m))o.push(m.id+' 打不了分却说不出原因');}));
    return o});
  if(bad.length)return bad.join('；');});
C(79,'D','启用状态能持久化',async(pg,h)=>{await h.go();
  const id=await h.ev(()=>{const all=[];
    DB.projects.forEach(p=>PMODELS(p.id).forEach(m=>{if(canScore(m))all.push(m.id)}));
    if(!all.length)return null;LS.set('mdlon',[all[0]]);return all[0]});
  if(!id)return null;
  await h.go();
  const on=await h.ev(i=>mdlOn(i),id);
  if(!on)return '刷新之后启用状态丢了';});
C(80,'D','模型接入的新旧入口一致，统一代理固定且本机配置可持久化',async(pg,h)=>{await h.go();
  await h.nav('mdl');await pg.click('[data-mtab="set"]');
  const entry=await h.ev(()=>({route:S.route,tab:S.mtab,
    selected:document.querySelector('[data-mtab="set"]')?.getAttribute('aria-selected')}));
  if(entry.route!=='mdl'||entry.tab!=='set'||entry.selected!=='true')
    return '模型制备的子导航未进入模型接入';
  await h.go('#set');
  const bookmark=await h.ev(()=>({route:S.route,tab:S.mtab,hash:location.hash}));
  if(bookmark.route!=='mdl'||bookmark.tab!=='set'||bookmark.hash!=='#mdl')
    return '旧 #set 书签没有迁移到模型接入: '+JSON.stringify(bookmark);
  const wasManaged=await h.ev(()=>MC.isManaged());
  if(wasManaged){
    const config=await h.ev(()=>{const before=MC.cfg();
      MC.save({mode:'direct',endpoint:'https://invalid.example/api/model/chat'});
      return {before,after:MC.cfg()}});
    if(config.after.mode!=='proxy'||config.after.endpoint!==config.before.endpoint)
      return '公开站点可被切成直连或改掉代理';
    if(await pg.$('[data-mmode],#mkey,#mep'))return '公开设置页暴露了接入切换或密钥/地址字段';
  }
  await pg.selectOption('#mn','deepseek-v4-pro');await h.go('#set');
  if(await h.ev(()=>MC.cfg().name)!=='deepseek-v4-pro')return '刷新后丢失模型选择';
  await h.local();
  await pg.click('[data-mmode="direct"]');await pg.waitForTimeout(300);
  await h.go('#set');await h.local();
  const mode=await h.ev(()=>MC.cfg().mode);
  if(mode!=='direct')return '本机刷新后接入方式回到了 '+mode;});
C(81,'D','代理模式不带凭据',async(pg,h)=>{await h.go('#set');
  const r=await h.ev(async()=>{const log=[];const real=window.fetch;
    window.fetch=(u,o)=>{log.push({u:String(u),auth:!!((o&&o.headers||{})['Authorization'])});
      return Promise.reject(new TypeError('stub'))};
    MC.save({mode:'proxy'});
    try{await MC.chat([{role:'user',content:'x'}])}catch(e){}
    window.fetch=real;return log[0]||null});
  if(!r)return '代理模式没发出请求';
  if(r.auth)return '代理模式带上了 Authorization';});
C(82,'D','没密钥时直连一次都不发',async(pg,h)=>{await h.go('#set');await h.local();
  const r=await h.ev(async()=>{let n=0;const real=window.fetch;
    window.fetch=()=>{n++;return Promise.reject(new TypeError('stub'))};
    MC.save({mode:'direct'});MC.setKey('');
    let err='';try{await MC.chat([{role:'user',content:'x'}])}catch(e){err=e.message}
    window.fetch=real;return {n:n,err:err}});
  if(r.n!==0)return '没密钥还发了 '+r.n+' 次';
  if(r.err!=='NOKEY')return '抛的不是 NOKEY，是 '+r.err;});
C(83,'D','本机测试密钥不进 DOM，保存到站点隔离的存储',async(pg,h)=>{await h.go('#set');await h.local();
  await pg.click('[data-mmode="direct"]');await pg.waitForTimeout(300);
  await pg.fill('#mkey','TESTKEY-not-a-real-credential');
  await pg.click('[data-act="mkeysave"]');await pg.waitForTimeout(400);
  const r=await h.ev(()=>({dom:document.documentElement.innerHTML.indexOf('TESTKEY-not-a-real')>=0,
    ls:localStorage.getItem('dy_life_ds_key')==='TESTKEY-not-a-real-credential'}));
  if(r.dom)return '密钥出现在 DOM 里';
  if(!r.ls)return '密钥没存进 localStorage';});
C(84,'D','换密钥要作废上一次的连通结论',async(pg,h)=>{await h.go('#set');await h.local();
  await pg.click('[data-mmode="direct"]');await pg.waitForTimeout(250);
  await h.ev(()=>LS.set('mstat',{ok:true,at:'09:00',msg:'x'}));
  await pg.fill('#mkey','ANOTHER-test-value');
  await pg.click('[data-act="mkeysave"]');await pg.waitForTimeout(400);
  const st=await h.ev(()=>LS.get('mstat',null));
  if(st&&st.ok)return '换了密钥，上一次的「成功」还挂在界面上';});
C(85,'D','源码里没有密钥字面量',async(pg,h)=>{
  const src=fs.readFileSync(process.argv[2]||'index.html','utf8');
  const m=src.match(/sk-[A-Za-z0-9_-]{16,}/g);
  if(m)return '源码里有像密钥的字符串：'+m.length+' 处';});

/* ============ E 日常使用（86–100） ============ */
C(86,'E','分类器温度必须是 0',async(pg,h)=>{await h.go();
  const r=await h.ev(async()=>{const out=[];const real=window.fetch;
    MC.save({mode:'direct'});MC.setKey('K');
    window.fetch=(u,o)=>{out.push(JSON.parse(o.body));
      return Promise.resolve({ok:true,status:200,
        json:()=>Promise.resolve({choices:[{message:{content:'none'}}]})})};
    S.ask='随便说一句不着边际的话';
    agentSend();await new Promise(r=>setTimeout(r,1200));
    window.fetch=real;return out});
  if(!r.length)return '没发出分类请求';
  if(r[0].temperature!==0)return '分类器温度是 '+r[0].temperature+'，不是 0';
  if(r[0].max_tokens>16)return '分类器 max_tokens 是 '+r[0].max_tokens+'，给多了';});
C(87,'E','分类提示词是现场从 ABIL 拼的',async(pg,h)=>{await h.go();
  const r=await h.ev(()=>{
    const before=sysRoute();
    ABIL.push({id:'zzz',n:'临时能力',when:'只用来测提示词会不会跟着变。',eg:'测一下',
      say:'',obj:[],kw:[]});
    const after=sysRoute();ABIL.pop();
    return {grew:after.length>before.length,has:after.indexOf('zzz')>=0}});
  if(!r.grew||!r.has)return '加了一条能力，提示词没跟着变——说明是手写的副本';});
C(88,'E','提示词里写死了「不产生任何数字」',async(pg,h)=>{await h.go();
  const a=await h.ev(()=>sysRoute()), b=await h.ev(()=>SYS_BASE);
  if(b.indexOf('不产生任何数字')<0)return '人设里没写死「不产生数字」';
  if(a.indexOf(b)!==0)return '分类提示词没有以同一段人设开头（缓存前缀会失效）';});
C(89,'E','自由问答带的是本机算出来的事实',async(pg,h)=>{await h.go('#projects');
  await h.proj('p1');
  const s=await h.ev(()=>sysAsk());
  if(s.indexOf('候选：')<0)return '没把候选数带进去';
  if(/NaN|undefined|null/.test(s))return '事实里有 NaN/undefined';
  if(s.indexOf('只许根据这些数据回答')<0)return '没下「只许用这些数」的约束';});
C(90,'E','关键词能判的不调模型',async(pg,h)=>{await h.go();
  await h.stub('deg');
  await h.say('比一下处理组和对照组哪些基因变了',1800);
  const n=await h.ev(()=>window.__req.length);
  if(n!==0)return '关键词已命中却还调了模型 '+n+' 次';});
C(91,'E','模型判定也能触发标准组件',async(pg,h)=>{await h.go();
  await h.stub('primer');
  await h.say('麻烦你安排一下',2000);
  const cs=await h.cards();
  if(!cs.length)return '模型判了 primer，却没出卡';});
C(92,'E','模型乱报不存在的能力，不许造卡',async(pg,h)=>{await h.go();
  await h.stub('不存在的能力');
  await h.say('麻烦你安排一下',2400);
  const cs=await h.cards();
  if(cs.length)return '乱报也出了卡：'+cs.map(c=>c.t).join('/');});
C(93,'E','模型回 HTML 不会被注入',async(pg,h)=>{await h.go();
  await h.stub('<section class="kard" data-card="zz">注入</section>');
  await h.say('麻烦你安排一下',2600);
  const r=await h.ev(()=>!!document.querySelector('.kard[data-card="zz"]'));
  if(r)return '模型写的 HTML 变成了真元素';});
C(94,'E','模型连不上要说明服务失败且课题数据未改动',async(pg,h)=>{await h.go();
  await h.stub('x',{off:1});
  await h.say('这一轮还能不能再往上推',2600);
  const t=await h.lastTxt();
  const managed=await h.ev(()=>MC.isManaged());
  if(managed){
    if(!/检查网络后重试/.test(t)||!/没有更改课题数据/.test(t)||/API Key/.test(t))
      return '统一代理断网时没有说明服务失败与数据未改动：'+t.slice(0,100);
  }else if(!/没送出去|什么都没改|归不了类|API Key/.test(t))return '连不上却没说清楚：'+t.slice(0,80);});
C(95,'E','断开模型，关键词路线照常可用',async(pg,h)=>{await h.go();
  await h.stub('x',{off:1});
  await h.say('比一下处理组和对照组哪些基因变了',1800);
  const cs=await h.cards();
  if(!cs.length)return '断开模型之后关键词路线也瘫了';});
C(96,'E','项目页进去有开场白且数是真的',async(pg,h)=>{await h.go('#projects');
  await h.proj('p1');
  const v=await h.view();
  if(!/条/.test(v))return '开场白里没有任何计数';
  if(/NaN|undefined/.test(v))return '开场白里有 NaN/undefined';});
C(97,'E','文件卡能展开能下载',async(pg,h)=>{await h.go();
  await h.say('这个项目里都有哪些文件',2200);
  const n=await pg.$$eval('.kard [data-fbox]',e=>e.length).catch(()=>0);
  if(!n)return '文件卡里没有可展开的行';
  await pg.$$eval('.kard [data-fbox]',e=>e[0].click());
  await pg.waitForTimeout(400);
  const r=await h.ev(()=>{const f=document.querySelector('.kard .fbox.is-open');
    if(!f)return null;const d=f.querySelector('.fbox-dl');
    return {body:(f.querySelector('.fbox-pre')||{textContent:''}).textContent.trim().length,
      dl:!!d,disabled:d?d.disabled:null,why:d?d.getAttribute('title'):''}});
  if(!r)return '点了没展开';
  if(r.body<5)return '展开后正文是空的';
  if(!r.dl)return '展开后没有下载键';
  if(r.disabled&&!r.why)return '下载置灰却没说为什么';});
C(98,'E','所有路由都能直达且不空屏',async(pg,h)=>{
  const routes=await (async()=>{await h.go();return h.ev(()=>Object.keys(V))})();
  for(const r of routes){
    await h.go('#'+r);
    const t=await h.view();
    if(t.replace(/\s/g,'').length<10)return '路由 #'+r+' 基本是空屏';
  }});
C(99,'E','整轮走下来没有未捕获错误',async(pg,h)=>{await h.go();
  await h.stub('none');
  await h.say('比一下处理组和对照组哪些基因变了',1800);
  await h.nav('projects');await h.proj('p1');
  await h.nav('data');await h.nav('chat');
  await h.say('这个项目里都有哪些文件',1800);
  return null;});
C(100,'E','界面上不出现开发期用语',async(pg,h)=>{await h.go();
  const bad=[];
  const routes=await h.ev(()=>Object.keys(V));
  for(const r of routes){await h.go('#'+r);
    const t=await h.view();
    ['TODO','Mock','占位','示例数据','演示数据','undefined','NaN','[object Object]']
      .forEach(w=>{if(t.indexOf(w)>=0)bad.push('#'+r+' 出现「'+w+'」')});
  }
  if(bad.length)return bad.slice(0,4).join('；');});

/* ============ 跑 ============ */
(async()=>{
  const b=await chromium.launch();
  const fail=[],pass=[];
  const list=ONLY?T.filter(t=>String(t.id)===ONLY||t.g===ONLY):T;
  if(!list.length){console.error('没有匹配的测试：'+ONLY);await b.close();process.exit(1)}
  for(const t of list){
    // A fresh context isolates storage between checks; reloads within one check still persist it.
    const pg=await b.newPage({viewport:{width:1440,height:900}});
    const unmocked=await blockExternalNetwork(pg);
    const errs=[];pg.on('pageerror',e=>errs.push(e.message));
    const h=H(pg);
    let r=null;
    try{ r=await t.fn(pg,h) }catch(e){ r='抛异常：'+e.message.split('\n')[0] }
    if(!r&&unmocked.length)r='拦截了未模拟的模型请求：'+unmocked.length+' 次';
    if(!r&&errs.length)r='页面抛错：'+errs[0].split('\n')[0];
    if(r){fail.push('#'+String(t.id).padStart(3)+' ['+t.g+'] '+t.name+'\n      → '+r)}
    else pass.push(t.id);
    process.stdout.write(r?'✗':'·');
    await pg.close();
  }
  console.log('\n');
  if(fail.length)console.log(fail.join('\n'));
  console.log('\n通过 '+pass.length+' / '+list.length+'　失败 '+fail.length);
  await b.close();process.exit(fail.length?1:0);
})();
