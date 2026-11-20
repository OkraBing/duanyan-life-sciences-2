/* 界面上点得到的每一个去向，都必须是一个真的视图。
   ROUTE_MOVED 是给旧书签和旧链接兜底的，不是给界面上的按钮用的——
   按钮上写「查看全部 9」，点下去落在新建对话页，这不是兜底，这是说了假话。 */
const {chromium}=require('../test-browser.cjs');
(async()=>{
const b=await chromium.launch();const p=await b.newPage({viewport:{width:1280,height:900}});
await p.goto('file://'+process.argv[2]);await p.waitForTimeout(400);
const r=await p.evaluate(()=>{
  const views=Object.keys(V), moved=Object.keys(ROUTE_MOVED);
  const bad=[];
  /* 导航按钮 */
  document.querySelectorAll('[data-nav]').forEach(el=>{
    const t=el.dataset.nav;
    if(views.indexOf(t)<0)bad.push('data-nav="'+t+'" → '+(ROUTE_MOVED[t]||'不存在'));});
  return {views:views.length, moved:moved, bad:bad,
    /* 还活着的旧路由里，有没有哪个其实已经有了同名视图（那就该从兜底表里拿掉） */
    stale:moved.filter(k=>views.indexOf(k)>=0)};
});
let bad=0;
console.log('视图 '+r.views+' 个，兜底路由 '+r.moved.length+' 个');
if(r.bad.length){bad++;r.bad.forEach(x=>console.log('  ❌ 导航指向兜底路由：'+x))}
else console.log('  ✓ 导航按钮都指向真视图');
if(r.stale.length){bad++;console.log('  ❌ 兜底表里这几个已经有同名视图了，该拿掉：'+r.stale.join('、'))}
else console.log('  ✓ 兜底表里没有过期条目');
/* 侧栏里那几个真的点一遍，看落在哪 */
for(const [sel,want] of [['查看全部','chats']]){
  const el=await p.evaluateHandle(s=>[...document.querySelectorAll('#side button')]
    .find(b=>b.textContent.indexOf(s)>=0),sel);
  const has=await el.evaluate(e=>!!e);
  if(!has){console.log('  ⤬ 侧栏没有「'+sel+'」，跳过');continue}
  await el.asElement().click();await p.waitForTimeout(400);
  const now=await p.evaluate(()=>S.route);
  if(now!==want){bad++;console.log('  ❌ 点「'+sel+'」落在 '+now+'，该是 '+want)}
  else console.log('  ✓ 点「'+sel+'」落在 '+now);
}
console.log(bad?'\n❌ '+bad+' 处去向不对':'\n✅ 去向都对');
await b.close();process.exit(bad?1:0)})();
