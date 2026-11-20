const {chromium}=require('../test-browser.cjs');
const NEED=['MC','MODELS','modelErr','dl','zip','crc32','reproModal','doExport','nowStamp',
 'parseSeq','parseBatch','parseRanges','fmtRanges','idType','fetchAcc','molRender','molStats','plddtCurve',
 'tpPool','RECENTS','pushRecent','toolPicker','nodeTools','nodePick','bandBars','seqTrack','loadStruct','pae','greet','detailPanel','fltApply','fltCount',
 'echoPanel','sitePanel','ctxPanel','batchPreview','famClash','estHours','estInk','plddtColor',
 'BUILTIN','DESIGN_MODELS','FOLD_MODELS','CFG','IN','VW','AD','ROLES','AUDIT','DIMS','PLDDT_BANDS','PLATE_DEF','plateOf','fixRound','msaOf','stateOf','fileFilter','fileKeep','filesNow','fileDelKind','fileDelWhy','fileKey','projPick','fileCard','fileIc','FICO','FEXT_K','MSA_DEF','PLATE_FMT','COMPO','LIB','FAIL_KINDS','EXP_STATUS','EXP_TYPES','RESULTS_STATUS','mapStatus','WET','plate','traceModal','ROUND_LABEL','deriveRound','MSA_MODES','msaPanel','roundTabs','RTABS','BATCHES','RETRAINS','RETRAIN_STATUS','OUR_CONTROLS','DISPOSITION','FAIL_REASON','inferFailure','aggregate','CLAIMS','evValid','bondWarn','modelMenu','advBox','fieldChip','archive','archOf','archCard','fnv1a','artReportMd','ARTS','artsOf','artCard','artConsumers','artSinks','artHandoff','feedNote','platesCsv','artDesignFasta','artVariantsCsv','FIELD_SINK','routePanel','litRows','UNIP','unipOffset','unipFeats','unipClash','nodeBy','agentsFor','FILES','dlLog','NAVNAME','fmtBytes','runPlan','histRun','tookMin','turnaround','batchLegs','batchSpanDays','batchAgeDays','wetBatch','wetETA','fmtDays','sysPlan','pipeBlock','pipeGate','runProv','plateCap','plateWells','repsNow','plateNote','capChip','fileChips','kdCensored','kdNum','kdCensoredCount','WT_KD_PM','addBack','backPush','backPrev','NAV_ROUTE','BACKNAME','BUILT_STRUCT','loadBuiltin','strModelBtn','strModelNote','advToggle','gateRate','dfPreviewN','dfModeN','dfN','dfWhy','dfModeName','desBaseN','desEst','dlReady','dlTitle','PREVIEW_HITS','FKIND','dressHead','pfParams','dfParams','dropped','needsOf','BACK_PARENT'];
(async()=>{const b=await chromium.launch();const p=await b.newPage();
const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto('file://'+process.argv[2]);await p.waitForTimeout(400);
const miss=await p.evaluate(ns=>ns.filter(n=>{try{return typeof eval(n)==='undefined'}catch(e){return true}}),NEED);
console.log(miss.length?'❌ 缺失符号: '+miss.join(', '):'✅ '+NEED.length+' 个符号齐全');
// 视图名单从 V 自己取，不写死——写死的那份停在 24 个，
// 而 V 里已经有 27 个，于是 files 页崩了一整轮都没人报（2026-11-13 实例）。
const views=await p.evaluate(()=>Object.keys(V));
const bad=[];
// 每个项目都要过一遍：只测默认项目会漏掉「别的项目没有某个字段」这类问题
// （2026-11-12 实例：p3 没有 tcp，轮次页崩，而只测 p1 的冒烟测试全绿）
const pids=await p.evaluate(()=>DB.projects.map(x=>x.id));
const rounds=await p.evaluate(()=>DB.projects.map(x=>x.rounds.map(r=>r.i)));
for(let i=0;i<pids.length;i++)for(const v of views){
  const r=await p.evaluate(([x,pid,rn])=>{try{S.pid=pid;S.round=rn;const h=V[x]();return h.length}
    catch(e){return 'THROW:'+e.message}},[v,pids[i],rounds[i][rounds[i].length-1]]);
  if(typeof r==='string')bad.push(pids[i]+'/'+v+' '+r);}
await p.evaluate(()=>{S.pid=DB.projects[0].id});
console.log(bad.length?'❌ 视图报错:\n'+bad.join('\n')
  :'✅ '+views.length+' 个视图 × '+pids.length+' 个项目全部可渲染');
console.log(errs.length?'❌ '+errs.join('|'):'✅ 无 JS 报错');
await b.close();})();
