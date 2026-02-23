# SVG Animation Viewer

A browser-based tool for viewing, editing, and previewing SVG animations. Built with React + Vite.

## Features

- **Gallery grid** — view multiple SVG animations side by side (1 / 2 / 3 columns)
- **Global speed control** — adjust playback speed for all animations at once
- **Focus view** — click any animation to enlarge it with per-animation speed, stroke, and pause controls
- **Drag & drop** — add SVG files by dragging them onto the drop zone or browsing
- **Code editor** — paste or write SVG code with a live preview, then add it to the gallery
- **Keyboard navigation** — arrow keys to browse animations in focus view, Escape to close

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:5173/svg-animation/](http://localhost:5173/svg-animation/) in your browser.

## Build

```bash
npm run build
npm run preview
```

The production build outputs to `dist/`.

## Deployment

This project includes a GitHub Actions workflow (`.github/workflows/deploy.yml`) that automatically builds and deploys to GitHub Pages on push to `main`.

The `base` path in `vite.config.js` is set to `/svg-animation/`. Update it if your repository name differs.

## Project Structure

```
├── .github/workflows/deploy.yml  # GitHub Pages deployment
├── public/                       # Static assets
├── src/
│   ├── components/
│   │   ├── Card.jsx              # Individual SVG card
│   │   ├── CodeEditor.jsx        # SVG code editor with live preview
│   │   ├── DropZone.jsx          # File drag & drop
│   │   ├── FocusOverlay.jsx      # Expanded animation view
│   │   ├── Gallery.jsx           # Grid of animation cards
│   │   ├── Header.jsx            # Title and count
│   │   └── Toolbar.jsx           # Grid/speed/pause controls
│   ├── hooks/
│   │   └── useAnimation.js       # SVG speed/stroke/pause helpers
│   ├── App.jsx                   # Root component
│   ├── index.css                 # Global styles
│   └── main.jsx                  # Entry point
├── index.html                    # Vite HTML entry
├── vite.config.js                # Vite configuration
└── package.json
```

## License

MIT
