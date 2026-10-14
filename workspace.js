/* A compact workspace shell; original controls retain their handlers and IDs. */
window.modelPrecision='fine';
let activeWorkspace='layout';
const workspaceDefinitions=[
 ['layout','户型',['editPlan','windowsEntry','recognizeEntry','blankBoard']],
 ['furniture','家具',['modelsEntry']],
 ['materials','材质',['decorEntry','ceilingEntry']],
 ['systems','水电',['utilitiesEntry','systemsEntry']],
 ['model','3D 建模',['modelingEntry','ceilingEntry']],
 ['output','出图',['constructionEntry','renderEntry']]
];
function ensureWholeRoof(force=false){
 if(!force&&modelData().autoRoof===false)return;
 const missing=ROOMS.filter(r=>!modelData().ceilings.some(c=>c.roomId===r.id));
 if(!missing.length){if(force&&modelData().autoRoof===false)mutate(()=>modelData().autoRoof=true);return;}
 mutate(()=>{modelData().ceilings.push(...missing.map(r=>({roomId:r.id,type:'flat',drop:0,thickness:120,border:400,finishId:'paintCream'})));modelData().autoRoof=true;});
}
const workspaceSetView=setView;
setView=async function(mode){
 if(mode==='3d'&&!is3D()){ensureWholeRoof();extraUI.showCeilings=false;}
 await workspaceSetView(mode);
 if(is3D())window.View3D?.setModelPrecision?.(window.modelPrecision);
 syncWorkspaceView();
};
function syncWorkspaceView(){
 const button=$('#roofVisibility');if(button){button.textContent=extraUI.showCeilings?'剖切顶面':'显示顶面';button.setAttribute('aria-pressed',String(extraUI.showCeilings));}
}
async function setWorkspace(key,open=true){
 activeWorkspace=key;document.body.dataset.workspace=key;
 document.querySelectorAll('#workspaceNav [data-workspace]').forEach(b=>{const selected=b.dataset.workspace===key;b.classList.toggle('active',selected);b.setAttribute('aria-selected',String(selected));b.tabIndex=selected?0:-1;});
 document.querySelectorAll('#workspaceActions [data-workspace-action]').forEach(el=>el.hidden=!workspaceDefinitions.find(w=>w[0]===key)[2].includes(el.id));
 $('#importModelQuick').hidden=!['furniture','model'].includes(key);$('#wholeRoofQuick').hidden=!['materials','model'].includes(key);$('#wallPaintQuick').hidden=key!=='model';
 if(!open)return;
 if(extraUI.mode)closeModeling();if(decorUI.mode)closeStudio();if(systemsUI.active)setSystemsMode(false);if(edit.active)toggleEditor(false);clearWindowMode();
 const start={layout:async()=>{if(is3D())await setView('2d');toggleEditor(true);},furniture:()=>$('#modelsEntry').click(),materials:()=>$('#decorEntry').click(),systems:()=>$('#utilitiesEntry').click(),model:()=>$('#modelingEntry').click(),output:()=>closeDrawers()};
 await start[key]?.();
 if(narrow()&&key==='model')drawer('lib',true);
}
function buildWorkspaceShell(){
 const header=$('header'),oldChildren=[...header.children],brand=$('.brand'),viewSegment=$('#viewSeg'),saveButton=$('#savePlan');
 const actions=document.createElement('div');actions.id='workspaceActions';
 const actionIds=[...new Set(workspaceDefinitions.flatMap(w=>w[2]))];
 for(const id of actionIds){const button=$('#'+id);button.dataset.workspaceAction='';actions.append(button);}
 const root=document.createElement('div');root.className='workspace-header';
 root.innerHTML='<div class="workspace-top"><div class="workspace-logo" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M4 10 12 4l8 6v10H4Z M9 20v-7h6v7" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg></div><div id="projectBrand"></div><div id="mainViewSwitch"></div><div id="mainSave"></div><details class="workspace-menu"><summary class="btn" aria-label="更多设置">•••</summary><div id="workspaceMore"></div></details></div><nav id="workspaceNav" role="tablist" aria-label="设计工作区"></nav><div class="workspace-context"><div id="workspaceActionMount"></div><div class="workspace-view-controls"><button class="btn only3d" id="roofVisibility">显示顶面</button><label class="quality-label only3d">画质<select id="workspaceQuality"><option value="fine">精细</option><option value="balanced">流畅</option></select></label><button class="btn" id="libraryToggleMount"></button><button class="btn" id="propertyToggleMount"></button></div></div></div>';
 root.querySelector('#projectBrand').append(brand);root.querySelector('#mainViewSwitch').append(viewSegment);saveButton.textContent='保存方案';root.querySelector('#mainSave').append(saveButton);
 const nav=root.querySelector('#workspaceNav');nav.innerHTML=workspaceDefinitions.map(([key,name])=>`<button role="tab" data-workspace="${key}">${name}</button>`).join('');
 root.querySelector('#workspaceActionMount').replaceWith(actions);
 const more=root.querySelector('#workspaceMore');
 for(const el of oldChildren){if(el===brand||el===viewSegment||el===saveButton||el.classList.contains('plan-start')||el.classList.contains('spacer'))continue;more.append(el);}
 const toolGroup=root.querySelector('#tools'),undo=root.querySelector('#undo'),redo=root.querySelector('#redo'),zoom=root.querySelector('#fit')?.closest('.grp');
 const canvasTools=document.createElement('div');canvasTools.id='canvasTools';canvasTools.append(toolGroup,undo,redo);if(zoom)canvasTools.append(zoom);
 canvasTools.append(root.querySelector('#modes3d'),root.querySelector('#vIso').closest('.grp'));$('#stage').append(canvasTools);
 const libraryToggle=root.querySelector('#tgLib'),propertyToggle=root.querySelector('#tgPanel');
 libraryToggle.textContent='资源';propertyToggle.textContent='属性';
 root.querySelector('#libraryToggleMount').replaceWith(libraryToggle);root.querySelector('#propertyToggleMount').replaceWith(propertyToggle);
 const isolatedExit=document.createElement('button');isolatedExit.id='exitModelIsolation';isolatedExit.className='btn';isolatedExit.textContent='返回全屋';isolatedExit.hidden=true;root.querySelector('.workspace-view-controls').prepend(isolatedExit);isolatedExit.onclick=()=>window.View3D?.exitModelIsolation();
 const imported=document.createElement('button');imported.id='importModelQuick';imported.className='btn';imported.textContent='导入模型';actions.append(imported);imported.onclick=async()=>{await openModeling('model');$('#modelAssetInput').click();};
 const roof=document.createElement('button');roof.id='wholeRoofQuick';roof.className='btn';roof.textContent='生成全屋顶面';actions.append(roof);roof.onclick=async()=>{ensureWholeRoof(true);extraUI.showCeilings=true;await openModeling('ceiling');if(!is3D())await setView('3d');renderAll();syncWorkspaceView();};
 const paint=document.createElement('button');paint.id='wallPaintQuick';paint.className='btn';paint.textContent='墙面画笔';actions.append(paint);paint.onclick=()=>startBrush('paint');
 header.replaceChildren(root);
 document.querySelectorAll('#workspaceNav [data-workspace]').forEach(b=>{b.onclick=()=>setWorkspace(b.dataset.workspace);b.onkeydown=e=>{if(!['ArrowLeft','ArrowRight'].includes(e.key))return;e.preventDefault();const list=Array.from(document.querySelectorAll('#workspaceNav [data-workspace]')),index=list.indexOf(b),next=list[(index+(e.key==='ArrowRight'?1:-1)+list.length)%list.length];next.focus();next.click();};});
 $('#roofVisibility').onclick=()=>{if(!modelData().ceilings.length)ensureWholeRoof(true);extraUI.showCeilings=!extraUI.showCeilings;renderAll();syncWorkspaceView();};
 $('#workspaceQuality').onchange=e=>{window.modelPrecision=e.target.value;window.View3D?.setModelPrecision?.(window.modelPrecision);};
 for(const [selector,title,which] of [['aside.lib','资源库','lib'],['aside.right','属性','panel']]){
  const bar=document.createElement('div');bar.className='workspace-sidehead';bar.innerHTML='<b>'+title+'</b><button class="btn" aria-label="收起'+title+'">×</button>';$(selector).prepend(bar);bar.querySelector('button').onclick=()=>drawer(which,false);
 }
 document.addEventListener('pointerdown',e=>{const menu=$('.workspace-menu');if(menu.open&&!menu.contains(e.target))menu.open=false;});
 setWorkspace('layout',false);syncWorkspaceView();
 requestAnimationFrame(()=>fitView());
 new ResizeObserver(()=>{document.documentElement.style.setProperty('--workspace-header-height',header.offsetHeight+'px');}).observe(header);
}
const workspaceRenderAll=renderAll;
renderAll=function(){workspaceRenderAll();syncWorkspaceView();};
buildWorkspaceShell();
const workspaceOpenModeling=openModeling;
openModeling=async function(mode){await workspaceOpenModeling(mode);if(extraUI.mode===mode)setWorkspace(mode==='model'?'model':mode==='ceiling'&&activeWorkspace==='model'?'model':'materials',false);};
const workspaceOpenStudio=openStudio;
openStudio=function(mode){workspaceOpenStudio(mode);setWorkspace(mode==='utilities'?'systems':mode==='models'?'furniture':'materials',false);};
