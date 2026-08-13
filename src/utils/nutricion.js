export function calcularIMC(pesoKg, alturaCm) {
  const peso = Number(pesoKg);
  const altura = Number(alturaCm);
  if (!Number.isFinite(peso) || peso <= 0) return null;
  if (!Number.isFinite(altura) || altura <= 0) return null;
  const m = altura / 100;
  return peso / (m * m);
}

export function clasificarIMC(imc) {
  if (imc == null || Number.isNaN(imc)) return null;
  if (imc < 18.5) return { categoria: 'Bajo peso', color: '#D97706' };
  if (imc < 25) return { categoria: 'Peso normal', color: '#16A34A' };
  if (imc < 30) return { categoria: 'Sobrepeso', color: '#D97706' };
  return { categoria: 'Obesidad', color: '#DC2626' };
}

export function calcularBMR(pesoKg, alturaCm, edad, sexo) {
  const peso = Number(pesoKg);
  const altura = Number(alturaCm);
  const anos = Number(edad);
  if (![peso, altura, anos].every(Number.isFinite)) return null;
  if (peso <= 0 || altura <= 0 || anos <= 0 || anos > 120) return null;
  const base = 10 * peso + 6.25 * altura - 5 * anos;
  return sexo === 'mujer' ? base - 161 : base + 5;
}

export const NIVELES_ACTIVIDAD = [
  { value: 1.2, label: 'Sedentario', hint: 'Poco o nada de ejercicio' },
  { value: 1.375, label: 'Ligero', hint: '1-3 veces por semana' },
  { value: 1.55, label: 'Moderado', hint: '3-5 veces por semana' },
  { value: 1.725, label: 'Activo', hint: '6-7 veces por semana' },
  { value: 1.9, label: 'Muy activo', hint: 'Trabajo físico / 2 veces al día' },
];

export function calcularCaloriasRecomendadas(pesoKg, alturaCm, edad, sexo, factor) {
  const bmr = calcularBMR(pesoKg, alturaCm, edad, sexo);
  if (bmr == null) return null;
  const f = Number(factor);
  if (!Number.isFinite(f) || f <= 0) return null;
  return bmr * f;
}