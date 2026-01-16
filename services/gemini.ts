
import { GoogleGenAI, Type } from "@google/genai";
import { formatCOP } from '../utils/calculations';
import { CreditAnalysis, ValidationResult, DocumentValidation } from '../types';

const fileToPart = async (file: File) => {
  return new Promise((resolve) => {
    // GUARD: Check if valid file object
    if (!file || !(file instanceof Blob)) {
        console.warn("Invalid file passed to Gemini part converter", file);
        resolve(null);
        return;
    }
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

  // Prompt optimizado para excluir DV
  const prompt = `Analiza este documento (RUT DIAN Colombia) y extrae:
  1. Razón Social Exacta (Nombre de la empresa).
  2. NIT (Número de Identificación Tributaria).
     - Busca la Casilla 5 (Número de Identificación).
     - IGNORA y ELIMINA el Dígito de Verificación (DV) que suele estar en la Casilla 6 o separado por un guion al final.
     - Retorna SOLO el número base sin puntos ni guiones.
     - Ejemplo: Si ves "890.900.123-4" o "890900123 DV 4", devuelve "890900123".
  
  Retorna JSON.`;

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
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

export const validateDocIdentity = async (file: File, expectedClientName: string): Promise<{ isValid: boolean; reason?: string }> => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) throw new Error("API Key not found");
  
  const ai = new GoogleGenAI({ apiKey });
  const filePart = await fileToPart(file);
  if (!filePart) return { isValid: false, reason: "Error de lectura de archivo" };

  const prompt = `Analiza el encabezado o los datos principales de este documento.
  El cliente esperado es: "${expectedClientName}".
  
  Tu tarea:
  1. Identificar el nombre de la empresa o persona a quien pertenece este documento.
  2. Comparar con el cliente esperado (ignorando diferencias menores como SAS, LTDA, mayúsculas/minúsculas).
  3. Determinar si COINCIDE o NO.

  Retorna JSON.`;

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: [{ parts: [filePart, { text: prompt }] }],
    config: {
      temperature: 0,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          detectedName: { type: Type.STRING },
          isMatch: { type: Type.BOOLEAN },
          reason: { type: Type.STRING }
        }
      }
    }
  });

  try {
    const result = JSON.parse(response.text || "{}");
    return {
      isValid: result.isMatch,
      reason: result.isMatch ? undefined : `Nombre detectado: ${result.detectedName}. No coincide con ${expectedClientName}.`
    };
  } catch (error) {
    return { isValid: false, reason: "No se pudo validar la identidad del documento." };
  }
};

/**
 * OPTIMIZED: Validates a single document for Type Match and Date Validity.
 * Uses gemini-2.5-flash for maximum speed.
 */
export const validateSingleDocument = async (file: File, expectedType: 'RUT' | 'CAMARA' | 'BANCARIA' | 'REFERENCIA' | 'FINANCIEROS' | 'RENTA' | 'CEDULA' | 'COMPOSICION'): Promise<{ isValid: boolean; msg?: string }> => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) throw new Error("API Key not found");
  
  const ai = new GoogleGenAI({ apiKey });
  const filePart = await fileToPart(file);
  
  if (!filePart) return { isValid: false, msg: "Error de lectura" };

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1; // 1-12
  const todayStr = now.toISOString().split('T')[0];

  const prompt = `
  Eres un auditor documental financiero experto. 
  HOY ES: ${todayStr} (Año ${currentYear}).
  
  Analiza la imagen/PDF adjunto (puede ser escaneado, usa OCR visual).
  
  TAREA 1: CLASIFICAR DOCUMENTO (detectedType)
  Opciones: [RUT, CAMARA_COMERCIO, CERTIFICACION_BANCARIA, REFERENCIA_COMERCIAL, ESTADOS_FINANCIEROS, DECLARACION_RENTA, CEDULA, COMPOSICION_ACCIONARIA, OTRO].
  - "ESTADOS_FINANCIEROS": Balance General, Estado de Situación Financiera. Busca encabezados como "Al 31 de Diciembre".
  - "DECLARACION_RENTA": Formulario 110, 210 DIAN. Busca la casilla "Año" o "Año Gravable" en la cabecera.

  TAREA 2: EXTRAER FECHA CLAVE (dateFound - YYYY-MM-DD)
  - Para CAMARA, BANCARIA, REFERENCIA: Busca la **FECHA DE EXPEDICIÓN/EMISIÓN** del documento (generalmente arriba o abajo junto a la firma).
    *¡CUIDADO! No confundir con fecha de constitución o fechas de resoluciones antiguas.*
  - Para ESTADOS_FINANCIEROS o DECLARACION_RENTA: Busca el **AÑO DE CORTE** o **AÑO GRAVABLE**.
    *Si dice "Año Gravable 2023", la fecha es 2023-12-31.*
    *Si dice "Corte a 31 de Dic 2024", la fecha es 2024-12-31.*
  
  Retorna JSON.
  `;

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash', // Vision capable, fast
    contents: [{ parts: [filePart, { text: prompt }] }],
    config: {
      temperature: 0,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          detectedType: { type: Type.STRING, enum: ['RUT', 'CAMARA_COMERCIO', 'CERTIFICACION_BANCARIA', 'REFERENCIA_COMERCIAL', 'ESTADOS_FINANCIEROS', 'DECLARACION_RENTA', 'CEDULA', 'COMPOSICION_ACCIONARIA', 'OTRO'] },
          dateFound: { type: Type.STRING, description: "YYYY-MM-DD or null" }
        }
      }
    }
  });

  try {
    const result = JSON.parse(response.text || "{}");
    const { detectedType, dateFound } = result;

    // 1. TYPE CHECK MAPPING
    const typeMap: Record<string, string[]> = {
        'RUT': ['RUT'],
        'CAMARA': ['CAMARA_COMERCIO'],
        'BANCARIA': ['CERTIFICACION_BANCARIA'],
        'REFERENCIA': ['REFERENCIA_COMERCIAL'],
        'FINANCIEROS': ['ESTADOS_FINANCIEROS'],
        'RENTA': ['DECLARACION_RENTA'],
        'CEDULA': ['CEDULA'],
        'COMPOSICION': ['COMPOSICION_ACCIONARIA', 'CAMARA_COMERCIO']
    };

    if (!typeMap[expectedType]?.includes(detectedType)) {
        // Relax check for financials/renta mix-up as they look similar sometimes
        const isFinancialMix = (expectedType === 'FINANCIEROS' && detectedType === 'DECLARACION_RENTA') || (expectedType === 'RENTA' && detectedType === 'ESTADOS_FINANCIEROS');
        
        if (!isFinancialMix) {
             return { 
                isValid: false, 
                msg: `❌ Tipo incorrecto. Detectado: ${detectedType.replace('_', ' ')}` 
            };
        }
    }

    // 2. DATE CHECK LOGIC
    if (!dateFound) {
        if (['CAMARA', 'BANCARIA', 'REFERENCIA', 'FINANCIEROS', 'RENTA'].includes(expectedType)) {
             return { isValid: false, msg: "❌ No se encontró fecha legible" };
        }
        return { isValid: true };
    }

    const docDate = new Date(dateFound);
    const docYear = docDate.getFullYear();
    // @ts-ignore
    const diffDays = Math.ceil((now - docDate) / (1000 * 60 * 60 * 24));

    // A. REGLAS DE VIGENCIA CORTA (Días)
    if (expectedType === 'CAMARA' && diffDays > 60) return { isValid: false, msg: `❌ Vencido hace ${diffDays - 60} días (>60)` };
    if (expectedType === 'BANCARIA' && diffDays > 60) return { isValid: false, msg: `❌ Vencido hace ${diffDays - 60} días (>60)` };
    if (expectedType === 'REFERENCIA' && diffDays > 90) return { isValid: false, msg: `❌ Vencido hace ${diffDays - 90} días (>90)` };
    
    // B. REGLAS DE VIGENCIA ANUAL (EE.FF y Renta)
    // Regla: Debe ser Año Inmediatamente Anterior o Año en Curso.
    // Ejemplo: Si estamos en 2025, aceptamos 2024 o 2025. 2023 es VENCIDO.
    // Excepción: Si estamos en los primeros meses (Ene-Abril), a veces Renta anterior no está lista, pero EE.FF preliminares sí.
    // Política Equitel: Exigir cierre del año anterior.
    
    if (expectedType === 'FINANCIEROS' || expectedType === 'RENTA') {
        const minValidYear = currentYear - 1; // e.g. 2025 - 1 = 2024
        
        if (docYear < minValidYear) {
            return { isValid: false, msg: `❌ Año ${docYear} vencido. Se requiere ${minValidYear} o ${currentYear}.` };
        }
    }

    return { isValid: true };

  } catch (e) {
    console.error("Fast Validation Error", e);
    return { isValid: false, msg: "Error técnico validando" };
  }
};

export const validateCommercialDocuments = async (files: File[], clientName: string, nit: string): Promise<ValidationResult> => {
    return { overallValid: true, results: [], summary: "Batch validation deprecated" };
};

export const runFullCreditAnalysis = async (allFiles: File[], clientName: string, nit: string) => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) throw new Error("API Key not found");
  
  const ai = new GoogleGenAI({ apiKey });
  
  const partsPromises = allFiles.map(f => fileToPart(f));
  const partsResults = await Promise.all(partsPromises);
  const parts: any[] = partsResults.filter(p => p !== null);

  const prompt = `
  ERES ESTEFANÍA 2.0, EXPERTA EN ANÁLISIS DE CRÉDITO CORPORATIVO (GRUPO EQUITEL).
  Analiza los documentos financieros y reportes de riesgo adjuntos (DataCrédito, Informa, Balances, etc.) para el cliente "${clientName}" (NIT: ${nit}).

  ### 🚨 MISIÓN CRÍTICA: EXTRACCIÓN DE CUPO
  **¡NO INVENTES DATOS PERO TAMPOCO DEJES LOS CAMPOS EN CERO SI HAY INFORMACIÓN FINANCIERA!**

  1. **BUSCA EN LOS ADJUNTOS:** 
     - **DATACRÉDITO:** Busca textos como "Cupo sugerido", "OtorgA", "Cupo línea", "Endeudamiento sugerido".
     - **INFORMA COLOMBIA:** Busca "Opinión de Crédito", "Límite Recomendado" o "Cupo Máximo".
     - **ESTADOS FINANCIEROS:** Extrae Utilidad Neta, EBITDA, Ingresos.

  2. **REGLA DE ESTIMACIÓN (SI FALTA DATACRÉDITO/INFORMA):**
     - Si NO encuentras el reporte de Datacrédito o Informa explícito, **NO PONGAS CERO**.
     - Estima el cupo de riesgo externo como el **5% de los INGRESOS OPERACIONALES ANUALES** encontrados en los Estados Financieros.

  ### 3. CÁLCULO DE CUPO SUGERIDO (REGLA DE LOS 6 INDICADORES)
  Calcula el cupo final como el PROMEDIO de las siguientes 6 variables:
  
  1. **Datacrédito (Ponderado):** (Promedio de cupos últimos 3 periodos en reporte * 10%) O (OtorgA * 10%). Si no hay reporte, usa 5% Ingresos * 10%.
  2. **OtorgA (Plataforma):** Valor directo "Cupo" u "OtorgA" (Datacrédito). Si no existe, usa 2% Ingresos.
  3. **Opinión Informa (Ponderado):** (Opinión de Crédito * 10%). Si no hay, usa 5% Ingresos * 10%.
  4. **Utilidad Neta Mensual:** (Utilidad Neta del último año) / 12.
  5. **Referencias Comerciales:** Promedio de los valores reportados en las referencias adjuntas.
  6. **Cupo Mensual Operativo:** ((EBITDA - Impuestos - GastosFinancieros + Efectivo) / 2) / 12.

  ### 📝 FORMATO DE JUSTIFICACIÓN (OBLIGATORIO)
  El campo "justification" debe ser un string formateado EXACTAMENTE así:
  
  "🟢 Banderas Verdes:
  - [Punto positivo 1]
  - [Punto positivo 2]
  
  🔴 Banderas Rojas:
  - [Riesgo detectado 1]
  - [Riesgo detectado 2]
  
  📋 Resumen:
  [Breve párrafo de conclusión]"

  ### SALIDA JSON REQUERIDA
  `;

  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: [{ parts: [...parts, { text: prompt }] }],
    config: {
      temperature: 0.1, // Low temp for precision
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          verdict: { type: Type.STRING, enum: ["APROBADO", "NEGADO"] },
          suggestedCupo: { type: Type.NUMBER },
          
          cupoVariables: {
            type: Type.OBJECT,
            properties: {
              v1_datacredito_avg: { type: Type.NUMBER, description: "Promedio reportes Datacredito" },
              v1_weighted: { type: Type.NUMBER, description: "Datacredito Ponderado (10%)" },
              v2_otorga: { type: Type.NUMBER, description: "Valor OtorgA o Cupo Score" },
              v3_informa_max: { type: Type.NUMBER, description: "Opinión Informa" },
              v3_weighted: { type: Type.NUMBER, description: "Opinión Informa Ponderada (10%)" },
              v4_utilidad_mensual: { type: Type.NUMBER, description: "Utilidad Neta / 12" },
              v5_referencias_avg: { type: Type.NUMBER, description: "Promedio referencias encontradas" },
              v6_ebitda_monthly: { type: Type.NUMBER, description: "Capacidad pago mensual operativa" }
            },
            required: ["v1_weighted", "v2_otorga", "v3_weighted", "v4_utilidad_mensual", "v5_referencias_avg", "v6_ebitda_monthly"]
          },
          
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
              green: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Lista de aspectos positivos" },
              red: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Lista de riesgos" }
            },
            required: ["green", "red"]
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
