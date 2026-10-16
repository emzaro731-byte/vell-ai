import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:webview_flutter/webview_flutter.dart';

const apiBase = String.fromEnvironment('VELL_API_BASE', defaultValue: 'https://vell-ai-1.onrender.com');
void main() => runApp(const VellApp());

class VellApp extends StatelessWidget {
  const VellApp({super.key});
  @override
  Widget build(BuildContext context) => MaterialApp(
    title: 'Vell AI Studio', debugShowCheckedModeBanner: false,
    theme: ThemeData(useMaterial3: true, brightness: Brightness.dark,
      scaffoldBackgroundColor: const Color(0xFF080D18),
      colorScheme: ColorScheme.fromSeed(seedColor: const Color(0xFF6685FF), brightness: Brightness.dark),
      inputDecorationTheme: InputDecorationTheme(filled: true, fillColor: const Color(0xFF111827),
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(16)))),
    home: const StudioHome());
}

class StudioHome extends StatefulWidget {
  const StudioHome({super.key});
  @override
  State<StudioHome> createState() => _StudioHomeState();
}
class _StudioHomeState extends State<StudioHome> {
  final prompt = TextEditingController();
  bool busy = false;
  String status = 'Your next idea starts here.';
  String? html, siteUrl, repoUrl;
  int tab = 0;
  final templates = const [
    ('Online store', Icons.shopping_bag_outlined, 'Build a premium online store with product cards, search, cart, and mobile checkout UI.'),
    ('Business website', Icons.business_outlined, 'Build a modern business website with services, pricing, testimonials, and contact form.'),
    ('Mobile app UI', Icons.phone_iphone, 'Build a polished mobile-first dashboard with navigation, cards, forms, and interactive controls.'),
    ('Portfolio', Icons.person_outline, 'Build a futuristic personal portfolio with projects, skills, biography, and contact section.'),
  ];
  @override
  void dispose() { prompt.dispose(); super.dispose(); }

  Future<Map<String, dynamic>> callApi(String path, [Map<String, dynamic>? body]) async {
    final uri = Uri.parse(apiBase + path);
    final response = body == null
      ? await http.get(uri).timeout(const Duration(seconds: 45))
      : await http.post(uri, headers: {'Content-Type':'application/json'}, body: jsonEncode(body)).timeout(const Duration(minutes: 3));
    final data = jsonDecode(response.body);
    if (data is! Map<String, dynamic>) throw Exception('Unexpected response from Vell backend.');
    if (response.statusCode < 200 || response.statusCode >= 300) throw Exception(data['error']?.toString() ?? 'Request failed.');
    return data;
  }
  Future<void> perform(Future<void> Function() action) async {
    setState(() { busy = true; status = 'Working on your request…'; });
    try { await action(); } catch (e) { if (mounted) setState(() => status = e.toString().replaceFirst('Exception: ', '')); }
    finally { if (mounted) setState(() => busy = false); }
  }
  Future<void> generate() async {
    if (prompt.text.trim().isEmpty) { setState(() => status = 'Describe what you want to build first.'); return; }
    await perform(() async {
      final data = await callApi('/api/generate', {'prompt': prompt.text.trim()});
      setState(() { html = data['html']?.toString(); siteUrl = null; status = 'Preview ready. Review it before publishing.'; tab = 1; });
    });
  }
  Future<void> buildDeploy() async {
    if (prompt.text.trim().isEmpty) { setState(() => status = 'Describe your app before building.'); return; }
    await perform(() async {
      final data = await callApi('/api/build-and-deploy', {'prompt': prompt.text.trim()});
      setState(() { html = data['html']?.toString(); siteUrl = data['siteUrl']?.toString(); repoUrl = data['repository']?.toString(); status = data['message']?.toString() ?? 'Build started.'; tab = 1; });
    });
  }
  Future<void> retrieveUrl() async {
    await perform(() async {
      final data = await callApi('/api/sites');
      final list = data['sites'];
      if (list is List && list.isNotEmpty && list.first is Map) {
        setState(() { siteUrl = list.first['url']?.toString(); status = siteUrl == null ? 'No deployed URL found yet.' : 'Retrieved deployed URL.'; });
      } else {
        final fallback = await callApi('/api/site-url', {});
        setState(() { siteUrl = fallback['site'] is Map ? fallback['site']['url']?.toString() : null; status = fallback['message']?.toString() ?? 'No deployed URL available yet.'; });
      }
    });
  }
  void preview() {
    if (html == null || html!.isEmpty) { setState(() => status = 'Generate a project first.'); return; }
    Navigator.push(context, MaterialPageRoute(builder: (_) => PreviewPage(html: html!)));
  }
  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: Row(children: [
      Container(width: 36, height: 36, decoration: BoxDecoration(gradient: const LinearGradient(colors: [Color(0xFF7794FF), Color(0xFF8B5CF6)]), borderRadius: BorderRadius.circular(12)), child: const Icon(Icons.auto_awesome, color: Colors.white)),
      const SizedBox(width: 10), const Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text('Vell AI Studio', style: TextStyle(fontSize: 17, fontWeight: FontWeight.w800)),
        Text('BUILD • PREVIEW • PUBLISH', style: TextStyle(fontSize: 9, letterSpacing: 1.2, color: Color(0xFF9BAAC7)))])]),
      actions: [IconButton(onPressed: () => perform(() async { final d = await callApi('/api/health'); setState(() => status = d['ok'] == true ? 'Connected to Vell AI backend.' : 'Backend responded.'); }), icon: const Icon(Icons.cloud_done_outlined))]),
    body: SafeArea(child: IndexedStack(index: tab, children: [buildHome(), buildWorkspace()])),
    bottomNavigationBar: NavigationBar(selectedIndex: tab, onDestinationSelected: (v) => setState(() => tab = v), destinations: const [
      NavigationDestination(icon: Icon(Icons.auto_awesome_outlined), selectedIcon: Icon(Icons.auto_awesome), label: 'Build'),
      NavigationDestination(icon: Icon(Icons.web_asset_outlined), selectedIcon: Icon(Icons.web_asset), label: 'Workspace')]));
  Widget buildHome() => ListView(padding: const EdgeInsets.all(18), children: [
    Container(padding: const EdgeInsets.all(22), decoration: BoxDecoration(borderRadius: BorderRadius.circular(24), gradient: const LinearGradient(begin: Alignment.topLeft, end: Alignment.bottomRight, colors: [Color(0xFF1A2850), Color(0xFF15152D), Color(0xFF111827)]), border: Border.all(color: const Color(0xFF34456D))), child: const Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Text('✦  AI-POWERED APP BUILDER', style: TextStyle(fontSize: 10, color: Color(0xFFB7C5FF), letterSpacing: 1)),
      SizedBox(height: 18), Text('Imagine it.\nBuild it with AI.', style: TextStyle(fontSize: 32, height: 1.1, fontWeight: FontWeight.w800)),
      SizedBox(height: 12), Text('Create responsive websites and app experiences from a simple description.', style: TextStyle(color: Color(0xFFB4C0D8), height: 1.5)),
      SizedBox(height: 18), Text('⚡ Powered by GPT-OSS 120B via your Vell backend', style: TextStyle(fontSize: 11, color: Color(0xFFD1D8E8)))])),
    const SizedBox(height: 22), const Text('What do you want to build?', style: TextStyle(fontSize: 19, fontWeight: FontWeight.w700)),
    const SizedBox(height: 8), TextField(controller: prompt, minLines: 4, maxLines: 7, maxLength: 8000, decoration: const InputDecoration(hintText: 'Describe your website or app idea…', alignLabelWithHint: true)),
    const SizedBox(height: 10), Row(children: [
      Expanded(child: FilledButton.icon(onPressed: busy ? null : generate, icon: const Icon(Icons.auto_awesome), label: const Text('Generate preview'))),
      const SizedBox(width: 8), Expanded(child: OutlinedButton.icon(onPressed: busy ? null : buildDeploy, icon: const Icon(Icons.rocket_launch_outlined), label: const Text('Build & deploy')))]),
    if (busy) const Padding(padding: EdgeInsets.only(top: 14), child: LinearProgressIndicator()),
    const SizedBox(height: 14), Container(padding: const EdgeInsets.all(13), decoration: BoxDecoration(color: const Color(0xFF111827), borderRadius: BorderRadius.circular(14)), child: Text(status, style: const TextStyle(color: Color(0xFFC3CEE2), fontSize: 12, height: 1.45))),
    if (siteUrl != null && siteUrl!.startsWith('http')) linkCard('Live website', siteUrl!),
    if (repoUrl != null && repoUrl!.startsWith('http')) linkCard('GitHub repository', repoUrl!),
    const SizedBox(height: 24), const Text('Start with a template', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700)),
    const SizedBox(height: 12), GridView.builder(shrinkWrap: true, physics: const NeverScrollableScrollPhysics(), itemCount: templates.length, gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(crossAxisCount: 2, mainAxisSpacing: 10, crossAxisSpacing: 10, childAspectRatio: 1.2), itemBuilder: (context, i) {
      final item = templates[i];
      return InkWell(onTap: () { prompt.text = item.$3; }, borderRadius: BorderRadius.circular(16), child: Container(padding: const EdgeInsets.all(14), decoration: BoxDecoration(color: const Color(0xFF111827), borderRadius: BorderRadius.circular(16), border: Border.all(color: const Color(0xFF27334A))), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Icon(item.$2, color: const Color(0xFF9BAFFF), size: 24), const Spacer(), Text(item.$1, style: const TextStyle(fontWeight: FontWeight.w700)), const SizedBox(height: 4), const Text('Tap to use prompt', style: TextStyle(fontSize: 10, color: Color(0xFF8E9CB7)))])));
    }), const SizedBox(height: 14), OutlinedButton.icon(onPressed: busy ? null : retrieveUrl, icon: const Icon(Icons.link), label: const Text('Retrieve deployed website URL'))]);
  Widget buildWorkspace() => ListView(padding: const EdgeInsets.all(20), children: [
    const Text('Workspace', style: TextStyle(fontSize: 26, fontWeight: FontWeight.w800)),
    const SizedBox(height: 6), const Text('Review your generated project before publishing.', style: TextStyle(color: Color(0xFF9BAAC7))),
    const SizedBox(height: 20), Container(padding: const EdgeInsets.all(18), decoration: BoxDecoration(color: const Color(0xFF111827), borderRadius: BorderRadius.circular(20), border: Border.all(color: const Color(0xFF27334A))), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      const Text('Generated website', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 16)), const SizedBox(height: 12),
      Text(html == null ? 'No project generated yet. Return to Build and describe your idea.' : 'Generated HTML is ready to preview.', style: const TextStyle(color: Color(0xFF9BAAC7), height: 1.4)),
      const SizedBox(height: 16), SizedBox(width: double.infinity, child: FilledButton.icon(onPressed: html == null ? null : preview, icon: const Icon(Icons.visibility_outlined), label: const Text('Open live preview'))])),
    const SizedBox(height: 14), OutlinedButton.icon(onPressed: busy ? null : retrieveUrl, icon: const Icon(Icons.refresh), label: const Text('Refresh website URL')),
    if (siteUrl != null && siteUrl!.startsWith('http')) linkCard('Live website', siteUrl!),
    if (repoUrl != null && repoUrl!.startsWith('http')) linkCard('GitHub repository', repoUrl!),
    const SizedBox(height: 18), const Text('Backend URL is configurable at build time using VELL_API_BASE.', style: TextStyle(fontSize: 11, color: Color(0xFF7584A1)))]);

  Widget linkCard(String title, String url) => Container(margin: const EdgeInsets.only(top: 10), padding: const EdgeInsets.all(12), decoration: BoxDecoration(color: const Color(0xFF111827), borderRadius: BorderRadius.circular(12)), child: Row(children: [const Icon(Icons.link, color: Color(0xFF9BAFFF)), const SizedBox(width: 10), Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text(title, style: const TextStyle(fontWeight: FontWeight.w700)), Text(url, maxLines: 2, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 11, color: Color(0xFF9BAAC7)))]))]));
}
class PreviewPage extends StatefulWidget {
  final String html;
  const PreviewPage({super.key, required this.html});
  @override
  State<PreviewPage> createState() => _PreviewPageState();
}
class _PreviewPageState extends State<PreviewPage> {
  late final WebViewController controller;
  @override
  void initState() { super.initState(); controller = WebViewController()..setJavaScriptMode(JavaScriptMode.unrestricted)..setBackgroundColor(const Color(0xFFFFFFFF))..loadHtmlString(widget.html); }
  @override
  Widget build(BuildContext context) => Scaffold(appBar: AppBar(title: const Text('Live preview'), actions: [IconButton(onPressed: () => controller.reload(), icon: const Icon(Icons.refresh))]), body: WebViewWidget(controller: controller));
}
