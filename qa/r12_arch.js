/* 归档：产物存入项目之后要能在项目里找回来，内容必须是冻住的那一份。 */
const {chromium}=require('../test-browser.cjs');
(async()=>{const b=await chromium.launch(),p=await b.newPage({viewport:{width:1400,height:950}});
 const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.goto('file://'+process.argv[2]);await p.waitForTimeout(600);
 const r=await p.evaluate(()=>{
   const o={};
   const prj=DB.projects[0];S.pid=prj.id;
   // ① 报告能生成且非空
   const md=artReportMd(prj.id,4);
   o.报告={行:md.split('\n').length,字:md.length,有裁决:/## 六 · 裁决/.test(md),有局限:/这份报告不做的事/.test(md)};
   // ② 存入项目
   const t=TASKS.find(x=>x.cap==='des'&&x.st==='done');
   /* 归档写进的是**任务自己的**项目，不是当前选中的项目。
      这个探针以前写成 PRJ()，只有在 archive() 那个优先级 bug 还在
      （find 永远返回第一个项目）的时候才碰巧对得上。 */
   const own=DB.projects.find(x=>x.id===t.pid);S.pid=t.pid;
   const a=artsOf(t)[1];                 // variants.csv
   const r1=archive(a,t);
   o.归档=r1.rec?{id:r1.rec.id,字节:r1.rec.bytes,指纹:r1.rec.hash}:'失败';
   // ③ 同样内容再存一次应当被认出来，不重复存
   const r2=archive(a,t);
   o.重复存=r2.dup?('认出来了 → '+r2.dup.id):'又存了一份（不对）';
   // ④ 冻住：数据变了，归档件不变，现算的变
   const before=r1.rec.body.length;
   const freshBefore=a.make().length;
   DB.cands.filter(c=>c.pid===t.pid).slice(0,10).forEach(c=>{if(c.m)c.m.dTm=99.9});
   const freshAfter=a.make().length;
   o.冻结={归档件长度前后:[before,own.arch.find(x=>x.id===r1.rec.id).body.length],
     现算长度前后:[freshBefore,freshAfter],
     归档没变:before===own.arch.find(x=>x.id===r1.rec.id).body.length,
     现算变了:freshBefore!==freshAfter};
   // ⑤ 归档件出现在文件管理里
   o.文件管理里的归档=FILES().filter(x=>x.kind==='arch').map(x=>x.name);
   return o;
 });
 console.log(JSON.stringify(r,null,1));
 const ok=r.报告.有裁决&&r.报告.有局限&&r.归档!=='失败'
   &&/认出来了/.test(r.重复存)&&r.冻结.归档没变&&r.文件管理里的归档.length>0;
 console.log(ok?'\n✅ 报告可生成、可归档、归档件冻结且能在项目与文件管理里找回'
   :'\n⚠ 有问题（现算是否随数据变：'+r.冻结.现算变了+'）');
 console.log('JS 错误:',errs.length?errs.slice(0,3):'无');
 await b.close()})();
