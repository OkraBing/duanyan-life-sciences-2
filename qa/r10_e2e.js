/* 轮次十：端到端走一遍闭环，看哪里断。
   提问 → 建任务 → 看结果 → 选候选 → 送检 → 回流 → 下一轮。
   每一步只问一件事：上一步的产物，这一步看得见吗。 */
const {chromium}=require('../test-browser.cjs');
const step=[];
const ok=(n,v,d)=>step.push([v?'✅':'❌',n,d||'']);
(async()=>{const b=await chromium.launch(),p=await b.newPage({viewport:{width:1400,height:950}});
 const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.goto('file://'+process.argv[2]);await p.waitForTimeout(500);

 // 1 首页提问 → 产出一个任务
 const r1=await p.evaluate(async()=>{
   S.route='home';S.capPick='str';S.ask='预测 R59 区域三条变体的复合物结构';render();
   const before=TASKS.length;
   const go=[...document.querySelectorAll('#view [data-act="plan"]')][0];
   if(!go)return {err:'首页没有提交按钮'};
   go.click();await new Promise(s=>setTimeout(s,250));
   return {新增任务:TASKS.length-before, 新任务:TASKS[0]&&{id:TASKS[0].id,cap:TASKS[0].cap,n:TASKS[0].n,pid:TASKS[0].pid,r:TASKS[0].r}};
 });
 // 这一版没有接后端：模型服务连不上时，界面必须说清楚并给一条还能走的路
 const r1b=await p.evaluate(()=>{const o=document.getElementById('planOut');
   const t=o?o.innerText:'';return {有说明:/连不上模型服务|没能生成草案/.test(t),
     有出口:!!(o&&o.querySelector('[data-go],[data-act]')), 文案:t.replace(/\n+/g,' / ').slice(0,120)}});
 ok('① 提问要么建出任务，要么说清为什么并给出路',
   r1.新增任务===1||(r1b.有说明&&r1b.有出口), r1.新增任务===1?'建了任务':r1b.文案);
 ok('① 任务绑到了项目与轮次', !!(r1.新任务&&r1.新任务.pid&&r1.新任务.r), r1.新任务?`${r1.新任务.pid} R${r1.新任务.r}`:'');

 // 2 任务详情页打得开，且能回到它的能力页
 const r2=await p.evaluate(async()=>{
   S.tid=TASKS[0].id;S.route='task';render();
   const t=document.getElementById('view').innerText;
   return {能打开:t.length>120, 有返回:/←/.test(t), 有参数:/参数|输入|产出/.test(t), 摘:t.slice(0,60).replace(/\n/g,' ')};
 });
 ok('② 任务详情可打开', r2.能打开&&r2.有返回, r2.摘);

 // 3 结果页：候选表、判据、命中
 const r3=await p.evaluate(()=>{
   S.route='results';render();const t=document.getElementById('view').innerText;
   return {有表:document.querySelectorAll('#view table tbody tr').length,
     有命中:/命中/.test(t), 有孔板:/孔板容量/.test(t),
     孔板文案:(t.match(/孔板容量[\s\S]{0,40}/)||[''])[0].replace(/\n/g,' ')};
 });
 ok('③ 结果页有候选表与命中', r3.有表>0&&r3.有命中, `${r3.有表} 行`);
 ok('③ 孔板容量按重复数算', /n=/.test(r3.孔板文案), r3.孔板文案.trim());

 // 4 选候选 → 容量提示
 const r4=await p.evaluate(async()=>{
   S.route='results';S.sel=new Set(CANDS().slice(0,plateCap()+5).map(c=>c.id));render();
   const t=document.getElementById('view').innerText;
   return {超出提示:/超出孔板容量/.test(t), 容量:plateCap(), 已选:S.sel.size,
     文案:(t.match(/已选[\s\S]{0,60}/)||[''])[0].replace(/\n/g,' ')};
 });
 ok('④ 超出孔板容量会拦', r4.超出提示, r4.文案.trim());

 // 5 送检页：板位、对照、报价
 const r5=await p.evaluate(()=>{
   S.route='wetlab';JOBV.wetlab='';S.wtab='wet';render();
   let t=document.getElementById('view').innerText;
   if(!/板位|对照/.test(t)){const b=[...document.querySelectorAll('#view button')].find(x=>/送检与回流/.test(x.innerText));
     if(b){b.click();t=document.getElementById('view').innerText}}
   return {有板位:/板位|孔/.test(t), 有对照:/对照/.test(t), 有报价:/报价|元|\$/.test(t),
     主按钮:[...document.querySelectorAll('#view .ctl-go,#view .btn-pri')].map(b=>b.innerText.trim()+(b.disabled?'（禁用）':'')).join(' ｜ ')};
 });
 ok('⑤ 送检页有板位 / 对照 / 报价', r5.有板位&&r5.有对照&&r5.有报价, r5.主按钮);

 // 6 回流：字段映射 → 写回变体库
 const r6=await p.evaluate(()=>{
   let t=document.getElementById('view').innerText;   // 承接上一步的「送检与回流」页签
   return {有映射:/字段|规格|实验类型/.test(t), 有校验:/校验|质量|约束/.test(t), 有写回:/写回|变体库|回流/.test(t),
     列名:/kd_pm/.test(t)?'kd_pm':(/kd_nm/.test(t)?'kd_nm（单位还是旧的）':'没出现')};
 });
 ok('⑥ 回流有字段映射与写回', r6.有映射&&r6.有写回, '列名 '+r6.列名);

 // 7 下一轮：收敛判断与出口
 const r7=await p.evaluate(()=>{
   S.route='round';render();const t=document.getElementById('view').innerText;
   return {有出口:/继续|收口|换|停/.test(t), 有容量:/容量/.test(t),
     容量数:(t.match(/下一轮容量[\s\S]{0,12}/)||[''])[0].replace(/\n/g,' ')};
 });
 ok('⑦ 轮次出口与下一轮容量', r7.有出口&&r7.有容量, r7.容量数.trim());

 // 8 单位一致性：全站不该再出现 nM 作为 KD 的单位
 const r8=await p.evaluate(()=>{
   const bad=[];
   ['results','wet','intake','loop','hypo','project','wetlab'].forEach(rt=>{
     S.route=rt;render();const t=document.getElementById('view').innerText;
     const m=t.match(/KD[^\n]{0,30}nM|nM[^\n]{0,10}KD/g);
     if(m)bad.push(rt+'：'+m.slice(0,2).join(' / '));
   });
   return bad;
 });
 ok('⑧ KD 单位全站统一为 pM', r8.length===0, r8.join(' ⧉ ')||'没有残留的 nM');

 step.forEach(([m,n,d])=>console.log(m,n,d?'　'+d:''));
 console.log('\nJS 错误:',errs.length?errs.slice(0,3).join(' | '):'无');
 console.log(step.every(x=>x[0]==='✅')?'\n✅ 闭环走通':'\n⚠ 有断点');
 await b.close()})();
