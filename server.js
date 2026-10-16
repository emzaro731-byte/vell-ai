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
 const previewHtml=typeof req.body.html==='string'?req.body.html.trim():'';
 if(!prompt)return res.status(400).json({error:'Describe the app you want to build.'});
 if(prompt.length>8000)return res.status(400).json({error:'Prompt must be under 8,000 characters.'});
 if(!previewHtml)return res.status(400).json({error:'Build and preview your app first. The APK is created from that exact preview.'});
 if(previewHtml.length>1500000)return res.status(413).json({error:'This preview is too large to package (maximum 1.5 MB). Simplify the app and try again.'});
 if(!/^<!doctype html|^<html/i.test(previewHtml))return res.status(400).json({error:'The current preview is not valid HTML. Rebuild the preview and try again.'});
 if(!process.env.GITHUB_TOKEN)return res.status(503).json({error:'Add GITHUB_TOKEN in Render Environment. It needs permission to create repositories and Actions workflows.'});
 const fullRepo=process.env.GITHUB_REPO||'emzaro731-byte/vell-ai';
 const repoName=fullRepo.split('/')[1];
 const branch='apk-preview-'+Date.now().toString(36);
 const repo=await gh('https://api.github.com/repos/'+fullRepo);
 const baseSha=(await gh('https://api.github.com/repos/'+fullRepo+'/git/ref/heads/main')).object.sha;
 await gh('https://api.github.com/repos/'+fullRepo+'/git/refs',{method:'POST',body:JSON.stringify({ref:'refs/heads/'+branch,sha:baseSha})});
 repoUrl='https://github.com/'+fullRepo+'/tree/'+branch;
 const base='https://api.github.com/repos/'+fullRepo+'/contents/';
 async function putFile(filePath,content,message){
  await gh(base+filePath,{method:'PUT',body:JSON.stringify({message,content:Buffer.from(content).toString('base64'),branch})});
 }
 const safeHtml=previewHtml.replace(/<base\b[^>]*>/gi,'');
 const dart=[
 "import 'package:flutter/material.dart';",
 "import 'package:webview_flutter/webview_flutter.dart';",
 "",
 "void main() => runApp(const PreviewApp());",
 "",
 "class PreviewApp extends StatelessWidget {",
 "  const PreviewApp({super.key});",
 "  @override",
 "  Widget build(BuildContext context) => const MaterialApp(",
 "    debugShowCheckedModeBanner: false,",
 "    title: 'Preview app',",
 "    home: PreviewPage(),",
 "  );",
 "}",
 "",
 "class PreviewPage extends StatefulWidget {",
 "  const PreviewPage({super.key});",
 "  @override",
 "  State<PreviewPage> createState() => _PreviewPageState();",
 "}",
 "",
 "class _PreviewPageState extends State<PreviewPage> {",
 "  late final WebViewController controller;",
 "  @override",
 "  void initState() {",
 "    super.initState();",
 "    controller = WebViewController()",
 "      ..setJavaScriptMode(JavaScriptMode.unrestricted)",
 "      ..setBackgroundColor(const Color(0xFFFFFFFF))",
 "      ..loadFlutterAsset('assets/app.html');",
 "  }",
 "  @override",
 "  Widget build(BuildContext context) => Scaffold(",
 "    body: WebViewWidget(controller: controller),",
 "  );",
 "}"
 ].join('\n');
 const pubspec='name: '+repoName.replace(/-/g,'_')+'\ndescription: Exact preview packaged as a Flutter Android app\npublish_to: "none"\nversion: 1.0.0+1\nenvironment:\n  sdk: ">=3.3.0 <4.0.0"\ndependencies:\n  flutter:\n    sdk: flutter\n  webview_flutter: ^4.10.0\ndev_dependencies:\n  flutter_test:\n    sdk: flutter\n  flutter_lints: ^5.0.0\nflutter:\n  uses-material-design: true\n  assets:\n    - assets/app.html\n';
 const workflow='name: Build Flutter Android APK\non:\n  workflow_dispatch:\n  push:\n    branches: [main]\n    paths:\n      - "mobile/**"\n      - ".github/workflows/build-flutter-apk.yml"\npermissions:\n  contents: read\njobs:\n  build-apk:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v4\n      - uses: subosito/flutter-action@v2\n        with:\n          channel: stable\n          cache: true\n      - name: Create Android Flutter project scaffold\n        run: flutter create --platforms=android --org com.vellai.generated apk_project\n      - name: Install preview and Flutter source\n        run: |\n          cp mobile/pubspec.yaml apk_project/pubspec.yaml\n          cp mobile/lib/main.dart apk_project/lib/main.dart\n          mkdir -p apk_project/assets\n          cp mobile/assets/app.html apk_project/assets/app.html\n      - name: Resolve dependencies\n        working-directory: apk_project\n        run: flutter pub get\n      - name: Build release APK\n        working-directory: apk_project\n        run: flutter build apk --release\n      - uses: actions/upload-artifact@v4\n        with:\n          name: flutter-android-apk\n          path: apk_project/build/app/outputs/flutter-apk/app-release.apk\n          if-no-files-found: error\n          retention-days: 14\n';
 await putFile('mobile/pubspec.yaml',pubspec,'Configure preview-based Flutter APK');
 await putFile('mobile/lib/main.dart',dart,'Package exact preview in Flutter WebView');
 await putFile('mobile/assets/app.html',safeHtml,'Embed exact generated preview in Android app');
 await gh('https://api.github.com/repos/'+fullRepo+'/actions/workflows/flutter-android.yml/dispatches',{method:'POST',body:JSON.stringify({ref:branch})});
 res.status(202).json({ok:true,message:'The exact preview has been packaged on an isolated branch in the existing Vell AI repository. GitHub Actions is building the APK now.',repository:repoUrl,actionsUrl:'https://github.com/'+fullRepo+'/actions',workflowUrl:'https://github.com/'+fullRepo+'/actions/workflows/flutter-android.yml',sourceFile:'https://github.com/'+fullRepo+'/blob/'+branch+'/mobile/lib/main.dart'});
}catch(e){res.status(e.status||500).json({error:(e.message||'Could not create preview-based Flutter APK.')+(repoUrl?' Flutter source repository: '+repoUrl:'')})}});
app.get('/api/flutter-build-status',async(req,res)=>{try{
 const full=String(req.query.repository||'').trim();
 if(!/^[-A-Za-z0-9_.]+\/[-A-Za-z0-9_.]+$/.test(full))return res.status(400).json({error:'A valid owner/repository is required.'});
 const data=await gh('https://api.github.com/repos/'+full+'/actions/runs?per_page=1');
 const run=(data.workflow_runs||[])[0];
 if(!run)return res.json({ok:true,state:'queued',message:'Waiting for GitHub Actions to start the build.'});
 const artifacts=await gh('https://api.github.com/repos/'+full+'/actions/runs/'+run.id+'/artifacts');
 const artifact=(artifacts.artifacts||[]).find(a=>!a.expired&&a.name);
 const state=run.status==='completed'?(run.conclusion==='success'?'success':'failed'):(run.status||'queued');
 let errorSummary='';
 if(state==='failed'){
  try{
   const jobs=await gh('https://api.github.com/repos/'+full+'/actions/runs/'+run.id+'/jobs');
   const failed=(jobs.jobs||[]).find(j=>j.conclusion==='failure');
   if(failed)errorSummary='Build failed in step: '+failed.name+'. Open logs for details, or retry the build.';
  }catch(_){}
 }
 res.json({ok:true,state,runId:run.id,runNumber:run.run_number,runUrl:run.html_url,repository:full,message:state==='success'?'APK built successfully. Your ZIP is ready.':state==='failed'?(errorSummary||'Build failed.'):state==='in_progress'?'Flutter is compiling your APK. This can take a few minutes.':'Preparing the cloud build…',artifactId:artifact?.id||null,artifactName:artifact?.name||null,downloadUrl:artifact&&!artifact.expired?'/api/flutter-apk-zip?repository='+encodeURIComponent(full)+'&artifactId='+artifact.id:null});
 }catch(e){res.status(500).json({error:e.message||'Could not check the APK build.'})}});

app.post('/api/flutter-auto-fix',async(req,res)=>{try{
 const full=String(req.body.repository||'').trim(),runId=String(req.body.runId||'').trim();
 if(!/^[-A-Za-z0-9_.]+\/[-A-Za-z0-9_.]+$/.test(full)||!/^\d+$/.test(runId))return res.status(400).json({error:'A valid repository and failed run ID are required.'});
 if(!process.env.GROQ_API_KEY)throw Error('Automatic repair needs GROQ_API_KEY in Render.');
 const jobs=await gh('https://api.github.com/repos/'+full+'/actions/runs/'+runId+'/jobs');
 const failed=(jobs.jobs||[]).find(j=>j.conclusion==='failure');
 if(!failed) return res.status(409).json({error:'No failed build job was found to repair.'});
 const logResponse=await fetch('https://api.github.com/repos/'+full+'/actions/jobs/'+failed.id+'/logs',{headers:{Authorization:'Bearer '+process.env.GITHUB_TOKEN,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28'}});
 const logs=logResponse.ok?(await logResponse.text()).slice(-18000):'Build failed; logs unavailable.';
 const file=await gh('https://api.github.com/repos/'+full+'/contents/mobile/lib/main.dart');
 const source=Buffer.from(file.content||'','base64').toString('utf8');
 const aiResponse=await fetch('https://api.groq.com/openai/v1/chat/completions',{method:'POST',headers:{Authorization:'Bearer '+process.env.GROQ_API_KEY,'Content-Type':'application/json'},body:JSON.stringify({model:'openai/gpt-oss-120b',temperature:.1,max_tokens:10000,messages:[{role:'system',content:'You are repairing a Flutter Android release build. Return ONLY the complete corrected Dart source file. Fix compile errors shown in the build log while preserving the app features. Use Flutter SDK and dependencies already in pubspec.yaml only. No markdown fences or explanations.'},{role:'user',content:'Fix this Flutter source based on the failing build log.\nBUILD LOG:\n'+logs+'\nSOURCE FILE:\n'+source}]})});
 const ai=await aiResponse.json();if(!aiResponse.ok)throw Error(ai.error?.message||'AI could not repair the source.');
 const fixed=String(ai.choices?.[0]?.message?.content||'').replace(/^\s*```(?:dart)?\s*/i,'').replace(/\s*```\s*$/,'').trim();
 if(!fixed.includes('void main(')||!fixed.includes('MaterialApp')||fixed.length<200)throw Error('The automatic repair did not produce valid Flutter source.');
 await gh('https://api.github.com/repos/'+full+'/contents/mobile/lib/main.dart',{method:'PUT',body:JSON.stringify({message:'Vell AI automatic repair for failed Flutter APK build',content:Buffer.from(fixed).toString('base64'),sha:file.sha,branch:'main'})});
 res.json({ok:true,message:'Vell AI detected the build failure, repaired the Flutter source, and committed the fix. A new APK build has started automatically.'});
 }catch(e){res.status(500).json({error:e.message||'Automatic APK repair failed.'})}});

app.get('/api/flutter-apk-zip',async(req,res)=>{try{
 const full=String(req.query.repository||'').trim(),id=String(req.query.artifactId||'').trim();
 if(!/^[-A-Za-z0-9_.]+\/[-A-Za-z0-9_.]+$/.test(full)||!/^\d+$/.test(id))return res.status(400).json({error:'A valid repository and artifact ID are required.'});
 const response=await fetch('https://api.github.com/repos/'+full+'/actions/artifacts/'+id+'/zip',{headers:{Authorization:'Bearer '+process.env.GITHUB_TOKEN,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28'}});
 if(!response.ok)throw Error('GitHub could not download this artifact (HTTP '+response.status+').');
 res.setHeader('Content-Type','application/zip');res.setHeader('Content-Disposition','attachment; filename="vell-android-apk.zip"');
 const bytes=Buffer.from(await response.arrayBuffer());res.setHeader('Content-Length',bytes.length);res.end(bytes);
 }catch(e){res.status(500).json({error:e.message||'Could not download the APK ZIP.'})}});

app.post('/api/publish',async(req,res)=>{try{const token=process.env.GITHUB_TOKEN,repo=process.env.GITHUB_REPO,branch=process.env.GITHUB_BRANCH||'main';if(!token||!repo)return res.status(503).json({error:'Set GITHUB_TOKEN and GITHUB_REPO on Render.'});const html=String(req.body.html||'');if(!/^<!doctype html|^<html/i.test(html.trim())||html.length>500000)return res.status(400).json({error:'A valid HTML website under 500 KB is required.'});const base='https://api.github.com/repos/'+repo;let sha;try{sha=(await gh(base+'/contents/index.html?ref='+encodeURIComponent(branch))).sha}catch(e){if(!String(e.message).includes('Not Found'))throw e}const d=await gh(base+'/contents/index.html',{method:'PUT',body:JSON.stringify({message:'Publish AI-generated website',content:Buffer.from(html).toString('base64'),branch,...(sha?{sha}:{})})});res.json({ok:true,message:'Website committed to GitHub.',commit:d.commit?.html_url})}catch(e){res.status(500).json({error:e.message||'GitHub publishing failed.'})}});
app.post('/api/deploy',async(req,res)=>{try{const key=process.env.RENDER_API_KEY,id=process.env.RENDER_SERVICE_ID;if(!key||!id)return res.status(503).json({error:'This button only redeploys an existing Render service. Use Build & Deploy to create a new project, and configure RENDER_API_KEY and RENDER_OWNER_ID.'});const d=await renderApi('https://api.render.com/v1/services/'+encodeURIComponent(id)+'/deploys',{method:'POST',body:JSON.stringify({clearCache:'do_not_clear'})});res.json({ok:true,message:'Existing Render service deployment started.',deployId:d.id||d.deploy?.id||null})}catch(e){res.status(500).json({error:e.message||'Could not connect to Render API.'})}});
app.get('*',(req,res)=>res.sendFile(path.join(__dirname,'public','index.html')));app.listen(PORT,'0.0.0.0',()=>console.log('Vell AI Studio listening on '+PORT));
