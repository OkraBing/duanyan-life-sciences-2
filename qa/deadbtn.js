/* 死按钮检查：界面上声明了 data-act，但分发函数里既没有 if 分支也没有 toast 文案。
   2026-11-12 实例：「改目标」按钮加上去了，处理函数忘了写——点下去什么都不发生。 */
const fs=require('fs');
const s=fs.readFileSync(process.argv[2],'utf8');
/* 一个动作可以由 data-act 声明，也可以被代码直接 act('x') 调起
   （示例 chip、弹窗的确认回调都是后者）。两种都算「界面上有」。 */
const declared=[...new Set(
  [...s.matchAll(/data-act="([a-z_]+)"/g)].map(m=>m[1])
  .concat([...s.matchAll(/\bact\(['"]([a-z_]+)['"]\s*[,)]/g)].map(m=>m[1])))];
/* 只认分发链上的 a==='x'：开头是 if( 或 ||。
   否则 typeof data==='string'、rt.state==='reflux' 这种也会被当成动作名，
   反过来又会把 if(a==='x'||a==='y') 里的两个都漏掉。 */
const handled=new Set([...s.matchAll(/(?:if\(|\|\|)\s*a===['"]([a-z_]+)['"]/g)].map(m=>m[1]));
const M=s.match(/const M=\{([\s\S]*?)\};/);
if(M)[...M[1].matchAll(/(\w+):/g)].forEach(m=>handled.add(m[1]));
const dead=declared.filter(a=>!handled.has(a));
const orphan=[...handled].filter(a=>declared.indexOf(a)<0);
console.log(dead.length?'❌ 死按钮（界面有、没人处理）: '+dead.join(', ')
  :'✅ '+declared.length+' 个 data-act 都有处理');
console.log(orphan.length?'⚠ 处理了但界面上没有: '+orphan.join(', '):'✅ 没有多余的处理分支');
process.exit(dead.length?1:0);
