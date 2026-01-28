
/**
 * URL del Web App de Google Apps Script: https://script.google.com/macros/s/AKfycbz8Ji_EqvWmwf_fpVjMh0wF3BJp7hRPCC2iBMNZA5NcJ2cRSO3f4qbE9CIrkPj2jfOzfg/exec
 * REEMPLAZAR con la URL real del despliegue.
 */
const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbz8Ji_EqvWmwf_fpVjMh0wF3BJp7hRPCC2iBMNZA5NcJ2cRSO3f4qbE9CIrkPj2jfOzfg/exec";

// Custom Error Class for Stale Data
export class StaleDataError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'StaleDataError';
    }
}

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
    let result;
    try {
      result = JSON.parse(textResult);
    } catch (e) {
      console.warn("Respuesta no JSON del servidor:", textResult);
      return { success: true, raw: textResult };
    }

    if (!result.success && result.isStaleData) {
        throw new StaleDataError(result.error);
    }
    
    return result;

  } catch (error) {
    console.error("Fallo en la comunicación con el servidor:", error);
    throw error;
  }
};

/**
 * Recovers all analyses from Google Sheets to hydrate the app state.
 */
export const getAnalysesFromCloud = async (): Promise<any[]> => {
  try {
    const response = await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: 'GET_ALL' }) // Special action flag for backend
    });

    const result = await response.json();
    if (result.success && Array.isArray(result.data)) {
        return result.data;
    }
    return [];
  } catch (error) {
    console.error("Failed to fetch analyses:", error);
    return [];
  }
};

interface BackendActionPayload {
  action: 'SAVE_REPORT' | 'SEND_EMAIL' | 'UPDATE_SHEET' | 'SAVE_STATE' | 'LOAD_STATE' | 'FETCH_FILES_FOR_AI' | 'UPDATE_PIN' | 'CHECK_PIN';
  folderUrl?: string; 
  folderId?: string; 
  htmlContent?: string;
  fileName?: string;
  jsonData?: string; // For SAVE_STATE
  newPin?: string; // For UPDATE_PIN
  pin?: string; // For CHECK_PIN
  emailData?: {
    to: string;
    subject: string;
    body: string; 
  };
  // NEW: Metadata for Sheet Logging
  logData?: {
    clientId: string;
    clientName: string;
    nit: string;
    comercialName?: string;
    detalle: string; // e.g., "Cupo Aprobado: $50M"
    estado: string; // e.g., "APROBADO"
    lastUpdated?: number; // For Optimistic Locking
  };
}

export const exportToDriveAndNotify = async (payload: BackendActionPayload): Promise<{ success: boolean; message: string; jsonContent?: string; files?: any[] }> => {
  try {
    const response = await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ backendAction: payload }) 
    });

    const result = await response.json();
    if (!result.success) {
        // Handle Optimistic Lock Error
        if (result.isStaleData) {
            throw new StaleDataError(result.error);
        }
        // Safe fail for load action
        if (payload.action === 'LOAD_STATE') return { success: false, message: result.message || "No data" };
        throw new Error(result.error || "Error desconocido en backend");
    }
    
    return { success: true, message: result.message, jsonContent: result.jsonContent, files: result.files };
  } catch (error: any) {
    console.error("Backend Action Failed:", error);
    // Propagate StaleDataError
    if (error.name === 'StaleDataError') throw error;
    return { success: false, message: error.message };
  }
};

/**
 * Saves the full CreditAnalysis state as a JSON file in the client's Drive folder.
 */
export const saveAnalysisState = async (folderUrl: string, analysis: any) => {
    // Strip heavy file objects, keep only metadata if needed (or rely on structure)
    // We create a "lean" version of the object
    const leanAnalysis = {
        ...analysis,
        commercialFiles: {}, // Files can't be saved to JSON string
        riskFiles: {}
    };
    
    return await exportToDriveAndNotify({
        action: 'SAVE_STATE',
        folderUrl: folderUrl,
        jsonData: JSON.stringify(leanAnalysis)
    });
};

/**
 * Loads the full CreditAnalysis state from the JSON file in Drive.
 */
export const loadAnalysisState = async (folderUrl: string) => {
    const result = await exportToDriveAndNotify({
        action: 'LOAD_STATE',
        folderUrl: folderUrl
    });
    
    if (result.success && result.jsonContent) {
        return JSON.parse(result.jsonContent);
    }
    return null;
};

/**
 * Fetches relevant files (Financials, etc.) from the specific Drive Folder as Base64 to feed the AI
 */
export const fetchProjectFiles = async (folderId: string) => {
   const result = await exportToDriveAndNotify({
      action: 'FETCH_FILES_FOR_AI',
      folderId: folderId
   });
   return result.files || [];
};

/**
 * Updates the Director PIN in the backend
 */
export const updateRemotePIN = async (newPin: string): Promise<boolean> => {
   const result = await exportToDriveAndNotify({
      action: 'UPDATE_PIN',
      newPin: newPin
   });
   return result.success;
};

/**
 * Verifies the PIN against the backend
 */
export const verifyRemotePIN = async (pin: string): Promise<boolean> => {
   const result = await exportToDriveAndNotify({
      action: 'CHECK_PIN',
      pin: pin
   });
   return result.success;
};
