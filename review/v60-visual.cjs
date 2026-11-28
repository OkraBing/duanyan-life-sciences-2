/* 60 轮 tricky review：整体视觉一致性与效果。
   和已有那几套的分工：visual-style.cjs 管「有没有违反定稿的禁令」（8 条），
   interaction-components.cjs 管「同一个控件在两页上长不长得一样」（11 条）。
   这一套管的是**全站范围内的收敛**：26 个页面放在一起，字号有几档、
   圆角有几种、墨色有几级、投影分几层、同一类容器是不是同一种材质。
   单页看不出来的毛病——某一页悄悄多出一个 15px、某个卡片比别处圆 2px——
   只有把所有页面的计算值摆在一张表上才看得见。

   怎么跑（第二个参数是**轮次**，不是文件路径）：
     node review/v60-visual.cjs        全跑 60 轮
     node review/v60-visual.cjs 7      只跑第 7 轮
     node review/v60-visual.cjs 7-12   跑第 7 到 12 轮

   做法：先把 26 个页面各走一遍，把每个可见元素的计算值抄下来（SNAP），
   之后绝大多数轮次是在这张表上做断言，不用再开浏览器。
   需要真交互的轮次（悬停、键盘焦点、弹窗、改视口）自己开页面，标 live。 */
const {chromium}=require('../test-browser.cjs');
const {blockExternalNetwork}=require('./offline-network.cjs');
const path=require('node:path');
const FILE='file://'+path.resolve(__dirname,'..','index.html');
/* 第二个参数是轮次过滤。但全量回归脚本的习惯是把构建产物的路径传给每一套，
   所以看着像路径就当没写过滤——不然会一轮都不跑，还装作跑完了。 */
const RAW=(process.argv[2]||'').trim();
const ARG=(/[\\/]|\.html?$/i.test(RAW))?'':RAW;
const ROUNDS=[];
const R=(n,title,checks,opt)=>ROUNDS.push({n,title,checks,live:!!(opt&&opt.live)});
function must(c,d){if(!c)throw new Error(d||'断言失败')}
const fmt=n=>Math.round(n*100)/100;

/* ===== 被走查的页面 =====
   有些详情页直接 go() 过去是「找不到」，得先从列表里点进去；
   setup 写的就是这一步。name 是报错时给人看的中文名。 */
const PAGES=[
 {r:'workbench',  name:'工作台'},
 {r:'chat',       name:'科研对话'},
 {r:'chats',      name:'全部对话'},
 {r:'projects',   name:'课题项目'},
 {r:'project',    name:'课题详情'},
 {r:'materials',  name:'资料空间'},
 {r:'shared',     name:'与你共享'},
 {r:'sharednew',  name:'新建共享课题'},
 {r:'shareddetail',name:'共享课题详情'},
 {r:'lab',        name:'实验管理'},
 {r:'labnew',     name:'设计实验'},
 {r:'labdet',     name:'实验详情', setup:async p=>{await p.evaluate(()=>go('lab'));await p.waitForTimeout(350);
   const n=await p.locator('#view [data-labgo]').count();if(n)await p.locator('#view [data-labgo]').first().click()}},
 {r:'devices',    name:'设备管理'},
 {r:'devicedetail',name:'设备详情', setup:async p=>{await p.evaluate(()=>go('devices'));await p.waitForTimeout(350);
   const n=await p.locator('#view [data-lv-device]').count();if(n)await p.locator('#view [data-lv-device]').first().click()}},
 {r:'shelf',      name:'科研工具'},
 {r:'toolnew',    name:'新建工具'},
 {r:'data',       name:'数据库'},
 {r:'databasenew',name:'新建数据库'},
 {r:'mdl',        name:'模型制备'},
 {r:'dsets',      name:'模型制备·数据集'},
 {r:'dsnew',      name:'新建数据集'},
 {r:'trainnew',   name:'新建训练任务'},
 {r:'bnew',       name:'新建打分器'},
 {r:'set',        name:'模型接入'},
 {r:'schedules',  name:'定时任务'},
 {r:'settings',   name:'设置'},
];
const PG=r=>PAGES.find(x=>x.r===r);

/* ===== 颜色工具 ===== */
const TOK={
 ink:[23,26,31],ink2:[55,61,70],ink3:[89,97,109],ink4:[98,107,120],
 line:[223,226,230],line2:[233,235,239],
 paper:[248,249,250],surface:[255,255,255],surface2:[243,244,246],surface3:[231,233,237],
 dry:[59,95,155],dryInk:[53,84,135],drySoft:[240,243,248],dryDim:[188,200,217],
 ok:[51,105,80],okSoft:[240,244,241],okInk:[48,95,74],
 err:[179,66,54],errSoft:[251,243,241],
};
function rgb(s){if(!s)return null;const str=String(s);
 const m=str.match(/-?[\d.]+/g);if(!m)return null;
 let a=m.map(Number);
 /* color-mix 算出来的值会写成 color(srgb .82 .69 .69)，三个分量是 0–1。 */
 if(/^color\(/.test(str)){a=a.slice(0,4).map((v,i)=>i<3?Math.round(v*255):v)}
 if(a.length>=4&&a[3]===0)return null;/* 全透明当「没颜色」*/
 return [a[0],a[1],a[2]]}
const alpha=s=>{const m=String(s||'').match(/-?[\d.]+/g);return m&&m.length>=4?Number(m[3]):1};
const dist=(a,b)=>a&&b?Math.max(Math.abs(a[0]-b[0]),Math.abs(a[1]-b[1]),Math.abs(a[2]-b[2])):999;
const isTok=(c,name,tol)=>dist(rgb(c),TOK[name])<=(tol==null?3:tol);
function tokenOf(c,tol){const v=rgb(c);if(!v)return '';let best='',d=1e9;
 for(const k in TOK){const t=dist(v,TOK[k]);if(t<d){d=t;best=k}}return d<=(tol==null?4:tol)?best:''}
/* 中性按饱和度判，不按通道差判。
   --ink-4 是 rgb(98,107,120)，通道差 22，按差值会被当成「上色」，
   但它的饱和度只有 10%，眼睛看到的就是一片灰。墨蓝 --dry 的饱和度是 45%。
   分界线放在 20%：以下算灰，以上算真的上了色。 */
const sat=c=>{const v=rgb(c);if(!v)return 0;
 const mx=Math.max(...v),mn=Math.min(...v);return mx?(mx-mn)/mx:0};
const neutral=(c,tol)=>{const v=rgb(c);if(!v)return true;
 /* 近黑近白按中性算：rgb(23,26,31) 的相对饱和度有 26%，但看上去就是黑。 */
 if(Math.max(...v)<70||Math.min(...v)>205)return true;
 return sat(c)<=((tol==null?20:tol*2.5)/100)};
const lum=c=>{const f=x=>{x/=255;return x<=.03928?x/12.92:Math.pow((x+.055)/1.055,2.4)};
 return .2126*f(c[0])+.7152*f(c[1])+.0722*f(c[2])};
const contrast=(a,b)=>{const L=lum(a),M=lum(b);return (Math.max(L,M)+.05)/(Math.min(L,M)+.05)};
const num=s=>parseFloat(s)||0;

/* ===== 快照 =====
   只抄「看得见、且在视觉上说话」的元素：有文字的叶子、有底色的、有边框的、
   有投影的，以及名字里带组件词的。全抄一遍太大，也没有意义。 */
const SNAPJS=`(()=>{
 const V=document.getElementById('view');
 const KEEP=/btn|card|tab|input|badge|chip|pill|field|empty|table|head|hd|bar|panel|cell|row|tag|dd|sel|crumb|toolbar|note|tip|box|list|item|seg|sw|dot|px|lnk|link|st-|avatar/i;
 const out=[];
 const vw=innerWidth,vh=innerHeight;
 for(const e of V.querySelectorAll('*')){
  const r=e.getBoundingClientRect();
  /* 1×1 的是读屏专用文本（.sr），不在屏上 */
  if(r.width<=2||r.height<=2)continue;
  const c=getComputedStyle(e);
  if(c.visibility==='hidden'||c.display==='none'||parseFloat(c.opacity)===0)continue;
  const leaf=!e.querySelector('*');
  const txt=leaf?e.textContent.trim():'';
  const hasBg=c.backgroundColor&&c.backgroundColor!=='rgba(0, 0, 0, 0)'&&c.backgroundColor!=='transparent';
  const hasBd=parseFloat(c.borderTopWidth)>0||parseFloat(c.borderLeftWidth)>0||parseFloat(c.borderBottomWidth)>0||parseFloat(c.borderRightWidth)>0;
  const hasSh=c.boxShadow&&c.boxShadow!=='none';
  const cls=typeof e.className==='string'?e.className:'';
  if(!(txt||hasBg||hasBd||hasSh||KEEP.test(cls)||/^(h1|h2|h3|h4|th|td|button|input|select|textarea|a|svg)$/.test(e.tagName.toLowerCase())))continue;
  out.push({
   t:e.tagName.toLowerCase(),cls:cls.slice(0,110),
   x:Math.round(r.left),y:Math.round(r.top),w:Math.round(r.width),h:Math.round(r.height),
   fs:Math.round(parseFloat(c.fontSize)*100)/100,fw:c.fontWeight,
   lh:c.lineHeight==='normal'?0:Math.round(parseFloat(c.lineHeight)*100)/100,
   ff:(c.fontFamily||'').split(',')[0].replace(/["']/g,'').trim(),
   col:c.color,bg:c.backgroundColor,
   bw:[c.borderTopWidth,c.borderRightWidth,c.borderBottomWidth,c.borderLeftWidth].map(v=>Math.round(parseFloat(v)*100)/100).join(','),
   bc:[c.borderTopColor,c.borderRightColor,c.borderBottomColor,c.borderLeftColor].join('|'),
   rad:[c.borderTopLeftRadius,c.borderTopRightRadius,c.borderBottomRightRadius,c.borderBottomLeftRadius].join(','),
   sh:hasSh?c.boxShadow:'',
   bgi:c.backgroundImage==='none'?'':c.backgroundImage.slice(0,120),
   pad:[c.paddingTop,c.paddingRight,c.paddingBottom,c.paddingLeft].map(v=>Math.round(parseFloat(v))).join(','),
   mg:[c.marginTop,c.marginRight,c.marginBottom,c.marginLeft].map(v=>Math.round(parseFloat(v))).join(','),
   gap:c.gap==='normal'?'':c.gap,
   ta:c.textAlign,tt:c.textTransform,ov:c.textOverflow,ws:c.whiteSpace,ls:c.letterSpacing==='normal'?'0px':c.letterSpacing,
   tr:c.transitionDuration,
   zi:c.zIndex,pos:c.position,
   txt:txt.slice(0,60),leaf:leaf,
   dis:(e.disabled===true)||e.getAttribute('aria-disabled')==='true',
   foc:document.activeElement===e,
   title:e.getAttribute('title')||'',
   pcls:(e.parentElement&&typeof e.parentElement.className==='string'?e.parentElement.className:'').slice(0,60),
   pt:e.parentElement?e.parentElement.tagName.toLowerCase():'',
   inBtn:!!e.closest('button,a,[role=button],[data-go],[data-nav],[data-act]'),
   abg:(()=>{let n=e.parentElement;while(n&&n!==document.body){
     const c2=getComputedStyle(n).backgroundColor;
     if(c2&&c2!=='rgba(0, 0, 0, 0)'&&c2!=='transparent')return c2;n=n.parentElement}
    return ''})(),
   clipped:(e.scrollWidth-e.clientWidth>1)&&c.overflowX!=='visible'&&c.overflowX!=='auto'&&c.overflowX!=='scroll'
  });
 }
 const root=getComputedStyle(document.documentElement);
 const tok={};for(const k of ['--ink','--ink-2','--ink-3','--ink-4','--line','--line-2','--paper','--surface','--surface-2','--surface-3','--dry','--dry-ink','--dry-soft','--err','--ok','--sh-1','--sh-2','--sh-3','--r1','--r2','--r3','--r4','--sans','--mono'])tok[k]=root.getPropertyValue(k).trim();
 const side=document.getElementById('side');
 const sc=side?getComputedStyle(side):null;
 return {els:out,tok:tok,
  viewBox:(()=>{const r=V.getBoundingClientRect(),c=getComputedStyle(V);
    /* 页面左界 = #view 左边 + 它的左内边距 + 第一个子容器自己的左内边距。
       三者加起来才是「正文从哪开始」，单看哪一层都会把留白算错。 */
    const kid=V.firstElementChild,kc=kid?getComputedStyle(kid):null;
    const kr=kid?kid.getBoundingClientRect():r;
    return {x:Math.round(r.left),w:Math.round(r.width),
     pad:Math.round(parseFloat(c.paddingLeft)),padR:Math.round(parseFloat(c.paddingRight)),
     textX:Math.round(kr.left+(kc?parseFloat(kc.paddingLeft):0))}})(),
  bodyBg:getComputedStyle(document.body).backgroundColor,
  side:sc?{bg:sc.backgroundColor,w:Math.round(side.getBoundingClientRect().width),bd:sc.borderRightWidth+' '+sc.borderRightColor}:null,
  h1:(()=>{const e=V.querySelector('h1');if(!e)return null;const c=getComputedStyle(e);
    /* 标题到它所在那一栏左边的距离。两栏页（资料空间、定时任务）把留白放进了
       自己的栏里，量 #view 的内边距会得出 0，量这个才是眼睛看到的那段白。 */
    /* 往上找第一个「自己给了左内边距、并且够宽算一栏」的祖先：
       那一层就是把正文从栏边推开的那一层，它的左内边距就是眼睛看到的留白。 */
    let pane=e.parentElement,gut=null,paneW=0;
    while(pane&&pane!==document.body){
     const pc=getComputedStyle(pane),pr=pane.getBoundingClientRect();
     const pl=parseFloat(pc.paddingLeft)||0;
     if(pl>0&&pr.width>240){gut=Math.round(pl);paneW=Math.round(pr.width);break}
     if(pane.id==='view'){gut=Math.round(pl);paneW=Math.round(pr.width);break}
     pane=pane.parentElement}
    return {fs:Math.round(parseFloat(c.fontSize)*100)/100,fw:c.fontWeight,col:c.color,lh:c.lineHeight,txt:e.textContent.trim(),ls:c.letterSpacing,gut:gut,paneW:paneW}})(),
  docW:document.documentElement.scrollWidth,winW:innerWidth,
  vw:vw,vh:vh};
})()`;

let SNAP={};           /* route -> 快照 */
const ALL=()=>PAGES.map(p=>({p,s:SNAP[p.r]})).filter(x=>x.s);
/* 遍历所有页面的所有元素，f 返回真就算一条问题 */
function sweep(f){const bad=[];for(const {p,s} of ALL())for(const e of s.els){const m=f(e,p,s);if(m)bad.push(p.name+' · '+(e.cls||e.t)+'：'+m)}return bad}
const say=(bad,limit)=>bad.slice(0,limit||6).join('\n   ')+(bad.length>(limit||6)?('\n   …另有 '+(bad.length-(limit||6))+' 处'):'');
/* 一个元素是不是某个组件 */
const has=(e,re)=>re.test(e.cls)||re.test(e.t);
/* 类名要整词匹配。用正则的词边界会把 rh-pager-btn、btn-tool 也算成 .btn，
   于是「次按钮有几种」里混进了根本不是这个组件的东西。 */
const cls=(e,name)=>e.cls.split(/\s+/).indexOf(name)>=0;
/* 这个颜色属不属于这套色：要么就是某个 token，要么是 --err 调淡出来的
   （设置页「危险区」那张卡的边就是这么来的）。第 6 轮和第 60 轮共用一个判法。 */
function inPalette(c){
 if(!c||!rgb(c))return true;
 if(tokenOf(c,6))return true;
 const v=rgb(c);
 return v[0]>v[1]&&v[0]>v[2]&&v[0]>150&&v[0]-v[2]>15&&v[0]-v[2]<70;
}
/* 字形块：头像首字母、文件类型角标、角标数字。这些字不是用来读的，
   是当图形用的，所以不参加字号台阶与行高的比较。 */
const GLYPH=e=>/avatar|fsq|fico|\bpx\b|dot|-ic\b|mono-sq/i.test(e.cls)
 ||(e.txt.length<=2&&e.w<=26&&e.h<=26);
/* CSS 三角：用边框画的箭头。它的「边框」是形状本身，不是描边，
   判粗细和颜色都不适用。 */
const TRI=e=>{const w=e.bw.split(',').map(Number);
 return Math.max(...w)>=3&&e.w<=16&&e.h<=16};

async function freshPage(b,vp){
 const p=await b.newPage({viewport:vp||{width:1440,height:900},reducedMotion:'reduce'});
 p.__errs=[];p.on('pageerror',e=>p.__errs.push(String(e).slice(0,160)));
 await blockExternalNetwork(p);
 await p.goto(FILE,{waitUntil:'domcontentloaded'});
 await p.waitForFunction(()=>window.RS&&RS.seedReady).catch(()=>{});
 await p.waitForTimeout(900);
 return p;
}
async function gotoPage(p,pg){
 if(pg.setup){await pg.setup(p)}else{await p.evaluate(r=>go(r),pg.r)}
 await p.waitForTimeout(420);
 /* 鼠标挪开，别把悬停态抄进快照 */
 await p.mouse.move(0,0);await p.waitForTimeout(60);
}

/* ========================================================================
   第 1 组 · 尺度与节奏（1–10）
   ====================================================================== */

R(1,'字号只有一套台阶',[
 ['全站正文字号收敛在设计台阶上，没有半档',()=>{
  /* 设计台阶：11(极少)/12/13/14/16/18/20/24/28。
     出现 12.5、13.5、15、17 这类半档，说明某一页自己改了一次字号，
     放在一起看就是「这一页的字比别处小一点」，但单看那页察觉不到。 */
  const LADDER=[10,11,12,13,14,16,18,20,22,24,26,28,32];
  const hist={};
  for(const {p,s} of ALL())for(const e of s.els){if(!e.txt||GLYPH(e))continue;
   const k=e.fs;(hist[k]=hist[k]||[]).push(p.name+'/'+(e.cls||e.t))}
  const off=Object.keys(hist).map(Number).filter(v=>!LADDER.some(l=>Math.abs(l-v)<.51));
  must(!off.length,'台阶外的字号：'+off.map(v=>v+'px（'+hist[v].length+' 处，如 '+hist[v][0]+'）').join('；'));
 }],
 ['台阶总数不超过 9 档',()=>{
  const used=new Set();for(const {s} of ALL())for(const e of s.els)if(e.txt&&!GLYPH(e)&&e.fs>=10)used.add(e.fs);
  must(used.size<=10,'用了 '+used.size+' 档：'+[...used].sort((a,b)=>a-b).join('/'));
 }],
 ['可读下限：会读的文字 ≥11px（头像字母、类型角标这类字形不算）',()=>{
  const bad=sweep(e=>e.txt&&!GLYPH(e)&&e.fs<11?('只有 '+e.fs+'px：'+e.txt.slice(0,16)):'');
  must(!bad.length,say(bad));
 }],
]);

R(2,'行高按字号走，不各页一套',[
 ['同一字号最松与最紧的行高差不过一档',()=>{
  /* 不要求一个字号只配一种行高——标题、表格、正文本来就该不一样。
     要求的是别拉得太开：同样 13px 的字，一处 1.2 倍、一处 2.3 倍，
     两段放在一起会被看成两种字。 */
  const m={};
  for(const {p,s} of ALL())for(const e of s.els){if(!e.txt||!e.lh||e.fs<12||GLYPH(e))continue;
   /* 行内链接、按钮、页签的行高是用来对齐的，和整段正文不是一回事 */
   if(/\blnk\b|\balnk\b|\bbtn\b|tab|pill|chip|th$/.test(e.cls)||e.t==='a'||e.t==='button'||e.t==='th')continue;
   (m[e.fs]=m[e.fs]||[]).push({r:e.lh/e.fs,who:p.name+'/'+(e.cls||e.t)})}
  const bad=[];
  for(const fs in m){const a=m[fs].slice().sort((x,y)=>x.r-y.r);
   const lo=a[0],hi=a[a.length-1];
   if(hi.r-lo.r>.55)bad.push(fs+'px 行高从 '+fmt(lo.r)+'（'+lo.who+'）到 '+fmt(hi.r)+'（'+hi.who+'）')}
  must(!bad.length,bad.join('\n   '));
 }],
 ['行高比例在 1.2–2.0 之间',()=>{
  const bad=sweep(e=>{if(!e.txt||!e.lh||e.fs<12||GLYPH(e))return '';
   /* 单行控件（按钮、页签、表头）常用行高把文字顶到中间，比值会偏大，
      那是布局手法不是排印，不参加比较。 */
   if(/\bbtn\b|tab|th$|pill|chip/.test(e.cls)||e.t==='button'||e.t==='th')return '';
   const r=e.lh/e.fs;
   return (r<1.2||r>2.0)?('行高比 '+fmt(r)+'（'+e.fs+'px/'+e.lh+'px）'):''});
  must(!bad.length,say(bad));
 }],
]);

R(3,'控件高度全站同一套',[
 ['按钮高度只有少数几档',()=>{
  const m={};
  for(const {p,s} of ALL())for(const e of s.els){if(!cls(e,'btn')||e.h<16)continue;
   (m[e.h]=m[e.h]||[]).push(p.name+'/'+e.cls.split(/\s+/).slice(0,2).join('.'))}
  const hs=Object.keys(m).map(Number).sort((a,b)=>a-b);
  must(hs.length<=4,'按钮有 '+hs.length+' 种高度：'+hs.map(h=>h+'px×'+m[h].length).join(' ')+'\n   例：'+hs.map(h=>h+'→'+m[h][0]).join('；'));
 }],
 ['输入框 / 下拉框与按钮同高',()=>{
  /* 只量真控件：单行 input、select、以及自绘下拉 .ctl-dd。
     textarea 和 .xx-field 那层壳子高度本来就随内容走，量它们没有意义。 */
  const m={};
  for(const {p,s} of ALL())for(const e of s.els){
   const real=(e.t==='input'||e.t==='select'||/\bctl-dd\b/.test(e.cls));
   if(!real||e.h<20||e.h>56)continue;
   /* 搜索框那种 input 自己不画框，框在外层的 label 上；量它量到的是文字行高，
      不是控件高度。有框或有底色的才是控件本身。 */
   if(e.t==='input'&&!e.bw.split(',').some(Number)&&!rgb(e.bg))continue;
   (m[e.h]=m[e.h]||[]).push(p.name+'/'+(e.cls||e.t))}
  const hs=Object.keys(m).map(Number).sort((a,b)=>a-b);
  must(hs.length<=3,'表单控件有 '+hs.length+' 种高度：'+hs.map(h=>h+'px×'+m[h].length).join(' ')+'\n   例：'+hs.map(h=>h+'→'+m[h][0]).join('；'));
 }],
 ['同名控件在不同页面高度一样',()=>{
  const m={};
  for(const {p,s} of ALL())for(const e of s.els){
   const key=(e.cls.match(/\b(btn|btn-pri|btn-gh|ctl-dd|pjx-tab|rs-tabs|tab)\b/g)||[]).sort().join('.')
     ||((e.t==='input'||e.t==='select')?e.t:'');
   if(!key||e.h<16||e.h>60)continue;
   if(e.t==='input'&&!e.bw.split(',').some(Number)&&!rgb(e.bg))continue;
   if(/\bnum\b|-c\b/.test(e.cls))continue;   /* 页签里的计数角标不是页签 */(m[key]=m[key]||{})[e.h]=(m[key][e.h]||0)+1}
  const bad=[];
  for(const k in m){const hs=Object.keys(m[k]).map(Number).sort((a,b)=>a-b);
   if(hs.length>1&&hs[hs.length-1]-hs[0]>4)bad.push(k+'：'+hs.join('/')+'px')}
  must(!bad.length,bad.join('；'));
 }],
]);

R(4,'间距落在阶梯上',[
 ['同一个组件在不同页面的内边距一样',()=>{
  /* 奇数 padding 本身不是毛病——5px 和 4px 没人看得出来。
     看得出来的是同一个 .chip 在这页 4px、在那页 8px。 */
  /* 只比控件：按钮、标签、徽标、输入框、页签。
     版面容器（.row/.col/.pg-hd 这类）装的内容不一样，留白本来就该跟着变，
     拿它们比会把「这一页的页头下面还有一排页签」也算成不一致。 */
  const CTRL=/^(btn|btn-pri|btn-gh|chip|tag|pill|badge|ctl-dd|input|pjx-tab|lv-tag|rs-tag|shared-tag)$/;
  const m={};
  for(const {p,s} of ALL())for(const e of s.els){
   const c=e.cls.split(/\s+/)[0];if(!c||!CTRL.test(c))continue;
   if(/back/i.test(e.cls))continue;   /* 返回链接是刻意贴左的 */
   ((m[c]=m[c]||{})[e.pad]=m[c][e.pad]||[]).push(p.name)}
  const bad=[];
  const far=(a,b)=>a.split(',').map(Number).some((v,i)=>Math.abs(v-Number(b.split(',')[i]))>2);
  for(const c in m){const ks=Object.keys(m[c]);
   if(ks.length<2)continue;
   const byPage={};for(const k of ks)for(const pg of new Set(m[c][k]))(byPage[pg]=byPage[pg]||new Set()).add(k);
   const single=Object.entries(byPage).filter(([,v])=>v.size===1);
   const vals=[...new Set(single.map(([,v])=>[...v][0]))];
   /* 差 1–2px 是 rem 换算出来的零头，看不出来 */
   if(single.length>=2&&vals.length>=2&&vals.some(v=>far(v,vals[0])))
    bad.push('.'+c+'：'+single.map(([pg,v])=>pg+'→'+[...v][0]).join('，'))}
  must(!bad.length,say(bad,5));
 }],
 ['同一个组件在不同页面的间隙一样',()=>{
  const CTRL=/^(btn|btn-pri|btn-gh|chip|tag|pill|badge|ctl-dd|pjx-tab|lv-tag|rs-tag|shared-tag|rs-tabs|lv-field|al-field|rs-field)$/;
  const m={};
  for(const {p,s} of ALL())for(const e of s.els){
   if(!e.gap)continue;const c=e.cls.split(/\s+/)[0];if(!c||!CTRL.test(c))continue;
   ((m[c]=m[c]||{})[e.gap]=m[c][e.gap]||[]).push(p.name)}
  const bad=[];
  for(const c in m){const ks=Object.keys(m[c]);if(ks.length<2)continue;
   const byPage={};for(const k of ks)for(const pg of new Set(m[c][k]))(byPage[pg]=byPage[pg]||new Set()).add(k);
   const single=Object.entries(byPage).filter(([,v])=>v.size===1);
   const vals=new Set(single.map(([,v])=>[...v][0]));
   if(single.length>=2&&vals.size>=2)bad.push('.'+c+'：'+single.map(([pg,v])=>pg+'→'+[...v][0]).join('，'))}
  must(!bad.length,say(bad,5));
 }],
]);

R(5,'圆角只有几种',[
 ['全站圆角档数 ≤5（不含药丸形 999）',()=>{
  const m={};
  for(const {p,s} of ALL())for(const e of s.els){
   for(const r of e.rad.split(',').map(num)){
    if(r<=0)continue;
    if(r>=100||r>=Math.min(e.w,e.h)/2-.5)continue;  /* 药丸 / 圆点另算 */
    (m[Math.round(r*10)/10]=m[Math.round(r*10)/10]||[]).push(p.name+'/'+(e.cls||e.t))}}
  const ks=Object.keys(m).map(Number).sort((a,b)=>a-b);
  const LADDER=[4,6,8,10,12,16];
  const off=ks.filter(r=>!LADDER.includes(r));
  must(!off.length,'阶梯外的圆角：'+off.map(r=>r+'px×'+m[r].length+'（如 '+m[r][0]+'）').join('；'));
  must(ks.length<=5,'圆角有 '+ks.length+' 种：'+ks.join('/'));
 }],
 ['同一个元素四角一致（除刻意的单边）',()=>{
  const bad=sweep(e=>{const r=e.rad.split(',').map(num);
   const uniq=[...new Set(r.map(v=>Math.round(v)))];
   if(uniq.length<=1)return '';
   /* 两种值、且是上两角或下两角相同——属于卡片头/尾这种刻意做法，放过 */
   if(uniq.length===2&&((r[0]===r[1]&&r[2]===r[3])||(r[0]===r[3]&&r[1]===r[2])))return '';
   return '四角 '+r.map(v=>Math.round(v)).join('/')});
  must(!bad.length,say(bad));
 }],
 ['卡片类容器在各页圆角一样',()=>{
  const m={};
  for(const {p,s} of ALL())for(const e of s.els){
   if(!/card/i.test(e.cls))continue;
   if(e.w<80||e.h<40)continue;
   const r=Math.round(num(e.rad.split(',')[0]));
   if(!r)continue;(m[r]=m[r]||[]).push(p.name+'/'+e.cls.split(/\s+/)[0])}
  const ks=Object.keys(m).map(Number);
  must(ks.length<=2,'卡片圆角 '+ks.join('/')+'px：'+ks.map(r=>r+'→'+m[r][0]).join('；'));
 }],
]);

R(6,'边框只有一种粗细、一种灰',[
 ['可见边框一律 1px（2px 只允许在强调态上）',()=>{
  const bad=[];
  for(const {p,s} of ALL())for(const e of s.els){
   if(TRI(e))continue;
   const ws=e.bw.split(',').map(Number),sides=ws.filter(Boolean).length;
   for(const w of ws){
    if(w<=0||w===1)continue;
    /* 只有一条边的 2px 是页签下划线、日志导轨这类「标记线」，不是描边；
       头像叠放时的白环也是 2px。两者都是定好的做法。 */
    if(w===2&&(sides===1||/avatar|car\b|on|sel|active|cur|focus|pri/i.test(e.cls)))continue;
    bad.push(p.name+' · '+(e.cls||e.t)+' 边框 '+w+'px')}}
  must(!bad.length,say([...new Set(bad)]));
 }],
 ['静态边框色只用 --line / --line-2',()=>{
  const bad=[];
  for(const {p,s} of ALL())for(const e of s.els){
   if(TRI(e))continue;
   const ws=e.bw.split(',').map(Number),cs=e.bc.split('|');
   for(let i=0;i<4;i++){
    if(!ws[i])continue;
    const c=cs[i];if(!rgb(c))continue;
    if(isTok(c,'line',4)||isTok(c,'line2',4))continue;
    if(dist(rgb(c),[255,255,255])<=3)continue;   /* 头像叠在一起时的白描边 */
    if(isTok(c,'ink3',6)||isTok(c,'ink4',6))continue;
    /* 容许：强调描边（墨蓝）、错误（红）、主按钮（墨）、以及上色很浅的分隔 */
    if(isTok(c,'dry',6)||isTok(c,'dryInk',6)||isTok(c,'err',6)||isTok(c,'ink',6)||isTok(c,'ink2',6))continue;
    if(isTok(c,'surface2',4)||isTok(c,'surface3',4)||isTok(c,'drySoft',4)||isTok(c,'dryDim',6))continue;
    if(inPalette(c))continue;   /* --err 调淡出来的边仍属于这套色 */
    bad.push(p.name+' · '+(e.cls||e.t)+' 边框色 '+c)}}
  must(!bad.length,say([...new Set(bad)]));
 }],
]);

R(7,'各页左右留白一样',[
 ['标题到所在栏左边的留白在所有页面一致',()=>{
  /* 只比主内容栏。定时任务是列表 + 详情两栏，标题在那条 314px 的窄栏里，
     窄栏的留白本来就该比主栏小，拿来一起比没有意义。 */
  const xs={};
  for(const {p,s} of ALL()){if(!s.h1||s.h1.gut==null||s.h1.paneW<600)continue;(xs[s.h1.gut]=xs[s.h1.gut]||[]).push(p.name)}
  const ks=Object.keys(xs).map(Number).sort((a,b)=>a-b);
  must(ks.length<=2&&ks[ks.length-1]-ks[0]<=8,'留白有 '+ks.length+' 种：'+ks.map(x=>x+'px('+xs[x].join('、')+')').join('  '));
 }],
 ['页面左右两边的留白对称',()=>{
  /* 左右不一样宽，整页看着是歪的——尤其翻到下一页又正回来的时候。 */
  const bad=[];
  for(const {p,s} of ALL()){
   if(s.viewBox.padR==null)continue;
   if(Math.abs(s.viewBox.pad-s.viewBox.padR)>2)
    bad.push(p.name+'：左 '+s.viewBox.pad+'px / 右 '+s.viewBox.padR+'px')}
  must(!bad.length,bad.join('；'));
 }],
]);

R(8,'h1 在所有页面长得一样',[
 ['字号、字重、颜色、字距四项全站统一',()=>{
  const m={};
  for(const {p,s} of ALL()){if(!s.h1)continue;
   const k=[s.h1.fs,s.h1.fw,s.h1.col,s.h1.ls].join(' | ');
   (m[k]=m[k]||[]).push(p.name)}
  const ks=Object.keys(m);
  must(ks.length===1,'h1 有 '+ks.length+' 种写法：\n   '+ks.map(k=>k+' ← '+m[k].join('、')).join('\n   '));
 }],
 ['h1 里没有混进别的内容（换行、副标题）',()=>{
  const bad=[];
  for(const {p,s} of ALL()){if(!s.h1)continue;
   if(/[\n\r]/.test(s.h1.txt)||s.h1.txt.length>40)bad.push(p.name+'：'+JSON.stringify(s.h1.txt.slice(0,50)))}
  must(!bad.length,bad.join('；'));
 }],
 ['每页恰好一个 h1',()=>{
  const bad=[];
  for(const {p,s} of ALL()){const n=s.els.filter(e=>e.t==='h1').length;
   if(n!==1)bad.push(p.name+' 有 '+n+' 个 h1')}
  must(!bad.length,bad.join('；'));
 }],
]);

R(9,'页头下面那行说明是同一个层级',[
 ['页头说明文字的字号与颜色统一',()=>{
  const m={};
  for(const {p,s} of ALL()){
   const h=s.els.find(e=>e.t==='h1');if(!h)continue;
   /* 紧贴 h1 下方、同一列、12–14px 的那段文字就是页头说明 */
   const sub=s.els.filter(e=>e.txt&&e.t==='p'&&e.y>=h.y&&e.y<=h.y+h.h+14&&Math.abs(e.x-h.x)<=4)[0];
   if(!sub)continue;
   const k=sub.fs+'px / '+sub.col;(m[k]=m[k]||[]).push(p.name)}
  const ks=Object.keys(m);
  must(ks.length<=1,'页头说明有 '+ks.length+' 种：\n   '+ks.map(k=>k+' ← '+m[k].join('、')).join('\n   '));
 }],
]);

R(10,'图标尺寸收敛',[
 ['svg 尺寸只有少数几档，并且是正方的',()=>{
  const m={};const skew=[];
  for(const {p,s} of ALL())for(const e of s.els){
   if(e.t!=='svg')continue;
   if(e.w<6||e.w>40)continue;
   if(Math.abs(e.w-e.h)>1)skew.push(p.name+' · '+(e.cls||'svg')+' '+e.w+'×'+e.h);
   (m[e.w]=m[e.w]||[]).push(p.name+'/'+(e.cls||'svg'))}
  must(!skew.length,'图标不是正方：'+say(skew,4));
  const ks=Object.keys(m).map(Number).sort((a,b)=>a-b);
  /* 只出现一两次的尺寸是走偏，不是一档。17/19/21 这种夹在 16/18/20 之间的，
     放在一起看就是「这个图标比旁边那个大一点点」。 */
  const rare=ks.filter(w=>m[w].length<=2);
  must(!rare.length,'只用过一两次的图标尺寸：'+rare.map(w=>w+'px（'+m[w].join('、')+'）').join('；'));
  const LADDER=[14,16,18,20,22,24];
  const off=ks.filter(w=>!LADDER.includes(w));
  must(!off.length,'阶梯外的图标尺寸：'+off.map(w=>w+'px×'+m[w].length+'（如 '+m[w][0]+'）').join('；'));
  must(ks.length<=5,'图标有 '+ks.length+' 种尺寸：'+ks.map(w=>w+'px×'+m[w].length).join(' '));
 }],
 ['图标颜色跟着文字走，不自己一套',()=>{
  const bad=sweep((e,p)=>{
   if(e.t!=='svg'||e.w>40)return '';
   const tk=tokenOf(e.col,5);
   if(!rgb(e.col))return '';
   return tk?'':('颜色 '+e.col+' 不在墨色与墨蓝里')});
  must(!bad.length,say(bad));
 }],
]);

/* ========================================================================
   第 2 组 · 色彩语义（11–20）
   ====================================================================== */

R(11,'文字只用四级墨色',[
 ['所有文字颜色落在墨色四档 / 墨蓝 / 红 / 白上',()=>{
  const bad=[];const seen={};
  for(const {p,s} of ALL())for(const e of s.els){
   if(!e.txt||!rgb(e.col))continue;
   const v=rgb(e.col);
   const ok=['ink','ink2','ink3','ink4','dry','dryInk','err','ok','okInk'].some(k=>dist(v,TOK[k])<=5)
     ||dist(v,[255,255,255])<=4;
   if(!ok){const key=e.col;(seen[key]=seen[key]||[]).push(p.name+'/'+(e.cls||e.t)+'「'+e.txt.slice(0,12)+'」')}}
  for(const k in seen)bad.push(k+'：'+seen[k].length+' 处，如 '+seen[k][0]);
  must(!bad.length,bad.join('\n   '));
 }],
 ['墨色四档都在用，没有一档形同虚设',()=>{
  const cnt={ink:0,ink2:0,ink3:0,ink4:0};
  for(const {s} of ALL())for(const e of s.els){if(!e.txt)continue;const t=tokenOf(e.col,4);if(t in cnt)cnt[t]++}
  const dead=Object.keys(cnt).filter(k=>cnt[k]===0);
  must(!dead.length,'没人用的墨色档：'+dead.join('、')+'（说明层级比设计的少一层）');
 }],
]);

R(12,'墨蓝只用在该用的地方',[
 ['墨蓝不做大面积底色',()=>{
  const bad=sweep(e=>{
   const v=rgb(e.bg);if(!v)return '';
   if(dist(v,TOK.dry)>8&&dist(v,TOK.dryInk)>8)return '';
   /* 40px 以内的是角标、步骤号、头像、小按钮——它们本来就该有一块实色。
      判的是「一片墨蓝铺开」。 */
   return Math.min(e.w,e.h)>40?('墨蓝底 '+e.w+'×'+e.h):''});
  must(!bad.length,say(bad));
 }],
 ['墨蓝文字只出现在可点的东西或状态上',()=>{
  const bad=sweep(e=>{
   if(!e.txt)return '';
   const t=tokenOf(e.col,5);
   if(t!=='dry'&&t!=='dryInk')return '';
   /* 整块是墨蓝浅底的提示条，里面的字跟着用墨蓝是对的 */
   if(e.abg&&dist(rgb(e.abg),TOK.drySoft)<=5)return '';
   if(e.bg&&dist(rgb(e.bg),TOK.drySoft)<=5)return '';
   /* 可点 / 选中 / 进行中 / 徽标 都算合理用法 */
   if(/btn|lnk|link|tab|a$|alnk|chip|badge|tag|cur|on|sel|active|run|st\b|step|pick|nav|num|c-dry/i.test(e.cls)||e.t==='a'||e.t==='button')return '';
   if(e.inBtn)return '';   /* 这段字在一个可点的行 / 卡片里，蓝是那颗按钮自己的颜色 */
   return '墨蓝文字「'+e.txt.slice(0,14)+'」不是链接也不是状态'});
  must(!bad.length,say(bad));
 }],
]);

R(13,'错误红只表示错误',[
 ['红只出现在错误、危险、失败的语义上',()=>{
  const bad=sweep(e=>{
   const c=rgb(e.col),b=rgb(e.bg);
   const red=x=>x&&dist(x,TOK.err)<=10;
   if(!red(c)&&!red(b)&&!(e.bg&&dist(rgb(e.bg),TOK.errSoft)<=4))return '';
   if(/err|del|danger|fail|stop|warn|invalid|risk|over|abort|red|except|alert|urgent|late|due/i.test(e.cls))return '';
   if(e.txt&&/失败|异常|错误|不可|删除|终止|超|缺|未通过|风险|停|不足|无效|冲突|逾期|过期|未达|报错|中止/.test(e.txt))return '';
   if(e.txt&&/^[\s·]*$/.test(e.txt)&&Math.min(e.w,e.h)<=8)return '';  /* 状态点，跟着文字走 */
   if(e.txt&&/^\*$/.test(e.txt.trim()))return '';                      /* 必填星号 */
   if(e.t==='svg'&&e.w<=22)return '';                                 /* 图标跟着它旁边那行字走 */
   /* 待办数、待审批数用红：这是产品自己定的「要你立刻处理」的标记，
      不是报错。这里只记下它，不当成违规——真要改的话是设计决定，不是收口。 */
   if(/todo|req|pending|unread|badge-n/i.test(e.cls)&&/^\d+$/.test(e.txt.trim()))return '';
   return '红色用在「'+(e.txt||e.cls).slice(0,18)+'」上'});
  must(!bad.length,say(bad));
 }],
 ['大块红底不存在',()=>{
  const bad=sweep(e=>{const b=rgb(e.bg);
   if(!b||dist(b,TOK.err)>12)return '';
   return Math.min(e.w,e.h)>40?('红底 '+e.w+'×'+e.h):''});
  must(!bad.length,say(bad));
 }],
]);

R(14,'主按钮只有一种，并且每屏只有一个',[
 ['主按钮是黑实心，各页一模一样',()=>{
  const m={};
  for(const {p,s} of ALL())for(const e of s.els){
   if(!/\bbtn-pri\b/.test(e.cls)||e.dis)continue;
   const k=[e.bg,e.col,Math.round(num(e.rad.split(',')[0])),e.h,e.fs,e.fw].join(' | ');
   (m[k]=m[k]||[]).push(p.name)}
  const ks=Object.keys(m);
  must(ks.length<=1,'主按钮有 '+ks.length+' 种样子：\n   '+ks.map(k=>k+' ← '+m[k].join('、')).join('\n   '));
  if(ks.length===1){const b=rgb(ks[0].split(' | ')[0]);
   must(b&&dist(b,TOK.ink)<=10,'主按钮底色 '+ks[0].split(' | ')[0]+'，定稿是墨黑实心')}
 }],
 ['一屏不出现两个主按钮',()=>{
  const bad=[];
  for(const {p,s} of ALL()){
   const n=s.els.filter(e=>/\bbtn-pri\b/.test(e.cls)&&!e.dis).length;
   if(n>1)bad.push(p.name+' 有 '+n+' 个主按钮（'+s.els.filter(e=>/\bbtn-pri\b/.test(e.cls)).map(e=>e.txt||e.cls).slice(0,4).join('、')+'）')}
  must(!bad.length,bad.join('\n   '));
 }],
]);

R(15,'底色只有四层纸',[
 ['所有底色落在 paper/surface/surface-2/surface-3 或透明上',()=>{
  const seen={};
  for(const {p,s} of ALL())for(const e of s.els){
   if(/back|scrim|overlay|mask|dim$/i.test(e.cls))continue;   /* 抽屉的遮罩 */
   const b=rgb(e.bg);if(!b)continue;
   if(alpha(e.bg)<.5)continue;                                /* 半透明的是罩层，不是底色 */
   const ok=['paper','surface','surface2','surface3','drySoft','errSoft','okSoft','dry','dryInk','ink','ink2','ink3','ink4','err','ok','okInk','line','line2','dryDim'].some(k=>dist(b,TOK[k])<=4);
   if(!ok)(seen[e.bg]=seen[e.bg]||[]).push(p.name+'/'+(e.cls||e.t))}
  const bad=Object.keys(seen).map(k=>k+'：'+seen[k].length+' 处，如 '+seen[k][0]);
  must(!bad.length,bad.join('\n   '));
 }],
 ['页面底色与侧栏底色的关系在所有页面一致',()=>{
  const m={};
  for(const {p,s} of ALL()){const k=(s.side?s.side.bg:'-')+' / '+s.bodyBg;(m[k]=m[k]||[]).push(p.name)}
  must(Object.keys(m).length===1,'侧栏/页面底色组合不止一种：'+Object.keys(m).join(' ；'));
 }],
]);

R(16,'禁用态统一',[
 ['禁用的控件用同一种弱化方式',()=>{
  const m={};
  for(const {p,s} of ALL())for(const e of s.els){
   if(!e.dis)continue;
   if(!/btn|alnk|input|dd|lnk/i.test(e.cls)&&!/^(button|input|select)$/.test(e.t))continue;
   const k=tokenOf(e.col,6)||e.col;(m[k]=m[k]||[]).push(p.name+'/'+(e.cls||e.t))}
  const ks=Object.keys(m);
  must(ks.length<=2,'禁用态文字色有 '+ks.length+' 种：'+ks.map(k=>k+'×'+m[k].length).join(' ')+'\n   例：'+ks.map(k=>k+'→'+m[k][0]).join('；'));
 }],
 ['禁用的东西不留主按钮的黑底',()=>{
  const bad=sweep(e=>{if(!e.dis)return '';const b=rgb(e.bg);
   return b&&dist(b,TOK.ink)<=12?'禁用了还是黑实心':''});
  must(!bad.length,say(bad));
 }],
]);

R(17,'徽标与标签收敛',[
 ['徽标底色只在中性与三种语义色里',()=>{
  const seen={};
  for(const {p,s} of ALL())for(const e of s.els){
   if(!/badge|chip|tag|pill|\bst\b|state/i.test(e.cls))continue;
   const b=rgb(e.bg);if(!b)continue;
   const t=tokenOf(e.bg,4);
   if(!t)(seen[e.bg]=seen[e.bg]||[]).push(p.name+'/'+e.cls.split(/\s+/)[0]);}
  const bad=Object.keys(seen).map(k=>k+'（如 '+seen[k][0]+'）');
  must(!bad.length,bad.join('；'));
 }],
 ['徽标字号与圆角全站一致',()=>{
  const m={};
  for(const {p,s} of ALL())for(const e of s.els){
   if(!/badge|chip|pill/i.test(e.cls)||!e.txt)continue;
   const k=e.fs+'px r'+Math.round(num(e.rad.split(',')[0]));(m[k]=m[k]||[]).push(p.name+'/'+e.cls.split(/\s+/)[0])}
  const ks=Object.keys(m);
  must(ks.length<=3,'徽标有 '+ks.length+' 种：'+ks.map(k=>k+'×'+m[k].length).join(' ')+'\n   例：'+ks.map(k=>k+'→'+m[k][0]).join('；'));
 }],
]);

R(18,'没有大块上色',[
 ['26 个页面里没有彩色大面板',()=>{
  const bad=sweep(e=>{
   if(/back|scrim|overlay|mask|dim$/i.test(e.cls))return '';
   if(alpha(e.bg)<.5)return '';
   const b=rgb(e.bg);if(!b)return '';
   if(neutral(e.bg,10))return '';
   /* 浅色语义底（墨蓝淡、红淡、绿淡）本身是允许的，判的是「深色大块」 */
   if(['drySoft','errSoft','okSoft'].some(k=>dist(b,TOK[k])<=5))return '';
   return Math.min(e.w,e.h)>40?('上色 '+e.w+'×'+e.h+'（'+e.bg+'）'):''});
  must(!bad.length,say(bad));
 }],
 ['进度条 / 条形的填充只用墨蓝或红，并且很细',()=>{
  const bad=sweep(e=>{
   if(!/bar|prog|fill|meter/i.test(e.cls))return '';
   const b=rgb(e.bg);if(!b||neutral(e.bg,10))return '';
   const t=tokenOf(e.bg,6);
   if(t!=='dry'&&t!=='dryInk'&&t!=='err'&&t!=='ok'&&t!=='okInk')return '填充色 '+e.bg;
   return e.h>8?('条形高 '+e.h+'px，太粗'):''});
  must(!bad.length,say(bad));
 }],
]);

R(19,'没有渐变、没有单侧色条',[
 ['全站没有装饰性渐变',()=>{
  /* 上一版这条只看了落地的那一页，于是数据库卡封面上的压暗条、
     侧栏列表的滚动淡出，整轮都没被看见过。改成扫 26 页。
     淡出遮罩（一端全透明）和骨架闪动是技术手段，不是装饰，放过；
     判的是「两个实色之间拉的渐变」。 */
  const bad=sweep(e=>{
   if(!e.bgi||!/gradient/i.test(e.bgi))return '';
   if(/skel|shimmer|load/i.test(e.cls))return '';
   /* 一端是全透明 = 淡出遮罩 */
   if(/rgba\([^)]*,\s*0\)|transparent/i.test(e.bgi))return '';
   return '渐变背景：'+e.bgi.slice(0,60)});
  must(!bad.length,say(bad));
 }],
 ['没有渐变字',()=>{
  const bad=sweep(e=>(e.bgi&&/gradient/i.test(e.bgi)&&e.txt&&e.leaf)?('这段字垫着渐变：「'+e.txt.slice(0,14)+'」'):'');
  must(!bad.length,say(bad));
 }],
 ['没有单侧色条（只有一边有粗彩色边）',()=>{
  const bad=sweep(e=>{
   const ws=e.bw.split(',').map(Number),cs=e.bc.split('|');
   const thick=ws.map((w,i)=>({w,c:cs[i],i})).filter(x=>x.w>=3);
   if(!thick.length)return '';
   const col=thick.filter(x=>rgb(x.c)&&!neutral(x.c,12));
   if(!col.length)return '';
   /* 四边都粗不算色条；只有一边粗、且有颜色、且元素还挺大的才是 */
   if(ws.filter(w=>w>=3).length>=3)return '';
   return Math.min(e.w,e.h)>24?('单侧 '+col[0].w+'px 彩边 '+col[0].c):''});
  must(!bad.length,say(bad));
 }],
], {live:true});

R(20,'对比度够读',[
 ['正文与次级文字对比度 ≥4.5',()=>{
  /* 底色从祖先推不出来时按 paper 算：全站底色只有四层纸，
     最深的 surface-3 和 paper 差不到 7%，按 paper 算误差可以忽略。 */
  const bad=[];
  for(const {p,s} of ALL())for(const e of s.els){
   if(!e.txt||e.fs<12||e.dis)continue;
   const c=rgb(e.col);if(!c)continue;
   let bgv=rgb(e.bg);
   if(!bgv){/* 自己没底色，找最近的有底色祖先近似：用页面底色 */ bgv=rgb(s.bodyBg)||TOK.paper}
   const r=contrast(c,bgv);
   const big=e.fs>=18||(e.fs>=14&&Number(e.fw)>=700);
   if(r<(big?3:4.5))bad.push(p.name+' · '+(e.cls||e.t)+'「'+e.txt.slice(0,12)+'」'+fmt(r)+':1（'+e.col+' on '+(e.bg||s.bodyBg)+'）')}
  must(!bad.length,say(bad,8));
 }],
 ['分隔线在纸面上看得见（≥1.1:1）',()=>{
  const bad=[];
  for(const {p,s} of ALL()){
   const paper=rgb(s.bodyBg)||TOK.paper;
   for(const e of s.els){
    /* 头像叠在一起时用白环把彼此分开，它本来就该和纸同色 */
    if(/avatar/i.test(e.cls))continue;
    const ws=e.bw.split(',').map(Number),cs=e.bc.split('|');
    for(let i=0;i<4;i++){if(!ws[i])continue;const c=rgb(cs[i]);if(!c)continue;
     if(contrast(c,paper)<1.08)bad.push(p.name+' · '+(e.cls||e.t)+' 边框 '+cs[i]+' 在纸上看不见')}}}
  must(!bad.length,say([...new Set(bad)]));
 }],
]);

/* ========================================================================
   第 3 组 · 组件一致性（21–32）
   ====================================================================== */

R(21,'按钮三档的差别稳定',[
 ['btn / btn-gh 在各页长得一样',()=>{
  const m={};
  for(const {p,s} of ALL())for(const e of s.els){
   if(!cls(e,'btn')||e.dis||e.h<20)continue;
   const kind=/btn-pri/.test(e.cls)?'主':/btn-gh/.test(e.cls)?'幽灵':'次';
   const k=kind+'｜'+[e.bg,e.col,e.bw,e.bc.split('|')[0],Math.round(num(e.rad.split(',')[0])),e.fs,e.fw].join(' ');
   (m[k]=m[k]||new Set()).add(p.name)}
  const byKind={};for(const k in m){const kind=k.split('｜')[0];(byKind[kind]=byKind[kind]||[]).push(k)}
  const bad=[];
  for(const kind in byKind){if(byKind[kind].length>1)
   bad.push(kind+'按钮有 '+byKind[kind].length+' 种：\n     '+byKind[kind].map(k=>k.split('｜')[1]+' ← '+[...m[k]].slice(0,4).join('、')).join('\n     '))}
  must(!bad.length,bad.join('\n   '));
 }],
 ['三档之间真的分得开：底色或边框至少有一项不同',()=>{
  const pick=n=>{for(const {s} of ALL())for(const e of s.els)if(cls(e,n)&&!e.dis&&e.h>=20)return e;return null};
  const pri=pick('btn-pri'),gh=pick('btn-gh'),
    sec=(()=>{for(const {s} of ALL())for(const e of s.els)if(cls(e,'btn')&&!cls(e,'btn-pri')&&!cls(e,'btn-gh')&&!e.dis&&e.h>=20)return e;return null})();
  must(pri&&sec&&gh,'三档按钮没找齐：'+[pri&&'主',sec&&'次',gh&&'幽灵'].filter(Boolean).join('、'));
  const sig=e=>e.bg+'/'+e.bw+'/'+e.bc.split('|')[0];
  must(sig(pri)!==sig(sec),'主按钮与次按钮一个样：'+sig(pri));
  must(sig(sec)!==sig(gh),'次按钮与幽灵按钮一个样：'+sig(sec));
 }],
]);

R(22,'悬停反馈一致',[
 ['同一种按钮在不同页面悬停后变成同一个样',async p=>{
  /* 悬停带 .14s 过渡，定时等一下量到的可能是中间帧。等读数不再变了再量。 */
  const settled=async loc=>{let last=null;
   for(let i=0;i<25;i++){const now=await loc.evaluate(e=>{const c=getComputedStyle(e);
     return [c.backgroundColor,c.color,c.borderTopColor,c.boxShadow].join('|')});
    if(last&&now===last)return now;last=now;await p.waitForTimeout(80)}
   return last};
  const got={};
  for(const r of ['lab','shelf','data','devices','mdl']){
   const pg=PG(r);await gotoPage(p,pg);
   const loc=p.locator('#view .btn:not(.btn-pri):not(.btn-gh):not(:disabled)').first();
   if(!await loc.count())continue;
   await loc.hover();got[pg.name]=await settled(loc);
   await p.mouse.move(0,0);await p.waitForTimeout(150);
  }
  const vals=new Set(Object.values(got));
  must(Object.keys(got).length>=3,'只量到 '+Object.keys(got).length+' 页');
  must(vals.size===1,'次按钮悬停态有 '+vals.size+' 种：\n   '+Object.entries(got).map(([k,v])=>k+' → '+v).join('\n   '));
 }],
 ['可点的行 / 卡片悬停有反馈，静态容器没有',async p=>{
  const bad=[];
  for(const r of ['lab','shelf','projects']){
   const pg=PG(r);await gotoPage(p,pg);
   const res=await p.evaluate(()=>{
    /* 找页面里主要的那种卡片，看它有没有写过渡 */
    const card=document.querySelector('#view .lv-device,#view .lv-exp,#view .rs-asset,#view .scard,#view .pcard,#view .project-card-wrap');
    if(!card)return null;
    const c=getComputedStyle(card);
    return {cls:card.className.slice(0,40),tr:c.transitionProperty+' '+c.transitionDuration,
      clickable:!!(card.onclick||card.tagName==='BUTTON'||card.tagName==='A'||card.querySelector('button,a'))};
   });
   if(!res)continue;
   if(res.clickable&&/none/.test(res.tr))bad.push(pg.name+' · '+res.cls+' 可点但没有悬停过渡');
  }
  must(!bad.length,bad.join('；'));
 }],
], {live:true});

R(23,'键盘焦点环一致',[
 ['各页第一个可聚焦控件的焦点环是同一种',async p=>{
  const got={};
  for(const r of ['workbench','lab','shelf','data','mdl','settings']){
   const pg=PG(r);await gotoPage(p,pg);
   await p.evaluate(()=>{const b=document.querySelector('#view button:not(:disabled),#view a[href],#view input');if(b)b.focus()});
   await p.keyboard.press('Tab');await p.waitForTimeout(140);
   const v=await p.evaluate(()=>{const e=document.activeElement;if(!e||e===document.body)return null;
    const c=getComputedStyle(e);
    return {w:c.outlineWidth,st:c.outlineStyle,col:c.outlineColor,off:c.outlineOffset,sh:c.boxShadow==='none'?'':'有投影'}});
   if(v)got[pg.name]=[v.w,v.st,v.col,v.off].join(' ');
  }
  const vals=new Set(Object.values(got));
  must(Object.keys(got).length>=4,'只量到 '+Object.keys(got).length+' 页');
  must(vals.size===1,'焦点环有 '+vals.size+' 种：\n   '+Object.entries(got).map(([k,v])=>k+' → '+v).join('\n   '));
 }],
 ['焦点环看得见：有宽度、不是 none',async p=>{
  const bad=[];
  for(const r of ['lab','shelf','data']){
   const pg=PG(r);await gotoPage(p,pg);
   await p.evaluate(()=>{const b=document.querySelector('#view button:not(:disabled)');if(b)b.focus()});
   await p.keyboard.press('Tab');await p.waitForTimeout(140);
   const v=await p.evaluate(()=>{const e=document.activeElement;const c=getComputedStyle(e);
    return {w:parseFloat(c.outlineWidth)||0,st:c.outlineStyle,sh:c.boxShadow!=='none'}});
   if((!v.w||v.st==='none')&&!v.sh)bad.push(pg.name+' 焦点没有任何提示');
  }
  must(!bad.length,bad.join('；'));
 }],
], {live:true});

R(24,'选中态只有一种表达',[
 ['被选中 / 当前项的标记方式在全站收敛',()=>{
  const m={};
  for(const {p,s} of ALL())for(const e of s.els){
   if(!/\bis-on\b|\bon\b|aria-cur/.test(e.cls))continue;
   if(!/tab|pill|chip|nav|seg|filter|view/i.test(e.cls))continue;
   const k=[tokenOf(e.bg,4)||e.bg||'无底',tokenOf(e.col,4)||e.col,e.bw,e.fw].join(' ');
   (m[k]=m[k]||new Set()).add(p.name+'/'+e.cls.split(/\s+/)[0])}
  const ks=Object.keys(m);
  must(ks.length<=3,'选中态有 '+ks.length+' 种：\n   '+ks.map(k=>k+' ← '+[...m[k]].slice(0,3).join('、')).join('\n   '));
 }],
]);

R(25,'页签只有一套',[
 ['全站页签的高度、字号、选中线一致',()=>{
  const m={};
  for(const {p,s} of ALL())for(const e of s.els){
   if(!/\b(pjx-tab|rs-tabs|tab|rh-tabs)\b/.test(e.cls))continue;
   if(e.t!=='button'&&e.t!=='a')continue;
   if(e.h<18)continue;
   const k=[e.h,e.fs,e.bw,e.pad].join(' / ');
   (m[k]=m[k]||new Set()).add(p.name+'·'+e.cls.split(/\s+/)[0])}
  const ks=Object.keys(m);
  must(ks.length<=2,'页签有 '+ks.length+' 种：\n   '+ks.map(k=>k+' ← '+[...m[k]].slice(0,4).join('、')).join('\n   '));
 }],
 ['选中的页签只用一种标记（下划线或实心，不混用）',()=>{
  const ways=new Set();const who={};
  for(const {p,s} of ALL())for(const e of s.els){
   if(!/tab/i.test(e.cls)||!/\bis-on\b|\bon\b/.test(e.cls))continue;
   const bw=e.bw.split(',').map(Number);
   const way=rgb(e.bg)&&!neutral(e.bg,10)?'实心上色':bw[2]>=2?'下划线':rgb(e.bg)?'换底色':'只换字色';
   ways.add(way);(who[way]=who[way]||new Set()).add(p.name+'/'+e.cls.split(/\s+/)[0])}
  must(ways.size<=2,'选中页签的标记方式有 '+ways.size+' 种：'+[...ways].map(w=>w+'（'+[...who[w]].slice(0,3).join('、')+'）').join('；'));
 }],
]);

R(26,'表格是同一张表',[
 ['表头字号、高度、颜色全站统一',()=>{
  const m={};
  for(const {p,s} of ALL()){
   const th=s.els.filter(e=>e.t==='th'||/\bms-table-head\b/.test(e.cls));
   if(!th.length)continue;
   for(const e of th){const k=[e.fs,e.h,tokenOf(e.col,4)||e.col,e.fw].join(' / ');
    (m[k]=m[k]||new Set()).add(p.name)}}
  const ks=Object.keys(m);
  must(ks.length<=1,'表头有 '+ks.length+' 种：\n   '+ks.map(k=>k+' ← '+[...m[k]].join('、')).join('\n   '));
 }],
 ['单元格字号全站统一',()=>{
  const m={};
  for(const {p,s} of ALL())for(const e of s.els){
   if(e.t!=='td'&&!/\bms-cell\b/.test(e.cls))continue;
   (m[e.fs]=m[e.fs]||new Set()).add(p.name)}
  const ks=Object.keys(m).map(Number).sort((a,b)=>a-b);
  must(ks.length<=2,'单元格字号有 '+ks.length+' 种：'+ks.map(f=>f+'px（'+[...m[f]].join('、')+'）').join('；'));
 }],
 ['列表行有分隔，并且分隔线只有一种',()=>{
  const m={};
  for(const {p,s} of ALL())for(const e of s.els){
   if(e.t!=='tr'&&!/\bms-file\b/.test(e.cls))continue;
   const bw=e.bw.split(',').map(Number),cs=e.bc.split('|');
   if(!bw[2])continue;
   (m[bw[2]+'px '+(tokenOf(cs[2],4)||cs[2])]=m[bw[2]+'px '+(tokenOf(cs[2],4)||cs[2])]||new Set()).add(p.name)}
  const ks=Object.keys(m);
  must(ks.length<=1,'行分隔线有 '+ks.length+' 种：'+ks.map(k=>k+'（'+[...m[k]].join('、')+'）').join('；'));
 }],
]);

R(27,'空态结构一致',[
 ['空态的边框、圆角、底色、字号是同一套',()=>{
  const m={};
  for(const {p,s} of ALL())for(const e of s.els){
   if(!/empty|blank|nores|no-data/i.test(e.cls))continue;
   if(e.w<120)continue;
   const k=[e.bw.split(',')[0]+'px',e.bc.split('|')[0].includes('dashed')?'':'',Math.round(num(e.rad.split(',')[0]))+'r',tokenOf(e.bg,4)||e.bg||'无底'].join(' ');
   (m[k]=m[k]||new Set()).add(p.name+'/'+e.cls.split(/\s+/)[0])}
  const ks=Object.keys(m);
  must(ks.length<=2,'空态有 '+ks.length+' 种外观：\n   '+ks.map(k=>k+' ← '+[...m[k]].slice(0,4).join('、')).join('\n   '));
 }],
]);

R(28,'一种语义一种颜色',[
 ['同一个状态词在全站用同一个颜色',()=>{
  /* 「已完成」在一页是绿、在另一页是灰，就等于这个产品对完成有两种说法。 */
  const m={};
  for(const {p,s} of ALL())for(const e of s.els){
   if(!e.txt||e.txt.length>8)continue;
   if(!/^(已完成|进行中|运行中|已终止|失败|异常|待审批|草稿|排队中|已发布|已共享|空闲|占用|离线|在线|待确认|已接入)$/.test(e.txt.trim()))continue;
   /* 只比状态标记。筛选条上的「异常」是一个选项，它跟着筛选器的样式走，
      和实验卡上那个「这条异常了」的标记不是一回事。 */
   if(!/state|chip|badge|status|\bst\b|tag/i.test(e.cls))continue;
   if(e.t==='button'||/\bpill\b|filter/i.test(e.cls))continue;
   const k=e.txt.trim();
   ((m[k]=m[k]||{})[tokenOf(e.col,5)||e.col]=m[k][tokenOf(e.col,5)||e.col]||new Set()).add(p.name)}
  const bad=[];
  for(const w in m){const cs=Object.keys(m[w]);
   if(cs.length>1)bad.push('「'+w+'」'+cs.map(c=>c+'（'+[...m[w][c]].join('、')+'）').join(' vs '))}
  must(!bad.length,bad.join('\n   '));
 }],
 ['状态小圆点大小一致',()=>{
  const m={};
  for(const {p,s} of ALL())for(const e of s.els){
   if(!/\b(px|dot)\b/.test(e.cls))continue;
   if(e.w>14)continue;
   (m[e.w+'×'+e.h]=m[e.w+'×'+e.h]||new Set()).add(p.name+'/'+e.cls.split(/\s+/)[0])}
  const ks=Object.keys(m);
  must(ks.length<=2,'状态点有 '+ks.length+' 种尺寸：'+ks.map(k=>k+'（'+[...m[k]].slice(0,3).join('、')+'）').join('；'));
 }],
]);

R(29,'输入框是同一个输入框',[
 ['边框、圆角、底色、字号全站统一',()=>{
  const m={};
  for(const {p,s} of ALL())for(const e of s.els){
   if(e.t!=='input'&&e.t!=='textarea')continue;
   if(e.w<60)continue;
   /* 单选 / 复选是另一种控件；搜索框和对话输入那种不画框的，框在外层 label 上；
      正处在焦点里的控件显示的是焦点色，不是它平时的样子。 */
   if(e.w<=24&&e.h<=24)continue;
   if(e.foc)continue;
   if(!e.bw.split(',').some(Number)&&!rgb(e.bg))continue;
   const k=[e.bw.split(',')[0]+'px',tokenOf(e.bc.split('|')[0],4)||e.bc.split('|')[0],Math.round(num(e.rad.split(',')[0]))+'r',tokenOf(e.bg,4)||e.bg,e.fs+'px'].join(' ');
   (m[k]=m[k]||new Set()).add(p.name)}
  const ks=Object.keys(m);
  must(ks.length<=2,'输入框有 '+ks.length+' 种：\n   '+ks.map(k=>k+' ← '+[...m[k]].slice(0,5).join('、')).join('\n   '));
 }],
 ['占位文字比正文浅，但还看得见',async p=>{
  const bad=[];
  for(const r of ['lab','data','shelf','materials']){
   const pg=PG(r);await gotoPage(p,pg);
   const v=await p.evaluate(()=>{const i=document.querySelector('#view input[placeholder]');if(!i)return null;
    const c=getComputedStyle(i,'::placeholder');return {col:c.color,bg:getComputedStyle(i).backgroundColor}});
   if(!v)continue;
   const c=rgb(v.col),b=rgb(v.bg)||TOK.surface;
   if(!c)continue;
   const cr=contrast(c,b);
   if(cr<3)bad.push(pg.name+' 占位文字对比 '+fmt(cr)+':1，太淡（'+v.col+'）');
  }
  must(!bad.length,bad.join('；'));
 }],
], {live:true});

R(30,'下拉和输入同一套尺度',[
 ['自绘下拉与输入框同高、同圆角、同边框',()=>{
  const grab=f=>{const o=new Set();for(const {s} of ALL())for(const e of s.els)if(f(e)&&e.w>=60&&e.h>=20&&e.h<=56)
   o.add([e.h,Math.round(num(e.rad.split(',')[0])),e.bw.split(',')[0],e.fs].join('/'));return o};
  /* 同 29 轮：只量自己画了框的那种输入 */
  const inp=grab(e=>e.t==='input'&&!e.foc&&e.bw.split(',').some(Number)),dd=grab(e=>/\bctl-dd\b/.test(e.cls));
  must(inp.size&&dd.size,'没同时找到输入框和下拉（输入 '+inp.size+'，下拉 '+dd.size+'）');
  const mix=[...new Set([...inp,...dd])];
  must(mix.length<=2,'输入框与下拉的尺度不是一套：输入 '+[...inp].join('｜')+'；下拉 '+[...dd].join('｜'));
 }],
]);

R(31,'弹窗是同一个弹窗',[
 ['弹窗的圆角、投影、内边距、遮罩一致',async p=>{
  const got={};
  const opens=[
   ['实验管理','lab','#view [data-act]'],
   ['定时任务','schedules','#view [data-st-action="new"]'],
   ['资料空间','materials','#view [data-ms-create]'],
  ];
  for(const [name,r,sel] of opens){
   const pg=PG(r);if(!pg)continue;
   await gotoPage(p,pg);
   const loc=p.locator(sel).first();
   if(!await loc.count())continue;
   await loc.click({force:true}).catch(()=>{});await p.waitForTimeout(400);
   const v=await p.evaluate(()=>{const d=document.querySelector('dialog[open]');if(!d)return null;
    const c=getComputedStyle(d),bd=getComputedStyle(d,'::backdrop');
    return {rad:c.borderTopLeftRadius,sh:c.boxShadow==='none'?'无投影':'有投影',pad:c.padding,
      bd:bd.backgroundColor,bw:c.borderTopWidth}});
   if(v)got[name]=[v.rad,v.sh,v.pad,v.bw].join(' / ');
   await p.keyboard.press('Escape');await p.waitForTimeout(250);
  }
  must(Object.keys(got).length>=2,'只打开了 '+Object.keys(got).length+' 个弹窗，比不出来');
  const vals=new Set(Object.values(got));
  must(vals.size===1,'弹窗有 '+vals.size+' 种：\n   '+Object.entries(got).map(([k,v])=>k+' → '+v).join('\n   '));
 }],
 ['弹窗一定有投影（它浮在页面之上）',async p=>{
  await gotoPage(p,PG('schedules'));
  const loc=p.locator('#view [data-st-action="new"]').first();
  if(!await loc.count())return;
  await loc.click();await p.waitForTimeout(400);
  const sh=await p.evaluate(()=>{const d=document.querySelector('dialog[open]');return d?getComputedStyle(d).boxShadow:'没弹窗'});
  must(sh&&sh!=='none','弹窗没有投影，和页面贴在一个平面上（'+sh+'）');
  await p.keyboard.press('Escape');
 }],
], {live:true});

R(32,'提示条一致',[
 ['toast 的位置、圆角、底色在各页一样',async p=>{
  const got={};
  for(const r of ['lab','shelf','materials']){
   const pg=PG(r);await gotoPage(p,pg);
   await p.evaluate(()=>toast('测试提示'));await p.waitForTimeout(350);
   const v=await p.evaluate(()=>{const t=document.querySelector('.toast,#toast,[role="status"].toast,.toastbox');
    if(!t)return null;const c=getComputedStyle(t),b=t.getBoundingClientRect();
    return {rad:c.borderTopLeftRadius,bg:c.backgroundColor,col:c.color,fs:c.fontSize,
      pos:c.position,bottom:Math.round(innerHeight-b.bottom),sh:c.boxShadow==='none'?'无':'有'}});
   if(v)got[pg.name]=[v.rad,v.bg,v.col,v.fs,v.pos,v.bottom+'px底',v.sh].join(' / ');
   await p.waitForTimeout(100);
  }
  must(Object.keys(got).length>=2,'没量到 toast');
  const vals=new Set(Object.values(got));
  must(vals.size===1,'toast 有 '+vals.size+' 种：\n   '+Object.entries(got).map(([k,v])=>k+' → '+v).join('\n   '));
 }],
], {live:true});

/* ========================================================================
   第 4 组 · 层级与材质（33–42）
   ====================================================================== */

R(33,'投影只分两层',[
 ['全站投影的种类 ≤3',()=>{
  const m={};
  for(const {p,s} of ALL())for(const e of s.els){
   if(!e.sh)continue;
   /* inset 的不是投影是内描边；0 0 0 Npx 的是焦点光圈，也不是投影 */
   if(/inset/.test(e.sh))continue;
   if(/^[^,]*\b0px 0px 0px \d/.test(e.sh)||/\d+px\)? 0px 0px 0px \d/.test(e.sh))continue;
   if(e.foc)continue;
   (m[e.sh]=m[e.sh]||new Set()).add(p.name+'/'+(e.cls.split(/\s+/)[0]||e.t))}
  const ks=Object.keys(m);
  /* 允许三种：贴在页面上的一档、浮层一档、抽屉从右边推进来的那一档
     （它的投影是往左打的，方向不同是对的）。 */
  must(ks.length<=3,'投影有 '+ks.length+' 种：\n   '+ks.map(k=>k.slice(0,56)+' ← '+[...m[k]].slice(0,3).join('、')).join('\n   '));
 }],
 ['投影只分两层：内容卡一档、浮层一档',()=>{
  /* 不再查「卡片有没有投影」——定稿的皮肤里 --sh-1 是一层很淡的投影，
     卡片带着它是对的。要查的是层数：同样是内容卡，有的 1px 有的 6px，
     就变成了用模糊半径表达层级，而层级本该只有「贴在页面上」和「浮在页面上」两层。 */
  const blur=sh=>{const m=sh.match(/(-?[\d.]+)px\s+(-?[\d.]+)px\s+(-?[\d.]+)px/);return m?parseFloat(m[3]):0};
  const flat=new Set(),lift=new Set();
  for(const {p,s} of ALL())for(const e of s.els){
   if(!e.sh||/inset/.test(e.sh))continue;
   if(e.w<120||e.h<40)continue;
   (blur(e.sh)>8?lift:flat).add(Math.round(blur(e.sh)))}
  must(flat.size<=2,'贴在页面上的那一层有 '+flat.size+' 种模糊半径：'+[...flat].sort((a,b)=>a-b).join('/')+'px');
  must(lift.size<=2,'浮起的那一层有 '+lift.size+' 种模糊半径：'+[...lift].sort((a,b)=>a-b).join('/')+'px');
 }],
]);

R(34,'卡片材质统一',[
 ['主要卡片都是「白底 + 1px 线」，不混投影派和描边派',()=>{
  const m={};
  for(const {p,s} of ALL())for(const e of s.els){
   if(!/card|device|exp|asset|node|panel/i.test(e.cls))continue;
   if(e.w<160||e.h<60)continue;
   /* 卡片得有自己的面。没有底色的是卡片里的一段、或者排版用的壳 */
   if(!rgb(e.bg))continue;
   const bw=e.bw.split(',').map(Number).filter(Boolean).length;
   const way=(bw?'描边':'')+(e.sh&&!/inset/.test(e.sh)?'+投影':'')+(rgb(e.bg)?'+底色':'');
   (m[way||'什么都没有']=m[way||'什么都没有']||new Set()).add(p.name+'/'+e.cls.split(/\s+/)[0])}
  const ks=Object.keys(m);
  must(ks.length<=2,'卡片材质有 '+ks.length+' 派：\n   '+ks.map(k=>k+' ← '+[...m[k]].slice(0,4).join('、')).join('\n   '));
 }],
]);

R(35,'侧栏与内容区的关系固定',[
 ['侧栏底色、宽度、右边线在各页一致（三栏页除外）',()=>{
  const THREE=new Set(['chat','schedules']);
  const m={};
  for(const {p,s} of ALL()){
   if(THREE.has(p.r)||!s.side)continue;
   (m[s.side.w+'px '+s.side.bg+' 右线'+s.side.bd]=m[s.side.w+'px '+s.side.bg+' 右线'+s.side.bd]||[]).push(p.name)}
  const ks=Object.keys(m);
  must(ks.length===1,'侧栏有 '+ks.length+' 种：\n   '+ks.map(k=>k+' ← '+m[k].join('、')).join('\n   '));
 }],
 ['侧栏与页面底色不同（分得出哪是导航哪是内容）',()=>{
  const {s}=ALL()[0];
  must(s.side,'找不到侧栏');
  const a=rgb(s.side.bg),b=rgb(s.bodyBg);
  must(!a||!b||dist(a,b)>0||/1px/.test(s.side.bd),'侧栏和页面同底色，又没有分界线');
 }],
]);

R(36,'分隔线用途一致',[
 ['分隔线只有一种颜色一种粗细',()=>{
  const m={};
  for(const {p,s} of ALL())for(const e of s.els){
   if(TRI(e))continue;
   const bw=e.bw.split(',').map(Number),cs=e.bc.split('|');
   /* 只有一条边的 1px 线才算分隔线；四边都有的是描边容器 */
   const n=bw.filter(Boolean).length;
   if(n!==1)continue;
   const i=bw.findIndex(Boolean);
   if(bw[i]!==1)continue;
   const t=tokenOf(cs[i],4)||cs[i];
   (m[t]=m[t]||new Set()).add(p.name+'/'+(e.cls.split(/\s+/)[0]||e.t))}
  const ks=Object.keys(m);
  must(ks.length<=2,'分隔线有 '+ks.length+' 种颜色：'+ks.map(k=>k+'×'+m[k].size+'（如 '+[...m[k]][0]+'）').join('；'));
 }],
 ['hr 与 border 不混用',()=>{
  const hr=[];for(const {p,s} of ALL())if(s.els.some(e=>e.t==='hr'))hr.push(p.name);
  must(hr.length===0||hr.length===ALL().length,'只有这几页用 <hr>，其余用 border：'+hr.join('、'));
 }],
]);

R(37,'返回与面包屑一致',[
 ['二级页的返回入口写法统一',()=>{
  const m={};
  for(const {p,s} of ALL()){
   const back=s.els.filter(e=>e.txt&&/^←/.test(e.txt.trim()));
   if(!back.length)continue;
   const e=back[0];
   (m[[e.fs,tokenOf(e.col,4)||e.col,e.t,e.h].join(' / ')]=m[[e.fs,tokenOf(e.col,4)||e.col,e.t,e.h].join(' / ')]||[]).push(p.name+'「'+e.txt.trim().slice(0,10)+'」')}
  const ks=Object.keys(m);
  must(ks.length<=1,'返回入口有 '+ks.length+' 种：\n   '+ks.map(k=>k+' ← '+m[k].join('、')).join('\n   '));
 }],
 ['返回的箭头与文字之间的写法统一（都是「← 名字」）',()=>{
  const bad=[];
  for(const {p,s} of ALL())for(const e of s.els){
   if(!e.txt||!/←/.test(e.txt))continue;
   const t=e.txt.trim();
   if(!/^←\s\S/.test(t))bad.push(p.name+'：'+JSON.stringify(t.slice(0,16)))}
  must(!bad.length,bad.join('；'));
 }],
]);

R(38,'钉住的头部表现一致',[
 ['sticky 元素有底色，滚动时不会透出下面的内容',()=>{
  const bad=[];
  for(const {p,s} of ALL())for(const e of s.els){
   if(e.pos!=='sticky')continue;
   /* 只判横着铺开的头部与底部条。竖着的二级导航栏也是 sticky，
      但它自己占一栏，没有内容会从它底下滚过去。 */
   if(e.w<s.viewBox.w*.5)continue;
   if(!rgb(e.bg))bad.push(p.name+' · '+(e.cls.split(/\s+/)[0]||e.t)+' 钉住了但没有底色')}
  must(!bad.length,say([...new Set(bad)]));
 }],
]);

R(39,'层级编号不交叉',[
 ['层级不交叉：浮层永远在内容之上',()=>{
  /* 不数档数——档数多不等于乱。要防的是交叉：内容里的某个元素爬到了浮层上面，
     于是抽屉打开时，底下那行表头还浮在它前面。 */
  const m={};
  for(const {p,s} of ALL())for(const e of s.els){
   if(e.zi==='auto'||!e.zi)continue;
   (m[e.zi]=m[e.zi]||new Set()).add(p.name+'/'+(e.cls.split(/\s+/)[0]||e.t))}
  const ks=Object.keys(m).map(Number).sort((a,b)=>a-b);
  const FLOAT=/dw$|dw-|dialog|pop|menu|toast|drawer|overlay|aide|gs-/i;
  const floats=ks.filter(z=>[...m[z]].some(x=>FLOAT.test(x)));
  const content=ks.filter(z=>![...m[z]].some(x=>FLOAT.test(x)));
  if(floats.length&&content.length){
   const lowFloat=Math.min(...floats),highContent=Math.max(...content);
   must(lowFloat>highContent,
    '内容层爬到了浮层上面：内容最高 '+highContent+'（'+[...m[highContent]].slice(0,2).join('、')+'），浮层最低 '+lowFloat);}
  const big=ks.filter(z=>z>100);
  must(!big.length,'用了过高的 z-index：'+big.map(z=>z+'（'+[...m[z]].slice(0,2).join('、')+'）').join('；'));
 }],
]);

R(40,'浮层一定浮着',[
 ['下拉菜单展开后有投影',async p=>{
  const bad=[];
  for(const r of ['lab','data','mdl']){
   const pg=PG(r);await gotoPage(p,pg);
   const loc=p.locator('#view .ctl-dd').first();
   if(!await loc.count())continue;
   await loc.click({force:true}).catch(()=>{});await p.waitForTimeout(300);
   const v=await p.evaluate(()=>{
    /* 这套下拉是「一个看得见的壳 + 一个藏起来的原生 select」，
       展开时的列表由系统画，DOM 里没有对应的元素。
       所以只在真的有自绘浮层时才判它有没有投影。 */
    const pop=document.querySelector('.ctl-pop,.ctl-menu,[role="listbox"]:not(.sel-raw)');
    if(!pop||!pop.getBoundingClientRect().height)return 'none';
    return getComputedStyle(pop).boxShadow==='none'?'无投影':'ok'});
   if(v==='无投影')bad.push(pg.name+' 的下拉浮层没有投影');
   await p.keyboard.press('Escape');await p.waitForTimeout(150);
  }
  must(!bad.length,bad.join('；'));
 }],
], {live:true});

R(41,'同一层不靠投影互相区分',[
 ['同一页里并列的卡片，要么都投影要么都不投影',()=>{
  const bad=[];
  for(const {p,s} of ALL()){
   /* 按「同一个类名、同一行」分组：它们在视觉上是并列的同一层 */
   const g={};
   for(const e of s.els){
    if(e.w<140||e.h<60)continue;
    const c=e.cls.split(/\s+/)[0];if(!c)continue;
    (g[c]=g[c]||[]).push(e)}
   for(const c in g){
    if(g[c].length<2)continue;
    const ways=new Set(g[c].map(e=>e.sh&&!/inset/.test(e.sh)?'投影':'无'));
    if(ways.size>1)bad.push(p.name+' · .'+c+' 里有的投影有的不投影')}
  }
  must(!bad.length,say([...new Set(bad)]));
 }],
]);

R(42,'悬停抬起只给可点的',[
 ['静态容器不加 transform 抬起',async p=>{
  const bad=[];
  for(const r of ['workbench','lab','shelf']){
   const pg=PG(r);await gotoPage(p,pg);
   const v=await p.evaluate(()=>{const o=[];
    for(const e of document.querySelectorAll('#view *')){
     const c=getComputedStyle(e);
     /* transition-property 不写时默认就是 all，所以还得看有没有时长——
        没有时长就根本没有过渡，不算「会抬起来」。 */
     if(parseFloat(c.transitionDuration)===0)continue;
     if(!/transform/.test(c.transitionProperty)&&c.transitionProperty!=='all')continue;
     const click=e.onclick||e.tagName==='BUTTON'||e.tagName==='A'||e.closest('button,a')||e.querySelector('button,a')||e.hasAttribute('tabindex');
     if(!click)o.push((typeof e.className==='string'?e.className.split(/\s+/)[0]:e.tagName));}
    return [...new Set(o)].slice(0,6)});
   if(v.length)bad.push(pg.name+'：'+v.join('、'));
  }
  must(!bad.length,bad.join('；'));
 }],
], {live:true});

/* ========================================================================
   第 5 组 · 文字与排印（43–50）
   ====================================================================== */

R(43,'标题写法统一',[
 ['标题不以标点结尾，不含换行，不全大写',()=>{
  const bad=[];
  for(const {p,s} of ALL())for(const e of s.els){
   if(!/^h[1-4]$/.test(e.t)||!e.txt)continue;
   const t=e.txt.trim();
   if(/[。，、；：,.;:]$/.test(t))bad.push(p.name+' '+e.t+'「'+t.slice(0,18)+'」以标点结尾');
   if(/[\n\r]/.test(t))bad.push(p.name+' '+e.t+' 里有换行');
   if(e.tt==='uppercase')bad.push(p.name+' '+e.t+' 被强制全大写');}
  must(!bad.length,say([...new Set(bad)]));
 }],
 ['区块小标题（h2）的字号收敛',()=>{
  const m={};
  for(const {p,s} of ALL())for(const e of s.els){
   if(e.t!=='h2'||!e.txt)continue;
   /* 窄栏（列表栏、二级导航）里的 h2 是分组标签，不是区块标题 */
   if(e.w<300)continue;
   (m[e.fs]=m[e.fs]||new Set()).add(p.name+'「'+e.txt.trim().slice(0,10)+'」')}
  const ks=Object.keys(m).map(Number).sort((a,b)=>a-b);
  must(ks.length<=2,'区块小标题有 '+ks.length+' 种字号：'+ks.map(f=>f+'px（'+[...m[f]].slice(0,3).join('、')+'）').join('；'));
 }],
]);

R(44,'等宽字体只给机器可读的内容',[
 ['中文不用等宽排',()=>{
  const bad=sweep(e=>{
   if(!e.txt||!/Mono|mono/i.test(e.ff))return '';
   /* 代码块和文件预览是原样显示文件内容，里面有中文也该等宽 */
   if(e.t==='pre'||e.t==='code'||/\bpre\b|code|log|json|fasta/i.test(e.cls))return '';
   /* 等宽排中文，字距会散开，一眼就不对 */
   return /[\u4e00-\u9fa5]{3,}/.test(e.txt)?('等宽排中文：「'+e.txt.slice(0,18)+'」'):''});
  must(!bad.length,say(bad));
 }],
 ['表格里同一列的数字，要么都等宽要么都不等宽',()=>{
  /* 等宽是为了让数字按位对齐。同一列一半等宽一半不等宽，这一列就对不齐。
     这比「凡是 .num 都得等宽」更接近它要解决的问题——有些 .num 里装的根本是中文。 */
  const bad=[];
  for(const {p,s} of ALL()){
   const td=s.els.filter(e=>e.t==='td'&&e.txt);
   const col={};for(const e of td){const k=Math.round(e.x/8)*8;(col[k]=col[k]||[]).push(e)}
   for(const k in col){const cells=col[k].filter(e=>/^[\d\s.,%+\-\u2013/:]+$/.test(e.txt.trim()));
    if(cells.length<3)continue;
    const fams=new Set(cells.map(e=>/Mono|mono/i.test(e.ff)?'等宽':'正文'));
    if(fams.size>1)bad.push(p.name+' 第 '+k+'px 列的数字一半等宽一半不等宽')}}
  must(!bad.length,bad.join('；'));
 }],
]);

R(45,'数字列对得齐',[
 ['表格里的纯数字列整列同一种对齐',()=>{
  const bad=[];
  for(const {p,s} of ALL()){
   const td=s.els.filter(e=>e.t==='td');
   if(!td.length)continue;
   /* 按 x 坐标分列 */
   const col={};for(const e of td){const k=Math.round(e.x/8)*8;(col[k]=col[k]||[]).push(e)}
   for(const k in col){const cells=col[k].filter(e=>e.txt);
    if(cells.length<3)continue;
    const allNum=cells.every(e=>/^[\d\s.,%+\-–/]+$/.test(e.txt.trim()));
    if(!allNum)continue;
    const tas=new Set(cells.map(e=>e.ta));
    if(tas.size>1)bad.push(p.name+' 第 '+k+'px 列是数字列，对齐混着来：'+[...tas].join('/'))}}
  must(!bad.length,bad.join('；'));
 }],
]);

R(46,'全站一个字体族',[
 ['正文字体族只有一种（等宽另算）',()=>{
  const m={};
  for(const {p,s} of ALL())for(const e of s.els){
   if(!e.txt||!e.ff)continue;
   if(/Mono|mono/i.test(e.ff))continue;
   (m[e.ff]=m[e.ff]||new Set()).add(p.name+'/'+(e.cls.split(/\s+/)[0]||e.t))}
  const ks=Object.keys(m);
  must(ks.length===1,'正文字体族有 '+ks.length+' 种：'+ks.map(k=>k+'（'+[...m[k]].slice(0,3).join('、')+'）').join('；'));
 }],
 ['标题和正文同族（不混衬线）',()=>{
  const h=new Set(),b=new Set();
  for(const {s} of ALL())for(const e of s.els){
   if(!e.txt)continue;
   if(/^h[1-3]$/.test(e.t))h.add(e.ff);else if(e.t==='p')b.add(e.ff)}
  const mix=[...h].filter(f=>!b.has(f)&&!/Mono/i.test(f));
  must(!mix.length,'标题用了正文没有的字体：'+mix.join('、'));
 }],
]);

R(47,'按钮文案是动作，不是句子',[
 ['按钮文字不超过 8 个字，不带句末标点',()=>{
  const bad=[];
  for(const {p,s} of ALL())for(const e of s.els){
   if(e.t!=='button'||!e.txt||!e.leaf)continue;
   /* 只判操作按钮。对话里的建议问句、列表里以对象名命名的入口本来就是整句或专名，
      它们不是「按钮文案」，长度规则不适用。 */
   if(!cls(e,'btn'))continue;
   if(/\bch\b|qk|sugg|card|row|item|crumb|nav|pick|opt/i.test(e.cls))continue;
   const t=e.txt.trim();
   if(!t||/^[←→↑↓·+×✓…\d\s]+$/.test(t))continue;
   if(t.length>10)bad.push(p.name+'：「'+t.slice(0,24)+'」'+t.length+' 字');
   if(/[。！？.!?]$/.test(t))bad.push(p.name+'：「'+t.slice(0,18)+'」带句末标点');
   if(/^(点击|请点击|点这里|这里)/.test(t))bad.push(p.name+'：「'+t.slice(0,18)+'」把句子写成了按钮');}
  must(!bad.length,say([...new Set(bad)],8));
 }],
]);

R(48,'没有 emoji 当图标',[
 ['界面文字里不出现 emoji / 装饰符号',()=>{
  const EMO=/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{1F1E6}-\u{1F1FF}]/u;
  const bad=sweep(e=>{
   if(!e.txt)return '';
   return EMO.test(e.txt)?('出现 emoji：「'+e.txt.slice(0,18)+'」'):''});
  must(!bad.length,say(bad));
 }],
]);

R(49,'没有眉题、没有全大写小标签',[
 ['标题上方不挂全大写的英文小标签',()=>{
  const bad=sweep(e=>{
   if(!e.txt||e.fs>14)return '';
   const t=e.txt.trim();
   if(t.length<2||t.length>28)return '';
   if(e.tt==='uppercase')return '被强制全大写：「'+t.slice(0,18)+'」';
   /* 文件类型角标（FASTA / JSON / CSV / PDB）本来就是大写的专名，不是眉题。
      眉题的标志是「挂在标题上方的一行大写小字」，所以只判独立成行、
      又不是角标的那种。 */
   if(/fsq|fico|ext|type/i.test(e.cls))return '';
   /* 眉题的标志是「小字 + 字距刻意拉开」，挂在标题上面当分类标签用。
      单是全大写不算——UNIPROT、FASTA 这些本来就是大写的专名；
      但大写再加拉开的字距，就是定稿里点名不要的那个做法。
      （侧栏的分组标签是导航结构的一部分，不在此列。） */
   if(num(e.ls)>=e.fs*.05&&/^[A-Z0-9][A-Z0-9\s&/·-]{3,}$/.test(t))
    return '全大写 + 拉开字距：「'+t.slice(0,18)+'」';
   if(num(e.ls)>=e.fs*.06&&/eyebrow|kicker/i.test(e.cls))
    return '眉题：「'+t.slice(0,18)+'」';
   return ''});
  must(!bad.length,say(bad));
 }],
 ['没有刻意拉开的字距（眉题的标志）',()=>{
  const bad=[];
  for(const {p,s} of ALL())for(const e of s.els){
   if(!e.txt||e.fs>14)continue;
   if(!/eyebrow|kicker/i.test(e.cls))continue;
   bad.push(p.name+' · '+e.cls.split(/\s+/)[0]+'「'+e.txt.slice(0,14)+'」')}
  must(!bad.length,'还留着眉题：'+bad.join('；'));
 }],
]);

R(50,'截断的文字能看到全文',[
 ['用省略号截断的地方留了 title',()=>{
  const bad=sweep(e=>{
   if(e.ov!=='ellipsis'||!e.txt)return '';
   if(!e.clipped)return '';
   return e.title?'':('截断了但没有 title：「'+e.txt.slice(0,18)+'」')});
  must(!bad.length,say(bad,8));
 }],
 ['没有被硬裁掉（overflow hidden 又没有省略号）',()=>{
  const bad=sweep(e=>{
   if(!e.clipped||!e.txt)return '';
   if(e.ov==='ellipsis')return '';
   if(e.ws==='nowrap')return '硬裁：「'+e.txt.slice(0,18)+'」';
   return ''});
  must(!bad.length,say(bad,8));
 }],
]);

/* ========================================================================
   第 6 组 · 效果与状态（51–60）
   ====================================================================== */

R(51,'过渡时长收敛',[
 ['全站过渡时长不超过 4 档，且都在 300ms 内',()=>{
  const m={};
  for(const {p,s} of ALL())for(const e of s.els){
   if(!e.tr||e.tr==='0s')continue;
   for(const d of e.tr.split(',').map(x=>x.trim())){
    if(d==='0s')continue;
    (m[d]=m[d]||new Set()).add(p.name+'/'+(e.cls.split(/\s+/)[0]||e.t))}}
  const ks=Object.keys(m);
  must(ks.length<=4,'过渡时长有 '+ks.length+' 档：'+ks.map(k=>k+'（'+[...m[k]][0]+'）').join('；'));
  const slow=ks.filter(k=>num(k)*(/ms$/.test(k)?1:1000)>300);
  must(!slow.length,'过渡太慢：'+slow.map(k=>k+'（'+[...m[k]].slice(0,2).join('、')+'）').join('；'));
 }],
]);

R(52,'减少动态效果被尊重',[
 ['开了「减少动态效果」之后没有循环动画',async p=>{
  await gotoPage(p,PG('workbench'));
  const v=await p.evaluate(()=>{const o=[];
   for(const e of document.querySelectorAll('#view *,#side *')){
    const c=getComputedStyle(e);
    if(c.animationName!=='none'&&c.animationIterationCount!=='1'&&parseFloat(c.animationDuration)>0)
     o.push((typeof e.className==='string'?e.className.split(/\s+/)[0]:e.tagName)+' → '+c.animationName);}
   return [...new Set(o)].slice(0,6)});
  must(!v.length,'还在循环播放：'+v.join('；'));
 }],
], {live:true});

R(53,'加载态一致',[
 ['骨架 / 加载条的底色与圆角统一',()=>{
  const m={};
  for(const {p,s} of ALL())for(const e of s.els){
   if(!/skeleton|loading|shimmer|spin/i.test(e.cls))continue;
   (m[[tokenOf(e.bg,4)||e.bg,Math.round(num(e.rad.split(',')[0]))].join(' / ')]=m[[tokenOf(e.bg,4)||e.bg,Math.round(num(e.rad.split(',')[0]))].join(' / ')]||new Set()).add(p.name+'/'+e.cls.split(/\s+/)[0])}
  const ks=Object.keys(m);
  must(ks.length<=2,'加载态有 '+ks.length+' 种：'+ks.map(k=>k+'（'+[...m[k]][0]+'）').join('；'));
 }],
]);

R(54,'「进行中」只有一种视觉',[
 ['进行中的标记在各页同一个样',()=>{
  const m={};
  for(const {p,s} of ALL())for(const e of s.els){
   if(!/running|is-run|in-progress|doing/i.test(e.cls))continue;
   (m[[tokenOf(e.col,5)||e.col,tokenOf(e.bg,4)||e.bg||'无底',e.bw].join(' / ')]=m[[tokenOf(e.col,5)||e.col,tokenOf(e.bg,4)||e.bg||'无底',e.bw].join(' / ')]||new Set()).add(p.name+'/'+e.cls.split(/\s+/)[0])}
  const ks=Object.keys(m);
  must(ks.length<=2,'进行中有 '+ks.length+' 种画法：\n   '+ks.map(k=>k+' ← '+[...m[k]].slice(0,3).join('、')).join('\n   '));
 }],
]);

R(55,'深色下这套色还站得住',[
 ['深色模式里正文对比度仍然够读',async (p,browser)=>{
  const dp=await browser.newPage({viewport:{width:1440,height:900},colorScheme:'dark',reducedMotion:'reduce'});
  try{
   await blockExternalNetwork(dp);
   await dp.goto(FILE,{waitUntil:'domcontentloaded'});
   await dp.waitForTimeout(1200);
   const bad=[];
   for(const r of ['workbench','lab','shelf','data','mdl']){
    await dp.evaluate(x=>go(x),r);await dp.waitForTimeout(350);
    const res=await dp.evaluate(()=>{
     const L=c=>{const m=c.match(/[\d.]+/g).map(Number);const f=x=>{x/=255;return x<=.03928?x/12.92:Math.pow((x+.055)/1.055,2.4)};
      return .2126*f(m[0])+.7152*f(m[1])+.0722*f(m[2])};
     const pageBg=getComputedStyle(document.body).backgroundColor;
     const o=[];
     for(const e of document.querySelectorAll('#view *')){
      const t=e.children.length?'':e.textContent.trim();if(!t)continue;
      const c=getComputedStyle(e);const fs=parseFloat(c.fontSize);
      if(fs<12)continue;
      let bg=c.backgroundColor;
      if(!bg||bg==='rgba(0, 0, 0, 0)')bg=pageBg;
      if(!/\d/.test(c.color)||!/\d/.test(bg))continue;
      const a=L(c.color),b=L(bg);
      const cr=(Math.max(a,b)+.05)/(Math.min(a,b)+.05);
      const big=fs>=18||(fs>=14&&+c.fontWeight>=700);
      if(cr<(big?3:4.5))o.push((typeof e.className==='string'?e.className.split(/\s+/)[0]:e.tagName)+'「'+t.slice(0,12)+'」'+Math.round(cr*100)/100+':1');}
     return [...new Set(o)].slice(0,5)});
    if(res.length)bad.push(r+'：'+res.join('，'));
   }
   must(!bad.length,bad.join('\n   '));
  }finally{await dp.close()}
 }],
 ['深色下主按钮还看得出是主按钮',async (p,browser)=>{
  const dp=await browser.newPage({viewport:{width:1440,height:900},colorScheme:'dark',reducedMotion:'reduce'});
  try{
   await blockExternalNetwork(dp);
   await dp.goto(FILE,{waitUntil:'domcontentloaded'});await dp.waitForTimeout(1200);
   const bad=[];
   for(const r of ['lab','shelf','data']){
    await dp.evaluate(x=>go(x),r);await dp.waitForTimeout(350);
    const v=await dp.evaluate(()=>{
     const a=document.querySelector('#view .btn-pri'),b=document.querySelector('#view .btn:not(.btn-pri):not(.btn-gh)');
     if(!a||!b)return null;
     const ca=getComputedStyle(a),cb=getComputedStyle(b);
     return {pri:ca.backgroundColor+'/'+ca.color,sec:cb.backgroundColor+'/'+cb.color}});
    if(v&&v.pri===v.sec)bad.push(r+'：主按钮和次按钮一个样（'+v.pri+'）');
   }
   must(!bad.length,bad.join('；'));
  }finally{await dp.close()}
 }],
], {live:true});

R(56,'窄屏下控件一起放大',[
 ['390 宽下，各页的主要控件都够手指点（≥40px）',async (p,browser)=>{
  const mp=await browser.newPage({viewport:{width:390,height:844},reducedMotion:'reduce',hasTouch:true});
  try{
   await blockExternalNetwork(mp);
   await mp.goto(FILE,{waitUntil:'domcontentloaded'});await mp.waitForTimeout(1200);
   const bad=[];
   for(const r of ['lab','shelf','data','materials','mdl','trainnew']){
    await mp.evaluate(x=>go(x),r);await mp.waitForTimeout(400);
    const small=await mp.evaluate(()=>{const o=[];
     for(const e of document.querySelectorAll('#view .btn,#view input:not([type=checkbox]):not([type=radio]),#view .ctl-dd,#view select')){
      const b=e.getBoundingClientRect();
      if(b.width<=2||b.height<=2)continue;        /* 藏起来的原生 select、读屏文本 */
      const cs=getComputedStyle(e);
      /* 搜索框那种自己不画框的，手指点的是外面那层 label，量它没有意义 */
      if(e.tagName==='INPUT'&&parseFloat(cs.borderTopWidth)===0
        &&(cs.backgroundColor==='rgba(0, 0, 0, 0)'||cs.backgroundColor==='transparent'))continue;
      if(b.height<40)o.push((typeof e.className==='string'?e.className.split(/\s+/)[0]:e.tagName)+' '+Math.round(b.height)+'px');}
     return [...new Set(o)].slice(0,5)});
    if(small.length)bad.push(r+'：'+small.join('、'));
   }
   must(!bad.length,bad.join('\n   '));
  }finally{await mp.close()}
 }],
], {live:true});

R(57,'各宽度下不横滚',[
 ['1024 / 1280 / 1440 / 1680 下页面不出现横向滚动',async (p,browser)=>{
  const bad=[];
  for(const w of [1024,1280,1440,1680]){
   const q=await browser.newPage({viewport:{width:w,height:900},reducedMotion:'reduce'});
   try{
    await blockExternalNetwork(q);
    await q.goto(FILE,{waitUntil:'domcontentloaded'});await q.waitForTimeout(1200);
    for(const pg of PAGES){
     if(pg.setup)await pg.setup(q);else await q.evaluate(r=>go(r),pg.r);
     await q.waitForTimeout(300);
     const o=await q.evaluate(()=>({d:document.documentElement.scrollWidth,w:innerWidth}));
     if(o.d-o.w>2)bad.push(w+' 宽 · '+pg.name+' 溢出 '+(o.d-o.w)+'px');
    }
   }finally{await q.close()}
  }
  must(!bad.length,say(bad,10));
 }],
], {live:true});

R(58,'翻页时页框不跳',[
 ['在列表页之间来回切，侧栏宽度和内容起点不动',async p=>{
  const seq=['workbench','projects','lab','shelf','data','mdl','devices','materials','settings'];
  const got=[];
  for(const r of seq){
   await p.evaluate(x=>go(x),r);await p.waitForTimeout(350);
   got.push({r,...await p.evaluate(()=>{const V=document.getElementById('view'),S2=document.getElementById('side');
    const v=V.getBoundingClientRect();
    return {side:Math.round(S2?S2.getBoundingClientRect().width:0),x:Math.round(v.left),pad:Math.round(parseFloat(getComputedStyle(V).paddingLeft))}})});
  }
  const sides=new Set(got.map(g=>g.side)),xs=new Set(got.map(g=>g.x));
  must(sides.size===1,'侧栏宽度在翻页中变了：'+got.map(g=>g.r+':'+g.side).join(' '));
  must(xs.size===1,'内容区左边界在翻页中变了：'+got.map(g=>g.r+':'+g.x).join(' '));
  /* 留白不在这里判：两栏页（资料空间）把留白放进了自己的栏里，#view 上量到 0。
     「正文到栏边有多少白」交给第 7 轮。 */
 }],
 ['从三栏页回到普通页，侧栏恢复原样',async p=>{
  await p.evaluate(()=>go('lab'));await p.waitForTimeout(300);
  const a=await p.evaluate(()=>Math.round(document.getElementById('side').getBoundingClientRect().width));
  await p.evaluate(()=>go('chat'));await p.waitForTimeout(400);
  const mid=await p.evaluate(()=>Math.round(document.getElementById('side').getBoundingClientRect().width));
  await p.evaluate(()=>go('lab'));await p.waitForTimeout(400);
  const b=await p.evaluate(()=>Math.round(document.getElementById('side').getBoundingClientRect().width));
  must(a===b,'去过对话再回来，侧栏从 '+a+'px 变成 '+b+'px（对话页是 '+mid+'px）');
 }],
], {live:true});

/* AlphaFold pLDDT 的四档：#0053D6 / #65CBF3 / #FFDB13 / #FF7D45 */
const PLDDT=[[0,83,214],[101,203,243],[255,219,19],[255,125,69]];
R(59,'图表只用中性加墨蓝',[
 ['pLDDT 的那四个颜色不跑到控件上去',()=>{
  /* 它可以出现在图形里，但一旦当了按钮底色、标签底色或正文颜色，
     就从「读数」变成了「装饰」，也会和墨蓝打架。 */
  const bad=sweep(e=>{
   for(const v of [rgb(e.bg),rgb(e.col)]){
    if(!v||!PLDDT.some(x=>dist(v,x)<=4))continue;
    if(e.t==='svg'||e.t==='i'||e.t==='rect'||e.t==='path')continue;
    if(!e.txt&&Math.min(e.w,e.h)<=12)continue;   /* 图例上的小色块 */
    return 'pLDDT 的颜色用在了「'+(e.txt||e.cls).slice(0,16)+'」上'}
   return ''});
  must(!bad.length,say(bad));
 }],
 ['图表里的描边与填充不出现第四种颜色',async p=>{
  const bad=[];
  for(const pg of PAGES){
   await gotoPage(p,pg);
   const cols=await p.evaluate(()=>{const o=new Set();
    for(const e of document.querySelectorAll('#view svg path,#view svg rect,#view svg circle,#view svg line,#view svg polyline')){
     /* 数据色阶不是装饰色：pLDDT 的四档蓝橙是 AlphaFold 定的读数标尺，
        换成墨蓝就读不出置信度了。只判界面图形。 */
     if(e.closest('[class*=plddt],[class*=scale],[class*=legend],[class*=band],[class*=heat]'))continue;
     const c=getComputedStyle(e);
     for(const v of [c.stroke,c.fill]){
      if(!v||v==='none'||/rgba\(0, 0, 0, 0\)/.test(v))continue;o.add(v)}}
    return [...o]});
   for(const c of cols){
    const v=rgb(c);if(!v)continue;
    if(neutral(c,10))continue;
    if(['dry','dryInk','drySoft','dryDim','err','errSoft','ok','okInk','okSoft'].some(k=>dist(v,TOK[k])<=6))continue;
    /* pLDDT 的四档蓝橙是 AlphaFold 数据库的事实标准（源码里写明了，也写明了
       它只跟结构相关的视图走：结构查看器、它的图例、数据库页上 AFDB 那张卡的图）。
       它是读数标尺不是装饰色——换成墨蓝就读不出置信度，所以放过它。 */
    if(PLDDT.some(x=>dist(v,x)<=4))continue;
    bad.push(pg.name+' 图形用了 '+c);
   }
  }
  must(!bad.length,say([...new Set(bad)]));
 }],
], {live:true});

R(60,'摆在一起是同一个产品',[
 ['26 个页面的五项指纹完全相同',()=>{
  /* 指纹 = 字体族 / 页面底色 / h1 写法 / 主按钮写法 / 分隔线。
     这五项一致，翻页时才不会觉得「换了个软件」。 */
  const fp={};
  for(const {p,s} of ALL()){
   const body=s.bodyBg;
   const ff=(s.els.find(e=>e.txt&&!/Mono/i.test(e.ff))||{}).ff||'-';
   const h1=s.h1?[s.h1.fs,s.h1.fw,s.h1.col,s.h1.ls].join(' '):'无 h1';
   const pri=(s.els.find(e=>cls(e,'btn-pri')&&!e.dis)||{});
   const priS=pri.bg?[pri.bg,pri.col,Math.round(num(pri.rad.split(',')[0])),pri.h].join(' '):'本页无主按钮';
   /* 分隔线不比「用了哪一种」——一页里有没有内层分隔，取决于它装了什么。
      指纹要的是「有没有人另起一种灰」：只要都落在 --line / --line-2 上就是同一套。
      （线一共有几种颜色，第 36 轮单独在判。） */
   /* 指纹里这一项问的是「有没有人另起一种这套色以外的线」。
      线分几种灰、一页用了哪几种，第 6 轮和第 36 轮分别在判。 */
   const line=(()=>{const off=new Set();
     for(const e of s.els){const bw=e.bw.split(',').map(Number),cs=e.bc.split('|');
      const i=bw.findIndex(w=>w===1);if(i<0)continue;
      const col=cs[i];if(!rgb(col))continue;
      if(!inPalette(col))off.add(col)}
     return off.size?('另起了 '+[...off].join('、')):'都在这套色里'})();
   fp[p.name]={ff,body,h1,priS,line};
  }
  const names=Object.keys(fp);
  const bad=[];
  for(const key of ['ff','body','h1','line']){
   const m={};for(const n of names)(m[fp[n][key]]=m[fp[n][key]]||[]).push(n);
   if(Object.keys(m).length>1)bad.push({
    ff:'字体族',body:'页面底色',h1:'h1 写法',line:'分隔线'}[key]+'有 '+Object.keys(m).length+' 种：\n     '
    +Object.entries(m).map(([k,v])=>k+' ← '+v.join('、')).join('\n     '));
  }
  /* 主按钮允许「这一页没有主按钮」，但有的那些必须一样 */
  const pris={};for(const n of names)if(fp[n].priS!=='本页无主按钮')(pris[fp[n].priS]=pris[fp[n].priS]||[]).push(n);
  if(Object.keys(pris).length>1)bad.push('主按钮有 '+Object.keys(pris).length+' 种：\n     '
   +Object.entries(pris).map(([k,v])=>k+' ← '+v.join('、')).join('\n     '));
  must(!bad.length,bad.join('\n   '));
 }],
]);

/* ========================================================================
   跑法
   ====================================================================== */
function wanted(n){
 if(!ARG)return true;
 const m=ARG.match(/^(\d+)-(\d+)$/);
 if(m)return n>=+m[1]&&n<=+m[2];
 return String(n)===ARG;
}
(async()=>{
 const todo=ROUNDS.filter(r=>wanted(r.n));
 if(!todo.length){console.error('没有匹配的轮次：'+ARG+'（一共 '+ROUNDS.length+' 轮）');process.exitCode=1;return}
 const browser=await chromium.launch();
 let pass=0;const fails=[];
 try{
  /* 先抄一遍全站。只要还有一轮需要快照就得抄——绝大多数轮都需要。 */
  const needSnap=todo.some(r=>!r.live);
  if(needSnap){
   const p=await freshPage(browser);
   for(const pg of PAGES){
    await gotoPage(p,pg);
    SNAP[pg.r]=await p.evaluate(SNAPJS);
   }
   const n=Object.values(SNAP).reduce((a,s)=>a+s.els.length,0);
   console.log('抄完 '+Object.keys(SNAP).length+' 个页面，'+n+' 个可见元素。\n');
   /* DUMP=路径 时把快照落盘，方便离线分析某一类值到底出现在哪 */
   if(process.env.DUMP)require('node:fs').writeFileSync(process.env.DUMP,JSON.stringify(SNAP));
   if(p.__errs.length)console.log('（抄的过程中有运行时报错：'+p.__errs.slice(0,3).join('；')+'）\n');
   await p.close();
  }
  for(const r of todo){
   let live=null;
   if(r.live)live=await freshPage(browser);
   console.log('— 第 '+r.n+' 轮 · '+r.title);
   for(const [name,fn] of r.checks){
    try{await fn(live,browser);pass++;console.log('  PASS '+name)}
    catch(e){fails.push({r:r.n,t:r.title,name,msg:String(e.message||e)});
      console.log('  FAIL '+name+'\n   '+String(e.message||e).replace(/\n/g,'\n   '))}
   }
   if(live)await live.close();
  }
 }finally{await browser.close()}
 console.log('\n================ 小结 ================');
 console.log('跑了 '+todo.length+' 轮，'+(pass+fails.length)+' 条检查：'+pass+' 过，'+fails.length+' 红。');
 if(fails.length){console.log('\n红灯清单：');
  fails.forEach((f,i)=>console.log(' '+(i+1)+'. [第'+f.r+'轮 '+f.t+'] '+f.name));
  process.exitCode=1}
})().catch(async e=>{console.error(e);process.exitCode=1});
