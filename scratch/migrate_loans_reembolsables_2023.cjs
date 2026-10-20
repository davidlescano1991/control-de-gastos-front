const XLSX = require('../../control-de-gastos-api/node_modules/xlsx');
const { PrismaClient, Prisma } = require('../../control-de-gastos-api/node_modules/@prisma/client');

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL || "postgresql://postgres:postgres@127.0.0.1:5432/control_gastos?schema=public"
    }
  }
});

const filePath = 'C:\\Users\\u900670\\Downloads\\Cuentas claras_2023.xlsx';
const wb = XLSX.readFile(filePath);

function parseNumber(val) {
  if (val === null || val === undefined || val === '') return 0;
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  if (typeof val === 'string') {
    const cleaned = val.replace(/\./g, '').replace(/\$/g, '').replace(',', '.').trim();
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? 0 : parsed;
  }
  return 0;
}

async function migrateLoans2023() {
  console.log('\n========================================');
  console.log('1. MIGRANDO PRÉSTAMOS 2023 A POSTGRESQL');
  console.log('========================================');

  const sheet = wb.Sheets['Anual 2023'];
  if (!sheet) {
    console.error('❌ No se encontró hoja Anual 2023');
    return;
  }

  // Fila 83: Encabezados de préstamos (cols O a Z)
  // Fila 84: Capitales
  // Fila 85: Enero (mes 1) ... Fila 96: Diciembre (mes 12)
  // Fila 97: Deuda total
  const colStart = 14; // Col O = index 14
  const colEnd = 25;   // Col Z = index 25

  // Limpiar préstamos previos de 2023
  console.log('🧹 Limpiando préstamos previos de 2023...');
  const prevLoans = await prisma.loan.findMany({ where: { year: 2023 } });
  for (const pl of prevLoans) {
    await prisma.loanInstallment.deleteMany({ where: { loanId: pl.id } });
    await prisma.loan.delete({ where: { id: pl.id } });
  }

  let loansCreated = 0;
  let installmentsCreated = 0;

  for (let c = colStart; c <= colEnd; c++) {
    const colName = XLSX.utils.encode_col(c);
    const nombre = String(sheet[`${colName}83`]?.v || '').trim();
    if (!nombre) continue;

    const capitalTomado = parseNumber(sheet[`${colName}84`]?.v);
    const deudaTotal = parseNumber(sheet[`${colName}97`]?.v);

    // Determinar entidad
    let entidad = 'Otros';
    const nUp = nombre.toUpperCase();
    if (nUp.includes('GALICIA')) entidad = 'Banco Galicia';
    else if (nUp.includes('MAMA')) entidad = 'Mama';
    else if (nUp.includes('PARETO')) entidad = 'Pareto';
    else if (nUp.includes('ML')) entidad = 'Mercado Libre';
    else if (nUp.includes('NARANJA') || nUp.includes('NX')) entidad = 'Naranja X';
    else if (nUp.includes('BANCOR')) entidad = 'Bancor';

    // Recolectar cuotas (mes 1 a 12: filas 85 a 96)
    const cuotas = [];
    for (let mes = 1; mes <= 12; mes++) {
      const fila = 84 + mes;
      const montoCuota = parseNumber(sheet[`${colName}${fila}`]?.v);
      if (montoCuota > 0) {
        cuotas.push({ mes, monto: montoCuota });
      }
    }

    if (cuotas.length === 0) continue;

    const primerMes = cuotas[0].mes;
    const fechaToma = new Date(Date.UTC(2023, primerMes - 1, 1));
    const fechaPrimeraCuota = new Date(Date.UTC(2023, primerMes - 1, 10));

    const loan = await prisma.loan.create({
      data: {
        year: 2023,
        entidad,
        nombre,
        capitalTomado: new Prisma.Decimal(capitalTomado || deudaTotal),
        fechaToma,
        fechaPrimeraCuota,
        totalCuotas: cuotas.length,
        montoCuotaDefault: new Prisma.Decimal(cuotas[0].monto),
        deudaTotal: new Prisma.Decimal(deudaTotal > 0 ? deudaTotal : cuotas.reduce((a, b) => a + b.monto, 0)),
        estado: 'FINALIZADO',
        installments: {
          create: cuotas.map((cq, idx) => ({
            numeroCuota: idx + 1,
            year: 2023,
            mes: cq.mes,
            monto: new Prisma.Decimal(cq.monto),
            pagada: true,
            fechaPago: new Date(Date.UTC(2023, cq.mes - 1, 10))
          }))
        }
      }
    });

    loansCreated++;
    installmentsCreated += cuotas.length;
    console.log(`   ✔️ Préstamo "${nombre}" (${entidad}) creado con ${cuotas.length} cuotas.`);
  }

  console.log(`✅ Total préstamos 2023 creados: ${loansCreated} con ${installmentsCreated} cuotas.`);
}

async function migrateReembolsables2023() {
  console.log('\n==============================================');
  console.log('2. MIGRANDO GASTOS REEMBOLSABLES 2023 (SALDO)');
  console.log('==============================================');

  const sheet = wb.Sheets['Saldo'];
  if (!sheet) {
    console.error('❌ No se encontró hoja Saldo');
    return;
  }

  // Meses disponibles en Saldo fila 62:
  // T62 = Septiembre (mes 9), U62 = Octubre (mes 10), V62 = Noviembre (mes 11), W62 = Diciembre (mes 12)
  const mesesConfig = [
    { col: 'T', mes: 9 },
    { col: 'U', mes: 10 },
    { col: 'V', mes: 11 },
    { col: 'W', mes: 12 }
  ];

  // Limpiar reembolsables previos de 2023
  console.log('🧹 Limpiando reembolsables previos de 2023 en monthly_items...');
  await prisma.monthlyItem.deleteMany({
    where: {
      year: 2023,
      entidad: 'Reembolsables'
    }
  });

  const conceptos = [
    { row: 63, defConcepto: 'Afip' },
    { row: 64, defConcepto: 'GMS' },
    { row: 65, defConcepto: 'Luz' },
    { row: 66, defConcepto: 'Agua' },
    { row: 67, defConcepto: 'Internet' },
    { row: 68, defConcepto: 'Claro' },
    { row: 69, defConcepto: 'Inst Alarma' }
  ];

  let itemsCreated = 0;

  for (const mCfg of mesesConfig) {
    let orden = 1;
    for (const c of conceptos) {
      const nombreConcepto = String(sheet[`S${c.row}`]?.v || c.defConcepto).trim();
      const val = parseNumber(sheet[`${mCfg.col}${c.row}`]?.v);

      await prisma.monthlyItem.create({
        data: {
          year: 2023,
          mes: mCfg.mes,
          entidad: 'Reembolsables',
          concepto: nombreConcepto.charAt(0).toUpperCase() + nombreConcepto.slice(1),
          monto: new Prisma.Decimal(val),
          orden: orden++,
          notas: 'SERVICIO'
        }
      });
      itemsCreated++;
    }

    // Fila 73: Mamá (Aporte tercero)
    const aporteVal = parseNumber(sheet[`${mCfg.col}73`]?.v);
    if (aporteVal > 0) {
      await prisma.monthlyItem.create({
        data: {
          year: 2023,
          mes: mCfg.mes,
          entidad: 'Reembolsables',
          concepto: 'Mamá',
          monto: new Prisma.Decimal(aporteVal),
          orden: orden++,
          notas: 'APORTE'
        }
      });
      itemsCreated++;
    }
  }

  console.log(`✅ Total ítems reembolsables 2023 creados: ${itemsCreated}`);
}

async function main() {
  await migrateLoans2023();
  await migrateReembolsables2023();
}

main().catch(console.error).finally(() => prisma.$disconnect());
