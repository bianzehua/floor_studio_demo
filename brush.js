const brushUI={tool:null,start:null,drag:null,finishId:'paintCream',thickness:120,height:2800};
async function startBrush(tool){await openModeling('model');brushUI.tool=tool;brushUI.start=null;extraUI.tool=tool==='paint'?'paintWall':'partition';extraUI.height=drawingSettings().floorHeight;buildModelLibrary();window.View3D?.clearBrushPreview();closeDrawers();toast(tool==='paint'?'在墙面拖出矩形，或点击两个对角点涂材质。':'在 3D 地面拖出墙线，或点击起终点；Shift 锁定横竖。');}
function cancelBrush(){brushUI.tool=null;brushUI.start=null;brushUI.drag=null;window.View3D?.clearBrushPreview();}
const brushBuildLibrary=buildModelLibrary;
buildModelLibrary=function(){brushBuildLibrary();if(extraUI.mode!=='model')return;const section=document.createElement('div');section.className='editor-section';section.innerHTML='<h3>3D 画笔与隔墙</h3><div class="actions"><button class="btn" id="wallPaintBrush">墙面材质画笔</button><button class="btn" id="partitionBrush">绘制厚度隔墙</button></div><label class="studio-field">画笔 / 隔墙材质<select id="brushFinish">'+modelFinishOptions(brushUI.finishId)+'</select></label><div class="form"><label>墙厚 (mm)<input id="brushThickness" type="number" min="10" max="1000" value="'+brushUI.thickness+'"></label><label>墙高 (mm)<input id="brushHeight" type="number" min="100" max="10000" value="'+brushUI.height+'"></label></div><p class="field-help">材质画笔绘制墙面上的矩形区域，自动避开门窗净空。隔墙可斜向绘制，生成可移动、推拉和换材质的实体。Esc 取消当前画笔。</p>';
 $('#modelLibrary .editor-tools').after(section);$('#wallPaintBrush').onclick=()=>startBrush('paint');$('#partitionBrush').onclick=()=>startBrush('partition');$('#brushFinish').onchange=e=>brushUI.finishId=e.target.value;$('#brushThickness').onchange=e=>{const n=+e.target.value;if(Number.isFinite(n)&&n>=10&&n<=1000)brushUI.thickness=n;else e.target.value=brushUI.thickness;};$('#brushHeight').onchange=e=>{const n=+e.target.value;if(Number.isFinite(n)&&n>=100&&n<=10000)brushUI.height=n;else e.target.value=brushUI.height;};
}
function commitWallPaint(a,b){
 const width=Math.round(Math.abs(a.along-b.along)),height=Math.round(Math.abs(a.z-b.z));if(width<10||height<10)return false;
 const board={id:uid(),...a.target,start:Math.round(Math.min(a.along,b.along)),z:Math.round(Math.min(a.z,b.z)),width,height,moduleW:width,moduleH:height,thickness:1,gap:0,finishId:brushUI.finishId,purpose:'paint'};
 if(!boardPieces(board).length){toast('此区域在门窗净空内，请在实墙面上绘制。');return false;}
 mutate(()=>{if(board.target==='wall'){const w=WALLS[board.index];w[5]||={};w[5].modelWallKey||='wall_'+uid();board.wallKey=w[5].modelWallKey;}modelData().boards.push(board);});brushUI.start=null;window.View3D.clearBrushPreview();toast('墙面材质区域已保存，可在顶面与墙板列表中调整。');return true;
}
function commitPartition(a,b){
 const length=Math.round(Math.hypot(b.x-a.x,b.y-a.y));if(length<50)return false;
 const finishId=brushUI.finishId;createModel({type:'box',purpose:'partition',name:'设计分隔墙',cx:Math.round((a.x+b.x)/2),cy:Math.round((a.y+b.y)/2),w:length,d:brushUI.thickness,height:brushUI.height,rot:Math.atan2(b.y-a.y,b.x-a.x)*180/Math.PI,finishId});brushUI.start=null;brushUI.tool=null;window.View3D.clearBrushPreview();toast('已生成 '+brushUI.thickness+' mm 厚的隔墙实体。');return true;
}
const brushClose=closeModeling;
closeModeling=function(){cancelBrush();brushClose();};
document.addEventListener('keydown',e=>{if(e.target.matches('input,textarea,select'))return;if(brushUI.tool&&e.key==='Escape'){cancelBrush();extraUI.tool='translate';buildModelLibrary();e.preventDefault();e.stopImmediatePropagation();}},true);
// Choosing another modelling tool terminates paint capture before that tool runs.
document.addEventListener('click',e=>{if(e.target.closest('[data-model-tool]'))cancelBrush();},true);
const detailPanel=furnPanel;
furnPanel=function(f){return detailPanel(f)+(DETAIL_TYPES.includes(f.type)?'<section><h3>摆放标高</h3><label class="studio-field">底部离地 (mm)<input id="detailElevation" type="number" min="0" max="10000" value="'+(f.z??detailBaseHeight(f.type))+'"></label><p class="field-help">桌面物件默认放在 740 mm 高处，可按实际桌面高度调整。</p></section>':'');};
const detailBind=bindFurnPanel;
bindFurnPanel=function(f){detailBind(f);if($('#detailElevation'))$('#detailElevation').onchange=e=>{const z=+e.target.value;if(Number.isFinite(z)&&z>=0&&z<=10000)mutate(()=>f.z=z);};};
const detailSVG=furnSVG;
furnSVG=function(t,w,d,c){
 if(!DETAIL_TYPES.includes(t))return detailSVG(t,w,d,c);
 const rect=(x,y,rw,rh,fill=c)=>`<rect x="${x}" y="${y}" width="${rw}" height="${rh}" rx="${Math.min(rw,rh)*.05}" fill="${fill}" stroke="#536981" stroke-width="1" vector-effect="non-scaling-stroke"/>`;
 if(['vase','candle','robotVacuum'].includes(t))return `<circle r="${w*.48}" fill="${c}" stroke="#536981" vector-effect="non-scaling-stroke"/><circle r="${w*.22}" fill="#fff" opacity=".6"/>`;
 if(['desktopset','monitor','laptop'].includes(t))return rect(-w*.45,-d*.45,w*.9,d*.3,'#28394e')+rect(-w*.18,-d*.05,w*.36,d*.1,'#98aabe')+rect(-w*.3,d*.16,w*.6,d*.25,'#d9e3ed')+(t==='desktopset'?rect(-w*.49,0,w*.17,d*.44,'#43546a'):'');
 if(t==='bookstack')return [0,1,2].map(i=>rect(-w/2+i*w*.04,-d/2+i*d*.03,w*.92,d*.92,['#95a8b8','#cab292',c][i])).join('');
 return rect(-w/2,-d/2,w,d)+rect(-w*.32,-d*.3,w*.64,d*.6,'#eaf1f7');
};
