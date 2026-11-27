/* Additive presentation fixtures. Synthetic measurements stay marked in data; no service runs. */
/* 示例记录的时间不能都取「现在」：一屏十几条写着同一分钟，一眼就是假的。
   这里按「离现在多少分钟」给每条记录一个固定的过去时刻，先后顺序和研究流程一致：
   取序列/建库 → 建数据集 → 训练 → 推理 → 实验 → 结论。 */
function seedStamp(minutesAgo){
 const d=new Date(Date.now()-Math.max(1,minutesAgo)*60000),z=n=>String(n).padStart(2,'0');
 return d.getFullYear()+'-'+z(d.getMonth()+1)+'-'+z(d.getDate())+' '+z(d.getHours())+':'+z(d.getMinutes());
}
/* 每个课题错开 2 小时，课题之间不会撞在同一分钟上 */
function seedBase(index){return 4320+index*120;}
const PROJECT_FIXTURE_SCHEMA=1;
function fixtureProfile(p){
 const enzyme=(p.fields||[]).includes('kcat')||/核酸酶/.test(p.name);
 const affinity=!enzyme&&(p.fields||[]).length===1&&(p.fields||[]).includes('kd');
 return enzyme?{target:'kcat_s⁻¹',label:'kcat',assays:['activity','stability'],template:'enzyme',reference:'1SNC',parent:'p3'}:
 affinity?{target:'kd_pM',label:'KD',assays:['affinity','stability'],template:'characterize',reference:'1BRS',parent:'p2'}:
 {target:'dTm_℃',label:'ΔTm',assays:['affinity','stability'],template:'characterize',reference:'1BRS',parent:'p1'};
}
function fixtureDataset(p,index,profile){
 const sequence=PRJ_WT[p.id]||PRJ_WT[profile.parent]||PRJ_WT.p1;
 const measurements=profile.label==='kcat'?['kcat_s⁻¹','km_μM','dTm_℃']:['dTm_℃','kd_pM'];
 const head=['variant','sequence','iptm','rmsd','expression',...measurements],rand=rng(4100+index);
 const lines=Array.from({length:48},(_,i)=>{const pos=(i*7+index*11)%sequence.length,to=AA20[(AA20.indexOf(sequence[pos])+1+i%19)%20],variantSequence=sequence.slice(0,pos)+to+sequence.slice(pos+1);const a=.65+rand()*.3,b=.5+rand()*1.3,c=.75+rand()*.5,noise=(rand()-.5)*.45,values={'dTm_℃':1.8+4*a-.6*b+.4*c+noise,'kd_pM':Math.max(.05,1.9-1.5*a+.15*b+noise*.2),'kcat_s⁻¹':2+6*a-.4*b+noise,'km_μM':50+15*b-10*a+noise};return ['P'+(index+1)+'-V'+String(i+1).padStart(3,'0'),variantSequence,a.toFixed(4),b.toFixed(4),c.toFixed(4),...measurements.map(k=>values[k].toFixed(4))].join(',');});
 const parsed=parseTable([head.join(','),...lines].join('\n'),'protein-measurements.csv');
 return {id:'DS-P'+(index+1)+'-001',pid:p.id,name:p.name+' · 候选表征数据',desc:'候选序列、表征特征与'+profile.label+' 测定值',src:'课题示例测定记录',file:'protein-measurements.csv',rows:parsed.rows,cols:parsed.cols,target:profile.target,feats:['iptm','rmsd','expression'],task:'回归',split:makeSplit(48,[.75,.125,.125],4100+index),ratio:[.75,.125,.125],seed:4100+index,fp:parsed.fp,version:'v1.0.0',st:'pub',at:seedStamp(seedBase(index)-180),pubAt:seedStamp(seedBase(index)-180),example:true,fixtureSchema:PROJECT_FIXTURE_SCHEMA};
}
function fixtureExperiment(p,index,status,dataset,profile){
 /* 四种状态的实验不是同一时刻建的：已出结论的最早，刚存的方案最新 */
 const mins=seedBase(index)-({conclusion:420,exception:700,normal:900,draft:1020}[status]||420);
 const at=seedStamp(mins),atDone=seedStamp(mins+30);
 const id='B-P'+(index+1)+'-'+({normal:'001',exception:'002',conclusion:'003',draft:'004'}[status]);
 const sampleIds=dataset.rows.slice(0,24).map((r,i)=>String(r.variant||r.id||id+'-S'+(i+1)));
 const median=key=>{const values=dataset.rows.slice(0,24).map(r=>+r[key]).filter(Number.isFinite).sort((a,b)=>a-b);return values.length?((values[(values.length-1)>>1]+values[values.length>>1])/2).toFixed(2):'—';};
 const conclusion=sampleIds.length+' 个样本完成复核，'+profile.label+' 中位值为 '+median(profile.target)+(profile.label==='kcat'?' s⁻¹':profile.label==='KD'?' pM':' ℃')+'；保留对照与重复性一致的候选，进入下一轮独立验证。';
 const steps=labPlan(profile.template,'parallel',profile.assays);const qc=steps.findIndex(s=>s.id==='qc');
 steps.forEach((s,i)=>{
  s.deviceSnapshot=rsClone(labDevice(s.deviceId)||{});s.contract=rsClone(labStage(s.stage));s.resource=s.stage==='review'?'':'LAB-'+(index+1)+'-'+s.stage.toUpperCase();s.sop='SOP-'+s.stage.toUpperCase()+'-V1';
  s.state=status==='conclusion'?'done':status==='draft'?'pending':status==='exception'?(i<qc?'done':i===qc?'exception':'pending'):(i<=qc?'done':profile.assays.includes(s.stage)?'running':'pending');
  s.result=s.state==='done'?(s.stage==='review'?conclusion:s.stage==='affinity'?'结合曲线与重复测量已复核，KD 中位值 '+median('kd_pM')+' pM。':s.stage==='stability'?'热转变曲线已复核，ΔTm 中位值 '+median('dTm_℃')+' ℃。':s.stage==='activity'?'活性测定完成，kcat 中位值 '+median('kcat_s⁻¹')+' s⁻¹；Km 中位值 '+median('km_μM')+' μM。':'样本与质控记录已复核，输入输出交接完整。'):s.state==='exception'?'样本浓度与交接清单不一致，已暂停后续表征，等待补测浓度。':s.state==='running'?'已完成样本装载，正在采集表征曲线。':'';
  s.evidence=['done','exception'].includes(s.state)?'ELN/'+id+'/'+s.id+'/v1':'';
 });
 const workflow={schema:1,source:'demo',phase:status==='draft'?'draft':'ready',template:profile.template,mode:'parallel',assays:profile.assays.slice(),sampleIds,sampleSource:dataset.id+' · '+dataset.name+' · v1',aliquot:'同一份样本清单，各表征分支使用独立分样，完成后汇总结果。',steps,conclusion:status==='conclusion'?{published:true,verdict:'支持假设',text:conclusion,evidence:'ELN/'+id+'/analysis-v1',by:'ZHANG',at:at}:null,events:[{at:atDone,by:'ZHANG',text:status==='conclusion'?'已复核表征结果并发布实验结论':status==='exception'?'质控异常，等待样本浓度复核':status==='draft'?'保存实验编排草稿':'前处理完成，进入并行表征'}]};
 const batch={id,pid:p.id,name:(profile.label==='kcat'?'酶活与稳定性表征':'亲和力与稳定性表征')+' · '+({normal:'第 2 批',exception:'质控复核',conclusion:'第 1 批',draft:'下一批方案'}[status]),resultRows:dataset.rows.slice(0,24).map(r=>rsClone(r)),resultCsv:[dataset.cols.map(c=>c.k).join(','),...dataset.rows.slice(0,24).map(r=>dataset.cols.map(c=>'"'+String(r[c.k]??'').replace(/"/g,'""')+'"').join(','))].join('\n'),round:p.rounds.slice(-1)[0]?.i||1,n:sampleIds.length,vendor:'蛋白实验平台',status:status==='conclusion'?'done':status==='draft'?'draft':'in_production',results:status==='conclusion'?'all':'none',ctx:{host:'大肠杆菌 E. coli',assay:profile.label==='kcat'?['酶活测定','nanoDSF']:['BLI','nanoDSF'],reps:'n = 3',buffer:profile.label==='kcat'?'Tris pH 8.0':'PBS pH 7.4 + 0.02% Tween-20',temp:profile.label==='kcat'?'37℃':'25℃'},log:[['draft',atDone],...(status==='conclusion'?[['done',at]]:[])],workflow,localLab:true,example:true,fixtureSchema:PROJECT_FIXTURE_SCHEMA,datasetId:dataset.id};
 return status==='exception'?labApplyExceptionExample(batch):batch;
}
function fixtureTraining(p,index,dataset,profile){
 const trained=dsTrain(dataset,{seed:dataset.seed});if(!trained.ok)throw new Error('示例训练数据不完整：'+p.name+' '+trained.why);
 const common={pid:p.id,target:dataset.target,ds:dataset.id,seed:dataset.seed,kind:'ds',base:BASE_MODELS[0].n,method:TRAIN_METHOD[0].n,upd:'—',src:dataset.id+' · '+dataset.name,example:true,fixtureSchema:PROJECT_FIXTURE_SCHEMA,at:seedStamp(seedBase(index)-300)};
 const done=Object.assign({},trained,common,verdictOf(trained),{id:'M-P'+(index+1)+'-001',name:profile.label+' 候选评分器',desc:'基于本课题固定数据版本的候选评分与留出集复核',st:'done',lib:true,ms:38+index*7,bl:trained.base});delete done.ok;delete done.base;done.base=common.base;
 const active=Object.assign({},common,{at:seedStamp(seedBase(index)-600),id:'M-P'+(index+1)+'-002',name:profile.label+' 评分器 · 交叉验证',desc:'以新回流数据复核特征与正则强度',st:'running',lib:false,pg:42,nTrain:trained.nTrain,nTest:trained.nTest,n:trained.n,stage:'数据标准化与交叉验证',why:'训练进行中，完成后生成可用模型',trainingLog:[['数据读取','完成'],['固定切分','完成'],['交叉验证','进行中'],['留出集评测','待开始']],w:[],rho:null,rmse:null});
 return [done,active];
}
function fixtureInference(p,index,dataset,model){
 const out=dataset.rows.map((row,i)=>{const x=[1,...model.featK.map(k=>+row[k])],pred=x.reduce((sum,v,k)=>sum+(k?(v-model.mu[k])/model.sg[k]:1)*model.w[k],0);return {i,ok:true,t:JSON.stringify({variant:row.variant||row.id||'S'+(i+1),target:model.target,prediction:+pred.toFixed(4),model:model.id}),ms:120+i*7,pt:0,ct:0,tries:1};});
 return {id:'I-P'+(index+1)+'-001',pid:p.id,name:p.name.replace(/[–\s]/g,'_')+'_候选预测',desc:'用 '+model.name+' 对本课题候选逐条评分',sid:'local-scoring',mdl:model.name,ds:dataset.id,col:(dataset.cols.find(c=>c.k==='sequence')||dataset.cols[0]).k,modelId:model.id,sys:'按候选记录返回结构化预测结果。',par:'{"temperature":0}',conc:4,tmo:60,retry:3,st:'done',at:seedStamp(seedBase(index)-360),ms:18400+index*1200,n:dataset.rows.length,out,example:true};
}
function fixtureTasks(p,index,profile,experiment){
 const count=CANDS(p.id).length||24;
 const names={seq:'参考序列与注释整理',str:'候选结构复核',func:'候选性质分析',des:'下一轮候选设计',wet:'实验样本交接'};
 return Object.entries(names).filter(([cap])=>!TASKS.some(t=>t.pid===p.id&&t.cap===cap)).map(([cap,name],j)=>({id:'T-P'+(index+1)+'-'+String(j+1).padStart(3,'0'),pid:p.id,r:p.rounds.slice(-1)[0]?.i||1,cap,n:name,st:'done',pg:100,at:seedStamp(seedBase(index)-60-j*25),in:p.name+' · 候选与表征数据',out:cap==='wet'?experiment.id+' · '+experiment.n+' 个样本':cap==='seq'?'1 条参考序列':cap==='des'?count+' 条候选序列':cap==='str'?count+' 条结构复核记录':count+' 条已复核记录',ref:profile.reference,took:'2 分 18 秒',params:cap==='wet'?[['批次',experiment.id],['样本数',String(experiment.n)]]:[['来源课题',p.name],['参考结构',profile.reference],[cap==='seq'?'参考序列数':'候选数',String(cap==='seq'?1:count)]],out2:[['已完成',cap==='seq'?'1 / 1':cap==='wet'?experiment.n+' / '+experiment.n:count+' / '+count],['来源','课题固定版本']],example:true}));
}
function restoreProjectFixtures(fixtures){
 for(const row of fixtures.projects){
  const p=rsProject(row.pid);if(!p)continue;
  if(p.id==='example-personal-review'&&!p.tcp&&!p.goal)p.goal='复核候选的亲和力、热稳定性与可开发性';
  PRJ_WT[p.id]=row.referenceSequence;p.referenceSequence=p.referenceSequence||row.referenceSequence;
  for(const [key,records] of [['dsets',row.datasets],['models',row.models]]){p[key]=p[key]||[];records.forEach(x=>{if(!p[key].some(y=>y.id===x.id))p[key].push(rsClone(x));});}
  for(const [target,records] of [[DB.cands,row.candidates],[TASKS,row.tasks],[BATCHES,row.experiments],[BJ(),row.inference]])records.forEach(x=>{if(!target.some(y=>y.id===x.id)){const saved=target===BATCHES?LS.get('lab_workflow_v1',{})?.batches?.find(b=>b.id===x.id&&b.localLab):null;target.push(rsClone(saved||x));}});
  const jobs=BJ();row.inference.forEach(x=>{const j=jobs.find(y=>y.id===x.id);if(j){if(!j.modelId)j.modelId=x.modelId;if(!j.pid)j.pid=x.pid;}});
  p.kb=p.kb||[];Object.entries(row.files).forEach(([name,body])=>{if(!p.kb.includes(name))p.kb.push(name);KBTEXT[p.id+'|'+name]=body;});
  p.tools=p.tools||[];['ProteinMPNN','Protenix','自主实验网络'].forEach(n=>{if(!p.tools.includes(n))p.tools.push(n);});
 }
}
async function upgradeProjectExceptionExamples(){
 const next=rsClone(RS.data);let templatesChanged=false,recordsChanged=false;
 for(const row of next.projectFixtures?.projects||[])for(const b of row.experiments||[]){if(labIsUntouchedExceptionExample(b)){labApplyExceptionExample(b);templatesChanged=true;}}
 for(const b of BATCHES){if(labIsUntouchedExceptionExample(b)){labApplyExceptionExample(b);recordsChanged=true;}}
 // Published shared assets are versioned snapshots and are deliberately not rewritten.
 if(templatesChanged)await rsSave(next);
 if(recordsChanged)labPersist();
}
async function seedProjectFixtures(){
 if(LS.get('examples_disabled',false))return;
 if(RS.data.projectFixtures?.schema===PROJECT_FIXTURE_SCHEMA){restoreProjectFixtures(RS.data.projectFixtures);await upgradeProjectExceptionExamples();return;}
 const fixtures={schema:PROJECT_FIXTURE_SCHEMA,projects:[],at:nowStamp()};
 DB.projects.filter(p=>(p.ownerId||'me')==='me').forEach((p,index)=>{
  const profile=fixtureProfile(p),referenceSequence=PRJ_WT[p.id]||PRJ_WT[profile.parent]||PRJ_WT.p1;PRJ_WT[p.id]=referenceSequence;
  const dataset=fixtureDataset(p,index,profile),models=fixtureTraining(p,index,dataset,profile);
  const candidates=CANDS(p.id).length?[]:CANDS(profile.parent).slice(0,24).map((c,i)=>{const row=dataset.rows[i],pos=[...referenceSequence].findIndex((aa,j)=>aa!==row.sequence[j]),m={dTm:+row['dTm_℃']};if(profile.label==='kcat'){m.kcat=+row['kcat_s⁻¹'];m.km=+row['km_μM'];}else m.kd=+row.kd_pM;return Object.assign(rsClone(c),{id:row.variant,pid:p.id,seq:row.sequence,mut:referenceSequence[pos]+(pos+1)+row.sequence[pos],newPos:pos+1,newFrom:referenceSequence[pos],newTo:row.sequence[pos],iptm:+row.iptm,rmsd:+row.rmsd,m,batch:null,firstRound:p.rounds.slice(-1)[0]?.i||1});});
  const experiments=['normal','exception','conclusion','draft'].filter(status=>!BATCHES.some(b=>b.pid===p.id&&labSummary(b).status===status)).map(status=>fixtureExperiment(p,index,status,dataset,profile));
  const sample=experiments.find(b=>b.workflow.phase!=='draft')||BATCHES.find(b=>b.pid===p.id);
  const tasks=fixtureTasks(p,index,profile,sample),inference=[fixtureInference(p,index,dataset,models[0])];
  const headers=dataset.cols.map(c=>c.k),files={[dataset.id+'_测定数据.csv']:[headers.join(','),...dataset.rows.map(r=>headers.map(k=>'"'+String(r[k]??'').replace(/"/g,'""')+'"').join(','))].join('\n'),[dataset.id+'_研究记录.md']:'# '+p.name+'\n\n目标：'+(goalText(p)||'复核候选性质与表征证据')+'\n\n数据集：'+dataset.id+'\n训练模型：'+models[0].id+'\n推理记录：'+inference[0].id+'\n\n实验按独立分样完成表征，依据质控结果复核结论。'};
  const row={pid:p.id,referenceSequence,datasets:[dataset],models,candidates,tasks,experiments,inference,files};fixtures.projects.push(row);restoreProjectFixtures({projects:[row]});
 });
 const next=rsClone(RS.data);next.projectFixtures=fixtures;
 for(const s of next.shared.filter(s=>['example-shared-owned','example-shared-joined'].includes(s.id))){
  const source=s.id==='example-shared-owned'?'p1':'p2',candidates=rsCandidates(source),prefix=s.id==='example-shared-owned'?'':'other-',map=new Map(candidates.map(a=>[a.id,prefix+a.id]));
  candidates.filter(a=>a.snapshot.example||a.snapshot.fixtureSchema||/^(?:DS|M|B|I)-P\d+-|^eval-M-P|^(?:samples|conclusion)-B-P/.test(String(a.sourceId))||a.kind==='knowledge'&&Object.hasOwn(fixtures.projects.find(p=>p.pid===source)?.files||{},a.name)).forEach(a=>{if(s.assets.some(x=>x.id===map.get(a.id)))return;const x=rsClone(a);x.id=map.get(a.id);x.contributor=s.owner;x.sourceProject=s.projectId;if(x.snapshot.pid)x.snapshot.pid=s.projectId;if(x.snapshot.modelAssetId)x.snapshot.modelAssetId=map.get(x.snapshot.modelAssetId)||x.snapshot.modelAssetId;if(x.snapshot.experimentAssetId)x.snapshot.experimentAssetId=map.get(x.snapshot.experimentAssetId)||x.snapshot.experimentAssetId;x.fingerprint=fp32(JSON.stringify(x.snapshot));s.assets.push(x);});
  const inputs=new Map();s.inputLinks=s.inputLinks||{};s.assets.filter(a=>a.kind==='experiment'&&a.snapshot.fixtureSchema===PROJECT_FIXTURE_SCHEMA).forEach(a=>{const samples=s.assets.find(x=>x.kind==='sampleSheet'&&x.snapshot.experimentAssetId===a.id);if(!samples)return;const key=a.snapshot.datasetId;if(!inputs.has(key))inputs.set(key,samples.id);s.inputLinks[a.id]=inputs.get(key);});
 }
 await rsSave(next);labPersist();bSave();
}
const fixtureOriginalCandidates=rsCandidates;
rsCandidates=function(pid){return fixtureOriginalCandidates(pid).map(a=>{
 const body=KBTEXT[pid+'|'+a.name];if(a.kind!=='knowledge'||!/^DS-P\d+-001_(?:测定数据\.csv|研究记录\.md)$/.test(a.name)||typeof body!=='string')return a;
 a.snapshot={name:a.name,metadataOnly:false,body};a.description='课题资料文件';a.fingerprint=fp32(JSON.stringify(a.snapshot));a.id='a-'+fp32([pid,a.kind,a.sourceId,a.version,a.fingerprint].join('|'));return a;
});};
const fixtureOriginalAssetBody=iterationAssetBody;
iterationAssetBody=function(s,a){if(a?.kind==='knowledge'&&a.snapshot?.body&&iterationAuthorized(s,a))return iterationPairs([['提供者',s.members.find(m=>m.id===a.contributor)?.name||'项目成员'],['共享版本',a.version]])+'<section class="asset-section"><h3>资料内容</h3><pre class="fixture-file-preview">'+esc(a.snapshot.body)+'</pre></section>';return fixtureOriginalAssetBody(s,a);};
const fixtureOriginalWorkspaceSeed=iterationSeedWorkspace;
iterationSeedWorkspace=async function(){await fixtureOriginalWorkspaceSeed();await seedProjectFixtures();};
/* Training snapshots have no holdout result until a completed model exists. */
const fixtureOriginalJobDrawer=jobDrawer;
jobDrawer=function(m){
 if(!m||!['queued','running'].includes(m.st))return fixtureOriginalJobDrawer(m);
 const st=TRAIN_ST[m.st];return drawer({title:m.name+'　'+m.id,close:'jobclose',chip:'<span class="chip '+st[1]+'">'+st[0]+'</span>',body:'<div class="col" style="gap:16px"><div class="t-sm">'+esc(m._pn||pnOf(m._pid||m.pid))+'</div><div class="krow"><span class="mut2">训练数据</span><span>'+dsLabel(m)+'</span></div><div class="krow"><span class="mut2">基础模型</span><span>'+esc(m.base)+'</span></div><div class="krow"><span class="mut2">训练方法</span><span>'+esc(m.method)+'</span></div><div class="krow"><span class="mut2">当前环节</span><strong>'+esc(m.stage||st[0])+'</strong></div><progress class="training-snapshot-progress" max="100" value="'+(m.pg||0)+'" aria-label="训练进度 '+(m.pg||0)+'%"></progress><span class="t-sm num">'+(m.pg||0)+'%</span><div class="lv-log">'+(m.trainingLog||[]).map(([name,state])=>'<p>'+esc(name)+' · '+esc(state)+'</p>').join('')+'</div><p class="t-sm mut2">训练完成后生成模型与留出集评测结果。</p></div>'});
};
