/* Editable geometry extension. Original designer: wy51ai/floorplan-3d (MIT). */
const edit = {active:false,tool:'select',snap:50,thickness:240,linked:true,drag:null,polygon:[],space:false};
const baseRenderPanel = renderPanel, baseRenderSel = renderSel, baseRenderOpenings = renderOpenings;
const baseRenderAll = renderAll, baseSetTool = setTool, baseSyncModeHint = syncModeHint, baseDeleteSel = deleteSel;
const baseRenderDims = renderDims, baseSetLang = setLang, baseUpdateHeader = updateHeader;
const baseOverviewPanel = overviewPanel, baseBindOverview = bindOverview;
const geomNames = () => ({room:tr('房间','Room'),wall:tr('墙体','Wall'),window:tr('窗户','Window'),door:tr('平开门','Door'),slide:tr('推拉门','Sliding door')});
const geomCollections = {wall:'walls',window:'windows',door:'doors',slide:'slides'};
const toolsEditor = () => [
  ['select','↖',tr('选择 / 编辑','Select / edit')],['room','▱',tr('矩形房间','Rectangle room')],
  ['polygon','⬡',tr('异形房间','Polygon room')],['wall','▰',tr('绘制墙体','Draw wall')],
  ['door','⌜',tr('添加门','Add door')],['window','▤',tr('添加窗','Add window')],
  ['slide','⇆',tr('推拉门','Sliding door')],['measure','↔',tr('测量距离','Measure')]
];
const selectedObject = () => ui.sel?.kind === 'room' ? ROOMS.find(r=>r.id===ui.sel.id) : state.geometry[geomCollections[ui.sel?.kind]]?.[+ui.sel.id.replace(/^w/,'')];
const selectedRect = () => {
  const o = selectedObject(); if (!o) return null;
  return ui.sel.kind === 'room' ? bbox(o.poly) : ['wall','window'].includes(ui.sel.kind) ? o.slice(0,4) : o.rect.slice();
};
const roundEdit = n => Math.round(n / edit.snap) * edit.snap;
function validPolygon(poly){
  if (poly.length < 3 || area(poly) < .01) return false;
  const cross = (a,b,c) => (b[0]-a[0])*(c[1]-a[1]) - (b[1]-a[1])*(c[0]-a[0]);
  const on = (a,b,p) => Math.abs(cross(a,b,p)) < .01 && p[0]>=Math.min(a[0],b[0]) && p[0]<=Math.max(a[0],b[0]) && p[1]>=Math.min(a[1],b[1]) && p[1]<=Math.max(a[1],b[1]);
  const intersects = (a,b,c,d) => {
    const x = cross(a,b,c), y = cross(a,b,d), z = cross(c,d,a), w = cross(c,d,b);
    return (x*y<0 && z*w<0) || on(a,b,c) || on(a,b,d) || on(c,d,a) || on(c,d,b);
  };
  for(let i=0;i<poly.length;i++){
    if(Math.hypot(poly[i][0]-poly[(i+1)%poly.length][0],poly[i][1]-poly[(i+1)%poly.length][1]) < 10) return false;
    for(let j=i+1;j<poly.length;j++){
      if(j===i+1 || (i===0 && j===poly.length-1)) continue;
      if(intersects(poly[i],poly[(i+1)%poly.length],poly[j],poly[(j+1)%poly.length])) return false;
    }
  }
  return true;
}
function centerRoom(r){const b=bbox(r.poly);r.at=[(b[0]+b[2])/2,(b[1]+b[3])/2];}
function editorHint(){
  const hints = {
    select:tr('拖动房间边框改宽深 · 圆点改轮廓 · 双击边线加节点 · Alt / 空格拖动画面','Drag room edges to resize · dots edit outline · double-click an edge to add a point · Alt / Space pans'),
    room:tr('按住并拖动，绘制矩形房间','Drag to draw a rectangular room'),
    polygon:tr('逐点点击绘制轮廓 · 点击起点或 Enter 完成 · Esc 取消','Click points · click first point or Enter to finish · Esc cancels'),
    wall:tr('按住拖出水平或竖直墙体 · 墙厚可在左侧设置','Drag a horizontal or vertical wall · set thickness on the left'),
    door:tr('在墙上拖出门洞 · 系统会自动切开墙体','Drag along a wall to create a door opening'),
    window:tr('在墙上拖出窗洞 · 系统会自动切开墙体','Drag along a wall to create a window opening'),
    slide:tr('在墙上拖出推拉门洞','Drag along a wall to create a sliding door')
  };
  return hints[edit.tool] || '';
}
function setEditTool(tool){
  if(edit.drag) finishEditorDrag(true);
  edit.tool=tool; edit.polygon=[];
  baseSetTool(tool==='measure' ? 'measure' : 'select');
  svg.classList.toggle('draw-mode', !['select','measure'].includes(tool));
  $('#editorLibrary').querySelectorAll('[data-edit-tool]').forEach(b=>b.classList.toggle('on',b.dataset.editTool===tool));
  $('#modehint').textContent=editorHint(); $('#modehint').classList.toggle('show',!!editorHint());
  renderEdit(); renderDock(); renderBoardEmpty();
}
setTool = function(tool){
  if(edit.active && ['select','measure'].includes(tool)){setEditTool(tool);return;}
  if(edit.active) toggleEditor(false);
  baseSetTool(tool);
};
syncModeHint = function(){if(edit.active){$('#modehint').textContent=editorHint();$('#modehint').classList.toggle('show',!!editorHint());}else baseSyncModeHint();};
function toggleEditor(on=!edit.active){
  if(is3D()) return;
  if(edit.drag) finishEditorDrag(true);
  edit.active=on; edit.polygon=[];
  document.body.classList.toggle('editing',on);
  $('#editPlan').classList.toggle('on',on);
  $('#editPlan').textContent=on ? tr('✓ 完成户型编辑','✓ Finish editing') : tr('✎ 编辑户型','✎ Edit floor plan');
  $('#lib').hidden=on; $('#editorLibrary').hidden=!on; $('#editDock').hidden=!on;
  if(ui.sel && !['room','furn'].includes(ui.sel.kind)) ui.sel=null;
  if(on){if(ui.sel?.kind==='furn') ui.sel=null;buildEditorLibrary();setEditTool('select');drawer('lib',true);}
  else {baseSetTool('select'); svg.classList.remove('draw-mode');}
  renderAll();
}
function renderDock(){
  $('#editDock').innerHTML=`<b>✎ ${tr('户型编辑','Plan editor')}</b><span>${toolsEditor().find(t=>t[0]===edit.tool)?.[2]||''} · ${tr('单位','Units')} mm</span>${edit.tool==='polygon'?`<button id="finishPoly">${tr('完成轮廓','Finish outline')}</button>`:''}<button id="finishEdit">${tr('完成编辑','Done')}</button>`;
  $('#finishEdit').onclick=()=>toggleEditor(false);
  if($('#finishPoly')) $('#finishPoly').onclick=finishPolygon;
}
function buildEditorLibrary(){
  $('#editorLibrary').innerHTML=`<div class="editor-head"><div class="eyebrow">FLOOR PLAN EDITOR</div><h2>${tr('你的家，你来画','Draw your home')}</h2><p>${tr('修改现有户型，或从空白开始。每一次修改都可以撤销。','Edit this plan or start with a blank canvas. Every change can be undone.')}</p></div>
  <div class="edit-tools">${toolsEditor().map(([key,icon,label])=>`<button class="edit-tool ${key===edit.tool?'on':''}" data-edit-tool="${key}"><span>${icon}</span><b>${label}</b></button>`).join('')}</div>
  <div class="editor-section"><h3>${tr('绘制设置','Drawing settings')}</h3><div class="form"><label>${tr('吸附步长','Snap')} (mm)<select id="editSnap">${[10,50,100].map(v=>`<option value="${v}" ${v===edit.snap?'selected':''}>${v}</option>`).join('')}</select></label><label>${tr('墙体厚度','Wall thickness')} (mm)<input id="editThickness" type="number" min="50" max="1000" step="10" value="${edit.thickness}"></label></div><label class="check"><input type="checkbox" id="editLinked" ${edit.linked?'checked':''}><span>${tr('房间尺寸联动墙体、门窗及相邻房间','Link room resizing to walls, openings and adjacent rooms')}</span></label><div class="field-help">${tr('联动会伸缩房间所在的横向 / 纵向区段；控制点用于单独修改地面轮廓。','Linked resizing stretches the corresponding horizontal / vertical band; vertex handles edit the floor outline independently.')}</div></div>
  <div class="editor-section"><h3>${tr('户型底图','Tracing image')}</h3><button class="btn" id="addUnderlay">＋ ${tr('上传户型图片','Upload floor plan image')}</button>${state.underlay?`<div class="actions"><button class="btn" id="editUnderlay">${tr('调整底图','Adjust image')}</button><button class="btn danger" id="removeUnderlay">${tr('移除','Remove')}</button></div>`:''}<div class="field-help">${tr('支持 JPG、PNG、WebP。上传后自动识别墙体与房间，确认后生成可编辑户型；也可取消识别，保留作校准参考。','JPG, PNG, WebP. Uploads extract editable walls and rooms. Cancel recognition to keep a tracing reference.')}</div></div>
  <div class="editor-section"><h3>${tr('房间列表','Rooms')} · ${ROOMS.length}</h3><div class="list">${ROOMS.map(r=>`<button data-edit-room="${r.id}" class="${ui.sel?.id===r.id?'on':''}"><span>${esc(state.rooms[r.id].name)}</span><small>${area(r.poly).toFixed(2)} m²</small></button>`).join('')||`<p class="muted">${tr('选择绘图工具开始画房间','Choose a drawing tool to start')}</p>`}</div><div class="actions"><button class="btn" id="blankFromEditor">${tr('新建空白画板','New blank canvas')}</button><button class="btn" id="exampleFromEditor">${tr('载入示例户型','Load example')}</button></div></div>`;
  $('#editorLibrary').querySelectorAll('[data-edit-tool]').forEach(b=>b.onclick=()=>setEditTool(b.dataset.editTool));
  $('#editSnap').onchange=e=>edit.snap=+e.target.value;
  $('#editThickness').onchange=e=>{edit.thickness=Math.min(1000,Math.max(50,+e.target.value||240));e.target.value=edit.thickness;};
  $('#editLinked').onchange=e=>{edit.linked=e.target.checked;renderPanel();};
  $('#addUnderlay').onclick=()=>$('#imageIn').click();
  if($('#editUnderlay')) $('#editUnderlay').onclick=()=>{ui.sel={kind:'underlay',id:'image'};renderPanel();};
  if($('#removeUnderlay')) $('#removeUnderlay').onclick=()=>{ui.sel=null;mutate(()=>delete state.underlay);};
  $('#editorLibrary').querySelectorAll('[data-edit-room]').forEach(b=>b.onclick=()=>{setEditTool('select');select({kind:'room',id:b.dataset.editRoom});if(narrow())drawer('panel',true);});
  $('#blankFromEditor').onclick=newBlankPlan;
  $('#exampleFromEditor').onclick=loadExample;
}
function renderUnderlay(){
  const u=state.underlay;
  $('#gUnderlay').innerHTML=u?`<image x="${u.x}" y="${u.y}" width="${u.w}" height="${u.h}" opacity="${u.opacity}" href="${u.src}" preserveAspectRatio="none"/>`:'';
  $('#gRooms').style.opacity=u&&edit.active ? '.68' : '1';
}
renderOpenings = function(){
  baseRenderOpenings();
  if(!edit.active)return;
  const hit=(r,kind,i)=>`<rect x="${r[0]}" y="${r[1]}" width="${r[2]-r[0]}" height="${r[3]-r[1]}" fill="transparent" pointer-events="all" data-edit-kind="${kind}" data-edit-id="${i}"/>`;
  $('#gOpen').insertAdjacentHTML('beforeend',WINS.map((r,i)=>hit(r,'window',i)).join('')+DOORS.map((d,i)=>hit(d.rect,'door',i)).join('')+SLIDES.map((d,i)=>hit(d.rect,'slide',i)).join(''));
};
renderSel = function(){baseRenderSel();renderEdit();};
function renderEdit(){
  const layer=$('#gEdit'); if(!layer)return;
  if(!edit.active){layer.innerHTML='';return;}
  const k=1/view.s, radius=(COARSE?8:5)*k;
  const dot=(x,y,attrs)=>`<circle cx="${x}" cy="${y}" r="${(COARSE?17:11)*k}" fill="transparent" ${attrs}/><circle cx="${x}" cy="${y}" r="${radius}" fill="#fffdf9" stroke="#a75d3b" stroke-width="1.7" vector-effect="non-scaling-stroke" ${attrs}/>`;
  const b=selectedRect(), obj=selectedObject(); let s='';
  if(b&&obj){
    const [x0,y0,x1,y1]=b;
    if(ui.sel.kind==='room'){
      s+=`<polygon data-edit-move="1" points="${obj.poly.map(p=>p.join(',')).join(' ')}" fill="#b5653a10" stroke="#a75d3b" stroke-width="2" vector-effect="non-scaling-stroke"/>`;
      obj.poly.forEach((p,i)=>{const q=obj.poly[(i+1)%obj.poly.length];s+=`<line x1="${p[0]}" y1="${p[1]}" x2="${q[0]}" y2="${q[1]}" stroke="transparent" stroke-width="12" vector-effect="non-scaling-stroke" data-edit-segment="${i}"><title>${tr('双击增加轮廓节点','Double-click to add a vertex')}</title></line>`;});
      s+=`<rect x="${x0}" y="${y0}" width="${x1-x0}" height="${y1-y0}" fill="none" stroke="#a75d3b" stroke-dasharray="4 4" stroke-width="1" vector-effect="non-scaling-stroke" pointer-events="none"/>`;
      [['left',x0,(y0+y1)/2],['right',x1,(y0+y1)/2],['top',(x0+x1)/2,y0],['bottom',(x0+x1)/2,y1]].forEach(([edge,x,y])=>{s+=`<rect x="${x-5*k}" y="${y-5*k}" width="${10*k}" height="${10*k}" rx="${2*k}" fill="#a75d3b" data-edit-edge="${edge}"><title>${tr('拖动修改房间尺寸','Drag to resize room')}</title></rect>`;});
      obj.poly.forEach((p,i)=>s+=dot(p[0],p[1],`data-edit-handle="vertex" data-vertex="${i}"`));
    }else{
      s+=`<rect data-edit-move="1" x="${x0}" y="${y0}" width="${x1-x0}" height="${y1-y0}" fill="#b5653a22" stroke="#a75d3b" stroke-width="2" vector-effect="non-scaling-stroke"/>`;
      s+=dot(x0,y0,'data-edit-handle="start"')+dot(x1,y1,'data-edit-handle="end"');
    }
    s+=`<text x="${(x0+x1)/2}" y="${y1+22*k}" font-size="${12*k}" text-anchor="middle" fill="#a75d3b" stroke="#fffdf9" stroke-width="${3*k}" paint-order="stroke" pointer-events="none">${Math.round(x1-x0)} × ${Math.round(y1-y0)} mm</text>`;
  }
  if(edit.drag?.kind==='draw'){
    const r=drawingRect(edit.drag.a,edit.drag.b);
    s+=`<rect x="${r[0]}" y="${r[1]}" width="${r[2]-r[0]}" height="${r[3]-r[1]}" fill="#2f5d6225" stroke="#2f5d62" stroke-width="2" stroke-dasharray="6 4" vector-effect="non-scaling-stroke" pointer-events="none"/><text x="${r[0]}" y="${r[1]-12*k}" font-size="${12*k}" fill="#2f5d62" pointer-events="none">${Math.round(r[2]-r[0])} × ${Math.round(r[3]-r[1])} mm</text>`;
  }
  if(edit.polygon.length){
    s+=`<polyline points="${edit.polygon.map(p=>p.join(',')).join(' ')}" fill="#2f5d6218" stroke="#2f5d62" stroke-width="2" vector-effect="non-scaling-stroke" pointer-events="none"/>`;
    edit.polygon.forEach((p,i)=>s+=dot(p[0],p[1],`data-poly-point="${i}"`));
  }
  layer.innerHTML=s;
}
renderAll = function(){
  baseRenderAll();renderUnderlay();
  if(edit.active){buildEditorLibrary();renderDock();}
  renderEdit();renderBoardEmpty();
};
updateHeader = function(){
  baseUpdateHeader();
  $('.brand b').textContent=state.title;
  $('#editPlan').textContent=edit.active?tr('✓ 完成户型编辑','✓ Finish editing'):tr('✎ 编辑户型','✎ Edit floor plan');
  $('#blankBoard').classList.toggle('on',!!state.whiteboard);
  document.body.classList.toggle('whiteboard',!!state.whiteboard);
  if(state.whiteboard){const total=ROOMS.filter(r=>r.counted!==false).reduce((a,r)=>a+area(r.poly),0);$('#subtitle').textContent=tr(`使用面积 ${total.toFixed(2)} m² · 尺寸单位 mm · 自定义户型`,`Floor area ${total.toFixed(2)} m² · Units: mm · Custom floor plan`);}
};
overviewPanel = function(){return `<section><h3>${tr('自定义我的户型','Customize my floor plan')}</h3><div class="custom-plan-note">${tr('房间轮廓、尺寸、墙体、门窗都可以自己修改。空白画板可从零开始绘制。','Edit room outlines, dimensions, walls and openings, or start from an empty canvas.')}</div><div class="custom-plan-actions"><button class="btn edit-entry" id="overviewEdit">${tr('✎ 编辑户型','✎ Edit floor plan')}</button><button class="btn whiteboard-entry" id="overviewBlank">${tr('▢ 空白画板','▢ Blank canvas')}</button></div></section>`+baseOverviewPanel();};
bindOverview = function(){baseBindOverview();$('#overviewEdit').onclick=async()=>{if(is3D())await setView('2d');toggleEditor(true);};$('#overviewBlank').onclick=newBlankPlan;};
// Preserve original dimension chains only while the original geometry is unchanged.
renderDims = function(){
  const footprint=g=>({...g,windows:g.windows.map(r=>r.slice(0,4))});
  if(JSON.stringify(footprint(state.geometry))===JSON.stringify(footprint(DEFAULT_GEOMETRY))){baseRenderDims();return;}
  const points=[...ROOMS.flatMap(r=>r.poly),...WALLS.flatMap(w=>[[w[0],w[1]],[w[2],w[3]]])];
  const g=$('#gDims'); if(!points.length){g.innerHTML='';return;}
  const [x0,y0,x1,y1]=bbox(points), gap=650;
  const line=(a,b)=>`<path d="M${a[0]} ${a[1]}L${b[0]} ${b[1]}" stroke="#7d7160" stroke-width="1" vector-effect="non-scaling-stroke"/>`;
  let s=line([x0,y0-gap],[x1,y0-gap])+line([x0-gap,y0],[x0-gap,y1]);
  for(const x of [x0,x1])s+=line([x,y0-gap-120],[x,y0-gap+120]);
  for(const y of [y0,y1])s+=line([x0-gap-120,y],[x0-gap+120,y]);
  s+=`<text x="${(x0+x1)/2}" y="${y0-gap-100}" font-size="200" text-anchor="middle" fill="#7d7160">${Math.round(x1-x0)}</text><text x="${x0-gap-100}" y="${(y0+y1)/2}" transform="rotate(-90 ${x0-gap-100} ${(y0+y1)/2})" font-size="200" text-anchor="middle" fill="#7d7160">${Math.round(y1-y0)}</text>`;
  g.innerHTML=s;g.setAttribute('display',ui.layers.dims?'inline':'none');
};
const numInput=(id,label,value,min=null)=>`<label>${label}<input id="${id}" type="number" step="10" ${min!==null?`min="${min}"`:''} value="${Math.round(value)}"></label>`;
function rectForm(b,room=false){return `<div class="form geometry-form">${numInput('geoX','X (mm)',b[0])}${numInput('geoY','Y (mm)',b[1])}${numInput('geoW',tr('宽度','Width')+' (mm)',b[2]-b[0],room?100:20)}${numInput('geoH',tr('深度','Depth')+' (mm)',b[3]-b[1],room?100:20)}${room?`<label class="check"><input type="checkbox" id="geoLinked" ${edit.linked?'checked':''}><span>${tr('修改宽深时联动墙体、门窗、相邻房间','Link width/depth changes to walls, openings, adjacent rooms')}</span></label>`:''}</div><div class="actions"><button class="btn primary" id="applyGeo">${tr('应用尺寸','Apply dimensions')}</button><button class="btn" id="backGeo">${tr('取消选择','Deselect')}</button></div>`;}
renderPanel = function(){
  if(!edit.active){baseRenderPanel();return;}
  $('#fab').classList.remove('show');
  const p=$('#panel'), obj=selectedObject(), b=selectedRect(), kind=ui.sel?.kind;
  if(kind==='underlay'&&state.underlay){renderUnderlayPanel();return;}
  if(!obj||!b){
    p.innerHTML=`<section><div class="panel-caption"><i>⌂</i><div><h3>${tr('户型设置','Plan settings')}</h3><small>${tr('从这里开始修改你的家','Start editing your home')}</small></div></div><div class="form"><label class="full">${tr('方案名称','Plan name')}<input id="planTitle" value="${esc(state.title)}"></label></div><div class="stats" style="margin-top:14px"><div><small>${tr('房间','Rooms')}</small><span class="big">${ROOMS.filter(r=>r.counted!==false).length}</span></div><div><small>${tr('使用面积','Floor area')}</small><span class="big">${ROOMS.filter(r=>r.counted!==false).reduce((a,r)=>a+area(r.poly),0).toFixed(1)}</span> m²</div></div><div class="note">${tr('点击房间、墙体或门窗即可编辑。选中房间后，方形手柄调整宽深，圆形手柄调整轮廓。','Select a room, wall or opening to edit. Square handles resize rooms; circular handles edit the outline.')}</div></section><section><h3>${tr('绘制新户型','Draw a new plan')}</h3><p class="muted">${tr('先画房间轮廓，再添加墙体和门窗，最后切回家具布置并查看 3D。','Draw room outlines, add walls and openings, then furnish and preview in 3D.')}</p><div class="actions"><button class="btn" id="helpEditor">${tr('查看操作说明','View help')}</button></div></section><section><h3>${tr('保存与备份','Save and backup')}</h3><p class="muted">${tr('方案自动保存在当前浏览器。点击「保存方案」下载 JSON 备份，之后可通过文件菜单导入。','Changes are saved in this browser. Save a JSON backup to restore the plan through the File menu.')}</p><button class="btn" id="backupEditor">${tr('保存方案备份','Save backup')}</button></section>`;
    $('#planTitle').onchange=e=>mutate(()=>state.title=e.target.value.trim()||state.title);
    $('#helpEditor').onclick=showHelp;$('#backupEditor').onclick=backupPlan;
    return;
  }
  if(kind==='room'){
    p.innerHTML=`<section><div class="panel-caption"><i>▱</i><div><h3>${tr('房间轮廓','Room outline')}</h3><small>${obj.poly.length} ${tr('个节点','vertices')}</small></div></div><div class="form"><label class="full">${tr('房间名称','Room name')}<input id="geoName" value="${esc(state.rooms[obj.id].name)}"></label></div><div class="stats" style="margin:12px 0"><div><small>${tr('面积','Area')}</small><span class="big">${area(obj.poly).toFixed(2)}</span> m²</div><div><small>${tr('周长','Perimeter')}</small><span class="big">${perim(obj.poly).toFixed(1)}</span> m</div></div>${rectForm(b,true)}<div class="field-help">${tr('联动调整作用于整个坐标区段。拖动内部仅移动房间地面轮廓；墙体、门窗可分别选中修改。','Linked resizing affects the entire coordinate band. Dragging the interior moves only the floor outline; walls and openings can be edited separately.')}</div></section><section><h3>${tr('轮廓节点','Outline vertices')} <small>mm</small></h3><div class="vertex-list">${obj.poly.map((v,i)=>`<div class="vertex-row"><span>${i+1}</span><input aria-label="${tr('节点','Vertex')} ${i+1} X" type="number" step="10" data-v="${i}" data-axis="0" value="${Math.round(v[0])}"><input aria-label="${tr('节点','Vertex')} ${i+1} Y" type="number" step="10" data-v="${i}" data-axis="1" value="${Math.round(v[1])}"><button data-remove-v="${i}" title="${tr('删除节点','Delete vertex')}" ${obj.poly.length<=3?'disabled':''}>×</button></div>`).join('')}</div><div class="field-help">${tr('双击图中的房间边线可插入节点。轮廓不能交叉。','Double-click an outline edge to add a vertex. Edges cannot cross.')}</div><div class="actions"><button class="btn" id="roomCount">${obj.counted===false?tr('计入使用面积','Include in floor area'):tr('不计入使用面积','Exclude from floor area')}</button><button class="btn danger" id="deleteGeo">${tr('删除房间轮廓','Delete room outline')}</button></div></section><section><h3>${tr('地面材料','Flooring')}</h3><div class="mats">${Object.entries(MATS).map(([id,m])=>`<button class="mat ${id===state.rooms[obj.id].mat?'on':''}" data-editor-mat="${id}"><i style="background:${m.sw}"></i><span>${nm(m.name)}<small>¥${m.price}/m²</small></span></button>`).join('')}</div></section>`;
    $('#geoName').onchange=e=>mutate(()=>state.rooms[obj.id].name=e.target.value.trim()||state.rooms[obj.id].name);
    $('#geoLinked').onchange=e=>{edit.linked=e.target.checked;$('#editLinked').checked=edit.linked;};
    p.querySelectorAll('[data-v]').forEach(input=>input.onchange=()=>{
      const poly=cloneData(obj.poly),v=+input.value;if(!Number.isFinite(v)||Math.abs(v)>1000000){renderPanel();return;}
      poly[+input.dataset.v][+input.dataset.axis]=Math.round(v);
      if(!validPolygon(poly)){toast(tr('轮廓不能交叉或重合','Outline edges cannot cross or overlap'));renderPanel();return;}
      mutate(()=>{obj.poly=poly;centerRoom(obj);});
    });
    p.querySelectorAll('[data-remove-v]').forEach(button=>button.onclick=()=>{
      const poly=obj.poly.filter((_,i)=>i!==+button.dataset.removeV);if(!validPolygon(poly))return toast(tr('删除后轮廓无效','This would create an invalid outline'));
      mutate(()=>{obj.poly=poly;centerRoom(obj);});
    });
    $('#roomCount').onclick=()=>mutate(()=>obj.counted=obj.counted===false);
    p.querySelectorAll('[data-editor-mat]').forEach(button=>button.onclick=()=>mutate(()=>state.rooms[obj.id].mat=button.dataset.editorMat));
  }else{
    p.innerHTML=`<section><div class="panel-caption"><i>${kind==='wall'?'▰':'⌜'}</i><div><h3>${geomNames()[kind]}</h3><small>${tr('位置与尺寸','Position and size')} · mm</small></div></div>${rectForm(b)}${kind==='wall'?`<div class="form" style="margin-top:14px"><label class="full">${tr('墙体类型','Wall type')}<select id="wallType">${[['n',tr('普通隔墙','Partition')],['e',tr('外墙','Exterior')],['b',tr('承重墙标识','Load-bearing marker')],['low',tr('矮墙','Low wall')]].map(([v,n])=>`<option value="${v}" ${obj[4]===v?'selected':''}>${n}</option>`).join('')}</select></label></div>`:''}<div class="actions">${['door','slide','window'].includes(kind)?`<button class="btn" id="rotateOpening">${tr('转向 90°','Rotate 90°')}</button>`:''}${kind==='door'?`<button class="btn" id="flipDoor">${tr('反向开门','Flip swing')}</button>`:''}<button class="btn danger" id="deleteGeo">${tr('删除','Delete')}</button></div><div class="field-help">${tr('拖动内部移动，拖动两端圆点调整尺寸。删除或移动门窗时会补回旧墙段，并在新位置切开墙体。','Drag to move; drag endpoints to resize. Moving or deleting an opening fills the old gap; the new opening cuts through walls.')}</div></section>`;
    if($('#wallType'))$('#wallType').onchange=e=>mutate(()=>obj[4]=e.target.value);
    if($('#flipDoor'))$('#flipDoor').onclick=()=>mutate(()=>{obj.o=obj.o.map(v=>-v);});
    if($('#rotateOpening'))$('#rotateOpening').onclick=()=>{
      const cx=(b[0]+b[2])/2,cy=(b[1]+b[3])/2,w=b[2]-b[0],h=b[3]-b[1];
      mutate(()=>changeSelectedRect([cx-h/2,cy-w/2,cx+h/2,cy+w/2],false,true));
    };
  }
  $('#applyGeo').onclick=()=>{
    const x=+$('#geoX').value,y=+$('#geoY').value,w=+$('#geoW').value,h=+$('#geoH').value;
    if(![x,y,w,h].every(Number.isFinite)||w<(kind==='room'?100:20)||h<(kind==='room'?100:20)||[x,y,w,h].some(v=>Math.abs(v)>1000000))return toast(tr('请输入有效的毫米尺寸','Enter valid dimensions in mm'));
    mutate(()=>changeSelectedRect([x,y,x+w,y+h],kind==='room'&&edit.linked));
  };
  $('#backGeo').onclick=()=>select(null);$('#deleteGeo').onclick=deleteGeometry;
}
function mapAxis(axis,old0,old1,new0,new1){
  const transform=v=>Math.round(v<=old0?v+new0-old0:v>=old1?v+new1-old1:new0+(v-old0)*(new1-new0)/(old1-old0));
  const rect=r=>{r[axis]=transform(r[axis]);r[axis+2]=transform(r[axis+2]);};
  WALLS.forEach(rect);WINS.forEach(rect);SLIDES.forEach(d=>rect(d.rect));
  DOORS.forEach(d=>{rect(d.rect);d.h[axis]=transform(d.h[axis]);d.len=Math.abs(d.c[axis])?d.rect[axis+2]-d.rect[axis]:d.len;});
  ROOMS.forEach(r=>{r.poly.forEach(p=>p[axis]=transform(p[axis]));if(r.at)r.at[axis]=transform(r.at[axis]);});
  state.furniture.forEach(f=>{const key=axis?'cy':'cx';f[key]=transform(f[key]);});
  state.measures.forEach(m=>{const key=axis?'y':'x';m.a[key]=transform(m.a[key]);m.b[key]=transform(m.b[key]);});
}
function mapDoorRect(d,b,rotate=false){
  const old=d.rect, vertical=b[3]-b[1]>b[2]-b[0];
  if(rotate || (Math.abs(d.c[1])===1)!==vertical){
    d.c=vertical?[0,-1]:[1,0];d.o=vertical?[1,0]:[0,1];d.h=vertical?[b[2],b[3]]:[b[0],b[1]];
  }else d.h=[b[0]+(d.h[0]-old[0])/(old[2]-old[0])*(b[2]-b[0]),b[1]+(d.h[1]-old[1])/(old[3]-old[1])*(b[3]-b[1])];
  d.len=vertical?b[3]-b[1]:b[2]-b[0];d.rect=b.slice();
}
function changeSelectedRect(b,linked=false,rotate=false,openingCommit=true){
  const o=selectedObject(),old=selectedRect(),kind=ui.sel.kind;if(!o)return;
  if(kind==='room'){
    if(linked){mapAxis(0,old[0],old[2],b[0],b[2]);mapAxis(1,old[1],old[3],b[1],b[3]);}
    else {o.poly=o.poly.map(p=>[Math.round(b[0]+(p[0]-old[0])*(b[2]-b[0])/(old[2]-old[0])),Math.round(b[1]+(p[1]-old[1])*(b[3]-b[1])/(old[3]-old[1]))]);centerRoom(o);}
  }else{
    if(['window','door','slide'].includes(kind)&&openingCommit) fillOldOpening(old,kind);
    if(kind==='wall'||kind==='window')o.splice(0,4,...b);
    else if(kind==='door')mapDoorRect(o,b,rotate);
    else {o.rect=b.slice();o.v=b[3]-b[1]>b[2]-b[0];}
    if(['window','door','slide'].includes(kind)&&openingCommit)cutOpening(b);
  }
}
// Keep demolition markers aligned when a wall is split or removed.
function replaceWallList(transform){
  const next=[],dem=[];
  WALLS.forEach((w,i)=>transform(w,i).forEach(part=>{if(state.demolished.includes('w'+i))dem.push('w'+next.length);next.push(part);}));
  state.geometry.walls=next;WALLS=next;state.demolished=dem;
}
function cutOpening(r){
  replaceWallList(w=>{
    const x0=Math.max(w[0],r[0]),y0=Math.max(w[1],r[1]),x1=Math.min(w[2],r[2]),y1=Math.min(w[3],r[3]);
    if(x1<=x0||y1<=y0)return[w];
    const out=[];const add=(a,b,c,d)=>{if(c-a>=1&&d-b>=1)out.push([a,b,c,d,w[4],...(w[5]?[cloneData(w[5])]:[])]);};
    add(w[0],w[1],x0,w[3]);add(x1,w[1],w[2],w[3]);add(x0,w[1],x1,y0);add(x0,y1,x1,w[3]);return out;
  });
}
function fillOldOpening(r,kind){WALLS.push([...r,kind==='window'?'e':'n']);}
function deleteGeometry(){
  if(!ui.sel)return;
  const kind=ui.sel.kind,id=ui.sel.id;
  mutate(()=>{
    if(kind==='room'){state.geometry.rooms=ROOMS.filter(r=>r.id!==id);delete state.rooms[id];}
    else if(kind==='wall')replaceWallList((w,i)=>i===+id.replace(/^w/,'')?[]:[w]);
    else if(geomCollections[kind]){const r=selectedRect();fillOldOpening(r,kind);state.geometry[geomCollections[kind]].splice(+id,1);}
    ui.sel=null;
  });
}
deleteSel = function(){if(edit.active&&ui.sel&&ui.sel.kind!=='furn'){deleteGeometry();return;}baseDeleteSel();};
function drawingRect(a,b){
  if(edit.tool==='room')return[Math.min(a.x,b.x),Math.min(a.y,b.y),Math.max(a.x,b.x),Math.max(a.y,b.y)];
  const horizontal=Math.abs(b.x-a.x)>=Math.abs(b.y-a.y),t=edit.thickness;
  return horizontal?[Math.min(a.x,b.x),a.y-t/2,Math.max(a.x,b.x),a.y+t/2]:[a.x-t/2,Math.min(a.y,b.y),a.x+t/2,Math.max(a.y,b.y)];
}
function createRoom(poly){
  const id='room_'+Date.now().toString(36)+(_n++),r={id,name:tr('新房间','New room')+' '+(ROOMS.length+1),poly,mat:'wood'};
  centerRoom(r);ROOMS.push(r);state.rooms[id]={name:r.name,mat:r.mat};ui.sel={kind:'room',id};
}
function createOpening(rect,kind){
  const vertical=rect[3]-rect[1]>rect[2]-rect[0],collection=state.geometry[geomCollections[kind]],i=collection.length;
  cutOpening(rect);
  if(kind==='window')collection.push(rect.slice());
  else if(kind==='slide')collection.push({rect:rect.slice(),v:vertical});
  else collection.push({name:tr('房间门','Room door'),rect:rect.slice(),h:vertical?[rect[2],rect[3]]:[rect[0],rect[1]],c:vertical?[0,-1]:[1,0],o:vertical?[1,0]:[0,1],len:vertical?rect[3]-rect[1]:rect[2]-rect[0]});
  ui.sel={kind,id:String(i)};
}
function finishPolygon(){
  const poly=cloneData(edit.polygon);
  if(!validPolygon(poly))return toast(tr('至少需要三个节点，且轮廓不能交叉','Use at least three vertices with no crossing edges'));
  edit.polygon=[];mutate(()=>createRoom(poly));setEditTool('select');
}
function hitObject(target){
  const opening=target.closest('[data-edit-kind]');if(opening)return{kind:opening.dataset.editKind,id:opening.dataset.editId};
  const wall=target.closest('[data-wall]');if(wall)return{kind:'wall',id:wall.dataset.wall};
  const room=target.closest('[data-room]');if(room)return{kind:'room',id:room.dataset.room};
  if(target.closest('[data-edit-move],[data-edit-handle],[data-edit-edge],[data-edit-segment]'))return ui.sel;
  return null;
}
svg.addEventListener('pointerdown',e=>{
  if(!edit.active||is3D()||e.button!==0||edit.tool==='measure')return;
  if(e.altKey||edit.space)return;
  // A second touch hands off to the original pinch / pan implementation.
  if(e.pointerType!=='mouse'&&touches.size){finishEditorDrag(true);return;}
  e.preventDefault();e.stopImmediatePropagation();
  const p=toMM(e),q=geometryPoint(p,e);
  if(edit.tool==='polygon'){
    if(edit.polygon.length>=3 && (e.target.closest('[data-poly-point="0"]')||Math.hypot(p.x-edit.polygon[0][0],p.y-edit.polygon[0][1])*view.s<14)){finishPolygon();return;}
    edit.polygon.push([q.x,q.y]);renderEdit();renderDock();return;
  }
  if(edit.tool!=='select'){edit.drag={kind:'draw',a:q,b:q,before:snap(),pointerId:e.pointerId};ui.sel=null;renderPanel();}
  else{
    const sel=hitObject(e.target);
    if(!sel){select(null);return;}
    const handle=e.target.closest('[data-edit-handle]'),edge=e.target.closest('[data-edit-edge]');
    select(sel);
    edit.drag={kind:handle?handle.dataset.editHandle:edge?'edge':'move',edge:edge?.dataset.editEdge,vertex:+handle?.dataset.vertex,selection:{...ui.sel},before:snap(),rect:selectedRect(),origin:q,startX:e.clientX,startY:e.clientY,moved:false,pointerId:e.pointerId};
  }
  if(e.pointerType!=='mouse') touches.set(e.pointerId,{x:e.clientX,y:e.clientY});
  svg.setPointerCapture(e.pointerId);
},true);
svg.addEventListener('pointermove',e=>{
  if(!edit.drag||e.pointerId!==edit.drag.pointerId)return;
  e.preventDefault();e.stopImmediatePropagation();
  const d=edit.drag,p=toMM(e),q=geometryPoint(p,e);
  if(d.kind==='draw'){d.b=q;renderEdit();return;}
  if(!d.moved&&Math.hypot(e.clientX-d.startX,e.clientY-d.startY)<TAP)return;
  d.moved=true;state=JSON.parse(d.before);syncGeometry();ui.sel={...d.selection};
  const o=selectedObject(),b=d.rect.slice(),dx=q.x-d.origin.x,dy=q.y-d.origin.y;
  if(d.kind==='vertex'){
    const poly=cloneData(o.poly);poly[d.vertex]=[q.x,q.y];
    if(validPolygon(poly)){o.poly=poly;centerRoom(o);}else{state=JSON.parse(d.lastValid||d.before);syncGeometry();}
  }else{
    if(d.kind==='move'){b[0]+=dx;b[2]+=dx;b[1]+=dy;b[3]+=dy;}
    else if(d.kind==='start'){b[0]=Math.min(q.x,b[2]-20);b[1]=Math.min(q.y,b[3]-20);}
    else if(d.kind==='end'){b[2]=Math.max(q.x,b[0]+20);b[3]=Math.max(q.y,b[1]+20);}
    else if(d.kind==='edge'){
      if(d.edge==='left')b[0]=Math.min(q.x,b[2]-100);if(d.edge==='right')b[2]=Math.max(q.x,b[0]+100);
      if(d.edge==='top')b[1]=Math.min(q.y,b[3]-100);if(d.edge==='bottom')b[3]=Math.max(q.y,b[1]+100);
    }
    if(!e.ctrlKey&&!e.metaKey)alignGeometryRect(b,d.kind);
    changeSelectedRect(b,d.kind==='edge'&&edit.linked,false,false);
  }
  d.lastValid=snap();
  renderRooms();renderFurn();renderWalls();renderOpenings();renderLabels();renderDims();renderSel();
},true);
function finishEditorDrag(cancel=false){
  const d=edit.drag;if(!d)return;edit.drag=null;
  if(cancel){state=JSON.parse(d.before);syncGeometry();renderAll();return;}
  if(d.kind==='draw'){
    const r=drawingRect(d.a,d.b),len=Math.max(r[2]-r[0],r[3]-r[1]);
    if((edit.tool==='room'&&(r[2]-r[0]<100||r[3]-r[1]<100))||len<100){renderEdit();return;}
    mutate(()=>{
      if(edit.tool==='room')createRoom(R(...r));
      else if(edit.tool==='wall'){WALLS.push([...r,'n']);const openings=[...WINS,...DOORS.map(x=>x.rect),...SLIDES.map(x=>x.rect)];openings.forEach(cutOpening);ui.sel=null;}
      else createOpening(r,edit.tool);
    });
    setEditTool('select');
  }else if(d.moved){
    if(['door','window','slide'].includes(ui.sel?.kind)){fillOldOpening(d.rect,ui.sel.kind);cutOpening(selectedRect());}
    validatePlan(state);commit(d.before);renderAll();
  }
  else renderEdit();
}
svg.addEventListener('pointerup',e=>{if(edit.drag&&e.pointerId===edit.drag.pointerId){touches.delete(e.pointerId);e.stopImmediatePropagation();finishEditorDrag(false);}},true);
svg.addEventListener('pointercancel',e=>{if(edit.drag&&e.pointerId===edit.drag.pointerId){touches.delete(e.pointerId);e.stopImmediatePropagation();finishEditorDrag(true);}},true);
svg.addEventListener('dblclick',e=>{
  if(!edit.active)return;
  const edge=e.target.closest('[data-edit-segment]');if(!edge||ui.sel?.kind!=='room')return;
  e.stopImmediatePropagation();const r=selectedObject(),i=+edge.dataset.editSegment,p=toMM(e),a=r.poly[i],b=r.poly[(i+1)%r.poly.length];
  const length=(b[0]-a[0])**2+(b[1]-a[1])**2,t=Math.max(.02,Math.min(.98,((p.x-a[0])*(b[0]-a[0])+(p.y-a[1])*(b[1]-a[1]))/length));
  const q=[Math.round(a[0]+(b[0]-a[0])*t),Math.round(a[1]+(b[1]-a[1])*t)];
  mutate(()=>r.poly.splice(i+1,0,q));
},true);
document.addEventListener('keydown',e=>{
  if(e.target.matches('input,select,textarea'))return;
  if(e.code==='Space'){edit.space=true;if(edit.active)e.preventDefault();}
  if(!edit.active)return;
  if(e.key==='Enter'&&edit.tool==='polygon'){e.preventDefault();e.stopImmediatePropagation();finishPolygon();}
  if(e.key==='Escape'){
    e.preventDefault();e.stopImmediatePropagation();if(edit.drag)finishEditorDrag(true);edit.polygon=[];setEditTool('select');select(null);
  }
},true);
document.addEventListener('keyup',e=>{if(e.code==='Space')edit.space=false;});
window.addEventListener('blur',()=>{edit.space=false;if(edit.drag)finishEditorDrag(true);});
function renderUnderlayPanel(){
  const u=state.underlay;
  $('#panel').innerHTML=`<section><h3>${tr('户型底图','Tracing image')}</h3><div class="form">${numInput('underX','X (mm)',u.x)}${numInput('underY','Y (mm)',u.y)}${numInput('underW',tr('图片宽度','Image width')+' (mm)',u.w,100)}<label>${tr('透明度','Opacity')}<input id="underOpacity" type="number" min="0.05" max="1" step="0.05" value="${u.opacity}"></label></div><div class="actions"><button class="btn primary" id="applyUnderlay">${tr('应用','Apply')}</button><button class="btn" id="backUnderlay">${tr('返回','Back')}</button></div><div class="note">${tr('用图片中一条已知尺寸校准比例。例如当前绘出的线段是 4000mm，原图标注 3000mm，则将图片宽度乘以 3000/4000。','Calibrate with a known dimension. If a measured span is 4000mm but the drawing says 3000mm, multiply image width by 3000/4000.')}</div></section>`;
  $('#applyUnderlay').onclick=()=>{const x=+$('#underX').value,y=+$('#underY').value,w=+$('#underW').value,opacity=+$('#underOpacity').value;
    if(![x,y,w,opacity].every(Number.isFinite)||w<100||w>1000000||Math.abs(x)>1000000||Math.abs(y)>1000000)return toast(tr('请输入有效数值','Enter valid values'));
    mutate(()=>{u.h*=w/u.w;u.w=w;u.x=x;u.y=y;u.opacity=Math.max(.05,Math.min(1,opacity));});};
  $('#backUnderlay').onclick=()=>select(null);
}
function setGridVisible(on){ui.layers.grid=on;document.querySelector('[data-layer="grid"]').classList.toggle('on',on);}
async function newBlankPlan(){
  if(switching)return toast(tr('请等待视图切换完成','Wait for the view transition'));
  if(is3D())await setView('2d');
  if(edit.drag)finishEditorDrag(true);
  const before=snap();state={version:2,whiteboard:true,title:tr('我的户型 · 空白画板','My floor plan · Blank canvas'),geometry:{walls:[],windows:[],doors:[],slides:[],rooms:[]},rooms:{},furniture:[],demolished:[],measures:[],systems:{routes:[],heating:[]},decor:{walls:[],customMaterials:[]}};
  ui.sel=null;edit.polygon=[];commit(before);syncGeometry();setGridVisible(true);toggleEditor(true);closeDrawers();fitView();
  toast(tr('已创建空白画板 · 撤销可恢复上一方案','Blank canvas ready · Undo restores the previous plan'));
}
async function loadExample(){
  if(switching)return;
  if(is3D())await setView('2d');
  if(edit.drag)finishEditorDrag(true);
  const before=snap();state=defaultState();ui.sel=null;edit.polygon=[];commit(before);syncGeometry();setGridVisible(false);toggleEditor(true);closeDrawers();fitView();
}
function renderBoardEmpty(){
  const container=$('#boardEmpty');
  const empty=!ROOMS.length&&!WALLS.length&&!WINS.length&&!DOORS.length&&!SLIDES.length&&!state.furniture.length&&!state.underlay;
  const show=empty&&!is3D()&&(!edit.active||edit.tool==='select');
  container.hidden=!show;if(!show)return;
  $('#modehint').classList.remove('show');
  // Preserve entered dimensions during harmless sidebar or language updates.
  const width=$('#blankRoomW')?.value||4000,depth=$('#blankRoomH')?.value||3000;
  container.innerHTML=`<div class="board-card"><div class="eyebrow">YOUR HOME, YOUR PLAN</div><h2>${tr('空白画板，从这里开始','A blank canvas for your home')}</h2><p>${tr('自由绘制你想要的户型。画房间、加墙体与门窗，再布置家具和查看 3D。','Draw your own rooms, walls and openings, then furnish and preview in 3D.')}</p><div class="board-quick"><button id="blankDrawRoom"><i>▱</i>${tr('画矩形房间','Rectangle room')}</button><button id="blankDrawPolygon"><i>⬡</i>${tr('画异形房间','Polygon room')}</button><button id="blankUpload"><i>↥</i>${tr('上传户型图','Upload drawing')}</button></div><div class="board-dimensions"><h3>${tr('也可以按尺寸创建第一个房间','Or create your first room by dimensions')}</h3><div class="board-inputs"><label>${tr('宽度','Width')} (mm)<input id="blankRoomW" type="number" min="100" max="100000" step="100" value="${Number(width)||4000}"></label><label>${tr('深度','Depth')} (mm)<input id="blankRoomH" type="number" min="100" max="100000" step="100" value="${Number(depth)||3000}"></label><button id="blankCreateRoom">${tr('创建房间','Create room')}</button></div><label class="board-wall-option"><input type="checkbox" id="blankWithWalls" checked>${tr('同时生成四面墙，之后可以修改和添加门窗','Generate four walls, ready for editing and openings')}</label></div><div class="board-bottom"><span>${tr('自由拖绘 · 毫米尺寸 · 支持撤销','Draw freely · Millimetres · Undo supported')}</span><button id="blankLoadExample">${tr('载入示例户型 →','Load example →')}</button></div></div>`;
  const start=tool=>{if(!edit.active)toggleEditor(true);closeDrawers();setEditTool(tool);};
  $('#blankDrawRoom').onclick=()=>start('room');$('#blankDrawPolygon').onclick=()=>start('polygon');$('#blankUpload').onclick=()=>$('#imageIn').click();$('#blankLoadExample').onclick=loadExample;
  $('#blankCreateRoom').onclick=()=>{
    const w=+$('#blankRoomW').value,h=+$('#blankRoomH').value,walls=$('#blankWithWalls').checked;
    if(![w,h].every(v=>Number.isFinite(v)&&v>=100&&v<=100000))return toast(tr('房间宽深请输入 100–100000mm','Enter room dimensions between 100 and 100000mm'));
    if(!edit.active)toggleEditor(true);setEditTool('select');
    mutate(()=>{createRoom(R(0,0,Math.round(w),Math.round(h)));if(walls){const t=edit.thickness;WALLS.push([-t,-t,w+t,0,'n'],[-t,h,w+t,h+t,'n'],[-t,0,0,h,'n'],[w,0,w+t,h,'n']);}});
    closeDrawers();fitView();if(narrow())drawer('panel',true);
  };
}
function backupPlan(){
  save();download((state.title||tr('户型装修方案','floor-plan'))+'.json',new Blob([JSON.stringify(state,null,2)],{type:'application/json'}));
  toast(tr('方案备份已下载，可通过「文件 → 导入方案」恢复','Backup downloaded. Restore through File → Import plan.'));
}
const savedBadge=document.createElement('span');savedBadge.id='saveStatus';savedBadge.className='saved-status';savedBadge.textContent=tr('方案自动保存到本机','Plans auto-save to this browser');$('footer').appendChild(savedBadge);
save = function(){
  try{localStorage.setItem(STORE,JSON.stringify(state));savedBadge.textContent=tr('已保存到本机','Saved in this browser')+' · '+new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});savedBadge.classList.remove('error');}
  catch(err){savedBadge.textContent=tr('本机存储已满，请保存 JSON 备份','Browser storage full. Save a JSON backup.');savedBadge.classList.add('error');}
};
$('#editPlan').onclick=()=>toggleEditor();$('#savePlan').onclick=backupPlan;$('#newPlan').onclick=newBlankPlan;$('#blankBoard').onclick=newBlankPlan;
$('#importImage').onclick=()=>$('#imageIn').click();
$('#imageIn').onchange=async e=>{
  const file=e.target.files[0];e.target.value='';if(!file)return;
  if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>15*1024*1024)return toast(tr('请选择 15MB 以内的 JPG / PNG / WebP 图片','Choose a JPG, PNG or WebP image under 15MB'));
  try{
    const bitmap=await createImageBitmap(file),scale=Math.min(1,1600/Math.max(bitmap.width,bitmap.height)),canvas=document.createElement('canvas');canvas.width=Math.round(bitmap.width*scale);canvas.height=Math.round(bitmap.height*scale);
    const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close();
    const src=canvas.toDataURL('image/jpeg',.8),w=10000,h=w*canvas.height/canvas.width;
    mutate(()=>state.underlay={src,x:0,y:0,w,h,opacity:.55});if(is3D())await setView('2d');toggleEditor(true);ui.sel={kind:'underlay',id:'image'};renderPanel();
    view.s=Math.min(svg.clientWidth/(w+2500),svg.clientHeight/(h+2500));view.x0=-1250;view.y0=-1250;applyView();
    if(narrow())drawer('panel',true);
    toast(tr('底图已上传，可调整比例后描绘房间','Image loaded. Set its scale and trace rooms.'));
  }catch(err){toast(tr('图片读取失败，请换一张图片','Could not read the image. Try another file.'));}
};
$('#fileIn').onchange=async e=>{
  const file=e.target.files[0];e.target.value='';if(!file)return;
  if(file.size>20*1024*1024)return toast(tr('方案文件过大','Plan file is too large'));
  try{
    const next=fixState(JSON.parse(await file.text()));if(!next.geometry.rooms.every(r=>validPolygon(r.poly)))throw new Error('Invalid polygon');
    const before=snap();state=next;ui.sel=null;commit(before);renderAll();fitView();toast(tr('户型与家具方案已导入','Plan geometry and furniture imported'));
  }catch(err){toast(tr('文件格式不正确，或户型数据无效','Invalid file format or plan geometry'));}
};
function showHelp(){
  const d=$('#helpDialog');d.innerHTML=`<h2>${tr('把户型改成你的家','Make this plan your home')}</h2><p>${tr('从原始户型开始，也可以上传自己的户型图片。','Start with this plan, or upload your own drawing.')}</p>
  ${[[tr('进入编辑户型','Enter the plan editor'),tr('点击顶部「编辑户型」。选中房间、墙体或门窗后，右侧会显示尺寸和位置。','Click Edit floor plan. Select a room, wall or opening to see dimensions and position.')],[tr('调整尺寸和轮廓','Adjust size and outline'),tr('输入宽深或拖动方形手柄可修改尺寸；拖动圆形节点可修改异形轮廓。开启联动后，区段内的墙体、门窗和房间一起调整。','Enter dimensions or drag square handles to resize. Drag circular handles for custom outlines. Linked resizing updates walls, openings and rooms in the coordinate band.')],[tr('从空白画板绘制','Draw on a blank canvas'),tr('点击顶部「空白画板」从零开始。可直接输入房间尺寸并生成四面墙，或自由画矩形、异形房间，也可上传自己的图纸描绘。然后在墙上添加门窗。','Click Blank canvas to start empty. Enter room dimensions and generate walls, draw rectangle or polygon rooms, or upload a tracing image. Then add openings.')],[tr('布置、看 3D、保存','Furnish, preview, save'),tr('点击「完成编辑」返回家具布置。修改会同步到 3D；方案自动保存在当前浏览器，点「保存方案」下载包含户型的备份文件。','Finish editing to furnish the plan. Geometry updates in 3D. Changes auto-save in this browser; Save backup downloads the entire plan.')]].map(([title,body],i)=>`<div class="guide-step"><b>${i+1}</b><div><strong>${title}</strong><p>${body}</p></div></div>`).join('')}<div class="help-bottom"><a href="https://github.com/wy51ai/floorplan-3d" target="_blank" rel="noopener">${tr('基于原开源项目 · MIT 许可','Based on the original open-source project · MIT')}</a><button class="btn primary" id="closeHelp">${tr('开始设计','Start designing')}</button></div>`;
  $('#closeHelp').onclick=()=>d.close();d.showModal();
}
$('#helpPlan').onclick=showHelp;
$('#helpDialog').addEventListener('click',e=>{if(e.target===$('#helpDialog')){const r=e.target.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)e.target.close();}});
// Close geometry editing before the 3D view takes over pointer interaction.
document.querySelectorAll('[data-view="3d"]').forEach(b=>b.addEventListener('click',()=>{if(edit.active)toggleEditor(false);},true));
setLang = function(lang){baseSetLang(lang);if(edit.active){buildEditorLibrary();renderPanel();renderDock();syncModeHint();}updateHeader();};
// Preserve the saved title and geometry on the very first frame.
renderAll();
if(state.whiteboard){setGridVisible(true);toggleEditor(true);closeDrawers();}
