import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';
import * as fs from 'fs';

// Copiar recursos multimedia desde el directorio de artefactos a src/assets para importación directa en React
try {
  const logFile = path.resolve(__dirname, 'copy_log.txt');
  fs.writeFileSync(logFile, `Starting copy at ${new Date().toISOString()}\n`);
  const artifactDir = 'C:\\Users\\Deyios\\.gemini\\antigravity-ide\\brain\\517ac0b2-2848-4e28-821b-5026cc8292ba';
  const destDir = path.resolve(__dirname, 'src', 'assets');
  fs.appendFileSync(logFile, `artifactDir exists: ${fs.existsSync(artifactDir)}\n`);
  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
    fs.appendFileSync(logFile, `Created destDir: ${destDir}\n`);
  }
  if (fs.existsSync(artifactDir)) {
    const files = fs.readdirSync(artifactDir);
    fs.appendFileSync(logFile, `Files in artifactDir: ${files.join(', ')}\n`);
    const publicAssetsDir = path.resolve(__dirname, 'public', 'assets');
    if (!fs.existsSync(publicAssetsDir)) {
      fs.mkdirSync(publicAssetsDir, { recursive: true });
      fs.appendFileSync(logFile, `Created publicAssetsDir: ${publicAssetsDir}\n`);
    }

    files.forEach(file => {
      if (file.startsWith('media__1782497767') && file.endsWith('.jpg')) {
        const srcPath = path.join(artifactDir, file);
        
        // Copy to src/assets
        const destPath = path.join(destDir, file);
        fs.copyFileSync(srcPath, destPath);
        
        // Copy to public/assets
        const pubPath = path.join(publicAssetsDir, file);
        fs.copyFileSync(srcPath, pubPath);
        
        fs.appendFileSync(logFile, `Copied ${file} to ${destPath} and ${pubPath}\n`);
      }
    });
    console.log('✅ Recursos multimedia copiados a src/assets y public/assets.');
  }
} catch (e: any) {
  console.warn('Error copiando recursos en vite.config.ts:', e);
  try {
    fs.appendFileSync(path.resolve(__dirname, 'copy_log.txt'), `Error: ${e.message}\n${e.stack}\n`);
  } catch (_) {}
}

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
