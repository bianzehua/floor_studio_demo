const onlineUI={items:null,loading:false,busy:false};
async function providerJSON(path){const r=await fetch('https://api.polyhaven.com/'+path,{signal:AbortSignal.timeout(15000)});if(!r.ok)throw Error('模型素材库暂不可访问（HTTP '+r.status+'）');return r.json();}
function onlineModelPanel(){
 const root=$('#lib');if($('#onlineModels'))return;
 const section=document.createElement('details');section.id='onlineModels';section.className='editor-section';section.innerHTML='<summary>在线精细模型库</summary><p class="field-help">Powered by <a href="https://polyhaven.com/models" target="_blank" rel="noopener">Poly Haven</a> · 免费 CC0 模型，保留原始网格与 PBR 贴图。</p><label class="studio-field">搜索名称（支持英文）<input id="onlineSearch" placeholder="chair / sofa / computer / vase"></label><label class="studio-field">分类<select id="onlineCategory"><option value="interior">室内家具与摆件</option><option value="furniture">家具</option><option value="electronics">电子与家电</option><option value="decor">摆件与装饰</option><option value="all">所有模型</option></select></label><label class="studio-field">贴图分辨率<select id="onlineResolution"><option value="1k">1K · 较快</option><option value="2k">2K · 精细</option></select></label><button class="btn" id="loadOnlineModels">加载在线模型</button><p id="onlineStatus" role="status"></p><div id="onlineCards"></div><div class="external-market"><a class="btn" href="https://www.fab.com/" target="_blank" rel="noopener">Fab · 免费 / 收费模型</a><a class="btn" href="https://sketchfab.com/features/gltf" target="_blank" rel="noopener">Sketchfab · glTF 模型</a><button class="btn" id="importLicensedModel">导入下载的模型</button></div><p class="field-help">商城模型需在对应网站获取授权后下载。解压 glTF / OBJ / DAE 时，把贴图和附属文件一起导入；SKP 请先导出 DAE。</p>';
 root.querySelector('.furniture-search').after(section);$('#loadOnlineModels').onclick=loadOnlineModels;$('#onlineSearch').oninput=drawOnlineCards;$('#onlineCategory').onchange=drawOnlineCards;$('#importLicensedModel').onclick=async()=>{await openModeling('model');$('#modelAssetInput').click();};
 section.addEventListener('toggle',()=>{if(section.open&&!onlineUI.items&&!onlineUI.loading)loadOnlineModels();});
}
async function loadOnlineModels(){
 if(onlineUI.loading)return;onlineUI.loading=true;$('#onlineStatus').textContent='正在读取 Poly Haven 模型目录…';
 try{onlineUI.items=Object.entries(await providerJSON('assets?t=models')).filter(([id,a])=>/^[a-z0-9_]+$/.test(id)&&a.type===2).map(([id,a])=>({id,...a}));drawOnlineCards();}catch(e){$('#onlineStatus').textContent='在线目录连接失败。可打开素材官网下载，再导入模型。';}finally{onlineUI.loading=false;}
}
function drawOnlineCards(){
 if(!onlineUI.items||!$('#onlineCards'))return;const q=$('#onlineSearch').value.trim().toLowerCase(),category=$('#onlineCategory').value;
 const list=onlineUI.items.filter(a=>{const c=(a.category+' '+(a.categories||[]).join(' ')).toLowerCase(),s=(a.name+' '+a.id+' '+(a.tags||[]).join(' ')).toLowerCase();return (!q||s.includes(q))&&(category==='all'||category==='interior'?category==='all'||/furniture|decor|electronics|office|container|food|kitchen|lighting/.test(c):c.includes(category));});
 $('#onlineStatus').textContent='找到 '+list.length+' 个模型'+(list.length>24?' · 显示前 24 个，请搜索缩小范围':'');
 $('#onlineCards').innerHTML=list.slice(0,24).map(a=>{const url=a.thumbnail_url||'https://cdn.polyhaven.com/asset_img/thumbs/'+a.id+'.png?width=256&height=256';const safe=/^https:\/\/cdn\.polyhaven\.com\//.test(url)?url:'';return `<div class="online-card">${safe?`<img src="${esc(safe)}" alt="${esc(a.name)}" loading="lazy">`:''}<b>${esc(a.name)}</b><small>Poly Haven · CC0 · ${Number(a.polycount||0).toLocaleString()} 面</small><button class="btn" data-online-import="${a.id}">直接加入方案</button><a href="https://polyhaven.com/a/${a.id}" target="_blank" rel="noopener">模型详情 / 作者</a></div>`;}).join('');
 $('#onlineCards').querySelectorAll('[data-online-import]').forEach(b=>b.onclick=()=>importOnlineModel(b.dataset.onlineImport,$('#onlineResolution').value));
}
async function importOnlineModel(id,resolution='1k'){
 if(onlineUI.busy)return toast('正在导入在线模型，请稍候');onlineUI.busy=true;let status=$('#onlineStatus');
 try{
  if(!/^[a-z0-9_]+$/.test(id))throw Error('无效模型编号');status.textContent='正在获取模型与贴图…';
  const meta=await providerJSON('files/'+id),main=meta.gltf?.[resolution]?.gltf;if(!main)throw Error('此模型没有所选分辨率的 glTF，请在官网选择其他格式。');
  const parts=[[id+'.gltf',main],...Object.entries(main.include||{})];if(parts.reduce((sum,[,v])=>sum+v.size,0)>80*1024*1024)throw Error('模型超过 80MB，请选 1K 贴图或在官网下载后简化。');
  const files=[];let downloaded=0;
  for(const [name,part]of parts){const u=new URL(part.url);if(u.protocol!=='https:'||!['dl.polyhaven.org','dl.polyhaven.com'].includes(u.hostname))throw Error('素材下载地址不受支持');const response=await fetch(u,{signal:AbortSignal.timeout(45000)});if(!response.ok)throw Error('模型文件下载失败，请重试');const blob=await response.blob();downloaded+=blob.size;if(downloaded>80*1024*1024)throw Error('模型下载超过 80MB');const file=new File([blob],name.split('/').at(-1));Object.defineProperty(file,'webkitRelativePath',{value:name});files.push(file);status.textContent='已下载 '+files.length+'/'+parts.length+' 个文件…';}
  const before=new Set(modelData().objects.map(o=>o.id));await importModelFiles(files);const o=modelData().objects.find(o=>!before.has(o.id));if(!o)throw Error('模型导入失败，请查看导入提示');
  const item=onlineUI.items?.find(a=>a.id===id);mutate(()=>{o.name=item?.name||id;o.source='Poly Haven';o.sourceURL='https://polyhaven.com/a/'+id;o.license='CC0';});toast('已加入 Poly Haven 精细模型，含原始贴图。');
 }catch(e){if(status?.isConnected)status.textContent=e.message;toast(e.message);}finally{onlineUI.busy=false;}
}
const onlineBuildLib=buildLib;
buildLib=function(){onlineBuildLib();onlineModelPanel();};
buildLib();
