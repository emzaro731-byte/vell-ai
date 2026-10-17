(()=>{'use strict';const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];let sessions=[],active=null,busy=false,html='';const $messages=$('#messages'),$input=$('#input'),$welcome=$('#welcome');function toast(s){const t=$('#toast');t.textContent=s;t.classList.add('show');clearTimeout(toast.timer);toast.timer=setTimeout(()=>t.classList.remove('show'),3000)}function save(){try{localStorage.setItem('vell-sessions',JSON.stringify(sessions.slice(0,30)))}catch{}}function current(){return sessions.find(s=>s.id===active)}function history(){const h=$('#history');h.innerHTML='';sessions.slice(0,25).forEach(s=>{const b=document.createElement('button');b.className='history-item';b.textContent=s.title;b.onclick=()=>{active=s.id;render();setView('chat')};h.append(b)})}function newChat(){const s={id:Date.now().toString(36)+Math.random().toString(36).slice(2),title:'New chat',messages:[]};sessions.unshift(s);active=s.id;save();history();render();setView('chat');$input.focus()}function add(role,content){const s=current();if(!s)return;s.messages.push({role,content:String(content)});if(role==='user'&&s.title==='New chat')s.title=content.slice(0,38);save();history();render()}function render(){const s=current(),msgs=s?.messages||[];$messages.innerHTML='';$welcome.classList.toggle('hidden',msgs.length>0);msgs.forEach((m,i)=>{const row=document.createElement('article');row.className='message '+m.role;const av=document.createElement('div');av.className='avatar';av.textContent=m.role==='user'?'You':'V';const body=document.createElement('div');body.className='body';const name=document.createElement('div');name.className='name';name.textContent=m.role==='user'?'You':'Vell AI';const bubble=document.createElement('div');bubble.className='bubble';bubble.textContent=m.content;body.append(name,bubble);if(m.role==='assistant'&&m.content!=='Thinking…'){const tools=document.createElement('div');tools.className='tools';const c=document.createElement('button');c.textContent='Copy';c.onclick=async()=>{try{await navigator.clipboard.writeText(m.content);toast('Copied')}catch{toast('Copy unavailable')}};tools.append(c);body.append(tools)}row.append(av,body);$messages.append(row)});requestAnimationFrame(()=>{$messages.lastElementChild?.scrollIntoView({block:'nearest',behavior:'smooth'})})}async function request(path,data){const r=await fetch(path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});const d=await r.json().catch(()=>({}));if(!r.ok)throw Error(d.error||'Request failed ('+r.status+')');return d}function size(el){el.style.height='auto';el.style.height=Math.min(el.scrollHeight,180)+'px'}async function autoBuild(prompt){busy=true;$('#send').disabled=true;$('#buildStatus').textContent='Building your app: generating preview, saving source, deploying to Render, and starting APK build…';setView('builder');$('#prompt').value=prompt;$('#preview').classList.add('hidden');$('#empty').classList.remove('hidden');$('#deployStatus').classList.remove('hidden');$('#deployDetails').textContent='Generating your app and preparing deployment…';try{const d=await request('/api/auto-build',{prompt});html=d.html||'';if(html){$('#frame').srcdoc=html;$('#preview').classList.remove('hidden');$('#empty').classList.add('hidden');$('#previewName').textContent=d.slug||'Generated app';$('#apkBuildPanel').classList.remove('hidden');startApkBuild(prompt,html)}const lines=['App preview: '+(d.slug||'Ready'),'Render URL: '+(d.siteUrl||'Deployment is provisioning or needs configuration.'),'APK build: tracked here in Vell AI; automatic error repair is enabled.','Download: the APK ZIP button will appear here when the build succeeds.',d.deployError?'Render note: '+d.deployError:'Render deployment requested successfully.'];$('#deployDetails').textContent=lines.join('\n');const linkBox=$('#deployLinks');linkBox.innerHTML='';[['Preview source',d.previewPath],['Render site',d.siteUrl]].forEach(([label,url])=>{if(url){const link=document.createElement('a');link.href=url;link.target='_blank';link.rel='noopener noreferrer';link.textContent=label;link.className='project-link';linkBox.append(link)}});$('#buildStatus').textContent='App preview is ready. APK progress and download are available in the Android APK builder panel below.';add('assistant','Your app has been generated and its preview is ready.\n\nSource: '+(d.sourcePath||d.repository)+'\nRender: '+(d.siteUrl||d.deployError||'Deployment is provisioning. Check Render in a minute.')+'\n\nThe APK build is tracked in the Android APK builder panel on this page. Vell AI will inspect a build failure, attempt an automatic repair, and show the ZIP download here when it is ready.')}catch(e){$('#buildStatus').textContent='Automatic build failed: '+e.message;$('#deployDetails').textContent=e.message;add('assistant','I could not finish the automatic build: '+e.message+'\n\nCheck the Render environment variables and GitHub Actions permissions, then try again.')}finally{busy=false;$('#send').disabled=false;render()}}async function chat(text){text=(text??$input.value).trim();if(!text||busy)return;if(!current())newChat();add('user',text);$input.value='';size($input);if(/\b(build|create|make|develop)\b.{0,80}\b(app|application|website|web app|site)\b/i.test(text)){return autoBuild(text)}busy=true;$('#send').disabled=true;const s=current();s.messages.push({role:'assistant',content:'Thinking…'});render();try{const d=await request('/api/chat',{message:text});s.messages.pop();add('assistant',d.reply||'No response received.')}catch(e){s.messages.pop();add('assistant','I could not reach the AI service: '+e.message+'\n\nCheck that your Render service is running and GROQ_API_KEY is configured.')}finally{busy=false;$('#send').disabled=false;render()}}function setView(v){const b=v==='builder';$('#chat').classList.toggle('hidden',b);$('#builder').classList.toggle('hidden',!b);$('#title').textContent=b?'App & Website Builder':'AI Assistant';$$('.nav').forEach(x=>x.classList.toggle('active',x.dataset.view===v));$('#sidebar').classList.remove('open')}async function generate(prompt,iterate=false){prompt=prompt.trim();if(!prompt||busy)return;busy=true;$('#generate').disabled=true;$('#update').disabled=true;$('#buildStatus').textContent=iterate?'Updating your preview…':'Generating website…';try{const d=await request('/api/generate',{prompt,existingHtml:iterate?html:''});if(!d.html)throw Error('AI returned no HTML.');html=d.html;$('#frame').srcdoc=html;$('#preview').classList.remove('hidden');$('#empty').classList.add('hidden');$('#previewName').textContent=prompt.slice(0,48);$('#apkBuildPanel').classList.remove('hidden');$('#buildStatus').textContent='Preview ready. Test it below, open it separately, or download the HTML.';if(iterate)$('#change').value=''}catch(e){$('#buildStatus').textContent='Generation failed: '+e.message;toast(e.message)}finally{busy=false;$('#generate').disabled=false;$('#update').disabled=false}}$('#chatForm').onsubmit=e=>{e.preventDefault();chat()};$input.oninput=()=>size($input);$input.onkeydown=e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();chat()}};$('#newChat').onclick=$('#newTop').onclick=newChat;$('#clearHistory').onclick=()=>{if(confirm('Delete saved chats from this device?')){sessions=[];active=null;save();history();render();toast('History cleared')}};$$('.nav').forEach(b=>b.onclick=()=>setView(b.dataset.view));$$('.cards button').forEach(b=>b.onclick=()=>{setView('builder');$('#prompt').value=b.dataset.prompt;generate(b.dataset.prompt)});$('#menu').onclick=()=>$('#sidebar').classList.add('open');$('#closeMenu').onclick=()=>$('#sidebar').classList.remove('open');$('#theme').onclick=()=>{document.body.classList.toggle('light');localStorage.setItem('vell-theme',document.body.classList.contains('light')?'light':'dark')};if(localStorage.getItem('vell-theme')==='light')document.body.classList.add('light');$('#buildForm').onsubmit=e=>{e.preventDefault();generate($('#prompt').value)};let generatedProject=null;$('#fullstack').onclick=async()=>{const prompt=$('#prompt').value.trim();if(!prompt){toast('Describe your app first.');return}const b=$('#fullstack');b.disabled=true;$('#buildStatus').textContent='Generating full-stack files…';try{const d=await request('/api/generate-project',{prompt});generatedProject=d;$('#projectTitle').textContent=(d.name||'Project')+' · '+d.files.length+' files';$('#projectFiles').textContent=d.files.map(f=>'// '+f.path+'\n'+f.content).join('\n\n');$('#projectOutput').classList.remove('hidden');$('#buildStatus').textContent=d.message||'Full-stack starter generated.';$('#projectOutput').scrollIntoView({behavior:'smooth',block:'nearest'})}catch(e){$('#buildStatus').textContent='Full-stack generation failed: '+e.message;toast(e.message)}finally{b.disabled=false}};$('#downloadProject').onclick=()=>{if(!generatedProject)return;const blob=new Blob([JSON.stringify(generatedProject,null,2)],{type:'application/json'});const u=URL.createObjectURL(blob);const a=document.createElement('a');a.href=u;a.download=(generatedProject.name||'vell-project')+'-source.json';a.click();URL.revokeObjectURL(u)};$('#update').onclick=()=>generate($('#change').value,true);$('#change').onkeydown=e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();$('#update').click()}};$('#open').onclick=()=>{if(!html)return;const u=URL.createObjectURL(new Blob([html],{type:'text/html'}));window.open(u,'_blank','noopener');setTimeout(()=>URL.revokeObjectURL(u),60000)};$('#download').onclick=()=>{if(!html)return;const u=URL.createObjectURL(new Blob([html],{type:'text/html;charset=utf-8'}));const a=document.createElement('a');a.href=u;a.download='vell-ai-site.html';a.click();URL.revokeObjectURL(u)};try{const x=JSON.parse(localStorage.getItem('vell-sessions')||'[]');if(Array.isArray(x))sessions=x}catch{}if(sessions.length)active=sessions[0].id;history();render();async function health(){try{const r=await fetch('/api/health'),d=await r.json();$('#health').textContent=d.aiConfigured?'AI connected':'Set GROQ_API_KEY in Render';$('#dot').style.background=d.aiConfigured?'#58d6a0':'#eab85a'}catch{$('#health').textContent='Server unavailable';$('#dot').style.background='#e66b77'}}health();setInterval(health,60000)
let apkBuildBusy=false;
let apkBuildBranch='';
let apkBuildRepository='emzaro731-byte/vell-ai';
let apkRepairAttempted=false;
function apkWait(ms){return new Promise(resolve=>setTimeout(resolve,ms))}
function paintApkProgress(percent,state,message,stage){
 const value=Math.max(0,Math.min(100,percent));
 $('#apkProgress').style.width=value+'%';
 $('#apkPercent').textContent=Math.round(value)+'%';
 $('#apkState').textContent=state;
 $('#apkMessage').textContent=message;
 const steps=$$('#apkSteps li');
 const order={queue:0,compile:1,repair:2,download:3,done:4};
 const active=order[stage]??0;
 steps.forEach((el,i)=>{el.classList.toggle('done',i<active||(stage==='done'));el.classList.toggle('current',i===active&&stage!=='done')});
}
async function readApkStatus(branch){
 const url='/api/flutter-build-status?repository='+encodeURIComponent(apkBuildRepository)+'&branch='+encodeURIComponent(branch);
 const response=await fetch(url,{cache:'no-store'});
 const data=await response.json().catch(()=>({}));
 if(!response.ok)throw Error(data.error||'Could not check APK build progress.');
 return data;
}
async function startApkBuild(prompt,sourceHtml){
 if(apkBuildBusy)return;
 if(!sourceHtml||!/^<!doctype html|^<html/i.test(sourceHtml.trim())){toast('Generate a valid preview before building the APK.');return}
 apkBuildBusy=true;apkRepairAttempted=false;
 $('#apkBuildPanel').classList.remove('hidden');
 $('#buildApkButton').disabled=true;
 $('#apkDownloadWrap').classList.add('hidden');
 $('#apkDownloadLink').removeAttribute('href');
 paintApkProgress(5,'Preparing APK build','Saving this exact preview and starting the Android build…','queue');
 try{
  const started=await request('/api/build-flutter-apk',{prompt:prompt||'Vell AI generated app',html:sourceHtml});
  apkBuildBranch=started.branch||'';
  apkBuildRepository=started.repositoryName||'emzaro731-byte/vell-ai';
  if(!apkBuildBranch)throw Error('The build service did not return a build ID.');
  paintApkProgress(10,'Build queued','The build has started. You can stay on this page; progress will update automatically.','queue');
  monitorApkBuild(apkBuildBranch, null, false);
 }catch(e){
  paintApkProgress(0,'Could not start build',e.message,'queue');
  $('#buildApkButton').disabled=false;
  apkBuildBusy=false;
  toast(e.message);
 }
}
async function monitorApkBuild(branch,ignoredRunId,repairAttempted){
 let percent=12,knownRunId=null,repairingRunId=null,loops=0;
 try{
  while(loops<240){
   loops++;await apkWait(7000);
   let d;
   try{d=await readApkStatus(branch)}catch(e){percent=Math.min(88,percent+1);paintApkProgress(percent,'Checking build…',e.message,'compile');continue}
   if(d.runId)knownRunId=String(d.runId);
   if(d.state==='success'&&d.downloadUrl){
    paintApkProgress(100,'APK ready','Build succeeded. Download the ZIP directly here—no GitHub page needed.','done');
    $('#apkDownloadLink').href=d.downloadUrl;
    $('#apkDownloadWrap').classList.remove('hidden');
    $('#buildStatus').textContent='Android APK built successfully. Your ZIP is ready to download below.';
    toast('APK ZIP is ready');
    return;
   }
   if(d.state==='failed'&&d.runId){
    if(!repairAttempted){
     repairAttempted=true;apkRepairAttempted=true;repairingRunId=String(d.runId);
     paintApkProgress(Math.max(percent,45),'Build error detected','Vell AI is reading the failed build logs and repairing the Flutter source automatically…','repair');
     try{
      const fixed=await request('/api/flutter-auto-fix',{repository:apkBuildRepository,runId:String(d.runId),branch});
      paintApkProgress(50,'Automatic repair applied',fixed.message||'A fix was committed. Waiting for the new build…','repair');
      continue;
     }catch(e){
      paintApkProgress(100,'Automatic repair needs attention',e.message,'repair');
      $('#buildStatus').textContent='APK build failed and automatic repair could not finish: '+e.message;
      return;
     }
    }
    if(repairingRunId&&String(d.runId)===repairingRunId){
     percent=Math.min(68,percent+1);
     paintApkProgress(percent,'Repair committed — waiting for retry','Vell AI has committed a fix and is waiting for the replacement build to start…','repair');
     continue;
    }
    paintApkProgress(100,'Build still failing','The automatic repair was attempted, but the retry also failed. Start another build to try again.','repair');
    $('#buildStatus').textContent='The APK build still has errors after one automatic repair. You can retry the build.';
    return;
   }
   if(d.state==='in_progress'||d.state==='queued'){
    percent=Math.min(88,percent+(d.state==='in_progress'?2:1));
    const stage=d.state==='in_progress'?'compile':'queue';
    paintApkProgress(percent,d.state==='in_progress'?'Compiling Android APK':'Waiting for build runner',d.message||'The build is running in the cloud. This page will keep checking automatically.',stage);
   }
  }
  paintApkProgress(100,'Build taking longer than expected','The build is still not finished. Tap Build Android APK to start a fresh attempt.','compile');
 }catch(e){
  paintApkProgress(percent,'Build monitor paused',e.message,'compile');
 }finally{
  apkBuildBusy=false;
  $('#buildApkButton').disabled=false;
 }
}
$('#buildApkButton').onclick=()=>startApkBuild($('#prompt').value.trim()||$('#previewName').textContent,html);
})();