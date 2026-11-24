/* 第二版：情境入口
   被收起的功能挂在它上游动作的旁边：附件里能从资料空间选、能上传数据集；
   实验结论发布后能整理成数据集；训练表单能新建数据集；工具选择器能去管理我的工具。
   全部只做导航与预填，不改各功能内部的业务逻辑。 */
function ceNewDataset(pid,from){
 if(pid&&DB.projects.some(p=>p.id===pid))S.pid=pid;
 if(typeof dsReset==='function')dsReset();
 go('dsnew');
 if(from)toast(from);
}
/* 实验结论 → 数据集：带入课题；课题文件里有这批的测定表就直接选上，没有就停在「课题文件」让人自己挑 */
function ceBatchToDataset(id){
 const b=BATCHES.find(x=>x.id===id);if(!b)return toast('找不到这批实验');
 if(DB.projects.some(p=>p.id===b.pid))S.pid=b.pid;
 dsReset();NEWDS.src='proj';
 const files=typeof dsFiles==='function'?dsFiles():[];
 const hit=files.find(e=>e.name.includes(b.id))||null;
 if(hit){const t=dsFileText(hit);if(t!=null){NEWDS.from=hit.name;dsRead(t,hit.name);if(!NEWDS.name)NEWDS.name=b.id+' 测定数据';}}
 go('dsnew');
 toast(hit?'已带入 '+hit.name+'，核对字段后建立数据集':'已切到「课题文件」，选这批的测定表');
}
/* 从资料空间选：列这个课题的资料（再列公共资料），选中的挂到输入框上方，和上传的文件同一种标签 */
function ceMaterialsMenu(anchor){
 const pid=typeof gsCurrentPid==='function'?gsCurrentPid():'';
 const trash=typeof materialsPrefs==='function'?(materialsPrefs().trash||[]):[];
 const rows=(typeof materialsRows==='function'?materialsRows():[]).filter(x=>!trash.includes(x.id));
 const mine=rows.filter(x=>x.pid===pid),other=rows.filter(x=>x.pid!==pid);
 const list=mine.concat(other).slice(0,12);
 const pn=DB.projects.find(p=>p.id===pid)?.name||'';
 const html=(list.length?'<div class="menu-l">'+esc(mine.length?pn+' 的资料':'资料空间')+'</div>'
   +list.map(x=>'<button class="menu-i is-go" type="button" data-go="'+esc('m:'+x.name)+'"><span class="ck"></span><span><span class="nm">'+esc(x.name)+'</span><span class="sb">'+esc(DB.projects.find(p=>p.id===x.pid)?.name||'公共资料')+'</span></span></button>').join('')
   :'<div class="menu-i" style="cursor:default"><span class="ck"></span><span><span class="nm">资料空间里还没有文件</span><span class="sb">先上传，之后都能从这里选</span></span></div>')
  +'<div class="menu-sep"></div><button class="menu-i is-go" type="button" data-go="__open"><span class="ck"></span><span><span class="nm">打开资料空间</span></span></button>';
 menu(anchor,html,v=>{
  if(v==='__open'){Object.assign(MATERIALS,{tab:'all',space:mine.length?pid:'',query:'',type:'all'});go('materials',{keepTab:1});return}
  if(v.startsWith('m:')){const name=v.slice(2);S.askFiles=(S.askFiles||[]).filter(n=>n!==name).concat([name]);render();
   setTimeout(()=>document.getElementById('ask')?.focus(),30);}
 });
}
document.addEventListener('click',e=>{
 const el=e.target.closest('[data-ce-batch-ds],[data-ce-new-ds],[data-ce-tools],[data-ce-mat-pid]');if(!el)return;
 if(el.dataset.ceBatchDs){ceBatchToDataset(el.dataset.ceBatchDs);return}
 if(el.dataset.ceNewDs!=null){ceNewDataset(S.pid,'新建的数据集发布后，会出现在训练数据里');return}
 if(el.dataset.ceTools!=null){document.getElementById('dlg')?.close();go('tools');return}
 if(el.dataset.ceMatPid){Object.assign(MATERIALS,{tab:'all',space:el.dataset.ceMatPid,query:'',type:'all'});go('materials',{keepTab:1});}
});

/* 实验环节报异常：环节卡片上直接给「查看设备」。用捕获阶段，免得点击同时触发卡片自己的选中 */
document.addEventListener('click',e=>{
 const el=e.target.closest('[data-ce-device]');if(!el)return;
 e.preventDefault();e.stopPropagation();
 if(typeof labDeviceDialog==='function')labDeviceDialog(el.dataset.ceDevice);else go('devices');
},true);

/* 共享课题的往来进侧栏消息：有人申请我的资产（待我审批）、我的申请被批准（待导入）。
   点一条直接打开那个共享课题和申请面板。数据全来自 RS.data.shared 里真实的申请记录。
   这里只接消息，不并进工作台的「待处理」：那个数字统一走 wbAttentionTasks，只数任务，
   混进审批会让课题卡片、待处理弹窗和工作台三处的数对不上。 */
function ceSharedInbox(){
 const out=[];
 if(typeof RS==='undefined'||!RS.data||!Array.isArray(RS.data.shared))return out;
 RS.data.shared.forEach(s=>{
  const who=id=>s.members.find(m=>m.id===id)?.name||'项目成员';
  const asset=id=>s.assets?.find(a=>a.id===id)?.name||'一项资产';
  const open=()=>{RS.sharedPick=s.id;LS.set('rs_shared_pick',s.id);go('shareddetail');setTimeout(()=>{if(S.route==='shareddetail'&&typeof rsRequestsDialog==='function')rsRequestsDialog()},80)};
  (s.requests||[]).forEach(r=>{
   if(r.state==='pending'&&rsCan(s,'approve'))out.push({id:'sr-'+r.id,k:'dry',tag:'待你审批',title:who(r.actor)+' 申请添加「'+asset(r.assetId)+'」',text:s.name,at:r.at||'—',pid:s.projectId||'',open:'待处理',act:'去审批',go:open});
   else if(r.state==='approved'&&r.actor===RS.actor)out.push({id:'sa-'+r.id,k:'dry',tag:'申请已批准',title:'「'+asset(r.assetId)+'」可以导入了',text:s.name,at:r.at||'—',pid:'',open:'待处理',act:'去导入',go:open});
  });
 });
 return out;
}
if(typeof INBOX==='function'){
 const ceInboxBase=INBOX;
 INBOX=function(){
  const base=ceInboxBase(),R=typeof inboxRead==='function'?inboxRead():[];
  return base.concat(ceSharedInbox().map(x=>Object.assign(x,{read:R.indexOf(x.id)>=0})));
 };
}

/* 科研工具：用途下拉（原来是一排胶囊，和 Skills / SCP / 模型 页签叠成了三层） */
document.addEventListener('change',e=>{const el=e.target.closest('[data-shcap-select]');if(!el)return;S.shcap=el.value;render();});
