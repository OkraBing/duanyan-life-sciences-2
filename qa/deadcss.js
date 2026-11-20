/* 死样式：标记里一处都不用的 class，样式表里却还留着规则。
   它不是「没用」——它会安静地盖掉同名的新规则。
   2026-11-13 实例：上一版行式流程留下的 .pipe{gap:1px} 写在新 .pipe 规则后面，
   把新流程的卡间距压成 1px，而页面不报任何错。 */
const fs=require('fs');
const s=fs.readFileSync(process.argv[2],'utf8');
const css=(s.match(/<style[^>]*>([\s\S]*?)<\/style>/g)||[]).join('\n');
const body=s.replace(/<style[^>]*>[\s\S]*?<\/style>/g,'');
// 样式表里出现过的 class 选择器
const declared=new Set();
(css.match(/\.[a-zA-Z][\w-]*/g)||[]).forEach(c=>declared.add(c.slice(1)));
// 标记里用到的 class：class="..." 模板里也可能是拼出来的，所以同时扫裸出现
const used=new Set();
(body.match(/class\s*=\s*["'`][^"'`]*["'`]/g)||[]).forEach(m=>
  m.replace(/^class\s*=\s*["'`]|["'`]$/g,'').split(/[\s${}()?:+'"`|&]+/).forEach(c=>c&&used.add(c)));
(body.match(/classList\.(?:add|remove|toggle|contains)\(['"]([\w-]+)/g)||[]).forEach(m=>
  used.add(m.split(/['"]/)[1]));
// 伪类/状态类与工具类不算：它们总是和别的类拼在一起出现
const SKIP=/^(is-|has-|c-|j-|tag-|menu-|dd-|sr$|grow$|row$|col$|num$|ell$|mut|hint$|lbl$|chip$|card|btn|input$|tab|pill$|bar$|rail$|dot$|car$|v$|ink$|serif$|empty$|page$|wrap$|on$|sb$|nm$|x$|t-|s[0-9]|r[0-9])/;
const dead=[...declared].filter(c=>!used.has(c)&&!SKIP.test(c)).sort();
console.log('样式里声明的 class '+declared.size+' 个，标记里用到 '+used.size+' 个');
if(dead.length){console.log('⚠ 标记里没用到的 class '+dead.length+' 个：');
  console.log('   '+dead.join('  '));
  console.log('   （并非都要删：有的是运行时拼出来的。要盯的是和活规则同名、会互相覆盖的那些）');}
else console.log('✅ 没有明显的死样式');
