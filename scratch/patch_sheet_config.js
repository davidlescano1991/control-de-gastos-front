const fs = require('fs');
const filePath = 'c:/Datos/David/Proyectos/Control_Gastos/control-de-gastos-api/src/services/sheet-config.service.ts';
let code = fs.readFileSync(filePath, 'utf8');

// Replace any mesesExtra: ['Enero_...'] with mesesExtra: []
code = code.replace(/mesesExtra:\s*\[[^\]]*\]/g, 'mesesExtra: []');
// Replace template string ones like mesesExtra: [`Enero_${year + 1}`, `Febrero_${year + 1}`]
code = code.replace(/mesesExtra:\s*\[`Enero_[^\]]*\]/g, 'mesesExtra: []');

fs.writeFileSync(filePath, code, 'utf8');
console.log('SUCCESS: sheet-config.service.ts updated: mesesExtra cleared!');
