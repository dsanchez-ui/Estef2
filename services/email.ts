
/**
 * Internal Email Service Simulation.
 * Since browsers cannot send SMTP emails directly without a backend (Node.js/Python) or 3rd party API (EmailJS/SendGrid),
 * this service simulates the success of the operation to allow flow testing.
 */

export const sendEmail = async (to: string, subject: string, htmlBody: string): Promise<boolean> => {
  // Simulating network latency
  await new Promise(resolve => setTimeout(resolve, 1000));

  console.group('%c📨 SIMULACIÓN DE ENVÍO DE CORREO', 'color: #DA291C; font-weight: bold; font-size: 14px;');
  console.log(`%cDestinatario:`, 'font-weight: bold;', to);
  console.log(`%cAsunto:`, 'font-weight: bold;', subject);
  
  // Convert HTML to simple text for preview
  const previewText = htmlBody.replace(/<[^>]*>?/gm, '').substring(0, 150) + '...';
  console.log(`%cCuerpo (Preview):`, 'font-weight: bold;', previewText);
  console.groupEnd();

  // In a real frontend-only app, you would integrate EmailJS here:
  // await emailjs.send('service_id', 'template_id', { to, subject, body });

  // Return true to simulate success so the UI flow continues
  return true;
};
