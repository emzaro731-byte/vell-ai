import 'package:flutter/material.dart';

void main() => runApp(const VellBlankApp());

class VellBlankApp extends StatelessWidget {
  const VellBlankApp({super.key});

  @override
  Widget build(BuildContext context) {
    return const MaterialApp(
      debugShowCheckedModeBanner: false,
      home: Scaffold(
        backgroundColor: Colors.black,
        body: SizedBox.expand(),
      ),
    );
  }
}
