/* Local line extraction for clean scanned plans. The result is an editable draft. */
let recognizeAfterUpload=false,recognitionResult=null;
const uploadImageForTracing=$('#imageIn').onchange;
$('#imageIn').onchange=async e=>{const recognize=recognizeAfterUpload||!!e.target.files?.length;await uploadImageForTracing(e);recognizeAfterUpload=false;if(recognize&&state.underlay)openRecognition();};
$('#recognizeEntry').onclick=()=>{recognizeAfterUpload=true;$('#imageIn').click();};
function extractPlanPixels(imageData,width,height,{threshold=135,minThickness=4,gap=12}={}){
 const pixels=imageData.data,dark=new Uint8Array(width*height),mask=new Uint8Array(width*height),walls=[];
 for(let i=0;i<dark.length;i++){const k=i*4;dark[i]=(pixels[k]*.299+pixels[k+1]*.587+pixels[k+2]*.114<threshold&&pixels[k+3]>100)?1:0;}
 for(const horizontal of [true,false]){
  const across=horizontal?width:height,rows=horizontal?height:width,minRun=Math.max(24,Math.round(across*.065)),rects=[];let active=[];
  for(let row=0;row<rows;row++){
   const runs=[];for(let col=0;col<across;){const idx=horizontal?row*width+col:col*width+row;if(!dark[idx]){col++;continue;}const start=col;let last=col,blank=0;
    while(col<across){if(dark[horizontal?row*width+col:col*width+row]){last=col;blank=0;}else if(++blank>gap)break;col++;}if(last-start+1>=minRun)runs.push([start,last+1]);}
   const next=[];for(const [a,b] of runs){const match=active.find(r=>Math.abs(r[0]-a)<=3&&Math.abs(r[2]-b)<=3);if(match){match[3]=row+1;match[0]=Math.max(match[0],a);match[2]=Math.min(match[2],b);next.push(match);}else{const r=[a,row,b,row+1];rects.push(r);next.push(r);}}active=next;
  }
  for(const r of rects)if(r[3]-r[1]>=minThickness){const box=horizontal?r:[r[1],r[0],r[3],r[2]];walls.push(box);for(let y=box[1];y<box[3];y++)for(let x=box[0];x<box[2];x++)mask[y*width+x]=1;}
 }
 const visited=new Uint8Array(mask.length),rooms=[];const queue=new Int32Array(mask.length);
 for(let start=0;start<mask.length;start++){
  if(mask[start]||visited[start])continue;let head=0,tail=1,touchesEdge=false,minX=width,minY=height,maxX=0,maxY=0;queue[0]=start;visited[start]=1;
  while(head<tail){const i=queue[head++],x=i%width,y=Math.floor(i/width);minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);if(x===0||y===0||x===width-1||y===height-1)touchesEdge=true;
   for(const j of [x>0?i-1:-1,x<width-1?i+1:-1,y>0?i-width:-1,y<height-1?i+width:-1])if(j>=0&&!mask[j]&&!visited[j]){visited[j]=1;queue[tail++]=j;}
  }
  if(touchesEdge||tail<width*height*.003||maxX-minX<15||maxY-minY<15||rooms.length>=40)continue;
  const inside=new Set(queue.subarray(0,tail)),edges=new Map(),key=(x,y)=>x+','+y,put=(a,b)=>edges.set(key(...a),b);
  for(const i of inside){const x=i%width,y=Math.floor(i/width);if(!inside.has(i-width))put([x,y],[x+1,y]);if(!inside.has(i+1))put([x+1,y],[x+1,y+1]);if(!inside.has(i+width))put([x+1,y+1],[x,y+1]);if(!inside.has(i-1))put([x,y+1],[x,y]);}
  let first=[minX,minY];if(!edges.has(key(...first)))first=[...edges.keys()][0].split(',').map(Number);let point=first,poly=[];
  for(let n=0;n<edges.size+1;n++){poly.push(point);const next=edges.get(key(...point));if(!next||key(...next)===key(...first))break;point=next;}
  poly=poly.filter((p,i)=>{const a=poly[(i+poly.length-1)%poly.length],b=poly[(i+1)%poly.length];return(p[0]-a[0])*(b[1]-p[1])!==(p[1]-a[1])*(b[0]-p[0]);});
  let approximate=false;if(poly.length>100||poly.length<3){poly=[[minX,minY],[maxX+1,minY],[maxX+1,maxY+1],[minX,maxY+1]];approximate=true;}
  rooms.push({poly,area:tail,approximate,name:'房间 '+(rooms.length+1)});
 }
 return{walls:walls.slice(0,1000),rooms,width,height};
}
async function openRecognition(){
 if(!state.underlay)return;const d=$('#recognitionDialog');recognitionResult=null;
 d.innerHTML=`<h2>图片识别为可编辑户型</h2><p>适合线条清晰的黑白平面图。提取直墙和封闭房间；门窗、文字、家具与复杂曲墙需要手动补充。请先校准整张图片的实际宽度。</p><div class="form"><label>整张图片宽度（mm）<input id="recognizeWidth" type="number" min="1000" max="100000" value="${Math.round(state.underlay.w)}"></label><label>深色阈值<input id="recognizeThreshold" type="number" min="40" max="230" value="135"></label><label>最小墙厚（像素）<input id="recognizeThickness" type="number" min="2" max="20" value="4"></label><label>补齐缺口（像素）<input id="recognizeGap" type="number" min="0" max="40" value="12"></label></div><div id="recognitionPreview"></div><p id="recognitionStatus" role="status">调整参数后点击识别，预览确认后应用。</p><div id="recognizedNames"></div><label class="studio-check"><input id="recognitionKeepImage" type="checkbox">保留原图作为校准参考（可选）</label><div class="actions"><button class="btn" id="cancelRecognition">取消</button><button class="btn" id="analyzeRecognition">识别并预览</button><button class="btn studio-primary" id="applyRecognition" disabled>应用为新户型</button></div>`;
 $('#cancelRecognition').onclick=()=>d.close();$('#analyzeRecognition').onclick=async()=>{
  const mm=+$('#recognizeWidth').value,threshold=+$('#recognizeThreshold').value,minThickness=+$('#recognizeThickness').value,gap=+$('#recognizeGap').value;if(mm<1000||mm>100000||threshold<40||threshold>230||minThickness<2||minThickness>20||gap<0||gap>40)return;
  $('#recognitionStatus').textContent='正在提取墙线与房间轮廓…';$('#analyzeRecognition').disabled=true;
  try{const bitmap=await createImageBitmap(await(await fetch(state.underlay.src)).blob()),scale=Math.min(1,600/Math.max(bitmap.width,bitmap.height)),cv=document.createElement('canvas');cv.width=Math.round(bitmap.width*scale);cv.height=Math.round(bitmap.height*scale);const c=cv.getContext('2d');c.drawImage(bitmap,0,0,cv.width,cv.height);bitmap.close();const result=extractPlanPixels(c.getImageData(0,0,cv.width,cv.height),cv.width,cv.height,{threshold,minThickness,gap});recognitionResult={...result,mm};
   $('#recognitionPreview').innerHTML=`<svg viewBox="0 0 ${cv.width} ${cv.height}"><image href="${state.underlay.src}" width="${cv.width}" height="${cv.height}"/>${result.rooms.map((r,i)=>`<polygon points="${r.poly.map(p=>p.join(',')).join(' ')}" fill="#4098a944" stroke="#2c828d"/><text x="${bbox(r.poly)[0]+8}" y="${bbox(r.poly)[1]+18}" font-size="12">${i+1}</text>`).join('')}${result.walls.map(r=>`<rect x="${r[0]}" y="${r[1]}" width="${r[2]-r[0]}" height="${r[3]-r[1]}" fill="#ca694580"/>`).join('')}</svg>`;
   $('#recognizedNames').innerHTML=result.rooms.map((r,i)=>`<label>${i+1}<input data-recognized-room="${i}" maxlength="100" value="${r.name}"></label>`).join('');$('#recognitionStatus').textContent=`识别到 ${result.walls.length} 段墙、${result.rooms.length} 个封闭区域。红色是墙，蓝色是房间；结果是待校准草稿。`;
   $('#applyRecognition').disabled=!result.walls.length;$('#analyzeRecognition').disabled=false;
  }catch{$('#recognitionStatus').textContent='识别失败，请使用清晰的平面图。';$('#analyzeRecognition').disabled=false;}
 };
 $('#applyRecognition').onclick=()=>{
  const result=recognitionResult;if(!result)return;const scale=result.mm/result.width,underlay={...state.underlay,x:0,y:0,w:result.mm,h:result.height*scale,opacity:.25},rooms=result.rooms.map((r,i)=>{let poly=r.poly.map(p=>p.map(n=>Math.round(n*scale)));if(!validPolygon(poly))poly=R(...bbox(poly));const room={id:'recognized_'+i,name:($('#recognizedNames [data-recognized-room="'+i+'"]').value||r.name).slice(0,100),poly,mat:'tileGrey'};centerRoom(room);return room;}),next={version:2,title:state.title,geometry:{walls:result.walls.map(r=>[...r.map(n=>Math.round(n*scale)),'n']),windows:[],doors:[],slides:[],rooms},rooms:Object.fromEntries(rooms.map(r=>[r.id,{name:r.name,mat:r.mat}])),furniture:[],demolished:[],measures:[],systems:{routes:[],heating:[]},decor:{walls:[],customMaterials:[]},underlay,whiteboard:true};
  if(!$('#recognitionKeepImage').checked)delete next.underlay;validatePlan(next);mutate(()=>{state=next;ui.sel=null;});d.close();toggleEditor(true);setEditTool('select');fitView();toast('已生成户型草稿，校准尺寸后补充门窗；可撤销恢复原方案。');
 };d.showModal();$('#analyzeRecognition').click();
}
