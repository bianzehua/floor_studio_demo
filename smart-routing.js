/* Fixture connection ports and editable wall-following service routes. */
const serviceUI={mode:'manual',ports:[],hoverPort:null,trunkHeight:null};
function servicePorts(type,excludeRoute=null){
 const plumbing=['ksink','islandsink','vanity','shower','bathtub','washer','toilet','dishwasher','waterheater'],power=['socket','acsocket','wetsocket','panelboard','switch','ceilinglight','downlight','pendantlight','walllamp','washer','dryer','fridge','dishwasher','waterheater','oven','acwall','acduct','aircon','acoutdoor','hrv'];
 const source={coldwater:['coldpoint','watermeter','stopvalve'],hotwater:['hotpoint','waterheater'],drain:['drainpoint','floordrain','riser'],electrical:power,acpipe:['acwall','acduct','aircon','acoutdoor'],freshsupply:['hrv','freshin'],freshexhaust:['hrv','freshout']}[type]||[];
 const fixtures=type==='coldwater'||type==='drain'?plumbing:type==='hotwater'?plumbing.filter(t=>WATER_FIXTURES[t]?.hot||t==='waterheater'):[];
 const ports=state.furniture.filter(f=>source.includes(f.type)||fixtures.includes(f.type)).map(f=>{
  const fixture=fixtures.includes(f.type),center=type==='drain'||!fixture,angle=f.rot*Math.PI/180,offset=center?0:-f.d/2;
  const point=[Math.round(f.cx-Math.sin(angle)*offset),Math.round(f.cy+Math.cos(angle)*offset)];
  const z=type==='drain'?Math.max(0,installation(f)):fixture?installation(f)+(f.type==='shower'?1100:f.type==='waterheater'?equipmentHeight(f)*.6:f.type==='washer'?700:550):installation(f)+equipmentHeight(f)/2;
  return {id:'fixture:'+f.id,fixtureId:f.id,point,z:Math.round(Math.min(10000,z)),name:f.name};
 });
 for(const r of systemData().routes.filter(r=>r.type===type&&r.id!==excludeRoute)){const heights=routeElevations(r);[0,r.points.length-1].forEach(i=>ports.push({id:'route:'+r.id+':'+i,routeId:r.id,index:i,point:r.points[i].slice(),z:heights[i],name:r.name+' · '+(i?'末端':'起点')}));}
 return ports;
}
function snappedServicePoint(raw,reference,type,event={}){
 let point=raw.map(v=>Math.round(v/50)*50),axis=null;serviceUI.hoverPort=null;
 if(event.shiftKey&&reference){axis=Math.abs(raw[0]-reference[0])>=Math.abs(raw[1]-reference[1])?1:0;point[axis]=reference[axis];}
 if(!event.ctrlKey){let distance=14/view.s;for(const port of servicePorts(type,systemsUI.drag?.id)){if(axis!==null&&Math.abs(port.point[axis]-reference[axis])>.01)continue;const d=Math.hypot(port.point[0]-raw[0],port.point[1]-raw[1]);if(d<=distance){distance=d;point=port.point.slice();serviceUI.hoverPort=port;}}}
 return point;
}
systemPoint=function(e){const p=toMM(e),d=systemsUI.drag,reference=systemsUI.drawing?systemsUI.points.at(-1):d&&d.index!==null?d.points[d.index]:null,type=systemsUI.drawing||(d?.index!==null&&getRoute(d?.id)?.type);return snappedServicePoint([p.x,p.y],reference,type,e);};
function serviceBackspace(){serviceUI.ports.length=systemsUI.points.length;}
function recordServicePoint(){serviceUI.ports[systemsUI.points.length-1]=serviceUI.hoverPort?cloneData(serviceUI.hoverPort):null;if(serviceUI.mode==='wall'&&systemsUI.points.length===2)finishSmartSystemRoute();}
function renderServicePorts(){
 let group=$('#gServicePorts');if(!group){group=document.createElementNS('http://www.w3.org/2000/svg','g');group.id='gServicePorts';group.setAttribute('pointer-events','none');svg.append(group);}
 const type=systemsUI.drawing||getRoute(systemsUI.drag?.id)?.type;
 if(!type||is3D()){group.innerHTML='';return;}
 group.innerHTML=servicePorts(type,systemsUI.drag?.id).map(p=>`<circle cx="${p.point[0]}" cy="${p.point[1]}" r="${(serviceUI.hoverPort?.id===p.id?7:4)/view.s}" fill="${serviceUI.hoverPort?.id===p.id?'#2e6fe8':'white'}" stroke="#2e6fe8" stroke-width="1.5" vector-effect="non-scaling-stroke"/>`).join('');
 const h=serviceUI.hoverPort;if(h)group.innerHTML+=`<text x="${h.point[0]+12/view.s}" y="${h.point[1]-12/view.s}" fill="#205bc4" stroke="#fff" stroke-width="${3/view.s}" paint-order="stroke" font-size="${12/view.s}">${esc(h.name)} · ${h.z} mm</text>`;
}
const serviceRenderOverlay=renderSystemOverlay;
renderSystemOverlay=function(){serviceRenderOverlay();renderServicePorts();};
const serviceCancel=cancelSystemDrawing;
cancelSystemDrawing=function(){serviceUI.mode='manual';serviceUI.ports=[];serviceUI.hoverPort=null;serviceUI.trunkHeight=null;serviceCancel();};
const serviceStart=startSystemRoute;
startSystemRoute=async function(type,mode='manual',height=ROUTE_TYPES[type].height){cancelSystemDrawing();await serviceStart(type);if(systemsUI.drawing!==type)return;serviceUI.mode=mode;serviceUI.trunkHeight=height;serviceUI.ports=[];if(mode==='wall'){$('#systemDock span').textContent='选取起点和终点 · 自动沿墙连接';$('#finishRoute').textContent='连接两点';}$('#finishRoute').onclick=()=>finishSystemRoute();systemHint();renderSystemOverlay();};
const serviceFinish=finishSystemRoute;
finishSystemRoute=function(){if(serviceUI.mode==='wall')return finishSmartSystemRoute();const ports=cloneData(serviceUI.ports),type=systemsUI.drawing;if(!type||systemsUI.points.length<2)return serviceFinish();const idCount=systemData().routes.length;serviceFinish();const r=systemData().routes[idCount];if(r){r.elevations=r.points.map((p,i)=>ports[i]?.z??r.height);r.endpoints=[ports[0],ports.at(r.points.length-1)];save();renderAll();}};
function finishSmartSystemRoute(){
 if(systemsUI.points.length!==2)return toast('请选取两个设备端点或任意两点。');
 const type=systemsUI.drawing,def=ROUTE_TYPES[type],ports=cloneData(serviceUI.ports),height=serviceUI.trunkHeight??def.height;let points;
 const solids=WALLS.filter((w,i)=>!state.demolished.includes('w'+i));
 // Lintels and window sills are passable only outside their vertical clear opening.
 DOORS.concat(SLIDES).filter(d=>height>=2100+def.diameter/2).forEach(d=>solids.push([...d.rect.slice(0,4),'n']));
 WINS.forEach((w,i)=>{const ws=windowSettings(w,i);if(height+def.diameter/2<=ws.sill||height-def.diameter/2>=ws.sill+ws.height)solids.push([...w.slice(0,4),'n']);});
 try{points=wallNetworkPath(solids,systemsUI.points[0],systemsUI.points[1]);}catch(e){toast(e.message);systemsUI.points.pop();serviceUI.ports.pop();renderSystemOverlay();return;}
 const heights=points.map(()=>height),a=ports[0],b=ports[1];
 if(a&&a.z!==height){points.unshift(points[0].slice());heights.unshift(a.z);}
 if(b&&b.z!==height){points.push(points.at(-1).slice());heights.push(b.z);}
 const route={id:uid(),type,name:def.name,color:def.color,diameter:def.diameter,height,points,elevations:heights,routingMode:'wall',endpoints:[a,b]};
 cancelSystemDrawing();mutate(()=>{systemData().routes.push(route);ui.sel={kind:'route',id:route.id};});drawer('panel',true);toast('已沿墙连接两点，可继续编辑节点和标高。');
}
function addWallRouteButtons(root,types){
 const section=document.createElement('div');section.className='editor-section wall-route-section';section.innerHTML='<h3>两点沿墙布线</h3><p class="field-help">点选两个蓝色设备端点，或任意起终点。干线沿相连墙体转弯，设备高度通过竖向接管连接。逐点绘制时按 Shift 锁定横竖，Ctrl 暂停吸附。</p><label class="studio-field">干线中心标高 (mm)<input class="wall-route-height" type="number" min="0" max="10000" value="'+(types[0]?.[1].height||500)+'"></label><div class="system-route-buttons">'+types.map(([type,def])=>`<button class="btn" data-wall-route="${type}">${def.name}</button>`).join('')+'</div>';
 const manual=root.querySelector('[data-utility-route],[data-route-start]')?.closest('.editor-section');if(manual)manual.after(section);else root.append(section);
 section.querySelectorAll('[data-wall-route]').forEach(b=>b.onclick=()=>{const height=+section.querySelector('.wall-route-height').value;if(!Number.isFinite(height)||height<0||height>drawingSettings().floorHeight)return toast('干线标高需在 0 到层高之间。');startSystemRoute(b.dataset.wallRoute,'wall',height);});
}
const serviceBuildUtilities=buildUtilitiesLibrary;
buildUtilitiesLibrary=function(){serviceBuildUtilities();addWallRouteButtons($('#utilitiesLibrary'),Object.entries(ROUTE_TYPES).filter(([,v])=>v.system===(waterUI.tab==='water'?'water':'power')));};
const serviceBuildSystems=buildSystemLibrary;
buildSystemLibrary=function(){serviceBuildSystems();const types=Object.entries(ROUTE_TYPES).filter(([,v])=>v.system===systemsUI.tab);if(types.length)addWallRouteButtons($('#systemLibrary'),types);};
const serviceHint=systemHint;
systemHint=function(){serviceHint();if(serviceUI.mode==='wall'&&systemsUI.drawing)$('#modehint').textContent='点选起点和终点 · 蓝色圆点可吸附设备接口 · Esc 取消';};
