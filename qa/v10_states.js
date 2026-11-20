/* V10 · 空 / 加载 / 错误三态的视觉：
   这三态最容易变成「一个洞」——一行灰字飘在大片留白里，没有边界、没有下一步。
   判定：空态必须有容器（看得出是一块内容区，不是渲染失败），
   并且给出下一步（一个按钮，或一句能照做的话）。 */
const {chromium}=require('../test-browser.cjs');
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1440,height:1000}});
await p.goto('file://'+process.argv[2]);await p.waitForTimeout(400);
const R=await p.evaluate(()=>{
  const bad=[],ok=[];
  /* 把数据清空，逼出每一页的空态 */
  const T=PTYPES[0],D=DOMAINS[0];
  DB.projects.push({id:'pE',name:'空项目',target:T.n,ptype:T.k,dom:D.k,
    fields:T.f.slice(),tcp:null,desc:'',state:'active',model:'—',variants:0,returned:0,
    ink:0,owner:'我',updated:'刚刚',kb:[],tools:[],
    rounds:[{i:1,state:'open',v:0,r:0,mb:'—',ma:'—',note:'还没有开始',ctrl:0,failed:0,
      plan:{host:'',assay:[],reps:'n = 3',buffer:'',temp:''}}]});
  S.pid='pE';S.round=1;fixRound();
  Object.keys(V).forEach(rt=>{
    S.back=[];try{go('home');go(rt)}catch(e){return}
    const v=document.getElementById('view');
    const empties=[...v.querySelectorAll('.empty')];
    empties.forEach(e=>{
      /* 边界可以是自己画的，也可以由外面的卡片提供（卡片里再套一个框是重复的）。
         所以往上找两层，任意一层有描边或底色就算这块内容区有边界。 */
      let hasBox=false;
      for(let n=e,i=0;n&&i<3;n=n.parentElement,i++){
        const c=getComputedStyle(n);
        if(parseFloat(c.borderTopWidth)>0&&c.borderTopStyle!=='none'){hasBox=true;break}
        if(c.backgroundColor!=='rgba(0, 0, 0, 0)'&&c.backgroundColor!=='transparent'){hasBox=true;break}
      }
      const hasAction=!!e.querySelector('button,a');
      const tx=(e.textContent||'').replace(/\s+/g,' ').trim();
      if(!hasBox)bad.push([rt,'空态没有容器，像渲染失败',tx.slice(0,30)]);
      else if(!hasAction&&tx.length<14)bad.push([rt,'空态既没有下一步也没说清为什么空',tx.slice(0,30)]);
      else ok.push(rt+'：'+tx.slice(0,34));
    });
  });
  DB.projects.pop();S.pid='p1';fixRound();
  return {bad,ok};
});
console.log('空态 '+(R.ok.length+R.bad.length)+' 处，抽样：');
R.ok.slice(0,8).forEach(x=>console.log('   ✓ '+x));
if(R.bad.length){console.log('\n❌ '+R.bad.length+' 处');
  R.bad.forEach(x=>console.log('   ['+x[0]+'] '+x[1]+'　'+x[2]));process.exitCode=1}
else console.log('\n✅ 空态都有容器、都给了下一步');
await b.close()})();
