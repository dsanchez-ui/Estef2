
import { CreditAnalysis, FinancialIndicators } from '../types';
import { formatCOP, formatPercent, numberToLetters } from './calculations';

// Optimized CSS for Single Page Fitting (A4/Letter)
const BASE_STYLES = `
  <style>
    body { font-family: 'Helvetica', 'Arial', sans-serif; padding: 25px; color: #1a1a1a; line-height: 1.3; font-size: 11px; }
    .header { display: flex; justify-content: space-between; border-bottom: 3px solid #DA291C; padding-bottom: 10px; margin-bottom: 15px; }
    .logo-text { font-size: 20px; font-weight: 900; letter-spacing: 0.1em; color: #000; }
    .sub-text { font-size: 9px; font-weight: bold; color: #64748b; text-transform: uppercase; }
    
    .section-title { font-size: 12px; font-weight: 900; text-transform: uppercase; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; margin-top: 15px; margin-bottom: 8px; color: #0f172a; }
    
    .info-box { background-color: #f8fafc; padding: 12px; border-radius: 8px; border: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; }
    .info-label { font-size: 9px; font-weight: 900; text-transform: uppercase; color: #94a3b8; margin-bottom: 2px; display: block; }
    .info-value { font-size: 14px; font-weight: 900; color: #0f172a; }
    
    table { width: 100%; border-collapse: collapse; font-size: 10px; }
    th { background-color: #f1f5f9; padding: 4px 6px; text-align: left; font-weight: bold; color: #475569; text-transform: uppercase; font-size: 9px; }
    td { padding: 4px 6px; border-bottom: 1px solid #f1f5f9; color: #334155; }
    
    .text-right { text-align: right; }
    .font-bold { font-weight: bold; }
    
    .approval-box { margin-top: 25px; padding-top: 15px; border-top: 1px dashed #cbd5e1; }
    .big-amount { font-size: 24px; font-weight: 900; color: #000; }
    .amount-text { font-size: 10px; font-weight: bold; color: #64748b; text-transform: uppercase; }
    
    .page-break { page-break-before: always; }
    
    /* Utility for Welcome Letter compact lists */
    ul.compact-list { padding-left: 20px; margin: 5px 0; }
    ul.compact-list li { margin-bottom: 3px; }
    
    p { margin: 6px 0; }
  </style>
`;

export const generateWelcomeLetterHTML = (analysis: CreditAnalysis) => {
  const date = new Date().toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric' });
  const cupo = analysis.assignedCupo || 0;
  
  // Use selected company or default to Grupo Equitel
  const senderCompany = analysis.empresa || "Grupo Equitel";
  
  return `
    <html>
    <head>${BASE_STYLES}</head>
    <body>
    <div style="font-family: Arial, sans-serif; color: #333; line-height: 1.4; max-width: 800px; width: 100%;">
      <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:20px;">
         <div>
            <div style="font-size: 20px; font-weight: 900; letter-spacing: -0.5px;">EQUITEL</div>
            <div style="font-size: 9px; color: #666;">${senderCompany}</div>
         </div>
         <div style="text-align:right; font-size: 11px;">
            <strong>Bogotá, ${date}</strong>
         </div>
      </div>
      
      <p style="margin-bottom: 15px;">Señores<br>
      <strong>${analysis.clientName}</strong><br>
      <span style="font-size:10px; color:#555;">NIT: ${analysis.nit}</span></p>
      
      <p style="font-weight:bold; font-size:12px;">Asunto: Confirmación de Cupo de Crédito.</p>
      
      <p>Estimados señores:</p>
      
      <p>Para <strong>${senderCompany}</strong> es un gusto darles la bienvenida. Nos entusiasma ratificar nuestras condiciones comerciales y contar con aliados como ustedes para construir una relación sólida enfocada en el crecimiento mutuo.</p>
      
      <p>Queremos ser el respaldo que su operación necesita. Por ello, ponemos a su disposición toda nuestra asesoría técnica y el portafolio de nuestra división.</p>
      
      <div style="background-color: #f8fafc; padding: 15px; border-left: 4px solid #DA291C; margin: 15px 0; border-radius: 4px;">
        <table style="width: auto;">
            <tr>
                <td style="border:none; padding: 2px 15px 2px 0;"><strong>• Cupo Aprobado:</strong></td>
                <td style="border:none; padding: 2px 0;">${formatCOP(cupo)} (${numberToLetters(cupo)})</td>
            </tr>
            <tr>
                <td style="border:none; padding: 2px 15px 2px 0;"><strong>• Plazo de Pago:</strong></td>
                <td style="border:none; padding: 2px 0;">${analysis.assignedPlazo || analysis.cupo?.plazoRecomendado} días.</td>
            </tr>
        </table>
      </div>
      
      <p><strong>Guía para una operación exitosa:</strong></p>
      <ul class="compact-list" style="font-size: 11px;">
        <li><strong>Pedidos:</strong> Gestionar todo pedido mediante Orden de Compra enviada a su asesor comercial.</li>
        <li><strong>Logística:</strong>
            <br>&nbsp;- <em>En Mosquera:</em> Presentar sello de compañía y autorización al retirar.
            <br>&nbsp;- <em>Fuera de Bogotá:</em> Firmar y sellar la factura al recibir la mercancía.
        </li>
        <li><strong>Pagos:</strong> Notificar soportes a <strong>recaudos@equitel.com.co</strong>.</li>
      </ul>
      
      <p style="margin-top: 15px;">Quedamos a su entera disposición. Gracias por confiar en nosotros.</p>
      
      <div style="margin-top: 30px;">
          <p>Cordialmente,</p>
          <br>
          <p><strong>Director Nacional de Cartera</strong><br>
          <span style="font-size:10px; color:#555;">Organización Equitel S.A.</span></p>
      </div>
    </div>
    </body>
    </html>
  `;
};

export const generateRejectionEmailText = (analysis: CreditAnalysis) => {
  const reason = analysis.rejectionReason || "Políticas internas de riesgo crediticio.";
  
  return `Buen día,

De acuerdo a su solicitud de crédito para la empresa ${analysis.clientName} (${analysis.nit}), nos permitimos informarle que, tras el análisis financiero y consulta en centrales de riesgo, lamentablemente la solicitud **NO reúne los requerimientos y parámetros** actuales de nuestra empresa para otorgar cupo de crédito directo.

**Detalle de la decisión:**
${reason}

**Recomendación:**
Se recomienda continuar trabajando de contado por los próximos 12 meses y evaluar nuevamente el cupo en el siguiente periodo fiscal, o apoyarse en financiamiento con cheques avalados (ASODATOS/COVINOC).

Cordialmente,

Departamento de Cartera
Organización Equitel S.A.`;
};

export const generateCreditReportHTML = (analysis: CreditAnalysis, manualCupo: number, manualPlazo: number) => {
    const date = new Date().toLocaleDateString();
    const ind = analysis.indicators || {} as FinancialIndicators;
    
    const row = (label: string, value: string) => `<tr><td>${label}</td><td class="text-right font-bold">${value}</td></tr>`;

    // Determine Z-Altman health text
    let zAltmanStatus = "N/A";
    if (ind.zAltman) {
        if (ind.zAltman > 2.99) zAltmanStatus = "Zona Segura (Bajo Riesgo)";
        else if (ind.zAltman > 1.81) zAltmanStatus = "Zona Gris (Riesgo Moderado)";
        else zAltmanStatus = "Zona Alerta (Alto Riesgo)";
    }

    return `
    <html>
    <head>${BASE_STYLES}</head>
    <body>
        <div class="header">
            <div>
                <div class="logo-text">EQUITEL</div>
                <div class="sub-text">Organización Equitel S.A.</div>
            </div>
            <div style="text-align: right;">
                <div class="sub-text">Referencia</div>
                <div style="font-weight: bold; font-size:12px;">${analysis.id}</div>
                <div class="sub-text" style="margin-top: 2px;">Fecha</div>
                <div style="font-weight: bold; font-size:12px;">${date}</div>
            </div>
        </div>

        <div style="text-align: center; margin-bottom: 15px;">
            <h1 style="font-size: 16px; margin: 0; text-transform: uppercase; letter-spacing: 1px;">Informe de Crédito</h1>
        </div>

        <div class="info-box">
            <div>
                <span class="info-label">Razón Social</span>
                <span class="info-value" style="font-size: 14px;">${analysis.clientName}</span>
                <span class="info-label" style="margin-top:5px;">Empresa Equitel</span>
                <span class="info-value" style="font-size: 11px;">${analysis.empresa || "N/A"}</span>
            </div>
            <div style="text-align: right;">
                <span class="info-label">NIT</span>
                <span class="info-value" style="font-size: 14px;">${analysis.nit}</span>
                <span class="info-label" style="margin-top:5px;">Unidad de Negocio</span>
                <span class="info-value" style="font-size: 11px;">${analysis.unidadNegocio || "N/A"}</span>
            </div>
        </div>

        <div class="section-title">1. Indicadores Financieros</div>
        
        <div style="display: flex; gap: 15px; margin-bottom: 10px;">
            <!-- Liquidez -->
            <div style="flex: 1;">
                <div style="background:#f1f5f9; font-weight:bold; font-size:9px; padding:2px 5px; margin-bottom:2px;">LIQUIDEZ</div>
                <table>
                    ${row("Razón Corriente", ind.razonCorriente?.toFixed(2))}
                    ${row("Prueba Ácida", ind.pruebaAcida?.toFixed(2))}
                    ${row("Capital Trabajo", formatCOP(ind.knt || 0))}
                </table>
            </div>
            <!-- Endeudamiento -->
            <div style="flex: 1;">
                <div style="background:#f1f5f9; font-weight:bold; font-size:9px; padding:2px 5px; margin-bottom:2px;">ENDEUDAMIENTO</div>
                <table>
                    ${row("Nivel Global", formatPercent(ind.endeudamientoGlobal || 0))}
                    ${row("Corto Plazo", formatPercent(ind.endeudamientoCP || 0))}
                    ${row("Solvencia", formatPercent(ind.solvencia || 0))}
                </table>
            </div>
        </div>

        <div style="display: flex; gap: 15px;">
            <!-- Rentabilidad -->
            <div style="flex: 1;">
                <div style="background:#f1f5f9; font-weight:bold; font-size:9px; padding:2px 5px; margin-bottom:2px;">RENTABILIDAD</div>
                <table>
                    ${row("ROA", formatPercent(ind.roa || 0))}
                    ${row("ROE", formatPercent(ind.roe || 0))}
                    ${row("Margen Neto", formatPercent(ind.margenNeto || 0))}
                </table>
            </div>
            <!-- Eficiencia -->
            <div style="flex: 1;">
                <div style="background:#f1f5f9; font-weight:bold; font-size:9px; padding:2px 5px; margin-bottom:2px;">EFICIENCIA</div>
                <table>
                    ${row("EBITDA", formatCOP(ind.ebitda || 0))}
                    ${row("Ciclo Operacional", (ind.cicloOperacional?.toFixed(0) || 0) + " días")}
                    ${row("Días Cartera", (ind.diasCartera?.toFixed(0) || 0) + " días")}
                </table>
            </div>
        </div>

        <!-- NEW RISK SECTION FOR PDF -->
        <div class="section-title">2. Análisis de Riesgo (Z-Altman)</div>
        <div class="info-box" style="background-color: #f0fdf4; border-color: #bbf7d0;">
            <div>
                <span class="info-label">Z-Altman Score</span>
                <span class="info-value" style="font-size: 18px; color: #166534;">${ind.zAltman?.toFixed(2) || "N/A"}</span>
            </div>
            <div style="text-align: right;">
                <span class="info-label">Interpretación</span>
                <span class="info-value" style="font-size: 12px; color: #166534;">${zAltmanStatus}</span>
            </div>
        </div>

        <div class="section-title">3. Cálculo de Cupo Sugerido (IA)</div>
        <table>
            <thead>
                <tr><th>Variable</th><th class="text-right">Valor</th></tr>
            </thead>
            <tbody>
                ${row("Cupo Conservador (40-50%)", formatCOP(analysis.cupo?.cupoConservador || 0))}
                ${row("Cupo Liberal (60-80%)", formatCOP(analysis.cupo?.cupoLiberal || 0))}
                <tr style="background-color: #f8fafc;">
                    <td style="font-weight:bold;">Promedio 6 Variables</td>
                    <td class="text-right font-bold" style="color:#DA291C;">${formatCOP(analysis.cupo?.resultadoPromedio || 0)}</td>
                </tr>
            </tbody>
        </table>

        <div class="section-title">4. Dictamen Final</div>
        
        <div class="approval-box">
             <div style="display: flex; justify-content: space-between; align-items: flex-end;">
                <div>
                    <span class="info-label">Cupo Aprobado</span>
                    <div class="big-amount">${formatCOP(manualCupo)}</div>
                    <div class="amount-text">${numberToLetters(manualCupo)}</div>
                </div>
                <div style="text-align: right;">
                    <div style="border-bottom: 1px solid #000; width: 180px; margin-bottom: 5px;"></div>
                    <div style="font-weight: bold; font-size: 10px; text-transform: uppercase;">John Deyver Campos</div>
                    <div class="info-label">Director Nacional de Cartera</div>
                </div>
             </div>
             
             <div style="margin-top: 15px;">
                <span class="info-label">Plazo de Pago</span>
                <span class="info-value" style="font-size:16px;">${manualPlazo} Días</span>
             </div>
        </div>
    </body>
    </html>
    `;
};
