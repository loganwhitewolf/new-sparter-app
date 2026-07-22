const path = require('node:path')

const fontDir = path.join(
  __dirname,
  'node_modules',
  'next',
  'dist',
  'next-devtools',
  'server',
  'font'
)

const geistSans = path.join(fontDir, 'geist-latin.woff2')
const geistMono = path.join(fontDir, 'geist-mono-latin.woff2')

module.exports = {
  'https://fonts.googleapis.com/css2?family=Geist:wght@100..900&display=swap': `
/* latin */
@font-face {
  font-family: 'Geist';
  font-style: normal;
  font-weight: 100 900;
  font-display: swap;
  src: url(${geistSans}) format('woff2');
}
`,
  'https://fonts.googleapis.com/css2?family=Geist+Mono:wght@100..900&display=swap': `
/* latin */
@font-face {
  font-family: 'Geist Mono';
  font-style: normal;
  font-weight: 100 900;
  font-display: swap;
  src: url(${geistMono}) format('woff2');
}
`,
  // Offline build mock for proto branding display font (Plan 69-01). Reuses Geist
  // bytes — shape only matters for next/font compile, not visual fidelity in CI.
  'https://fonts.googleapis.com/css2?family=Fraunces:wght@100..900&display=swap': `
/* latin */
@font-face {
  font-family: 'Fraunces';
  font-style: normal;
  font-weight: 100 900;
  font-display: swap;
  src: url(${geistSans}) format('woff2');
}
`,
}
