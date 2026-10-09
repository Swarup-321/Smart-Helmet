MINEGUARD BRAND ASSETS — HANDOFF TO ANTIGRAVITY
================================================

Included logo variants (SVG is recommended for website use):
- mineguard-logo-horizontal.svg
  Standard horizontal logo, wordmark + tagline, for sidebar/header.
- mineguard-logo-horizontal-no-tagline.svg
  Compact horizontal logo for narrow layouts.
- mineguard-logo-horizontal-dark.svg
  Wordmark/light lettering for dark backgrounds (icon itself remains on navy shield).
- mineguard-logo-stacked.svg and mineguard-logo-stacked-dark.svg
  Centered / splash / empty-state option.
- mineguard-logo-monochrome.svg and mineguard-logo-monochrome-dark.svg
  Single-color wordmarks for restrained print / monochrome situations.
- mineguard-mark.svg
  Standalone brand symbol with transparent background.
- mineguard-mark-on-light.svg / mineguard-mark-on-dark.svg
  Mark versions on solid backgrounds.
- favicon.svg
  Simplified version designed for small sizes.

Raster assets:
- png/mineguard-logo-horizontal.png
- png/mineguard-logo-horizontal-dark.png
- png/mineguard-logo-stacked.png
- png/mineguard-logo-stacked-dark.png
- png/mineguard-mark-512.png
- png/favicon-{16,32,48,64,128,192,256}.png
- png/favicon.ico
- png/apple-touch-icon.png

Basic brand colors:
- Navy: #182B3A
- Teal: #176B87
- Teal (dark-background variant): #8DC2D1
- Lamp accent: #E7B64A
- Secondary text: #6C7B88
- Light background: #F3F6F8

HANDOFF NOTES
-------------
1. Use mineguard-logo-horizontal.svg in the desktop sidebar.
2. Use mineguard-mark.svg or favicon.svg for the small sidebar mark and browser favicon.
3. Use the dark variant only where the wordmark has sufficient contrast on a dark background.
4. Keep assets SVG/vector when possible. Do not stretch the logo disproportionately.
5. Do not use the logo as a background image; render it as an image with alt text "MineGuard".
6. Avoid emoji or extra decorative icons around the logo.
7. Update the actual public/index.html or Vite index.html favicon references as appropriate for this repo. Do not blindly assume Create React App paths.
8. If adding public/icons/, copy the PNG favicon sizes into that folder or update the manifest paths accordingly.
9. This is a newly authored vector identity inspired by the prior shield/helmet direction; it is not a recreation of the raster logo's exact geometry.

SUGGESTED ANTIGRAVITY PROMPT
----------------------------
Integrate the supplied MineGuard brand asset pack into the existing React/Vite app.
Use the horizontal SVG logo in the left sidebar at approximately 180–210 px wide, the
standalone mark at compact breakpoints if needed, and favicon.svg plus PNG/ICO variants
for browser icons. Remove all emoji-based branding. Preserve existing routes, state,
Socket.IO subscriptions, charts, telemetry and alerts. Verify logo scaling and contrast
at desktop/mobile widths and check the browser tab favicon. Don't alter backend logic.
