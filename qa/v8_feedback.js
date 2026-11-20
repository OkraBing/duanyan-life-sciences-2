/* V8 · 即时反馈：点下去必须有看得见的变化（界面变了，或者弹了提示）。
   「点了什么都没发生」会让人以为产品坏了，于是反复点。 */
const {chromium}=require('../test-browser.cjs');
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1440,height:1000}});
await p.goto('file://'+process.argv[2]);await p.waitForTimeout(400);
const routes=await p.evaluate(()=>Object.keys(V));
const bad=[],skip=[];let n=0;
for(const rt of routes){
  const ids=await p.evaluate(r=>{S.pid='p1';S.back=[];go('home');if(r==='task')S.tid=TASKS[0].id;
    try{go(r)}catch(e){return []}
    return [...document.querySelectorAll('#view button:not([disabled])')]
      .map((e,i)=>({i,tx:(e.textContent||'').replace(/\s+/g,' ').trim().slice(0,16),
        act:e.dataset.act||'',
        /* 下载与唤起系统文件框本来就不该改界面，豁免 */
        dl:'artdl' in e.dataset||'archdl' in e.dataset
           ||/^(fzip|askfile|dlreport|export|expo)/.test(e.dataset.act||'')
           ||/导出|下载|复制/.test((e.textContent||''))}))
      .filter(x=>!x.dl).slice(0,22)},rt);
  for(const it of ids){
    const r=await p.evaluate(([r2,i])=>{
      S.pid='p1';S.back=[];go('home');try{go(r2)}catch(e){return null}
      const bs=[...document.querySelectorAll('#view button:not([disabled])')];
      const e=bs[i];if(!e)return null;
      /* 点一个已经选中的选项，本来就不该有变化 */
      if(e.getAttribute('aria-pressed')==='true'||e.getAttribute('aria-checked')==='true'
         ||e.getAttribute('aria-selected')==='true')return null;
      /* 比内容本身，不比长度：只翻一个属性时长度可能恰好相同。
         再带一份状态快照——有些按钮改的是状态，界面下一帧才体现。 */
      const snap=()=>document.getElementById('view').innerHTML
        +'|'+S.route+'|'+S.depth+'|'+S.pid+'|'+S.round+'|'+JSON.stringify(S.jv||{})
        +'|'+document.querySelectorAll('#menu,#dlg[open]').length;
      const before=snap();
      try{e.click()}catch(x){return {err:x.message}}
      const after=snap();
      const toasted=!!document.querySelector('.toast,#toast');
      document.querySelectorAll('#menu').forEach(m=>m.remove());
      const d=document.getElementById('dlg');if(d&&d.open)d.close();
      return {changed:before!==after||toasted};
    },[rt,it.i]);
    if(!r)continue; n++;
    if(r.err)bad.push([rt,it.tx,'点了报错：'+r.err]);
    else if(!r.changed)bad.push([rt,it.tx||'(无字)','点了没有任何变化']);
  }
}
console.log('点了 '+n+' 个按钮');
if(bad.length){console.log('❌ '+bad.length+' 个');
  bad.slice(0,20).forEach(x=>console.log('   ['+x[0]+'] 「'+x[1]+'」 '+x[2]));process.exitCode=1}
else console.log('✅ 每个按钮点下去都有看得见的变化');
await b.close()})();
