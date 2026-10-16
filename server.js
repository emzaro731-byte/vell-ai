const express=require('express'),path=require('path');
const app=express();app.use(express.json({limit:'2mb'}));app.use(express.static(path.join(__dirname,'public')));
const PORT=process.env.PORT||10000;
app.get('/api/health',(_,r)=>r.json({ok:true,aiConfigured:!!process.env.GROQ_API_KEY,githubConfigured:!!process.env.GITHUB_TOKEN,renderConfigured:!!(process.env.RENDER_API_KEY&&process.env.RENDER_OWNER_ID)}));
async function generateHtml(prompt){
 if(!process.env.GROQ_API_KEY)throw Object.assign(Error('Add GROQ_API_KEY in Render Environment.'),{status:503});
 const r=await fetch('https://api.groq.com/openai/v1/chat/completions',{method:'POST',headers:{Authorization:'Bearer '+process.env.GROQ_API_KEY,'Content-Type':'application/json'},body:JSON.stringify({model:'openai/gpt-oss-120b',temperature:.35,max_tokens:7000,messages:[{role:'system',content:'Return ONLY a complete self-contained responsive HTML document. Include CSS and JavaScript inline. Use accessible semantic HTML, polished modern design and working front-end interactions. No markdown fences or explanation. Never claim a form or payment actually completed. The result must work as a static website on Render.'},{role:'user',content:'Build this website/app interface: '+prompt}]})});
 const d=await r.json();if(!r.ok)throw Object.assign(Error(d.error?.message||'AI generation failed'),{status:r.status});
 const html=(d.choices?.[0]?.message?.content||'').replace(/^\s*```(?:html)?\s*/i,'').replace(/\s*```\s*$/,'').trim();
 if(!/^<!doctype html|^<html/i.test(html))throw Object.assign(Error('AI returned invalid HTML. Try a clearer prompt.'),{status:502});
 return html;
}
app.post('/api/generate',async(req,res)=>{try{const prompt=String(req.body.prompt||'').trim();if(!prompt)return res.status(400).json({error:'Describe the website you want.'});if(prompt.length>8000)return res.status(400).json({error:'Prompt must be under 8,000 characters.'});res.json({html:await generateHtml(prompt)})}catch(e){res.status(e.status||500).json({error:e.message||'Could not generate website. Try again.'})}});
async function gh(url,opt={}){const r=await fetch(url,{...opt,headers:{Authorization:'Bearer '+process.env.GITHUB_TOKEN,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28','Content-Type':'application/json',...(opt.headers||{})}});const d=await r.json().catch(()=>({}));if(!r.ok)throw Error(d.message||'GitHub API error '+r.status);return d}
async function renderApi(url,opt={}){const r=await fetch(url,{...opt,headers:{Authorization:'Bearer '+process.env.RENDER_API_KEY,Accept:'application/json','Content-Type':'application/json',...(opt.headers||{})}});const d=await r.json().catch(()=>({}));if(!r.ok)throw Error(d.message||d.error||'Render API error '+r.status);return d}

async function listRenderSites(){
 if(!process.env.RENDER_API_KEY)throw Object.assign(Error('Add RENDER_API_KEY in Render Environment to retrieve deployed site URLs.'),{status:503});
 const data=await renderApi('https://api.render.com/v1/services?limit=100');
 const items=Array.isArray(data)?data:(data.services||data.items||[]);
 return items.map(item=>item.service||item).map(s=>({id:s.id||null,name:s.name||'Render site',type:s.type||s.serviceDetails?.runtime||'service',url:s.url||s.serviceDetails?.url||s.serviceDetails?.host||null,repo:s.repo||s.serviceDetails?.repo||null,status:s.suspended?'suspended':(s.status||s.serviceDetails?.status||'unknown')})).filter(s=>s.url||s.id);
}
app.get('/api/sites',async(req,res)=>{try{const sites=await listRenderSites();res.json({ok:true,sites:sites.filter(s=>s.url),message:sites.some(s=>s.url)?'Retrieved deployed site URLs.':'No site URLs are available yet. A new Render deployment may still be provisioning.'})}catch(e){res.status(e.status||500).json({error:e.message||'Could not retrieve Render site URLs.'})}});
app.post('/api/site-url',async(req,res)=>{try{
 const requested=String(req.body.serviceId||req.body.name||'').trim();
 if(requested&&process.env.RENDER_API_KEY){
  const encoded=encodeURIComponent(requested);
  try{const d=await renderApi('https://api.render.com/v1/services/'+encoded);const s=d.service||d;const url=s.url||s.serviceDetails?.url||null;if(url)return res.json({ok:true,site:{id:s.id||requested,name:s.name||'Render site',url},message:'Retrieved site URL.'});}catch(e){/* Search the service list as a fallback. */}
 }
 const sites=await listRenderSites();const matches=requested?sites.filter(s=>s.id===requested||s.name.toLowerCase().includes(requested.toLowerCase())):sites;
 const withUrls=matches.filter(s=>s.url);
 if(withUrls.length)return res.json({ok:true,sites:withUrls,message:'Retrieved deployed site URL(s).'});
 res.status(404).json({error:requested?'No deployed URL found for that service yet. Check Render deployment status and try again.':'No deployed site URLs found yet. Create a site with Build & Deploy, then ask Vell AI to retrieve its URL.'});
 }catch(e){res.status(e.status||500).json({error:e.message||'Could not retrieve site URL.'})}});

app.post('/api/build-and-deploy',async(req,res)=>{let repoUrl='';try{
 const prompt=String(req.body.prompt||'').trim();if(!prompt)return res.status(400).json({error:'Describe the app you want first.'});if(prompt.length>8000)return res.status(400).json({error:'Prompt must be under 8,000 characters.'});
 if(!process.env.GITHUB_TOKEN)return res.status(503).json({error:'Add GITHUB_TOKEN in Render Environment. It must be allowed to create repositories and push contents.'});
 if(!process.env.RENDER_API_KEY||!process.env.RENDER_OWNER_ID)return res.status(503).json({error:'Add RENDER_API_KEY and RENDER_OWNER_ID in Render Environment.'});
 const html=await generateHtml(prompt);
 const slug=prompt.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,24)||'ai-app';
 const repoName=('vell-'+slug+'-'+Date.now().toString().slice(-7)).slice(0,90);
 const repo=await gh('https://api.github.com/user/repos',{method:'POST',body:JSON.stringify({name:repoName,description:'AI-generated website built with Vell AI Studio',private:false,auto_init:true})});
 repoUrl=repo.html_url;
 await gh('https://api.github.com/repos/'+repo.full_name+'/contents/index.html',{method:'PUT',body:JSON.stringify({message:'Build AI-generated app with Vell AI Studio',content:Buffer.from(html).toString('base64'),branch:repo.default_branch||'main'})});
 const created=await renderApi('https://api.render.com/v1/services',{method:'POST',body:JSON.stringify({type:'static_site',name:repoName.toLowerCase().slice(0,50),ownerId:process.env.RENDER_OWNER_ID,repo:repo.html_url,branch:repo.default_branch||'main',autoDeployTrigger:'commit',serviceDetails:{buildCommand:'',publishPath:'.'}})});
 const service=created.service||created;
 let siteUrl=service.serviceDetails?.url||service.url||null;
 if(!siteUrl&&service.id){for(let attempt=0;attempt<4&&!siteUrl;attempt++){try{await new Promise(resolve=>setTimeout(resolve,1500));const latest=await renderApi('https://api.render.com/v1/services/'+encodeURIComponent(service.id));const s=latest.service||latest;siteUrl=s.serviceDetails?.url||s.url||null;}catch(_){}}}
 res.status(202).json({ok:true,html,repository:repo.html_url,serviceId:service.id||null,dashboardUrl:service.dashboardUrl||null,siteUrl,message:siteUrl?'Project created. Render site URL retrieved: '+siteUrl:'Project created on GitHub and Render deployment started. The URL is not available yet; ask Vell AI to retrieve the site URL again in a minute.'});
 }catch(e){res.status(500).json({error:(e.message||'Build/deploy failed')+(repoUrl?' Your generated code was saved at '+repoUrl:'')})}});

app.post('/api/build-flutter-apk',async(req,res)=>{let repoUrl='';try{
 const prompt=String(req.body.prompt||'').trim();
 if(!prompt)return res.status(400).json({error:'Describe the Flutter app you want to build.'});
 if(prompt.length>8000)return res.status(400).json({error:'Prompt must be under 8,000 characters.'});
 if(!process.env.GROQ_API_KEY)return res.status(503).json({error:'Add GROQ_API_KEY in Render Environment.'});
 if(!process.env.GITHUB_TOKEN)return res.status(503).json({error:'Add GITHUB_TOKEN in Render Environment. It needs permission to create repositories and Actions workflows.'});
 const answer=await fetch('https://api.groq.com/openai/v1/chat/completions',{method:'POST',headers:{Authorization:'Bearer '+process.env.GROQ_API_KEY,'Content-Type':'application/json'},body:JSON.stringify({model:'openai/gpt-oss-120b',temperature:.25,max_tokens:9000,messages:[{role:'system',content:'You are an expert Flutter engineer. Return ONLY a complete, compilable Dart source file for lib/main.dart. Do not use markdown fences. Build a polished mobile app based on the user request. Use only Flutter SDK libraries and Material 3; do not import third-party packages, do not use assets, do not reference generated files, and do not include API keys/secrets. Make UI interactions compile and work locally; clearly mark mock data where a real backend is not specified. Include main() and a MaterialApp. Ensure Dart syntax is valid and the app works on Android.'},{role:'user',content:'Create this Flutter Android app: '+prompt}]})});
 const ai=await answer.json();
 if(!answer.ok)throw Object.assign(Error(ai.error?.message||'Flutter code generation failed.'),{status:answer.status});
 const dart=String(ai.choices && ai.choices[0] && ai.choices[0].message && ai.choices[0].message.content || '').replace(/^\s*\x60{3}(?:dart)?\s*/i,'').replace(/\s*\x60{3}\s*$/,'').trim();
 if(!dart.includes('void main(')||!dart.includes('MaterialApp')||dart.length<200)throw Object.assign(Error('AI did not return a valid Flutter entry point. Please try a more specific app description.'),{status:502});
 const slug=prompt.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,24)||'flutter-app';
 const repoName=('vell-flutter-'+slug+'-'+Date.now().toString().slice(-6)).slice(0,90);
 const repo=await gh('https://api.github.com/user/repos',{method:'POST',body:JSON.stringify({name:repoName,description:'AI-generated Flutter Android app built with Vell AI Studio',private:false,auto_init:true})});
 repoUrl=repo.html_url;
 const base='https://api.github.com/repos/'+repo.full_name+'/contents/';
 async function putFile(path,content,message){
  await gh(base+path,{method:'PUT',body:JSON.stringify({message,content:Buffer.from(content).toString('base64'),branch:repo.default_branch||'main'})});
 }
 const pubspec='name: '+repoName.replace(/-/g,'_')+'\ndescription: AI-generated Flutter app from Vell AI Studio\npublish_to: "none"\nversion: 1.0.0+1\nenvironment:\n  sdk: ">=3.3.0 <4.0.0"\ndependencies:\n  flutter:\n    sdk: flutter\ndev_dependencies:\n  flutter_test:\n    sdk: flutter\n  flutter_lints: ^5.0.0\nflutter:\n  uses-material-design: true\n';
 const workflow='name: Build Flutter Android APK\non:\n  workflow_dispatch:\n  push:\n    branches: [main]\n    paths:\n      - "mobile/**"\n      - ".github/workflows/build-flutter-apk.yml"\npermissions:\n  contents: read\njobs:\n  build-apk:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v4\n      - uses: subosito/flutter-action@v2\n        with:\n          channel: stable\n          cache: true\n      - name: Create Android Flutter project scaffold\n        run: flutter create --platforms=android --org com.vellai.generated apk_project\n      - name: Install generated app source\n        run: |\n          cp mobile/pubspec.yaml apk_project/pubspec.yaml\n          cp mobile/lib/main.dart apk_project/lib/main.dart\n      - name: Resolve dependencies\n        working-directory: apk_project\n        run: flutter pub get\n      - name: Build release APK\n        working-directory: apk_project\n        run: flutter build apk --release\n      - uses: actions/upload-artifact@v4\n        with:\n          name: flutter-android-apk\n          path: apk_project/build/app/outputs/flutter-apk/app-release.apk\n          if-no-files-found: error\n          retention-days: 14\n';
 await putFile('mobile/pubspec.yaml',pubspec,'Add Flutter app package configuration');
 await putFile('mobile/lib/main.dart',dart,'Generate Flutter app with Vell AI Studio');
 await putFile('.github/workflows/build-flutter-apk.yml',workflow,'Add automatic Flutter APK build workflow');
 res.status(202).json({ok:true,message:'Flutter source generated and uploaded. GitHub Actions is preparing the Android APK. Open the Actions link and download the flutter-android-apk artifact after the run succeeds.',repository:repoUrl,actionsUrl:'https://github.com/'+repo.full_name+'/actions',workflowUrl:'https://github.com/'+repo.full_name+'/actions/workflows/build-flutter-apk.yml',sourceFile:'https://github.com/'+repo.full_name+'/blob/main/mobile/lib/main.dart'});
}catch(e){res.status(e.status||500).json({error:(e.message||'Could not create Flutter APK project.')+(repoUrl?' Flutter source repository: '+repoUrl:'')})}});

app.post('/api/publish',async(req,res)=>{try{const token=process.env.GITHUB_TOKEN,repo=process.env.GITHUB_REPO,branch=process.env.GITHUB_BRANCH||'main';if(!token||!repo)return res.status(503).json({error:'Set GITHUB_TOKEN and GITHUB_REPO on Render.'});const html=String(req.body.html||'');if(!/^<!doctype html|^<html/i.test(html.trim())||html.length>500000)return res.status(400).json({error:'A valid HTML website under 500 KB is required.'});const base='https://api.github.com/repos/'+repo;let sha;try{sha=(await gh(base+'/contents/index.html?ref='+encodeURIComponent(branch))).sha}catch(e){if(!String(e.message).includes('Not Found'))throw e}const d=await gh(base+'/contents/index.html',{method:'PUT',body:JSON.stringify({message:'Publish AI-generated website',content:Buffer.from(html).toString('base64'),branch,...(sha?{sha}:{})})});res.json({ok:true,message:'Website committed to GitHub.',commit:d.commit?.html_url})}catch(e){res.status(500).json({error:e.message||'GitHub publishing failed.'})}});
app.post('/api/deploy',async(req,res)=>{try{const key=process.env.RENDER_API_KEY,id=process.env.RENDER_SERVICE_ID;if(!key||!id)return res.status(503).json({error:'This button only redeploys an existing Render service. Use Build & Deploy to create a new project, and configure RENDER_API_KEY and RENDER_OWNER_ID.'});const d=await renderApi('https://api.render.com/v1/services/'+encodeURIComponent(id)+'/deploys',{method:'POST',body:JSON.stringify({clearCache:'do_not_clear'})});res.json({ok:true,message:'Existing Render service deployment started.',deployId:d.id||d.deploy?.id||null})}catch(e){res.status(500).json({error:e.message||'Could not connect to Render API.'})}});
app.get('*',(req,res)=>res.sendFile(path.join(__dirname,'public','index.html')));app.listen(PORT,'0.0.0.0',()=>console.log('Vell AI Studio listening on '+PORT));
