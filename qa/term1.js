/* 一物多名：同一件东西在界面上只能有一个名字。
   这里只查几组最容易分叉的——它们都在用户要靠名字认路的位置上。 */
const fs=require('fs');const h=fs.readFileSync(process.argv[2],'utf8');
/* 只看会被人读到的字符串。块注释整块剥掉：
   原先按行首是不是 /* 或 * 来判断，块注释里不以 * 开头的续行会漏网，
   于是一条写在注释里的措辞也能把探针判挂。 */
const txt=h
  .replace(/\/\*[\s\S]*?\*\//g,' ')
  .split('\n').filter(l=>!l.trim().startsWith('//')).join('\n');
const GROUPS=[
 ['留出集的叫法',['留出集','测试集','holdout 集']],
 ['离开当前层',['关闭','收起说明','返回']],
 ['未接入的叫法',['未接入','没接入','尚未接入','还没接']],
 ['产出的叫法',['产出','产物','输出件']],
];
let bad=0;
GROUPS.forEach(([n,words])=>{
  const hit=words.map(w=>[w,(txt.match(new RegExp(w,'g'))||[]).length]).filter(x=>x[1]);
  console.log('  '+n+'：'+hit.map(x=>x[0]+'×'+x[1]).join('　')||'（没出现）');
});
/* 真正要卡死的一条：同一个动作的按钮动词 */
const verbs=[...txt.matchAll(/>(保存|确定|提交|应用|完成)</g)].map(m=>m[1]);
const uniq=[...new Set(verbs)];
if(uniq.length>2){bad++;console.log('  ❌ 确认类按钮用了 '+uniq.length+' 个不同的动词：'+uniq.join('、'))}
else console.log('  ✓ 确认类按钮的动词没分叉'+(uniq.length?'（'+uniq.join('、')+'）':''));
/* 「未接入」不能有第二种写法 */
const alt=['没接入','尚未接入'].filter(w=>txt.indexOf(w)>=0);
if(alt.length){bad++;console.log('  ❌ 「未接入」还有别的写法：'+alt.join('、'))}
else console.log('  ✓ 「未接入」只有一种写法');
console.log(bad?'\n❌ '+bad+' 处叫法分叉':'\n✅ 叫法没有分叉');
process.exit(bad?1:0);
