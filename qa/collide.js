/* 用例二：data-* 属性名不许被两套 q() 处理器抢。
   后绑定的会静默覆盖前一个，表现是「点了没反应」，而且 grep 查不出来。 */
const fs=require('fs');
const src=fs.readFileSync(process.argv[2],'utf8');
const binds={};
const re=/q\('\[data-([a-z0-9-]+)\]'\s*,/g;let m;
while((m=re.exec(src))!==null){binds[m[1]]=(binds[m[1]]||0)+1}
const dup=Object.entries(binds).filter(([,n])=>n>1);
if(dup.length){console.log('❌ 同一个 data-* 被绑定多次（后者覆盖前者）：');
  dup.forEach(([k,n])=>console.log(`   data-${k} × ${n}`));process.exitCode=1}
else console.log(`✅ ${Object.keys(binds).length} 个 data-* 处理器，没有重名覆盖`);
