/* V10b · 加载态：每个发请求的地方，在请求发出之前就要让界面变样。
   否则按下去一片死寂，人会重复点。只看请求前 14 行里有没有「挂起」标记。
   取数助手本身不碰界面，豁免要写在它旁边（[LOADING_BY_CALLER]），不藏在这个探针里。 */
const fs=require('fs');
const L=fs.readFileSync(process.argv[2],'utf-8').split('\n');
const TRIG=/\b(fetch\(|MC\.chat\(|MC\.probe\()/;
const IND=/busy\s*=\s*true|disabled\s*=\s*true|\.disabled=true|skel|取回中|请求中|正在|…|st:\s*'run'|phase\s*=\s*'[a-z]*run'|loading|pending|LOADING_BY_CALLER/;
const hits=[];
L.forEach((ln,i)=>{ if(!TRIG.test(ln))return;
  const win=L.slice(Math.max(0,i-14),i+1).join('\n');
  hits.push([i+1,ln.trim().slice(0,58),IND.test(win)]); });
console.log('发起请求 '+hits.length+' 处');
const bad=hits.filter(h=>!h[2]);
hits.forEach(([n,t,ok])=>{ if(!ok)console.log('   ❌ '+n+'  '+t) });
if(bad.length){console.log('\n❌ '+bad.length+' 处请求前界面没有任何变化');process.exitCode=1}
else console.log('✅ 每个请求在发出前都先让界面变了样');
