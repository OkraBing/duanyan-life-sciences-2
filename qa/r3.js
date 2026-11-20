const {chromium}=require('../test-browser.cjs');
(async()=>{const b=await chromium.launch(),pg=await b.newPage({viewport:{width:1400,height:900}});
 const errs=[];pg.on('pageerror',e=>errs.push(e.message));
 await pg.goto('file://'+process.argv[2]);await pg.waitForTimeout(400);
 // 清空所有用户态：没有启用过工具、没有收藏、没有草稿、没有保存的检索
 await pg.evaluate(()=>{try{localStorage.clear()}catch(e){}
   PF.seqs=[{t:'protein',copy:1,seq:'',mods:0}];PF.name='';DF.acc='';DF.name='';
   SK.hits=[];SK.phase='idle';render()});
 await pg.waitForTimeout(300);
 console.log('=== 全新用户：每个能力入口第一屏能不能用 ===');
 for(const h of ['#library','#models','#design','#wet','#shelf','#data','#projects']){
   await pg.evaluate(x=>{location.hash=x},h);await new Promise(s=>setTimeout(s,320));
   const r=await pg.evaluate(()=>{
     const nodes=[...document.querySelectorAll('#view .pipe-n')];
     return {
       空节点:nodes.filter(n=>/没有能接/.test(n.innerText)).map(n=>n.innerText.split('\n')[1]),
       节点选中:nodes.map(n=>{const d=n.querySelector('.ctl-dd');return d?d.innerText.trim():'—'}),
       主按钮:[...document.querySelectorAll('#view .ctl-go,#view .btn-pri,#view .btn-solid')]
         .map(b=>(b.innerText||b.getAttribute('aria-label')||'').trim()),
       禁用的:[...document.querySelectorAll('#view button[disabled]')].map(b=>b.innerText.trim()).filter(Boolean),
       空态:[...document.querySelectorAll('#view .empty')].map(e=>e.innerText.replace(/\n/g,' ⏎ ').slice(0,70))};
   });
   console.log(`\n${h}`);
   console.log('  节点已选：',r.节点选中.join(' ｜ ')||'（无节点）');
   if(r.空节点.length)console.log('  ⚠ 没有可用工具的节点：',r.空节点.join('、'));
   console.log('  主按钮：',r.主按钮.join(' ｜ ')||'（无）');
   if(r.禁用的.length)console.log('  禁用：',r.禁用的.join(' ｜ '));
   if(r.空态.length)console.log('  空态：',r.空态.join(' ⧉ '));
 }
 console.log('\n=== 工具一个都没启用时，节点还能选吗 ===');
 console.log(await pg.evaluate(()=>({
   我启用的:ENABLED().length,
   des序列设计节点可选:nodeTools('des','inv').length,
   默认选中:nodePick('des','inv')})));
 console.log('\nJS 错误:',errs.length?errs.join(' | '):'无');
 await b.close()})();
