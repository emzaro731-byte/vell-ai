# Vell AI Studio — AI Website Builder

An AI website builder that generates responsive HTML with Groq, previews it, publishes to GitHub, and triggers Render deployments.

## Deploy on Render
Create a Web Service from this repository. Runtime: Node; build command `npm install`; start command `npm start`. Or select Docker to use the included Dockerfile.

Set these environment variables in Render:
- `GROQ_API_KEY` — Groq API key.
- `GROQ_MODEL` — optional model name; default `llama-3.3-70b-versatile`.
- `GITHUB_TOKEN` — GitHub token with Contents read/write access to the target website repository.
- `GITHUB_REPO` — target repository in `owner/repository` format. Publishing replaces its root `index.html`.
- `GITHUB_BRANCH` — optional; defaults to `main`.
- `RENDER_API_KEY` — Render API key.
- `RENDER_SERVICE_ID` — ID of the Render service to deploy.

Use a separate target repository for generated websites. Do not set `GITHUB_REPO` to this builder repository unless you want generated websites to replace its own `index.html`. Credentials are server-side only.

## Flow
1. Enter a website brief and generate it.
2. Review the preview and download HTML if desired.
3. Publish to the configured GitHub repository.
4. Trigger deployment of the configured Render service.

The target Render service must be connected to the same GitHub target repository and branch and configured to serve the generated HTML. Publishing and deployment are separate actions.

Health endpoint: `GET /api/health`.


## Vell AI full-stack generation
The Builder includes **Full-stack project** generation at `POST /api/generate-project`. It returns a reviewable JSON manifest of up to 12 source files from Groq. Generated files are starter code and still need review, environment configuration, and a deployment target; they are not automatically deployed by this endpoint.

## Vell Chat messaging app
Open `/messenger.html` after the service deploys. The app supports Supabase email/password sign-up and sign-in, contact lookup by email, private and group chat creation, realtime message updates, and image/video/file attachments.

Add these variables to the Render service environment:
- `SUPABASE_URL` — your Supabase project URL (or existing `NEXT_PUBLIC_SUPABASE_URL`).
- `SUPABASE_ANON_KEY` — the project's publishable/anon key (or `NEXT_PUBLIC_SUPABASE_ANON_KEY`). Never put the service-role key in browser code.
- `GROQ_API_KEY` — for AI chat and project generation.

Then open the Supabase SQL Editor and run `supabase/messenger-schema.sql`. Enable email/password sign-in in Supabase Authentication. For a production messaging service, review the SQL/storage access policies, configure email confirmation and abuse protection, and add message deletion, blocking/reporting, push notifications, and end-to-end encryption before launch. This starter is not WhatsApp and does not implement end-to-end encryption.


## Automatic build, preview, Render deploy, and APK
In the Vell AI chat, enter a prompt such as **"Build an app for tracking my daily expenses"**. Vell AI generates a self-contained web app, shows the HTML preview in the Builder, saves the named source under `generated-apps/<app-name>/index.html`, and updates `generated-apps/latest/index.html` in this same repository. If `RENDER_API_KEY` and `RENDER_OWNER_ID` are configured on the Vell AI Render service, it also creates a Render Static Site pointing at the named folder. A GitHub Actions workflow wraps the exact latest preview in a Flutter Android WebView APK and commits `releases/latest/Vell-App.apk` and `releases/latest/Vell-App-APK.zip` into this repository. The workflow run and release folder are linked in the Builder.

Required Render environment variables:
- `GROQ_API_KEY` for generation.
- `GITHUB_TOKEN` with contents write permission for `emzaro731-byte/vell-ai`.
- `RENDER_API_KEY` and `RENDER_OWNER_ID` for automatic Render site creation.

The APK wraps the generated web preview; this pipeline does not convert arbitrary generated HTML into native Flutter screens or automatically provision arbitrary backend services/databases. Wait for the GitHub Actions workflow to finish before downloading the APK.

## In-app Android APK builds

When a generated preview is ready, Vell AI can build that exact HTML preview into an Android APK from the **Android APK builder** panel. Build progress is polled inside the Vell AI page; users do not need to open GitHub Actions to watch it. If a build fails, the server retrieves the failed job logs, asks the configured Groq model to repair the Flutter entry point on the same temporary build branch, and waits for one retry. When the build succeeds, **Download APK ZIP** streams the ZIP directly from the Vell AI server.

Required Render environment variables:
- `GITHUB_TOKEN`: repository contents write, Actions read/write, and permission to create refs/branches.
- `GROQ_API_KEY`: used for source generation and one automatic repair attempt.
- `GITHUB_REPO` (optional): defaults to `emzaro731-byte/vell-ai`.

The build ZIP is only available after a successful Actions run. The APK wraps the exact generated HTML preview in a Flutter WebView; it does not automatically create a native Flutter implementation or provision external backends.
