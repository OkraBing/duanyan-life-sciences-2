/* 接上模型之后，标准化组件还触不触发？
   这一条守的是架构本身：模型**只决定「这句话归哪条能力」**，
   组件长什么样、里面填什么，全部由本机的 FLOW[cap](r.fields) 决定。
   所以同一条能力，不管是关键词判出来的还是模型判出来的，
   卡片数据必须逐字节相同——模型碰不到组件内容。 */
const {chromium}=require('../test-browser.cjs');
const {blockExternalNetwork}=require('./offline-network.cjs');
const F='file://'+require('path').resolve(process.argv[2]||'index.html');
const CAPS=['deg','seek','str','des','lab','primer','sgrna','train','dset','file'];
(async()=>{
  const b=await chromium.launch();const pg=await b.newPage({viewport:{width:1440,height:900}});
  const bad=[];pg.on('pageerror',e=>bad.push('JS: '+e.message));
  const unmocked=await blockExternalNetwork(pg);
  await pg.goto(F);await pg.waitForTimeout(400);

  const arm=r=>pg.evaluate(x=>{
    MC.save({mode:'direct'});MC.setKey('TESTKEY-not-a-real-credential');
    window.__n=0;
    window.fetch=()=>{window.__n++;return Promise.resolve({ok:true,status:200,
      json:()=>Promise.resolve({choices:[{message:{content:x}}],usage:{}})})};
  },r);
  const newChat=()=>pg.evaluate(()=>{convOf().length=0;S.ask='';S.useTools=[];render()});
  const send=async t=>{await pg.fill('#ask',t);await pg.keyboard.press('Enter');
    await pg.waitForTimeout(1400)};
  // 卡片数据取自对话模型本身，去掉每次都变的 id
  const cards=()=>pg.evaluate(()=>{
    const L=convOf();for(let i=L.length-1;i>=0;i--){
      if(L[i].role==='ai'&&(L[i].cards||[]).length)
        return JSON.stringify(L[i].cards.map(c=>{const o=Object.assign({},c);delete o.id;return o}));}
    return null});
  const dom=()=>pg.evaluate(()=>{
    const k=[...document.querySelectorAll('.kard:not(.is-skel)')].pop();
    return k?{t:k.getAttribute('data-k')||'',ctl:k.querySelectorAll('button,input,select,textarea').length}:null});

  // ① 关键词接不住的那句话：模型说归哪一类，就必须弹出那一类的标准组件
  const viaAi={};
  for(const cap of CAPS){
    await newChat();await arm(cap);
    await send('麻烦你安排一下');
    const c=await cards(), d=await dom();
    if(!c){bad.push('模型判成 '+cap+'，一张卡都没出');continue}
    viaAi[cap]=c;
    if(!d||!d.ctl)bad.push(cap+'：卡出来了但没有任何可操作的控件');
  }

  // ② 同一条能力，关键词判 vs 模型判，卡片数据必须完全一致
  const KW={deg:'比一下处理组和对照组哪些基因变了',primer:'给这段序列设计一对引物',
            sgrna:'设计一条 sgRNA',train:'训一个打分器',dset:'新建一个数据集',
            lab:'安排送检',seek:'检索一下这个序列',file:'看看项目里的文件'};
  for(const [cap,kw] of Object.entries(KW)){
    await newChat();await arm('none');
    await send(kw);
    const n=await pg.evaluate(()=>window.__n);
    if(n!==0)bad.push('「'+kw+'」关键词就能判，却还调了模型 '+n+' 次');
    const c=await cards();
    if(!c){bad.push(cap+'：关键词这条路没出卡');continue}
    if(!viaAi[cap]){bad.push(cap+'：模型那条路没出卡，没法比');continue}
    if(c!==viaAi[cap])bad.push(cap+'：两条路的卡片数据不一致\n  关键词: '+c.slice(0,200)
      +'\n  模型判: '+viaAi[cap].slice(0,200));
  }

  // ③ 模型报一个不存在的能力：不许凭空造组件
  await newChat();await arm('超级分析器');
  await send('麻烦你安排一下');
  if(await cards())bad.push('模型报了不存在的能力，却还是出了卡');

  // ④ 模型往回灌 HTML：只当分类结果，不许注入对话流
  await newChat();await arm('<section class="kard" data-card="x">我编的一张卡</section>');
  await send('麻烦你安排一下');
  /* 关键不是那几个字出不出现——转义之后字还在，标签没了。
     要查的是：有没有真的多出一个元素，以及尖括号是不是被转义了。 */
  const inj=await pg.evaluate(()=>({
    el:!!document.querySelector('.kard[data-card="x"]'),
    escaped:document.querySelector('#view').innerHTML.indexOf('&lt;section')>=0,
    raw:document.querySelector('#view').innerHTML.indexOf('<section class="kard" data-card="x"')>=0}));
  if(inj.el||inj.raw)bad.push('模型自己写的卡被当成 HTML 注入进了页面');
  if(!inj.escaped)bad.push('模型回的尖括号没被转义（也可能是这一轮根本没把它当文本显示）');

  // ⑤ 连续指代保留上一轮能力，新会话不能带入旧上下文。
  await newChat();await arm('none');
  await send('给这段模板设一对 PCR 引物');
  const previous=await pg.evaluate(()=>lastCap()?.id);
  if(previous!=='primer')bad.push('引物关键词没有建立上一轮能力');
  await pg.evaluate(()=>{
    window.__follow=[];
    window.fetch=(u,o)=>{window.__follow.push(JSON.parse(o.body));
      return Promise.resolve({ok:true,status:200,
        json:()=>Promise.resolve({choices:[{message:{content:'primer'}}]})})};
  });
  await send('再跑一次');
  const follow=await pg.evaluate(()=>window.__follow);
  if(follow.length!==1||!follow[0].messages[0].content.includes('上一步他在做：引物设计'))
    bad.push('连续指代的分类请求未携带上一轮引物设计能力');
  await pg.click('.nav[data-navid="chat"]');await pg.waitForTimeout(300);
  await pg.evaluate(()=>{window.__follow=[]});
  await send('再跑一次');
  const fresh=await pg.evaluate(()=>window.__follow);
  if(fresh.length!==1||fresh[0].messages[0].content.includes('上一步他在做：'))
    bad.push('独立新会话残留了旧能力，或没有发出分类请求');

  // ⑥ 断开模型，关键词那条路的标准组件照常触发
  await newChat();
  await pg.evaluate(()=>{MC.setKey('');window.fetch=()=>Promise.reject(new TypeError('x'))});
  await send('比一下处理组和对照组哪些基因变了');
  const c5=await cards(), d5=await dom();
  if(!c5||!d5||!d5.ctl)bad.push('断开模型后，关键词这条路的标准组件没出来');

  if(unmocked.length)bad.push('拦截了未模拟的模型请求：'+unmocked.length+' 次');
  console.log(bad.length?'❌\n'+bad.join('\n')
    :'✅ k_comp 全过：10 条能力的标准组件在模型判定下都触发；\n'
     +'   其中 8 条与关键词判定的卡片数据逐字节相同；模型造不出、也注入不了组件；\n'
     +'   连续指代携带上一轮能力，新会话不残留旧能力');
  await b.close();process.exit(bad.length?1:0);
})();
