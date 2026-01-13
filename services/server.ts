
/**
 * URL del Web App de Google Apps Script: https://script.google.com/macros/s/AKfycbz8Ji_EqvWmwf_fpVjMh0wF3BJp7hRPCC2iBMNZA5NcJ2cRSO3f4qbE9CIrkPj2jfOzfg/exec
 * REEMPLAZAR con la URL real del despliegue.
 */
const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbz8Ji_EqvWmwf_fpVjMh0wF3BJp7hRPCC2iBMNZA5NcJ2cRSO3f4qbE9CIrkPj2jfOzfg/exec";

/**
 * Envía el payload al backend de Google Apps Script.
 * @param {any} payload - El objeto completo con { datosCliente, archivos, analisis }.
 * @returns {Promise} Respuesta del servidor.
 */
export const saveAnalysisToCloud = async (payload: any): Promise<any> => {
  const bodyData = {
    payload: payload
  };

  try {
    // Usamos 'text/plain;charset=utf-8' para evitar problemas de CORS con GAS al usar simple POST
    const response = await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: JSON.stringify(bodyData),
    });

    if (!response.ok) {
      throw new Error(`Error HTTP: ${response.status} ${response.statusText}`);
    }

    const textResult = await response.text();
    try {
      return JSON.parse(textResult);
    } catch (e) {
      console.warn("Respuesta no JSON del servidor:", textResult);
      return { success: true, raw: textResult };
    }

  } catch (error) {
    console.error("Fallo en la comunicación con el servidor:", error);
    throw error instanceof Error ? error : new Error(String(error));
  }
};
