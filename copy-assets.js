const fs = require('fs');
const path = require('path');

const srcDir = 'C:\\Users\\Deyios\\.gemini\\antigravity-ide\\brain\\517ac0b2-2848-4e28-821b-5026cc8292ba';
const destDir = path.resolve(__dirname, 'src', 'assets');

try {
  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
    console.log(`Created directory: ${destDir}`);
  }

  if (fs.existsSync(srcDir)) {
    const files = fs.readdirSync(srcDir);
    let count = 0;
    files.forEach(file => {
      if (file.startsWith('media__1782497767') && file.endsWith('.jpg')) {
        const srcPath = path.join(srcDir, file);
        const destPath = path.join(destDir, file);
        fs.copyFileSync(srcPath, destPath);
        console.log(`✓ Copied ${file} to src/assets/`);
        count++;
      }
    });
    console.log(`Successfully copied ${count} asset(s) to src/assets/.`);
    console.log(`Please run 'git add src/assets/*' and commit/push so Render has the files during build!`);
  } else {
    console.error(`Error: Source directory not found at ${srcDir}`);
  }
} catch (e) {
  console.error('Error running copy script:', e);
}
