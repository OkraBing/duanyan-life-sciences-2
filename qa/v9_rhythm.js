/* V9 · 视觉节奏：间距要落在尺度上，重复元素要对齐。
   随手写的 7px / 13px / 19px 不会被单独看出来，但满屏都是时，页面就「说不清哪里不对」。 */
const fs=require('fs');
const s=fs.readFileSync(process.argv[2],'utf8');
const css=(s.match(/<style[^>]*>([\s\S]*?)<\/style>/g)||[]).join('\n');
const body=s.replace(/<style[^>]*>[\s\S]*?<\/style>/g,'');
const scale=new Set();
(css.match(/--s\d+:\s*[^;]+/g)||[]).forEach(d=>scale.add(d.split(':')[1].trim()));
console.log('间距尺度：'+[...scale].join(' / '));
// 内联样式里写死的像素间距
const hits={};
(body.match(/style\s*=\s*"[^"]*"/g)||[]).forEach(m=>{
  (m.match(/(?:gap|margin[a-z-]*|padding[a-z-]*)\s*:\s*[-\d.]+px/g)||[]).forEach(h=>{
    const v=h.split(':')[1].trim();
    hits[v]=(hits[v]||0)+1});
});
const odd=Object.keys(hits).filter(v=>{
  const n=parseFloat(v);return n!==0&&n%4!==0});   // 这套尺度是 4 的倍数
console.log('内联像素间距共 '+Object.values(hits).reduce((a,b)=>a+b,0)+' 处，取值 '+Object.keys(hits).length+' 种');
if(odd.length){console.log('⚠ 不在 4 倍数上的：'+odd.map(v=>v+'×'+hits[v]).join('  '));
  console.log('   （不是都要改：1px 是描边，2px 是微调。要盯的是 7 / 13 / 19 这类随手数）')}
else console.log('✅ 内联间距都落在尺度上');
