const {chromium}=require('../test-browser.cjs');
(async()=>{const b=await chromium.launch();
const p=await b.newPage({viewport:{width:1440,height:1000}});
await p.goto('file://'+process.argv[2]);await p.waitForTimeout(400);
const views=['home','projects','library','design','models','wet','shelf','data','admin','intake','viewer','config','results','loop','wetlab','tasks','pw','hypo','round','project','task','chats','account','inbox','dataset'];
let bad=[];
for(const v of views){
  await p.evaluate(h=>{if(h==='task')S.tid='T-118';location.hash=h},v);await p.waitForTimeout(130);
  const r=await p.evaluate(()=>{const out=[];
    document.querySelectorAll('#view *, #side *').forEach(e=>{
      if(getComputedStyle(e).textTransform==='uppercase')
        out.push((e.className||'')+'｜'+e.textContent.trim().slice(0,18));});
    return out;});
  r.forEach(x=>bad.push(v+' '+x));
}
const u=[...new Set(bad)];
console.log(u.length?`❌ 仍有 ${u.length} 处强制大写\n  `+u.slice(0,8).join('\n  ')
  :'✅ 全站无强制大写（ipTM / pLDDT / pI / kcat / α 不会被改坏）');
await b.close();})();
