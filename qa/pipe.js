/* 流程卡：每一段用哪个模型要选得动，选完要真写回去。
   改造成 Agent 之后，流程卡是从对话里长出来的，不再有 #models / #design 这些页面。 */
const {chromium}=require('../test-browser.cjs');
(async()=>{const b=await chromium.launch(),pg=await b.newPage();
 const errs=[];pg.on('pageerror',e=>errs.push(e.message));
 await pg.goto('file://'+process.argv[2]);await pg.waitForTimeout(400);
 let bad=0;const say=(ok,m)=>{if(!ok)bad++;console.log((ok?'  ✓ ':'  ❌ ')+m)};

 const open=async say2=>{await pg.evaluate(s=>{
   S.sid='p'+Math.random();CONV[S.sid]=[];S.pid='p1';go('chat');
   document.getElementById('ask').value=s;agentSend();},say2);
  /* 卡片是一张一张放出来的，等它出来，不要等一个写死的毫秒数 */
  await pg.waitForSelector('.kstep',{timeout:12000});
  await pg.waitForTimeout(200)};

 for(const [s,cap] of [['把这条序列折出来','str'],['在这个界面上设计一批结合蛋白','des']]){
   await open(s);
   const r=await pg.evaluate(c=>({
     nodes:[...document.querySelectorAll('.kstep')].map(n=>n.innerText.replace(/\n/g,' │ ')),
     tools:(PIPE[c]||[]).map(nd=>nd.n+'：'+nodeTools(c,nd.id).map(t=>t.n).join('、'))}),cap);
   console.log('\n== '+cap+' ==');
   r.nodes.forEach(x=>console.log('  段 '+x));
   r.tools.forEach(x=>console.log('  可选 '+x));
   say(r.tools.length>0,`${cap} 的每一段都列得出可选模型`);
   say(r.tools.every(x=>!/：$/.test(x)),`${cap} 没有哪一段的可选模型是空的`);
 }

 /* 选模型：要锚定菜单，不许再弹一个窗 */
 await open('在这个界面上设计一批结合蛋白');
 const has=await pg.evaluate(()=>!!document.querySelector('[data-ktool]'));
 say(has,'流程卡上有换模型的入口');
 if(has){
   await pg.evaluate(()=>document.querySelector('[data-ktool]').click());
   await pg.waitForTimeout(320);
   const menu=await pg.evaluate(()=>{
     const m=document.getElementById('menu'),d=document.getElementById('dlg');
     return {menu:!!m, dlg:!!(d&&d.open),
       items:m?[...m.querySelectorAll('.menu-i .nm')].map(x=>x.textContent.trim()):[]}});
   say(menu.menu&&!menu.dlg,`换模型是锚定菜单、不弹窗（${menu.items.length} 个选项）`);
   /* 只在能选的项里挑。末尾那条「启用更多工具」是跳转，不是选项（R59）。 */
   const picks=await pg.evaluate(()=>[...document.querySelectorAll('#menu .menu-i[data-pick]')]
     .map(x=>x.querySelector('.nm').textContent.trim()));
   say(picks.length>=1,`菜单里有 ${picks.length} 个能选的模型`);
   if(picks.length>1){
     const want=picks[1];
     await pg.evaluate(()=>{const L=[...document.querySelectorAll('#menu .menu-i[data-pick]')];
       if(L[1])L[1].click()});
     await pg.waitForTimeout(320);
     const got=await pg.evaluate(()=>{
       const c=[];convOf().forEach(m=>(m.cards||[]).forEach(x=>c.push(x)));
       const st=c.find(x=>x.t==='steps');
       return st?st.steps.map(s=>s.tool):[]});
     say(got.indexOf(want)>=0,`选中「${want}」之后真写回了流程卡（现在是 ${got.join('、')}）`);
   }
 }
 /* 工具卡不许再指向一个不存在的详情页 */
 await pg.evaluate(()=>go('shelf'));await pg.waitForTimeout(350);
 const dead=await pg.evaluate(()=>document.querySelectorAll('#view [data-tool]').length);
 say(dead===0,`工具卡上没有指向已删页面的死链（找到 ${dead} 个）`);
 console.log(bad?`\n❌ ${bad} 项不对`:'\n✅ 流程卡的模型选得动、写得回，工具页没有死链');
 console.log('JS 错误:',errs.length?errs.join(' | '):'无');
 if(bad||errs.length)process.exitCode=1;
 await b.close()})();
