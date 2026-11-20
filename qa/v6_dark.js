/* V6 · 暗色模式：写死的颜色只在一个主题下成立。
   查两件事：① 标记里内联的 #hex / rgb() 字面量；② 用到却没在 :root 定义的变量。 */
const fs=require('fs');
const s=fs.readFileSync(process.argv[2],'utf8');
const css=(s.match(/<style[^>]*>([\s\S]*?)<\/style>/g)||[]).join('\n');
const body=s.replace(/<style[^>]*>[\s\S]*?<\/style>/g,'');

// ① 内联样式里的颜色字面量
const inline=[];
(body.match(/style\s*=\s*"[^"]*"/g)||[]).forEach(m=>{
  const hits=m.match(/(?:color|background|border[a-z-]*|fill|stroke|box-shadow)\s*:[^;"]*#[0-9a-fA-F]{3,8}/g);
  /* DCOV_BG 是数据库卡封面的装饰底色：刻意固定的深色，白字压在上面，
     两套主题下都成立——它不是「忘了用令牌」，是单一外观的图面。 */
  if(hits)hits.forEach(h=>{if(h.indexOf('DCOV_BG')<0)inline.push(h.trim().slice(0,70))});
});
// SVG 里的 fill/stroke 字面量（图标用 currentColor 才会跟着主题走）
const svgLit=(body.match(/<(?:path|circle|rect|ellipse|line|polygon)[^>]*(?:fill|stroke)="#[0-9a-fA-F]{3,8}"/g)||[]).length;

// ② 用到但没在裸 :root 里定义的变量
/* 裸 :root 可能有多段，而且打包后最前面还有一段 Artifact 骨架自带的
   :root{color-scheme:light;...}。只取第一段会数到骨架那段上去（0 个变量）。
   所以把所有「选择器正好是 :root」的块都收进来，并且按花括号配对取整块，
   非贪婪正则会在块内第一个 } 就停下。 */
function bareRootBlocks(src){
  const out=[];const re=/(^|[\s}>,;])(:root)\s*\{/g;let m;
  while((m=re.exec(src))){
    const i=re.lastIndex-1;let d=0,j=i;
    for(;j<src.length;j++){const c=src[j];
      if(c==='{')d++;else if(c==='}'){d--;if(!d)break}}
    out.push(src.slice(i+1,j));
  }
  return out;
}
const rootBlock=bareRootBlocks(css).join('\n');
const defined=new Set((rootBlock.match(/--[\w-]+(?=\s*:)/g)||[]));
// var(--x, 回落值) 是有意写的回落，不算「没定义」
const used=new Set((css.match(/var\(\s*--[\w-]+\s*\)/g)||[])
  .map(x=>x.replace(/var\(\s*|\s*\)/g,'')));
const undef=[...used].filter(v=>!defined.has(v));

// ③ 只在深色块里出现、裸 :root 没有的变量（最典型的坏味道）
const darkBlocks=(css.match(/@media\s*\(prefers-color-scheme:\s*dark\)[\s\S]*?\n\}/g)||[]).join('\n')
  +(css.match(/:root\[data-theme="dark"\]\s*\{[\s\S]*?\}/g)||[]).join('\n');
const darkOnly=[...new Set((darkBlocks.match(/--[\w-]+(?=\s*:)/g)||[]))].filter(v=>!defined.has(v));

console.log('裸 :root 定义了 '+defined.size+' 个变量，样式里用到 '+used.size+' 个');
let bad=0;
if(inline.length){bad+=inline.length;console.log('\n❌ 标记里内联的颜色字面量 '+inline.length+' 处（不跟主题走）');
  [...new Set(inline)].slice(0,10).forEach(x=>console.log('   '+x))}
if(svgLit){bad+=svgLit;console.log('\n❌ SVG 里写死 fill/stroke '+svgLit+' 处（该用 currentColor）')}
if(undef.length){bad+=undef.length;console.log('\n❌ 用到但裸 :root 没定义：'+undef.join(' '))}
if(darkOnly.length){bad+=darkOnly.length;console.log('\n❌ 只在深色块里定义：'+darkOnly.join(' '))}
if(!bad)console.log('\n✅ 颜色全部走变量，两套主题都定义齐全');
else process.exitCode=1;
