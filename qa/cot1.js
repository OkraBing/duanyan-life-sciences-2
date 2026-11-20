/* 对话流的完整度：思考过程在回答前面、表单发起后收起、
   流还没放完时打开的菜单不会被下一张卡冲掉、可以「直接看结果」。 */
const {chromium}=require('../test-browser.cjs');
(async()=>{
const b=await chromium.launch();const p=await b.newPage({viewport:{width:1280,height:900}});
const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto('file://'+process.argv[2]);await p.waitForTimeout(400);
let bad=0;const ck=(c,m)=>{if(!c)bad++;console.log((c?'  ✓ ':'  ❌ ')+m)};

await p.evaluate(()=>{S.sid='c';CONV.c=[];S.pid='p1';go('chat');
  document.getElementById('ask').value='在这段序列上选 sgRNA';agentSend()});
await p.waitForSelector('.cot',{timeout:9000});
// 1. 思考过程排在回答文字前面
const order=await p.evaluate(()=>{
  const t=document.querySelector('.turn-ai .turn-b');
  return [...t.children].map(x=>x.className.split(' ')[0])});
ck(order.indexOf('kbare')>=0&&order.indexOf('kbare')<order.indexOf('turn-p'),
  '思考过程在回答前面：'+order.join(' → '));
// 2. 没说一句已经写在回答里的话
await p.click('[data-act="cottoggle"]');await p.waitForTimeout(200);
const cot=await p.evaluate(()=>document.querySelector('.cot-b').innerText);
const reply=await p.evaluate(()=>convOf().filter(m=>m.role==='ai')[0]._full);
ck(cot.indexOf(reply.replace(/。$/,''))<0,'思考过程没把回答再念一遍');
// 3. 流还没放完的时候点开菜单，菜单要还在
await p.evaluate(()=>{S.sid='c2';CONV.c2=[];go('chat');
  document.getElementById('ask').value='在这个界面上设计一批结合蛋白';agentSend()});
await p.waitForSelector('[data-ktool]',{timeout:9000});
await p.evaluate(()=>document.querySelector('[data-ktool]').click());
await p.waitForTimeout(1600);                       // 这中间至少还会再放一张卡
ck(await p.evaluate(()=>!!document.getElementById('menu')),'流还在放的时候菜单不会被冲掉');
await p.keyboard.press('Escape');await p.waitForTimeout(150);
// 4. 发送键一直是「发送」：流还在放的时候也不换成别的
await p.evaluate(()=>{S.sid='c3';CONV.c3=[];go('chat');
  document.getElementById('ask').value='在这段序列上选 sgRNA';agentSend()});
await p.waitForTimeout(300);
ck(await p.evaluate(()=>!!document.querySelector('[data-act="chatsend"]')),'放的过程中发送键不变');
await p.waitForSelector('[data-kgo]',{timeout:12000});
// 5. 表单发起之后收起来
const go2=await p.$('[data-kgo]');
if(go2){
  await p.waitForTimeout(400);
  const before=await p.evaluate(()=>document.querySelectorAll('.kard textarea,.kard input').length);
  await p.evaluate(()=>{const c=[];convOf().forEach(m=>(m.cards||[]).forEach(x=>c.push(x)));
    const f=c.find(x=>x.t==='form');if(f)allFields(f).forEach(x=>{if(x.k==='seq')x.v='ACGT'.repeat(40)})});
  await p.click('[data-kgo]');await p.waitForTimeout(4200);
  const after=await p.evaluate(()=>{
    const c=[];convOf().forEach(m=>(m.cards||[]).forEach(x=>c.push(x)));
    const f=c.find(x=>x.t==='form');
    return {done:!!(f&&f.done), inputs:document.querySelectorAll('.kard-h.is-done').length}});
  ck(after.done&&after.inputs>0,'表单发起之后收成一行（before 控件 '+before+'）');
  await p.click('[data-act="kopen"]');await p.waitForTimeout(200);
  ck(await p.evaluate(()=>!!document.querySelector('.fsum')),'点开还能看见填了什么');
}else ck(false,'没找到表单的发起按钮');
// 6. 回车发送，Shift+回车换行
await p.evaluate(()=>{S.sid='c4';CONV.c4=[];go('chat')});await p.waitForTimeout(250);
await p.click('#ask');await p.keyboard.type('在这段序列上选 sgRNA');
await p.keyboard.press('Enter');await p.waitForTimeout(900);
ck(await p.evaluate(()=>convOf().length)===2,'回车就发出去了');
ck(await p.evaluate(()=>document.getElementById('ask').value)==='','发完清空输入框');
await p.click('#ask');await p.keyboard.type('一');
await p.keyboard.down('Shift');await p.keyboard.press('Enter');await p.keyboard.up('Shift');
await p.keyboard.type('二');await p.waitForTimeout(200);
ck(await p.evaluate(()=>document.getElementById('ask').value)==='一\n二','Shift+回车是换行');
await p.evaluate(()=>{const e=document.getElementById('ask');e.value='';
  e.dispatchEvent(new Event('input',{bubbles:true}))});
const n0=await p.evaluate(()=>convOf().length);
await p.click('#ask');await p.keyboard.press('Enter');await p.waitForTimeout(400);
ck(await p.evaluate(()=>convOf().length)===n0,'空的时候回车不发');
ck(!errs.length,'无 JS 报错'+(errs.length?'：'+errs[0]:''));
console.log(bad?'\n❌ '+bad+' 处不对':'\n✅ 对话流完整');
await b.close();process.exit(bad?1:0)})();
