/* 不走流程的那一句话：ctxBrief 的数必须和界面上的数一致，
   模型答得出来要显示，连不上要说实话。 */
const {chromium}=require('../test-browser.cjs');
const {blockExternalNetwork}=require('./offline-network.cjs');
const F='file://'+require('path').resolve(process.argv[2]||'index.html');
(async()=>{
  const b=await chromium.launch();const pg=await b.newPage({viewport:{width:1440,height:900}});
  const bad=[];pg.on('pageerror',e=>bad.push('JS: '+e.message));
  const unmocked=await blockExternalNetwork(pg);
  await pg.goto(F);await pg.waitForTimeout(400);

  // 进 p1，右栏就是这个课题的对话
  await pg.click('.nav[data-navid="projects"]');await pg.waitForTimeout(300);
  await pg.click('[data-proj="p1"]');await pg.waitForTimeout(500);

  // 1. ctxBrief 的数必须是真算出来的，且和 DB 对得上
  const br=await pg.evaluate(()=>ctxBrief());
  for(const k of ['课题：Barnase','立项目标','候选：','ΔTm','KD','批次 B-2409','打分器'])
    if(br.indexOf(k)<0)bad.push('ctxBrief 缺「'+k+'」\n'+br);
  const chk=await pg.evaluate(()=>{
    const p=DB.projects.find(x=>x.id==='p1');const was=S.pid;S.pid='p1';
    const cs=CANDS(),fs=projFields(p);
    const n=cs.filter(c=>fs.some(k=>mv(c,k)!=null)).length;S.pid=was;
    return {all:cs.length,meas:n};});
  if(br.indexOf('候选：'+chk.all+' 条，其中 '+chk.meas+' 条有实测值')<0)
    bad.push('候选数不是真算的: 期望 '+JSON.stringify(chk));
  if(/NaN|undefined|null/.test(br))bad.push('ctxBrief 里有 NaN/undefined:\n'+br);

  // 2. 存一把假钥匙 + 把 fetch 换成固定应答，问一句不走流程的话
  await pg.evaluate(()=>{
    MC.save({mode:'direct'});MC.setKey('TESTKEY-not-a-real-credential');
    window.__sent=[];
    window.fetch=(u,o)=>{const body=JSON.parse(o.body);window.__sent.push(body);
      const last=body.messages[body.messages.length-1].content;
      // 第一次是分类器（只许回一个词），第二次是自由问答
      const txt=body.max_tokens<=8?'none'
        :'这一轮还有空间：93 条已回流里 ΔTm 中位 1.2℃，最好 3.1℃，离 +5℃ 的目标还差一截。';
      return Promise.resolve({ok:true,status:200,
        json:()=>Promise.resolve({choices:[{message:{content:txt}}],usage:{total_tokens:42}})});};
  });
  await pg.fill('#ask','这一轮还能不能再往上推');
  await pg.keyboard.press('Enter');await pg.waitForTimeout(3200);
  const flow=await pg.textContent('.pjx-flow');
  if(!/这一轮还有空间/.test(flow))bad.push('模型的回答没出现在对话里');
  if(/没对上任何一条能力/.test(flow))bad.push('明明连上了，还是走了兜底话术');
  const sent=await pg.evaluate(()=>window.__sent);
  if(sent.length!==2)bad.push('请求次数不是 2（分类 + 自由问答）：'+sent.length);
  const sys=sent[1]&&sent[1].messages[0].content||'';
  /* 数不由模型产生、只许用给它的数、没有就说没有。 */
  [['不产生任何数字','数不许由模型产生'],
   ['只许根据这些数据回答','没下「只许用这些数」的约束'],
   ['直接说这里没有这个数','没说「没有就说没有」']]
    .forEach(([k,why])=>{if(sys.indexOf(k)<0)bad.push('自由问答提示词：'+why)});
  if(sys.indexOf('候选：')<0)bad.push('自由问答没把本机算的事实带上');
  if(sent[1]&&sent[1].messages[1].content!=='这一轮还能不能再往上推')
    bad.push('用户原话没原样送出去');

  // 3. 连不上：必须说实话，不许假装答了
  await pg.evaluate(()=>{window.fetch=()=>Promise.reject(new TypeError('Failed to fetch'))});
  await pg.fill('#ask','这一轮还能不能再往上推');
  await pg.keyboard.press('Enter');await pg.waitForTimeout(2600);
  const f3=await pg.textContent('.pjx-flow');
  if(!/没有更改课题数据/.test(f3)||!/检查网络后重试/.test(f3))bad.push('统一代理断网时没有说明服务失败与数据未改动');

  // 统一代理 503：访客应得到服务状态，不应该被要求填写 API Key。
  await pg.evaluate(()=>{window.fetch=async()=>({ok:false,status:503,
    text:async()=>JSON.stringify({error:'Model proxy is not configured'})})});
  await pg.fill('#ask','请谈谈这一轮的数据');await pg.keyboard.press('Enter');await pg.waitForTimeout(2200);
  const managed503=await pg.textContent('.pjx-flow');
  if(!/对话服务暂未就绪/.test(managed503)||/Model proxy is not configured/.test(managed503))
    bad.push('对话中的 503 没有显示简明服务状态');

  // 4. 本机直连没有密钥：必须指路去设置，不能静默
  await pg.evaluate(()=>{window.DUANYAN_CONFIG={...window.DUANYAN_CONFIG,managedProxy:false};
    MC.save({mode:'direct'});MC.setKey('');window.fetch=()=>Promise.reject(new TypeError('x'))});
  await pg.fill('#ask','你怎么看这个课题');
  await pg.keyboard.press('Enter');await pg.waitForTimeout(2200);
  const f4=await pg.textContent('.pjx-flow');
  if(!/API Key/.test(f4))bad.push('没密钥时没提示去填 API Key');
  if(!/模型制备[\s\S]*模型接入/.test(f4))bad.push('缺密钥提示没有指向「模型制备 → 模型接入」');
  if(/侧栏的「模型接入」/.test(f4))bad.push('缺密钥提示仍指向已移除的侧栏入口');

  // 5. 关键词能路由的那一句，不该白跑模型
  await pg.evaluate(()=>{window.__sent=[];
    window.fetch=(u,o)=>{window.__sent.push(1);return Promise.reject(new TypeError('x'))}});
  await pg.fill('#ask','给这批候选排个序');
  await pg.keyboard.press('Enter');await pg.waitForTimeout(1600);
  const n5=await pg.evaluate(()=>window.__sent.length);
  if(n5>0)bad.push('关键词已经能路由，却还是调了模型 '+n5+' 次');

  if(unmocked.length)bad.push('拦截了未模拟的模型请求：'+unmocked.length+' 次');
  console.log(bad.length?'❌\n'+bad.join('\n'):'✅ j_ask 全过');
  await b.close();process.exit(bad.length?1:0);
})();
