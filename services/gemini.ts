
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

/**
 * Validates commercial documents using strict OCR and rule checking.
 */
export const validateCommercialDocuments = async (files: File[], clientName: string, nit: string): Promise<ValidationResult> => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) throw new Error("API Key not found");
  
  const ai = new GoogleGenAI({ apiKey });
  
  const partsPromises = files.map(f => fileToPart(f));
  const partsResults = await Promise.all(partsPromises);
  const parts: any[] = partsResults.filter(p => p !== null);
  
  const prompt = `Actúa como un Auditor de Riesgo y Analista Financiero Senior (Estefanía 2.0).
  Tu tarea es doble: 
  1. Validar el cumplimiento estricto de requisitos documentales (fechas, firmas, vigencias).
  2. Extraer información financiera para el cálculo de cupo.
  
  Cliente: ${clientName}
  NIT: ${nit}

  Analiza los documentos adjuntos (PDFs/Imágenes) y extrae la siguiente información estructurada.

  **REGLAS DE EXTRACCIÓN DOCUMENTAL (CRÍTICO):**
  - **Estados Financieros:** Identifica qué años fiscales completos están presentes. Si hay estados financieros con corte menor a diciembre del año actual, márcalo como 'parcial'.
  - **Certificados (Cámara Comercio, Ref. Comercial, Cert. Bancaria):** Extrae la FECHA DE EMISIÓN o EXPEDICIÓN de cada uno. Formato YYYY-MM-DD.
  - **Legales:** Verifica visualmente si existe el RUT, cuántas Declaraciones de Renta (años) hay, cuántos meses de Extractos Bancarios consecutivos hay.
  - **Identificación RL:** Verifica si existe el documento de identidad del Representante Legal. **IMPORTANTE:** Puede ser "Cédula de Ciudadanía" (Colombia) O "Cédula de Extranjería". Ambas son válidas.
  - **Composición Accionaria:** Verifica si el documento de composición accionaria tiene DOS firmas específicas: Revisor Fiscal Y Representante Legal.

  **REGLAS DE EXTRACCIÓN FINANCIERA:**
  - Usa el año más reciente disponible para los indicadores.
  - Extrae: Activos (Corriente, Total, Inventarios, Efectivo), Pasivos (Corriente, Total), Patrimonio, Ingresos, Utilidad Neta, EBIT, EBITDA (calcúlalo si falta), Gastos Financieros, Impuestos.
  - Datacrédito/Informa: Extrae cupos sugeridos, OtorgA y comportamiento.

  Retorna SOLAMENTE un JSON válido.`;

  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: [{ parts: [...parts, { text: prompt }] }],
    config: {
      temperature: 0,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          identificacion: {
            type: Type.OBJECT,
            properties: {
              razonSocial: { type: Type.STRING },
              nit: { type: Type.STRING }
            }
          },
          validacionDocumental: {
            type: Type.OBJECT,
            properties: {
              financieros: {
                type: Type.OBJECT,
                properties: {
                  aniosEncontrados: { type: Type.ARRAY, items: { type: Type.INTEGER } },
                  esParcial: { type: Type.BOOLEAN }
                }
              },
              fechasVigencia: {
                type: Type.OBJECT,
                properties: {
                  camara: { type: Type.STRING, description: "YYYY-MM-DD o null" },
                  referencia: { type: Type.STRING, description: "YYYY-MM-DD o null" },
                  bancaria: { type: Type.STRING, description: "YYYY-MM-DD o null" }
                }
              },
              legales: {
                type: Type.OBJECT,
                properties: {
                  rut: { type: Type.BOOLEAN },
                  declaracionRentaAnios: { type: Type.ARRAY, items: { type: Type.INTEGER } },
                  extractosMesesCount: { type: Type.INTEGER },
                  cedulaRL: { type: Type.BOOLEAN, description: "True si hay Cédula Ciudadanía o Extranjería" }
                }
              },
              accionaria: {
                type: Type.OBJECT,
                properties: {
                  firmaRevisor: { type: Type.BOOLEAN },
                  firmaRepresentante: { type: Type.BOOLEAN }
                }
              }
            }
          },
          fuentesExternas: {
            type: Type.OBJECT,
            properties: {
              datacredito: {
                type: Type.OBJECT,
                properties: {
                  otorgaCupo: { type: Type.NUMBER },
                  historicoCupos: { type: Type.ARRAY, items: { type: Type.NUMBER } }
                }
              },
              informa: {
                type: Type.OBJECT,
                properties: {
                  opinionCredito: { type: Type.NUMBER }
                }
              },
              referencias: {
                type: Type.OBJECT,
                properties: {
                  valores: { type: Type.ARRAY, items: { type: Type.NUMBER } }
                }
              }
            }
          },
          financiero: {
            type: Type.OBJECT,
            properties: {
              activos: {
                type: Type.OBJECT,
                properties: {
                  corriente: { type: Type.NUMBER },
                  total: { type: Type.NUMBER },
                  efectivo: { type: Type.NUMBER },
                  inventarios: { type: Type.NUMBER }
                }
              },
              pasivos: {
                type: Type.OBJECT,
                properties: {
                  corriente: { type: Type.NUMBER },
                  total: { type: Type.NUMBER },
                  noCorriente: { type: Type.NUMBER }
                }
              },
              patrimonio: { type: Type.NUMBER },
              resultados: {
                type: Type.OBJECT,
                properties: {
                  ingresos: { type: Type.NUMBER },
                  utilidadNeta: { type: Type.NUMBER },
                  ebit: { type: Type.NUMBER },
                  ebitda: { type: Type.NUMBER },
                  gastosFinancieros: { type: Type.NUMBER },
                  impuestos: { type: Type.NUMBER }
                }
              }
            }
          },
          analisisRiesgo: {
            type: Type.OBJECT,
            properties: {
              probabilidadMora: { type: Type.STRING },
              flags: {
                type: Type.OBJECT,
                properties: {
                  rojas: { type: Type.ARRAY, items: { type: Type.STRING } },
                  verdes: { type: Type.ARRAY, items: { type: Type.STRING } }
                }
              },
              justificacion: { type: Type.STRING }
            }
          }
        }
      }
    }
  });

  try {
    const textResponse = response.text;
    if (!textResponse) throw new Error("Respuesta vacía de Gemini");
    
    const rawData = JSON.parse(textResponse);
    
    // --- POST-PROCESSING VALIDATION LOGIC ---
    const results: DocumentValidation[] = [];
    const today = new Date();
    
    const getDaysDiff = (dateStr?: string) => {
        if (!dateStr) return 999;
        const d = new Date(dateStr);
        // @ts-ignore
        const diffTime = Math.abs(today - d);
        return Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
    };

    const isDateValid = (dateStr?: string, maxDays = 60) => {
        if (!dateStr) return false;
        return getDaysDiff(dateStr) <= maxDays;
    };

    // 1. Cámara de Comercio
    const camaraDate = rawData.validacionDocumental.fechasVigencia.camara;
    const isCamaraValid = isDateValid(camaraDate, 60); 
    results.push({
        fileName: "Cámara de Comercio",
        isValid: isCamaraValid,
        detectedDate: camaraDate || "No detectada",
        issue: !camaraDate ? "Fecha no encontrada" : !isCamaraValid ? `Vencido (>60 días: ${getDaysDiff(camaraDate)} días)` : "OK"
    });

    // 2. Certificación Bancaria
    const bankDate = rawData.validacionDocumental.fechasVigencia.bancaria;
    const isBankValid = isDateValid(bankDate, 60);
    results.push({
        fileName: "Certificación Bancaria",
        isValid: isBankValid,
        detectedDate: bankDate || "No detectada",
        issue: !bankDate ? "Fecha no encontrada" : !isBankValid ? `Vencido (>60 días)` : "OK"
    });

    // 3. Referencia Comercial
    const refDate = rawData.validacionDocumental.fechasVigencia.referencia;
    const isRefValid = isDateValid(refDate, 90); 
    results.push({
        fileName: "Referencia Comercial",
        isValid: isRefValid,
        detectedDate: refDate || "No detectada",
        issue: !refDate ? "Fecha no encontrada" : !isRefValid ? `Vencido (>90 días)` : "OK"
    });

    // 4. RUT
    const hasRut = rawData.validacionDocumental.legales.rut;
    results.push({
        fileName: "RUT",
        isValid: hasRut,
        issue: hasRut ? "OK" : "Documento no detectado o ilegible"
    });

    // 5. Cédula RL
    const hasCedula = rawData.validacionDocumental.legales.cedulaRL;
    results.push({
        fileName: "Cédula Representante Legal",
        isValid: hasCedula,
        issue: hasCedula ? "OK" : "Documento no detectado"
    });

    // 6. Estados Financieros
    const financialYears = rawData.validacionDocumental.financieros.aniosEncontrados || [];
    const currentYear = today.getFullYear();
    const hasRecentYear = financialYears.some((y: number) => y >= currentYear - 1);
    results.push({
        fileName: "Estados Financieros",
        isValid: hasRecentYear,
        detectedDate: financialYears.join(", "),
        issue: hasRecentYear ? "OK" : "No se encontraron estados financieros del año inmediatamente anterior"
    });

    // 7. Composición Accionaria
    const signatures = rawData.validacionDocumental.accionaria;
    const hasSignatures = signatures.firmaRevisor && signatures.firmaRepresentante;
    results.push({
        fileName: "Composición Accionaria",
        isValid: hasSignatures,
        issue: hasSignatures ? "Firmas OK" : `Faltan firmas: ${!signatures.firmaRevisor ? 'Revisor ' : ''}${!signatures.firmaRepresentante ? 'Representante' : ''}`
    });

    const overallValid = results.every(r => r.isValid);
    const summary = overallValid 
        ? "Todos los documentos cumplen con los requisitos de vigencia y forma." 
        : "Se detectaron documentos vencidos o incompletos que deben corregirse antes de continuar.";

    return {
        overallValid,
        results,
        summary,
        rawData 
    };

  } catch (e) {
    console.error("Error parseando respuesta Gemini:", e);
    throw new Error("No se pudo extraer la información. Verifique la calidad de los documentos.");
  }
};

// Consolidated One-Shot Analysis (Heavy Risk Analysis - Used by Director)
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
          
          // ADDED: Explicit breakdown for the 6 indicators
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
