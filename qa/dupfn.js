/* 顶层函数重名：JS 不报错，后声明的静默覆盖先声明的。
   plate() 就是这么撞上已有的 plate(rows,cols) 的——调用时无限递归，
   而 symbols.js 只查「这个名字在不在」，名字在，它就过了。 */
const fs=require('fs');
const s=fs.readFileSync(process.argv[2],'utf8');
const seen={},dup=[];
const re=/^function\s+([A-Za-z_$][\w$]*)\s*\(/gm;
let m;while((m=re.exec(s))){const n=m[1];
  const line=s.slice(0,m.index).split('\n').length;
  if(seen[n])dup.push(n+'　第 '+seen[n]+' 行 与 第 '+line+' 行');
  else seen[n]=line}
// const/let 顶层同名也查
const re2=/^(?:const|let)\s+([A-Za-z_$][\w$]*)\s*=/gm;
const cs={};while((m=re2.exec(s))){const n=m[1];
  const line=s.slice(0,m.index).split('\n').length;
  if(cs[n])dup.push('(const) '+n+'　第 '+cs[n]+' 行 与 第 '+line+' 行');
  else cs[n]=line;
  if(seen[n])dup.push('(函数/常量混用) '+n+'　第 '+seen[n]+' 行 与 第 '+line+' 行')}
console.log('顶层函数 '+Object.keys(seen).length+' 个，顶层常量 '+Object.keys(cs).length+' 个');
if(dup.length){console.log('❌ 重名 '+dup.length+' 处');dup.forEach(d=>console.log('   '+d));process.exitCode=1}
else console.log('✅ 没有重名');
