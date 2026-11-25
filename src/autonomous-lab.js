/* Autonomous lab composer. Scientific design is editable; task snapshots are immutable.
 * No device connector is installed: creating a task never represents a hardware dispatch. */
const AL_PLAN_STEPS=['基本信息','研究设计','样品与质控','方法参数','预算与判定'];
const ALUI={tab:'protocol',planStep:0,node:'qc',edge:null,planScroll:0};
const AL_TEMPLATES={binding:{name:'蛋白结合与热稳定性表征',assays:['affinity','stability']},affinity:{name:'蛋白结合表征',assays:['affinity']},stability:{name:'蛋白热稳定性表征',assays:['stability']},enzyme:{name:'酶活性与热稳定性表征',assays:['activity','stability']}};
const AL_TITLES={receive:'样本接收与核验',expression:'蛋白表达',harvest:'菌体收集',lysis:'细胞破碎',clarify:'裂解液澄清',purify:'蛋白纯化',buffer:'换液与浓缩',qc:'样品质控',gate:'质控与余量放行',aliquot:'独立分样',affinity:'结合表征',stability:'热稳定性表征',activity:'酶活性表征',review:'数据校验与结果回流'};
const AL_DEFAULT_DEVICES={expression:'innova',harvest:'5810r',lysis:'q700',clarify:'5810r',purify:'akta25',qc:'nanodrop',aliquot:'flex',affinity:'octet',stability:'panta',activity:'synergy'};
const AL_METHOD_FIELDS={affinity:[['ligand','配体／靶标物料编号'],['range','分析物浓度梯度与单位'],['conditions','缓冲液、温度与结合／解离时间'],['controls','空白、参比与阳性对照'],['analysis','拟合模型、重复一致性与接受标准']],stability:[['range','起止温度、升温速率与单位'],['conditions','蛋白浓度、体积、缓冲液与耗材'],['controls','缓冲液空白与参考蛋白'],['analysis','Tm／聚集起始温度分析与接受标准']],activity:[['ligand','底物物料编号'],['range','底物与蛋白浓度梯度及单位'],['conditions','反应体积、温度、时间与检测波长'],['controls','无酶空白、失活与阳性对照'],['analysis','初速区间、归一化方法与接受标准']]};
const alClone=x=>JSON.parse(JSON.stringify(x));
function alForm(){return alNormalizeForm(labForm());}
function alNormalizeForm(f){
 if(!f.autonomous){Object.assign(f,{autonomous:true,designTemplate:f.assays.includes('activity')?'enzyme':f.assays.length===2?'binding':f.assays[0]==='affinity'?'affinity':'stability',origin:f.template==='full'?'construct':'purified',goal:f.desc||'',question:'',groups:'',batches:'',replicates:'',budget:f.aliquot||'',deadVolume:'',reserveVolume:'',plannedYield:'',criteria:'',sourceRef:f.sourceRef||'',materials:(f.samples||'').split(/[\s,，;；]+/).filter(Boolean).filter((id,i,a)=>a.indexOf(id)===i).map(id=>({id,role:'candidate',kind:f.template==='full'?'construct':'protein',batch:'',container:'',position:'',buffer:'',concentration:'',volume:''})),methods:Object.fromEntries((f.steps||[]).map(s=>[s.id,{deviceId:s.deviceId,sop:s.sop||'',resource:s.resource||'',conditions:''}])),transfers:{},version:1});}
 return f;
}
function alPlan(f){
 const upstream=f.origin==='construct'?['expression','harvest','lysis','clarify','purify','buffer']:[];
 const keys=['receive',...upstream,'qc','gate','aliquot',...f.assays,'review'];
 return keys.map((id,i)=>{
  const m=f.methods[id]||{},assay=f.assays.includes(id),after=id==='review'?f.assays.slice():assay?[f.mode==='serial'&&f.assays.indexOf(id)>0?f.assays[f.assays.indexOf(id)-1]:'aliquot']:i?[keys[i-1]]:[];
  return {id,stage:id,title:AL_TITLES[id],deviceId:m.deviceId||AL_DEFAULT_DEVICES[id]||'',resource:m.resource||'',sop:m.sop||'',after,inputFrom:id==='review'?f.assays.slice():assay?['aliquot']:i?[keys[i-1]]:['source'],state:'pending',attempt:1,history:[]};
 });
}
function alEdges(f){return alPlan(f).flatMap(s=>s.inputFrom.filter(k=>k!=='source').map(from=>({id:from+'__'+s.id,from,to:s.id,data:s.id==='review'})));}
function alErrors(f,draft=false){
 const e=[];const add=(area,text)=>e.push({area,text});
 if(!f.name.trim())add('name','填写实验名称');
 if(!DB.projects.some(p=>p.id===f.pid&&(p.ownerId||'me')==='me'))add('pid','选择可编辑的关联课题');
 if(draft)return e;
 if(!f.goal.trim())add('goal','填写实验目的');
 for(const [k,n] of [['question','研究问题'],['groups','实验组与对照组'],['budget','计划用量与余量安排'],['criteria','结果判定标准']])if(!f[k].trim())add(k,'填写'+n);
 for(const [k,n] of [['batches','独立实验批次'],['replicates','每批技术重复']])if(!Number.isInteger(+f[k])||+f[k]<1)add(k,n+'必须为正整数');
 if(!f.sourceRef.trim())add('samples','登记样本来源／交接清单版本');
 if(!f.materials.some(m=>m.role==='candidate'))add('samples','至少登记一个候选样本');
 for(const [key,label] of [['deadVolume','死体积与转运损耗'],['reserveVolume','留样量']])if(f[key]==null||f[key]===''||!Number.isFinite(+f[key])||+f[key]<0)add('budget',label+'须填写非负体积（µL）');
 if(f.origin==='construct'&&!(+f.plannedYield>0))add('budget','填写每个候选构建体的计划蛋白产出体积（µL），实际产量在执行时核验');
 const required=alRequiredVolume(f);
 const ids=new Set();
 f.materials.forEach((m,i)=>{if(!m.id.trim()||!m.batch.trim()||!m.container.trim()||!m.position.trim())add('samples','物料 '+(i+1)+'：补全编号、批次、容器与位置');if(ids.has(m.id.trim().toLowerCase()))add('samples','物料编号重复：'+m.id);ids.add(m.id.trim().toLowerCase());if(m.role==='candidate'&&m.kind!==(f.origin==='construct'?'construct':'protein'))add('samples','候选物料类型与实验起始材料不一致');if(m.role==='candidate'&&Number.isFinite(required)&&required>0&&+(f.origin==='construct'?f.plannedYield:m.volume)<required)add('budget','候选 '+(m.id||i+1)+' 的'+(f.origin==='construct'?'计划产量':'现有原液')+'不足：至少需要 '+required.toFixed(2)+' µL');if(m.kind==='protein'&&(!m.buffer.trim()||!(+m.concentration>0)||!(+m.volume>0)))add('samples','蛋白物料 '+(m.id||i+1)+'：填写现有浓度、体积和缓冲液');});
 const active=alPlan(f).filter(s=>!['gate','review'].includes(s.id));
 active.forEach(s=>{
  const m=f.methods[s.id]||{};
  if(!m.sop?.trim()||!m.conditions?.trim())add('methods',s.title+'：填写 SOP 版本和执行参数');
  const choices=alDeviceChoices(s.id);
  if(choices.length&&!choices.some(d=>d.id===(m.deviceId||AL_DEFAULT_DEVICES[s.id])))add('methods',s.title+'：选择适用的设备型号');
  if(s.id==='qc'&&(!m.purity?.trim()||!m.aggregation?.trim()||!m.analysis?.trim()))add('methods','质控：补全纯度、聚集状态检测方法和放行阈值');
  if(f.assays.includes(s.id)&&!(+m.volume>0))add('methods',s.title+'：填写单次完整梯度的原液耗用体积（µL）');
  if(f.assays.includes(s.id))for(const [key,label] of AL_METHOD_FIELDS[s.id])if(!m[key]?.trim())add('methods',s.title+'：填写'+label);
 });
 if(f.assays.includes('affinity')||f.assays.includes('activity')){
  const id=f.assays.includes('affinity')?'affinity':'activity',m=f.methods[id]||{};
  if(!f.materials.some(x=>x.id.trim()===m.ligand?.trim()&&x.role==='reagent'))add('samples',(id==='affinity'?'配体／靶标':'底物')+'编号须关联已登记的试剂物料');
 }
 const instanceIds=f.assays.map(a=>f.methods[a]?.resource?.trim().toLowerCase()).filter(Boolean);
 if(f.mode==='parallel'&&new Set(instanceIds).size<instanceIds.length)add('methods','并行分支不能锁定同一设备实例，请切换依次执行或更换实例');
 alEdges(f).filter(x=>!x.data).forEach(x=>{const t=f.transfers[x.id]||{};if(!alTransferConfigured(t))add('execution',AL_TITLES[x.from]+' → '+AL_TITLES[x.to]+'：补全容器、计划用量、转运操作与交接条件');});
 return e;
}
function alRequiredVolume(f){const quantities=f.assays.map(id=>+(f.methods[id]?.volume||0));if(quantities.some(v=>v<=0)||!(+f.batches>0)||!(+f.replicates>0))return NaN;return quantities.reduce((a,b)=>a+b,0)*(+f.batches)*(+f.replicates)+(+f.deadVolume||0)+(+f.reserveVolume||0);}
function alDeviceChoices(id){return LAB_DEVICES.filter(d=>d.stages.includes(id==='aliquot'?'prep':id));}
function alInput(key,label,value,placeholder='',type='text',attrs=''){
 return '<label class="al-field"><span>'+esc(label)+'</span><input class="input" type="'+type+'" data-al-field="'+key+'" value="'+esc(value??'')+'" placeholder="'+esc(placeholder)+'" '+attrs+'></label>';
}
function alText(key,label,value,placeholder=''){
 return '<label class="al-field"><span>'+esc(label)+'</span><textarea class="input" rows="2" data-al-field="'+key+'" placeholder="'+esc(placeholder)+'">'+esc(value??'')+'</textarea></label>';
}
function alSelect(key,label,value,options){return '<label class="al-field"><span>'+esc(label)+'</span><select class="input" data-al-field="'+key+'">'+options.map(([v,n])=>'<option value="'+esc(v)+'" '+(v===value?'selected':'')+'>'+esc(n)+'</option>').join('')+'</select></label>';}
function alCard(n,title,description,body,action=''){return '<section class="al-card"><header><div class="al-card-heading"><span class="al-number">'+n+'</span><div><h2>'+title+'</h2><p>'+description+'</p></div></div>'+action+'</header><div class="al-card-body">'+body+'</div></section>';}
function alBudgetSummary(f){const total=alRequiredVolume(f);return Number.isFinite(total)?'每个候选样本原液需求：'+total.toFixed(2)+' µL（各方法完整梯度耗量之和 × 每批技术重复 × 独立实验批次 ＋ 损耗 ＋ 留样）。实际浓度变化或稀释方案改变时须重新核算。':'配置各方法的原液耗量、批次与技术重复后计算计划原液需求。';}
function alProtocol(f,readonly=false){
 const prep=f.origin==='construct'?'构建体接收 → 蛋白表达 → 菌体收集 → 细胞破碎 → 澄清 → 纯化 → 换液浓缩':'纯化蛋白接收 → 核验浓度、体积、缓冲体系与储存条件';
 return [
 alCard('02','研究问题与实验设计','先明确要回答的问题，再选择验证方法。','<div class="al-grid">'+alText('question','研究问题 *',f.question,'例如：候选蛋白是否具备预期结合能力与热稳定性？')+alText('groups','分组与对照 *',f.groups,'登记候选组、参考蛋白、空白与阳性对照')+alInput('batches','独立实验批次 *',f.batches,'', 'number','min="1" step="1"')+alInput('replicates','每批技术重复 *',f.replicates,'','number','min="1" step="1"')+'</div><p class="al-help">技术重复用于评估同批测量一致性；独立批次用于评估实验可重复性。</p>'),
 alCard('03','样品制备与质控','起始材料决定上游制备流程。','<div class="al-process">'+prep+' → 样品质控</div><div class="al-note">浓度由定量方法测定；纯度与聚集状态分别检测。NanoDrop 不用于判断纯度或单分散性。构建体路线先登记计划用量，产物实际浓度和余量在分样放行前核验。</div>'+alPlanShortcuts(f), '<button class="btn" data-al-panel="samples">样本与物料 · '+f.materials.length+'</button>'),
 alCard('04','实验方法与参数','模板提供方法建议；SOP、对照和接受标准需要明确配置。','<div class="al-method-cards">'+f.assays.map(id=>{const m=f.methods[id]||{},did=m.deviceId||AL_DEFAULT_DEVICES[id];return '<div><span class="al-eyebrow">'+(id==='affinity'?(did==='biacore'?'SPR':'BLI'):id==='stability'?'nanoDSF':'活性检测')+'</span><h3>'+AL_TITLES[id]+'</h3><p>'+esc(labDevice(did)?.model||'待选择设备')+'</p><small>'+esc(m.sop||'SOP 与参数待配置')+'</small></div>';}).join('')+'</div><p class="al-help">各分支使用独立分样；并行执行仍受共享设备、转运能力和耗材约束。</p>','<button class="btn" data-al-panel="methods">'+(readonly?'查看方法与设备':'配置方法与设备')+'</button>'),
 alCard('05','样品预算与结果判定','以计划量校验可行性，以执行时实测量决定能否放行。','<div class="al-grid">'+alText('budget','计划用量与余量说明 *',f.budget,'说明对照、稀释、耗样与留样安排；梯度耗量计入各方法配置')+alText('criteria','结果判定标准 *',f.criteria,'明确质控、重复一致性、拟合质量及关键指标的接受条件')+alInput('deadVolume','每个候选样本：死体积与转运损耗（µL） *',f.deadVolume,'', 'number','min="0" step="any"')+alInput('reserveVolume','每个候选样本：留样量（µL） *',f.reserveVolume,'','number','min="0" step="any"')+(f.origin==='construct'?alInput('plannedYield','每个候选构建体：计划蛋白产出（µL） *',f.plannedYield,'计划值，实际产量待制备后核验','number','min="0" step="any"'):'')+'</div><p class="al-help" data-al-budget>'+alBudgetSummary(f)+'</p>')
 ];
}
function alOriginField(f){
 return '<div class="al-origin-field"><span>起始材料 *</span>'+'<fieldset class="al-origin"><legend class="sr">起始材料</legend>'+[['purified','已有纯化蛋白','直接质控与表征'],['construct','表达构建体','胞内可溶蛋白制备流程']].map(([v,n,d])=>'<label class="'+(f.origin===v?'is-on':'')+'"><input type="radio" name="al-origin" data-al-origin="'+v+'" '+(f.origin===v?'checked':'')+'><span><strong>'+n+'</strong><small>'+d+'</small></span></label>').join('')+'</fieldset>'+'</div>';
}
function alQcTransfer(f){
 return alEdges(f).find(edge=>edge.to==='qc');
}
function alPlanShortcuts(f){
 const transfer=alQcTransfer(f);
 return `<div class="al-plan-shortcuts">
  <button class="btn" type="button" data-al-focus-node="qc" aria-controls="al-flow-preview">查看质控节点 →</button>
  ${transfer?`<button class="btn" type="button" data-al-focus-edge="${transfer.id}" aria-controls="al-flow-preview">查看样品交接 →</button>`:''}
 </div>`;
}
function alTransferConfigured(transfer){
 return ['fromContainer','toContainer','amount','operation','conditions'].every(key=>transfer?.[key]?.trim());
}
function alTransferAction(id,readonly){
 return `<button class="btn" type="button" data-al-transfer="${id}">${readonly?'查看交接配置':'配置样品交接'}</button>`;
}
function alMethodAction(id,readonly){
 const label=id==='qc'?'质控方法':'方法与设备';
 return `<button class="btn" type="button" data-al-panel="methods" data-al-method-target="${id}">${readonly?'查看':'配置'}${label}</button>`;
}
function alFlowPreview(f,readonly,legacy){
 const transfer=alQcTransfer(f),qc=f.methods.qc||{};
 const qcDevice=f.deviceSnapshots?.qc?.id||qc.deviceId||AL_DEFAULT_DEVICES.qc;
 const qcModel=f.deviceSnapshots?.qc?.model||labDevice(qcDevice)?.model;
 const transferConfig=transfer?f.transfers[transfer.id]:null;
 const nodeSelected=!ALUI.edge&&ALUI.node==='qc';
 const edgeSelected=!!transfer&&ALUI.edge===transfer.id;
 const qcNeedsConfig=!qc.resource?.trim()||!qc.sop?.trim()||!qc.conditions?.trim()||
  !qc.purity?.trim()||!qc.aggregation?.trim()||!qc.analysis?.trim();
 const qcStatus=!qc.resource?.trim()?'设备待匹配':qcNeedsConfig?'方法待补全':'实例待核验';
 const transferNeedsConfig=!!transfer&&!alTransferConfigured(transferConfig);
 const pending=Number(qcNeedsConfig)+Number(transferNeedsConfig);
 const construction=f.origin==='construct';
 const route=construction?'接收构建体 → 表达与纯化 → 换液浓缩':'接收纯化蛋白 → 核验材料与缓冲体系';
 const label=construction?'蛋白母液 → 质控取样':'接收样品 → 质控取样';
 return `<aside class="al-flow-preview" id="al-flow-preview" aria-labelledby="al-flow-title">
  <header>
   <h2 id="al-flow-title">执行编排</h2>
   <p>${legacy?'历史方案摘要':(readonly?'已保存方案':'流程预览')+(pending?' · '+pending+' 项重点待处理':' · 设备与资源待核验')}</p>
  </header>
  <div class="al-flow-stage"><strong>样品制备</strong><p data-al-preview-route>${route}</p></div>
  ${transfer?`<button type="button" class="al-flow-pick" data-al-focus-edge="${transfer.id}" aria-pressed="${edgeSelected}"><strong>${label}</strong><span>${transferNeedsConfig?'交接待配置':'交接已登记'} →</span></button>`:''}
  ${edgeSelected?`<div class="al-flow-selection" data-al-preview-selection="edge" role="status">
   <strong>样品交接详情</strong>
   <p>${esc(transferConfig?.fromContainer||'来源容器待配置')} → ${esc(transferConfig?.toContainer||'目标容器待配置')}</p>
   <p>计划用量 · ${esc(transferConfig?.amount||'待填写')}</p>
   ${alTransferAction(transfer.id,readonly)}
  </div>`:''}
  <button type="button" class="al-flow-pick" data-al-focus-node="qc" aria-pressed="${nodeSelected}"><strong>样品质控</strong><span>${qcStatus} →</span></button>
  ${nodeSelected?`<div class="al-flow-selection" data-al-preview-selection="node" role="status">
   <strong>样品质控 · 设备详情</strong>
   <div class="al-flow-device">
    <div class="al-flow-device-image">${alImage(qcDevice)}</div>
    <div><small>定量参考设备</small><p>${esc(qcModel||'待选择参考设备')}</p></div>
   </div>
   <p>设备实例 · ${esc(qc.resource||'待匹配')}<br>方法版本 · ${esc(qc.sop||'待配置')}</p>
   ${alMethodAction('qc',readonly)}
  </div>`:''}
  <div class="al-flow-stage"><strong>独立分样</strong><p>${f.assays.map(id=>AL_TITLES[id]).join(' / ')}</p>
   <p>${f.assays.length>1?(f.mode==='serial'?'各分支依次执行':'资源允许时并行')+'，结果汇总后回流':'表征结果校验后回流'}</p>
  </div>
  <button class="btn" type="button" data-al-view="execution">${legacy?'查看历史执行编排':'展开完整编排'} →</button>
 </aside>`;
}
function alImage(id){const p=DEVICE_PHOTOS[id];return p?devicePhotoImg(id,'',64,64):'<span class="al-capability">'+(id?'待匹配能力':'流程节点')+'</span>';}
function alGraph(f,readonly=false){
 const steps=alPlan(f),positions={},construct=f.origin==='construct',branchesY=construct?534:330;
 if(construct){['receive','expression','harvest','lysis','clarify','purify'].forEach((k,i)=>positions[k]=[18+i*175,48]);['buffer','qc','gate','aliquot'].forEach((k,i)=>positions[k]=[893-i*225,288]);}
 else ['receive','qc','gate','aliquot'].forEach((k,i)=>positions[k]=[18+i*225,65]);
 f.assays.forEach((k,i)=>positions[k]=[160+i*260,branchesY]);positions.review=[893,branchesY];
 const edges=alEdges(f),height=branchesY+220;
 const edgeButtons=[];
 const paths=edges.map(e=>{
  const [x,y]=positions[e.from],[a,b]=positions[e.to];let d;
  if(e.data){d='M'+(x+75)+' '+(y+130)+' V'+(height-30)+' H'+(a+75)+' V'+(b+130);}
  else if(y===b){const right=a>x;d='M'+(x+(right?150:0))+' '+(y+65)+' H'+(a+(right?0:150));}
  else d='M'+(x+75)+' '+(y+130)+' V'+(b-38)+' H'+(a+75)+' V'+b;
  const bx=(x+a)/2+75,by=e.data?height-30:y===b?y+65:x===a?(y+130+b)/2:b-38;
  edgeButtons.push('<button type="button" class="al-transfer-link '+(e.data?'is-data ':'')+(ALUI.edge===e.id?'is-selected':'')+'" style="left:'+(bx-14)+'px;top:'+(by-10)+'px" aria-label="'+esc((e.data?'数据依赖：':'样品交接：')+AL_TITLES[e.from]+'到'+AL_TITLES[e.to])+'" title="'+esc(AL_TITLES[e.from]+' → '+AL_TITLES[e.to])+'" data-al-edge="'+e.id+'">'+(e.data?'数':'转')+'</button>');
  return '<g class="al-edge '+(e.data?'is-data ':'')+(ALUI.edge===e.id?'is-selected':'')+'"><path d="'+d+'" marker-end="url(#al-arrow)"/></g>';
 }).join('');
 return '<div class="al-canvas-scroll"><div class="al-canvas" style="height:'+height+'px"><div class="al-canvas-label">'+(construct?'胞内可溶蛋白 · 制备与表征':'纯化蛋白 · 质控与表征')+'</div><svg class="al-connections" viewBox="0 0 1065 '+height+'" aria-label="样品流与数据依赖"><defs><marker id="al-arrow" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto-start-reverse"><path d="M0 0L7 3.5L0 7" fill="#8a9caf"/></marker></defs>'+paths+'</svg>'+steps.map(s=>{
 const [x,y]=positions[s.id],selected=!ALUI.edge&&ALUI.node===s.id;return '<button class="al-node '+(selected?'is-selected':'')+'" data-al-node="'+s.id+'" aria-pressed="'+selected+'" style="left:'+x+'px;top:'+y+'px"><strong>'+s.title+'</strong>'+alImage(s.deviceId)+'<small>'+esc(f.deviceSnapshots?.[s.id]?.model||labDevice(s.deviceId)?.model||({receive:'物料核验',buffer:'换液／浓缩能力待匹配',gate:'QC 合格且实际余量足够',review:'文件、质控与样本关联校验'}[s.id]||'样品与容器交接'))+'</small></button>';
 }).join('')+edgeButtons.join('')+'</div></div><div class="al-legend"><span>— 实体样品交接</span><span>┄ 数据依赖</span><span>放行失败：隔离受影响样本，暂停下游，保留证据。</span></div>';
}
function alInspector(f,readonly=false){
 const edge=alEdges(f).find(e=>e.id===ALUI.edge),s=alPlan(f).find(s=>s.id===ALUI.node)||alPlan(f)[0];
 if(edge){const t=f.transfers[edge.id]||{};return '<aside class="al-inspector"><span class="al-eyebrow">'+(edge.data?'数据依赖':'样品交接')+'</span><h2>'+AL_TITLES[edge.from]+' → '+AL_TITLES[edge.to]+'</h2>'+(edge.data?'<div class="al-note">传递原始数据、分析版本与质控结果。与样本／批次关联后校验完整性，不转运实体样品。</div>':'<p>登记计划交接。实际条码、位置、体积与签收结果在执行时核验。</p><dl>'+[['来源容器／位置',t.fromContainer],['目标容器／位置',t.toContainer],['计划用量与单位',t.amount],['转运／装载方式',t.operation],['交接与温控条件',t.conditions]].map(([n,v])=>'<div><dt>'+n+'</dt><dd>'+esc(v||'待配置')+'</dd></div>').join('')+'</dl>'+alTransferAction(edge.id,readonly))+'<div class="al-note">执行时锁定设备、容器与转运资源；核验样本／批次／条码及板位，收到完成回执后释放锁。耗样、不可逆或结果不明的动作暂停排查，不自动重试。</div></aside>';}
 const m=f.methods[s.id]||{};
 return '<aside class="al-inspector"><span class="al-eyebrow">节点配置 · '+(readonly?'任务快照':'设计中')+'</span><h2>'+s.title+'</h2><div class="al-inspector-image">'+alImage(s.deviceId)+'</div><dl>'+[['设备／执行能力',f.deviceSnapshots?.[s.id]?.model||labDevice(s.deviceId)?.model||'按 SOP 匹配执行能力'],['SOP／规则版本',m.sop||(['gate','review'].includes(s.id)?'系统规则；等待接入':'待配置')],['设备实例',m.resource||'创建后等待匹配，未验证在线状态'],['前置依赖',s.after.map(k=>AL_TITLES[k]).join('、')||'样本接收'],['样品来源',s.inputFrom.map(k=>AL_TITLES[k]||'已登记物料').join('、')]].map(([n,v])=>'<div><dt>'+n+'</dt><dd>'+esc(v)+'</dd></div>').join('')+'</dl>'+(!['gate','review'].includes(s.id)?alMethodAction(s.id,readonly):'')+'<div class="al-note">'+(s.id==='gate'?'先核验质量标准、实际浓度和可用体积；满足各分支耗样、死体积及留样量后再放行。':s.id==='qc'?'NanoDrop 仅用于定量。纯度与聚集检测按独立方法执行并记录证据。':'实体样品移动与数据完成状态分别确认。前置未完成时不启动后续任务。')+'</div></aside>';
}
function alExecution(f,readonly=false){return '<section class="al-execution"><header><div><h2>执行编排 <span class="al-tag">由实验方案生成</span></h2><p>点击节点查看方法与设备；点击连线配置交接。设备图为参考型号，接入状态待核验。</p></div>'+alReadMode(alSelect('mode','表征执行关系',f.mode,[['parallel','资源允许时并行'],['serial','依次执行']]),readonly)+'</header><div class="al-execution-layout"><div>'+alGraph(f,readonly)+'</div>'+alInspector(f,readonly)+'</div>'+(f.mode==='serial'?'<div class="al-note">调度依赖：'+f.assays.map(a=>AL_TITLES[a]).join(' → ')+'。各方法仍使用独立分样；图中连线表示实体样品和数据来源。</div>':'')+'</section>';}
function alReadMode(html,readonly){
 if(!readonly)return html;
 const template=document.createElement('template');
 template.innerHTML=html;
 template.content.querySelectorAll('[data-al-field]').forEach(control=>{
  const value=control.tagName==='SELECT'?(control.value?control.selectedOptions[0]?.textContent:''):control.value;
  const output=document.createElement('span');
  output.className='al-field-value';
  output.dataset.alField=control.dataset.alField;
  output.textContent=value||'未填写';if(!value)output.classList.add('is-empty');
  control.replaceWith(output);
 });
 template.content.querySelectorAll('[data-al-origin]').forEach(radio=>radio.disabled=true);
 template.content.querySelectorAll('[data-al-add],[data-al-remove]').forEach(button=>button.remove());
 return template.innerHTML;
}
function alPlanSteps(f,basic,readonly){
 const current=ALUI.planStep;
 const sections=[basic,...alProtocol(f,readonly)];
 const navigation=AL_PLAN_STEPS.map((label,index)=>`<li>
  <button type="button" class="al-plan-step" data-al-plan-step="${index}" ${index===current?'aria-current="step"':''}>
   <span>${index+1}</span>${label}
  </button>
 </li>`).join('');
 return `<nav class="al-plan-progress" aria-label="实验方案步骤">
  <div class="al-plan-progress-title"><h2>实验方案</h2><span role="status">第 ${current+1} 步，共 ${sections.length} 步</span></div>
  <ol>${navigation}</ol>
 </nav>
 <div class="al-plan-body">${alReadMode(sections[current],readonly)}</div>
 <div class="al-plan-actions">
  <button class="btn" type="button" data-al-plan-step="${current-1}" ${current===0?'disabled title="已是第一步"':''}>上一步</button>
  ${current<sections.length-1?`<button class="btn" type="button" data-al-plan-step="${current+1}">下一步</button>`:
  readonly?'':'<button class="btn btn-pri" type="button" data-al-panel="preflight">预检并创建任务</button>'}
 </div>`;
}
function alNavigatePlanStep(index){
 if(!Number.isInteger(index)||index<0||index>=AL_PLAN_STEPS.length)return;
 ALUI.tab='protocol';
 ALUI.planStep=index;
 const keepY=view.scrollTop;render();
  /* 切环节不挪视线：步骤条还在屏内就保持原滚动位置；被滚出去了才把它带回来，并在上方留 16px */
  const progress=view.querySelector('.al-plan-progress');view.scrollTop=keepY;
  if(progress){const top=progress.getBoundingClientRect().top-view.getBoundingClientRect().top;if(top<0||top>view.clientHeight-120)view.scrollTop+=top-16;}
 progress?.querySelector('[aria-current=step]')?.focus({preventScroll:true});
}
function alComposerContent(f,readonly=false,legacyExecution=''){
 const basic='<section class="al-card al-basic"><header><div><h2>实验基本信息</h2><p>保存与追踪实验所需的基本信息</p></div></header><div class="al-card-body al-grid">'+alInput('name','实验名称 *',f.name,'例如：候选蛋白结合与热稳定性表征')+alSelect('pid','关联课题 *',f.pid,[['','请选择课题'],...DB.projects.filter(p=>(p.ownerId||'me')==='me').map(p=>[p.id,p.name])])+alInput('goal','实验目的 *',f.goal,'说明实验要验证的目标')+alSelect('designTemplate','实验模板',f.designTemplate,Object.entries(AL_TEMPLATES).map(([k,t])=>[k,t.name]))+alText('desc','补充说明（选填）',f.desc,'补充实验背景或注意事项')+alOriginField(f)+'</div></section>';
 const errors=!readonly&&LABUI.errors?.al;
 if(ALUI.tab==='execution'){
  return `<div class="al-full-flow">
   <div class="al-full-flow-bar"><button class="btn" type="button" data-al-view="protocol">← 返回实验方案</button></div>
   ${legacyExecution||alExecution(f,readonly)}
  </div>`;
 }
 return `<div class="al-workspace">
  <div class="al-plan-column">
   ${errors?`<div class="al-error" role="alert">${esc(errors)}</div>`:''}
   ${alPlanSteps(f,basic,readonly)}
  </div>
  ${alFlowPreview(f,readonly,Boolean(legacyExecution))}
 </div>`;
}
V.labnew=()=>{
 const f=alForm(),errors=alErrors(f),disabled=can('edit')?'':'disabled';
 const saveStatus=f.dirty?'有未保存的修改':f.savedAt?'本机已保存 '+f.savedAt:'还没保存';
 return `<div class="page al-page">
  <header class="al-page-head">
   <div><button class="rs-link" data-go="lab">← 实验管理</button><h1>设计实验</h1><p>明确实验方案，系统生成执行编排，预检后创建任务。</p></div>
   <div class="rs-actions"><span class="al-save-status">${esc(saveStatus)}</span><button class="btn" data-al-save="draft" ${disabled}>保存草稿</button><button class="btn btn-pri" data-al-panel="preflight" ${disabled}>预检并创建任务</button></div>
  </header>
  ${alComposerContent(f)}
  <footer class="al-footer"><span data-al-validation>${errors.length?'方案配置尚有 '+errors.length+' 项待补全':'方案配置完整，设备与调度待核验'}</span><button class="btn" data-al-panel="preflight">查看预检项</button></footer>
 </div>`;
};
function alDialog(title,body,onSave,button='保存配置'){
 const readonly=!onSave;
 modal(title,'<div class="al-dialog">'+alReadMode(body,readonly)+'</div>',readonly?'关闭':button,onSave);
 const d=document.getElementById('dlg');d.classList.add('al-modal');if(readonly)d.querySelector('button[value=cancel]')?.remove();d.addEventListener('close',()=>d.classList.remove('al-modal'),{once:true});
}
function alCollect(root){const o={};root.querySelectorAll('[data-al-field]').forEach(el=>o[el.dataset.alField]=el.value.trim());return o;}
function alSamplePanel(f,readonly=false){
 const rows=alClone(f.materials);let source=f.sourceRef;
 const show=()=>{
 const body='<p>候选样本与实验起始材料保持一致；参考蛋白、配体／底物可单独登记。浓度单位 mg/mL，体积单位 µL。</p>'+alInput('sourceRef','来源／交接清单与版本 *',source,'例如：样本交接清单 v1')+'<div class="al-materials">'+rows.map((m,i)=>'<fieldset data-al-material="'+i+'"><legend>物料 '+(i+1)+'</legend><div class="al-grid">'+alInput('id','编号 *',m.id)+alSelect('role','用途',m.role,[['candidate','候选样本'],['reference','参考／对照'],['reagent','配体／底物／试剂']])+alSelect('kind','物料类型',m.kind,[['construct','表达构建体'],['protein','蛋白'],['reagent','其他试剂']])+alInput('batch','批次／版本 *',m.batch)+alInput('container','容器／条码 *',m.container)+alInput('position','位置／板位 *',m.position)+(m.kind==='protein'?alInput('concentration','现有浓度（mg/mL） *',m.concentration,'','number','min="0" step="any"')+alInput('volume','现有可用体积（µL） *',m.volume,'','number','min="0" step="any"')+alInput('buffer','缓冲体系 *',m.buffer):'')+'</div><button class="btn" type="button" data-al-remove="'+i+'">移除物料</button></fieldset>').join('')+'</div><button class="btn" type="button" data-al-add>＋ 添加物料</button><div class="al-note">构建体输入时，制备产量是计划值。实际蛋白浓度、体积及质控证据在执行放行前确认。</div>';
 alDialog('样本与物料',body,readonly?null:()=>{collect();if(!can('edit'))return false;f.sourceRef=source;f.materials=rows;f.dirty=true;render();return true;});
 if(readonly)return;
 const d=document.getElementById('dlg');
 const collect=()=>{source=d.querySelector('[data-al-field="sourceRef"]').value.trim();d.querySelectorAll('[data-al-material]').forEach(el=>Object.assign(rows[+el.dataset.alMaterial],alCollect(el)));};
 d.querySelector('[data-al-add]').onclick=()=>{collect();rows.push({id:'',role:rows.some(x=>x.role==='candidate')?'reagent':'candidate',kind:rows.some(x=>x.role==='candidate')?'reagent':f.origin==='construct'?'construct':'protein',batch:'',container:'',position:'',concentration:'',volume:'',buffer:''});show();};
 d.querySelectorAll('[data-al-remove]').forEach(el=>el.onclick=()=>{collect();rows.splice(+el.dataset.alRemove,1);show();});
 d.querySelectorAll('[data-al-field="kind"]').forEach(el=>el.addEventListener('change',()=>{collect();show();}));
 };show();
}
function alMethodFields(f,stage,values){
 const choices=alDeviceChoices(stage.id);
 const device=(choices.length?alSelect('deviceId','参考设备型号',values.deviceId||AL_DEFAULT_DEVICES[stage.id],choices.map(item=>[item.id,item.model])):'')+'<p class="al-help ce-dev">没有合适的设备？<a class="lv-link" href="#devices" target="_blank" rel="noopener">管理设备</a>（新标签页打开，正在填的方案不受影响）</p>';
 const controls=stage.id==='qc'?
  alInput('purity','纯度检测方法与 SOP *',values.purity)+
  alInput('aggregation','聚集状态检测方法与 SOP *',values.aggregation)+
  alText('analysis','质控接受阈值 *',values.analysis):
  f.assays.includes(stage.id)?
   alInput('volume','单次完整梯度原液耗用量（µL） *',values.volume,'按每个候选填写','number','min="0" step="any"')+
   AL_METHOD_FIELDS[stage.id].filter(([key])=>key!=='conditions').map(([key,label])=>alText(key,label+' *',values[key])).join(''):'';
 return device+alInput('resource','期望设备实例（选填）',values.resource,'未指定时等待系统匹配')+
  alInput('sop','SOP／方法版本 *',values.sop,'填写实际采用的版本')+
  alText('conditions','执行参数与条件 *',values.conditions)+controls;
}
function alMethodPanel(f,readonly=false,target){
 const methods=alClone(f.methods);
 const stages=alPlan(f).filter(stage=>!['gate','review'].includes(stage.id));
 let stage=stages.find(item=>item.id===target)||stages[0];
 const collect=()=>{
  if(!readonly)methods[stage.id]={...methods[stage.id],...alCollect(host.querySelector('[data-al-method]'))};
 };
 alDialog('方法与设备配置','<div class="al-config-fields" data-al-method-form></div>',readonly?null:()=>{
  if(!can('edit'))return false;
  collect();
  f.methods=methods;
  f.dirty=true;
  render();
  return true;
 });
 const host=document.querySelector('#dlg [data-al-method-form]');
 function paint(){
  host.innerHTML=alSelect('stage','实验环节',stage.id,stages.map(item=>[item.id,item.title]))+
   `<div class="al-config-fields" data-al-method="${stage.id}">${alReadMode(alMethodFields(f,stage,methods[stage.id]||{}),readonly)}</div>`;
  dressSelects(host);
  const chooser=host.querySelector('[data-al-field=stage]');
  chooser.addEventListener('change',()=>{
   collect();
   stage=stages.find(item=>item.id===chooser.value)||stage;
   paint();
   host.querySelector('.ctl-dd')?.focus({preventScroll:true});
  });
 }
 paint();
 host.querySelector('.ctl-dd')?.focus({preventScroll:true});
}
function alTransferPanel(id,f,readonly=false){
 const edge=alEdges(f).find(item=>item.id===id);
 if(!edge||edge.data)return;
 const transfer=f.transfers[id]||{};
 const fields=alInput('fromContainer','来源容器与位置 *',transfer.fromContainer)+
  alInput('toContainer','目标容器与位置 *',transfer.toContainer)+
  alInput('amount','计划用量与单位／SOP 计算规则 *',transfer.amount,'如：每样本 20 µL；或 SOP 计算规则')+
  alInput('operation','转运／装载方式与执行能力 *',transfer.operation)+
  alText('conditions','温控、完成条件与回执要求 *',transfer.conditions);
 alDialog(AL_TITLES[edge.from]+' → '+AL_TITLES[edge.to],
  `<div class="al-config-fields" data-al-transfer-form>${fields}</div><p class="al-note">样本身份不匹配、资源锁失败或动作结果不明时停止下游并隔离样本。</p>`,
  readonly?null:()=>{
   if(!can('edit'))return false;
   f.transfers[id]=alCollect(document.querySelector('#dlg [data-al-transfer-form]'));
   f.dirty=true;
   render();
   return true;
  });
}
function alPreflight(){
 const f=alForm(),errors=alErrors(f),areas=[...new Set(errors.map(e=>e.area))];
 alDialog('创建任务前预检','<div class="al-preflight-state '+(errors.length?'is-incomplete':'')+'"><strong>'+(errors.length?'方案配置待补全':'方案配置完整 · 等待设备与资源就绪')+'</strong><p>'+(errors.length?'请先完成以下 '+errors.length+' 项配置，再创建任务。':'可创建本机任务并保留方案快照。当前不会下发任何设备指令。')+'</p></div>'+(errors.length?'<ul class="al-checks">'+errors.map(e=>'<li>'+esc(e.text)+'</li>').join('')+'</ul><div class="rs-actions">'+areas.map(a=>'<button type="button" class="btn" data-al-fix="'+a+'">'+({samples:'样本与物料',methods:'方法与设备',execution:'交接配置'}[a]||'基本信息与实验方案')+'</button>').join('')+'</div>':'')+'<div class="al-note"><strong>执行准备状态：待核验</strong><br>设备连接、方法兼容性、资源占用、耗材、转运能力及实际质控与余量尚未核验。任务创建后处于“待就绪”，满足前置条件并接入执行系统后才能启动。</div>',()=>errors.length?false:alSave(false),errors.length?'补全配置后可创建':'创建任务 · 待就绪');
 const d=document.getElementById('dlg');d.querySelector('button[value="ok"]').disabled=errors.length>0||!can('edit');
 d.querySelectorAll('[data-al-fix]').forEach(button=>button.onclick=()=>{
  const area=button.dataset.alFix;
  d.close();
  if(area==='execution'){
   ALUI.planScroll=view.scrollTop;
   ALUI.edge=alEdges(f).find(edge=>!edge.data&&!alTransferConfigured(f.transfers[edge.id]))?.id||null;
   ALUI.tab='execution';
   render();
   view.scrollTop=0;
   return;
  }
  const step={name:0,pid:0,goal:0,question:1,groups:1,batches:1,replicates:1,samples:2,methods:3,budget:4,criteria:4}[area]??0;
  alNavigatePlanStep(step);
  if(area==='samples')alSamplePanel(f);
  else if(area==='methods')alMethodPanel(f);
  else view.querySelector('[data-al-field="'+area+'"]')?.focus();
 });
}
function alSave(draft){
 if(!can('edit')){toast('当前身份没有编辑权限');return false;}
 const f=alForm(),errors=alErrors(f,draft);if(errors.length){LABUI.errors={al:errors[0].text};render();return false;}
 const old=f.editing&&BATCHES.find(b=>b.id===f.editing);if(old&&old.workflow?.phase!=='draft'){toast('已创建任务不可直接修改，请复制实验方案');return false;}
 const previous=old?alClone(old):null,at=nowStamp();let id=old?.id||nextBatchId();while(!old&&BATCHES.some(b=>b.id===id))id+='-1';
 const snapshot=alClone(f);if(!draft)snapshot.deviceSnapshots=Object.fromEntries(alPlan(f).map(s=>[s.id,labDevice(s.deviceId)?alClone(labDevice(s.deviceId)):null]));snapshot.savedAt=at;snapshot.dirty=false;snapshot.editing=draft?id:null;
 const b={id,pid:f.pid,round:DB.projects.find(p=>p.id===f.pid)?.rounds?.slice(-1)[0]?.i||1,name:f.name.trim(),desc:f.desc,n:f.materials.filter(m=>m.role==='candidate').length,vendor:'自主实验室 · 本机方案',status:draft?'draft':'waiting_for_confirmation',results:'none',localLab:true,log:[[draft?'draft':'waiting_for_confirmation',at]],ctx:{assay:f.assays.map(a=>AL_TITLES[a])},workflow:{schema:1,source:'autonomous',phase:draft?'draft':'waiting',template:f.designTemplate,mode:f.mode,assays:f.assays.slice(),sampleIds:f.materials.map(m=>m.id),sampleSource:f.sourceRef,aliquot:f.budget,snapshot,steps:alPlan(f).map(s=>({...s,deviceSnapshot:labDevice(s.deviceId)?alClone(labDevice(s.deviceId)):null})),conclusion:null,events:[...(old?.workflow?.events||[]),{at,text:draft?'保存实验草稿':'创建任务并冻结方案快照；设备未下发',by:'我'}]}};
 if(old)Object.assign(old,b);else BATCHES.unshift(b);
 if(!labPersist()){if(old)Object.assign(old,previous);else BATCHES.splice(BATCHES.indexOf(b),1);return false;}
 LABUI.errors={};if(draft){f.editing=id;f.savedAt=at;f.dirty=false;alRememberDraft(id);render();toast('草稿已保存到本机');}else{LABUI.form=null;alResetComposerView();go('labdet',{labPick:id,pid:f.pid});toast('任务已创建，等待设备与资源就绪');}return true;
}
const alPreviousSummary=labSummary;
labSummary=function(b){if(b?.workflow?.source!=='autonomous')return alPreviousSummary(b);const draft=b.workflow.phase==='draft';return {status:draft?'draft':'waiting',label:draft?'草稿':'待就绪',done:0,total:b.workflow.steps.length,progress:0,current:draft?'实验方案待完善':'等待设备与资源就绪',detail:'本机保存；尚未连接设备或下发指令',ready:false,fails:[],active:[]};};
function alTaskMethods(workflow){
 return workflow.assays.map(id=>{
  if(id==='affinity'){
   const device=workflow.steps.find(step=>step.id===id)?.deviceId;
   return device==='biacore'?'SPR':'BLI';
  }
  return id==='stability'?'nanoDSF':AL_TITLES[id];
 }).join('、');
}
const alPreviousDetail=V.labdet;
function alViewedBatch(){return BATCHES.find(batch=>batch.id===S.labPick);}
function alTaskRunInfo(batch){
 const workflow=batch.workflow;
 if(workflow.phase==='draft')return '';
 const summary=labSummary(batch);
 return `<section class="al-card al-runtime">
  <header><h2>任务运行</h2><span>${summary.done} / ${summary.total} 环节完成</span></header>
  <div class="al-card-body"><strong>${esc(summary.current)}</strong><p>${esc(summary.detail)}</p><p>方案版本 v${esc(workflow.snapshot.version||1)}</p></div>
 </section>
 <section class="al-card"><header><h2>任务事件</h2></header>
  <div class="al-card-body">${workflow.events.map(event=>`<p>${esc(event.at)} · ${esc(event.text)}</p>`).join('')}</div>
 </section>`;
}
function alLegacyForm(batch){
 const workflow=batch.workflow;
 return alNormalizeForm({
  ...labNewForm(),
  pid:batch.pid,
  name:batch.name||'',
  desc:batch.desc||'',
  template:workflow.template,
  mode:workflow.mode,
  assays:(workflow.assays||[]).slice(),
  samples:(workflow.sampleIds||[]).join('\n'),
  sourceRef:workflow.sampleSource||'',
  aliquot:workflow.aliquot||'',
  savedAt:workflow.events?.at(-1)?.at||batch.log?.at(-1)?.[1]||null,
  steps:alClone(workflow.steps||[])
 });
}
function alLegacyView(batch){
 const viewTemplate=document.createElement('template');
 viewTemplate.innerHTML=alPreviousDetail();
 const legacy=viewTemplate.content.querySelector('.lab-experiment-detail');
 if(!legacy)return alPreviousDetail();
 const actions=legacy.querySelector('.lv-head .lv-actions')?.innerHTML||'';
 legacy.querySelector('.lv-head')?.remove();
 const map=legacy.querySelector('.lab-workflow-panel');
 const execution=map?.outerHTML||'<p class="al-note">原实验记录未保存执行编排。</p>';
 map?.remove();
 return `<div class="page al-page">
  <header class="al-page-head">
   <div><button class="rs-link" data-go="lab">← 实验管理</button><h1>${esc(String(batch.name||batch.id).replace(' · 异常示例',''))}</h1><p>${esc(batch.id)} · 历史实验记录</p></div>
   <div class="rs-actions">${actions}</div>
  </header>
  ${alComposerContent(alLegacyForm(batch),true,execution)}
  <div class="lab-experiment-detail al-legacy-record">${legacy.innerHTML}</div>
 </div>`;
}
V.labdet=()=>{
 const batch=alViewedBatch();
 if(!batch?.workflow)return alPreviousDetail();
 const form=batch.workflow.snapshot;
 if(!form)return alLegacyView(batch);
 const draft=batch.workflow.phase==='draft',editable=can('edit');
 return `<div class="page al-page">
  <header class="al-page-head">
   <div><button class="rs-link" data-go="lab">← 实验管理</button><h1>${esc(String(batch.workflow?.snapshot?.name||batch.name||batch.id))}</h1><p>${esc(batch.id)} · 方案快照</p></div>
   <div class="rs-actions"><span class="al-tag">${draft?'草稿':'待就绪'}</span>${editable?`<button class="btn" data-al-copy="${esc(batch.id)}">${draft?'继续编辑':'复制为新实验'}</button>`:''}<button class="btn" data-al-export="${esc(batch.id)}">导出方案</button></div>
  </header>
  ${alComposerContent(form,true)}
  ${alTaskRunInfo(batch)}
 </div>`;
};
function alLoadDraft(batch){
 const workflow=batch?.workflow;
 if(workflow?.phase!=='draft'||!can('edit'))return false;
 if(LABUI.form?.editing===batch.id)return true;

 LABUI.form=workflow.snapshot?alClone(workflow.snapshot):alLegacyForm(batch);
 LABUI.form.editing=batch.id;
 return true;
}
function alResetComposerView(){
 LABUI.errors={};
 Object.assign(ALUI,{tab:'protocol',planStep:0,node:'qc',edge:null,planScroll:0});
}
function alRestoreComposer(){
 const draftId=history.state?.labDraftId;
 if(draftId&&alLoadDraft(BATCHES.find(batch=>batch.id===draftId))){
  S.pid=LABUI.form.pid;
 }else if(LABUI.form?.editing){
  LABUI.form=null;
 }
 alResetComposerView();
}
function alRememberDraft(id){
 history.replaceState({...history.state,labDraftId:id},'');
}
function alOpenDraft(batch){
 if(!alLoadDraft(batch))return false;
 alOpenComposer();
 return true;
}
function alVisitBatch(id){
 const batch=BATCHES.find(record=>record.id===id);
 if(!alOpenDraft(batch)){alResetComposerView();go('labdet',{labPick:id,pid:batch?.pid||S.pid});}
}
function alOpenComposer(){
 alResetComposerView();
 go('labnew',{pid:LABUI.form.pid});
 alRememberDraft(LABUI.form.editing);
}
const alPreviousAct=labV2Act;
labV2Act=function(action,element){
 if(action!=='labnew')return alPreviousAct(action,element);
 LABUI.form=labNewForm();
 alOpenComposer();
 return true;
};
function alRepaintGraph(attribute,value){const left=view.querySelector('.al-canvas-scroll')?.scrollLeft||0;render();const canvas=view.querySelector('.al-canvas-scroll');if(canvas)canvas.scrollLeft=left;view.querySelector('['+attribute+'="'+CSS.escape(value)+'"]')?.focus({preventScroll:true});}
const alPreviousBind=rsBind;
rsBind=function(root){
 alPreviousBind(root);
 const on=(selector,event,fn)=>root.querySelectorAll(selector).forEach(el=>el.addEventListener(event,ev=>fn(el,ev)));
 on('[data-al-field]','input',el=>{if(S.route!=='labnew'||!can('edit'))return;const f=alForm();f[el.dataset.alField]=el.value;f.dirty=true;const status=root.querySelector('[data-al-validation]');if(status)status.textContent='方案配置尚有 '+alErrors(f).length+' 项待补全';const budget=root.querySelector('[data-al-budget]');if(budget)budget.textContent=alBudgetSummary(f);const saved=root.querySelector('.al-save-status');if(saved)saved.textContent='有未保存的修改';});
 on('select[data-al-field]','change',el=>{if(!can('edit'))return;const f=alForm();f[el.dataset.alField]=el.value;f.dirty=true;if(el.dataset.alField==='designTemplate'){f.assays=AL_TEMPLATES[f.designTemplate].assays.slice();ALUI.edge=null;}render();});
 on('[data-al-origin]','change',el=>{if(!can('edit'))return;alForm().origin=el.dataset.alOrigin;alForm().dirty=true;ALUI.edge=null;render();});
 on('[data-al-plan-step]','click',el=>alNavigatePlanStep(Number(el.dataset.alPlanStep)));
 on('[data-al-view]','click',el=>{
  const next=el.dataset.alView;
  if(next==='execution'){
   ALUI.planScroll=view.scrollTop;
   if(!ALUI.node&&!ALUI.edge)ALUI.node='qc';
  }
  ALUI.tab=next;
  render();
  view.scrollTop=next==='execution'?0:ALUI.planScroll;
  const action=next==='execution'?'protocol':'execution';
  view.querySelector('[data-al-view="'+action+'"]')?.focus({preventScroll:true});
  if(next==='execution'){
   const current=view.querySelector('.al-node.is-selected,.al-transfer-link.is-selected');
   const canvas=view.querySelector('.al-canvas-scroll');
   if(current&&canvas&&current.offsetLeft+current.offsetWidth>canvas.clientWidth){
    canvas.scrollLeft=current.offsetLeft-24;
   }
  }
 });
 const focusPreview=(el,attribute,value)=>{
  if(attribute==='data-al-focus-node'){ALUI.node=value;ALUI.edge=null;}
  else{ALUI.edge=value;}
  const inPreview=Boolean(el.closest('.al-flow-preview'));
  render();
  const preview=view.querySelector('.al-flow-preview');
  const target=(inPreview?preview:view.querySelector('.al-plan-column'))?.querySelector('['+attribute+'="'+CSS.escape(value)+'"]');
  target?.focus({preventScroll:true});
  if(!inPreview&&matchMedia('(max-width:900px)').matches)preview?.scrollIntoView({block:'nearest'});
 };
 on('[data-al-focus-node]','click',el=>focusPreview(el,'data-al-focus-node',el.dataset.alFocusNode));
 on('[data-al-focus-edge]','click',el=>focusPreview(el,'data-al-focus-edge',el.dataset.alFocusEdge));
 const readonly=S.route==='labdet';
 const shownForm=()=>{
  if(!readonly)return alForm();
  const batch=alViewedBatch();
  return batch?.workflow&&(batch.workflow.snapshot||alLegacyForm(batch));
 };
 on('[data-al-panel]','click',el=>{
  const panel=el.dataset.alPanel;
  if(panel==='preflight'){if(!readonly)alPreflight();return;}
  if(!readonly&&!can('edit')){toast('当前身份没有编辑权限');return;}
  const form=shownForm();
  if(form)({samples:alSamplePanel,methods:alMethodPanel})[panel]?.(form,readonly,el.dataset.alMethodTarget);
 });
 on('[data-al-save]','click',()=>alSave(true));
 on('[data-al-node]','click',el=>{ALUI.node=el.dataset.alNode;ALUI.edge=null;alRepaintGraph('data-al-node',ALUI.node);});
 const edge=el=>{ALUI.edge=el.dataset.alEdge;alRepaintGraph('data-al-edge',ALUI.edge);};on('[data-al-edge]','click',edge);on('[data-al-edge]','keydown',(el,e)=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();edge(el);}});
 on('[data-al-transfer]','click',el=>{
  const form=shownForm();
  if(form&&(readonly||can('edit')))alTransferPanel(el.dataset.alTransfer,form,readonly);
 });
 on('[data-al-copy]','click',el=>{
  if(!can('edit'))return;
  const batch=BATCHES.find(b=>b.id===el.dataset.alCopy);
  if(!batch?.workflow?.snapshot||alOpenDraft(batch))return;
  const form=alClone(batch.workflow.snapshot);
  delete form.deviceSnapshots;
  form.editing=null;
  form.savedAt=null;
  form.dirty=true;
  form.name+='（副本）';
  form.version=(form.version||1)+1;
  LABUI.form=form;
  alOpenComposer();
 });
 on('[data-al-export]','click',el=>{const b=BATCHES.find(b=>b.id===el.dataset.alExport),url=URL.createObjectURL(new Blob([JSON.stringify(b,null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download=b.id+'-方案.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});
};
