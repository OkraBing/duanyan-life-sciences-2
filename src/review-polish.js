/* Product polish from the 20-round interaction review. Data/authorization remain in their owners. */
(function(){
 const cleanMarkup=html=>{const t=document.createElement('template');t.innerHTML=html;t.content.querySelectorAll('.rs-side-card,.rs-form-storage-note,.rs-local-note').forEach(e=>e.remove());t.content.querySelectorAll('.rs-head>div>p').forEach(e=>e.remove());t.content.querySelectorAll('.rs-created-catalog>.rs-card-top>.rs-tag').forEach(e=>e.remove());t.content.querySelectorAll('.rs-created-catalog h2').forEach(e=>e.textContent=e.textContent.replace('本机发布的','已发布'));t.content.querySelectorAll('[data-rs-review]').forEach(e=>e.textContent='审核');t.content.querySelectorAll('.rs-context .rs-help').forEach(e=>{if(/公开范围|私有范围/.test(e.textContent))e.textContent=e.textContent.includes('公开')?'公开':'私有';});return t.innerHTML;};
 for(const route of ['toolnew','databasenew','resdetail','shelf','data']){const original=V[route];V[route]=()=>cleanMarkup(original());}
 const dress=dressSelects;
 dressSelects=function(root){
  root.querySelectorAll('select:not([aria-label])').forEach(e=>{const field=e.closest('.lv-field,.rs-field,.field,.label'),label=field?.querySelector(':scope>span,:scope>label');if(label)e.setAttribute('aria-label',label.textContent.trim().replace(/\s*\*.*$/,''));});
  dress(root);
  root.querySelectorAll('select').forEach((e,i)=>{const b=e.previousElementSibling;if(b?.matches('.ctl-dd')){b.dataset.reviewSelect=e.id||e.dataset.lvField||e.dataset.lvDeviceSelect||e.dataset.rsResourceField||e.getAttribute('aria-label')||('select-'+i);syncSelectFeedback(e);}});
  root.querySelectorAll('input[type=file]:not([aria-label])').forEach(e=>e.setAttribute('aria-label',e.hasAttribute('webkitdirectory')?'选择资源文件夹':'选择资源文件'));
  root.querySelectorAll('[data-rs-publish-pick],[data-rs-new-asset]').forEach(e=>{const label=e.closest('label')?.querySelector('strong')?.textContent;if(label)e.setAttribute('aria-label',label);});
 };
 function syncSelectFeedback(select){const button=select?.previousElementSibling;if(!button?.matches('.ctl-dd'))return;for(const attribute of ['aria-invalid','aria-describedby']){const value=select.getAttribute(attribute);if(value)button.setAttribute(attribute,value);else button.removeAttribute(attribute);}}
 function fieldFor(key){return key.startsWith('resource_')?'[data-lv-resource="'+CSS.escape(key.slice(9))+'"]':key.startsWith('sop_')?'[data-lv-sop="'+CSS.escape(key.slice(4))+'"]':key.startsWith('device_')?'[data-lv-device-select="'+CSS.escape(key.slice(7))+'"]':'[data-lv-field="'+CSS.escape(key)+'"]';}
 function errorLinks(){
  if(S.route==='labnew'&&Object.keys(LABUI.errors||{}).length){const box=view.querySelector('.composer-global-error');if(!box)return;box.tabIndex=-1;box.innerHTML='<strong>请补全实验信息</strong><ul class="review-error-links">'+Object.entries(LABUI.errors).map(([k,v])=>'<li><button class="review-error-link" type="button" data-composer-error="'+esc(k)+'">'+esc(v)+'</button></li>').join('')+'</ul>';box.querySelectorAll('[data-composer-error]').forEach(e=>e.onclick=()=>{const key=e.dataset.composerError,node=key.replace(/^(resource|device|sop)_/,'');LABUI.selected=labForm().steps.some(s=>s.id===node)?node:'setup';render();const target=view.querySelector(fieldFor(key));(target?.classList.contains('sel-raw')?target.previousElementSibling:target)?.focus();});}
  if(['toolnew','databasenew'].includes(S.route)){const box=view.querySelector('.rs-error-summary');if(box){box.tabIndex=-1;const errors=RS.form?.errors||{};box.innerHTML='<strong>请检查以下信息</strong><ul class="review-error-links">'+Object.entries(errors).map(([key,message])=>'<li><button class="review-error-link" type="button" data-resource-error="'+esc(key)+'">'+esc(message)+'</button></li>').join('')+'</ul>';box.querySelectorAll('[data-resource-error]').forEach(e=>e.onclick=()=>{const key=e.dataset.resourceError,target=key==='upload'?view.querySelector('[data-rs-drop]'):key==='subjects'?view.querySelector('[data-rs-subject]'):view.querySelector('#rs-form-'+CSS.escape(key));target?.focus();});}}
 }
 const reopenMenu=remenu;remenu=function(){const element=_menuRe&&document.querySelector(_menuRe.sel);if(element?.matches('.ctl-dd[data-review-select]')){element.click();return;}reopenMenu();};
 const bind=rsBind;
 /* 改对了就别再红着。资源表单原来只在再次提交时才重算错误：用户把名称补上，
    红框、字段下那行提示、顶部那条汇总都还挂着，看着像是没改成。
    和实验编排器一个做法——边改边清，还不对的话下次提交会再报出来。 */
 function clearResourceError(el){
  const key=el.dataset.rsResourceField,errors=RS.form&&RS.form.errors;
  if(!errors||!errors[key])return;
  delete errors[key];
  el.removeAttribute('aria-invalid');el.removeAttribute('aria-describedby');
  const message=view.querySelector('#rs-error-'+CSS.escape(key));if(message)message.textContent='';
  const item=view.querySelector('[data-resource-error="'+CSS.escape(key)+'"]');if(item)(item.closest('li')||item).remove();
  if(!Object.keys(errors).length)view.querySelector('.rs-error-summary')?.remove();
 }
 rsBind=function(root){bind(root);errorLinks();root.querySelectorAll('[data-rs-resource-field]').forEach(e=>{e.addEventListener('input',()=>clearResourceError(e));e.addEventListener('change',()=>clearResourceError(e));});if(!can('edit'))root.querySelectorAll('[data-lv-save],[data-lv-record],[data-lv-retry],[data-lv-publish],[data-rs-create-shared],[data-rs-save-resource]').forEach(e=>{e.disabled=true;e.title='当前身份没有编辑权限';});root.querySelectorAll('[data-composer-node]').forEach(e=>e.addEventListener('keydown',ev=>{if(!['ArrowDown','ArrowUp','Home','End'].includes(ev.key))return;const nodes=[...root.querySelectorAll('[data-composer-node]')],i=nodes.indexOf(e),n=ev.key==='Home'?0:ev.key==='End'?nodes.length-1:(i+(ev.key==='ArrowDown'?1:-1)+nodes.length)%nodes.length;ev.preventDefault();nodes[n].focus();}));};
 const save=labSave;
 labSave=function(draft){const ok=save(draft);if(!ok&&S.route==='labnew')requestAnimationFrame(()=>view.querySelector('.composer-global-error')?.focus());return ok;};
 const saveResource=rsSaveResource;
 rsSaveResource=async function(draft){const value=await saveResource(draft);if(!value&&RS.form?.errors&&Object.keys(RS.form.errors).length)requestAnimationFrame(()=>view.querySelector('.rs-error-summary')?.focus());return value;};
 const refresh=iterationRefreshComposer;
 iterationRefreshComposer=function(){const f=labForm(),errors=labValidate(f,false);Object.keys(LABUI.errors||{}).forEach(k=>{if(!errors[k]){delete LABUI.errors[k];const target=view.querySelector(fieldFor(k));target?.removeAttribute('aria-invalid');target?.removeAttribute('aria-describedby');if(target?.matches('select'))syncSelectFeedback(target);view.querySelector('#lverr-'+CSS.escape(k))?.remove();}});refresh();if(!Object.keys(LABUI.errors).length)view.querySelector('.composer-global-error')?.remove();else errorLinks();};
 document.addEventListener('focusin',e=>{const drawer=document.querySelector('.asset-drawer');if(!drawer||drawer.contains(e.target)||document.querySelector('dialog[open]'))return;const r=e.target.getBoundingClientRect(),d=drawer.getBoundingClientRect();if(r.width&&r.right>d.left&&r.left<d.right&&r.top<d.bottom&&r.bottom>d.top)iterationCloseDrawer(false);});
})();
