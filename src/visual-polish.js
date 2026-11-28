/* 收口层里 CSS 做不了的两件事——它们都取决于内容，不取决于选择器。
   跟 visual-converge.css 是一对，排在所有渲染之后跑。 */
(function(){
 const prev=render;

 /* 1) 被省略号截掉的文字，补一个 title。
    表格里的名字、来源、ID 经常比列宽长，截了之后看不全又没处看全文；
    逐个模板去写 title 要改十几处，而且下次新加一列又会漏。
    按「量出来真的被截了」补，漏不掉也不会多补。 */
 function titleTruncated(root){
  for(const e of root.querySelectorAll('*')){
   if(e.children.length)continue;
   const t=e.textContent.trim();
   if(!t||t.length<6)continue;
   if(e.getAttribute('title'))continue;
   if(e.scrollWidth-e.clientWidth<=1)continue;
   const c=getComputedStyle(e);
   if(c.textOverflow!=='ellipsis'&&c.whiteSpace!=='nowrap')continue;
   if(c.overflowX==='auto'||c.overflowX==='scroll'||c.overflowX==='visible')continue;
   e.setAttribute('title',t);
  }
 }

 /* 2) .num 的意思是「用等宽排，数字才对得齐」。
    但有些地方把中文也放进了 .num（「上海人工智能实验室」「未接入」「本课题实测」）——
    等宽排中文字距会散开，一眼就不对。按内容判：含中文就退回正文字体。
    不去各模板里摘 class，是因为同一个类名在别处是对的，摘了会把真的数字也弄歪。 */
 const CJK=/[一-龥]/;
 function sansForCJK(root){
  for(const e of root.querySelectorAll('.num,.mono')){
   const t=e.textContent;
   if(!CJK.test(t))continue;
   e.style.fontFamily='var(--sans)';
  }
 }

 render=function(){
  const r=prev.apply(this,arguments);
  const root=document.getElementById('view');
  if(root){try{sansForCJK(root);titleTruncated(root)}catch(e){}}
  return r;
 };
})();
