# Vell AI Studio — Flutter Mobile App

Android-first Flutter companion app for this repository's Vell AI website builder.

## Features
- Dark navy/blue mobile-first interface
- Prompt templates
- Generate website HTML using the existing backend `POST /api/generate`
- Preview generated HTML in an in-app WebView
- Build and deploy using `POST /api/build-and-deploy`
- Retrieve deployed Render URLs
- GitHub Actions release APK workflow

## Backend
Default API base: `https://vell-ai-1.onrender.com`. If your Render service URL differs, build with:
```sh
flutter build apk --release --dart-define=VELL_API_BASE=https://YOUR-SERVICE.onrender.com
```
Groq, GitHub, and Render secrets remain on the backend; they are not embedded in the APK.

## Build
```sh
cd mobile
flutter create --platforms=android --org com.netville.vellai .
flutter pub get
flutter build apk --release
```
Or run **Build Vell AI Studio Android APK** from GitHub Actions, then download and extract the `vell-ai-studio-android-apk` artifact.
