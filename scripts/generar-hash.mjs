// Genera el hash de una contraseña para pegar en la columna PasswordHash
// de la hoja "Usuarios".
// Uso: node scripts/generar-hash.mjs "miContraseña123"
import bcrypt from "bcryptjs";

const password = process.argv[2];

if (!password) {
  console.error('Uso: node scripts/generar-hash.mjs "miContraseña"');
  process.exit(1);
}

const hash = bcrypt.hashSync(password, 10);
console.log(hash);
