const {chromium}=require('../test-browser.cjs');
const lum=c=>{const [r,g,b]=c.map(v=>{v/=255;return v<=.03928?v/12.92:Math.pow((v+.055)/1.055,2.4)});
  return .2126*r+.7152*g+.0722*b};
const ratio=(a,b)=>{const l1=lum(a),l2=lum(b);return (Math.max(l1,l2)+.05)/(Math.min(l1,l2)+.05)};
(async()=>{const b=await chromium.launch();
for(const theme of ['light','dark']){
 const p=await b.newPage({viewport:{width:1440,height:1000},colorScheme:theme});
 await p.goto('file://'+process.argv[2]);await p.waitForTimeout(300);
 await p.evaluate(t=>{document.documentElement.dataset.theme=t;S.theme=t;render()},theme);
 await p.waitForTimeout(200);
 const samples=await p.evaluate(async()=>{const vs=['home','projects','library','design','results','config','admin','wetlab','viewer','shelf','data','models','wet','tasks'];
   const out=[];for(const v of vs){location.hash=v;await new Promise(r=>setTimeout(r,80));
     document.querySelectorAll('#view *').forEach(e=>{
       if(!e.childNodes.length)return;
       const hasText=[...e.childNodes].some(n=>n.nodeType===3&&n.textContent.trim().length>1);
       if(!hasText)return;
       const cs=getComputedStyle(e);
       const fs=parseFloat(cs.fontSize),fw=parseInt(cs.fontWeight)||400;
       let bg=null,el=e;
       while(el){const c=getComputedStyle(el).backgroundColor;
         if(c&&c!=='rgba(0, 0, 0, 0)'&&c!=='transparent'){bg=c;break}el=el.parentElement}
       out.push({fg:cs.color,bg:bg||getComputedStyle(document.body).backgroundColor,fs:fs,fw:fw,
         tag:e.tagName.toLowerCase()+'.'+(e.className||'').toString().split(' ')[0],v:v,
         txt:e.textContent.trim().slice(0,18)})})}
   return out});
 const parse=c=>{const m=c.match(/\d+/g);return m?[+m[0],+m[1],+m[2]]:[0,0,0]};
 const bad=[];
 samples.forEach(x=>{const r=ratio(parse(x.fg),parse(x.bg));
   const large=x.fs>=24||(x.fs>=18.66&&x.fw>=700);
   const need=large?3:4.5;
   if(r<need)bad.push(`${x.fg} on ${x.bg} | ${r.toFixed(2)}<${need} | ${x.fs}px ${x.tag} @${x.v}`)});
 const uniq=[...new Set(bad)];
 // 按「前景色 on 背景色」归并——同一对颜色就是同一个 token 问题，一条条列没意义
 const byPair={};uniq.forEach(x=>{const k=x.split(' | ')[0];(byPair[k]=byPair[k]||[]).push(x)});
 console.log(`${theme}：采样 ${samples.length} 处，不达标 ${uniq.length} 处，涉及 ${Object.keys(byPair).length} 对颜色`);
 Object.keys(byPair).sort((a,b)=>byPair[b].length-byPair[a].length).forEach(k=>{
   const L=byPair[k];console.log(`   ${k}  ×${L.length}  例：${L[0].split(' | ').slice(1).join(' | ')}`)});
 await p.close();}
await b.close();})();
