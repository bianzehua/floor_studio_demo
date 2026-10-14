$('#renderEntry').onclick=async()=>{
 if(switching)return;closeStudio();if(!is3D())await setView('3d');if(!window.View3D)return;window.View3D.setBeauty(true);closeDrawers();buildEffectsDock();
};
function buildEffectsDock(){
 const d=$('#effectsDock');d.innerHTML=`<div><b>实时效果预览</b><small>WebGL 材质与光照 · 修改后即时同步</small></div><label>镜头<select id="effectRoom"><option value="all">全屋鸟瞰</option>${ROOMS.map(r=>`<option value="${r.id}">${esc(state.rooms[r.id].name)}</option>`).join('')}</select></label><label>光照<select id="effectLight"><option value="day">日光</option><option value="warm">傍晚</option><option value="night">夜景</option></select></label><label>曝光<input id="effectExposure" type="range" min="0.5" max="2" step="0.05" value="1.05"></label><label>导出宽度<select id="effectWidth"><option value="1920">1920 px</option><option value="2560" selected>2560 px</option></select></label><button class="btn save-button" id="exportEffect">保存效果图</button><button class="btn" id="closeEffects">关闭</button>`;
 $('#effectRoom').onchange=e=>e.target.value==='all'?$('#vIso').click():window.View3D.flyToRoom(e.target.value);
 d.insertAdjacentHTML('beforeend','<label>实时画质<select id="effectQuality"><option value="balanced">流畅 · PBR 材质</option><option value="fine">精细 · 环境遮蔽</option></select></label>');$('#effectQuality').onchange=e=>window.View3D.setRenderQuality(e.target.value);
 const light=()=>window.View3D.beautyLighting($('#effectLight').value,+$('#effectExposure').value);$('#effectLight').onchange=light;$('#effectExposure').oninput=light;
 $('#exportEffect').onclick=async()=>{const b=$('#exportEffect');b.disabled=true;b.textContent='正在导出…';try{await window.View3D.exportBeauty(+$('#effectWidth').value);}catch{toast('效果图导出失败，请降低分辨率后重试。');}b.disabled=false;b.textContent='保存效果图';};$('#closeEffects').onclick=()=>window.View3D.setBeauty(false);d.hidden=false;
}
