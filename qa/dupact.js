/* 用例二之二：act() 里同一个动作名被写了两遍——前一个 return，后一个永远不执行。
   collide.js 只看 q('[data-*]') 绑定，看不到这条分发链。 */
const fs=require('fs');
const s=fs.readFileSync(process.argv[2],'utf8');
const i=s.indexOf('function act(a,el){');
if(i<0){console.log('没找到 act()');process.exit(1)}
/* 花括号配对找函数体（R18：不用非贪婪正则删/切函数） */
let d=0,j=s.indexOf('{',i),end=j;
for(let k=j;k<s.length;k++){const ch=s[k];
  if(ch==='{')d++;else if(ch==='}'){d--;if(!d){end=k;break}}}
const body=s.slice(j,end);
const seen={},dups=[];
const re=/if\(a==='([a-zA-Z0-9_-]+)'\)/g;let m;
while((m=re.exec(body))){const k=m[1];
  const line=s.slice(0,j+m.index).split('\n').length;
  if(seen[k])dups.push([k,seen[k],line]);else seen[k]=line}
console.log(dups.length
  ? '❌ act() 里重复的动作名（后面那条是死代码）：\n   '+dups.map(([k,a,b])=>`${k}：第 ${a} 行命中，第 ${b} 行永远到不了`).join('\n   ')
  : `✅ act() 里 ${Object.keys(seen).length} 个动作名，没有重复`);
process.exit(dups.length?1:0);
