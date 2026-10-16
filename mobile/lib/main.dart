import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:http/http.dart' as http;

const apiBase = String.fromEnvironment(
  'VELL_API_BASE',
  defaultValue: 'https://vell-ai-1.onrender.com',
);

void main() => runApp(const VellApp());

class VellApp extends StatelessWidget {
  const VellApp({super.key});
  @override
  Widget build(BuildContext context) => MaterialApp(
        title: 'Vell AI',
        debugShowCheckedModeBanner: false,
        theme: ThemeData(
          brightness: Brightness.dark,
          scaffoldBackgroundColor: const Color(0xFF080A10),
          colorScheme: ColorScheme.fromSeed(
            seedColor: const Color(0xFF728BFF),
            brightness: Brightness.dark,
          ),
          useMaterial3: true,
        ),
        home: const ChatScreen(),
      );
}

class ChatMessage {
  ChatMessage(this.text, this.isUser);
  final String text;
  final bool isUser;
}

class ChatScreen extends StatefulWidget {
  const ChatScreen({super.key});
  @override
  State<ChatScreen> createState() => _ChatScreenState();
}

class _ChatScreenState extends State<ChatScreen> {
  final input = TextEditingController();
  final scroll = ScrollController();
  final messages = <ChatMessage>[];
  bool sending = false;

  @override
  void dispose() {
    input.dispose();
    scroll.dispose();
    super.dispose();
  }

  Future<void> send() async {
    final text = input.text.trim();
    if (text.isEmpty || sending) return;
    setState(() {
      messages.add(ChatMessage(text, true));
      sending = true;
      input.clear();
    });
    _scrollDown();
    try {
      final response = await http
          .post(
            Uri.parse('${apiBase.replaceAll(RegExp(r'/+$'), '')}/api/chat'),
            headers: const {'Content-Type': 'application/json'},
            body: jsonEncode({'message': text}),
          )
          .timeout(const Duration(seconds: 90));
      final data = jsonDecode(response.body);
      if (response.statusCode < 200 || response.statusCode >= 300) {
        throw Exception(data is Map ? (data['error'] ?? 'AI request failed') : 'AI request failed');
      }
      final reply = data is Map ? (data['reply']?.toString() ?? '') : '';
      if (reply.isEmpty) throw Exception('The AI returned an empty response.');
      if (mounted) setState(() => messages.add(ChatMessage(reply, false)));
    } catch (e) {
      if (mounted) {
        final detail = e.toString().replaceFirst('Exception: ', '');
        setState(() => messages.add(ChatMessage(
              'I could not reach Vell AI. Check your internet connection and confirm the backend is awake. Details: $detail',
              false,
            )));
      }
    } finally {
      if (mounted) {
        setState(() => sending = false);
        _scrollDown();
      }
    }
  }

  void _scrollDown() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (scroll.hasClients) {
        scroll.animateTo(scroll.position.maxScrollExtent,
            duration: const Duration(milliseconds: 250), curve: Curves.easeOut);
      }
    });
  }

  void newChat() => setState(() {
        messages.clear();
        input.clear();
      });

  @override
  Widget build(BuildContext context) {
    SystemChrome.setSystemUIOverlayStyle(const SystemUiOverlayStyle(
      statusBarColor: Color(0xFF080A10),
      statusBarIconBrightness: Brightness.light,
      systemNavigationBarColor: Color(0xFF080A10),
      systemNavigationBarIconBrightness: Brightness.light,
    ));
    return Scaffold(
      appBar: AppBar(
        backgroundColor: const Color(0xFF080A10),
        titleSpacing: 18,
        title: const Row(children: [
          _VellMark(),
          SizedBox(width: 10),
          Text('Vell AI', style: TextStyle(fontWeight: FontWeight.w700)),
          SizedBox(width: 8),
          _OnlinePill(),
        ]),
        actions: [
          IconButton(
            tooltip: 'New chat',
            onPressed: newChat,
            icon: const Icon(Icons.edit_square),
          ),
          const SizedBox(width: 8),
        ],
      ),
      body: Column(children: [
        Expanded(
          child: messages.isEmpty
              ? _welcome()
              : ListView.builder(
                  controller: scroll,
                  padding: const EdgeInsets.fromLTRB(16, 18, 16, 22),
                  itemCount: messages.length + (sending ? 1 : 0),
                  itemBuilder: (context, index) {
                    if (sending && index == messages.length) {
                      return const _TypingIndicator();
                    }
                    final message = messages[index];
                    return _MessageBubble(message: message);
                  },
                ),
        ),
        _composer(),
      ]),
    );
  }

  Widget _welcome() => Center(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(26),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const _VellMark(size: 58),
              const SizedBox(height: 22),
              const Text('What can I help with?',
                  textAlign: TextAlign.center,
                  style: TextStyle(fontSize: 28, fontWeight: FontWeight.w700, letterSpacing: -0.7)),
              const SizedBox(height: 10),
              const Text('Ask a question, plan an idea, or build something new.',
                  textAlign: TextAlign.center,
                  style: TextStyle(color: Color(0xFF9BA4B7), height: 1.5)),
              const SizedBox(height: 24),
              Wrap(
                alignment: WrapAlignment.center,
                spacing: 8,
                runSpacing: 8,
                children: [
                  _Suggestion(text: 'Build a website', onTap: () => _suggest('Help me plan and build a modern responsive website.')),
                  _Suggestion(text: 'Explain a topic', onTap: () => _suggest('Explain a difficult topic in simple steps.')),
                  _Suggestion(text: 'Write code', onTap: () => _suggest('Help me write and debug code.')),
                ],
              ),
            ],
          ),
        ),
      );

  void _suggest(String value) {
    input.text = value;
    input.selection = TextSelection.collapsed(offset: input.text.length);
  }

  Widget _composer() => SafeArea(
        top: false,
        child: Container(
          padding: const EdgeInsets.fromLTRB(14, 10, 14, 12),
          decoration: const BoxDecoration(
            color: Color(0xFF080A10),
            border: Border(top: BorderSide(color: Color(0xFF1C2230))),
          ),
          child: Container(
            decoration: BoxDecoration(
              color: const Color(0xFF151925),
              borderRadius: BorderRadius.circular(25),
              border: Border.all(color: const Color(0xFF30374A)),
            ),
            padding: const EdgeInsets.fromLTRB(14, 6, 7, 6),
            child: Row(crossAxisAlignment: CrossAxisAlignment.end, children: [
              Expanded(
                child: TextField(
                  controller: input,
                  minLines: 1,
                  maxLines: 6,
                  textCapitalization: TextCapitalization.sentences,
                  onSubmitted: (_) => send(),
                  decoration: const InputDecoration(
                    hintText: 'Message Vell AI',
                    hintStyle: TextStyle(color: Color(0xFF8992A5)),
                    border: InputBorder.none,
                    contentPadding: EdgeInsets.symmetric(vertical: 12),
                  ),
                ),
              ),
              const SizedBox(width: 8),
              IconButton.filled(
                tooltip: 'Send message',
                onPressed: sending ? null : send,
                icon: sending
                    ? const SizedBox(width: 19, height: 19, child: CircularProgressIndicator(strokeWidth: 2))
                    : const Icon(Icons.arrow_upward_rounded),
              ),
            ]),
          ),
        ),
      );
}

class _VellMark extends StatelessWidget {
  const _VellMark({this.size = 34});
  final double size;
  @override
  Widget build(BuildContext context) => Container(
        width: size,
        height: size,
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(size * .32),
          gradient: const LinearGradient(
            colors: [Color(0xFF8298FF), Color(0xFF58DDE2)],
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
          ),
        ),
        alignment: Alignment.center,
        child: Text('V', style: TextStyle(color: Color(0xFF08101B), fontSize: size * .52, fontWeight: FontWeight.w900)),
      );
}

class _OnlinePill extends StatelessWidget {
  const _OnlinePill();
  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
        decoration: BoxDecoration(color: const Color(0xFF12271F), borderRadius: BorderRadius.circular(20)),
        child: const Row(children: [
          Icon(Icons.circle, size: 6, color: Color(0xFF65DDA8)),
          SizedBox(width: 5),
          Text('AI', style: TextStyle(fontSize: 10, color: Color(0xFF9BE8C3))),
        ]),
      );
}

class _MessageBubble extends StatelessWidget {
  const _MessageBubble({required this.message});
  final ChatMessage message;
  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.only(bottom: 18),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisAlignment: message.isUser ? MainAxisAlignment.end : MainAxisAlignment.start,
          children: [
            if (!message.isUser) ...[const _VellMark(size: 28), const SizedBox(width: 10)],
            Flexible(
              child: Container(
                constraints: const BoxConstraints(maxWidth: 620),
                padding: const EdgeInsets.symmetric(horizontal: 15, vertical: 12),
                decoration: BoxDecoration(
                  color: message.isUser ? const Color(0xFF26365F) : const Color(0xFF121722),
                  border: Border.all(color: message.isUser ? const Color(0xFF344A80) : const Color(0xFF222A39)),
                  borderRadius: BorderRadius.circular(17),
                ),
                child: SelectableText(message.text, style: const TextStyle(fontSize: 15, height: 1.55)),
              ),
            ),
          ],
        ),
      );
}

class _TypingIndicator extends StatelessWidget {
  const _TypingIndicator();
  @override
  Widget build(BuildContext context) => const Padding(
        padding: EdgeInsets.fromLTRB(38, 8, 0, 20),
        child: Row(children: [
          SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2)),
          SizedBox(width: 12),
          Text('Vell AI is thinking…', style: TextStyle(color: Color(0xFF9BA4B7))),
        ]),
      );
}

class _Suggestion extends StatelessWidget {
  const _Suggestion({required this.text, required this.onTap});
  final String text;
  final VoidCallback onTap;
  @override
  Widget build(BuildContext context) => ActionChip(
        label: Text(text),
        onPressed: onTap,
        backgroundColor: const Color(0xFF151925),
        side: const BorderSide(color: Color(0xFF30374A)),
      );
}
