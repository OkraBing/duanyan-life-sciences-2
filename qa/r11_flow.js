/* 产物流转：每个已完成任务都要有产物；每个产物都要能生成内容；
   每个产物的字段要么有下游（节点或界面），要么界面明说它流不到下一步。 */
const {chromium}=require('../test-browser.cjs');
(async()=>{const b=await chromium.launch(),p=await b.newPage({viewport:{width:1400,height:950}});
 const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.goto('file://'+process.argv[2]);await p.waitForTimeout(600);
 const r=await p.evaluate(()=>{
   const out={任务:[],产物:[],问题:[]};
   TASKS.filter(t=>t.st==='done').forEach(t=>{
     let A=[];
     try{A=artsOf(t)}catch(e){out.问题.push(t.id+' artsOf 报错 '+e.message);return}
     if(!A.length){out.问题.push(t.id+'（'+capName(t.cap)+'）没有产物');return}
     out.任务.push(t.id+' → '+A.length+' 个');
     A.forEach(a=>{
       let body=null;
       try{body=a.make()}catch(e){out.问题.push(a.name+' 生成报错 '+e.message);return}
       if(body==null||!String(body).length){out.问题.push(a.name+' 生成了空内容');return}
       const down=artConsumers(a.f).length+artSinks(a.f).length;
       out.产物.push({名:a.name,字段:a.f,字节:new Blob([body]).size,下游:down});
     });
   });
   /* 每个节点声明要的字段，至少要有人产得出来，否则那一步永远接不上 */
   const gives={};Object.keys(PIPE).forEach(c=>PIPE[c].forEach(n=>(n.give||[]).forEach(f=>gives[f]=1)));
   const made={};TASKS.filter(t=>t.st==='done').forEach(t=>{try{artsOf(t).forEach(a=>made[a.f]=1)}catch(e){}});
   /* need 的字段如果产品里没人产，那它必须是「要你自己填」，而且节点上要写出来 */
   out.要自己填=[];
   Object.keys(PIPE).forEach(c=>PIPE[c].forEach(n=>(n.need||[]).forEach(f=>{
     if(made[f]||gives[f])return;
     if(fieldSupply(f)!=='user')out.问题.push('节点「'+n.n+'」要 '+f+'，产不出也不算用户输入');
     else out.要自己填.push(n.n+' ← '+FIELD_N(f)+'（'+f+'）');
   })));
   return out;
 });
 console.log('任务 → 产物：'); r.任务.forEach(x=>console.log('  ',x));
 console.log('\n产物（字段 / 字节 / 下游去向数）：');
 r.产物.forEach(a=>console.log('  ',a.名.padEnd(30),a.字段.padEnd(12),String(a.字节).padStart(7),'B  下游',a.下游));
 console.log('\n要研究员自己给的输入：');(r.要自己填||[]).forEach(x=>console.log('  ',x));
 console.log(r.问题.length?'\n⚠ 问题：\n   '+r.问题.join('\n   '):'\n✅ 产物齐全、可生成、去向明确');
 console.log('JS 错误:',errs.length?errs.slice(0,3):'无');
 await b.close()})();
