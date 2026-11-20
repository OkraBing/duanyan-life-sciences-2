/* 轮次八：边界。研究员第一天进来时项目是空的，最后一天项目只剩一条数据。
   这两头都要能看，不能白屏、不能 NaN、不能除零。 */
const {chromium}=require('../test-browser.cjs');
const ROUTES=['home','projects','project','pw','models','design','results','wet','wetlab',
  'loop','hypo','intake','config','dataset','library','tasks','inbox','viewer','tool'];
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1280,height:900}});
 await p.goto('file://'+process.argv[2],{waitUntil:'load'});await p.waitForTimeout(500);
 const run=async(name,setup)=>{
   const errs=[];const h=e=>errs.push(e.message);p.on('pageerror',h);
   await p.evaluate(setup);
   const bad=[];
   for(const r of ROUTES){
     const o=await p.evaluate(rt=>{try{
       S.route=rt;render();
       const t=document.getElementById('view').innerText;
       /* 正经的空态（.empty 里有标题和一个出口）不算白屏 */
       const em=document.querySelector('#view .empty');
       if(em&&em.querySelector('strong')&&em.querySelector('button'))return {len:999,nan:0};
       return {len:t.trim().length,
         nan:(t.match(/NaN|Infinity|undefined|\[object/g)||[]).length,
         空:/NaN|Infinity/.test(t)?t.split('\n').filter(l=>/NaN|Infinity/.test(l)).slice(0,2):null};
     }catch(e){return {err:String(e.message||e).slice(0,70)}}},r);
     if(o.err)bad.push(`${r} 报错 ${o.err}`);
     else if(o.len<20)bad.push(`${r} 几乎空白（${o.len} 字）`);
     else if(o.nan)bad.push(`${r} 出现 ${o.nan} 处 NaN/undefined ${JSON.stringify(o.空||'')}`);
   }
   p.off('pageerror',h);
   console.log(`【${name}】`, bad.length?('⚠\n   '+bad.join('\n   ')):'✅ 全部视图可渲染，无 NaN');
   if(errs.length)console.log('   JS 错误:',errs.slice(0,3));
 };
 await run('一条变体都没有',()=>{window.__bak=DB.cands.slice();DB.cands.length=0;
   DB.projects.forEach(x=>{x.variants=0;x.returned=0});S.sel=new Set()});
 await run('只有一条变体',()=>{DB.cands.length=0;DB.cands.push(Object.assign({},window.__bak[0],
   {m:{},disposition:'designed',batch:null,parent:null,muts:['H102E'],dupOf:null}))});
 await run('全部未测',()=>{DB.cands.length=0;window.__bak.forEach(c=>DB.cands.push(Object.assign({},c,{m:{},disposition:'untested'})))});
 await run('全部失败',()=>{DB.cands.length=0;window.__bak.forEach(c=>DB.cands.push(Object.assign({},c,{disposition:'failed'})))});
 await run('重复数 n=1',()=>{DB.cands.length=0;window.__bak.forEach(c=>DB.cands.push(c));
   DB.projects.forEach(x=>x.rounds.forEach(r=>{if(r.plan)r.plan.reps='n = 1'}))});
 await run('对照占满孔板',()=>{const PL=plateOf();PL.fmt=96;PL.ctrl=16;
   DB.projects.forEach(x=>x.rounds.forEach(r=>{if(r.plan)r.plan.reps='n = 8'}))});
 await b.close()})();
