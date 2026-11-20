// 死代码：act() 里接住了，但界面上任何地方都发不出来的动作
const fs=require('fs');const h=fs.readFileSync(process.argv[2],'utf8');
const handled=[...new Set([...h.matchAll(/\ba==='([a-zA-Z0-9_]+)'/g)].map(m=>m[1]))].sort();
// 动作名可能出现在：data-act="x"、字段上的 acts:[{a:'x'}]、以及代码里直接 act('x')
const dead=handled.filter(x=>{
  const pats=[new RegExp('data-act="'+x+'"'), new RegExp("\\ba:'"+x+"'"),
              new RegExp("act\\('"+x+"'"), new RegExp('data-act="\\$\\{'),
              new RegExp("'"+x+"'\\s*,\\s*n:"), new RegExp('\\bacts:[^\\]]*\\b'+x+'\\b')];
  // 只认前三种确定来源；data-act="${...}" 的动态情况单独看
  return !(pats[0].test(h)||pats[1].test(h)||pats[2].test(h));
});
console.log('act() 接住 '+handled.length+' 个动作');
if(dead.length){console.log('✗ 没有入口的 '+dead.length+' 个：');
  dead.forEach(x=>console.log('    '+x));}
else console.log('✅ 每个动作都有入口');
process.exit(dead.length?1:0);
