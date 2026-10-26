const fs = require('fs');
const path = require('path');

const base1_0 = 'C:\\Datos\\David\\Proyectos\\Control_Gastos\\1.0\\Front_Control_Gastos\\control-gastos-front';

// 1. Update config/environment.ts
const envFile = path.join(base1_0, 'src', 'app', 'config', 'environment.ts');
let envContent = fs.readFileSync(envFile, 'utf8');
if (!envContent.includes('apiUrl')) {
  envContent = envContent.replace(
    "googleApiKey: 'AIzaSyCbQSruKkA_KszIultQb2gpTNFUwnnyazE'",
    "googleApiKey: 'AIzaSyCbQSruKkA_KszIultQb2gpTNFUwnnyazE',\n  apiUrl: 'http://localhost:3000/api'"
  );
  fs.writeFileSync(envFile, envContent, 'utf8');
  console.log('Added apiUrl to environment.ts');
}

// 2. Update config/environment.prod.ts
const envProdFile = path.join(base1_0, 'src', 'app', 'config', 'environment.prod.ts');
if (fs.existsSync(envProdFile)) {
  let envProdContent = fs.readFileSync(envProdFile, 'utf8');
  if (!envProdContent.includes('apiUrl')) {
    envProdContent = envProdContent.replace(
      "googleApiKey: 'AIzaSyCbQSruKkA_KszIultQb2gpTNFUwnnyazE'",
      "googleApiKey: 'AIzaSyCbQSruKkA_KszIultQb2gpTNFUwnnyazE',\n  apiUrl: 'http://localhost:3000/api'"
    );
    fs.writeFileSync(envProdFile, envProdContent, 'utf8');
    console.log('Added apiUrl to environment.prod.ts');
  }
}

// 3. Update stores/movimiento.google.ts in 1.0
const storePath = path.join(base1_0, 'src', 'app', 'stores', 'movimiento.google.ts');
let storeContent = fs.readFileSync(storePath, 'utf8');

// Fix res?.values
storeContent = storeContent.replace(
  'const fechaStr = res?.values?.[0]?.[0];',
  'const fechaStr = (res as any)?.values?.[0]?.[0];'
);

// Add getEstimativoDeMes and cargarEstimativoDeMesPorAnio aliases
if (!storeContent.includes('getEstimativoDeMes(')) {
  const methodToAdd = `
  getEstimativoDeMes(mes: string): EstimativoRow[] {
    const hoja = mes.startsWith('Estimativo ') ? mes : 'Estimativo ' + mes;
    const anio = new Date().getFullYear();
    const clave = \`\${anio}::\${hoja}\`;
    return this.estimativoPorMes.get(clave)?.() ?? [];
  }

  async cargarEstimativoDeMesPorAnio(anio: number, mes: string): Promise<void> {
    const hoja = mes.startsWith('Estimativo ') ? mes : 'Estimativo ' + mes;
    await this.asegurarEstimativoAnioRange(anio, [hoja]);
  }
`;
  storeContent = storeContent.replace(
    'async getEstimados(anio: number, hoja: string): Promise<EstimativoRow[]> {',
    methodToAdd + '\n  async getEstimados(anio: number, hoja: string): Promise<EstimativoRow[]> {'
  );
  console.log('Added aliases to movimiento.google.ts');
}

fs.writeFileSync(storePath, storeContent, 'utf8');
console.log('1.0 patches applied successfully.');
