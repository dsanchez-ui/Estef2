
import { CreditAnalysis } from '../types';
import { formatCOP, numberToLetters } from './calculations';

export const generateWelcomeLetterHTML = (analysis: CreditAnalysis) => {
  const date = new Date().toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric' });
  const cupo = analysis.assignedCupo || 0;
  
  // Adjusted styling: Removed padding: 40px and margin: 0 auto;
  return `
    <div style="font-family: Arial, sans-serif; color: #333; line-height: 1.6; max-width: 800px; width: 100%;">
      <p><strong>Bogotá, ${date}</strong></p>
      
      <p>Señores<br>
      <strong>${analysis.clientName}</strong><br>
      Departamento de Compras</p>
      
      <p><strong>Asunto: ¡Bienvenidos a Grupo Equitel! Confirmación de Cupo de Crédito.</strong></p>
      
      <p>Estimados señores:</p>
      
      <p>Para <strong>Grupo Equitel</strong> es un verdadero gusto darles la bienvenida. Nos entusiasma ratificar nuestras condiciones comerciales y contar con aliados como ustedes, con quienes esperamos construir una relación sólida enfocada en el crecimiento mutuo, el desarrollo y la productividad.</p>
      
      <p>Queremos ser el respaldo que su operación necesita. Por ello, ponemos a su disposición toda nuestra asesoría técnica y el portafolio de nuestra división <strong>POTENCIA</strong>.</p>
      
      <p>Para facilitar su operatividad, nos complace confirmar la aprobación de su cupo de crédito bajo las siguientes condiciones:</p>
      
      <ul style="background-color: #f9f9f9; padding: 20px; border-left: 4px solid #DA291C; list-style-type: none;">
        <li><strong>• Cupo Aprobado:</strong> ${formatCOP(cupo)} (${numberToLetters(cupo)})</li>
        <li><strong>• Plazo de Pago:</strong> ${analysis.cupo.plazoRecomendado} días.</li>
      </ul>
      
      <p><strong>Guía para una operación exitosa:</strong> Para asegurar que nuestros procesos fluyan con agilidad, les compartimos estos puntos clave para el manejo de su cuenta:</p>
      
      <ol>
        <li><strong>Pedidos:</strong> Agradecemos gestionar todo pedido mediante una Orden de Compra, enviándola a su contacto comercial.</li>
        <li><strong>Logística de Entrega:</strong>
          <ul>
            <li><em>En Mosquera:</em> Al retirar mercancía, es indispensable presentar el sello de su compañía y autorización.</li>
            <li><em>Fuera de Bogotá:</em> Agradecemos firmar y sellar la copia de la factura al recibir.</li>
          </ul>
        </li>
        <li><strong>Pagos:</strong> Pueden notificar sus pagos a <strong>recaudos@equitel.com.co</strong>.</li>
      </ol>
      
      <p>Quedamos a su entera disposición. Gracias por confiar en nosotros.</p>
      
      <br>
      <p>Cordialmente,</p>
      <br>
      <p><strong>Director Nacional de Cartera</strong><br>
      Organización Equitel S.A.</p>
    </div>
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
