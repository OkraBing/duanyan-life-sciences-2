const {chromium}=require('../test-browser.cjs');
(async()=>{const b=await chromium.launch();const p=await b.newPage();
await p.goto('file://'+process.argv[2]);await p.waitForTimeout(400);
for(const say of ['检索和这条序列同源的条目','用这个项目的实测数据训一个打分模型','把这批候选送去测亲和力','在这个界面上设计一批结合蛋白','把这条序列折出来看看置信度']){
  const o=await p.evaluate(async(say)=>{
    S.sid='t'+Math.random();CONV[S.sid]=[];S.pid='p1';go('chat');
    document.getElementById('ask').value=say;agentSend();
    await new Promise(r=>setTimeout(r,900));
    const f=document.querySelector('[data-kgo]');if(f){f.click();await new Promise(r=>setTimeout(r,4500))}
    return convDocs().map(d=>({name:d.name,body:String(d.make()).slice(0,700)}));
  },say);
  o.forEach(d=>{console.log('\n=============== '+d.name+' ===============');console.log(d.body)});
}
await b.close()})();
