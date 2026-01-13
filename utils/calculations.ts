
import { FinancialIndicators, CupoAnalysis, CupoVariables } from '../types';

export const formatCOP = (val: number) => {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0
  }).format(val);
};

export const formatPercent = (val: number) => `${val.toFixed(2)}%`;

export const numberToLetters = (monto: number): string => {
  const millones = Math.floor(monto / 1_000_000);
  if (millones === 0) return "Cero millones de pesos m/cte";
  if (millones === 1) return "Un millón de pesos m/cte";
  const miles = Math.floor((monto % 1_000_000) / 1000);
  if (miles > 0) return `${millones} millones ${miles} mil pesos m/cte`;
  return `${millones} millones de pesos m/cte`;
};

export const redondearComercial = (monto: number): number => {
  if (monto >= 100_000_000) {
    return Math.round(monto / 10_000_000) * 10_000_000;
  } else if (monto >= 10_000_000) {
    return Math.round(monto / 1_000_000) * 1_000_000;
  } else {
    return Math.round(monto / 100_000) * 100_000;
  }
};

export const calculateFullIndicators = (data: any): FinancialIndicators => {
  const razonCorriente = data.assetsCorriente / data.pasivosCorriente;
  const pruebaAcida = (data.assetsCorriente - data.inventarios) / data.pasivosCorriente;
  const knt = data.assetsCorriente - data.pasivosCorriente;
  const endeudamientoGlobal = (data.pasivosTotal / data.assetsTotal) * 100;
  
  const x1 = 1.2 * (knt / data.assetsTotal);
  const x2 = 1.4 * (data.utilidadNeta / data.assetsTotal);
  const x3 = 3.3 * (data.ebit / data.assetsTotal);
  const x4 = 0.6 * (data.patrimonioTotal / data.pasivosTotal);
  const x5 = 1.0 * (data.ingresosTotales / data.assetsTotal);
  const zScore = x1 + x2 + x3 + x4 + x5;

  return {
    razonCorriente,
    pruebaAcida,
    knt,
    endeudamientoGlobal,
    endeudamientoLP: (data.pasivosNoCorriente / data.assetsTotal) * 100,
    endeudamientoCP: (data.pasivosCorriente / data.pasivosTotal) * 100,
    solvencia: (data.patrimonioTotal / data.pasivosTotal) * 100,
    margenNeto: (data.utilidadNeta / data.ingresosTotales) * 100,
    margenOperacional: (data.ebit / data.ingresosTotales) * 100,
    roa: (data.utilidadNeta / data.assetsTotal) * 100,
    roe: (data.utilidadNeta / data.patrimonioTotal) * 100,
    ebit: data.ebit,
    ebitda: data.ebitda || data.ebit * 1.1,
    zAltman: zScore,
    riesgoInsolvencia: razonCorriente,
    deterioroPatrimonial: data.utilidadNeta < 0,
    diasCartera: 60,
    diasInventario: 31,
    cicloOperacional: 91
  };
};

export const calculateCupo2_0 = (inputs: {
  datacredito3p: number[],
  otorga: number,
  informaOpinion: number,
  utilidadNetaAnual: number,
  referencias: number[],
  ebitda: number,
  impuestos: number,
  gastosFin: number,
  efectivo: number,
  riskLevel: 'BAJO' | 'MODERADO' | 'ALTO',
  cicloOperacional: number
}): CupoAnalysis => {
  const v1_avg = inputs.datacredito3p.reduce((a, b) => a + b, 0) / inputs.datacredito3p.length;
  const v1_weighted = v1_avg * 0.10;
  const v2 = inputs.otorga;
  const v3_weighted = inputs.informaOpinion * 0.10;
  const v4_mensual = inputs.utilidadNetaAnual / 12;
  const v5_avg = inputs.referencias.reduce((a, b) => a + b, 0) / (inputs.referencias.length || 1);
  const v6_mensual = ((inputs.ebitda - inputs.impuestos - inputs.gastosFin + inputs.efectivo) / 2) / 12;

  const sum = v1_weighted + v2 + v3_weighted + v4_mensual + v5_avg + v6_mensual;
  const cupoPromedioFinal = sum / 6;

  let cupoConservadorRaw = cupoPromedioFinal * (inputs.riskLevel === 'BAJO' ? 0.50 : 0.40);
  let cupoLiberalRaw = cupoPromedioFinal * (inputs.riskLevel === 'BAJO' ? 0.80 : 0.60);

  const variables: CupoVariables = {
    v1_datacredito_avg: v1_avg,
    v1_weighted,
    v2_otorga: v2,
    v3_informa_max: inputs.informaOpinion,
    v3_weighted,
    v4_utilidad_mensual: v4_mensual,
    v5_referencias_avg: v5_avg,
    v6_ebitda_monthly: v6_mensual
  };

  return {
    variables,
    resultadoPromedio: cupoPromedioFinal,
    cupoConservador: redondearComercial(cupoConservadorRaw),
    cupoLiberal: redondearComercial(cupoLiberalRaw),
    plazoRecomendado: inputs.riskLevel === 'BAJO' ? 30 : (inputs.cicloOperacional > 180 ? 45 : 30)
  };
};
