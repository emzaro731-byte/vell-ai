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
