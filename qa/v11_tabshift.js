/* tab 角标的数字变位数时，tab 自己不许挪位置。 */
const {chromium}=require('../test-browser.cjs');
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1440,height:1000}});
await p.goto('file://'+process.argv[2]);await p.waitForTimeout(400);
const R=await p.evaluate(()=>{
  go('shelf');
  const read=()=>[...document.querySelectorAll('.tabs .tab')]
    .map(t=>({n:t.textContent.replace(/\s+/g,'').replace(/\d+$/,''),
              x:Math.round(t.getBoundingClientRect().left)}));
  const set=v=>{document.querySelectorAll('.tab-c').forEach(c=>c.textContent=v);};
  const base=read(); set('3'); const one=read(); set('11'); const two=read(); set('148'); const three=read();
  return {base,one,two,three};
});
const same=(a,b)=>a.every((x,i)=>x.x===b[i].x);
console.log('个位数：'+R.one.map(t=>t.n+'@'+t.x).join('  '));
console.log('两位数：'+R.two.map(t=>t.n+'@'+t.x).join('  '));
console.log('三位数：'+R.three.map(t=>t.n+'@'+t.x).join('  '));
let bad=0;
if(!same(R.one,R.two)){console.log('\n❌ 个位数 → 两位数，tab 挪了位置');bad++}
else console.log('\n✅ 个位数和两位数之间 tab 不动');
if(!same(R.two,R.three))console.log('（三位数会变宽 —— 这一档是故意留的，超过 99 本来就该看得见）');
if(bad)process.exitCode=1;
await b.close()})();
