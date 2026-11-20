const {chromium}=require('../test-browser.cjs');
(async()=>{const b=await chromium.launch(),pg=await b.newPage({viewport:{width:1400,height:900}});
 await pg.goto('file://'+process.argv[2]);await pg.waitForTimeout(400);
 const R=await pg.evaluate(()=>Object.keys(V));const bad=[];
 for(const r of R){
   await pg.evaluate(x=>{location.hash=x},'#'+r);await new Promise(s=>setTimeout(s,180));
   const x=await pg.evaluate(()=>[...document.querySelectorAll('#view svg')]
     .filter(s=>{const q=s.getBoundingClientRect();
       return (q.width<2||q.height<2)&&s.offsetParent!==null&&s.getAttribute('width')})
     .map(s=>(s.parentElement.className||s.parentElement.tagName)+' '+s.getAttribute('width')+'→'
       +Math.round(s.getBoundingClientRect().width)+'x'+Math.round(s.getBoundingClientRect().height)));
   if(x.length)bad.push(r+': '+[...new Set(x)].join(' ｜ '));
 }
 console.log(bad.length?'被压扁的 SVG：\n  '+bad.join('\n  '):'✅ 没有被压扁的 SVG');
 await b.close()})();
