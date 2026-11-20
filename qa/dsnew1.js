/* 新建数据集走的是一张表，不是一段对话；新建对话要真的新开一段。 */
const {chromium}=require('../test-browser.cjs');
(async()=>{
const b=await chromium.launch();const p=await b.newPage({viewport:{width:1280,height:1000}});
const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto('file://'+process.argv[2]);await p.waitForTimeout(400);
let bad=0;const ck=(c,m)=>{if(!c)bad++;console.log((c?'  ✓ ':'  ❌ ')+m)};

/* ---- 新建对话 ---- */
await p.evaluate(()=>{const e=document.getElementById('ask');e.value='在这段序列上选 sgRNA';
  e.dispatchEvent(new Event('input',{bubbles:true}))});
await p.click('[data-act="chatsend"]');await p.waitForTimeout(800);
const n0=await p.evaluate(()=>SESSIONS.length);
const sid0=await p.evaluate(()=>S.sid);
await p.evaluate(()=>document.querySelector('#navA .nav[data-navid="chat"]').click());
await p.waitForTimeout(500);
const r=await p.evaluate(()=>({sid:S.sid,n:convOf().length,sess:SESSIONS.length,
  top:(SESSIONS[0]||{}).title}));
ck(r.sid!==sid0&&r.n===0,'点新建对话开的是一段空的新对话');
ck(r.sess===n0+1&&r.top==='在这段序列上选 sgRNA','刚才那段进了最近对话：'+r.top);
await p.evaluate(()=>{const e=[...document.querySelectorAll('#navH .nav')][0];if(e)e.click()});
await p.waitForTimeout(600);
ck(await p.evaluate(()=>convOf().length)>0,'点回去还能看到刚才那段');

/* ---- 新建数据集：是一页表单，不是对话 ---- */
await p.evaluate(()=>{location.hash='#dsets';render()});await p.waitForTimeout(400);
const btn=await p.evaluate(()=>{const b=document.querySelector('.pg-hd .btn-pri,.page .btn-pri');
  return b?{t:b.textContent.trim(),nav:b.dataset.nav||'',ask:b.dataset.askthis||''}:null});
ck(btn&&btn.t==='新建数据集'&&btn.nav==='dsnew'&&!btn.ask,
  '「新建数据集」去的是表单页，不是对话（'+JSON.stringify(btn)+'）');
await p.click('[data-nav="dsnew"]');await p.waitForTimeout(400);
ck(await p.evaluate(()=>S.route)==='dsnew','落在新建数据集页');
ck(await p.evaluate(()=>!!document.querySelector('#view .pg-back')),'顶部有返回');
ck(await p.evaluate(()=>document.querySelector('[data-act="dsmake"]').disabled),'没选文件时建不了');
await p.click('[data-act="dsdemo"]');await p.waitForTimeout(500);
const q=await p.evaluate(()=>({rows:NEWDS.parsed?NEWDS.parsed.rows.length:0,
  cols:document.querySelectorAll('#view tbody tr').length,
  chips:document.querySelectorAll('[data-dsfeat]').length}));
ck(q.rows>0&&q.cols>0&&q.chips>0,'读进来就看得到列清单和特征列（'+q.rows+' 行 / '+q.cols+' 列 / '+q.chips+' 个特征）');
ck(await p.evaluate(()=>document.querySelector('[data-act="dsmake"]').disabled),'没选目标列时还是建不了');
const tgt=await p.evaluate(()=>[...document.querySelectorAll('#dstgt option')].map(o=>o.value).filter(Boolean)[0]);
await p.selectOption('#dstgt',tgt);await p.waitForTimeout(350);
ck(!(await p.evaluate(()=>document.querySelector('[data-act="dsmake"]').disabled)),'选了目标列才能建');
ck(await p.evaluate(t=>[...document.querySelectorAll('[data-dsfeat]')]
  .some(b=>b.dataset.dsfeat===t&&b.disabled),tgt),'目标列不能同时当特征');
const before=await p.evaluate(()=>DSETS(S.pid).length);
await p.click('[data-act="dsmake"]');await p.waitForTimeout(700);
const after=await p.evaluate(()=>({n:DSETS(S.pid).length,route:S.route,
  d:DSETS(S.pid)[0]||null}));
ck(after.n===before+1&&after.route==='dsets','建完落回数据集页，多了一条');
ck(after.d&&after.d.st==='draft'&&after.d.split.train.length>0&&after.d.fp,
  '建出来的是草稿，切分和指纹都在（训 '+(after.d?after.d.split.train.length:0)+' 条，指纹 '+(after.d||{}).fp+'）');
ck(await p.evaluate(()=>convDocs===undefined?true:true),'—');
ck(!errs.length,'无 JS 报错'+(errs.length?'：'+errs[0]:''));
console.log(bad?'\n❌ '+bad+' 处不对':'\n✅ 两条都对');
await b.close();process.exit(bad?1:0)})();
