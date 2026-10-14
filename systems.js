/* Equipment placement, editable service routes and room heating overlays. */
const systemsUI={active:false,tab:'ac',drawing:null,points:[],hover:null,drag:null,layers:{ac:true,fresh:true,heat:true,power:true}};
const systemVisible=key=>systemsUI.layers[key]!==false;
const systemNames=()=>({ac:tr('空调','Air conditioning'),fresh:tr('新风','Ventilation'),heat:tr('地暖','Floor heating'),power:tr('插座','Sockets')});
const systemBase={renderAll,renderPanel,renderSel,furnPanel,bindFurnPanel,furnSVG,addItem,deleteSel,toggleEditor,setTool,setLang,syncGeometry,mapAxis,buildLib,overviewPanel,bindOverview,renderBoardEmpty};
const systemData=()=>state.systems ||= {routes:[],heating:[]};
const getRoute=id=>systemData().routes.find(r=>r.id===id);
const getHeating=id=>systemData().heating.find(r=>r.id===id);
function updateSystemProperty(fn){
  // Preserve the field receiving focus when a neighboring input commits on blur.
  systemsUI.keepPanel=true;try{mutate(fn);}finally{systemsUI.keepPanel=false;}
  const h=ui.sel?.kind==='heating'?getHeating(ui.sel.id):null;
  if(h&&$('.heating-stats'))$('.heating-stats').children[2].textContent=pathLength(heatingPaths(h)).toFixed(1)+' m';
}
function systemFormNumber(id,value,label,min,max){return `<label>${label} (mm)<input id="${id}" type="number" value="${value}" min="${min}" max="${max}" step="10"></label>`;}
function systemHint(){
  if(!systemsUI.drawing)return;
  $('#modehint').textContent=tr('逐点点击绘制管线 · Enter 或「完成管线」保存 · Esc 取消 · Shift 锁定水平/竖直','Click route points · Enter or Finish saves · Esc cancels · Shift locks an axis');$('#modehint').classList.add('show');
}
function cancelSystemDrawing(){systemsUI.drawing=null;systemsUI.points=[];systemsUI.hover=null;svg.classList.remove('system-drawing');syncModeHint();renderSystemOverlay();renderBoardEmpty();$('#systemDock').hidden=true;}
function setSystemsMode(on=true){
  if(on&&edit.active)systemBase.toggleEditor(false);
  cancelSystemDrawing();systemsUI.active=on;
  $('#systemsEntry').classList.toggle('on',on);$('#systemLibrary').hidden=!on;$('#lib').hidden=on||edit.active;
  if(on){setTool('select');buildSystemLibrary();drawer('lib',true);}else if(!edit.active)$('#lib').hidden=false;
  renderAll();
}
toggleEditor=function(on=!edit.active){if(on){systemsUI.active=false;cancelSystemDrawing();$('#systemsEntry').classList.remove('on');$('#systemLibrary').hidden=true;}systemBase.toggleEditor(on);};
setTool=function(t){if(systemsUI.drawing)cancelSystemDrawing();systemBase.setTool(t);};
function buildSystemLibrary(){
  const tab=systemsUI.tab,names=systemNames(),catalog=SYSTEM_CATALOGUE.find(c=>c.system===tab),routes=Object.entries(ROUTE_TYPES).filter(([,v])=>v.system===tab);
  const guides={ac:tr('放置内机和外机，添加出风口与回风口，再绘制连接管。','Place indoor / outdoor units and vents, then draw their connections.'),fresh:tr('放置新风主机和送 / 排风口，再分别绘制送风管、排风管。','Place the ventilation unit and outlets, then draw supply and extract ducts.'),heat:tr('选择房间生成盘管，调整管间距和方向；分集水器、温控器可单独放置。','Generate coils for a room and edit spacing / direction. Place manifolds and thermostats separately.'),power:tr('拖放插座，调整位置、旋转和离地高度，用备注标记用途。','Place sockets, edit position, rotation and height, and add a purpose note.')};
  $('#systemLibrary').innerHTML=`<div class="editor-head system-head"><div class="eyebrow">HOME SYSTEMS</div><h2>${tr('设备与布点','Home systems')}</h2><p>${tr('位置、管线、安装高度都由你决定。','Edit equipment positions, routes and installation heights.')}</p></div>
    <div class="system-tabs">${Object.entries(names).map(([k,n])=>`<button data-system-tab="${k}" class="${tab===k?'on':''}">${n}</button>`).join('')}</div>
    <div class="system-guide"><b>${names[tab]} · ${tr('怎么布置','Layout steps')}</b><p>${guides[tab]}</p></div>
    <div class="system-items lib-grid">${catalog.items.map(it=>{const ci=LIB.indexOf(catalog),ii=catalog.items.indexOf(it),pad=Math.max(it[2],it[3])*.12;return `<div class="item" data-system-item="${it[0]}" data-key="${ci}:${ii}"><svg viewBox="${-it[2]/2-pad} ${-it[3]/2-pad} ${it[2]+pad*2} ${it[3]+pad*2}">${furnSVG(it[0],it[2],it[3],it[4])}</svg><b>${esc(nm(it[1]))}</b><small>${it[2]}×${it[3]} mm</small></div>`;}).join('')}</div>
    ${routes.length?`<div class="editor-section"><h3>${tr('管线绘制','Draw routes')}</h3><div class="system-route-buttons">${routes.map(([k,v])=>`<button class="btn" data-route-start="${k}" style="--route-color:${v.color}">＋ ${tr(v.name,v.en)}</button>`).join('')}</div></div>`:''}
    ${tab==='heat'?heatingLibrary():''}
    <div class="editor-section"><h3>${tr('图层显示','Visible layers')}</h3><div class="system-layers">${Object.entries(names).map(([k,n])=>`<label><input type="checkbox" data-system-layer="${k}" ${systemVisible(k)?'checked':''}>${n}</label>`).join('')}</div></div>
    <div class="editor-section"><h3>${tr('已布置设备','Placed equipment')} · ${state.furniture.filter(f=>equipmentSystem(f)===tab).length}</h3><div class="system-list">${state.furniture.filter(f=>equipmentSystem(f)===tab).map(f=>`<button data-system-select="${f.id}"><span>${esc(nm(f.name))}</span><small>${installation(f)} mm ↑</small></button>`).join('')||`<span class="muted">${tr('点击或拖放上方设备开始布置','Click or drag equipment above to start')}</span>`}</div></div>
    <div class="system-note">${tr('高度为设备底部离完成地面距离。这里用于方案布置，设备选型、管路计算和施工尺寸需由设计人员确认。','Height is measured from finished floor to equipment bottom. This is a layout sketch; equipment sizing and construction details need design review.')}</div>
    <div class="editor-section"><button class="btn" id="backFurniture">${tr('← 返回家具库','← Furniture library')}</button></div>`;
  $('#systemLibrary').querySelectorAll('[data-system-tab]').forEach(b=>b.onclick=()=>{cancelSystemDrawing();systemsUI.tab=b.dataset.systemTab;buildSystemLibrary();});
  $('#systemLibrary').querySelectorAll('.item').forEach(el=>el.onpointerdown=e=>{if(!e.button){cancelSystemDrawing();libDrag={el,id:e.pointerId,sx:e.clientX,sy:e.clientY,it:itemOf(el),ghost:null};}});
  $('#systemLibrary').querySelectorAll('[data-route-start]').forEach(b=>b.onclick=()=>startSystemRoute(b.dataset.routeStart));
  $('#systemLibrary').querySelectorAll('[data-system-layer]').forEach(b=>b.onchange=()=>{systemsUI.layers[b.dataset.systemLayer]=b.checked;renderAll();});
  $('#systemLibrary').querySelectorAll('[data-system-select]').forEach(b=>b.onclick=()=>{select({kind:'furn',id:b.dataset.systemSelect});drawer('prop',true);});
  $('#backFurniture').onclick=()=>setSystemsMode(false);
  if($('#addRoomHeating'))$('#addRoomHeating').onclick=()=>addRoomHeating($('#heatRoom').value,+$('#heatSpacing').value,$('#heatAxis').value);
  $('#systemLibrary').querySelectorAll('[data-heating-select]').forEach(b=>b.onclick=()=>{select({kind:'heating',id:b.dataset.heatingSelect});drawer('prop',true);});
}
function heatingLibrary(){
  const rooms=ROOMS.filter(r=>r.counted!==false),selected=ui.sel?.kind==='room'?ui.sel.id:null;
  return `<div class="editor-section"><h3>${tr('按房间铺设地暖','Room heating coils')}</h3>${rooms.length?`<div class="form"><label class="full">${tr('房间','Room')}<select id="heatRoom">${rooms.map(r=>`<option value="${r.id}" ${r.id===selected?'selected':''}>${esc(nm(state.rooms[r.id].name))} · ${area(r.poly).toFixed(1)} m²</option>`).join('')}</select></label><label>${tr('管间距','Spacing')} (mm)<input id="heatSpacing" type="number" min="100" max="500" step="10" value="200"></label><label>${tr('盘管方向','Direction')}<select id="heatAxis"><option value="x">${tr('横向','Horizontal')}</option><option value="y">${tr('纵向','Vertical')}</option></select></label></div><button class="btn system-primary" id="addRoomHeating">＋ ${tr('生成 / 更新房间盘管','Generate / update coils')}</button>`:`<p class="muted">${tr('先在「编辑户型」中绘制房间，再铺设地暖。','Draw a room in the floor plan editor first.')}</p>`}<div class="system-list">${systemData().heating.filter(h=>ROOMS.some(r=>r.id===h.roomId)).map(h=>`<button data-heating-select="${h.id}"><span>${esc(nm(state.rooms[h.roomId].name))}</span><small>${h.spacing} mm · ${pathLength(heatingPaths(h)).toFixed(1)} m</small></button>`).join('')}</div></div>`;
}
function addRoomHeating(roomId,spacing=200,axis='x'){
  const room=ROOMS.find(r=>r.id===roomId);if(!room)return;
  if(!Number.isFinite(spacing))return toast(tr('请输入有效管间距','Enter a valid spacing'));
  let zone=systemData().heating.find(h=>h.roomId===roomId);
  mutate(()=>{if(!zone){zone={id:uid(),roomId,spacing:200,margin:150,axis:'x',color:'#cd7950'};systemData().heating.push(zone);}Object.assign(zone,{spacing:Math.max(100,Math.min(500,Math.round(spacing))),axis});ui.sel={kind:'heating',id:zone.id};});
  if(!heatingPaths(zone).length)toast(tr('房间较小，请减小边距或管间距','Room is too small; reduce margin or spacing'));
  closeDrawers();renderPanel();
}
async function startSystemRoute(type){
  if(switching)return;if(is3D())await setView('2d');
  if(edit.active)toggleEditor(false);setTool('select');systemsUI.drawing=type;systemsUI.points=[];systemsUI.hover=null;ui.sel=null;closeDrawers();
  svg.classList.add('system-drawing');systemHint();$('#systemDock').hidden=false;$('#systemDock').innerHTML=`<b>${tr(ROUTE_TYPES[type].name,ROUTE_TYPES[type].en)}</b><span>${tr('逐点点击 · Shift 锁轴','Click points · Shift locks axis')}</span><button id="finishRoute">${tr('完成管线','Finish route')}</button><button id="cancelRoute">${tr('取消','Cancel')}</button>`;
  $('#finishRoute').onclick=finishSystemRoute;$('#cancelRoute').onclick=cancelSystemDrawing;renderSel();renderSystemOverlay();renderBoardEmpty();
}
function finishSystemRoute(){
  if(!systemsUI.drawing)return;if(systemsUI.points.length<2)return toast(tr('至少点击两个管线节点','Place at least two points'));
  const def=ROUTE_TYPES[systemsUI.drawing],r={id:uid(),type:systemsUI.drawing,name:tr(def.name,def.en),color:def.color,diameter:def.diameter,height:def.height,points:cloneData(systemsUI.points)};
  cancelSystemDrawing();mutate(()=>{systemData().routes.push(r);ui.sel={kind:'route',id:r.id};});
}
const systemPolyline=p=>p.map(v=>v.join(',')).join(' ');
function renderSystemOverlay(){
  const sys=systemData();let s='';
  if(systemVisible('heat'))sys.heating.forEach(h=>{const room=ROOMS.find(r=>r.id===h.roomId);if(!room)return;const paths=heatingPaths(h);s+=`<g data-heating="${h.id}"><polygon class="heating-hit" points="${systemPolyline(room.poly)}" fill="${h.color}" fill-opacity=".075" stroke="${h.color}" stroke-width="1" stroke-dasharray="4 3" vector-effect="non-scaling-stroke"/><g pointer-events="none">${paths.map(p=>`<polyline points="${systemPolyline(p)}" fill="none" stroke="${h.color}" stroke-width="1.4" vector-effect="non-scaling-stroke"/>`).join('')}</g></g>`;});
  sys.routes.filter(r=>systemVisible(ROUTE_TYPES[r.type].system)).forEach(r=>s+=`<g data-system-route="${r.id}"><polyline class="route-hit" points="${systemPolyline(r.points)}" fill="none" stroke="transparent" stroke-width="16" vector-effect="non-scaling-stroke"/><polyline points="${systemPolyline(r.points)}" fill="none" stroke="${r.color}" stroke-opacity=".3" stroke-width="${r.diameter}" pointer-events="none"/><polyline points="${systemPolyline(r.points)}" fill="none" stroke="${r.color}" stroke-width="2" ${r.type==='freshexhaust'?'stroke-dasharray="6 3"':''} vector-effect="non-scaling-stroke" pointer-events="none"/></g>`);
  $('#gSystems').innerHTML=s;
  $('#gSystems').style.pointerEvents=edit.active?'none':'auto';
  $('#gSystems').querySelectorAll('.heating-hit').forEach(el=>el.style.pointerEvents=systemsUI.active&&systemsUI.tab==='heat'&&!edit.active?'auto':'none');
  if(systemsUI.drawing&&systemsUI.points.length){const p=[...systemsUI.points,...(systemsUI.hover?[systemsUI.hover]:[])];$('#gSystemEdit').innerHTML=`<polyline points="${systemPolyline(p)}" fill="none" stroke="${ROUTE_TYPES[systemsUI.drawing].color}" stroke-width="2" stroke-dasharray="5 3" vector-effect="non-scaling-stroke"/>${systemsUI.points.map(v=>`<circle cx="${v[0]}" cy="${v[1]}" r="${5/view.s}" fill="white" stroke="#2f5d62" vector-effect="non-scaling-stroke"/>`).join('')}`;}
  else renderSystemSelection();
  document.querySelectorAll('#gFurn > .furn').forEach(el=>{const f=getF(el.dataset.fid),sys=equipmentSystem(f);if(sys)el.setAttribute('display',systemVisible(sys)?'inline':'none');});
}
function renderSystemSelection(){
  const r=ui.sel?.kind==='route'?getRoute(ui.sel.id):null,h=ui.sel?.kind==='heating'?getHeating(ui.sel.id):null;
  let s='';if(r&&systemVisible(ROUTE_TYPES[r.type].system)){s=`<polyline points="${systemPolyline(r.points)}" fill="none" stroke="#285f65" stroke-width="4" opacity=".3" vector-effect="non-scaling-stroke"/>`;s+=r.points.map((p,i)=>`<circle data-route-point="${i}" cx="${p[0]}" cy="${p[1]}" r="${6/view.s}" fill="white" stroke="#285f65" stroke-width="2" vector-effect="non-scaling-stroke"/>`).join('');}
  if(h&&systemVisible('heat')){const room=ROOMS.find(r=>r.id===h.roomId);if(room)s=`<polygon points="${systemPolyline(room.poly)}" fill="none" stroke="#285f65" stroke-width="2" vector-effect="non-scaling-stroke"/>`;}
  $('#gSystemEdit').innerHTML=s;
}
renderSel=function(){systemBase.renderSel();if(!systemsUI.drawing)renderSystemSelection();};
renderAll=function(){
  systemData();if(ui.sel?.kind==='route'&&!getRoute(ui.sel.id)||ui.sel?.kind==='heating'&&(!getHeating(ui.sel.id)||!ROOMS.some(r=>r.id===getHeating(ui.sel.id).roomId)))ui.sel=null;
  systemBase.renderAll();renderSystemOverlay();if(systemsUI.active)buildSystemLibrary();systemHint();
};
renderBoardEmpty=function(){systemBase.renderBoardEmpty();if(systemData().routes.length||systemsUI.drawing)$('#boardEmpty').hidden=true;};
syncGeometry=function(){systemBase.syncGeometry();const points=[...state.furniture.filter(equipmentSystem).flatMap(f=>[[f.cx-f.w/2,f.cy-f.d/2],[f.cx+f.w/2,f.cy+f.d/2]]),...systemData().routes.flatMap(r=>r.points)];if(points.length){const b=bbox(points),x=Math.min(BOUNDS.x,b[0]-1000),y=Math.min(BOUNDS.y,b[1]-1000),right=Math.max(BOUNDS.x+BOUNDS.w,b[2]+1000),bottom=Math.max(BOUNDS.y+BOUNDS.h,b[3]+1000);Object.assign(BOUNDS,{x,y,w:right-x,h:bottom-y});}};
mapAxis=function(axis,old0,old1,new0,new1){systemBase.mapAxis(axis,old0,old1,new0,new1);const transform=v=>Math.round(v<=old0?v+new0-old0:v>=old1?v+new1-old1:new0+(v-old0)*(new1-new0)/(old1-old0));systemData().routes.forEach(r=>r.points.forEach(p=>p[axis]=transform(p[axis])));};
furnPanel=function(f){
  const html=systemBase.furnPanel(f);if(!equipmentSystem(f))return html;
  return html.replace(tr('家具属性','Furniture'),tr('设备属性','Equipment'))+`<section><h3>${tr('安装设置','Installation')}</h3><div class="form">${systemFormNumber('fInstallHeight',installation(f),tr('离地高度','Mounting height'),0,10000)}${systemFormNumber('fUnitHeight',equipmentHeight(f),tr('设备高度','Equipment height'),10,3000)}<label class="full">${tr('用途 / 备注','Purpose / note')}<input id="fSystemNote" maxlength="500" value="${esc(f.note||'')}" placeholder="${tr('例如：客厅电视墙、室外设备平台','e.g. living room TV wall')}"></label></div><p class="field-help">${tr('离地高度指设备底部。出风方向随旋转角度改变。','Height refers to the equipment bottom. Rotate to change outlet orientation.')}</p></section>`;
};
bindFurnPanel=function(f){systemBase.bindFurnPanel(f);if(!equipmentSystem(f))return;['fInstallHeight','fUnitHeight'].forEach((id,i)=>$('#'+id).onchange=e=>{const v=+e.target.value;if(Number.isFinite(v)){e.target.value=Math.min(i?3000:10000,Math.max(i?10:0,v));updateSystemProperty(()=>getF(f.id)[i?'unitHeight':'installHeight']=+e.target.value);}});$('#fSystemNote').onchange=e=>updateSystemProperty(()=>getF(f.id).note=e.target.value.slice(0,500));};
addItem=function(it,x,y){
  if(!SYSTEM_DEFAULTS[it[0]])return systemBase.addItem(it,x,y);
  cancelSystemDrawing();if(edit.active)toggleEditor(false);const [type,name,w,d,color]=it,f=F(type,name,Math.round(x/10)*10,Math.round(y/10)*10,w,d,0,color);f.installHeight=SYSTEM_DEFAULTS[type][1];f.unitHeight=SYSTEM_DEFAULTS[type][2];
  [f.cx,f.cy]=snapMove(f,f.cx,f.cy);showAlignment();mutate(()=>{state.furniture.push(f);ui.sel={kind:'furn',id:f.id};});toast(tr(`已添加「${name}」· 右侧修改安装高度`,`Added ${nm(name)} · edit mounting height on the right`));
};
furnSVG=function(t,w,d,c){
  if(!SYSTEM_DEFAULTS[t]||['acwall','aircon'].includes(t))return systemBase.furnSVG(t,w,d,c);
  const rect=(x,y,rw,rh,fill=c)=>`<rect x="${x}" y="${y}" width="${rw}" height="${rh}" rx="${Math.min(16,rw*.05)}" fill="${fill}" stroke="#485e66" stroke-width="1" vector-effect="non-scaling-stroke"/>`;
  let s=rect(-w/2,-d/2,w,d);
  if(['freshin','freshout'].includes(t))return `<circle r="${Math.min(w,d)/2}" fill="${c}" stroke="#485e66" vector-effect="non-scaling-stroke"/><path d="M${-w*.2} 0H${w*.2}M0 ${-d*.2}V${d*.2}" stroke="#fff" stroke-width="2" vector-effect="non-scaling-stroke"/>`;
  if(['acvent','acreturn'].includes(t))for(let i=1;i<=4;i++)s+=`<path d="M${-w*.43} ${-d/2+d*i/5}H${w*.43}" stroke="#485e66" stroke-width="1" vector-effect="non-scaling-stroke"/>`;
  else if(t==='acoutdoor')s+=`<circle cx="${-w*.15}" r="${d*.35}" fill="#849ba4"/><path d="M${w*.28} ${-d*.35}V${d*.35}" stroke="#485e66" vector-effect="non-scaling-stroke"/>`;
  else if(['socket','acsocket','wetsocket','thermostat'].includes(t))s+=`<text x="0" y="${d*.25}" text-anchor="middle" font-size="${d*.8}" fill="#385862">${t==='thermostat'?'T':t==='acsocket'?'A':'• •'}</text>`;
  else if(t==='manifold')for(let i=0;i<6;i++)s+=rect(-w*.42+w*i*.15,-d*.38,w*.06,d*.76,i%2?'#599fa9':'#d7835c');
  else s+=rect(-w*.34,-d*.3,w*.68,d*.6,'#f4faf9');return s;
};
function routePanel(r){return `<section><h3>${tr('管线属性','Route properties')}</h3><div class="form"><label class="full">${tr('名称','Name')}<input id="routeName" maxlength="100" value="${esc(r.name)}"></label>${systemFormNumber('routeDiameter',r.diameter,tr('管径 / 示意宽度','Diameter / width'),10,1000)}${systemFormNumber('routeHeight',r.height,tr('中心离地高度','Center height'),0,10000)}<label>${tr('颜色','Color')}<input id="routeColor" type="color" value="${r.color}"></label></div><p>${tr('管线长度','Route length')} <b>${pathLength([r.points]).toFixed(2)} m</b> · ${r.points.length} ${tr('个节点','points')}</p><div class="route-points">${r.points.map((p,i)=>`<div><b>${i+1}</b><input aria-label="X ${i+1}" data-route-x="${i}" type="number" value="${p[0]}"><input aria-label="Y ${i+1}" data-route-y="${i}" type="number" value="${p[1]}"><button data-remove-point="${i}" ${r.points.length<=2?'disabled':''}>×</button></div>`).join('')}</div><p class="field-help">${tr('拖动节点改路径；拖动管线整体移动；双击管线增加节点。','Drag points to reshape, drag the route to move it, or double-click to insert a point.')}</p><div class="actions"><button class="btn" id="dupRoute">${tr('复制','Duplicate')}</button><button class="btn danger" id="deleteSystem">${tr('删除','Delete')}</button><button class="btn" id="systemBack">${tr('← 返回','← Back')}</button></div></section>`;}
function heatPanel(h){const room=ROOMS.find(r=>r.id===h.roomId),paths=heatingPaths(h);return `<section><h3>${tr('地暖盘管','Heating coils')} · ${esc(nm(state.rooms[h.roomId].name))}</h3><div class="form">${systemFormNumber('zoneSpacing',h.spacing,tr('管间距','Spacing'),100,500)}${systemFormNumber('zoneMargin',h.margin,tr('距房间边界','Edge margin'),50,1000)}<label>${tr('方向','Direction')}<select id="zoneAxis"><option value="x" ${h.axis==='x'?'selected':''}>${tr('横向','Horizontal')}</option><option value="y" ${h.axis==='y'?'selected':''}>${tr('纵向','Vertical')}</option></select></label><label>${tr('颜色','Color')}<input id="zoneColor" type="color" value="${h.color}"></label></div><div class="heating-stats"><b>${area(room.poly).toFixed(2)} m²</b><span>${tr('房间面积','Room area')}</span><b>${pathLength(paths).toFixed(1)} m</b><span>${tr('图上盘管长度','Drawn pipe length')}</span></div><p class="field-help">${tr('房间轮廓修改后自动重新生成。盘管是布置示意，不含连接分集水器的管段；实际回路划分与水力计算需单独设计。','Coils regenerate with the room. The sketch excludes manifold connections; circuit division and hydraulic sizing need separate design.')}</p>${paths.length?'':`<p>${tr('当前尺寸无法生成盘管，请减小边距或间距。','Reduce margin or spacing to generate coils.')}</p>`}<div class="actions"><button class="btn danger" id="deleteSystem">${tr('移除地暖','Remove heating')}</button><button class="btn" id="systemBack">${tr('← 返回','← Back')}</button></div></section>`;}
renderPanel=function(){
  if(systemsUI.keepPanel)return;
  const r=ui.sel?.kind==='route'?getRoute(ui.sel.id):null,h=ui.sel?.kind==='heating'?getHeating(ui.sel.id):null;
  if(!r&&!h)return systemBase.renderPanel();$('#panel').innerHTML=r?routePanel(r):heatPanel(h);
  $('#deleteSystem').onclick=deleteSel;$('#systemBack').onclick=()=>select(null);
  const number=(id,key,min,max,target)=>$('#'+id).onchange=e=>{const v=+e.target.value;if(Number.isFinite(v)){e.target.value=Math.max(min,Math.min(max,Math.round(v)));updateSystemProperty(()=>target()[key]=+e.target.value);}};
  if(r){number('routeDiameter','diameter',10,1000,()=>getRoute(r.id));number('routeHeight','height',0,10000,()=>getRoute(r.id));$('#routeName').onchange=e=>mutate(()=>getRoute(r.id).name=e.target.value.slice(0,100));$('#routeColor').onchange=e=>mutate(()=>getRoute(r.id).color=e.target.value);$('#dupRoute').onclick=()=>mutate(()=>{const n=cloneData(r);n.id=uid();n.points.forEach(p=>{p[0]+=200;p[1]+=200;});systemData().routes.push(n);ui.sel={kind:'route',id:n.id};});
    ['x','y'].forEach((axis,a)=>$('#panel').querySelectorAll(`[data-route-${axis}]`).forEach(el=>el.onchange=e=>{const v=+e.target.value;if(Number.isFinite(v)&&Math.abs(v)<=1e6)mutate(()=>getRoute(r.id).points[+el.dataset[axis==='x'?'routeX':'routeY']][a]=v);}));
    $('#panel').querySelectorAll('[data-remove-point]').forEach(el=>el.onclick=()=>mutate(()=>{const target=getRoute(r.id);if(target.points.length>2){target.elevations?.splice(+el.dataset.removePoint,1);target.points.splice(+el.dataset.removePoint,1);}}));
  }else{number('zoneSpacing','spacing',100,500,()=>getHeating(h.id));number('zoneMargin','margin',50,1000,()=>getHeating(h.id));$('#zoneAxis').onchange=e=>mutate(()=>getHeating(h.id).axis=e.target.value);$('#zoneColor').onchange=e=>mutate(()=>getHeating(h.id).color=e.target.value);}
};
deleteSel=function(){if(['route','heating'].includes(ui.sel?.kind)){const kind=ui.sel.kind,id=ui.sel.id;ui.sel=null;mutate(()=>systemData()[kind==='route'?'routes':'heating']=systemData()[kind==='route'?'routes':'heating'].filter(r=>r.id!==id));}else systemBase.deleteSel();};
function systemPoint(e){const p=toMM(e);let point=[Math.round(p.x/50)*50,Math.round(p.y/50)*50];const previous=systemsUI.points.at(-1);if(e.shiftKey&&previous){if(Math.abs(point[0]-previous[0])>Math.abs(point[1]-previous[1]))point[1]=previous[1];else point[0]=previous[0];}return point;}
svg.addEventListener('pointerdown',e=>{
  if(edit.active||is3D()||e.button||e.altKey||edit.space)return;
  if(systemsUI.drawing){e.preventDefault();e.stopImmediatePropagation();const p=systemPoint(e),last=systemsUI.points.at(-1);if(!last||Math.hypot(p[0]-last[0],p[1]-last[1])>=10){if(systemsUI.points.length>=100)return toast(tr('管线最多 100 个节点','Maximum 100 points'));systemsUI.points.push(p);window.recordServicePoint?.();}renderSystemOverlay();return;}
  if(ui.tool!=='select')return;
  const point=e.target.closest('[data-route-point]'),route=e.target.closest('[data-system-route]'),heating=e.target.closest('[data-heating]');
  if(point||route){e.preventDefault();e.stopImmediatePropagation();const id=route?.dataset.systemRoute||ui.sel?.id,r=getRoute(id);if(!r)return;select({kind:'route',id});systemsUI.drag={id,pointer:e.pointerId,index:point?+point.dataset.routePoint:null,start:point?r.points[+point.dataset.routePoint].slice():systemPoint(e),points:cloneData(r.points),before:snap(),moved:false};svg.setPointerCapture(e.pointerId);}
  else if(heating&&systemsUI.active&&systemsUI.tab==='heat'){e.preventDefault();e.stopImmediatePropagation();select({kind:'heating',id:heating.dataset.heating});}
},true);
svg.addEventListener('pointermove',e=>{
  if(systemsUI.drawing){systemsUI.hover=systemPoint(e);renderSystemOverlay();}
  const d=systemsUI.drag;if(!d||d.pointer!==e.pointerId)return;e.preventDefault();e.stopImmediatePropagation();const p=systemPoint(e),dx=p[0]-d.start[0],dy=p[1]-d.start[1],r=getRoute(d.id);if(!r)return;d.moved ||= !!(dx||dy);r.points=d.points.map((v,i)=>d.index===null||i===d.index?[v[0]+dx,v[1]+dy]:v.slice());renderSystemOverlay();
},true);
function endSystemDrag(e,cancel){const d=systemsUI.drag;if(!d||d.pointer!==e.pointerId)return;e.stopImmediatePropagation();systemsUI.drag=null;if(svg.hasPointerCapture(e.pointerId))svg.releasePointerCapture(e.pointerId);if(cancel){getRoute(d.id).points=d.points;renderAll();}else if(d.moved)commit(d.before);renderAll();}
svg.addEventListener('pointerup',e=>endSystemDrag(e,false),true);svg.addEventListener('pointercancel',e=>endSystemDrag(e,true),true);
svg.addEventListener('dblclick',e=>{const el=e.target.closest('[data-system-route]');if(!el||edit.active||systemsUI.drawing)return;e.preventDefault();e.stopImmediatePropagation();const r=getRoute(el.dataset.systemRoute),p=systemPoint(e);if(r.points.length>=100)return;let index=1,best=Infinity;for(let i=1;i<r.points.length;i++){const a=r.points[i-1],b=r.points[i],dx=b[0]-a[0],dy=b[1]-a[1],t=Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/(dx*dx+dy*dy||1))),distance=Math.hypot(p[0]-a[0]-t*dx,p[1]-a[1]-t*dy);if(distance<best){best=distance;index=i;}}mutate(()=>(r.elevations?.splice(index,0,(r.elevations[index-1]+r.elevations[index])/2),r.points.splice(index,0,p)));},true);
document.addEventListener('keydown',e=>{if(e.target.matches('input,textarea,select'))return;if(systemsUI.drawing&&['Enter','Escape','Backspace'].includes(e.key)){e.preventDefault();e.stopImmediatePropagation();if(e.key==='Enter')finishSystemRoute();else if(e.key==='Escape')cancelSystemDrawing();else{systemsUI.points.pop();if(window.serviceBackspace)window.serviceBackspace();renderSystemOverlay();}}else if(['route','heating'].includes(ui.sel?.kind)&&['Delete','Backspace'].includes(e.key)){e.preventDefault();e.stopImmediatePropagation();deleteSel();}},true);
buildLib=function(){systemBase.buildLib();if(systemsUI.active)buildSystemLibrary();};
setLang=function(lang){systemBase.setLang(lang);if(systemsUI.active)buildSystemLibrary();renderSystemOverlay();if(systemsUI.drawing)systemHint();};
overviewPanel=function(){return systemBase.overviewPanel()+`<section><h3>${tr('设备与布点','Home systems')}</h3><p class="field-help">${tr('空调、新风、地暖、插座，统一在户型上布置。','Lay out AC, ventilation, heating and sockets on your plan.')}</p><button class="btn system-primary" id="overviewSystems">${tr('打开设备与布点','Open home systems')}</button><div class="system-list">${systemData().routes.map(r=>`<button data-overview-route="${r.id}"><span>${esc(r.name)}</span><small>${pathLength([r.points]).toFixed(1)} m</small></button>`).join('')}</div></section>`;};
bindOverview=function(){systemBase.bindOverview();$('#overviewSystems').onclick=()=>setSystemsMode(true);$('#panel').querySelectorAll('[data-overview-route]').forEach(b=>b.onclick=()=>select({kind:'route',id:b.dataset.overviewRoute}));};
$('#systemsEntry').onclick=()=>setSystemsMode(!systemsUI.active);
document.querySelectorAll('[data-view="3d"]').forEach(b=>b.addEventListener('click',cancelSystemDrawing,true));
$('#blankBoard').addEventListener('click',()=>{cancelSystemDrawing();systemsUI.layers={ac:true,fresh:true,heat:true,power:true};},true);
buildLib();renderAll();
