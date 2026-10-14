/* Plan naming and window editing shared by the 2D and 3D views. */
const windowUI={active:false};
const windowBase={renderAll,renderPanel,renderSel,renderOpenings,updateHeader,toggleEditor,setSystemsMode,deleteSel,setLang,overviewPanel,bindOverview,createOpening};
const windowShapeNames=()=>({rectangle:tr('矩形窗','Rectangle'),arch:tr('拱形窗','Arched'),ellipse:tr('圆形 / 椭圆窗','Round / oval')});
const selectedWindowIndex=()=>ui.sel?.kind==='window'?+ui.sel.id:-1;
function windowProfilePath(shape,w,h){
  if(shape==='ellipse')return `M ${-w/2} ${h/2} A ${w/2} ${h/2} 0 1 0 ${w/2} ${h/2} A ${w/2} ${h/2} 0 1 0 ${-w/2} ${h/2} Z`;
  if(shape==='arch'){const rise=Math.min(w/2,h*.45);return `M ${-w/2} 0 H ${w/2} V ${h-rise} A ${w/2} ${rise} 0 0 1 ${-w/2} ${h-rise} Z`;}
  return `M ${-w/2} 0 H ${w/2} V ${h} H ${-w/2} Z`;
}
function windowPreview(rect,index){
  const s=windowSettings(rect,index),w=Math.max(rect[2]-rect[0],rect[3]-rect[1]),k=Math.min(170/w,110/s.height),bottom=138;
  return `<svg class="window-preview" viewBox="0 0 230 180" role="img" aria-label="${esc(tr('窗户立面预览','Window elevation'))}"><g transform="translate(115 ${bottom}) scale(${k} ${-k})"><path d="${windowProfilePath(s.shape,w,s.height)}" fill="#d8eaf1" stroke="${s.frameColor}" stroke-width="5" vector-effect="non-scaling-stroke"/></g><path d="M20 159H210" stroke="#b7aa97"/><path d="M115 ${bottom+3}V155" stroke="#a75d3b" stroke-dasharray="3 3"/><text x="115" y="174" text-anchor="middle">${tr('窗台离地','Sill')} ${s.sill} mm</text><text x="115" y="16" text-anchor="middle">${Math.round(w)} × ${s.height} mm</text></svg>`;
}
function clearWindowMode(){windowUI.active=false;$('#windowLibrary').hidden=true;$('#windowsEntry').classList.remove('on');document.body.classList.remove('window-mode');}
function setWindowMode(on=true){
  if(switching)return;
  if(!on){clearWindowMode();$('#lib').hidden=edit.active||systemsUI.active;renderAll();return;}
  if(systemsUI.active)setSystemsMode(false);if(edit.active)toggleEditor(false);
  windowUI.active=true;document.body.classList.add('window-mode');$('#windowsEntry').classList.add('on');$('#windowLibrary').hidden=false;$('#lib').hidden=true;
  buildWindowLibrary();drawer('lib',true);renderAll();
}
function selectWindow(index,focus=false){
  if(!WINS[index])return;
  select({kind:'window',id:String(index)});buildWindowLibrary();drawer('panel',true);
  if(focus&&is3D())window.View3D?.flyToWindow(index);
}
function buildWindowLibrary(){
  const names=windowShapeNames();
  $('#windowLibrary').innerHTML=`<div class="editor-head window-head"><div class="eyebrow">WINDOW DESIGN</div><h2>${tr('窗户设置','Window design')}</h2><p>${tr('点击 3D 中的窗户或下方列表，修改立面形状与尺寸。','Click a window in 3D or in this list to edit its shape and dimensions.')}</p></div><div class="window-list">${WINS.map((r,i)=>{const s=windowSettings(r,i),w=Math.max(r[2]-r[0],r[3]-r[1]);return `<button data-window-select="${i}" class="${selectedWindowIndex()===i?'on':''}"><svg viewBox="-25 -3 50 42"><g transform="translate(0 35) scale(1 -1)"><path d="${windowProfilePath(s.shape,40,32)}" fill="#e3eef2" stroke="${s.frameColor}" stroke-width="2"/></g></svg><span><b>${esc(s.name)}</b><small>${names[s.shape]} · ${Math.round(w)} × ${s.height}</small><small>${tr('窗台','Sill')} ${s.sill} mm</small></span><i>›</i></button>`;}).join('')||`<p class="muted">${tr('当前画板还没有窗户。先在墙体上绘制窗洞。','No windows yet. Draw a window opening on a wall first.')}</p>`}</div><div class="editor-section"><button class="btn window-primary" id="drawNewWindow">＋ ${tr('在平面图添加窗户','Add a window in 2D')}</button><p class="field-help">${tr('修改宽度会同步调整墙上窗洞。高度与窗台高度共同决定窗户在 3D 中的位置。','Width changes update the wall opening. Window height and sill height determine its vertical position in 3D.')}</p><button class="btn" id="exitWindowMode">${tr('← 返回家具库','← Furniture library')}</button></div>`;
  $('#windowLibrary').querySelectorAll('[data-window-select]').forEach(b=>b.onclick=()=>selectWindow(+b.dataset.windowSelect,true));
  $('#drawNewWindow').onclick=async()=>{if(is3D())await setView('2d');toggleEditor(true);setEditTool('window');closeDrawers();};
  $('#exitWindowMode').onclick=()=>{select(null);setWindowMode(false);};
}
function renderWindowPanel(index){
  const ceiling=drawingSettings().floorHeight,rect=WINS[index],s=windowSettings(rect,index),horizontal=rect[2]-rect[0]>=rect[3]-rect[1],w=horizontal?rect[2]-rect[0]:rect[3]-rect[1],shapes=windowShapeNames();
  $('#panel').innerHTML=`<section class="window-properties"><div class="panel-caption"><i>▤</i><div><h3>${tr('窗户属性','Window properties')}</h3><small>${tr('2D / 3D 实时同步','Live 2D / 3D updates')} · mm</small></div></div>${windowPreview(rect,index)}<div class="form"><label class="full">${tr('窗户名称','Window name')}<input id="winName" maxlength="100" value="${esc(s.name)}"></label><label class="full">${tr('窗户形状','Window shape')}<select id="winShape">${Object.entries(shapes).map(([key,name])=>`<option value="${key}" ${key===s.shape?'selected':''}>${name}</option>`).join('')}</select></label>${numInput('winWidth',tr('窗户宽度','Window width')+' (mm)',w,100)}${numInput('winHeight',tr('窗户高度','Window height')+' (mm)',s.height,100)}${numInput('winSill',tr('窗台离地高度','Sill height')+' (mm)',s.sill,0)}<label>${tr('分格数量','Pane count')}<input id="winColumns" type="number" min="1" max="8" step="1" value="${s.columns}"></label><label>${tr('窗框颜色','Frame color')}<input id="winFrameColor" type="color" value="${s.frameColor}"></label></div><p class="field-help">${tr(`宽度沿墙体方向；高度为窗洞总高。当前房高 ${ceiling} mm，窗台高度与窗高之和不能超过房高。圆形窗在宽高不同时显示为椭圆。`,`Width follows the wall. Height is the full opening height. Sill plus height must fit the ${ceiling} mm room. Unequal round-window dimensions produce an oval.`)}</p><div class="actions"><button class="btn window-primary" id="applyWindow">${tr('应用窗户设置','Apply window settings')}</button><button class="btn" id="focusWindow">${tr('在 3D 中定位','Focus in 3D')}</button></div><div class="window-message" id="windowMessage" role="status"></div></section>
    <section><h3>${tr('平面位置与窗洞','Footprint and opening')}</h3>${rectForm(rect.slice(0,4))}<p class="field-help">${tr('X / Y 为平面窗洞左上角。沿墙宽度与墙厚分别对应平面宽深，可转向 90°。','X / Y mark the footprint corner. Footprint width and depth describe the opening and wall thickness.')}</p><div class="actions"><button class="btn" id="rotateOpening">${tr('转向 90°','Rotate 90°')}</button><button class="btn danger" id="deleteWindow">${tr('删除窗户','Delete window')}</button></div></section>`;
  const error=text=>{$('#windowMessage').textContent=text;$('#windowMessage').classList.add('error');};
  $('#applyWindow').onclick=()=>{
    const width=+$('#winWidth').value,height=+$('#winHeight').value,sill=+$('#winSill').value,columns=+$('#winColumns').value,shape=$('#winShape').value,name=$('#winName').value.trim()||s.name,frameColor=$('#winFrameColor').value;
    if(![width,height,sill,columns].every(Number.isFinite)||width<100||width>20000||height<100||height>ceiling||sill<0||sill+height>ceiling||!Number.isInteger(columns)||columns<1||columns>8)return error(tr(`请输入有效尺寸：宽度 100–20000 mm；窗台高度＋窗高 ≤ ${ceiling} mm；分格 1–8。`,`Enter width 100–20000 mm, sill + height ≤ ${ceiling} mm, and 1–8 panes.`));
    const b=rect.slice(0,4),center=horizontal?(b[0]+b[2])/2:(b[1]+b[3])/2;
    if(horizontal){b[0]=center-width/2;b[2]=center+width/2;}else{b[1]=center-width/2;b[3]=center+width/2;}
    mutate(()=>{if(b.some((v,i)=>v!==rect[i]))changeSelectedRect(b);WINS[index][4]={...s,name:name.slice(0,100),shape,height:Math.round(height),sill:Math.round(sill),columns,frameColor};});
    $('#windowMessage').textContent=tr('已应用并保存 · 2D 与 3D 已同步','Applied and saved · 2D / 3D synchronized');
  };
  $('#applyGeo').onclick=()=>{
    const b=[+$('#geoX').value,+$('#geoY').value,+$('#geoW').value,+$('#geoH').value];
    if(!b.every(Number.isFinite)||b[2]<20||b[3]<20||b.some(v=>Math.abs(v)>1e6))return error(tr('请输入有效的平面尺寸','Enter valid footprint dimensions'));
    mutate(()=>changeSelectedRect([b[0],b[1],b[0]+b[2],b[1]+b[3]]));
  };
  $('#rotateOpening').onclick=()=>{const cx=(rect[0]+rect[2])/2,cy=(rect[1]+rect[3])/2,d=rect[3]-rect[1],w=rect[2]-rect[0];mutate(()=>changeSelectedRect([cx-d/2,cy-w/2,cx+d/2,cy+w/2],false,true));};
  $('#deleteWindow').onclick=deleteGeometry;$('#backGeo').onclick=()=>select(null);
  $('#focusWindow').onclick=async()=>{if(switching)return;if(edit.active)toggleEditor(false);if(!is3D())await setView('3d');closeDrawers();window.View3D?.flyToWindow(index);};
}
renderPanel=function(){const index=selectedWindowIndex();if(index>=0&&WINS[index]){renderWindowPanel(index);return;}windowBase.renderPanel();};
renderAll=function(){if(selectedWindowIndex()>=0&&!WINS[selectedWindowIndex()])ui.sel=null;windowBase.renderAll();if(windowUI.active)buildWindowLibrary();};
renderOpenings=function(){
  windowBase.renderOpenings();if(edit.active)return;
  $('#gOpen').insertAdjacentHTML('beforeend',WINS.map((r,i)=>`<rect data-window-hit="${i}" x="${r[0]}" y="${r[1]}" width="${r[2]-r[0]}" height="${r[3]-r[1]}" fill="transparent" pointer-events="all"/>`).join(''));
};
renderSel=function(){
  windowBase.renderSel();const index=selectedWindowIndex();if(edit.active||index<0||!WINS[index])return;
  const r=WINS[index],s=windowSettings(r,index),k=1/view.s;$('#gSel').innerHTML=`<rect x="${r[0]}" y="${r[1]}" width="${r[2]-r[0]}" height="${r[3]-r[1]}" fill="#4a819222" stroke="#3c778b" stroke-width="2" vector-effect="non-scaling-stroke" pointer-events="none"/><text x="${(r[0]+r[2])/2}" y="${r[3]+20*k}" font-size="${11*k}" text-anchor="middle" fill="#356878" stroke="white" stroke-width="${3*k}" paint-order="stroke" pointer-events="none">${esc(s.name)} · ${Math.round(Math.max(r[2]-r[0],r[3]-r[1]))} × ${s.height} mm</text>`;
};
svg.addEventListener('pointerdown',e=>{if(edit.active||is3D()||ui.tool!=='select'||e.altKey||edit.space||e.button||systemsUI.drawing)return;const el=e.target.closest('[data-window-hit]');if(!el)return;e.preventDefault();e.stopImmediatePropagation();selectWindow(+el.dataset.windowHit);},true);
deleteSel=function(){if(ui.sel?.kind==='window')deleteGeometry();else windowBase.deleteSel();};
toggleEditor=function(on=!edit.active){const selected=!on&&ui.sel?.kind==='window'?{...ui.sel}:null;if(on)clearWindowMode();windowBase.toggleEditor(on);if(selected&&WINS[+selected.id])select(selected);};
setSystemsMode=function(on=true){if(on)clearWindowMode();windowBase.setSystemsMode(on);};
createOpening=function(rect,kind){windowBase.createOpening(rect,kind);if(kind==='window'){const i=WINS.length-1;WINS[i][4]=defaultWindowSettings(rect,i,false);}};
updateHeader=function(){windowBase.updateHeader();document.title=state.title+' · '+tr('户型设计','Floor plan');$('#renamePlan').title=tr('点击修改方案名称','Click to rename this plan');};
function renamePlan(){
  const d=$('#nameDialog');d.innerHTML=`<form id="renameForm"><div class="eyebrow">YOUR FLOOR PLAN</div><h2>${tr('修改方案名称','Rename plan')}</h2><label for="planNameInput">${tr('方案名称','Plan name')}</label><input id="planNameInput" maxlength="100" required value="${esc(state.title)}"><p>${tr('修改后自动保存，可撤销。','Changes auto-save and can be undone.')}</p><div class="actions"><button class="btn" type="button" id="cancelRename">${tr('取消','Cancel')}</button><button class="btn window-primary" type="submit">${tr('保存名称','Save name')}</button></div></form>`;
  $('#cancelRename').onclick=()=>d.close();$('#renameForm').onsubmit=e=>{e.preventDefault();const title=$('#planNameInput').value.trim();if(!title)return;mutate(()=>state.title=title.slice(0,100));d.close();};d.showModal();$('#planNameInput').focus();$('#planNameInput').select();
}
$('#renamePlan').onclick=renamePlan;$('#windowsEntry').onclick=()=>setWindowMode(!windowUI.active);
overviewPanel=function(){return `<section><div class="overview-plan-name"><span>${tr('当前方案','Current plan')}</span><button class="btn" id="overviewRename">${tr('✎ 修改名称','✎ Rename')}</button></div><b class="overview-title">${esc(state.title)}</b></section>`+windowBase.overviewPanel()+`<section><h3>${tr('窗户设置','Window design')} · ${WINS.length}</h3><p class="field-help">${tr('在 3D 中选择窗户，修改形状、宽度、窗高和窗台高度。','Select windows in 3D to edit shape, width, height and sill elevation.')}</p><button class="btn window-primary" id="overviewWindows">${tr('打开窗户设置','Open window design')}</button></section>`;};
bindOverview=function(){windowBase.bindOverview();$('#overviewRename').onclick=renamePlan;$('#overviewWindows').onclick=()=>setWindowMode(true);};
setLang=function(lang){windowBase.setLang(lang);if(windowUI.active)buildWindowLibrary();renderPanel();updateHeader();};
renderAll();
