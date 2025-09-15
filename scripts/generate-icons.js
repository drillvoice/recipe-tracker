const fs = require('fs');
const path = require('path');

// Simple SVG icon for Recipe Tracker
const createIconSVG = (size) => `
<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${size}" height="${size}" fill="#2563eb" rx="${size * 0.1}"/>
  <circle cx="${size * 0.3}" cy="${size * 0.4}" r="${size * 0.15}" fill="#ffffff"/>
  <circle cx="${size * 0.7}" cy="${size * 0.4}" r="${size * 0.15}" fill="#ffffff"/>
  <path d="M ${size * 0.2} ${size * 0.7} Q ${size * 0.5} ${size * 0.9} ${size * 0.8} ${size * 0.7}"
        stroke="#ffffff" stroke-width="${size * 0.02}" fill="none" stroke-linecap="round"/>
  <text x="${size * 0.5}" y="${size * 0.25}" text-anchor="middle" font-family="Arial"
        font-size="${size * 0.08}" fill="#ffffff">RECIPE</text>
</svg>
`;

// Create icons directory
const iconsDir = path.join(__dirname, '../public/icons');
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

// Generate placeholder icons as SVG (we can convert to PNG later if needed)
const sizes = [72, 96, 128, 144, 152, 192, 384, 512];

sizes.forEach(size => {
  const svg = createIconSVG(size);
  fs.writeFileSync(path.join(iconsDir, `icon-${size}x${size}.svg`), svg);
  console.log(`Generated icon-${size}x${size}.svg`);
});

// Create shortcut icons
const shortcutSVG = `
<svg width="96" height="96" viewBox="0 0 96 96" xmlns="http://www.w3.org/2000/svg">
  <rect width="96" height="96" fill="#10b981" rx="12"/>
  <text x="48" y="55" text-anchor="middle" font-family="Arial" font-size="48" fill="#ffffff">+</text>
</svg>
`;

fs.writeFileSync(path.join(iconsDir, 'shortcut-add.svg'), shortcutSVG);

const historySVG = `
<svg width="96" height="96" viewBox="0 0 96 96" xmlns="http://www.w3.org/2000/svg">
  <rect width="96" height="96" fill="#8b5cf6" rx="12"/>
  <text x="48" y="60" text-anchor="middle" font-family="Arial" font-size="24" fill="#ffffff">📋</text>
</svg>
`;

fs.writeFileSync(path.join(iconsDir, 'shortcut-history.svg'), historySVG);

console.log('PWA icons generated! Note: Consider replacing with PNG versions for better compatibility.');