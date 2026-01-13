
import { GoogleGenAI, Type } from "@google/genai";
import { formatCOP } from '../utils/calculations';
import { CreditAnalysis } from '../types';

const fileToPart = async (file: File) => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      if (!result) {
        resolve(null);
        return;
      }
      const base64String = result.split(',')[1];
      resolve({
        inlineData: {
          data: base64String,
          mimeType: file.type,
        },
      });
    };
    reader.readAsDataURL(file);
  });
};

export const extractIdentityFromRUT = async (rutFile: File) => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) throw new Error("API Key not found");
  
  const ai = new GoogleGenAI({ apiKey });
  const filePart = await fileToPart(rutFile);
  
  if (!filePart) throw new Error("No se pudo procesar el archivo RUT");

  const prompt = `Analiza este documento (RUT DIAN Colombia) y extrae:
  1. Razón Social Exacta (Nombre de la empresa).
  2. NIT (Número de Identificación Tributaria) sin el dígito de verificación si es posible, o completo.
  
  Retorna JSON.`;

  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: [{ parts: [filePart, { text: prompt }] }],
    config: {
      temperature: 0,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          razonSocial: { type: Type.STRING },
          nit: { type: Type.STRING }
        }
      }
    }
  });

  try {
    const text = response.text;
    if (!text) return { razonSocial: "", nit: "" };
    return JSON.parse(text);
  } catch (e) {
    console.error("Error parsing RUT identity", e);
    return { razonSocial: "", nit: "" };
  }
};

// Consolidated One-Shot Analysis
export const runFullCreditAnalysis = async (allFiles: File[], clientName: string, nit: string) => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) throw new Error("API Key not found");
  
  const ai = new GoogleGenAI({ apiKey });
  
  const partsPromises = allFiles.map(f => fileToPart(f));
  const partsResults = await Promise.all(partsPromises);
  const parts: any[] = partsResults.filter(p => p !== null);

  const prompt = `
  Actúa como Estefanía 2.0, Auditor Senior de Riesgo. Analiza los documentos para el cliente ${clientName} (NIT: ${nit}).
  
  EJECUCIÓN DE MODELO PREDICTIVO Y CÁLCULO FINANCIERO:
  
  1. **Modelo Predictivo de Mora (XGBoost Metaphor)**:
     Evalúa las siguientes entradas extraídas de los documentos:
     - Ingresos, Activos, Pasivos.
     - Sector económico (inferido).
     - Mora histórica (Datacrédito).
     - Score centrales de riesgo.
     - Antigüedad.
     -> Salida: Probabilidad de mora (0 a 1).

  2. **Cálculo de Ratios Financieros (Estricto)**:
     Extrae y calcula: Liquidez, Prueba Ácida, KNT, Endeudamiento Global, LP, CP, Margen Neto/Operacional/Bruto, ROA, ROE, EBIT, EBITDA, Z-Altman Score, Solvencia, Ciclo Operacional.

  3. **Cálculo de Cupo Sugerido (Regla de los 6 Indicadores)**:
     Calcula el promedio de:
     a. Datacrédito (Promedio 3 periodos) * 10%
     b. OtorgA (Valor directo en miles)
     c. Opinión de crédito Informa * 10%
     d. Utilidad neta anual último año / 12
     e. Referencias comerciales (promedio)
     f. Cupo Mensual Operativo: ((EBITDA - Impuestos - GastosFin + Efectivo) / 2) / 12

     *Nota: No alucines con la Opinión de Crédito antigua. Usa estrictamente la ponderación del 10%.*

  RETORNA UN ÚNICO JSON CON LA SIGUIENTE ESTRUCTURA:
  `;

  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: [{ parts: [...parts, { text: prompt }] }],
    config: {
      temperature: 0, // Deterministic
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          verdict: { type: Type.STRING, enum: ["APROBADO", "NEGADO"] },
          suggestedCupo: { type: Type.NUMBER },
          scoreProbability: { type: Type.NUMBER, description: "Probabilidad de mora 0-1" },
          justification: { type: Type.STRING },
          financialIndicators: {
            type: Type.OBJECT,
            properties: {
              razonCorriente: { type: Type.NUMBER },
              pruebaAcida: { type: Type.NUMBER },
              knt: { type: Type.NUMBER },
              endeudamientoGlobal: { type: Type.NUMBER },
              endeudamientoLP: { type: Type.NUMBER },
              endeudamientoCP: { type: Type.NUMBER },
              solvencia: { type: Type.NUMBER },
              margenNeto: { type: Type.NUMBER },
              margenOperacional: { type: Type.NUMBER },
              roa: { type: Type.NUMBER },
              roe: { type: Type.NUMBER },
              ebit: { type: Type.NUMBER },
              ebitda: { type: Type.NUMBER },
              zAltman: { type: Type.NUMBER },
              riesgoInsolvencia: { type: Type.NUMBER },
              deterioroPatrimonial: { type: Type.BOOLEAN },
              diasCartera: { type: Type.NUMBER },
              diasInventario: { type: Type.NUMBER },
              cicloOperacional: { type: Type.NUMBER }
            }
          },
          flags: {
            type: Type.OBJECT,
            properties: {
              green: { type: Type.ARRAY, items: { type: Type.STRING } },
              red: { type: Type.ARRAY, items: { type: Type.STRING } }
            }
          }
        }
      }
    }
  });

  try {
    const text = response.text;
    if (!text) throw new Error("Empty response");
    return JSON.parse(text);
  } catch (e) {
    console.error("AI Analysis Failed", e);
    throw new Error("Error en el análisis de IA.");
  }
};

export const getAIGuidance = async (analysis: CreditAnalysis) => {
  return analysis.aiResult?.justification || "Sin concepto previo.";
};
