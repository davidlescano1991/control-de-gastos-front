const fs = require('fs');
const path = require('path');

const targetBase = 'C:\\Datos\\David\\Proyectos\\Control_Gastos\\1.0\\Front_Control_Gastos\\control-gastos-front';

// 1. Copy clean modal-exportar-excel.component.ts from 2.0 to 1.0
const srcModalExcel = 'C:\\Datos\\David\\Proyectos\\Control_Gastos\\control-de-gastos-front\\src\\app\\common\\modal-exportar-excel\\modal-exportar-excel.component.ts';
const dstModalExcel = path.join(targetBase, 'src', 'app', 'common', 'modal-exportar-excel', 'modal-exportar-excel.component.ts');
fs.copyFileSync(srcModalExcel, dstModalExcel);

// 2. Fix mensual.ts imports at top
const mensualTsPath = path.join(targetBase, 'src', 'app', 'pages', 'mensual', 'mensual.ts');
let mensualTs = fs.readFileSync(mensualTsPath, 'utf8');
// Fix any broken rxjs import
mensualTs = mensualTs.replace(/import\s*\{[^}]*\}\s*,?\s*of\s*\}\s*from\s*'rxjs';/g, "import { Subscription, firstValueFrom, of } from 'rxjs';");
mensualTs = mensualTs.replace(/import\s*\{\s*firstValueFrom\s*\}\s*from\s*,\s*of;/g, "import { Subscription, firstValueFrom, of } from 'rxjs';");
// Ensure SseService is imported
if (!mensualTs.includes("import { SseService }")) {
  mensualTs = "import { SseService } from '../../services/sse.service';\n" + mensualTs;
}
fs.writeFileSync(mensualTsPath, mensualTs, 'utf8');

// 3. Fix mensual-items.service.ts line 226
const mensualItemsPath = path.join(targetBase, 'src', 'app', 'services', 'mensual-items.service.ts');
let mensualItemsCode = fs.readFileSync(mensualItemsPath, 'utf8');
mensualItemsCode = mensualItemsCode.replace(
  "const evaluated = this.evaluarFormulaLocal(payload.montoOFormula);",
  "const evaluated = this.evaluarFormulaLocal(payload.montoOFormula ?? (payload.monto ?? 0));"
);
fs.writeFileSync(mensualItemsPath, mensualItemsCode, 'utf8');

// 4. Update models/movimiento.ts to have optional subcategoria, entidad, moneda
const movModelPath = path.join(targetBase, 'src', 'app', 'models', 'movimiento.ts');
const movModelContent = `export interface Movimiento {
  fecha: string;
  monto: number;
  tipo: string;
  categoria: string;
  subcategoria?: string | null;
  entidad?: string | null;
  moneda?: string | null;
  descripcion: string;
  deudapesos: number;
}

export interface Movimiento2 {
  fecha: Date;
  tipo: string;
  monto: number;
  deudapesos?: number | null;
}
`;
fs.writeFileSync(movModelPath, movModelContent, 'utf8');

// 5. Update reembolsables.service.ts
const reembolsablesPath = path.join(targetBase, 'src', 'app', 'services', 'reembolsables.service.ts');
let reimbCode = fs.readFileSync(reembolsablesPath, 'utf8');

// Remove MovementBackendItem from movimientos.service import
reimbCode = reimbCode.replace(
  "import { MovimientosService, MovementBackendItem } from './movimientos.service';",
  "import { MovimientosService } from './movimientos.service';\n\nexport interface MovementBackendItem {\n  id?: string;\n  fecha: string | Date;\n  mes?: number;\n  year?: number;\n  tipo: string;\n  categoria: string;\n  subcategoria?: string | null;\n  entidad?: string | null;\n  monto: number;\n  moneda?: string;\n  descripcion?: string | null;\n  metodoPago?: string | null;\n  comprobante?: string | null;\n  deuda?: number | null;\n  deudapesos?: number | null;\n  createdAt?: string | Date;\n}"
);

// Fix res && res.values
reimbCode = reimbCode.replace(
  "if (res && res.values) {",
  "if (res && (res as any).values) {"
);
reimbCode = reimbCode.replace(
  "rows = res.values;",
  "rows = (res as any).values;"
);

// Fix deudapesos in crearMovimiento body
reimbCode = reimbCode.replace(
  "return this.movimientosService.crearMovimiento(body);",
  "return this.movimientosService.crearMovimiento({ ...body, deudapesos: 0 });"
);

fs.writeFileSync(reembolsablesPath, reimbCode, 'utf8');

console.log('fix_step3 executed successfully.');
