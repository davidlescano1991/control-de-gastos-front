const fs = require('fs');
const path = require('path');

const srcBase = 'C:\\Datos\\David\\Proyectos\\Control_Gastos\\control-de-gastos-front';
const dstBase = 'C:\\Datos\\David\\Proyectos\\Control_Gastos\\1.0\\Front_Control_Gastos\\control-gastos-front';

// 1. Copy home.ts and home.html
fs.copyFileSync(
  path.join(srcBase, 'src', 'app', 'pages', 'estimativos', 'home.ts'),
  path.join(dstBase, 'src', 'app', 'pages', 'estimativos', 'home.ts')
);
fs.copyFileSync(
  path.join(srcBase, 'src', 'app', 'pages', 'estimativos', 'home.html'),
  path.join(dstBase, 'src', 'app', 'pages', 'estimativos', 'home.html')
);

// 2. Copy movimiento.google.ts
fs.copyFileSync(
  path.join(srcBase, 'src', 'app', 'stores', 'movimiento.google.ts'),
  path.join(dstBase, 'src', 'app', 'stores', 'movimiento.google.ts')
);

console.log('Successfully synced estimativos fixes to 1.0 repository.');
