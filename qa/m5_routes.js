/* 每一个 go('x') 都要落到一个真视图上。
   原先兜底是掉回对话页：用户点「看详情」，落到一个空白新对话，看起来像点击丢了。 */
const {chromium}=require('../test-browser.cjs');
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1280,height:900}});
const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto('file://'+process.argv[2]);await p.waitForTimeout(400);
const src=require('fs').readFileSync(process.argv[2],'utf8');
const gos=[...new Set([...src.matchAll(/go\('([a-zA-Z]+)'\)/g)].map(m=>m[1]))].sort();
const r=await p.evaluate(gs=>gs.map(g=>({g:g,有视图:!!V[g],落到:ROUTE_HOME(g),
  有归宿:!!V[ROUTE_HOME(g)]})),gos);
let bad=0;
r.forEach(x=>{
  const ok=x.有归宿;
  if(!ok)bad++;
  const how=x.有视图?'自己就是视图':('搬到 '+x.落到);
  console.log((ok?'  ✓ ':'  ❌ ')+`go('${x.g}') → ${how}`);
});
/* 兜底掉到 chat 的，必须是真的搬到了对话里，不能是「找不到就丢这儿」 */
const silent=r.filter(x=>!x.有视图&&x.落到==='chat');
console.log(`\n${r.length} 个路由，其中 ${r.filter(x=>x.有视图).length} 个有自己的视图，`
  +`${r.length-r.filter(x=>x.有视图).length} 个搬了家（落到对话的 ${silent.length} 个：`
  +silent.map(x=>x.g).join('、')+'）');
console.log(bad?`\n❌ ${bad} 个路由没有归宿`:'\n✅ 每个路由都有归宿，不会掉进空白页');
console.log('JS 错误:',errs.length?errs.slice(0,3):'无');
if(bad||errs.length)process.exitCode=1;
await b.close()})();
