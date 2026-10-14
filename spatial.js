/* Shared alignment for drawing, dragging and dropping; all coordinates are mm. */
let alignmentGuides=[];
const alignmentTolerance=()=>Math.min(220,10/view.s);
function showAlignment(g=[]){
 alignmentGuides=g;let el=$('#gAlignment');if(!el){el=document.createElementNS('http://www.w3.org/2000/svg','g');el.id='gAlignment';svg.append(el);}el.style.pointerEvents='none';
 const x1=view.x0,x2=x1+svg.clientWidth/view.s,y1=view.y0,y2=y1+svg.clientHeight/view.s;
 el.innerHTML=g.map(([axis,v])=>`<line x1="${axis==='x'?v:x1}" y1="${axis==='y'?v:y1}" x2="${axis==='x'?v:x2}" y2="${axis==='y'?v:y2}" stroke="#3d9fba" stroke-width="1" stroke-dasharray="5 4" vector-effect="non-scaling-stroke"/>`).join('');
}
function alignmentRects(exclude){
 const same=(kind,id)=>exclude?.kind===kind&&String(exclude.id).replace(/^w/,'')===String(id);
 return [...WALLS.filter((_,i)=>!same('wall',i)).map(w=>w.slice(0,4)),...WINS.filter((_,i)=>!same('window',i)).map(w=>w.slice(0,4)),...DOORS.filter((_,i)=>!same('door',i)).map(d=>d.rect),...SLIDES.filter((_,i)=>!same('slide',i)).map(d=>d.rect),...ROOMS.filter(r=>!same('room',r.id)).map(r=>bbox(r.poly))];
}
function closestAlignment(value,candidates,tolerance=alignmentTolerance()){
 let distance=tolerance,result=null;for(const v of candidates){const d=Math.abs(v-value);if(d<distance){distance=d;result=v;}}return result;
}
function straightWallNear(p){
 let found=null,best=alignmentTolerance();
 for(const r of [...WALLS,...WINS,...DOORS.map(d=>d.rect),...SLIDES.map(d=>d.rect)]){
  const h=r[2]-r[0]>=r[3]-r[1],axis=h?p.y:p.x,c=h?(r[1]+r[3])/2:(r[0]+r[2])/2,along=h?p.x:p.y,start=h?r[0]:r[1],end=h?r[2]:r[3];
  const dist=Math.hypot(axis-c,Math.max(start-along,along-end,0));if(dist<best){best=dist;found={r,h,c};}
 }return found;
}
function geometryPoint(p,e={}){
 const q={x:roundEdit(p.x),y:roundEdit(p.y)};if(!ui.layers.wallSnap||e.ctrlKey||e.metaKey){showAlignment();return q;}
 const exclude=edit.tool==='select'?ui.sel:null,rects=alignmentRects(exclude),xs=rects.flatMap(r=>[r[0],r[2],(r[0]+r[2])/2]),ys=rects.flatMap(r=>[r[1],r[3],(r[1]+r[3])/2]);
 ROOMS.filter(r=>!(exclude?.kind==='room'&&exclude.id===r.id)).forEach(r=>r.poly.forEach(([x,y])=>{xs.push(x);ys.push(y);}));
 const x=closestAlignment(p.x,xs),y=closestAlignment(p.y,ys),g=[];if(x!==null){q.x=x;g.push(['x',x]);}if(y!==null){q.y=y;g.push(['y',y]);}
 if(['wall','window','door','slide'].includes(edit.tool)){
  const wall=straightWallNear(p);if(wall){q[wall.h?'y':'x']=wall.c;g.push([wall.h?'y':'x',wall.c]);}
 }
 if(e.shiftKey&&edit.drag?.a&&edit.tool!=='room'){const a=edit.drag.a;if(Math.abs(q.x-a.x)>=Math.abs(q.y-a.y))q.y=a.y;else q.x=a.x;}
 showAlignment(g);return q;
}
const originalDrawingRect=drawingRect;
drawingRect=function(a,b){
 let r=originalDrawingRect(a,b);if(ui.layers.wallSnap&&['window','door','slide'].includes(edit.tool)){
  const wall=straightWallNear(a);if(wall){const w=wall.r;r=wall.h?[Math.min(a.x,b.x),w[1],Math.max(a.x,b.x),w[3]]:[w[0],Math.min(a.y,b.y),w[2],Math.max(a.y,b.y)];}
 }return r;
};
function alignGeometryRect(b,kind){
 if(!ui.layers.wallSnap)return b;const rects=alignmentRects(ui.sel),g=[];
 for(const [axis,lo,hi] of [['x',0,2],['y',1,3]]){
  const candidates=rects.flatMap(r=>[r[lo],r[hi]]),edges=kind==='move'?[lo,hi]:kind==='start'?[lo]:kind==='end'?[hi]:edit.drag?.edge===(axis==='x'?'left':'top')?[lo]:edit.drag?.edge===(axis==='x'?'right':'bottom')?[hi]:[];
  let best=alignmentTolerance(),delta=0,target=null;for(const i of edges){const v=closestAlignment(b[i],candidates);if(v!==null&&Math.abs(v-b[i])<best){best=Math.abs(v-b[i]);delta=v-b[i];target=v;}}
  if(target!==null){if(kind==='move'){b[lo]+=delta;b[hi]+=delta;}else b[edges[0]]+=delta;g.push([axis,target]);}
 }showAlignment(g);return b;
}
snapMove=function(f,cx,cy){
 let nx=Math.round(cx/10)*10,ny=Math.round(cy/10)*10;if(!ui.layers.wallSnap){showAlignment();return[nx,ny];}
 const {hw,hh}=aabb(f),tol=alignmentTolerance(),g=[];
 const wallMounted=['acwall','acduct','acvent','acreturn','freshin','freshout','socket','acsocket','wetsocket','switch','walllamp','panelboard','coldpoint','hotpoint'].includes(f.type);
 if(wallMounted){const wall=straightWallNear({x:cx,y:cy});if(wall){if(wall.h){ny=wall.c;g.push(['y',ny]);}else{nx=wall.c;g.push(['x',nx]);}}}
 const xs=[],ys=[];for(const r of snapRects()){
  if(cy+hh>=r[1]-tol&&cy-hh<=r[3]+tol)xs.push(cx<(r[0]+r[2])/2?r[0]-hw:r[2]+hw);
  if(cx+hw>=r[0]-tol&&cx-hw<=r[2]+tol)ys.push(cy<(r[1]+r[3])/2?r[1]-hh:r[3]+hh);
 }
 for(const other of state.furniture){if(other.id===f.id)continue;const a=aabb(other);
  if(Math.abs(cy-other.cy)<hh+a.hh+tol)xs.push(other.cx,other.cx-a.hw+hw,other.cx+a.hw-hw,other.cx-a.hw-hw,other.cx+a.hw+hw);
  if(Math.abs(cx-other.cx)<hw+a.hw+tol)ys.push(other.cy,other.cy-a.hh+hh,other.cy+a.hh-hh,other.cy-a.hh-hh,other.cy+a.hh+hh);
 }
 for(const room of ROOMS){const r=bbox(room.poly);if(cx>=r[0]-tol&&cx<=r[2]+tol&&cy>=r[1]-tol&&cy<=r[3]+tol){xs.push(r[0]+hw,r[2]-hw,(r[0]+r[2])/2);ys.push(r[1]+hh,r[3]-hh,(r[1]+r[3])/2);}}
 if(!g.some(a=>a[0]==='x')){const x=closestAlignment(cx,xs);if(x!==null){nx=x;g.push(['x',x-hw]);}}
 if(!g.some(a=>a[0]==='y')){const y=closestAlignment(cy,ys);if(y!==null){ny=y;g.push(['y',y-hh]);}}
 if(!equipmentSystem(f)&&f.type!=='rug'){const temp={...f,cx:nx,cy:ny};pushOut(temp);nx=temp.cx;ny=temp.cy;}
 showAlignment(g);return[nx,ny];
};
document.addEventListener('pointerup',()=>showAlignment());document.addEventListener('pointercancel',()=>showAlignment());
const snapToggle=document.querySelector('[data-layer="wallSnap"]');if(snapToggle){snapToggle.textContent=tr('对齐吸附','Align & snap');snapToggle.title=tr('墙体、房间、门窗、家具统一对齐；绘制时 Ctrl / ⌘ 临时关闭','Align walls, rooms, openings and furniture. Ctrl / ⌘ temporarily disables drawing alignment.');}
