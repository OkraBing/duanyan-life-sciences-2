/* 设置页专项：两种模式各自的渲染、切换、密钥存删（不落盘到任何文件）、
   模型选择、连通性测试的失败路径。 */
const {chromium,testOutput}=require('../test-browser.cjs');
const {blockExternalNetwork}=require('./offline-network.cjs');
const F='file://'+require('path').resolve(process.argv[2]||'index.html');
(async()=>{
  const b=await chromium.launch();const pg=await b.newPage({viewport:{width:1440,height:900}});
  const bad=[];pg.on('pageerror',e=>bad.push('JS: '+e.message));
  const unmocked=await blockExternalNetwork(pg);
  const directRequests=[],managedRequests=[];
  let managedResult='success';
  // Every proxy request is mocked. No test reaches the live hosted proxy or uses a real key.
  await pg.route('**/api/model/chat',async route=>{
    const request=route.request();
    const headers={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'POST, OPTIONS',
      'Access-Control-Allow-Headers':'Content-Type'};
    if(request.method()==='OPTIONS')return route.fulfill({status:204,headers});
    managedRequests.push({url:request.url(),auth:!!request.headers().authorization,
      body:request.postDataJSON()});
    if(managedResult==='network')return route.abort('failed');
    return route.fulfill({status:managedResult==='503'?503:200,contentType:'application/json',headers,
      body:JSON.stringify(managedResult==='503'?{error:'Model proxy is not configured'}:
        {choices:[{message:{content:'收到'}}],usage:{total_tokens:12}})});
  });
  await pg.addInitScript(()=>{
    localStorage.setItem('dy_life_modelMode',JSON.stringify('direct'));
    localStorage.setItem('dy_life_modelEp',JSON.stringify('https://stale.example/api/model/chat'));
    localStorage.setItem('dy_life_ds_key','TESTKEY-existing-local-credential');
    localStorage.setItem('dy_life_mstat',JSON.stringify({ok:true,at:'旧的直连记录'}));
  });
  // Deterministic credential rejection: no fake credential leaves this browser test.
  await pg.route('https://api.deepseek.com/chat/completions',async route=>{
    const request=route.request();
    directRequests.push({method:request.method(),auth:!!request.headers().authorization});
    await route.fulfill({status:401,contentType:'application/json',
      headers:{'Access-Control-Allow-Origin':'*'},
      body:JSON.stringify({error:{message:'Test credential rejected'}})});
  });
  const reqs=[];pg.on('request',r=>{const u=r.url();
    if(!/^file:/.test(u)||/\/x\/model|chat\/completions|api\/model/.test(u))reqs.push(r.method()+' '+u)});
  pg.on('requestfailed',r=>{const u=r.url();
    if(/\/x\/model|chat\/completions|api\/model/.test(u))reqs.push('FAIL '+u)});
  await pg.goto(F);await pg.waitForTimeout(400);

  // 1. 从侧栏「模型制备」进入「模型接入」子导航；旧书签仍到同一页。
  await pg.click('.nav[data-navid="mdl"]');await pg.waitForTimeout(300);
  await pg.click('[data-mtab="set"]');await pg.waitForTimeout(300);
  const target=await pg.evaluate(()=>({route:S.route,tab:S.mtab,
    selected:document.querySelector('[data-mtab="set"]')?.getAttribute('aria-selected'),
    heading:document.querySelector('h1')?.textContent}));
  if(target.route!=='mdl'||target.tab!=='set'||target.selected!=='true'||target.heading!=='模型制备')
    bad.push('模型制备的子导航未打开模型接入: '+JSON.stringify(target));
  await pg.evaluate(()=>{go('chat');location.hash='set'});
  await pg.waitForFunction(()=>S.route==='mdl'&&S.mtab==='set'&&location.hash==='#mdl');
  if(!await pg.$('#mn'))bad.push('旧 #set 书签没有打开模型配置');

  const txt=()=>pg.textContent('#view');

  // 2. Public mode fixes the proxy and never asks visitors for credentials.
  if(await pg.$('#mkey'))bad.push('公开模式出现了 API Key 字段');
  if(await pg.$('#mep'))bad.push('公开模式出现了可编辑代理地址');
  if(await pg.$('[data-mmode]'))bad.push('公开模式出现了接入方式切换');
  if(!/站点统一提供，无需填写密钥/.test(await txt()))bad.push('公开模式没有说明访客无需填写密钥');
  if(/旧的直连记录/.test(await txt()))bad.push('旧直连测试记录被当作统一代理连通记录');
  const managed=await pg.evaluate(()=>{
    const before=MC.cfg();MC.save({mode:'direct',endpoint:'https://changed.example/api/model/chat'});
    return {active:MC.isManaged(),before,after:MC.cfg(),configured:window.DUANYAN_CONFIG.proxyEndpoint,
      key:MC.key()};
  });
  if(!managed.active||managed.before.mode!=='proxy'||managed.after.mode!=='proxy')
    bad.push('旧设置或 save() 能把公开模式切到直连');
  if(managed.before.endpoint!==managed.configured||managed.after.endpoint!==managed.configured)
    bad.push('旧设置或 save() 能改变统一代理地址');
  if(!/^https:\/\//.test(managed.configured))bad.push('统一代理不是 HTTPS');
  if(managed.key!=='TESTKEY-existing-local-credential')bad.push('公开模式擅自删除了已有本机密钥');

  await pg.selectOption('#mn','deepseek-v4-pro');await pg.waitForTimeout(200);
  if((await pg.evaluate(()=>MC.cfg().name))!=='deepseek-v4-pro')bad.push('统一代理模式无法选择模型');
  await pg.click('[data-act="mtest"]');
  await pg.waitForFunction(()=>document.querySelector('#mout')?.textContent.includes('返回「收到」'));
  if(!await pg.evaluate(()=>MC.testStatus()?.ok))bad.push('有效回复未记录为当前连接成功');
  if(managedRequests.length!==1||managedRequests[0].url!==managed.configured)
    bad.push('统一代理请求未到已配置地址: '+JSON.stringify(managedRequests.map(x=>x.url)));
  if(managedRequests.some(x=>x.auth)||directRequests.length)bad.push('统一代理请求携带客户端密钥或走了直连');
  if(managedRequests[0]?.body?.thinking?.type!=='disabled')bad.push('统一代理短回答没有关闭思考模式');
  if(managedRequests[0]?.body?.model!=='deepseek-v4-pro')bad.push('统一代理未使用所选模型');

  managedResult='503';await pg.click('[data-act="mtest"]');
  await pg.waitForFunction(()=>document.querySelector('#mout')?.textContent.includes('未连通'));
  const notReady=await pg.textContent('#mout');
  if(!/对话服务暂未就绪/.test(notReady)||/HTTP|Model proxy|https:/.test(notReady))
    bad.push('服务未就绪时没有简明提示: '+notReady);
  if(await pg.evaluate(()=>MC.testStatus()?.ok))bad.push('503 被记录成连通');
  if(!/失败/.test(await pg.textContent('#mtest-status')))bad.push('完成测试后状态标签没有更新');
  managedResult='network';await pg.click('[data-act="mtest"]');
  await pg.waitForFunction(()=>document.querySelector('#mout')?.textContent.includes('检查网络后重试'));
  const network=await pg.textContent('#mout');
  if(/路径写错|api.deepseek.com|Failed to fetch/.test(network))bad.push('公开网络错误混入实现细节');
  await pg.screenshot({path:testOutput('managed-model-settings.png'),fullPage:true});

  // Locally served config explicitly disables managed mode; original direct-mode behavior remains.
  await pg.evaluate(()=>{
    window.DUANYAN_CONFIG={...window.DUANYAN_CONFIG,managedProxy:false};
    MC.save({mode:'proxy',endpoint:'/api/model/chat'});MC.setKey('');LS.set('mstat',null);render();
  });
  if(await pg.evaluate(()=>MC.isManaged()))bad.push('本机配置无法关闭统一代理模式');
  if(!await pg.$('#mep'))bad.push('本机代理模式没有可编辑地址');
  if(!await pg.$('[data-mmode="direct"]'))bad.push('本机模式没有直连选项');
  reqs.length=0;

  // 3. 切直连
  await pg.click('[data-mmode="direct"]');await pg.waitForTimeout(250);
  if(!await pg.$('#mkey'))bad.push('直连模式下没有 API Key 字段');
  if(await pg.$('#mep'))bad.push('直连模式下还留着代理地址字段');
  const t=await pg.getAttribute('#mkey','type');
  if(t!=='password')bad.push('API Key 不是 password 输入框，type='+t);
  if(await pg.$('[data-act="mkeyclr"]'))bad.push('还没存密钥就出现了删除按钮');

  // 4. 空值保存：不动已有的
  await pg.click('[data-act="mkeysave"]');await pg.waitForTimeout(200);

  // 5. 存一把假的（只进 localStorage）
  await pg.fill('#mkey','TESTKEY-not-a-real-credential');
  await pg.click('[data-act="mkeysave"]');await pg.waitForTimeout(300);
  const left=await pg.inputValue('#mkey').catch(()=>'x');
  if(left!=='')bad.push('保存之后密钥还留在输入框里: '+left);
  const stored=await pg.evaluate(()=>localStorage.getItem('dy_life_ds_key'));
  if(stored!=='TESTKEY-not-a-real-credential')bad.push('密钥没进 localStorage: '+stored);
  const inDom=await pg.evaluate(()=>document.documentElement.innerHTML.indexOf('TESTKEY-not-a-real')>=0);
  if(inDom)bad.push('密钥出现在了 DOM 里');
  if(!await pg.$('[data-act="mkeyclr"]'))bad.push('存了密钥但没有删除按钮');

  // 6. 直连测试：必须打到 api.deepseek.com 且带 Bearer
  await pg.click('[data-act="mtest"]');
  await pg.waitForFunction(()=>document.querySelector('#mout')?.textContent.includes('未连通'));
  const o1=await pg.textContent('#mout').catch(()=>'');
  if(!/未连通|连通/.test(o1))bad.push('直连测试没有给出结论: '+o1.slice(0,80));
  if(!reqs.some(r=>/api\.deepseek\.com\/chat\/completions/.test(r)))
    bad.push('直连模式没有请求 api.deepseek.com，实际: '+JSON.stringify(reqs));
  if(!directRequests.some(r=>r.method==='POST'&&r.auth))bad.push('直连请求没有带 Bearer 凭据');

  // 7. 删密钥
  await pg.click('[data-act="mkeyclr"]');await pg.waitForTimeout(300);
  const after=await pg.evaluate(()=>localStorage.getItem('dy_life_ds_key'));
  if(after)bad.push('点了删除，localStorage 里还有: '+after);

  // 8. 没密钥的直连测试 → 必须说缺密钥，不能发请求
  reqs.length=0;
  await pg.click('[data-act="mtest"]');await pg.waitForTimeout(900);
  const o2=await pg.textContent('#mout').catch(()=>'');
  if(!/API Key/.test(o2))bad.push('没密钥时没提示去填: '+o2.slice(0,90));
  if(reqs.length)bad.push('没密钥却发了请求: '+JSON.stringify(reqs));

  // 9. 换模型
  await pg.click('[data-mmode="proxy"]');await pg.waitForTimeout(220);
  await pg.selectOption('#mn','deepseek-v4-pro');await pg.waitForTimeout(300);
  const s9=await txt();
  if(!/DeepSeek-V4-Pro-0813/.test(s9))bad.push('换了模型，版本号没跟着换');
  if(!/\$1\.32/.test(s9))bad.push('v4-pro 的价目没显示');
  const nm=await pg.evaluate(()=>JSON.parse(localStorage.getItem('dy_life_modelName')));
  if(nm!=='deepseek-v4-pro')bad.push('模型没存进 localStorage: '+nm);

  // 10. 代理地址 / 直连地址 / Bearer 头：直接把 fetch 换掉，看 MC 到底往哪儿发、带了什么
  await pg.fill('#mep','https://proxy.example/api/model/chat');await pg.dispatchEvent('#mep','change');await pg.waitForTimeout(300);
  const call=await pg.evaluate(async()=>{
    const log=[];const real=window.fetch;
    window.fetch=(u,o)=>{log.push({u:String(u),h:Object.keys((o&&o.headers)||{}),
      auth:!!((o&&o.headers||{})['Authorization']),body:(o&&o.body)||''});
      return Promise.reject(new TypeError('stubbed'))};
    const out={};
    try{await MC.chat([{role:'user',content:'x'}])}catch(e){out.proxyErr=e.message}
    out.proxy=log[log.length-1]||null;
    MC.save({mode:'direct'});MC.setKey('TESTKEY-not-a-real-credential');
    try{await MC.chat([{role:'user',content:'x'}])}catch(e){out.directErr=e.message}
    out.direct=log[log.length-1]||null;
    MC.setKey('');
    try{await MC.chat([{role:'user',content:'x'}])}catch(e){out.nokey=e.message}
    out.afterNokey=log.length;
    window.fetch=real;MC.save({mode:'proxy'});
    return out;
  });
  if(!call.proxy||call.proxy.u!=='https://proxy.example/api/model/chat')
    bad.push('代理模式没有打到改过的地址: '+JSON.stringify(call.proxy));
  if(call.proxy&&call.proxy.auth)bad.push('代理模式居然带了 Authorization 头——页面不该持有凭据');
  if(!call.direct||!/^https:\/\/api\.deepseek\.com\/chat\/completions$/.test(call.direct.u))
    bad.push('直连没有打到 api.deepseek.com/chat/completions: '+JSON.stringify(call.direct&&call.direct.u));
  if(call.direct&&!call.direct.auth)bad.push('直连没有带 Authorization 头');
  if(call.nokey!=='NOKEY')bad.push('没密钥时 MC.chat 没抛 NOKEY: '+call.nokey);
  if(call.afterNokey!==2)bad.push('没密钥时还是调了 fetch，次数='+call.afterNokey);
  const b10=call.direct&&JSON.parse(call.direct.body||'{}');
  if(b10&&b10.model!=='deepseek-v4-pro')bad.push('请求体里的模型名不对: '+(b10&&b10.model));
  if(b10&&b10.stream!==false)bad.push('请求体 stream 不是 false');
  const proxyBody=call.proxy&&JSON.parse(call.proxy.body||'{}');
  for(const body of [proxyBody,b10])
    if(!body||body.thinking?.type!=='disabled')bad.push('短回答请求没有关闭思考模式');

  // Successful HTTP with empty text is not proof of a working model connection.
  const responseCheck=await pg.evaluate(async()=>{
    const real=window.fetch;const out={};
    try{
      window.fetch=async()=>({ok:true,json:async()=>({choices:[{message:{content:'收到'}}]})});
      out.text=(await MC.chat([{role:'user',content:'x'}])).text;
      window.fetch=async()=>({ok:true,json:async()=>({choices:[{message:{content:'  '}}]})});
      try{await MC.chat([{role:'user',content:'x'}]);out.emptyAccepted=true}
      catch(e){out.emptyError=e.message}
    }finally{window.fetch=real}
    return out;
  });
  if(responseCheck.text!=='收到')bad.push('有效的模型回复没有返回');
  if(responseCheck.emptyAccepted||!responseCheck.emptyError)bad.push('空回复被误判为连通');

  // 11. 窄屏不横向滚
  await pg.setViewportSize({width:400,height:900});await pg.waitForTimeout(300);
  const ov=await pg.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
  if(ov>1)bad.push('400 宽横向溢出 '+ov+'px');

  if(unmocked.length)bad.push('拦截了未模拟的模型请求：'+unmocked.length+' 次');
  console.log(bad.length?'❌\n'+bad.join('\n'):'✅ i_set 全过');
  await b.close();process.exit(bad.length?1:0);
})();
