'use strict';
// v0.6 單帳號同步試用版。雲端資料與照片都受 Supabase RLS/私有 bucket 保護。
const CLOUD_SESSION_KEY='siteflow_cloud_session_v1';
let cloudSession=null, cloudRevision=0, cloudReady=false, cloudArmed=false, cloudBusy=false, cloudDirty=false, cloudTimer=null;
const cloudURL=String(window.SITEFLOW_SUPABASE_URL||'').replace(/\/$/,'');
const cloudKey=String(window.SITEFLOW_SUPABASE_KEY||'');
const cloudConfigured=()=>/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(cloudURL)&&cloudKey.length>20;
let cloudLastMessage='';function cloudMessage(s){cloudLastMessage=s;const el=document.querySelector('#cloud-status');if(el)el.textContent=s;}
function cloudHeaders(token,extra={}){return {'apikey':cloudKey,'Authorization':'Bearer '+(token||cloudKey),...extra}}
async function cloudFetch(path,{method='GET',body,token,headers={}}={}){
 const r=await fetch(cloudURL+path,{method,headers:cloudHeaders(token,{...(body!==undefined?{'Content-Type':'application/json'}:{}),...headers}),body:body===undefined?undefined:JSON.stringify(body)});
 const t=await r.text();let result;try{result=t?JSON.parse(t):null}catch{result=t}
 if(!r.ok)throw Error((result?.message||result?.msg||result?.error_description||result?.error||'HTTP '+r.status).toString());return result;
}
async function cloudToken(){if(!cloudSession)return null;if(Date.now()<cloudSession.expires_at-60000)return cloudSession.access_token;
 const s=await cloudFetch('/auth/v1/token?grant_type=refresh_token',{method:'POST',body:{refresh_token:cloudSession.refresh_token}});cloudSetSession(s);return cloudSession.access_token;
}
function cloudSetSession(s){cloudSession={access_token:s.access_token,refresh_token:s.refresh_token,expires_at:Date.now()+(s.expires_in||3600)*1000};localStorage.setItem(CLOUD_SESSION_KEY,JSON.stringify(cloudSession))}
async function cloudAccount(action,email,password){if(!cloudConfigured())return alert('請先設定 cloud-config.js 的 Supabase URL 與 publishable/anon key。');
 try{cloudMessage('正在處理帳號…');const s=await cloudFetch('/auth/v1/'+(action==='signup'?'signup':'token?grant_type=password'),{method:'POST',body:{email,password}});
 if(!s.access_token){cloudMessage('註冊完成。請到電子郵件收取驗證信，完成後再登入。');return}
 cloudSetSession(s);cloudReady=false;cloudArmed=false;cloudDirty=false;cloudRevision=0;await cloudConnect();
 }catch(e){cloudMessage('帳號操作失敗：'+e.message)}
}
async function cloudConnect(){try{const token=await cloudToken();if(!token)return;const rows=await cloudFetch('/rest/v1/siteflow_snapshots?select=payload,revision&limit=1',{token});
 cloudRevision=rows[0]?.revision||0;cloudReady=true;cloudArmed=false;cloudDirty=false;
 if(rows.length){cloudMessage('已登入；雲端有資料。請選「下載雲端資料」或「上傳本機資料」。');}
 else cloudMessage('已登入；雲端尚無資料。請先備份，再按「上傳本機資料」。');
 }catch(e){cloudReady=false;cloudMessage('連線失敗：'+e.message)}
}
async function cloudUploadPhoto(p,token){const rec=await getPhoto(p.id);if(!rec?.blob)throw Error('缺少照片：'+p.id+'。請先確認本機照片或改從另一裝置下載雲端資料。');
 const ext=rec.blob.type==='image/png'?'png':rec.blob.type==='image/webp'?'webp':'jpg';
 const path=encodeURIComponent(cloudSession.user_id)+'/'+encodeURIComponent(p.id+'.'+ext);
 const res=await fetch(cloudURL+'/storage/v1/object/siteflow-photos/'+path,{method:'POST',headers:cloudHeaders(token,{'Content-Type':rec.blob.type||'image/jpeg','x-upsert':'false'}),body:rec.blob});
 if(!res.ok&&res.status!==409){const t=await res.text();throw Error('照片上傳失敗：'+t.slice(0,180))}
 return p.id+'.'+ext;
}
async function cloudUpload({automatic=false}={}){
 if(!cloudReady||cloudBusy||!cloudSession)return;if(automatic&&(!cloudDirty||!cloudArmed))return;
 cloudBusy=true;cloudMessage('正在上傳資料及照片…');
 try{const token=await cloudToken();const user=await cloudFetch('/auth/v1/user',{token});cloudSession.user_id=user.id;
 const payload=structuredClone(data);
 for(const p of payload.photos){p.cloudFile=await cloudUploadPhoto(p,token)}
 const rev=await cloudFetch('/rest/v1/rpc/siteflow_save_snapshot',{method:'POST',token,body:{p_payload:payload,p_expected_revision:cloudRevision}});
 cloudRevision=rev;cloudDirty=false;cloudArmed=true;cloudMessage('✓ 已同步至雲端（版本 '+rev+'）');
 }catch(e){cloudDirty=true;cloudMessage('同步未完成：'+e.message+'。請勿清除本機資料；如版本衝突，先備份再下載雲端資料。')}
 finally{cloudBusy=false}
}
async function cloudDownload(){if(!cloudReady||cloudBusy)return;cloudBusy=true;cloudMessage('正在下載雲端資料…');
 try{const token=await cloudToken();const rows=await cloudFetch('/rest/v1/siteflow_snapshots?select=payload,revision&limit=1',{token});if(!rows.length)throw Error('雲端目前沒有資料');
 const incoming=rows[0].payload;if(!incoming||!['sites','reports','costs','photos'].every(k=>Array.isArray(incoming[k])))throw Error('雲端資料格式不正確');
 const user=await cloudFetch('/auth/v1/user',{token});const blobs=[];
 for(const p of incoming.photos){if(!p.cloudFile)throw Error('照片缺少雲端路徑：'+p.id);const path=encodeURIComponent(user.id)+'/'+encodeURIComponent(p.cloudFile);
 const r=await fetch(cloudURL+'/storage/v1/object/authenticated/siteflow-photos/'+path,{headers:cloudHeaders(token)});if(!r.ok)throw Error('照片下載失敗：'+p.id);blobs.push({id:p.id,blob:await r.blob()})}
 // 全部下載成功才覆寫本機；先保留完整備份。
 if(!confirm('將雲端資料覆蓋目前瀏覽器的工地、日報、成本和照片？請先下載完整備份。')){cloudMessage('已取消下載');return}
 const tx=db.transaction('images','readwrite');tx.objectStore('images').clear();await new Promise((ok,fail)=>{tx.oncomplete=ok;tx.onerror=()=>fail(tx.error)});
 for(const b of blobs)await putPhoto(b);
 data=incoming;for(const s of data.sites)syncProgress(s);if(!save())throw Error('本機資料寫入失敗');
 cloudRevision=rows[0].revision;cloudDirty=false;cloudArmed=true;view={page:'home',siteId:null,tab:'overview'};render();cloudMessage('✓ 已下載雲端資料（版本 '+cloudRevision+'）');
 }catch(e){cloudMessage('下載失敗：'+e.message)}finally{cloudBusy=false}
}
function cloudLocalSaved(){if(!cloudReady||!cloudSession)return;cloudDirty=true;cloudMessage('本機已儲存，等待同步…');clearTimeout(cloudTimer);cloudTimer=setTimeout(()=>cloudUpload({automatic:true}),1300)}
async function cloudInit(){if(!cloudConfigured())return;try{cloudSession=JSON.parse(localStorage.getItem(CLOUD_SESSION_KEY)||'null');if(cloudSession)await cloudConnect()}catch(e){cloudMessage('登入資訊失效，請重新登入：'+e.message)}}
function cloudLogout(){cloudSession=null;cloudReady=false;cloudArmed=false;cloudDirty=false;cloudRevision=0;localStorage.removeItem(CLOUD_SESSION_KEY);cloudMessage('已登出；本機資料仍保留。')}
function cloudPage(){const logged=!!cloudSession;const msg=!cloudConfigured()?'尚未設定 Supabase。請參閱 README.md 的 cloud-config.js 設定步驟。':logged?'已登入。請先備份，首次同步時明確選擇上傳或下載。':'請先註冊或登入。';
 shell(`<div class="section-title"><div><span class="eyebrow">CLOUD WORKSPACE</span><h2>雲端同步與帳號</h2></div></div><section class="panel"><h3>同步狀態</h3><p class="notice" id="cloud-status">${esc(cloudLastMessage||msg)}</p><p class="notice">單帳號多裝置試用版：文字資料自動上傳；不同裝置首次使用請手動下載。照片會存入私有 Storage。請勿同時在兩台裝置編輯。</p>${logged?`<div class="actions"><button class="btn primary" data-cloud="upload">立即上傳本機資料</button><button class="btn" data-cloud="download">下載雲端資料（覆蓋本機）</button><button class="btn" data-cloud="logout">登出</button></div>`:`<form id="cloud-login-form" class="inline-form"><div class="field"><label>電子郵件</label><input type="email" name="email" autocomplete="username" required></div><div class="field"><label>密碼（至少 6 碼）</label><input type="password" name="password" autocomplete="current-password" minlength="6" required></div><div class="actions"><button class="btn primary" type="submit" name="action" value="login">登入</button><button class="btn" type="submit" name="action" value="signup">註冊</button></div></form>`}</section>`);
}
document.addEventListener('submit',e=>{if(e.target.id!=='cloud-login-form')return;e.preventDefault();const f=new FormData(e.target),action=e.submitter?.value||'login';cloudAccount(action,String(f.get('email')).trim(),String(f.get('password'))).then(()=>cloudPage())});
document.addEventListener('click',e=>{const btn=e.target.closest('[data-cloud]');if(!btn)return;const action=btn.dataset.cloud;if(action==='logout'){cloudLogout();cloudPage()}else if(action==='upload'){if(confirm('將本機資料上傳到雲端？若雲端已有其他裝置的更新，系統會拒絕覆蓋。'))cloudUpload()}else if(action==='download')cloudDownload()});
