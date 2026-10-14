/* Orthogonal routes on the union of physical wall rectangles, in millimetres. */
function wallNetworkPath(walls,start,end){
 const usable=walls.filter(w=>w[4]!=='low'),segments=[],limit=20000,tol=.5;
 if(!usable.length)throw Error('先绘制墙体，再连接两个点。');
 const covers=(a,b)=>{
  const axis=Math.abs(a[0]-b[0])>tol?0:1,other=1-axis;
  if(Math.abs(a[other]-b[other])>tol)return false;
  const lo=Math.min(a[axis],b[axis]),hi=Math.max(a[axis],b[axis]),intervals=usable.filter(w=>a[other]>=w[other]-tol&&a[other]<=w[other+2]+tol).map(w=>[w[axis],w[axis+2]]).sort((a,b)=>a[0]-b[0]);
  let reached=lo;for(const [l,r]of intervals){if(r<reached-tol)continue;if(l>reached+tol)break;reached=Math.max(reached,r);if(reached>=hi-tol)return true;}return hi-lo<tol;
 };
 const pad=Math.max(...usable.map(w=>Math.min(w[2]-w[0],w[3]-w[1])))/2;
 for(const w of usable){const horizontal=w[2]-w[0]>=w[3]-w[1],fixed=(w[horizontal?1:0]+w[horizontal?3:2])/2;segments.push({axis:horizontal?0:1,fixed,lo:w[horizontal?0:1]-pad,hi:w[horizontal?2:3]+pad,cuts:[]});}
 const point=(s,t)=>s.axis===0?[t,s.fixed]:[s.fixed,t];
 const cut=(s,t)=>{if(t>=s.lo-tol&&t<=s.hi+tol)s.cuts.push(t);};
 // Intersections create junctions only when the actual wall solids meet.
 const bridges=[];
 for(let i=0;i<segments.length;i++)for(let j=i+1;j<segments.length;j++){
  const a=segments[i],b=segments[j];
  if(a.axis!==b.axis){if(b.fixed>=a.lo&&b.fixed<=a.hi&&a.fixed>=b.lo&&a.fixed<=b.hi){cut(a,b.fixed);cut(b,a.fixed);}}
  else if(Math.abs(a.fixed-b.fixed)<tol){for(const t of[a.lo,a.hi,b.lo,b.hi]){cut(a,t);cut(b,t);}}
  else{const lo=Math.max(a.lo,b.lo),hi=Math.min(a.hi,b.hi);if(lo<=hi){const t=(lo+hi)/2,p=point(a,t),q=point(b,t);if(covers(p,q)){cut(a,t);cut(b,t);bridges.push([p,q]);}}}
 }
 const nodes=[],byKey=new Map(),edges=[];
 const node=p=>{const q=p.map(v=>Math.round(v*1000)/1000),key=q.join(',');if(!byKey.has(key)){if(nodes.length>=limit)throw Error('墙体网络过大，请拆分楼层后布线。');byKey.set(key,nodes.length);nodes.push(q);edges.push([]);}return byKey.get(key);};
 const link=(a,b,cost)=>{const i=node(a),j=node(b);if(i===j)return;const d=cost??Math.abs(a[0]-b[0])+Math.abs(a[1]-b[1]);edges[i].push([j,d]);edges[j].push([i,d]);};
 const connect=p=>{
  const candidates=segments.map(s=>{const t=Math.max(s.lo+pad,Math.min(s.hi-pad,p[s.axis])),q=point(s,t);return {s,t,q,d:Math.abs(q[0]-p[0])+Math.abs(q[1]-p[1])};}).sort((a,b)=>a.d-b.d).slice(0,3);
  for(const {s,t,q,d}of candidates.filter(c=>c.d<=candidates[0].d+100)){cut(s,t);const elbow=s.axis===0?[p[0],q[1]]:[q[0],p[1]];link(p,elbow);link(elbow,q);}return node(p);
 };
 const source=connect(start),target=connect(end);
 for(const s of segments){s.cuts.push(s.lo+pad,s.hi-pad);const cuts=[...new Set(s.cuts)].sort((a,b)=>a-b);for(let i=1;i<cuts.length;i++){const p=point(s,cuts[i-1]),q=point(s,cuts[i]);if(covers(p,q))link(p,q);}}
 bridges.forEach(([a,b])=>link(a,b));
 const dist=new Float64Array(nodes.length).fill(Infinity),prev=new Int32Array(nodes.length).fill(-1),heap=[];
 const push=(id,d)=>{heap.push([id,d]);let i=heap.length-1;while(i>0){const p=(i-1)>>1;if(heap[p][1]<=d)break;[heap[i],heap[p]]=[heap[p],heap[i]];i=p;}};
 const pop=()=>{const first=heap[0],last=heap.pop();if(heap.length){heap[0]=last;let i=0;while(true){let j=i*2+1;if(j>=heap.length)break;if(j+1<heap.length&&heap[j+1][1]<heap[j][1])j++;if(heap[i][1]<=heap[j][1])break;[heap[i],heap[j]]=[heap[j],heap[i]];i=j;}}return first;};
 dist[source]=0;push(source,0);
 while(heap.length){const [id,d]=pop();if(d!==dist[id])continue;if(id===target)break;for(const [next,cost]of edges[id])if(d+cost<dist[next]){dist[next]=d+cost;prev[next]=id;push(next,d+cost);}}
 if(!Number.isFinite(dist[target]))throw Error('两个端点之间的墙体不连通，请补齐墙体或改用逐点绘制。');
 const path=[];for(let id=target;id!==-1;id=prev[id])path.push(nodes[id]);path.reverse();
 const simplified=[];for(const p of path){while(simplified.length>=2){const a=simplified.at(-2),b=simplified.at(-1);if((Math.abs(a[0]-b[0])<tol&&Math.abs(b[0]-p[0])<tol)||(Math.abs(a[1]-b[1])<tol&&Math.abs(b[1]-p[1])<tol))simplified.pop();else break;}simplified.push(p.map(Math.round));}
 if(simplified.length<2||simplified.length>96)throw Error('请调整端点，管线需要 2–96 个平面节点。');
 return simplified;
}
