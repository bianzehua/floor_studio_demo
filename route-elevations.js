/* Manual node elevations allow risers, drops and ceiling routes in one path. */
const elevationPanel=renderPanel;
renderPanel=function(){
 elevationPanel();const r=ui.sel?.kind==='route'&&getRoute(ui.sel.id);if(!r||decorUI.mode||$('#nodeElevationEnabled'))return;
 $('#panel').insertAdjacentHTML('beforeend',`<section><h3>逐点标高 / 竖向走线</h3><label class="studio-check"><input id="nodeElevationEnabled" type="checkbox" ${r.elevations?'checked':''}>为每个节点设置独立标高</label><p class="field-help">同一 X / Y 的相邻节点可组成竖管。标高相对完成地面，允许负值；独立标高优先于排水坡度。</p>${r.elevations?`<div class="route-points">${r.points.map((p,i)=>`<label>节点 ${i+1} · Z (mm)<input data-node-elevation="${i}" type="number" min="-10000" max="10000" value="${r.elevations[i]}"></label>`).join('')}</div>`:''}<p>空间管线长度：${routeLength3D(r).toFixed(2)} m</p><button class="btn" id="addVerticalNode">＋ 末端增加竖向节点</button></section>`);
 $('#nodeElevationEnabled').onchange=e=>{const enabled=e.target.checked;mutate(()=>{if(enabled)r.elevations=routeElevations(r);else delete r.elevations;});};
 $('#panel').querySelectorAll('[data-node-elevation]').forEach(el=>el.onchange=e=>{const n=+e.target.value;if(Number.isFinite(n)&&n>=-10000&&n<=10000)mutate(()=>r.elevations[+el.dataset.nodeElevation]=n);});
 $('#addVerticalNode').onclick=()=>{if(r.points.length>=100)return;mutate(()=>{const zs=routeElevations(r);r.points.push(r.points.at(-1).slice());r.elevations=[...zs,zs.at(-1)+300<=10000?zs.at(-1)+300:zs.at(-1)-300];});};
};
