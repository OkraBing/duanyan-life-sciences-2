// 路由：一句话该落到哪条能力
const fs=require('fs');const h=fs.readFileSync(process.argv[2],'utf8');
const src=[...h.matchAll(/<script(?![^>]*src=)[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]).join('\n');
const vm=require('vm');const ctx={window:{},document:{getElementById:()=>null,querySelector:()=>null,
  querySelectorAll:()=>[],addEventListener(){},body:{dataset:{}},createElement:()=>({style:{}})},
  location:{hash:''},localStorage:{getItem:()=>null,setItem(){},removeItem(){}},
  navigator:{},setTimeout(){},setInterval(){},clearTimeout(){},requestAnimationFrame(){},
  console,fetch:()=>Promise.reject(new Error('no net')),matchMedia:()=>({matches:false,addEventListener(){}})};
ctx.globalThis=ctx;ctx.self=ctx;vm.createContext(ctx);
try{vm.runInContext(src,ctx)}catch(e){}
const CASES=[
 ['给我设计一对引物','primer'],
 ['给这段模板设一对 PCR 引物','primer'],
 ['引物设计','primer'],
 ['在这段序列上选 sgRNA','sgrna'],
 ['帮我设计几条 sgRNA','sgrna'],
 ['设计一批 binder','des'],
 ['在这个界面上设计一批结合蛋白','des'],
 ['把这批候选送去测亲和力','lab'],
 ['排一下这批候选的实验','lab'],
 ['这批样品外包出去测 Kd','lab'],
 ['用这个项目的实测数据训一个打分模型','train'],
 ['微调一个回归模型','train'],
 ['上传一份数据建成数据集','dset'],
 ['把这张表做成训练集','dset'],
 ['比一下处理组和对照组哪些基因变了','deg'],
 ['画个火山图','deg'],
 ['检索和这条序列同源的条目','seek'],
 ['查一下 P12345','seek'],
 ['把这条序列折出来','str'],
 ['查一下 1BRS 的结构','str'],
 ['这个项目里都有哪些文件','file'],
];
let bad=0;
CASES.forEach(([t,want])=>{
  const r=ctx.routeIntent(t);
  const ok=r.cap===want;if(!ok)bad++;
  console.log((ok?'  ok  ':'  ✗   ')+t+'  →  '+(r.cap||'(模型)')+(ok?'':'   该是 '+want)
    +'   对象['+(r.obj||[]).join(',')+'] 动作['+(r.verb||[]).join(',')+']');
});
console.log(bad?'\n✗ '+bad+' 条判错':'\n✅ '+CASES.length+' 条全部判对');
process.exit(bad?1:0);
