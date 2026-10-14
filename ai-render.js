let aiSource='',aiResult='',aiAccess='';
const aiDockBase=buildEffectsDock;
buildEffectsDock=function(){aiDockBase();$('#effectsDock').insertAdjacentHTML('beforeend','<button class="btn studio-primary" id="openAIRender">AI 写实效果图 · Gemini</button>');$('#openAIRender').onclick=openAIRender;};
function aiEndpoint(){const input=$('#aiBackend').value.trim();if(!input)return location.origin;const u=new URL(input);if(u.protocol!=='https:'&&!(u.protocol==='http:'&&['127.0.0.1','localhost'].includes(u.hostname)))throw Error('后端地址需要 HTTPS');return u.origin;}
async function openAIRender(){
 if(!is3D())await setView('3d');window.View3D.setBeauty(true);aiSource=window.View3D.snapshotBeauty();aiResult='';let saved='';try{saved=localStorage.getItem('floorplan-ai-backend')||'';}catch{}
 let dialog=$('#aiRenderDialog');if(!dialog){dialog=document.createElement('dialog');dialog.id='aiRenderDialog';document.body.appendChild(dialog);}
 dialog.innerHTML=`<div class="editor-head"><h2>AI 写实效果图</h2><p>发送当前 3D 视角到你配置的 Gemini 后端，按实际墙面、顶面和家具设计生成效果图。</p></div><div id="aiCompare"><figure><figcaption>当前设计参考图</figcaption><img src="${aiSource}" alt="当前真实 3D 设计"></figure><figure><figcaption>AI 生成结果</figcaption><div id="aiResultView"><p>生成后显示在这里</p></div></figure></div><label class="studio-field">设计风格与光照要求<textarea id="aiPrompt">写实室内摄影，保持当前布局与所有门窗位置，保留墙板及顶面造型，自然光，细腻木纹、真实布料、柔和间接光。</textarea></label><label class="studio-field">渲染后端地址<input id="aiBackend" type="url" value="${esc(saved)}" placeholder="https://你的腾讯云后端域名；本地运行可留空"></label><label class="studio-field">渲染访问口令<input id="aiAccess" type="password" autocomplete="off" value="${esc(aiAccess)}" placeholder="后端 AI_RENDER_TOKEN，不是 Gemini 密钥"></label><p class="field-help">Gemini API 密钥只在服务器配置。参考图会发送到该后端及 Gemini；生成结果可能产生视觉偏差，请与设计参考图核对。</p><p id="aiRenderStatus" role="status">正在检查后端…</p><div class="actions"><button class="btn" id="checkAIBackend">检查连接</button><button class="btn studio-primary" id="generateAI">生成写实效果图</button><button class="btn" id="downloadAI" disabled>下载效果图</button><button class="btn" id="exportAIReference">下载参考图</button><button class="btn" id="closeAI">关闭</button></div>`;
 dialog.showModal();$('#closeAI').onclick=()=>dialog.close();$('#checkAIBackend').onclick=checkAIBackend;$('#exportAIReference').onclick=()=>downloadAIImage(aiSource,'-AI参考图.png');$('#downloadAI').onclick=()=>downloadAIImage(aiResult,'-AI效果图.png');$('#generateAI').onclick=generateAIRender;$('#aiAccess').oninput=$('#aiBackend').oninput=()=>{$('#generateAI').disabled=true;};await checkAIBackend();
}
async function checkAIBackend(){
 const button=$('#generateAI'),check=$('#checkAIBackend');button.disabled=true;check.disabled=true;
 try{
  const endpoint=aiEndpoint(),r=await fetch(endpoint+'/api/render/status',{signal:AbortSignal.timeout(12000)}),s=await r.json();
  if(!r.ok)throw Error(s.error||'后端检查失败');
  if(!s.configured){$('#aiRenderStatus').textContent=s.message;return;}
  aiAccess=$('#aiAccess').value;
  if(!aiAccess){$('#aiRenderStatus').textContent='后端已配置。请填写渲染访问口令，再点击「检查连接」验证 Gemini 网络与模型。';return;}
  $('#aiRenderStatus').textContent='正在检查 Gemini 网络与模型，此操作不会生成图片…';
  const checkedAccess=aiAccess,probe=await fetch(endpoint+'/api/render/check',{method:'POST',headers:{Authorization:'Bearer '+checkedAccess},signal:AbortSignal.timeout(22000)});
  if(probe.status===404)throw Error('后端缺少连接检查接口，请更新代码并重启后端服务。');
  const result=await probe.json();
  if(!probe.ok)throw Error(result.error||'Gemini 连接检查失败');
  if(!result.reachable)throw Error('Gemini 连接尚未验证');
  if(checkedAccess!==$('#aiAccess').value||endpoint!==aiEndpoint()){ $('#aiRenderStatus').textContent='连接设置已变化，请重新检查。';return;}
  $('#aiRenderStatus').textContent=result.message+' · '+result.model;button.disabled=false;
 }catch(e){$('#aiRenderStatus').textContent=e.name==='TimeoutError'?'Gemini 连接检查超时，请检查后端代理与网络。':e.message==='Failed to fetch'?'无法连接渲染后端，请先部署后端并授权此网站地址。':e.message;}
 finally{check.disabled=false;}
}
async function generateAIRender(){const button=$('#generateAI');button.disabled=true;$('#aiRenderStatus').textContent='Gemini 正在生成写实效果图，通常需要几十秒至数分钟…';aiAccess=$('#aiAccess').value;try{const endpoint=aiEndpoint();try{localStorage.setItem('floorplan-ai-backend',endpoint);}catch{}const response=await fetch(endpoint+'/api/render',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+aiAccess},body:JSON.stringify({image:aiSource,prompt:$('#aiPrompt').value}),signal:AbortSignal.timeout(190000)}),data=await response.json();if(!response.ok)throw Error(data.error||'生成失败');if(!/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(data.image))throw Error('后端返回了无效图片');aiResult=data.image;const img=document.createElement('img');img.src=aiResult;img.alt='Gemini 根据当前设计生成的写实效果图';$('#aiResultView').replaceChildren(img);$('#downloadAI').disabled=false;$('#aiRenderStatus').textContent='已由 '+data.model+' 生成，请核对布局、尺寸和材料。';}catch(e){$('#aiRenderStatus').textContent=e.name==='TimeoutError'?'等待生成超时，请检查后端后重试。':e.message;}finally{button.disabled=false;}}
function downloadAIImage(src,suffix){const a=document.createElement('a');a.href=src;a.download=state.title+suffix;a.click();}
