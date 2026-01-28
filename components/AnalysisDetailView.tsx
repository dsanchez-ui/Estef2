
import React, { useState, useEffect } from 'react';
import { CreditAnalysis, FinancialIndicators, UserRole } from '../types';
import { formatCOP, formatPercent, numberToLetters } from '../utils/calculations';
import { exportToDriveAndNotify } from '../services/server';
import { generateWelcomeLetterHTML, generateRejectionEmailText, generateCreditReportHTML } from '../utils/templates';
import { 
  ArrowLeft, Printer, Sparkles, AlertTriangle, Loader2, DollarSign, 
  TrendingUp, ShieldAlert, Activity, Mail, Download, Copy, CheckCircle,
  FileText, Send, ExternalLink, Cloud, Calendar, X
} from 'lucide-react';

interface AnalysisDetailViewProps {
  analysis: CreditAnalysis;
  userRole: UserRole;
  onBack: () => void;
  // Updated signature to accept Plazo
  onAction: (id: string, action: 'APROBADO' | 'NEGADO', manualCupo?: number, manualPlazo?: number, reason?: string) => void;
}

const AnalysisDetailView: React.FC<AnalysisDetailViewProps> = ({ analysis, userRole, onBack, onAction }) => {
  const [showReport, setShowReport] = useState(false);
  const [showWelcomeLetter, setShowWelcomeLetter] = useState(false);
  
  // States for Director Editing
  const [manualCupo, setManualCupo] = useState<number>(analysis.assignedCupo || analysis.cupo?.cupoConservador || 0);
  const [manualPlazo, setManualPlazo] = useState<number>(analysis.assignedPlazo || analysis.cupo?.plazoRecomendado || 30);
  
  const [showRiskConfirm, setShowRiskConfirm] = useState(false);
  
  // REJECTION FLOW STATES
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  // States for Email/Drive Workflow
  // UPDATED: Initialize empty to avoid pre-filling with comercial's email
  const [emailTo, setEmailTo] = useState('');
  const [processingAction, setProcessingAction] = useState(false);
  const [actionStatus, setActionStatus] = useState<{type: 'success' | 'error', msg: string} | null>(null);
  const [autoGenerating, setAutoGenerating] = useState(false);

  const isHighRisk = analysis.cupo?.cupoLiberal ? manualCupo > analysis.cupo.cupoLiberal : false;

  // Pre-fill rejection reason based on flags
  useEffect(() => {
    if (analysis.flags?.red && analysis.flags.red.length > 0) {
        setRejectReason(`Inconsistencias financieras detectadas: ${analysis.flags.red.join(', ')}.`);
    } else {
        setRejectReason("Políticas internas de riesgo crediticio: Capacidad de endeudamiento excedida.");
    }
  }, [analysis]);

  const performApproval = async () => {
     setAutoGenerating(true);
     setShowRiskConfirm(false);
     
     try {
       // 1. Generate & Upload Credit Report PDF
       const reportHtml = generateCreditReportHTML(analysis, manualCupo, manualPlazo);
       await exportToDriveAndNotify({
          action: 'SAVE_REPORT',
          folderId: analysis.driveFolderId, 
          folderUrl: analysis.driveFolderUrl, 
          htmlContent: reportHtml,
          fileName: `Informe_Credito_${analysis.clientName}.pdf`
       });

       // 2. Generate & Upload Welcome Letter
       const welcomeHtml = generateWelcomeLetterHTML({...analysis, assignedCupo: manualCupo, assignedPlazo: manualPlazo});
       await exportToDriveAndNotify({
          action: 'SAVE_REPORT',
          folderId: analysis.driveFolderId, 
          folderUrl: analysis.driveFolderUrl, 
          htmlContent: welcomeHtml,
          fileName: `Carta_Bienvenida_${analysis.clientName}.pdf`
       });

       // 3. Finalize Action
       onAction(analysis.id, 'APROBADO', manualCupo, manualPlazo);
     } catch (e) {
       console.error("Auto generation failed", e);
       alert("Hubo un error generando los documentos automáticos, pero se aprobará el cupo.");
       onAction(analysis.id, 'APROBADO', manualCupo, manualPlazo);
     } finally {
       setAutoGenerating(false);
     }
  };

  const handleApproveClick = () => {
    if (isHighRisk) {
      setShowRiskConfirm(true);
    } else {
      performApproval();
    }
  };

  const handleConfirmReject = async () => {
    // 1. Close Modal Immediately
    setShowRejectModal(false);
    
    // 2. Start Global Loading
    setAutoGenerating(true);
    
    try {
        // Generate Report even if rejected (with 0 cupo)
        // We create a temp analysis object to ensure the reason is reflected if we were to include it in the PDF
        const tempAnalysis = { ...analysis, rejectionReason: rejectReason };
        const reportHtml = generateCreditReportHTML(tempAnalysis, 0, 0);
        
        await exportToDriveAndNotify({
            action: 'SAVE_REPORT',
            folderId: analysis.driveFolderId, 
            folderUrl: analysis.driveFolderUrl, 
            htmlContent: reportHtml,
            fileName: `Informe_Credito_RECHAZADO_${analysis.clientName}.pdf`
        });
        
        // Finalize state which will trigger the UI update to show the email script
        onAction(analysis.id, 'NEGADO', 0, 0, rejectReason);
    } catch (e) {
        // Even if PDF fails, we must record the decision
        console.error("Error saving rejection report", e);
        onAction(analysis.id, 'NEGADO', 0, 0, rejectReason);
    } finally {
        // Ensure loading state is cleared after everything is done
        setAutoGenerating(false);
    }
  };

  const handleSendRealEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailTo) return;

    setProcessingAction(true);
    setActionStatus(null);
    
    let subject = "";
    let body = "";
    let detalleLog = "";

    if (analysis.status === 'APROBADO') {
      subject = `Aprobación de Cupo Grupo Equitel - ${analysis.clientName}`;
      body = generateWelcomeLetterHTML(analysis);
      detalleLog = `Cupo: ${formatCOP(analysis.assignedCupo || 0)} - Plazo: ${analysis.assignedPlazo} días`;
    } else {
      subject = `Respuesta Solicitud Crédito - ${analysis.clientName}`;
      // Use the stored rejection reason
      body = generateRejectionEmailText(analysis).replace(/\n/g, '<br>');
      detalleLog = "Solicitud Denegada";
    }

    const result = await exportToDriveAndNotify({
      action: 'SEND_EMAIL',
      emailData: { to: emailTo, subject, body },
      folderUrl: analysis.driveFolderUrl,
      // Metadata para el registro en Sheets
      logData: {
        clientId: analysis.id,
        clientName: analysis.clientName,
        nit: analysis.nit,
        comercialName: analysis.comercial.name,
        estado: analysis.status,
        detalle: detalleLog
      }
    });

    setProcessingAction(false);
    if (result.success) {
      setActionStatus({ type: 'success', msg: 'Correo enviado exitosamente.' });
    } else {
      setActionStatus({ type: 'error', msg: 'Error al enviar correo: ' + result.message });
    }
  };

  const handleManualSaveToDrive = async (type: 'REPORT' | 'WELCOME') => {
     setProcessingAction(true);
     try {
         const html = type === 'REPORT' 
            ? generateCreditReportHTML(analysis, manualCupo, manualPlazo)
            : generateWelcomeLetterHTML(analysis);
         
         const fileName = type === 'REPORT' ? `Informe_Credito` : `Carta_Bienvenida`;
         
         const result = await exportToDriveAndNotify({
            action: 'SAVE_REPORT',
            folderId: analysis.driveFolderId, 
            folderUrl: analysis.driveFolderUrl, 
            htmlContent: html,
            fileName: `${fileName}_${analysis.clientName}.pdf`
         });

         if (result.success) {
             alert("Guardado exitosamente.");
         } else {
             alert("Error guardando: " + result.message);
         }
     } catch (e) {
         alert("Error técnico.");
     } finally {
         setProcessingAction(false);
     }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert("Texto copiado al portapapeles");
  };

  // Helper to handle currency input change
  const handleCurrencyInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Remove all non-numeric chars except possibly for empty string handling
    const rawValue = e.target.value.replace(/\D/g, '');
    setManualCupo(rawValue ? parseInt(rawValue, 10) : 0);
  };

  // Directly access ai result
  const aiConceptText = analysis.aiResult?.justification || "Sin concepto previo.";

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-24 relative">
      
      {autoGenerating && (
          <div className="fixed inset-0 bg-white/90 z-[300] flex flex-col items-center justify-center backdrop-blur-sm animate-in fade-in">
             <Loader2 className="animate-spin text-equitel-red mb-4" size={48} />
             <h2 className="text-xl font-black uppercase text-slate-900">Generando documentos y finalizando...</h2>
             <p className="text-slate-400 mt-2 font-medium">Por favor espere, no cierre la ventana.</p>
          </div>
      )}

      <div className="flex items-center justify-between no-print">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="flex items-center gap-2 text-slate-500 font-bold hover:text-black transition-colors">
            <ArrowLeft size={20} /> Volver
          </button>
          {analysis.driveFolderUrl && (
            <a 
              href={analysis.driveFolderUrl} 
              target="_blank" 
              rel="noreferrer" 
              className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:text-equitel-red hover:border-equitel-red transition-all shadow-sm"
            >
              <ExternalLink size={14} />
              Ver Carpeta Drive
            </a>
          )}
        </div>
        
        {userRole === UserRole.DIRECTOR && (analysis.status === 'PENDIENTE_DIRECTOR' || analysis.status === 'ANALIZADO') && (
          <div className="flex gap-4">
            <button onClick={() => setShowRejectModal(true)} className="px-6 py-3 border-2 border-red-100 text-red-600 bg-red-50 rounded-2xl font-black hover:bg-red-100 transition-colors uppercase text-xs tracking-widest">
              Negar Solicitud
            </button>
            <button onClick={handleApproveClick} className="px-8 py-3 bg-equitel-red text-white rounded-2xl font-black shadow-xl hover:bg-red-700 transition-colors uppercase text-xs tracking-widest">
              Aprobar Cupo
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-8 space-y-8">
          <div className="bg-black rounded-[2.5rem] p-10 text-white relative overflow-hidden shadow-2xl">
             <div className="absolute top-0 right-0 p-10 opacity-20">
               <Activity size={120} className="text-equitel-red" />
             </div>
             
             {/* Header with Client Info and Request ID */}
             <div className="relative z-10 mb-4">
               <div className="flex items-baseline gap-3">
                 <h2 className="text-3xl font-black uppercase tracking-tight truncate">{analysis.clientName}</h2>
                 <span className="text-lg font-bold text-slate-500">{analysis.id}</span>
               </div>
             </div>

             <div className="flex flex-wrap gap-4 text-sm text-slate-400 font-medium relative z-10">
               <span className="bg-slate-900 border border-slate-800 px-3 py-1 rounded-lg">NIT: {analysis.nit}</span>
               <div className={`flex items-center gap-2 px-3 py-1 rounded-lg text-white font-black uppercase ${
                 analysis.status === 'APROBADO' ? 'bg-green-600' :
                 analysis.status === 'NEGADO' ? 'bg-red-600' : 
                 analysis.riskLevel === 'BAJO' ? 'bg-green-600' : 'bg-amber-500'
               }`}>
                 <ShieldAlert size={14} />
                 {(analysis.status === 'PENDIENTE_DIRECTOR' || analysis.status === 'PENDIENTE_CARTERA') ? `RIESGO ${analysis.riskLevel || '...'}` : analysis.status}
               </div>
             </div>
          </div>

          {/* VISIBLE TO ALL: APPROVED BLOCK */}
          {analysis.status === 'APROBADO' && (
            <div className="bg-green-50 rounded-[2.5rem] p-8 border border-green-100 animate-in fade-in">
              <div className="flex items-start gap-4">
                <div className="bg-green-100 p-3 rounded-full text-green-600">
                  <CheckCircle size={32} />
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-black uppercase text-green-900 mb-2">Solicitud Aprobada</h3>
                  <p className="text-green-800 mb-6">El cupo ha sido autorizado exitosamente. A continuación puede gestionar la formalización.</p>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-white p-6 rounded-3xl shadow-sm border border-green-100">
                      <h4 className="font-bold text-slate-900 uppercase text-xs mb-4 flex items-center gap-2">
                        <FileText size={16} /> Carta de Bienvenida
                      </h4>
                      <div className="flex gap-2">
                        <button 
                          onClick={() => setShowWelcomeLetter(true)}
                          className="flex-1 py-3 bg-black text-white rounded-xl font-bold text-xs uppercase flex items-center justify-center gap-2 hover:bg-slate-800"
                        >
                          <Printer size={16} /> Ver PDF
                        </button>
                      </div>
                    </div>

                    <div className="bg-white p-6 rounded-3xl shadow-sm border border-green-100">
                      <h4 className="font-bold text-slate-900 uppercase text-xs mb-4 flex items-center gap-2">
                        <Mail size={16} /> Enviar Notificación
                      </h4>
                      <form onSubmit={handleSendRealEmail} className="space-y-3">
                        <input 
                          type="email" 
                          placeholder="correo@ejemplo.com" 
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-sm font-medium text-slate-900 placeholder:text-slate-400"
                          value={emailTo}
                          onChange={e => setEmailTo(e.target.value)}
                          required
                        />
                        <button 
                          type="submit"
                          disabled={processingAction}
                          className="w-full py-3 bg-green-600 text-white rounded-xl font-bold text-xs uppercase flex items-center justify-center gap-2 hover:bg-green-700 disabled:opacity-50"
                        >
                          {processingAction ? <Loader2 className="animate-spin" /> : <Send size={16} />}
                          ENVIAR CORREO
                        </button>
                        {actionStatus && (
                          <p className={`text-[10px] font-bold ${actionStatus.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>
                            {actionStatus.msg}
                          </p>
                        )}
                      </form>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* VISIBLE TO ALL: DENIED BLOCK */}
          {analysis.status === 'NEGADO' && (
            <div className="bg-red-50 rounded-[2.5rem] p-8 border border-red-100 animate-in fade-in">
              <div className="flex items-start gap-4">
                 <div className="bg-red-100 p-3 rounded-full text-red-600">
                    <ShieldAlert size={32} />
                 </div>
                 <div className="w-full">
                   <h3 className="text-xl font-black uppercase text-red-900 mb-4">Solicitud Denegada</h3>
                   
                   <div className="bg-white p-6 rounded-2xl border border-red-100 shadow-sm w-full">
                     <div className="flex justify-between items-center mb-4">
                       <h4 className="font-bold text-slate-900 uppercase text-xs">Script de Comunicación</h4>
                       <button 
                         onClick={() => copyToClipboard(generateRejectionEmailText(analysis))}
                         className="text-slate-400 hover:text-slate-900 transition-colors"
                         title="Copiar texto"
                       >
                         <Copy size={16} />
                       </button>
                     </div>
                     <textarea 
                        readOnly
                        className="w-full h-48 bg-slate-50 p-4 rounded-xl text-sm text-slate-900 border-none resize-none font-mono focus:ring-2 focus:ring-red-200 outline-none"
                        value={generateRejectionEmailText(analysis)}
                     />
                     
                     <div className="mt-4 pt-4 border-t border-slate-100">
                        <h4 className="font-bold text-slate-900 uppercase text-xs mb-3 flex items-center gap-2">
                          <Mail size={14} /> Enviar Respuesta Directa
                        </h4>
                        <form onSubmit={handleSendRealEmail} className="flex gap-3 items-center">
                          <input 
                            type="email" 
                            placeholder="correo@ejemplo.com" 
                            className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-sm font-medium text-slate-900"
                            value={emailTo}
                            onChange={e => setEmailTo(e.target.value)}
                            required
                          />
                          <button 
                            type="submit"
                            disabled={processingAction}
                            className="px-6 py-2 bg-black text-white rounded-xl font-bold text-xs uppercase hover:bg-slate-800 disabled:opacity-50"
                          >
                            {processingAction ? <Loader2 className="animate-spin" /> : 'Enviar'}
                          </button>
                        </form>
                        {actionStatus && (
                          <p className={`text-[10px] font-bold mt-2 ${actionStatus.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>
                            {actionStatus.msg}
                          </p>
                        )}
                     </div>
                   </div>
                 </div>
              </div>
            </div>
          )}

          {analysis.indicators && (
            <div className="bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-sm">
              <h3 className="flex items-center gap-3 text-lg font-black uppercase text-slate-900 mb-6">
                <TrendingUp className="text-equitel-red" />
                Resumen de Indicadores Financieros
              </h3>
              <FinancialIndicatorsTable 
                indicators={analysis.indicators} 
                interpretations={analysis.aiResult?.financialIndicatorInterpretations}
              />
            </div>
          )}

          {userRole === UserRole.DIRECTOR && analysis.cupo && (
            <div className="bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-sm">
              <h3 className="flex items-center gap-3 text-lg font-black uppercase text-slate-900 mb-6">
                <DollarSign className="text-equitel-red" />
                Cálculo de Cupo Sugerido (Fórmula 6 Indicadores)
              </h3>
              <CupoCalculationBreakdown cupo={analysis.cupo} />
            </div>
          )}

          {/* UPDATED: ALWAYS VISIBLE FOR DIRECTOR, REGARDLESS OF STATUS */}
          {userRole === UserRole.DIRECTOR && (
            <div className="bg-indigo-50 rounded-[2.5rem] p-8 border border-indigo-100">
              <div className="flex items-center gap-3 mb-4">
                <Sparkles className="text-indigo-600" />
                <h3 className="font-black uppercase tracking-widest text-sm text-indigo-900">Concepto IA Estefanía</h3>
              </div>
              <div className="text-indigo-900 text-sm leading-relaxed font-medium text-justify whitespace-pre-line">
                  {aiConceptText}
              </div>
            </div>
          )}
        </div>

        <div className="lg:col-span-4 space-y-8">
          <div className="bg-white rounded-[2.5rem] p-8 border-2 shadow-xl border-slate-100 sticky top-8">
            <h4 className="text-[10px] font-black uppercase tracking-widest mb-6 text-slate-400 border-b pb-2">Dictamen de Crédito</h4>
            
            <div className="space-y-6">
              {userRole === UserRole.DIRECTOR && analysis.cupo && (
                <div className="flex flex-col gap-4 mb-4">
                  <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200">
                    <p className="text-[10px] font-bold text-slate-500 uppercase mb-2">Conservador (50-40%)</p>
                    <p className="text-2xl md:text-3xl font-black text-slate-900 truncate tracking-tight">{formatCOP(analysis.cupo.cupoConservador || 0)}</p>
                  </div>
                  <div className="bg-red-50 p-6 rounded-2xl border border-red-100">
                    <p className="text-[10px] font-bold text-red-600 uppercase mb-2">Liberal (80-60%)</p>
                    <p className="text-2xl md:text-3xl font-black text-red-600 truncate tracking-tight">{formatCOP(analysis.cupo.cupoLiberal || 0)}</p>
                  </div>
                </div>
              )}

              {/* VISIBLE TO ALL: STATUS & APPROVED CUPO */}
              {analysis.status === 'APROBADO' ? (
                 <div className="p-6 rounded-3xl border-2 border-green-500 bg-green-50">
                    <div className="mb-4 border-b border-green-200 pb-4">
                        <label className="text-[9px] font-black uppercase mb-2 block text-green-700 tracking-widest">Cupo Otorgado</label>
                        <p className="text-3xl font-black text-green-900">{formatCOP(analysis.assignedCupo || 0)}</p>
                    </div>
                    <div>
                        <label className="text-[9px] font-black uppercase mb-2 block text-green-700 tracking-widest">Plazo Aprobado</label>
                        <p className="text-xl font-bold text-green-800">{analysis.assignedPlazo || analysis.cupo?.plazoRecomendado} Días</p>
                    </div>
                 </div>
              ) : analysis.status === 'NEGADO' ? (
                 <div className="p-6 rounded-3xl border-2 border-red-500 bg-red-50">
                    <p className="text-xl font-black text-red-700 uppercase text-center">Solicitud Rechazada</p>
                    <p className="text-xs text-red-800 text-center mt-2 font-medium">Notificación enviada a Cartera.</p>
                 </div>
              ) : (
                <>
                  {userRole === UserRole.DIRECTOR ? (
                    <div className={`p-6 rounded-3xl border-2 transition-all ${isHighRisk ? 'border-red-500 bg-red-50' : 'border-slate-100 bg-slate-50'}`}>
                      <label className="text-[9px] font-black uppercase mb-2 block text-slate-500 tracking-widest">Cupo Aprobado (COP)</label>
                      <div className="flex items-center gap-2 mb-6">
                        <span className="text-slate-400 font-bold">$</span>
                        {/* UPDATED: Controlled text input for formatting */}
                        <input 
                          type="text"
                          className="w-full bg-transparent text-2xl font-black outline-none text-slate-900"
                          value={new Intl.NumberFormat('es-CO').format(manualCupo)}
                          onChange={handleCurrencyInputChange}
                        />
                      </div>
                      
                      {/* UPDATED: Plazo Editing with Infinite Granularity and Manual Input */}
                      <label className="text-[9px] font-black uppercase mb-2 block text-slate-500 tracking-widest">Plazo de Pago (Días)</label>
                      <div className="flex items-center gap-4 mb-2">
                        <input 
                          type="range" 
                          min="0" 
                          max="120" 
                          step="1" // Step 1 for infinite granularity
                          value={manualPlazo} 
                          onChange={e => setManualPlazo(Number(e.target.value))}
                          className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-equitel-red"
                        />
                        {/* UPDATED: Input box instead of div */}
                        <input
                           type="number"
                           min="0"
                           max="120"
                           className="w-16 bg-white rounded-lg border border-slate-200 p-1 font-bold text-center text-slate-900 outline-none focus:ring-2 focus:ring-equitel-red"
                           value={manualPlazo}
                           onChange={e => setManualPlazo(Number(e.target.value))}
                        />
                      </div>
                      <p className="text-[10px] text-slate-400 text-right">Sugerido IA: {analysis.cupo?.plazoRecomendado} días</p>

                      {isHighRisk && (
                        <div className="mt-4 flex items-center gap-2 text-red-600 animate-pulse">
                          <AlertTriangle size={14} />
                          <span className="text-[9px] font-black uppercase">Excede límite liberal</span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="p-6 rounded-3xl border-2 border-slate-100 bg-slate-50">
                       <p className="text-center font-bold text-slate-500">En proceso de estudio</p>
                       <p className="text-center text-xs text-slate-400 mt-1">El cupo será visible una vez aprobado.</p>
                    </div>
                  )}
                </>
              )}

              {userRole === UserRole.DIRECTOR && analysis.cupo && (
                <div className="pt-4 border-t border-slate-100">
                   <p className="text-xs font-bold text-slate-500 mb-2 flex items-center gap-2">
                     <Calendar size={14} /> Plazo Sugerido (Ciclo Operacional)
                   </p>
                   <div className="flex items-center gap-2">
                     <div className="h-2 flex-1 bg-slate-100 rounded-full overflow-hidden">
                       <div className="h-full bg-slate-900 w-1/2"></div>
                     </div>
                     <span className="font-black text-slate-900">{analysis.cupo.plazoRecomendado} Días</span>
                   </div>
                </div>
              )}
            </div>

            {userRole === UserRole.DIRECTOR && (
              <button onClick={() => setShowReport(true)} className="w-full mt-8 py-4 bg-black text-white rounded-xl font-bold flex items-center justify-center gap-3 hover:bg-slate-800 transition-all text-xs uppercase tracking-widest shadow-lg">
                 <Cloud size={16} /> Ver / Guardar Informe
              </button>
            )}
          </div>
        </div>
      </div>

      {showRiskConfirm && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[150] flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white rounded-[2.5rem] p-10 text-center shadow-2xl animate-in zoom-in duration-300">
            <div className="w-20 h-20 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-6">
              <AlertTriangle size={40} />
            </div>
            <h3 className="text-2xl font-black uppercase mb-4 text-slate-900">¿Confirmar Alto Riesgo?</h3>
            <p className="text-slate-500 text-sm mb-8">El cupo ingresado <strong>({formatCOP(manualCupo)})</strong> supera el límite técnico del modelo liberal. Esta acción quedará registrada bajo su responsabilidad.</p>
            <div className="flex gap-4">
              <button onClick={() => setShowRiskConfirm(false)} className="flex-1 py-4 font-bold text-slate-400 hover:text-slate-600 transition-colors uppercase text-xs tracking-widest">Cancelar</button>
              <button 
                onClick={performApproval} 
                className="flex-1 py-4 bg-red-600 text-white rounded-2xl font-black hover:bg-red-700 transition-colors uppercase text-xs tracking-widest shadow-lg shadow-red-200"
              >
                Sí, Proceder
              </button>
            </div>
          </div>
        </div>
      )}

      {showRejectModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[150] flex items-center justify-center p-4">
          <div className="max-w-lg w-full bg-white rounded-[2.5rem] p-8 shadow-2xl animate-in zoom-in duration-300 relative">
            <button 
                onClick={() => setShowRejectModal(false)}
                className="absolute top-6 right-6 text-slate-400 hover:text-slate-800"
            >
                <X size={24} />
            </button>
            
            <div className="w-16 h-16 bg-red-100 text-red-600 rounded-2xl flex items-center justify-center mb-6">
              <ShieldAlert size={32} />
            </div>
            
            <h3 className="text-2xl font-black uppercase mb-2 text-slate-900">Negar Solicitud</h3>
            <p className="text-slate-500 text-sm mb-6">Por favor edite el motivo de rechazo. Este texto se usará en la comunicación formal.</p>
            
            <textarea 
                className="w-full h-40 bg-slate-50 border border-slate-200 rounded-2xl p-4 text-sm font-medium text-slate-800 focus:ring-2 focus:ring-equitel-red outline-none resize-none mb-6"
                placeholder="Escriba el motivo del rechazo..."
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
            />
            
            <div className="flex gap-4">
              <button 
                onClick={() => setShowRejectModal(false)} 
                className="flex-1 py-4 font-bold text-slate-400 hover:text-slate-600 transition-colors uppercase text-xs tracking-widest"
              >
                Cancelar
              </button>
              <button 
                onClick={handleConfirmReject} 
                disabled={!rejectReason.trim()}
                className="flex-1 py-4 bg-red-600 text-white rounded-2xl font-black hover:bg-red-700 transition-colors uppercase text-xs tracking-widest shadow-lg shadow-red-200 disabled:opacity-50"
              >
                Confirmar Negación
              </button>
            </div>
          </div>
        </div>
      )}

      {(showReport || showWelcomeLetter) && (
        <div id="printable-report-container" className="fixed inset-0 bg-white z-[200] overflow-y-auto">
          <div className="min-h-screen bg-slate-100 flex flex-col items-center pt-8 pb-8">
             <div className="fixed top-4 right-4 flex gap-2 z-50">
               {/* UPDATED: Buttons now use manual generation logic */}
               <button 
                  onClick={() => handleManualSaveToDrive(showWelcomeLetter ? 'WELCOME' : 'REPORT')} 
                  disabled={processingAction}
                  className="bg-black text-white px-6 py-3 rounded-full font-bold shadow-lg hover:bg-slate-800 flex items-center gap-2"
               >
                 {processingAction ? <Loader2 className="animate-spin" /> : <Cloud size={18} />}
                 Guardar PDF en Drive
               </button>
               
               <button onClick={() => { setShowReport(false); setShowWelcomeLetter(false); }} className="bg-white text-slate-900 px-6 py-3 rounded-full font-bold shadow-lg hover:bg-slate-50">
                 Cerrar Vista Previa
               </button>
             </div>

             <div className="bg-white max-w-[21cm] w-full min-h-[29.7cm] p-[1.5cm] shadow-2xl relative print-paper">
                {showWelcomeLetter ? (
                  <div dangerouslySetInnerHTML={{ __html: generateWelcomeLetterHTML({...analysis, assignedCupo: manualCupo, assignedPlazo: manualPlazo}) }} />
                ) : (
                  <div dangerouslySetInnerHTML={{ __html: generateCreditReportHTML(analysis, manualCupo, manualPlazo) }} />
                )}
             </div>
          </div>
        </div>
      )}
    </div>
  );
};

const FinancialIndicatorsTable = ({ indicators, interpretations, compact = false }: { indicators: FinancialIndicators, interpretations?: {[key: string]: string}, compact?: boolean }) => {
  const rowClass = compact ? "py-2 px-4" : "py-3 px-6";
  const textClass = compact ? "text-xs" : "text-sm";
  
  // Custom formatters for specific percent fields that AI now returns as 0-100 integers
  const formatPctVal = (val: number) => `${val.toFixed(2)}%`;

  const categories = [
    {
      title: "Liquidez",
      interpKey: "liquidez",
      items: [
        { label: "Razón Corriente", value: indicators.razonCorriente.toFixed(2) },
        { label: "Prueba Ácida", value: indicators.pruebaAcida.toFixed(2) },
        { label: "KNT (Capital de Trabajo)", value: formatCOP(indicators.knt) },
        { label: "Riesgo Insolvencia (Inv. Liquidez)", value: indicators.riesgoInsolvencia.toFixed(2) },
      ]
    },
    {
      title: "Endeudamiento",
      interpKey: "endeudamiento",
      items: [
        { label: "Nivel Endeudamiento Global", value: formatPctVal(indicators.endeudamientoGlobal) },
        { label: "Endeudamiento Corto Plazo", value: formatPctVal(indicators.endeudamientoCP) },
        { label: "Endeudamiento Largo Plazo", value: formatPctVal(indicators.endeudamientoLP) },
        { label: "Solvencia (Pasivo/Patrimonio)", value: formatPctVal(indicators.solvencia) },
        { label: "Apalancamiento Financiero", value: indicators.apalancamientoFinanciero?.toFixed(2) || "N/A" },
        { label: "Carga Financiera", value: formatPctVal(indicators.cargaFinanciera || 0) },
      ]
    },
    {
      title: "Rentabilidad & Márgenes",
      interpKey: "rentabilidad",
      items: [
        { label: "Margen Bruto", value: formatPctVal(indicators.margenBruto || 0) },
        { label: "Margen Operacional", value: formatPctVal(indicators.margenOperacional) },
        { label: "Margen Neto", value: formatPctVal(indicators.margenNeto) },
        { label: "Margen Contribución", value: formatPctVal(indicators.margenContribucion || 0) },
        { label: "ROA (Activo)", value: formatPctVal(indicators.roa) },
        { label: "ROE (Patrimonio)", value: formatPctVal(indicators.roe) },
      ]
    },
    {
      title: "Operación & Eficiencia",
      interpKey: "operacion",
      items: [
        { label: "EBIT", value: formatCOP(indicators.ebit || 0) },
        { label: "EBITDA", value: formatCOP(indicators.ebitda) },
        { label: "Punto de Equilibrio (Est.)", value: formatCOP(indicators.puntoEquilibrio || 0) },
        { label: "Rotación Activos", value: indicators.rotacionActivos?.toFixed(2) || "N/A" },
        { label: "Días Recuperación Cartera", value: `${indicators.diasCartera.toFixed(0)} días` },
        { label: "Días Rotación Inventario", value: `${indicators.diasInventario.toFixed(0)} días` },
        { label: "Ciclo Operacional", value: `${indicators.cicloOperacional.toFixed(0)} días` },
      ]
    },
    {
      title: "Riesgo",
      interpKey: "zAltman",
      items: [
         { label: "Z-Altman Score", value: indicators.zAltman?.toFixed(2) || "N/A" },
         { label: "Deterioro Patrimonial", value: indicators.deterioroPatrimonial ? "SÍ (ALERTA)" : "NO" }
      ]
    }
  ];

  return (
    <div className={`overflow-hidden border border-slate-200 rounded-xl ${compact ? 'text-xs' : ''}`}>
      <table className="w-full text-left border-collapse">
        <thead className="bg-slate-50 text-slate-800 font-bold uppercase text-[10px] print-force-bg-gray">
          <tr>
            <th className={rowClass}>Categoría</th>
            <th className={rowClass}>Indicador</th>
            <th className={`${rowClass} text-right`}>Resultado (2024)</th>
            <th className={`${rowClass} text-right`}>Interpretación</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {categories.map((cat, idx) => (
            <React.Fragment key={idx}>
              {cat.items.map((item, itemIdx) => (
                <tr key={`${idx}-${itemIdx}`} className="hover:bg-slate-50/50">
                  {itemIdx === 0 && (
                    <td rowSpan={cat.items.length} className={`${rowClass} font-bold text-slate-400 border-r border-slate-100 bg-slate-50/20 align-top print-force-bg-gray`}>
                      {cat.title}
                    </td>
                  )}
                  <td className={`${rowClass} ${textClass} font-medium text-slate-700`}>{item.label}</td>
                  <td className={`${rowClass} ${textClass} font-bold text-slate-900 text-right`}>{item.value}</td>
                  {itemIdx === 0 && (
                     <td rowSpan={cat.items.length} className={`${rowClass} ${textClass} text-slate-500 text-right align-top italic`}>
                        {interpretations?.[cat.interpKey] || "-"}
                     </td>
                  )}
                </tr>
              ))}
            </React.Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const CupoCalculationBreakdown = ({ cupo }: { cupo: any }) => {
  const items = [
    { label: "1. Datacrédito (Promedio 3p * 10%)", value: cupo.variables?.v1_weighted, desc: `Base: ${formatCOP(cupo.variables?.v1_datacredito_avg || 0)}` },
    { label: "2. OtorgA (Plataforma)", value: cupo.variables?.v2_otorga, desc: "Cupo directo score" },
    { label: "3. Opinión Crédito (Informa * 10%)", value: cupo.variables?.v3_weighted, desc: `Base: ${formatCOP(cupo.variables?.v3_informa_max || 0)}` },
    { label: "4. Utilidad Neta Mensual", value: cupo.variables?.v4_utilidad_mensual, desc: "Promedio mensual último año" },
    { label: "5. Ref. Comerciales (Promedio)", value: cupo.variables?.v5_referencias_avg, desc: "Validado en cartas" },
    { label: "6. Cupo Mensual (EBITDA/2)/12", value: cupo.variables?.v6_ebitda_monthly, desc: "Capacidad operativa ajustada" },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {items.map((item, idx) => (
          <div key={idx} className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex justify-between items-center group hover:border-equitel-red/30 transition-colors">
            <div>
              <p className="text-xs font-bold text-slate-600 uppercase mb-1">{item.label}</p>
              <p className="text-[10px] text-slate-400">{item.desc}</p>
            </div>
            <p className="text-lg font-black text-slate-900">{formatCOP(item.value || 0)}</p>
          </div>
        ))}
      </div>
      <div className="mt-4 p-4 bg-black text-white rounded-xl flex justify-between items-center shadow-lg">
        <span className="font-bold uppercase text-xs tracking-widest">Resultado Promedio (6 Indicadores)</span>
        <span className="text-2xl font-black text-equitel-red">{formatCOP(cupo.resultadoPromedio)}</span>
      </div>
    </div>
  );
};

export default AnalysisDetailView;
