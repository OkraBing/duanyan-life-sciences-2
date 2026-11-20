/* 每个页面都要有回得去的路。
   判定按真实走法来：先到工作台，再 go() 进这个页面——这正是用户的走法。
   导航栏里有入口的页面，侧栏本身就是出路；没有的必须自己给一条，
   而且点下去要真的回到上一页。 */
const {chromium}=require('../test-browser.cjs');
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1440,height:1000}});
const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto('file://'+process.argv[2]);await p.waitForTimeout(500);
const out=await p.evaluate(()=>{
  const nav=Object.assign({},NAV_ROUTE);  /* 产品里已经有这张表，探针别另抄一份形状 */
  const res=[];
  Object.keys(V).forEach(rt=>{
    if(rt==='chat')return;
    /* 从对话页出发，这是用户真实的走法。
       原先这里写的是 go('home')——home 这个路由早就不在了，
       go() 会把它归一成 chat，于是下面那句 S.route==='home' 永远不成立。 */
    S.back=[];go('chat');
    try{go(rt)}catch(e){res.push({rt,bad:'THROW '+e.message});return}
    const p2=document.querySelector('#view .page')||document.getElementById('view');
    const txt=p2?p2.innerText:'';
    const auto=!!document.querySelector('#view [data-act="goback"]');
    /* 页面自带的出路：任何一个把你送到别的路由的控件都算（面包屑、「回工具目录」、「全部任务」…） */
    const own=!auto&&(/←/.test(txt)||!!document.querySelector(
      '#view [data-go],#view [data-jlist],#view [data-jlaunch],#view [data-crumb]'));
    let works=null;
    if(auto){document.querySelector('#view [data-act="goback"]').click();works=(S.route==='chat')}
    res.push({rt,nav:!!nav[rt],auto,own,works,ok:!!nav[rt]||auto||own});
  });
  return res;
});
out.forEach(x=>console.log((x.ok?'  ':'❌')+' '+x.rt.padEnd(10)
  +(x.nav?'导航页':x.auto?('自动返回键'+(x.works?' · 点了真回去了':' · ❌点了没回去')):x.own?'页面自带返回':'—')));
const bad=out.filter(x=>!x.ok), broke=out.filter(x=>x.auto&&!x.works);
console.log('');
console.log(bad.length?'❌ 没有回路的页面 '+bad.length+' 个：'+bad.map(x=>x.rt).join(', ')
 :'✅ '+(out.length+1)+' 个页面都有回得去的路');
if(broke.length)console.log('❌ 返回键点了不回去：'+broke.map(x=>x.rt).join(', '));
console.log('JS 错误:',errs.length?errs:'无');
await b.close()})();
