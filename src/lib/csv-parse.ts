import "server-only";

// Parser CSV con soporte de comillas, comillas escapadas ("") y campos que
// contienen el delimitador o saltos de línea — equivalente a Utilities.parseCsv.
export function parseCsv(texto: string, delimitador = ";"): string[][] {
  const filas: string[][] = [];
  let fila: string[] = [];
  let campo = "";
  let dentroComillas = false;
  let i = 0;

  while (i < texto.length) {
    const c = texto[i];

    if (dentroComillas) {
      if (c === '"') {
        if (texto[i + 1] === '"') {
          campo += '"';
          i += 2;
          continue;
        }
        dentroComillas = false;
        i++;
        continue;
      }
      campo += c;
      i++;
      continue;
    }

    if (c === '"') {
      dentroComillas = true;
      i++;
      continue;
    }
    if (c === delimitador) {
      fila.push(campo);
      campo = "";
      i++;
      continue;
    }
    if (c === "\r") {
      i++;
      continue;
    }
    if (c === "\n") {
      fila.push(campo);
      filas.push(fila);
      fila = [];
      campo = "";
      i++;
      continue;
    }
    campo += c;
    i++;
  }

  if (campo.length > 0 || fila.length > 0) {
    fila.push(campo);
    filas.push(fila);
  }

  return filas.filter((f) => !(f.length === 1 && f[0].trim() === ""));
}
