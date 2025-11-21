# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Legal Tools Suite - A privacy-focused legal toolkit built with Astro and Tailwind CSS. All tools run entirely client-side in the browser with no server processing or data transmission. Designed for legal professionals working with depositions, evidence, and case materials.

### Development Environment

**Critical: This app is developed exclusively in GitHub Codespaces.** Understanding this is essential for debugging:

- Dev server URLs use Codespaces port forwarding (e.g., `https://friendly-spork-q6vgvwr5gr2979x-4321.app.github.dev`)
- Some CORS or module loading issues may be Codespaces-specific, not code issues
- CDN-loaded resources (FFmpeg, etc.) work fine in this environment
- If you encounter "Failed to fetch dynamically imported module" errors, verify the CDN URL is accessible from Codespaces
- Testing should account for the remote development environment
- Production builds work normally and can be deployed to any static hosting

## Development Commands

```bash
npm run dev      # Start dev server (localhost:4321)
npm run build    # Build for production (outputs to dist/)
npm run preview  # Preview production build locally
```

## Tech Stack

- **Framework**: Astro 5.16.0 (Static Site Generator, SSG mode)
- **Styling**: Tailwind CSS 3.4.0 with @tailwindcss/typography plugin
- **Key Libraries**:
  - jsPDF (PDF generation)
  - FFmpeg.wasm (video processing via CDN)
  - DOMPurify (XSS sanitization - not installed, load via CDN)
  - html2canvas (screenshot capture - load via CDN)

## Architecture

### Routing Structure
Astro uses file-based routing. All pages live in `src/pages/`:
- `index.astro` - Homepage with tool cards
- `tools/*.astro` - Individual tool pages
- `404.astro` - 404 page

### Layout Pattern
All pages extend `BaseLayout.astro` which provides:
- Header with site title and home navigation
- Footer with copyright
- Consistent responsive wrapper (max-w-7xl)
- SEO meta tags

### Tool Pages Architecture
Each tool page is a self-contained `.astro` file with:
- Frontmatter for imports and props
- HTML/Astro components in the template
- `<script>` tag with client-side JavaScript (runs in browser)
- `<style>` tag for scoped styles (if needed)

**Important**: Client-side JavaScript in `<script>` tags runs after page load. Use standard DOM APIs and event listeners. All processing is client-side only.

### Component Structure
- `BaseLayout.astro` - Shared layout wrapper
- `ToolCard.astro` - Reusable tool card component for homepage

### Styling Approach
- Tailwind utility classes for all styling
- Primary color palette: `primary-{50-900}` (blue theme)
- Responsive breakpoints: `sm:`, `md:`, `lg:`
- No custom CSS files except global.css (Tailwind imports only)

## Critical Privacy Requirements

**This is legal software - privacy is non-negotiable:**
1. **No server processing** - Everything runs in the browser
2. **No data transmission** - Files never leave the user's device
3. **No analytics** - No tracking or telemetry
4. **No storage** - No cookies or localStorage unless explicitly user-initiated
5. All external libraries must be loaded via CDN or bundled (never make API calls to external services without explicit user consent)

## FFmpeg Integration Pattern

FFmpeg cannot be imported from npm in Astro. Always load from CDN:

```javascript
// ✅ Correct approach (video-editing.astro):
const { FFmpeg } = await import('https://unpkg.com/@ffmpeg/ffmpeg@0.12.7/dist/esm/index.js');
const { toBlobURL } = await import('https://unpkg.com/@ffmpeg/util@0.12.1/dist/esm/index.js');

// Load WASM files
const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm';
ffmpeg.load({
  coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
  wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm')
});

// ❌ Never do this:
import { FFmpeg } from '@ffmpeg/ffmpeg';  // Fails in Astro
```

## Video Editing Tool Key Functions

The most complex tool is `video-editing.astro`. Key functions:

```javascript
formatTime(seconds)          // Returns MM:SS
formatTimePrecise(seconds)   // Returns HH:MM:SS.mmm (for exports)
detectVideoFPS(video)        // Auto-detects FPS using requestVideoFrameCallback
getFrameNumber(seconds)      // Converts time to frame number
exportVideoClip()            // Main export function using FFmpeg
generatePDF()                // Exports clip as PDF with frame extraction
updateClipDisplay()          // Syncs UI with current clip selection
```

**Video Export Strategy:**
- MP4: Use `-c copy` (fastest, preserves quality)
- WebM: Re-encode with libvpx-vp9 + libopus
- Filename format: `originalname_clip_HH:MM:SS.mmm-HH:MM:SS.mmm.ext`

## Common Patterns Across Tools

### File Upload Pattern
```javascript
// Drag & drop zone
dropZone.addEventListener('drop', (e) => {
  e.preventDefault();
  const file = e.dataTransfer.files[0];
  handleFile(file);
});

// File input fallback
fileInput.addEventListener('change', (e) => {
  const file = e.target.files[0];
  handleFile(file);
});
```

### Progress Indicator Pattern
```javascript
// Show/hide progress
progressContainer.style.display = 'block';
progressBar.style.width = `${percentage}%`;
progressText.textContent = `${percentage}%`;
```

### Export/Download Pattern
```javascript
// Create download link
const blob = new Blob([data], { type: mimeType });
const url = URL.createObjectURL(blob);
const a = document.createElement('a');
a.href = url;
a.download = filename;
a.click();
URL.revokeObjectURL(url);
```

## Adding New Tools

1. Create new page: `src/pages/tools/your-tool-name.astro`
2. Use BaseLayout: `import BaseLayout from '../../layouts/BaseLayout.astro'`
3. Add to homepage: Edit `src/pages/index.astro` tools array:
   ```javascript
   {
     title: 'Your Tool Name',
     description: 'Brief description',
     href: '/tools/your-tool-name',
     icon: 'document' // or 'video', 'audio', 'calendar', 'folder'
   }
   ```
4. Implement client-side logic in `<script>` tag
5. Ensure all processing is browser-based (no API calls)

## File Naming Conventions

- **Pages**: kebab-case (e.g., `video-editing.astro`)
- **Components**: PascalCase (e.g., `BaseLayout.astro`, `ToolCard.astro`)
- **Functions**: camelCase (e.g., `formatTimePrecise()`, `detectVideoFPS()`)
- **IDs/variables**: camelCase (e.g., `videoPlayer`, `exportClipBtn`)

## Browser APIs Used

Required:
- File API (uploads)
- Canvas API (frame capture, PDF generation)
- WebAssembly (FFmpeg)
- Web Workers (potentially for video processing)

Optional/Progressive Enhancement:
- File System Access API (enhanced file picker)
- Web Speech API (audio transcription tool)
- requestVideoFrameCallback (FPS detection in video tool)

## Design Principles

1. **Privacy First**: Never compromise on local-only processing
2. **Legal Professional Focus**: Design for courtroom/deposition workflows
3. **Simplicity**: Each tool does one thing well
4. **Professional Output**: Exports should be court-ready (clean PDFs, proper filenames, metadata)
5. **Progressive Enhancement**: Core features work everywhere, advanced features gracefully degrade
6. **Accessible**: Keyboard navigation, clear labels, responsive design

## Code Quality Guidelines

- Use descriptive variable names (legal software - clarity matters)
- Add comments for complex logic (especially video processing math)
- Handle edge cases (empty files, very long videos, unsupported formats)
- Provide clear error messages to users
- Test with realistic file sizes and formats
- Validate file types before processing
- Consider performance (large files, memory usage)

## Testing Checklist for Video Tool

- Upload video (drag & drop and file picker)
- Adjust start/end time sliders
- Fine-tune buttons (frame-level precision)
- Export clip as MP4 and WebM
- Export to PDF with frame extraction
- Video info modal shows correct FPS
- Full-page drag & drop overlay
- Reset and upload new video
- Edge cases: very short clips (<1s), long videos (>1hr)

## Additional Context

- **Deployment**: Configured for Netlify (see netlify.toml)
- **Git**: Main branch is `main` (use for PRs)
- **No test framework**: Manual testing in browser
- **No linting**: No ESLint or Prettier configured
