/* 第二版「找得到」专项：侧栏收起的功能，在需要它的那一步里能不能碰到。
   判据来自方案页：每个功能有情境入口 + 兜底入口；全局搜索按功能名或常见说法第一条命中；
   折叠前后侧栏不跳位；定时任务、模型接入、资料、数据集、工具、设备、共享各自的入口点得通。
   每条检查前真重载，避免状态串到下一条。跑构建产物，不跑 src。 */
const {chromium}=require('../test-browser.cjs');
const path=require('node:path');
const FILE='file://'+path.resolve(__dirname,'..','index.html');
const R=[];const ok=(n,c,d='')=>R.push({n,c:!!c,d});
async function fresh(b){const p=await b.newPage({viewport:{width:1440,height:900}});p.__errs=[];p.on('pageerror',e=>p.__errs.push(String(e).slice(0,160)));await p.goto('about:blank');await p.goto(FILE);await p.waitForTimeout(1200);return p}
(async()=>{
 const b=await chromium.launch();
 /* —— 全局搜索 —— */
 {const p=await fresh(b);
  ok('S01 侧栏顶部有搜索框',await p.locator('#side .gs-trigger').count()===1);
  const q=async s=>{await p.keyboard.press('Control+k');await p.waitForTimeout(120);if(!await p.evaluate(()=>document.getElementById('gs-dlg')?.open)){await p.keyboard.press('Meta+k');await p.waitForTimeout(120);}
   await p.fill('.gs-input',s);await p.waitForTimeout(120);const rows=await p.$$eval('.gs-row .gs-label',es=>es.map(e=>e.textContent));await p.keyboard.press('Escape');await p.waitForTimeout(80);return rows};
  for(const [s,want] of [['定时','定时任务'],['周报','定时任务'],['密钥','模型接入'],['API Key','模型接入'],['设备','设备管理'],['仪器','设备管理'],['文件','资料空间'],['数据集','数据集'],['上传数据集','新建数据集'],['我的工具','我的工具'],['共享','共享课题'],['训练','模型制备']]){
   const rows=await q(s);ok('S02 搜「'+s+'」第一条是「'+want+'」',rows[0]===want,rows.slice(0,3).join(' | '));}
  const none=await (async()=>{await p.keyboard.press('Control+k');await p.waitForTimeout(120);if(!await p.evaluate(()=>document.getElementById('gs-dlg')?.open)){await p.keyboard.press('Meta+k');await p.waitForTimeout(120);}await p.fill('.gs-input','zzqqxx');await p.waitForTimeout(120);return p.locator('[data-gs-ask]').count()})();
  ok('S03 搜不到时给「在科研对话里问」',none===1);
  await p.keyboard.press('Enter');await p.waitForTimeout(400);
  ok('S04 兜底把这句话带进对话',(await p.evaluate(()=>S.route+'|'+(document.getElementById('ask')?.value||'')))==='chat|zzqqxx');
  ok('S99 搜索零报错',!p.__errs.length,p.__errs.join(';'));await p.close();}
 /* —— 侧栏折叠不跳位 —— */
 {const p=await fresh(b);await p.evaluate(()=>go('workbench'));await p.waitForTimeout(300);
  const g=()=>p.evaluate(()=>({mark:[...document.querySelector('.brand-mark').getBoundingClientRect().toJSON?[document.querySelector('.brand-mark').getBoundingClientRect().x,document.querySelector('.brand-mark').getBoundingClientRect().y]:[]].map(Math.round),
   search:Math.round(document.querySelector('.gs-trigger svg').getBoundingClientRect().x)+','+Math.round(document.querySelector('.gs-trigger').getBoundingClientRect().y),
   nav:[...document.querySelectorAll('#side .nav')].map(e=>Math.round(e.getBoundingClientRect().x)+','+Math.round(e.getBoundingClientRect().y)).join(' '),
   tgl:(()=>{const t=document.querySelector('.side-toggle').getBoundingClientRect(),s=document.querySelector('.gs-trigger').getBoundingClientRect();return !(t.bottom<=s.top||s.bottom<=t.top||t.right<=s.left||s.right<=t.left)})()}));
  const a=await g();await p.click('.side-toggle');await p.waitForTimeout(250);await p.mouse.move(700,500);const c=await g();
  ok('N01 折叠前后 logo、搜索框、七个入口位置不变',JSON.stringify([a.mark,a.search,a.nav])===JSON.stringify([c.mark,c.search,c.nav]),JSON.stringify({a,c}).slice(0,200));
  ok('N02 折叠时展开按钮不压搜索框',!c.tgl);
  await p.close();}
 /* —— 定时任务 —— */
 {const p=await fresh(b);const pid=await p.evaluate(()=>DB.projects[0].id);
  const parse=await p.evaluate(()=>[['每周一早上9点帮我汇总一次 R5 的新测定数据','weekly',1,'09:00'],['每天追踪一下新论文','daily',null,'08:30'],['每月15号出个进展汇总','monthly',15,'08:30'],['每个星期五晚上8点','weekly',5,'20:00'],['帮我看看这个序列',null]].map(([t,per,d,tm])=>{const r=stParsePeriod(t);return per===null?r===null:!!r&&r.period===per&&(d==null||(per==='weekly'?r.weekday:r.monthday)===d)&&r.time===tm}));
  ok('T01 周期识别（5 句）',parse.every(Boolean),JSON.stringify(parse));
  await p.evaluate(pid=>{go('project',{pid});S.pjtab='st';render()},pid);await p.waitForTimeout(500);
  ok('T02 课题有「定时」页签并带个数',/^定时\d+$/.test((await p.locator('[data-pjtab="st"]').innerText()).replace(/\s/g,'')));
  ok('T03 页签只列本课题的计划',await p.evaluate(pid=>document.querySelectorAll('.stp-row').length===ST.items.filter(t=>t.pid===pid).length,pid));
  await p.click('[data-stp-new]');await p.waitForTimeout(250);
  ok('T04 新建带入本课题',(await p.evaluate(()=>document.querySelector('#st-dialog select[name="pid"]')?.value))===pid);
  await p.fill('#st-dialog [name="content"]','专项计划');
  await p.click('#st-dialog .btn-pri');await p.waitForTimeout(400);
  ok('T05 保存后留在课题页且出现在页签里',(await p.evaluate(()=>S.route))==='project'&&(await p.$$eval('.stp-row .pjx-f-n',es=>es.map(e=>e.textContent))).includes('专项计划'));
  const offer=await p.evaluate(pid=>{const k=pjSid(pid);CONV[k]=[{role:'me',text:'每周一早上9点帮我汇总一次 R5 的新测定数据'},{role:'ai',text:'好的。'}];render();return document.querySelector('.st-offer-b')?.textContent||''},pid);
  ok('T06 说了周期，回答下出现「设为定时任务 · 每周一 09:00」',/设为定时任务 · 每周一 09:00/.test(offer),offer);
  await p.click('.st-offer-b');await p.waitForTimeout(250);
  const f=await p.evaluate(()=>({pid:document.querySelector('#st-dialog select[name="pid"]')?.value,period:document.querySelector('#st-dialog input[name="period"]:checked')?.value,time:document.querySelector('#st-dialog [name="time"]')?.value}));
  ok('T07 预填弹窗课题/周期/时间正确',f.pid===pid&&f.period==='weekly'&&f.time==='09:00',JSON.stringify(f));
  await p.keyboard.press('Escape');
  ok('T08 没有周期不出按钮',await p.evaluate(pid=>{const k=pjSid(pid);CONV[k]=[{role:'me',text:'帮我看看这个序列'},{role:'ai',text:'好的。'}];render();return !document.querySelector('.st-offer-b')},pid));
  ok('T09 没有真实运行记录时，工作台动态不出现「定时」条目',await p.evaluate(()=>{go('workbench');return !document.querySelector('.rh-activity.is-schedule')}));
  ok('T99 定时零报错',!p.__errs.length,p.__errs.join(';'));await p.close();}
 /* —— 模型接入 —— */
 {const p=await fresh(b);await p.evaluate(()=>{go('chat');MC.chat=()=>Promise.reject(new Error('NOKEY'))});await p.waitForTimeout(300);
  await p.fill('#ask','你好，今天天气怎么样');await p.click('[data-act="chatsend"]');await p.waitForTimeout(1500);
  ok('M01 没填密钥时，错误下方有「去配置模型接入」',await p.locator('#view [data-go="set"]').count()>0);
  const opts=await p.$$eval('#askmdl option',es=>es.map(e=>e.value));
  ok('M02 模型下拉末尾是「管理模型接入」',opts[opts.length-1]==='__manage');
  await p.evaluate(()=>{const s=document.getElementById('askmdl');s.value='__manage';s.dispatchEvent(new Event('change'))});await p.waitForTimeout(300);
  ok('M03 选它去到模型接入',(await p.evaluate(()=>S.route))==='set');
  await p.close();}
 /* —— 资料、数据集、工具、设备 —— */
 {const p=await fresh(b);const pid=await p.evaluate(()=>DB.projects[0].id);
  await p.evaluate(pid=>go('project',{pid}),pid);await p.waitForTimeout(400);
  await p.click('[data-act="askfile"]');await p.waitForTimeout(200);
  ok('C01 附件菜单：上传文件 / 从资料空间选 / 上传数据集',JSON.stringify(await p.$$eval('#menu .nm',es=>es.map(e=>e.textContent)))==='["上传文件","从资料空间选","上传数据集"]');
  await p.click('#menu [data-go="__mat"]');await p.waitForTimeout(200);
  const first=await p.$eval('#menu [data-go^="m:"] .nm',e=>e.textContent).catch(()=>'');
  await p.click('#menu [data-go^="m:"]');await p.waitForTimeout(250);
  ok('C02 从资料空间选的文件挂到输入框',!!first&&await p.evaluate(n=>(S.askFiles||[]).includes(n),first),first);
  await p.click('[data-act="askfile"]');await p.waitForTimeout(150);await p.click('#menu [data-go="__ds"]');await p.waitForTimeout(300);
  ok('C03 附件「上传数据集」去新建数据集',(await p.evaluate(()=>S.route))==='dsnew');
  await p.evaluate(pid=>{go('project',{pid});S.pjtab='kb';render()},pid);await p.waitForTimeout(300);await p.click('[data-ce-mat-pid]');await p.waitForTimeout(300);
  ok('C04 知识库「在资料空间打开」定位到本课题',(await p.evaluate(()=>S.route+'|'+MATERIALS.space))==='materials|'+pid);
  await p.evaluate(()=>alVisitBatch('B-2409'));await p.waitForTimeout(500);
  ok('C05 已发布结论有「整理成数据集」',await p.locator('[data-ce-batch-ds]').count()===1);
  await p.click('[data-ce-batch-ds]');await p.waitForTimeout(400);
  ok('C06 带着课题文件去新建数据集',(await p.evaluate(()=>S.route+'|'+NEWDS.src))==='dsnew|proj');
  await p.evaluate(()=>go('trainnew'));await p.waitForTimeout(300);
  ok('C07 训练表单有「新建数据集」',await p.locator('[data-ce-new-ds]').count()===1);
  await p.evaluate(()=>toolPicker(Object.keys(CAPS||{})[0]||'str',null,()=>{}));await p.waitForTimeout(200);
  ok('C08 工具选择器底部有「管理我的工具」',await p.locator('#dlg [data-ce-tools]').count()===1);
  await p.click('#dlg [data-ce-tools]');await p.waitForTimeout(300);
  ok('C09 去到科研工具「我的」',(await p.evaluate(()=>S.route+'|'+RS.marketTab))==='shelf|mine');
  ok('C10 新建实验的设备配置有「管理设备」',await p.evaluate(()=>/管理设备/.test(alMethodFields({assays:['stability'],methods:{}},{id:'stability'},{}))));
  ok('C99 情境入口零报错',!p.__errs.length,p.__errs.join(';'));await p.close();}
 /* —— 共享 —— */
 {const p=await fresh(b);
  const items=await p.evaluate(()=>INBOX().filter(x=>/^s[ra]-/.test(x.id)).map(x=>x.tag));
  ok('H01 有人申请我的资产时进消息',items.filter(t=>t==='待你审批').length===await p.evaluate(()=>RS.data.shared.filter(s=>rsCan(s,'approve')).reduce((n,s)=>n+s.requests.filter(r=>r.state==='pending').length,0)));
  ok('H02 我的申请被批准时进消息',items.includes('申请已批准'));
  ok('H03 角标与未读数一致',String(await p.evaluate(()=>inboxUnread()))===(await p.locator('#bellN').innerText()).trim());
  await p.evaluate(()=>INBOX().find(x=>x.id.startsWith('sr-')).go());await p.waitForTimeout(500);
  ok('H04 点开落到共享课题并打开申请面板',(await p.evaluate(()=>S.route))==='shareddetail'&&await p.evaluate(()=>/待我审批\s*\d/.test(document.body.innerText)));
  ok('H99 共享零报错',!p.__errs.length,p.__errs.join(';'));await p.close();}
 await b.close();
 R.forEach(r=>console.log((r.c?'PASS ':'FAIL ')+r.n+(r.c||!r.d?'':'  '+r.d)));
 const bad=R.filter(r=>!r.c).length;
 console.log(bad?'找得到专项：'+bad+' 条未过':'找得到专项：'+R.length+' 条全部通过');
 process.exitCode=bad?1:0;
})();
