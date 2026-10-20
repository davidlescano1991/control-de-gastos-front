const XLSX = require('c:/Datos/David/Proyectos/Control_Gastos/control-de-gastos-api/node_modules/xlsx');
const path = require('path');
const fs = require('fs');

const years = [2022, 2023, 2024, 2025, 2026, 2027];

for (const y of years) {
  const tPath = path.resolve('c:/Datos/David/Proyectos/Control_Gastos/control-de-gastos-api/templates', `Cuentas claras_${y}.xlsx`);
  if (!fs.existsSync(tPath)) {
    console.log(`Year ${y}: Template NOT found at ${tPath}`);
    continue;
  }
  const wb = XLSX.readFile(tPath);
  const sheetName = wb.SheetNames.find(s => s.toLowerCase().includes('anual'));
  if (!sheetName) {
    console.log(`Year ${y}: No Anual sheet found. Sheets: ${wb.SheetNames.join(', ')}`);
    continue;
  }
  const ws = wb.Sheets[sheetName];
  // Check loans range L83:Z96
  const row83 = [];
  const colL = [];
  for (let c = 11; c <= 25; c++) {
    const colLetter = XLSX.utils.encode_col(c);
    const cell = ws[colLetter + '83'];
    if (cell && cell.v) row83.push({ col: colLetter, val: cell.v });
  }
  for (let r = 84; r <= 96; r++) {
    const cell = ws['L' + r];
    if (cell && cell.v) colL.push({ row: r, val: cell.v });
  }
  console.log(`Year ${y} (${sheetName}): Found ${row83.length} loan header cells in row 83, ${colL.length} month totals in col L`);
  if (row83.length > 0) {
    console.log(`  Headers:`, row83.map(h => `${h.col}: ${h.val}`).join(' | '));
  }
}
