/* 把每条能力在「对话页」和「项目页右栏」各走一遍完整流程：
   提问 → 卡片出来 → 点卡上的发起 → 跑完 → 产出文件能展开能下载。
   这一轮是为了抓「只在交互时才暴露」的问题——渲染扫不出来。 */
const {chromium}=require('../test-browser.cjs');
const {blockExternalNetwork}=require('./offline-network.cjs');
const ASKS=[
 ['序列检索','检索和这条序列同源的条目'],
 ['结构预测','把这条序列折出来'],
 ['蛋白质设计','给这个界面设计几条突变'],
 ['引物设计','给我设计一对引物'],
 ['sgRNA','设计一条 sgRNA'],
 ['差异表达','做一下差异表达分析'],
 ['实验管理','把这批候选送去测亲和力'],
 ['模型制备','用实测数据训一个打分器'],
 ['建数据集','把这批实测建成一个数据集'],
 ['文件与资料','这个项目有哪些文件'],
];
const run=async(p,route,label,q,bad)=>{
  const sid='t'+Math.random().toString(36).slice(2,8);
  /* 项目页的会话是跟项目走的（pj:<项目号>），fixPjSid 每次渲染都会把 S.sid 拨回去。
     所以这里不能自己造一个 sid，要清空它那一段，否则上一轮的卡会留在屏幕上，
     下一轮量到的是上一轮的按钮。 */
  await p.evaluate(a=>{S.pid='p1';S.bind='p1';S.round=5;S.back=[];
    if(a.route==='project'){go('project');CONV[pjSid('p1')]=[];render()}
    else{S.sid=a.sid;CONV[a.sid]=[];go('chat')}},{route,sid});
  await p.waitForTimeout(250);
  const ta=await p.$('#ask');
  if(!ta){bad.push([route,label,'没有输入框']);return}
  await p.evaluate(a=>{const t=document.getElementById('ask');t.value=a;agentSend()},q);
  /* 等流跑完：没有 is-live、也没有 is-skel 为止 */
  for(let k=0;k<90;k++){
    const busy=await p.evaluate(()=>!!document.querySelector('.is-skel,.turn-p.is-live'));
    if(!busy&&k>6)break;
    await p.waitForTimeout(150);
  }
  /* 卡上的「发起」按钮：必须绑上，点了必须有反应 */
  const hasGo=await p.evaluate(()=>{const g=document.querySelector('[data-kgo]');
    return g?{bound:!!g.onclick,text:g.textContent.trim()}:null});
  if(hasGo){
    if(!hasGo.bound){bad.push([route,label,'卡上的「'+hasGo.text+'」没绑上，点了没反应']);}
    else{
      const n0=await p.evaluate(()=>convOf().length);
      await p.evaluate(()=>document.querySelector('[data-kgo]').click());
      for(let k=0;k<70;k++){
        const busy=await p.evaluate(()=>!!document.querySelector('.is-skel,.turn-p.is-live'));
        if(!busy&&k>8)break;
        await p.waitForTimeout(150);
      }
      const n1=await p.evaluate(()=>convOf().length);
      /* 必填项没填时卡片会拒绝并说明原因——那是对的，不算失败。
         真正的失败是：既没往下走，也没告诉人为什么。 */
      const said=await p.evaluate(()=>{const t=document.querySelector('.toast,[role="status"]');
        return t?t.textContent.trim():''});
      if(n1<=n0&&!said)bad.push([route,label,'点了「'+hasGo.text+'」之后既没往下走也没说为什么']);
    }
  }
  /* 这一轮所有可点控件都得绑上 */
  const dead=await p.evaluate(()=>{
    const out=[];
    document.querySelectorAll('[data-card] button,[data-card] [role="button"]').forEach(e=>{
      if(e.onclick||e.onkeydown||e.closest('label')||e.type==='file')return;
      const k=[...e.attributes].find(a=>/^data-/.test(a.name));
      if(k)out.push((e.textContent.trim()||e.getAttribute('aria-label')||k.name).slice(0,14));
    });
    return [...new Set(out)];
  });
  if(dead.length)bad.push([route,label,'卡里点不动：'+dead.slice(0,4).join(' / ')]);
  /* 产出文件：能展开、展开后有正文、下载键在 */
  const fb=await p.$('[data-fbox]');
  if(fb){
    await p.evaluate(()=>document.querySelector('[data-fbox]').click());
    await p.waitForTimeout(250);
    const r=await p.evaluate(()=>{const b=document.querySelector('.fbox.is-open');
      if(!b)return '点了没展开';
      const pre=b.querySelector('.fbox-pre');
      if(!pre||pre.textContent.trim().length<2)return '展开了但正文是空的';
      /* 按组件的下载控件查，兼容数据集、项目文件等不同文件来源。 */
      const d=b.querySelector('.fbox-dl');
      if(!d)return '展开了但没有下载';
      if(d.disabled&&!d.getAttribute('title'))return '下载键置灰了却没说为什么';
      return null});
    if(r)bad.push([route,label,'产出文件：'+r]);
  }
  const errs=await p.evaluate(()=>window.__e||[]);
  if(errs.length)bad.push([route,label,'JS 报错：'+errs.slice(0,2).join(' | ')]);
  await p.evaluate(()=>{window.__e=[]});
};
(async()=>{
const b=await chromium.launch();const p=await b.newPage({viewport:{width:1440,height:1000}});
await blockExternalNetwork(p);
p.on('pageerror',e=>p.evaluate(m=>{window.__e=window.__e||[];window.__e.push(m)},e.message).catch(()=>{}));
await p.goto('file://'+process.argv[2]);await p.waitForTimeout(700);
await p.evaluate(()=>{window.__e=[]});
const bad=[];
for(const route of ['chat','project'])
  for(const [label,q] of ASKS) await run(p,route,label,q,bad);
bad.forEach(x=>console.log('  ✗ ['+x[0]+' · '+x[1]+'] '+x[2]));
console.log(bad.length?('❌ '+bad.length+' 处'):('✅ '+(ASKS.length*2)+' 条流程（对话页 + 项目页各一遍）全部走通'));
if(bad.length)process.exitCode=1;
await b.close()})();
