# Boxscore

Live! [https://preraku.github.io/boxscore/](https://preraku.github.io/boxscore/)

Boxscore tracker built with React + TypeScript + Vite.

## Local development

```bash
bun install
bun run dev
```

## Test share sheet on iPhone

The Web Share API file flow requires a secure (`https`) origin on iOS. For local testing, run Vite and expose it through a Cloudflare tunnel:

```bash
bun run dev --host
cloudflared tunnel --url http://localhost:5173
```

If needed, install Cloudflare Tunnel first:

```bash
brew install cloudflared
```

Open the `https://*.trycloudflare.com` URL printed by `cloudflared` on your iPhone.
