import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

void main() => runApp(const VellApp());

class VellApp extends StatelessWidget {
  const VellApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Vell AI',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        brightness: Brightness.dark,
        scaffoldBackgroundColor: Colors.black,
        useMaterial3: true,
      ),
      home: const ConversationScreen(),
    );
  }
}

class ConversationScreen extends StatefulWidget {
  const ConversationScreen({super.key});

  @override
  State<ConversationScreen> createState() => _ConversationScreenState();
}

class _ConversationScreenState extends State<ConversationScreen> {
  final TextEditingController _controller = TextEditingController();
  final ScrollController _scrollController = ScrollController();
  final List<String> _userMessages = [];

  @override
  void dispose() {
    _controller.dispose();
    _scrollController.dispose();
    super.dispose();
  }

  void _send() {
    final message = _controller.text.trim();
    if (message.isEmpty) return;
    setState(() {
      _userMessages.add(message);
      _controller.clear();
    });
    FocusScope.of(context).unfocus();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_scrollController.hasClients) {
        _scrollController.animateTo(
          _scrollController.position.maxScrollExtent,
          duration: const Duration(milliseconds: 250),
          curve: Curves.easeOut,
        );
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    SystemChrome.setSystemUIOverlayStyle(const SystemUiOverlayStyle(
      statusBarColor: Colors.black,
      statusBarIconBrightness: Brightness.light,
      systemNavigationBarColor: Color(0xFF08090B),
      systemNavigationBarIconBrightness: Brightness.light,
    ));

    return Scaffold(
      backgroundColor: Colors.black,
      body: SafeArea(
        bottom: false,
        child: Column(
          children: [
            _topBar(),
            Expanded(
              child: ListView(
                controller: _scrollController,
                padding: const EdgeInsets.fromLTRB(30, 4, 30, 26),
                children: [
                  const Text(
                    'APK build failure in your code',
                    style: TextStyle(
                      color: Color(0xFF777777),
                      fontSize: 18,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  const SizedBox(height: 26),
                  const Text(
                    'What I fixed',
                    style: TextStyle(
                      color: Color(0xFF777777),
                      fontSize: 25,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  const SizedBox(height: 22),
                  const _RichParagraph(
                    children: [
                      TextSpan(text: 'The build failed because '),
                      TextSpan(
                        text: 'flutter create',
                        style: TextStyle(fontFamily: 'monospace'),
                      ),
                      TextSpan(text: ' generated a default test that references '),
                      TextSpan(
                        text: 'MyApp',
                        style: TextStyle(fontFamily: 'monospace'),
                      ),
                      TextSpan(text: ", but your app doesn't define a class with that name."),
                    ],
                  ),
                  const SizedBox(height: 52),
                  const Text(
                    'I updated the workflow to:',
                    style: TextStyle(
                      color: Color(0xFFF5F5F5),
                      fontSize: 25,
                      height: 1.35,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  const SizedBox(height: 36),
                  const _Bullet(text: 'Analyze your actual app source in mobile/lib.'),
                  const _Bullet(text: 'Avoid failing on the unrelated generated template test.'),
                  const _Bullet(text: 'Keep the 7 MB APK size target.'),
                  const _Bullet(text: 'Preserve APK splitting, obfuscation, and tree-shaking.'),
                  const _Bullet(text: 'Continue packaging the APKs into a ZIP file.'),
                  const SizedBox(height: 48),
                  const Text(
                    '🔨 A new build has started',
                    style: TextStyle(
                      color: Color(0xFFF5F5F5),
                      fontSize: 24,
                      height: 1.4,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  const SizedBox(height: 22),
                  _ActionText(
                    label: 'Check the new build progress ↗',
                    onTap: () {},
                  ),
                  const SizedBox(height: 44),
                  _ActionText(
                    label: 'Open your Vell AI repository ↗',
                    onTap: () {},
                  ),
                  const SizedBox(height: 46),
                  const Text(
                    'The new build is queued. I haven’t confirmed that it passes or that the APK reaches 7 MB yet.',
                    style: TextStyle(
                      color: Color(0xFFF0F0F0),
                      fontSize: 23,
                      height: 1.45,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  for (final message in _userMessages) ...[
                    const SizedBox(height: 28),
                    Align(
                      alignment: Alignment.centerRight,
                      child: Container(
                        constraints: const BoxConstraints(maxWidth: 300),
                        padding: const EdgeInsets.all(16),
                        decoration: BoxDecoration(
                          color: const Color(0xFF292929),
                          borderRadius: BorderRadius.circular(22),
                        ),
                        child: Text(message,
                            style: const TextStyle(fontSize: 17, height: 1.4)),
                      ),
                    ),
                    const SizedBox(height: 20),
                    const Text(
                      'I’m here to help. Tell me what you’d like to change next.',
                      style: TextStyle(fontSize: 18, height: 1.5),
                    ),
                  ],
                  const SizedBox(height: 24),
                ],
              ),
            ),
            _composer(),
          ],
        ),
      ),
    );
  }

  Widget _topBar() {
    return Padding(
      padding: const EdgeInsets.fromLTRB(26, 12, 26, 14),
      child: Row(
        children: [
          _RoundButton(
            icon: Icons.menu_rounded,
            onTap: () => _showNotice('Chat history'),
          ),
          const Spacer(),
          Container(
            height: 56,
            padding: const EdgeInsets.symmetric(horizontal: 8),
            decoration: BoxDecoration(
              color: const Color(0xFF202020),
              border: Border.all(color: const Color(0xFF292929)),
              borderRadius: BorderRadius.circular(32),
            ),
            child: Row(
              children: [
                IconButton(
                  tooltip: 'New chat',
                  onPressed: () => setState(() => _userMessages.clear()),
                  icon: const Icon(Icons.edit_square, size: 27),
                ),
                IconButton(
                  tooltip: 'More options',
                  onPressed: () => _showNotice('Vell AI options'),
                  icon: const Icon(Icons.more_vert, size: 28),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _composer() {
    return Container(
      padding: const EdgeInsets.fromLTRB(22, 8, 22, 12),
      color: Colors.black,
      child: Container(
        constraints: const BoxConstraints(minHeight: 62),
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
        decoration: BoxDecoration(
          color: const Color(0xFF202020),
          border: Border.all(color: const Color(0xFF343434)),
          borderRadius: BorderRadius.circular(36),
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.end,
          children: [
            IconButton(
              onPressed: () => _showNotice('Attach a file'),
              icon: const Icon(Icons.add, size: 32),
              color: const Color(0xFFF5F5F5),
              padding: const EdgeInsets.all(7),
              constraints: const BoxConstraints(minWidth: 42, minHeight: 48),
            ),
            Expanded(
              child: Padding(
                padding: const EdgeInsets.only(bottom: 4),
                child: TextField(
                  controller: _controller,
                  minLines: 1,
                  maxLines: 5,
                  textCapitalization: TextCapitalization.sentences,
                  onSubmitted: (_) => _send(),
                  style: const TextStyle(fontSize: 18, color: Colors.white),
                  decoration: const InputDecoration(
                    hintText: 'Reply to Vell AI',
                    hintStyle: TextStyle(
                      color: Color(0xFFB7B7B7),
                      fontSize: 18,
                      fontWeight: FontWeight.w600,
                    ),
                    border: InputBorder.none,
                    contentPadding: EdgeInsets.symmetric(vertical: 13),
                    isDense: true,
                  ),
                ),
              ),
            ),
            IconButton(
              tooltip: 'Voice input',
              onPressed: () => _showNotice('Voice input'),
              icon: const Icon(Icons.mic_none_rounded, size: 29),
              color: const Color(0xFFF4F4F4),
            ),
            const SizedBox(width: 2),
            Padding(
              padding: const EdgeInsets.only(bottom: 2, right: 0),
              child: Material(
                color: const Color(0xFF1677F8),
                shape: const CircleBorder(),
                child: InkWell(
                  customBorder: const CircleBorder(),
                  onTap: _send,
                  child: const SizedBox(
                    width: 46,
                    height: 46,
                    child: Icon(Icons.graphic_eq_rounded,
                        color: Colors.white, size: 27),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  void _showNotice(String title) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(title),
        backgroundColor: const Color(0xFF303030),
        behavior: SnackBarBehavior.floating,
      ),
    );
  }
}

class _RoundButton extends StatelessWidget {
  const _RoundButton({required this.icon, required this.onTap});
  final IconData icon;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: const Color(0xFF202020),
      shape: const CircleBorder(),
      child: InkWell(
        customBorder: const CircleBorder(),
        onTap: onTap,
        child: SizedBox(
          width: 82,
          height: 82,
          child: Icon(icon, size: 32, color: Colors.white),
        ),
      ),
    );
  }
}

class _RichParagraph extends StatelessWidget {
  const _RichParagraph({required this.children});
  final List<InlineSpan> children;

  @override
  Widget build(BuildContext context) => Text.rich(
        TextSpan(
          style: const TextStyle(
            color: Color(0xFFF3F3F3),
            fontSize: 23,
            height: 1.48,
            fontWeight: FontWeight.w600,
          ),
          children: children,
        ),
      );
}

class _Bullet extends StatelessWidget {
  const _Bullet({required this.text});
  final String text;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(left: 12, bottom: 12),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Padding(
            padding: EdgeInsets.only(top: 2, right: 13),
            child: Text('•',
                style: TextStyle(fontSize: 25, fontWeight: FontWeight.w700)),
          ),
          Expanded(
            child: Text(
              text,
              style: const TextStyle(
                color: Color(0xFFF2F2F2),
                fontSize: 23,
                height: 1.45,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _ActionText extends StatelessWidget {
  const _ActionText({required this.label, required this.onTap});
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Text(
        label,
        style: const TextStyle(
          color: Color(0xFFF5F5F5),
          fontSize: 23,
          height: 1.4,
          fontWeight: FontWeight.w700,
          decoration: TextDecoration.underline,
          decorationStyle: TextDecorationStyle.dotted,
          decorationThickness: 1.5,
        ),
      ),
    );
  }
}
