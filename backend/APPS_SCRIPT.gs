
/**
 * ==========================================
 * ESTEFANÍA 2.0 - BACKEND GOOGLE APPS SCRIPT
 * MODO: UPSERT + LOCKING + CONCURRENCY CONTROL + CC COMERCIAL
 * ==========================================
 */

const ID_CARPETA_RAIZ = "1zZQJev_44r4bTrRVTiH6V7ho7ZZS2qKg"; 
const EMAILS_NOTIFICACION = "dsanchez@equitel.com.co"; 

// CONSTANTES DE NAVEGACIÓN
const LINK_SHEETS = "https://docs.google.com/spreadsheets/d/1axGp_Z-PGA5LJQRu58Aa3yp5QGgS4PWTxNWh8TTYnH8/edit?usp=sharing";
const LINK_APP = "https://aistudio.google.com/app/u/0/apps/drive/13su0xNJT9YRG-oRxzvZg---Jm6FD2oih?showAssistant=true&showPreview=true&fullscreenApplet=true";

// MAPA DE COLUMNAS (Índices 1-based para Apps Script)
const COLS = {
  FECHA: 1,
  ID_SOLICITUD: 2,
  RAZON_SOCIAL: 3,
  NIT: 4,
  COMERCIAL: 5,
  CARGUE_INICIAL: 6,      // Detalle archivos comerciales
  CARGUE_RIESGO: 7,       // Detalle archivos riesgo
  APROBACION_CUPO: 8,     // Resultado final / Cupo / Plazo
  CORREO_NOTIF: 9,        // Correos internos (Cartera)
  CORREO_COMERCIAL: 10,   // Nuevo: Correo del Asesor (CC)
  ESTADO: 11,
  LINK_DRIVE: 12,
  ULTIMA_ACTUALIZACION: 13, // Timestamp para control de concurrencia
  EMPRESA: 14,            // NUEVO: Empresa Equitel
  UNIDAD_NEGOCIO: 15      // NUEVO: Unidad de Negocio
};

function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    // Bloqueo estricto: Solo una ejecución a la vez por 30 segundos
    lock.waitLock(30000); 

    if (!e || !e.postData || !e.postData.contents) {
      throw new Error("No payload data received");
    }

    const data = JSON.parse(e.postData.contents);

    // 1. ACCIÓN DE LECTURA (LISTADO GENERAL)
    if (data.action === 'GET_ALL') {
       return getAllApplications();
    }

    // 2. ACCIONES ESPECÍFICAS
    if (data.backendAction) {
      return handleBackendAction(data.backendAction);
    }

    // 3. FLUJO DE CARGA DE ARCHIVOS (SUBIDA)
    if (data.payload) {
      return handleUploadAndLog(data.payload);
    }

    throw new Error("Estructura de payload desconocida");

  } catch (error) {
    console.error("ERROR CRITICO DOPOST: " + error.toString());
    // Retornamos un error JSON estructurado
    const errorStr = error.toString();
    const isStale = errorStr.includes("STALE_DATA");
    
    return ContentService.createTextOutput(JSON.stringify({ 
      success: false, 
      error: errorStr,
      isStaleData: isStale 
    })).setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}

/**
 * RECUPERA TODAS LAS SOLICITUDES DEL SHEET PARA EL FRONTEND
 */
function getAllApplications() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  const lastRow = sheet.getLastRow();
  
  if (lastRow < 2) {
    return ContentService.createTextOutput(JSON.stringify({ success: true, data: [] }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  // Leer todo el rango de datos (fila 2 hasta la última, hasta columna 15)
  const range = sheet.getRange(2, 1, lastRow - 1, 15);
  const values = range.getValues(); 

  // Mapear a objetos JSON ligeros
  const cleanData = values.map(row => ({
    date: row[COLS.FECHA - 1],
    id: row[COLS.ID_SOLICITUD - 1],
    clientName: row[COLS.RAZON_SOCIAL - 1],
    nit: row[COLS.NIT - 1],
    comercialName: row[COLS.COMERCIAL - 1],
    comercialEmail: row[COLS.CORREO_COMERCIAL - 1], 
    status: row[COLS.ESTADO - 1],
    driveUrl: row[COLS.LINK_DRIVE - 1],
    cupoInfo: row[COLS.APROBACION_CUPO - 1],
    lastUpdated: row[COLS.ULTIMA_ACTUALIZACION - 1] ? new Date(row[COLS.ULTIMA_ACTUALIZACION - 1]).getTime() : 0,
    empresa: row[COLS.EMPRESA - 1] || "",
    unidadNegocio: row[COLS.UNIDAD_NEGOCIO - 1] || ""
  })).filter(item => item.id && item.id !== ""); 

  return ContentService.createTextOutput(JSON.stringify({ 
    success: true, 
    data: cleanData.reverse() // Mostrar las más recientes primero
  })).setMimeType(ContentService.MimeType.JSON);
}

/**
 * FUNCIÓN CORE: BUSCA Y ACTUALIZA O CREA NUEVA FILA CON CONTROL DE CONCURRENCIA
 */
function upsertRow(data) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  const lastRow = sheet.getLastRow();
  
  const idsValues = lastRow > 1 ? sheet.getRange(2, COLS.ID_SOLICITUD, lastRow - 1, 1).getValues().flat() : [];
  
  let rowIndex = -1;
  let finalId = data.id;

  // 1. INTENTAR ENCONTRAR LA FILA EXISTENTE
  if (finalId && !finalId.includes('PENDING') && !finalId.includes('TEMP')) {
    const indexFound = idsValues.indexOf(finalId);
    if (indexFound !== -1) {
      rowIndex = indexFound + 2; 
    }
  }

  // 2. SI ES NUEVO -> INSERTAR
  if (rowIndex === -1) {
    const nextSequence = idsValues.length + 1;
    finalId = "SOL-" + ("000000" + nextSequence).slice(-6);
    
    const newRow = new Array(15).fill(""); // Updated size to 15
    
    newRow[COLS.FECHA - 1] = new Date();
    newRow[COLS.ID_SOLICITUD - 1] = finalId;
    newRow[COLS.RAZON_SOCIAL - 1] = data.clientName || "";
    newRow[COLS.NIT - 1] = data.nit || "";
    newRow[COLS.COMERCIAL - 1] = data.comercial || "";
    newRow[COLS.CORREO_COMERCIAL - 1] = data.comercialEmail || "";
    newRow[COLS.LINK_DRIVE - 1] = data.link || "";
    newRow[COLS.ULTIMA_ACTUALIZACION - 1] = new Date(); 
    newRow[COLS.EMPRESA - 1] = data.empresa || "";
    newRow[COLS.UNIDAD_NEGOCIO - 1] = data.unidadNegocio || "";
    
    if (data.initialDetail) newRow[COLS.CARGUE_INICIAL - 1] = data.initialDetail;
    if (data.notifEmail) newRow[COLS.CORREO_NOTIF - 1] = data.notifEmail;
    if (data.estado) newRow[COLS.ESTADO - 1] = data.estado;

    sheet.appendRow(newRow);
    return finalId;
  } 
  
  // 3. SI YA EXISTE -> ACTUALIZAR (CON VALIDACIÓN DE VERSIÓN)
  else {
    // A. OPTIMISTIC LOCKING CHECK
    if (data.expectedVersion) {
       const currentDbTimestamp = sheet.getRange(rowIndex, COLS.ULTIMA_ACTUALIZACION).getValue();
       const dbTime = currentDbTimestamp ? new Date(currentDbTimestamp).getTime() : 0;
       
       const difference = Math.abs(dbTime - data.expectedVersion);
       
       if (dbTime > 0 && dbTime !== data.expectedVersion && difference > 5000) {
           throw new Error("STALE_DATA: El registro ha sido modificado por otro usuario. Por favor actualice la página.");
       }
    }

    // B. APPLY UPDATES
    if (data.riskDetail) sheet.getRange(rowIndex, COLS.CARGUE_RIESGO).setValue(data.riskDetail);
    if (data.cupoDetail) sheet.getRange(rowIndex, COLS.APROBACION_CUPO).setValue(data.cupoDetail);
    if (data.estado) sheet.getRange(rowIndex, COLS.ESTADO).setValue(data.estado);
    if (data.clientName) sheet.getRange(rowIndex, COLS.RAZON_SOCIAL).setValue(data.clientName);
    if (data.comercialEmail) sheet.getRange(rowIndex, COLS.CORREO_COMERCIAL).setValue(data.comercialEmail);
    // Don't usually update Company/Unit after creation, but if provided, update:
    if (data.empresa) sheet.getRange(rowIndex, COLS.EMPRESA).setValue(data.empresa);
    if (data.unidadNegocio) sheet.getRange(rowIndex, COLS.UNIDAD_NEGOCIO).setValue(data.unidadNegocio);
    
    // C. UPDATE TIMESTAMP
    sheet.getRange(rowIndex, COLS.ULTIMA_ACTUALIZACION).setValue(new Date());
    
    return finalId;
  }
}

function handleUploadAndLog(payload) {
    const datosCliente = payload.datosCliente || {};
    const archivos = payload.archivos || [];
    const validacion = payload.validation || {};
    const notificationType = payload.notificationType || 'COMERCIAL_UPLOAD';
    
    let carpetaCliente;
    if (payload.targetFolderId) {
       try { carpetaCliente = DriveApp.getFolderById(payload.targetFolderId); } catch (e) {}
    }

    if (!carpetaCliente) {
      const carpetaRaiz = DriveApp.getFolderById(ID_CARPETA_RAIZ);
      const now = new Date();
      const fechaFormato = Utilities.formatDate(now, "GMT-5", "yyyy-MM-dd HH:mm");
      const nombreClienteSeguro = datosCliente.clientName || "CLIENTE";
      const nombreCarpeta = `${datosCliente.id || "NUEVO"} - ${nombreClienteSeguro} - ${fechaFormato}`;
      carpetaCliente = carpetaRaiz.createFolder(nombreCarpeta);
      carpetaCliente.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    }

    if (archivos.length > 0) {
      archivos.forEach(archivo => {
        if (archivo.fileContent) {
          try {
            const blob = Utilities.newBlob(Utilities.base64Decode(archivo.fileContent), archivo.mimeType, archivo.nombre);
            carpetaCliente.createFile(blob);
          } catch (errArch) {}
        }
      });
    }

    let upsertData = {
      id: datosCliente.id,
      clientName: datosCliente.clientName,
      nit: datosCliente.nit,
      comercial: datosCliente.comercialNombre,
      comercialEmail: datosCliente.comercialEmail,
      empresa: datosCliente.empresa, // Guardar
      unidadNegocio: datosCliente.unidadNegocio, // Guardar
      link: carpetaCliente.getUrl(),
      estado: "PENDIENTE",
      expectedVersion: datosCliente.lastUpdated 
    };

    if (notificationType === 'COMERCIAL_UPLOAD') {
       upsertData.estado = 'PENDIENTE_CARTERA';
       upsertData.initialDetail = `${archivos.length} archivos comerciales cargados`;
       upsertData.notifEmail = EMAILS_NOTIFICACION; 
    } else if (notificationType === 'RIESGO_UPLOAD') {
       upsertData.estado = 'PENDIENTE_DIRECTOR';
       upsertData.riskDetail = `${archivos.length} reportes riesgo cargados`;
       upsertData.notifEmail = EMAILS_NOTIFICACION; 
    }

    const finalId = upsertRow(upsertData);

    if ((!datosCliente.id || datosCliente.id.includes('PENDING')) && carpetaCliente) {
       try {
         const oldName = carpetaCliente.getName();
         if (oldName.includes('NUEVO') || oldName.includes('PENDING') || oldName.includes('SOL-PENDING')) {
            carpetaCliente.setName(oldName.replace(/NUEVO|SOL-PENDING|PENDING/g, finalId));
         }
       } catch(e) {}
    }

    const clienteConId = { ...datosCliente, id: finalId };
    try {
      if (notificationType === 'RIESGO_UPLOAD') {
         enviarCorreoRiesgo(clienteConId, carpetaCliente.getUrl(), archivos.length);
      } else {
         enviarCorreoComercial(clienteConId, carpetaCliente.getUrl(), archivos.length, validacion);
      }
    } catch (mailErr) {}

    return ContentService.createTextOutput(JSON.stringify({ 
      success: true, 
      assignedId: finalId, 
      folderId: carpetaCliente.getId(), 
      urlCarpeta: carpetaCliente.getUrl(),
      mensaje: "Proceso completado"
    })).setMimeType(ContentService.MimeType.JSON);
}

function handleBackendAction(data) {
  const result = { success: false, message: '' };
  
  try {
    if (data.action === 'UPDATE_SHEET') {
       if (data.logData) {
        upsertRow({
          id: data.logData.clientId,
          clientName: data.logData.clientName, 
          cupoDetail: data.logData.detalle,   
          estado: data.logData.estado,
          expectedVersion: data.logData.lastUpdated 
        });
      }
      result.success = true;
      result.message = "Sheet actualizado";
    }

    else if (data.action === 'SAVE_REPORT') {
      let folder;
      if (data.folderId) { try { folder = DriveApp.getFolderById(data.folderId); } catch(e) {} }
      if (!folder && data.folderUrl) {
        const idMatch = data.folderUrl.match(/[-\w]{25,}/);
        if (idMatch) { try { folder = DriveApp.getFolderById(idMatch[0]); } catch(e) {} }
      }
      if (!folder) { try { folder = DriveApp.getFolderById(ID_CARPETA_RAIZ); } catch(e) { folder = DriveApp.getRootFolder(); } }
      
      const blob = Utilities.newBlob(data.htmlContent, MimeType.HTML, "temp.html");
      const pdf = blob.getAs(MimeType.PDF).setName(data.fileName || "Reporte.pdf");
      const file = folder.createFile(pdf);
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      result.success = true;
      result.message = file.getUrl();
    } 
    
    else if (data.action === 'SEND_EMAIL') {
      const { to, subject, body } = data.emailData;
      // Enviamos correo y agregamos CC si tenemos log data con el comercial
      // NOTA: Para el correo final al cliente, no siempre copiamos al comercial, pero si se desea, se puede agregar aquí.
      MailApp.sendEmail({
        to: to,
        subject: subject,
        htmlBody: body,
        name: "Organización Equitel - Crédito y Cartera"
      });
      
      if (data.logData) {
        upsertRow({
          id: data.logData.clientId,
          clientName: data.logData.clientName, 
          cupoDetail: data.logData.detalle,   
          // clientEmail: to, // No sobreescribimos la columna 10 que ahora es para el Comercial
          estado: data.logData.estado          
        });
      }
      result.success = true;
      result.message = "Enviado correctamente";
    }
    
    else if (data.action === 'SAVE_STATE') {
       const folderUrl = data.folderUrl;
       const jsonData = data.jsonData; 
       let folder;
       if (folderUrl) {
          const idMatch = folderUrl.match(/[-\w]{25,}/);
          if (idMatch) { try { folder = DriveApp.getFolderById(idMatch[0]); } catch(e) {} }
       }
       if (folder) {
          const fileName = "estefania_data.json";
          const files = folder.getFilesByName(fileName);
          if (files.hasNext()) {
             const file = files.next();
             file.setContent(jsonData);
          } else {
             folder.createFile(fileName, jsonData, MimeType.PLAIN_TEXT);
          }
          result.success = true;
          result.message = "Estado guardado en Drive";
       } else {
          throw new Error("Carpeta no encontrada para guardar estado");
       }
    }

    else if (data.action === 'LOAD_STATE') {
       const folderUrl = data.folderUrl;
       let folder;
       if (folderUrl) {
          const idMatch = folderUrl.match(/[-\w]{25,}/);
          if (idMatch) { try { folder = DriveApp.getFolderById(idMatch[0]); } catch(e) {} }
       }
       if (folder) {
          const files = folder.getFilesByName("estefania_data.json");
          if (files.hasNext()) {
             const file = files.next();
             result.jsonContent = file.getBlob().getDataAsString();
             result.success = true;
          } else {
             result.success = false;
             result.message = "No existe archivo de datos previos";
          }
       } else {
          result.success = false;
          result.message = "Carpeta inválida";
       }
    }

    else if (data.action === 'FETCH_FILES_FOR_AI') {
       const folderId = data.folderId;
       const fetchedFiles = [];
       if (folderId) {
          try {
             const folder = DriveApp.getFolderById(folderId);
             const files = folder.getFiles();
             while (files.hasNext()) {
                const file = files.next();
                const name = file.getName().toUpperCase();
                const mimeType = file.getMimeType();
                const size = file.getSize();
                if (size < 6000000 && ( 
                    name.includes("ESTADOS") || 
                    name.includes("RENTA") || 
                    name.includes("BANCARIA") ||
                    name.includes("COMERCIAL")
                )) {
                   fetchedFiles.push({
                      name: name,
                      mimeType: mimeType,
                      data: Utilities.base64Encode(file.getBlob().getBytes())
                   });
                }
             }
             result.success = true;
             result.files = fetchedFiles;
          } catch(e) {
             result.success = false;
             result.message = "Error leyendo archivos de Drive: " + e.toString();
          }
       } else {
          result.success = false;
          result.message = "No Folder ID provided";
       }
    }

    else if (data.action === 'UPDATE_PIN') {
       const props = PropertiesService.getScriptProperties();
       props.setProperty('DIRECTOR_PIN', data.newPin);
       result.success = true;
       result.message = "PIN actualizado en servidor";
    }

    else if (data.action === 'CHECK_PIN') {
       const props = PropertiesService.getScriptProperties();
       const stored = props.getProperty('DIRECTOR_PIN') || '442502';
       result.success = (String(data.pin) === String(stored));
    }
    
  } catch (err) {
    result.error = err.toString();
    if (err.toString().includes("STALE_DATA")) {
        result.isStaleData = true;
    }
  }
  
  return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
}

function getActionButtonsHtml(linkDrive) {
  return `
    <div style="text-align: center; margin-top: 25px; margin-bottom: 25px;">
       <table width="100%" cellspacing="0" cellpadding="0">
         <tr>
           <td align="center">
             <a href="${linkDrive}" style="background-color: #333333; color: #ffffff; padding: 14px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 14px; display: inline-block; mso-padding-alt:0; margin: 5px;">
               <!--[if mso]><i style="letter-spacing: 25px; mso-font-width: -100%; mso-text-raise: 30pt">&nbsp;</i><![endif]-->
               <span style="mso-text-raise: 15pt;">📂 Ver Carpeta Drive</span>
               <!--[if mso]><i style="letter-spacing: 25px; mso-font-width: -100%">&nbsp;</i><![endif]-->
             </a>
             <a href="${LINK_APP}" style="background-color: #DA291C; color: #ffffff; padding: 14px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 14px; display: inline-block; mso-padding-alt:0; margin: 5px;">
               <!--[if mso]><i style="letter-spacing: 25px; mso-font-width: -100%; mso-text-raise: 30pt">&nbsp;</i><![endif]-->
               <span style="mso-text-raise: 15pt;">📱 Gestionar en App</span>
               <!--[if mso]><i style="letter-spacing: 25px; mso-font-width: -100%">&nbsp;</i><![endif]-->
             </a>
           </td>
         </tr>
       </table>
    </div>
  `;
}

function enviarCorreoComercial(cliente, linkDrive, numArchivos, validacion) {
  const nombreCliente = cliente.clientName || "Cliente Nuevo";
  const radicado = cliente.id || "PENDIENTE";
  const asunto = `Nueva Solicitud Crédito [${radicado}]: ${nombreCliente}`;
  
  // LOGIC CHANGE: CC to Commercial Email
  const ccEmail = cliente.comercialEmail || "";

  let checklistHtml = "";
  if (validacion && validacion.results) {
    checklistHtml += `<ul style="list-style: none; padding: 0; margin: 0;">`;
    validacion.results.forEach(doc => {
      const color = doc.isValid ? "#108043" : "#d32f2f";
      const icon = doc.isValid ? "✅" : "❌";
      checklistHtml += `
        <li style="padding: 8px 0; border-bottom: 1px solid #f0f0f0; font-size: 13px;">
          <span style="margin-right: 8px;">${icon}</span>
          <strong style="color: #333;">${doc.fileName}</strong>
          <span style="color: ${color}; float: right;">${doc.isValid ? "OK" : "Revisar"}</span>
        </li>`;
    });
    checklistHtml += `</ul>`;
  }

  const htmlBody = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #f4f4f4; margin: 0; padding: 0; }
        .container { max-width: 600px; margin: 20px auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
        .header { background-color: #DA291C; padding: 30px 20px; text-align: center; color: white; }
        .content { padding: 30px; }
        .card { background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin-bottom: 20px; }
        .label { font-size: 10px; text-transform: uppercase; letter-spacing: 1px; color: #6b7280; font-weight: bold; margin-bottom: 4px; display: block; }
        .value { font-size: 16px; color: #111827; font-weight: bold; margin: 0; }
        .footer { background-color: #f9fafb; padding: 20px; text-align: center; color: #9ca3af; font-size: 12px; border-top: 1px solid #e5e7eb; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
           <h1 style="margin: 0; font-size: 24px; font-weight: 900; letter-spacing: -0.5px;">ESTEFANÍA 2.0</h1>
           <p style="margin: 5px 0 0 0; opacity: 0.9; font-size: 14px;">Solicitud Comercial #${radicado}</p>
        </div>
        <div class="content">
          <div class="card">
             <div style="margin-bottom: 15px;">
               <span class="label">CLIENTE</span>
               <p class="value">${nombreCliente}</p>
             </div>
             <div style="margin-bottom: 15px;">
               <span class="label">NIT</span>
               <p class="value">${cliente.nit}</p>
             </div>
             <div>
               <span class="label">SOLICITANTE</span>
               <p class="value">${cliente.comercialNombre}</p>
             </div>
          </div>
          
          <div class="card" style="background-color: #ffffff; border-color: #e5e7eb;">
             <span class="label" style="margin-bottom: 10px; display: block;">Checklist Documental (IA)</span>
             ${checklistHtml}
          </div>
          
          ${getActionButtonsHtml(linkDrive)}
        </div>
        <div class="footer">
           &copy; 2025 Organización Equitel S.A. <br>Sistema Automático de Crédito y Cartera
        </div>
      </div>
    </body>
    </html>
  `;

  // Send with CC to commercial
  MailApp.sendEmail({ 
    to: EMAILS_NOTIFICACION, 
    cc: ccEmail,
    subject: asunto, 
    htmlBody: htmlBody 
  });
}

function enviarCorreoRiesgo(cliente, linkDrive, numArchivos) {
  const nombreCliente = cliente.clientName || "Cliente";
  const radicado = cliente.id || "N/A";
  const asunto = `⚠️ Actualización Riesgo [${radicado}]: ${nombreCliente}`;
  
  // LOGIC CHANGE: CC to Commercial Email
  const ccEmail = cliente.comercialEmail || "";

  const htmlBody = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #f4f4f4; margin: 0; padding: 0; }
        .container { max-width: 600px; margin: 20px auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
        .header { background-color: #0f172a; padding: 30px 20px; text-align: center; color: white; }
        .content { padding: 30px; }
        .card { background-color: #eff6ff; border: 1px solid #dbeafe; border-radius: 8px; padding: 20px; margin-bottom: 20px; }
        .label { font-size: 10px; text-transform: uppercase; letter-spacing: 1px; color: #64748b; font-weight: bold; margin-bottom: 4px; display: block; }
        .value { font-size: 16px; color: #1e293b; font-weight: bold; margin: 0; }
        .footer { background-color: #f9fafb; padding: 20px; text-align: center; color: #9ca3af; font-size: 12px; border-top: 1px solid #e5e7eb; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
           <h1 style="margin: 0; font-size: 24px; font-weight: 900; letter-spacing: -0.5px;">ESTEFANÍA 2.0</h1>
           <p style="margin: 5px 0 0 0; opacity: 0.9; font-size: 14px;">Expediente Listo para Análisis</p>
        </div>
        <div class="content">
          <p style="font-size: 15px; line-height: 1.5; color: #374151; text-align: center; margin-bottom: 25px;">
            El equipo de Cartera ha completado la carga de centrales de riesgo.<br>
            El análisis financiero de IA se ha ejecutado exitosamente.
          </p>
        
          <div class="card">
             <div style="margin-bottom: 15px;">
               <span class="label">CLIENTE</span>
               <p class="value">${nombreCliente}</p>
             </div>
             <div>
               <span class="label">ESTADO ACTUAL</span>
               <p class="value" style="color: #2563eb;">PENDIENTE DIRECTOR</p>
             </div>
          </div>
          
          ${getActionButtonsHtml(linkDrive)}
        </div>
        <div class="footer">
           &copy; 2025 Organización Equitel S.A. <br>Sistema Automático de Crédito y Cartera
        </div>
      </div>
    </body>
    </html>
  `;

  // Send with CC to commercial
  MailApp.sendEmail({ 
    to: EMAILS_NOTIFICACION, 
    cc: ccEmail,
    subject: asunto, 
    htmlBody: htmlBody 
  });
}
