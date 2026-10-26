const fs = require('fs');

// 1. Update iniciar-servicios.ps1
const iniPath = 'C:/Datos/David/Proyectos/Control_Gastos/scripts/iniciar-servicios.ps1';
if (fs.existsSync(iniPath)) {
  let ini = fs.readFileSync(iniPath, 'utf8');
  ini = ini.replace(/Puerto 4200/g, 'Puerto 4202');
  ini = ini.replace(/Test-PortListening 4200/g, 'Test-PortListening 4202');
  ini = ini.replace(/\$p4200 = Test-PortListening 4200/g, '$p4202 = Test-PortListening 4202');
  ini = ini.replace(/\$p4200/g, '$p4202');
  ini = ini.replace(/Frontend \(4200\)/g, 'Frontend (4202)');
  ini = ini.replace(/http:\/\/localhost:4200/g, 'http://localhost:4202');
  fs.writeFileSync(iniPath, ini, 'utf8');
  console.log('iniciar-servicios.ps1 updated to 4202');
}

// 2. Update detener-servicios.ps1
const detPath = 'C:/Datos/David/Proyectos/Control_Gastos/scripts/detener-servicios.ps1';
if (fs.existsSync(detPath)) {
  let det = fs.readFileSync(detPath, 'utf8');
  if (!det.includes('Stop-PortProcess 4202')) {
    det = det.replace('Stop-PortProcess 4200 "Frontend Angular"', 'Stop-PortProcess 4202 "Frontend Angular"\nStop-PortProcess 4200 "Frontend Angular (Legacy)"');
  }
  fs.writeFileSync(detPath, det, 'utf8');
  console.log('detener-servicios.ps1 updated to 4202');
}

// 3. Update API .env and envs.ts
const envPath = 'C:/Datos/David/Proyectos/Control_Gastos/control-de-gastos-api/.env';
if (fs.existsSync(envPath)) {
  let env = fs.readFileSync(envPath, 'utf8');
  env = env.replace('FRONTEND_URL="http://localhost:4200"', 'FRONTEND_URL="http://localhost:4202"');
  fs.writeFileSync(envPath, env, 'utf8');
  console.log('API .env updated to 4202');
}

const envsPath = 'C:/Datos/David/Proyectos/Control_Gastos/control-de-gastos-api/src/config/envs.ts';
if (fs.existsSync(envsPath)) {
  let envs = fs.readFileSync(envsPath, 'utf8');
  envs = envs.replace("FRONTEND_URL || 'http://localhost:4200'", "FRONTEND_URL || 'http://localhost:4202'");
  fs.writeFileSync(envsPath, envs, 'utf8');
  console.log('API envs.ts updated to 4202');
}
