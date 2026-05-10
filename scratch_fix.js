const fs = require('fs');
const path = require('path');

function walk(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    if (file === 'node_modules' || file === '.next' || file === '.git') continue;
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      walk(fullPath);
    } else if (fullPath.endsWith('.tsx') || fullPath.endsWith('.ts')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      const original = content;
      
      // Eliminar el atributo target="whatsapp_web"
      content = content.replace(/ target="whatsapp_web"/g, '');
      
      // Eliminar el onClick feo de app/page.tsx que abre window.open
      content = content.replace(/onClick=\{e=>\{e\.preventDefault\(\);e\.stopPropagation\(\);window\.open\(waLink\(l\.whatsapp\|\|l\.telefono\)\!, "whatsapp_web"\);\}\}/g, '');
      
      if (content !== original) {
        fs.writeFileSync(fullPath, content);
        console.log('Fixed ' + fullPath);
      }
    }
  }
}

walk('.');
console.log('Done');
