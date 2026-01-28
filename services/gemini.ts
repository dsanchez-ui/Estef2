
import { GoogleGenAI, Type } from "@google/genai";
import { formatCOP } from '../utils/calculations';
import { CreditAnalysis, ValidationResult, DocumentValidation } from '../types';

// Updated Helper: Can handle File OR a pre-processed object with inlineData
const fileToPart = async (file: File | { name: string, inlineData: { data: string, mimeType: string } }) => {
  return new Promise((resolve) => {
    // Case A: Pre-processed Base64 (from Drive fetch)
    if ('inlineData' in file) {
       resolve({ inlineData: file.inlineData });
       return;
    }

    // Case B: Browser File Object
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
 * Added support for DEBIDA_DILIGENCIA and Context Matching.
 */
export const validateSingleDocument = async (
    file: File, 
    expectedType: 'RUT' | 'CAMARA' | 'BANCARIA' | 'REFERENCIA' | 'FINANCIEROS' | 'RENTA' | 'CEDULA' | 'COMPOSICION' | 'DEBIDA_DILIGENCIA',
    context?: { name?: string, nit?: string }
): Promise<{ isValid: boolean; msg?: string }> => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) throw new Error("API Key not found");
  
  const ai = new GoogleGenAI({ apiKey });
  const filePart = await fileToPart(file);
  
  if (!filePart) return { isValid: false, msg: "Error de lectura" };

  const now = new Date();
  const currentYear = now.getFullYear();
  const todayStr = now.toISOString().split('T')[0];

  let prompt = "";

  // 1. SPECIAL PROMPT FOR DEBIDA DILIGENCIA (SARLAFT)
  if (expectedType === 'DEBIDA_DILIGENCIA') {
      prompt = `
      Eres un Oficial de Cumplimiento experto en SARLAFT. Analiza este "Formato de Debida Diligencia".
      
      CONTEXTO DEL CLIENTE:
      - Razón Social Esperada: "${context?.name || 'N/A'}"
      - NIT Esperado: "${context?.nit || 'N/A'}"

      TAREAS VISUALES CRÍTICAS:
      1. **VERIFICAR FIRMA (CRÍTICO):** Busca visualmente en la parte inferior de la última página el espacio "FIRMA REPRESENTANTE LEGAL". ¿Hay trazos de firma, rúbrica o firma digital visible? (NO aceptes el campo vacío).
      2. **VERIFICAR IDENTIDAD:** Revisa la Sección "2. IDENTIFICACIÓN DEL CLIENTE" o encabezado. ¿Coincide razonablemente con la Razón Social y NIT esperados?
      3. **VERIFICAR DILIGENCIAMIENTO:** ¿El formulario está diligenciado en su mayoría? (Revisa si hay datos en Dirección, Actividad Económica, etc. No debe estar en blanco).

      Retorna JSON:
      {
        "hasSignature": boolean, // true si hay firma visible
        "isIdentityMatch": boolean, // true si coincide con el contexto (o si no hay contexto para comparar, asume true si hay datos válidos)
        "isFilledOut": boolean, // true si el formulario tiene contenido y no está vacío
        "reason": string // Explicación breve si falla algo
      }
      `;
  } 
  // 2. STANDARD PROMPT FOR OTHER DOCS
  else {
      prompt = `
      Eres un auditor documental financiero experto. 
      HOY ES: ${todayStr} (Año ${currentYear}).
      
      Analiza la imagen/PDF adjunto.
      
      TAREA 1: CLASIFICAR DOCUMENTO (detectedType)
      Opciones: [RUT, CAMARA_COMERCIO, CERTIFICACION_BANCARIA, REFERENCIA_COMERCIAL, ESTADOS_FINANCIEROS, DECLARACION_RENTA, CEDULA, COMPOSICION_ACCIONARIA, DEBIDA_DILIGENCIA, OTRO].
      
      TAREA 2: EXTRAER FECHA CLAVE (dateFound - YYYY-MM-DD)
      - Para CAMARA, BANCARIA, REFERENCIA: Busca la **FECHA DE EXPEDICIÓN/EMISIÓN**.
      - Para ESTADOS_FINANCIEROS o DECLARACION_RENTA: Busca el **AÑO DE CORTE** o **AÑO GRAVABLE**.
      
      Retorna JSON.
      `;
  }

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: [{ parts: [filePart, { text: prompt }] }],
    config: {
      temperature: 0,
      responseMimeType: "application/json",
      responseSchema: expectedType === 'DEBIDA_DILIGENCIA' ? undefined : {
        type: Type.OBJECT,
        properties: {
          detectedType: { type: Type.STRING },
          dateFound: { type: Type.STRING, description: "YYYY-MM-DD or null" }
        }
      }
    }
  });

  try {
    const result = JSON.parse(response.text || "{}");

    // === LOGIC FOR DEBIDA DILIGENCIA ===
    if (expectedType === 'DEBIDA_DILIGENCIA') {
        if (!result.hasSignature) {
            return { isValid: false, msg: "❌ Faltan firmas del Rep. Legal. Documento inválido." };
        }
        if (!result.isFilledOut) {
            return { isValid: false, msg: "❌ Formulario vacío o incompleto." };
        }
        if (context?.nit && !result.isIdentityMatch) {
            return { isValid: false, msg: "❌ Identidad del cliente (NIT/Nombre) no coincide con el formulario." };
        }
        return { isValid: true, msg: "✅ Formato firmado y validado." };
    }

    // === LOGIC FOR STANDARD DOCS ===
    const { detectedType, dateFound } = result;
    const typeMap: Record<string, string[]> = {
        'RUT': ['RUT'],
        'CAMARA': ['CAMARA_COMERCIO'],
        'BANCARIA': ['CERTIFICACION_BANCARIA'],
        'REFERENCIA': ['REFERENCIA_COMERCIAL'],
        'FINANCIEROS': ['ESTADOS_FINANCIEROS'],
        'RENTA': ['DECLARACION_RENTA'],
        'CEDULA': ['CEDULA'],
        'COMPOSICION': ['COMPOSICION_ACCIONARIA', 'CAMARA_COMERCIO'],
        'DEBIDA_DILIGENCIA': ['DEBIDA_DILIGENCIA']
    };

    if (!typeMap[expectedType]?.includes(detectedType)) {
        const isFinancialMix = (expectedType === 'FINANCIEROS' && detectedType === 'DECLARACION_RENTA') || (expectedType === 'RENTA' && detectedType === 'ESTADOS_FINANCIEROS');
        if (!isFinancialMix) {
             return { 
                isValid: false, 
                msg: `❌ Tipo incorrecto. Detectado: ${detectedType?.replace('_', ' ')}` 
            };
        }
    }

    // Date Logic (Existing)
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

    if (expectedType === 'CAMARA' && diffDays > 60) return { isValid: false, msg: `❌ Vencido hace ${diffDays - 60} días (>60)` };
    if (expectedType === 'BANCARIA' && diffDays > 60) return { isValid: false, msg: `❌ Vencido hace ${diffDays - 60} días (>60)` };
    if (expectedType === 'REFERENCIA' && diffDays > 90) return { isValid: false, msg: `❌ Vencido hace ${diffDays - 90} días (>90)` };
    
    if (expectedType === 'FINANCIEROS' || expectedType === 'RENTA') {
        const minValidYear = currentYear - 1;
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

// SIGNATURE UPDATE: Now supports partial file objects
export const runFullCreditAnalysis = async (allFiles: (File | { name: string, inlineData: { data: string, mimeType: string } })[], clientName: string, nit: string) => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) throw new Error("API Key not found");
  
  const ai = new GoogleGenAI({ apiKey });
  
  const partsPromises = allFiles.map(f => fileToPart(f));
  const partsResults = await Promise.all(partsPromises);
  const parts: any[] = partsResults.filter(p => p !== null);

  const prompt = `
  ERES ESTEFANÍA 2.0, EXPERTA EN ANÁLISIS DE CRÉDITO CORPORATIVO (GRUPO EQUITEL).
  Analiza los documentos financieros y reportes de riesgo adjuntos (DataCrédito, Informa, Balances, etc.) para el cliente "${clientName}" (NIT: ${nit}).

  ### ⚠️ REGLAS CRÍTICAS DE EXTRACCIÓN Y CÁLCULO
  
  1. **ESCALA DE PORCENTAJES (¡CRÍTICO - NO FALLAR!):**
     - El sistema requiere **valores numéricos entre 0 y 100**. NO uses decimales.
     - ROE 23.98% -> Retorna **23.98**.
  
  2. **Z-ALTMAN SCORE:** Calcula Z = 1.2(X1) + 1.4(X2) + 3.3(X3) + 0.6(X4) + 1.0(X5).

  3. **CAPITAL NETO DE TRABAJO (KNT):** Activo Corriente - Pasivo Corriente (Moneda Completa).

  ### 📄 ESTRUCTURA OBLIGATORIA DEL CONCEPTO IA ("justification")
  
  Debes generar un texto formateado ESTRICTAMENTE con esta estructura (usa emojis y saltos de línea \\n):

  "🚦 Análisis de Riesgo y Justificación de Cupos
  Probabilidad de Incumplimiento (Próximos 6 meses): [BAJA/MEDIA/ALTA]
  [Párrafo resumen del análisis: Menciona capacidad de pago, historial (DataCrédito/Informa), score comportamental y situación financiera general].

  🟢 Banderas Verdes (Factores Positivos)
  • [Punto 1: Ej. Historial de Pago Perfecto en Datacrédito]
  • [Punto 2: Ej. Liquidez Positiva o KNT fuerte]
  • [Punto 3: Ej. Margen Operacional sólido]
  • [Punto 4: Ej. Referencias Comerciales verificadas]

  🔴 Banderas Rojas (Factores de Riesgo)
  • [Punto 1: Ej. Alto Endeudamiento (>70%)]
  • [Punto 2: Ej. Dependencia del Corto Plazo]
  • [Punto 3: Ej. Rentabilidad Neta Baja o Pérdidas]
  • [Punto 4: Ej. Reportes negativos o incidentes judiciales]

  🎯 Recomendación de Cupo y Justificación
  [Análisis de las variables calculadas vs la realidad operativa. Menciona si el promedio matemático está distorsionado].
  
  • Cupo Conservador: [Monto Formateado]
  • Justificación: [Por qué este monto es seguro. Ej: Coincide con referencia comercial más alta].

  • Cupo Liberal: [Monto Formateado]
  • Justificación: [Por qué este monto es viable. Ej: Coincide con utilidad mensual o capacidad operativa]."

  ### CÁLCULO DE CUPO SUGERIDO (REGLA 6 VARIABLES)
  Calcula el promedio de:
  1. Datacrédito (Ponderado 10%)
  2. OtorgA (Directo)
  3. Informa (Ponderado 10%)
  4. Utilidad Neta Mensual
  5. Promedio Referencias
  6. Cupo Mensual Operativo ((EBITDA - Impuestos - Gastos + Efectivo)/24)

  ### SALIDA JSON
  Devuelve JSON estricto.
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
              v1_datacredito_avg: { type: Type.NUMBER },
              v1_weighted: { type: Type.NUMBER },
              v2_otorga: { type: Type.NUMBER },
              v3_informa_max: { type: Type.NUMBER },
              v3_weighted: { type: Type.NUMBER },
              v4_utilidad_mensual: { type: Type.NUMBER },
              v5_referencias_avg: { type: Type.NUMBER },
              v6_ebitda_monthly: { type: Type.NUMBER }
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
              knt: { type: Type.NUMBER, description: "Activo Cte - Pasivo Cte (Moneda Completa)" },
              endeudamientoGlobal: { type: Type.NUMBER, description: "Escala 0-100 (Ej: 56.2)" },
              endeudamientoLP: { type: Type.NUMBER, description: "Escala 0-100" },
              endeudamientoCP: { type: Type.NUMBER, description: "Escala 0-100 (Ej: 88.5)" },
              solvencia: { type: Type.NUMBER, description: "Escala 0-100" },
              apalancamientoFinanciero: { type: Type.NUMBER, description: "Activos / Patrimonio" },
              cargaFinanciera: { type: Type.NUMBER, description: "Escala 0-100" },
              margenBruto: { type: Type.NUMBER, description: "Escala 0-100" },
              margenNeto: { type: Type.NUMBER, description: "Escala 0-100 (Ej: 4.96)" },
              margenOperacional: { type: Type.NUMBER, description: "Escala 0-100" },
              margenContribucion: { type: Type.NUMBER, description: "Escala 0-100" },
              roa: { type: Type.NUMBER, description: "Escala 0-100 (Ej: 10.5)" },
              roe: { type: Type.NUMBER, description: "Escala 0-100 (Ej: 23.98)" },
              ebit: { type: Type.NUMBER },
              ebitda: { type: Type.NUMBER },
              puntoEquilibrio: { type: Type.NUMBER, description: "Valor monetario estimado" },
              rotacionActivos: { type: Type.NUMBER, description: "Veces (Ventas/Activos)" },
              zAltman: { type: Type.NUMBER, description: "Score Calculado (Ej: 2.99)" },
              riesgoInsolvencia: { type: Type.NUMBER },
              deterioroPatrimonial: { type: Type.BOOLEAN },
              diasCartera: { type: Type.NUMBER },
              diasInventario: { type: Type.NUMBER },
              cicloOperacional: { type: Type.NUMBER }
            }
          },

          financialIndicatorInterpretations: {
            type: Type.OBJECT,
            properties: {
              liquidez: { type: Type.STRING },
              endeudamiento: { type: Type.STRING },
              rentabilidad: { type: Type.STRING },
              operacion: { type: Type.STRING },
              zAltman: { type: Type.STRING }
            }
          },

          flags: {
            type: Type.OBJECT,
            properties: {
              green: { type: Type.ARRAY, items: { type: Type.STRING } },
              red: { type: Type.ARRAY, items: { type: Type.STRING } }
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
