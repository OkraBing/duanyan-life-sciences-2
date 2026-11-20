const {chromium}=require('../test-browser.cjs');
(async()=>{
const b=await chromium.launch();const p=await b.newPage({viewport:{width:1280,height:900}});
await p.goto('file://'+process.argv[2]);await p.waitForTimeout(400);
const land=await p.evaluate(()=>{const a=document.querySelector('.ask'),t=document.getElementById('ask');
  return {ask:Math.round(a.getBoundingClientRect().height),ta:Math.round(t.getBoundingClientRect().height),rows:t.rows}});
console.log('落地态  整块',land.ask,'px  textarea',land.ta,'px  rows',land.rows);
const send=async t=>{await p.evaluate(v=>{const e=document.getElementById('ask');e.value=v;
  e.dispatchEvent(new Event('input',{bubbles:true}))},t);
  await p.click('[data-act="chatsend"]');await p.waitForTimeout(4500)};
await send('在这段序列上选 sgRNA');
await send('P12345 这条蛋白查一下');
await send('给我设计一对引物');
const chat=await p.evaluate(()=>{const a=document.querySelector('.ask'),v=document.getElementById('view');
  const r=a.getBoundingClientRect(),vr=v.getBoundingClientRect();
  return {ask:Math.round(r.height),gapWin:Math.round(innerHeight-r.bottom),
    gapView:Math.round(vr.bottom-r.bottom),
    canScroll:v.scrollHeight>v.clientHeight+2,
    atEnd:Math.abs(v.scrollTop+v.clientHeight-v.scrollHeight)<4}});
console.log('对话态  整块',chat.ask,'px  离窗口底',chat.gapWin,'px  离#view底',chat.gapView,'px  可滚',chat.canScroll,'已到底',chat.atEnd);
// 滚到中间，看它是否还贴着底
await p.evaluate(()=>{document.getElementById('view').scrollTop=120});await p.waitForTimeout(200);
const mid=await p.evaluate(()=>{const r=document.querySelector('.ask').getBoundingClientRect();
  return Math.round(innerHeight-r.bottom)});
console.log('滚到中间 离窗口底',mid,'px');
await p.screenshot({path:require('../test-browser.cjs').testOutput('ask.png'),fullPage:false});
await b.close()})();
