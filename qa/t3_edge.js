/* 第 3 轮 · 边界：没有历史、没有候选、直接贴链接进来、筛到空
   产品在「有数据」时都对，难的是没数据时还说得对。 */
const {chromium}=require('../test-browser.cjs');
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1440,height:1000}});
const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto('file://'+process.argv[2]);await p.waitForTimeout(500);
const bad=[];const say=(ok,m,d)=>{console.log((ok?'  ✅ ':'  ❌ ')+m+(d?'　'+d:''));if(!ok)bad.push(m)};

console.log('\n① 一个候选都没有的项目：预览条数该说「算不出」，不该编一个数');
let r=await p.evaluate(()=>{
  const keep=DB.cands.slice();DB.cands=[];S.pid='p1';
  const o={preview:dfModeN('preview'),why:dfWhy('preview'),n:dfN(),est:desEst()};
  go('design');
  /* 那句 .qnote 说明已经删了。条数现在写在底部发起栏里，验的还是同一件事：
     界面上不许出现一个算不出来却硬写出来的数。 */
  const foot=document.querySelector('#view .launch-go');
  o.txt=foot?foot.innerText.replace(/\s+/g,' '):'（找不到发起栏）';
  DB.cands=keep;return o});
say(r.preview===null,'预览条数 = 算不出');
say(/算不出|自己填/.test(r.why),'说明照实写','「'+r.why+'」');
say(r.txt.indexOf('找不到')<0,'底部发起栏在页面上','「'+r.txt.slice(0,70)+'」');
say(!/\b0 条\b/.test(r.txt),'界面上不出现「0 条」这种假数','「'+r.txt.slice(0,70)+'」');

console.log('\n② 直接贴链接进一个深页（没有走过的路），还回不回得去');
r=await p.evaluate(()=>{
  S.back=[];S.route='viewer';location.hash='viewer';render();
  const btn=document.querySelector('#view [data-act="goback"]');
  const any=[...document.querySelectorAll('#view button,#view a')].some(e=>/^\s*←/.test(e.textContent||''));
  return {btn:!!btn,any,nav:!!NAV_ROUTE.viewer}});
say(r.btn||r.any||r.nav,'深链进来的页面也有回路','（返回键 '+r.btn+'）');

console.log('\n③ 文件管理：筛到空时，还给不给得出下一步');
r=await p.evaluate(()=>{
  S.ft='kb';S.fp='p1';S.fx='全部';S.fq='不存在的文件名';go('files');
  const t=document.querySelector('#view .empty');
  const zip=!!document.querySelector('#view [data-act="fzip"]');
  const clr=!!document.querySelector('#view [data-act="fflclear"]');
  S.ft=S.fp=S.fx='全部';S.fq='';
  return {txt:t?t.innerText.replace(/\s+/g,' '):null,zip,clr}});
say(!!r.txt&&r.clr,'空态有一条出路','「'+(r.txt||'').slice(0,46)+'」');
say(!r.zip,'筛到空时不摆一个点了没反应的打包键');

console.log('\n④ 没留参数的老任务，运行记录会不会拿「当前配置」冒充');
r=await p.evaluate(()=>{
  const t=TASKS.find(x=>!x.params&&x.st==='done')||{id:'(造一个)',params:null,cap:'str',n:'x',at:'',st:'done'};
  const j=JSON.parse(artRunJson(t));
  return {id:t.id,prov:j.provenance,note:j.provenance_note}});
say(r.prov===null||r.prov===undefined||!!r.note,'没参数就照实说没参数','['+r.id+'] '+(r.note||JSON.stringify(r.prov)))

console.log('\n⑤ 没有任务的项目，关联任务与文件该说什么');
r=await p.evaluate(()=>{
  /* 原先拿 p2 当「没有任务的项目」，可 p2 有 1 个任务——这条过去是碰巧过的。
     现在自己造一个真的空项目来测。 */
  const T=PTYPES[0],D=DOMAINS[0];
  DB.projects.push({id:'pT',name:'空项目',target:T.n,ptype:T.k,dom:D.k,fields:T.f.slice(),
    tcp:null,desc:'',state:'active',model:'—',variants:0,returned:0,ink:0,owner:'我',updated:'刚刚',
    kb:[],tools:[],rounds:[{i:1,state:'open',v:0,r:0,mb:'—',ma:'—',note:'',ctrl:0,failed:0,
      plan:{host:'',assay:[],reps:'n = 3',buffer:'',temp:''}}]});
  S.pid='pT';S.ptab='tasks';fixRound();go('pw');
  const e=document.querySelector('#view .empty');
  const txt=e?e.innerText.replace(/\s+/g,' '):null;
  DB.projects.pop();S.pid='p1';S.ptab='kb';fixRound();
  return {txt:txt}});
say(!!r.txt,'没有关联任务时有空态','「'+(r.txt||'（没有）')+'」');

console.log('\nJS 错误:',errs.length?errs:'无');
console.log(bad.length?'\n❌ '+bad.length+' 处':'\n✅ 边界都说得对');
await b.close()})();
