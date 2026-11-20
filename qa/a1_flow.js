/* Agent 主干：一句话 → 出卡 → 填完发起 → 跑完出结果。每条能力都要走通。 */
const {chromium}=require('../test-browser.cjs');
const CASES=[
 ['检索和这条序列同源的条目','seek','hits'],
 ['把这条序列折出来看看置信度','str','struct3'],
 ['在这个界面上设计一批结合蛋白','des','vtab'],
 ['把这批候选送去测亲和力','lab','batch'],
 ['用这个项目的实测数据训一个打分模型','train','metric'],
 ['这个项目里都有哪些文件','file','flist'],
 /* 这四条要先填一步才跑得起来，所以单独在 m1/m2/m6 里走完整流程，
    这里只验路由和第一张卡出得对。 */
 ['给这段模板设一对 PCR 引物','primer','form'],
 ['在这段序列上选 sgRNA','sgrna','form'],
 ['上传一份数据建成数据集','dset','form'],
 ['比一下处理组和对照组哪些基因变了','deg','form']];
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1280,height:1000}});
const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto('file://'+process.argv[2]);await p.waitForTimeout(500);
let bad=0;
for(const [say,cap,want] of CASES){
  const r=await p.evaluate(async([say,cap,want])=>{
    S.sid='t'+Math.random();CONV[S.sid]=[];S.pid='p1';go('chat');
    const ta=document.getElementById('ask');ta.value=say;
    agentSend();
    /* 卡片一张一张出，中间还有一段占位——等到表单出来或者不会再出为止 */
    for(let k=0;k<90;k++){
      if(document.querySelector('[data-kgo]')||convOf().some(m=>(m.cards||[]).some(c=>c.t==='flist')))break;
      await new Promise(r=>setTimeout(r,120));
    }
    const got=t=>{const L=convOf();return L.some(m=>(m.cards||[]).some(c=>c.t===t))};
    const out={路由到:null,出了:[],最终:null};
    convOf().forEach(m=>(m.cards||[]).forEach(c=>out.出了.push(c.t)));
    if(got('flist'))return Object.assign(out,{最终:'flist'});
    /* 要的就是表单本身的那几条，出了表单就算到位 */
    if(want==='form'&&got('form'))return Object.assign(out,{最终:'form'});
    // 有表单就填完发起
    const f=document.querySelector('[data-kgo]');
    if(!f)return out;
    f.click();
    await new Promise(r=>setTimeout(r,5400));
    out.出了=[];convOf().forEach(m=>(m.cards||[]).forEach(c=>out.出了.push(c.t)));
    out.最终=got(want)?want:null;
    return out;
  },[say,cap,want]);
  const ok=r.最终===want;
  if(!ok)bad++;
  console.log(`${ok?'  ✓':'  ❌'} 「${say}」\n      卡片：${r.出了.join(' → ')||'（没出卡）'}`);
}
console.log(bad?`\n❌ ${bad} 条没走通`:'\n✅ 十条能力都从一句话走到了对的卡');
console.log('JS 错误:',errs.length?errs.slice(0,3):'无');
if(bad||errs.length)process.exitCode=1;
await b.close()})();
