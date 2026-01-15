
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

  // Use gemini-3-pro-preview for complex reasoning and set temperature to 0 for consistency
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
Actúa como Estefanía 2.0, el sistema experto de riesgo de Equitel. Analiza los documentos financieros y legales adjuntos (PDF/Excel) para el cliente "${clientName}" (NIT: ${nit}).
  
  TU MISIÓN: Ejecutar una simulación de modelo predictivo y calcular el cupo de crédito exacto siguiendo estrictamente las reglas de negocio descritas abajo.

  ### 1. MODELO PREDICTIVO DE MORA (Simulación XGBoost)
  Extrae las variables de entrada y estima la probabilidad de incumplimiento (0 a 1) basada en el perfil financiero:
  - **Inputs a evaluar:** Ingresos anuales, Activos Totales, Pasivos Totales, Sector Económico (inferido), Mora Histórica (buscar en reportes), Antigüedad, Score Centrales de Riesgo y Volumen de Operaciones.
  - **Salida:** 'scoreProbability' (number 0-1).

  ### 2. CÁLCULO DE RATIOS FINANCIEROS (Completo)
  Extrae datos de los Estados Financieros (Año más reciente) y calcula:
  - **Liquidez:** Razón Corriente, Prueba Ácida, Capital de Trabajo Neto (KNT).
  - **Endeudamiento:** Global, Corto Plazo (CP), Largo Plazo (LP).
  - **Rentabilidad:** Margen Bruto, Operacional, Neto, ROA, ROE.
  - **Operación:** Días Cartera, Días Inventario, Ciclo Operacional, Rotación de Activos.
  - **Otros:** Solvencia (Pasivo/Patrimonio), EBITDA, Z-Altman Score (Colombia Mfg/Service).

  ### 3. CÁLCULO DE CUPO SUGERIDO (REGLA DE LOS 6 INDICADORES)
  Calcula el cupo final como el PROMEDIO de las siguientes 6 variables. Si un dato no existe, asume 0 para ese componente.
  
  1. **Datacrédito (Ponderado):** (Promedio de cupos últimos 3 periodos en reporte) * 10%.
  2. **OtorgA (Plataforma):** Valor directo "Cupo" u "OtorgA" que aparece al final del informe Datacrédito (en miles, conviértelo a pesos completos).
  3. **Opinión Informa (Ponderado):** (Opinión de Crédito / Cupo Máximo Recomendado del informe Informa) * 10%.
     *NOTA: ¡No alucines! Usa estrictamente el 10% de la opinión, no uses la fórmula antigua de patrimonio.*
  4. **Utilidad Neta Mensual:** (Utilidad Neta del último año) / 12.
  5. **Referencias Comerciales:** Promedio de los valores reportados en las referencias adjuntas.
  6. **Cupo Mensual Operativo:** ((EBITDA - Impuestos - GastosFinancieros + Efectivo) / 2) / 12.
     *(Nota: Si impuestos no es explícito, usa 35% de Utilidad Ante Impuestos).*

  ### SALIDA JSON REQUERIDA
  Retorna UNICAMENTE un objeto JSON con esta estructura exacta. Asegúrate de incluir flags rojas y verdes.
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
              green: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Banderas Verdes (Obligatorio)" },
              red: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Banderas Rojas (Obligatorio)" }
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
