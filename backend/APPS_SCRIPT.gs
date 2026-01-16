
/**
 * ==========================================
 * ESTEFANÍA 2.0 - BACKEND GOOGLE APPS SCRIPT
 * MODO: UPSERT (ACTUALIZAR O INSERTAR) + NOTIFICACIONES AVANZADAS
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
  CORREO_NOTIF: 9,        // Correos internos
  CORREO_CLIENTE: 10,     // Correo externo (cliente final)
  ESTADO: 11,
  LINK_DRIVE: 12
};

function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000); 

    if (!e || !e.postData || !e.postData.contents) {
      throw new Error("No payload data received");
    }

    const data = JSON.parse(e.postData.contents);

    if (data.backendAction) {
      return handleBackendAction(data.backendAction);
    }

    if (data.payload) {
      return handleUploadAndLog(data.payload);
    }

    throw new Error("Estructura de payload desconocida");

  } catch (error) {
    console.error("ERROR CRITICO DOPOST: " + error.toString());
    return ContentService.createTextOutput(JSON.stringify({ 
      success: false, 
      error: error.toString() 
    })).setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}

/**
 * FUNCIÓN CORE: BUSCA Y ACTUALIZA O CREA NUEVA FILA
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
    
    const newRow = new Array(12).fill(""); 
    
    newRow[COLS.FECHA - 1] = new Date();
    newRow[COLS.ID_SOLICITUD - 1] = finalId;
    newRow[COLS.RAZON_SOCIAL - 1] = data.clientName || "";
    newRow[COLS.NIT - 1] = data.nit || "";
    newRow[COLS.COMERCIAL - 1] = data.comercial || "";
    newRow[COLS.LINK_DRIVE - 1] = data.link || "";
    
    if (data.initialDetail) newRow[COLS.CARGUE_INICIAL - 1] = data.initialDetail;
    if (data.notifEmail) newRow[COLS.CORREO_NOTIF - 1] = data.notifEmail;
    if (data.estado) newRow[COLS.ESTADO - 1] = data.estado;

    sheet.appendRow(newRow);
    return finalId;
  } 
  
  // 3. SI YA EXISTE -> ACTUALIZAR
  else {
    if (data.riskDetail) sheet.getRange(rowIndex, COLS.CARGUE_RIESGO).setValue(data.riskDetail);
    if (data.cupoDetail) sheet.getRange(rowIndex, COLS.APROBACION_CUPO).setValue(data.cupoDetail);
    if (data.notifEmail) sheet.getRange(rowIndex, COLS.CORREO_NOTIF).setValue(data.notifEmail);
    if (data.clientEmail) sheet.getRange(rowIndex, COLS.CORREO_CLIENTE).setValue(data.clientEmail);
    if (data.estado) sheet.getRange(rowIndex, COLS.ESTADO).setValue(data.estado);
    if (data.clientName) sheet.getRange(rowIndex, COLS.RAZON_SOCIAL).setValue(data.clientName);
    
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
      link: carpetaCliente.getUrl(),
      estado: "PENDIENTE"
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
    if (data.action === 'SAVE_REPORT') {
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
          clientEmail: to,                    
          estado: data.logData.estado          
        });
      }
      result.success = true;
      result.message = "Enviado correctamente";
    }

    // NUEVA ACCIÓN: ACTUALIZAR SOLO EL SHEETS (Para el botón Aprobar/Negar)
    else if (data.action === 'UPDATE_SHEET') {
       if (data.logData) {
        upsertRow({
          id: data.logData.clientId,
          clientName: data.logData.clientName, 
          cupoDetail: data.logData.detalle,   
          estado: data.logData.estado          
        });
      }
      result.success = true;
      result.message = "Sheet actualizado";
    }
    
  } catch (err) {
    result.error = err.toString();
  }
  
  return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
}

// ---- PLANTILLAS INTERNAS PREMIUM (CSS INLINED) ----
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

  MailApp.sendEmail({ to: EMAILS_NOTIFICACION, subject: asunto, htmlBody: htmlBody });
}

function enviarCorreoRiesgo(cliente, linkDrive, numArchivos) {
  const nombreCliente = cliente.clientName || "Cliente";
  const radicado = cliente.id || "N/A";
  const asunto = `⚠️ Actualización Riesgo [${radicado}]: ${nombreCliente}`;

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

  MailApp.sendEmail({ to: EMAILS_NOTIFICACION, subject: asunto, htmlBody: htmlBody });
}
