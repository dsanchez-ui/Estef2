
import React, { useState, useEffect } from 'react';
import { CreditAnalysis, FinancialIndicators, UserRole } from '../types';
import { formatCOP, formatPercent, numberToLetters } from '../utils/calculations';
import { getAIGuidance } from '../services/gemini';
import { sendEmail } from '../services/email';
import { generateWelcomeLetterHTML, generateRejectionEmailText } from '../utils/templates';
import { 
  ArrowLeft, Printer, Sparkles, AlertTriangle, Loader2, DollarSign, 
  TrendingUp, ShieldAlert, Activity, Mail, Download, Copy, CheckCircle,
  FileText, Send
} from 'lucide-react';

interface AnalysisDetailViewProps {
  analysis: CreditAnalysis;
  userRole: UserRole;
  onBack: () => void;
  onAction: (id: string, action: 'APROBADO' | 'NEGADO', manualCupo?: number, reason?: string) => void;
}

const AnalysisDetailView: React.FC<AnalysisDetailViewProps> = ({ analysis, userRole, onBack, onAction }) => {
  const [showReport, setShowReport] = useState(false);
  const [showWelcomeLetter, setShowWelcomeLetter] = useState(false);
  const [aiRec, setAiRec] = useState<string>('');
  const [loadingAi, setLoadingAi] = useState(false);
  const [manualCupo, setManualCupo] = useState<number>(analysis.assignedCupo || analysis.cupo?.cupoConservador || 0);
  const [showRiskConfirm, setShowRiskConfirm] = useState(false);
  
  // States for Email Workflow
  const [emailTo, setEmailTo] = useState('');
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [rejectionReason, setRejectionReason] = useState(analysis.rejectionReason || '');

  useEffect(() => {
    if (userRole === UserRole.DIRECTOR && analysis.status === 'ANALIZADO') {
      const fetchAiRec = async () => {
        setLoadingAi(true);
        const rec = await getAIGuidance(analysis);
        setAiRec(rec || '');
        setLoadingAi(false);
      };
      fetchAiRec();
    }
  }, [analysis, userRole]);

  const isHighRisk = analysis.cupo?.cupoLiberal ? manualCupo > analysis.cupo.cupoLiberal : false;

  const handleApprove = () => {
    if (isHighRisk) {
      setShowRiskConfirm(true);
    } else {
      onAction(analysis.id, 'APROBADO', manualCupo);
    }
  };

  const handleReject = () => {
    const reason = `Inconsistencias financieras detectadas: ${analysis.flags?.red.map(f => f).join(', ') || 'N/A'}.`;
    onAction(analysis.id, 'NEGADO', 0, reason);
  };

  const handleSendEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailTo) return;

    setSendingEmail(true);
    
    let subject = "";
    let body = "";

    if (analysis.status === 'APROBADO') {
      subject = `Aprobación de Cupo Cummins de los Andes - ${analysis.clientName}`;
      body = generateWelcomeLetterHTML(analysis);
    } else {
      subject = `Respuesta Solicitud Crédito - ${analysis.clientName}`;
      body = generateRejectionEmailText(analysis).replace(/\n/g, '<br>');
    }

    const success = await sendEmail(emailTo, subject, body);

    setSendingEmail(false);
    if (success) {
      setEmailSent(true);
      setTimeout(() => setEmailSent(false), 3000);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert("Texto copiado al portapapeles");
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-24 relative">
      {/* Header Actions */}
      <div className="flex items-center justify-between no-print">
        <button onClick={onBack} className="flex items-center gap-2 text-slate-500 font-bold hover:text-slate-900 transition-colors">
          <ArrowLeft size={20} /> Volver
        </button>
        
        {userRole === UserRole.DIRECTOR && (analysis.status === 'PENDIENTE_DIRECTOR' || analysis.status === 'ANALIZADO') && (
          <div className="flex gap-4">
            <button onClick={handleReject} className="px-6 py-3 border-2 border-red-100 text-red-600 rounded-2xl font-black hover:bg-red-50 transition-colors uppercase text-xs tracking-widest">
              Negar Solicitud
            </button>
            <button onClick={handleApprove} className="px-8 py-3 bg-equitel-red text-white rounded-2xl font-black shadow-xl hover:bg-red-700 transition-colors uppercase text-xs tracking-widest">
              Aprobar Cupo
            </button>
          </div>
        )}
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Column: Data & Analysis */}
        <div className="lg:col-span-8 space-y-8">
          
          {/* Header Card */}
          <div className="bg-slate-900 rounded-[2.5rem] p-10 text-white relative overflow-hidden shadow-2xl">
             <div className="absolute top-0 right-0 p-10 opacity-10">
               <Activity size={120} />
             </div>
             <h2 className="text-3xl font-black uppercase mb-2 tracking-tight">{analysis.clientName}</h2>
             <div className="flex flex-wrap gap-4 text-sm text-slate-400 font-medium">
               <span className="bg-slate-800 px-3 py-1 rounded-lg">NIT: {analysis.nit}</span>
               <div className={`flex items-center gap-2 px-3 py-1 rounded-lg text-white font-black uppercase ${
                 analysis.status === 'APROBADO' ? 'bg-green-500' :
                 analysis.status === 'NEGADO' ? 'bg-red-500' : 
                 analysis.riskLevel === 'BAJO' ? 'bg-green-500' : 'bg-yellow-500'
               }`}>
                 <ShieldAlert size={14} />
                 {(analysis.status === 'PENDIENTE_DIRECTOR' || analysis.status === 'PENDIENTE_CARTERA') ? `RIESGO ${analysis.riskLevel || '...'}` : analysis.status}
               </div>
             </div>
          </div>

          {/* Conditional View based on Status */}
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
                    {/* Welcome Letter Action */}
                    <div className="bg-white p-6 rounded-3xl shadow-sm border border-green-100">
                      <h4 className="font-bold text-slate-900 uppercase text-xs mb-4 flex items-center gap-2">
                        <FileText size={16} /> Carta de Bienvenida
                      </h4>
                      <div className="flex gap-2">
                        <button 
                          onClick={() => setShowWelcomeLetter(true)}
                          className="flex-1 py-3 bg-slate-900 text-white rounded-xl font-bold text-xs uppercase flex items-center justify-center gap-2 hover:bg-slate-800"
                        >
                          <Printer size={16} /> Ver PDF
                        </button>
                      </div>
                    </div>

                    {/* Email Action */}
                    <div className="bg-white p-6 rounded-3xl shadow-sm border border-green-100">
                      <h4 className="font-bold text-slate-900 uppercase text-xs mb-4 flex items-center gap-2">
                        <Mail size={16} /> Enviar Notificación
                      </h4>
                      <form onSubmit={handleSendEmail} className="space-y-3">
                        <input 
                          type="email" 
                          placeholder="Email del Cliente" 
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-sm font-medium"
                          value={emailTo}
                          onChange={e => setEmailTo(e.target.value)}
                          required
                        />
                        <button 
                          type="submit"
                          disabled={sendingEmail}
                          className="w-full py-3 bg-green-600 text-white rounded-xl font-bold text-xs uppercase flex items-center justify-center gap-2 hover:bg-green-700 disabled:opacity-50"
                        >
                          {sendingEmail ? <Loader2 className="animate-spin" /> : <Send size={16} />}
                          {emailSent ? 'Enviado' : 'Enviar Correo'}
                        </button>
                      </form>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

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
                        className="w-full h-48 bg-slate-50 p-4 rounded-xl text-sm text-slate-600 border-none resize-none font-mono"
                        value={generateRejectionEmailText(analysis)}
                     />
                     
                     <div className="mt-4 pt-4 border-t border-slate-100">
                        <h4 className="font-bold text-slate-900 uppercase text-xs mb-3 flex items-center gap-2">
                          <Mail size={14} /> Enviar Respuesta Directa
                        </h4>
                        <form onSubmit={handleSendEmail} className="flex gap-3">
                          <input 
                            type="email" 
                            placeholder="Email del Cliente" 
                            className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-sm font-medium"
                            value={emailTo}
                            onChange={e => setEmailTo(e.target.value)}
                            required
                          />
                          <button 
                            type="submit"
                            disabled={sendingEmail}
                            className="px-6 py-2 bg-slate-900 text-white rounded-xl font-bold text-xs uppercase hover:bg-slate-800 disabled:opacity-50"
                          >
                            {emailSent ? 'Enviado' : 'Enviar'}
                          </button>
                        </form>
                     </div>
                   </div>
                 </div>
              </div>
            </div>
          )}

          {/* Indicators Table (Detailed) */}
          {analysis.indicators && (
            <div className="bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-sm">
              <h3 className="flex items-center gap-3 text-lg font-black uppercase text-slate-900 mb-6">
                <TrendingUp className="text-equitel-red" />
                Resumen de Indicadores Financieros
              </h3>
              <FinancialIndicatorsTable indicators={analysis.indicators} />
            </div>
          )}

          {/* Cupo Calculation Breakdown - Hidden for Commercial unless Approved */}
          {userRole === UserRole.DIRECTOR && analysis.cupo && (
            <div className="bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-sm">
              <h3 className="flex items-center gap-3 text-lg font-black uppercase text-slate-900 mb-6">
                <DollarSign className="text-equitel-red" />
                Cálculo de Cupo Sugerido (Fórmula 6 Indicadores)
              </h3>
              <CupoCalculationBreakdown cupo={analysis.cupo} />
            </div>
          )}

          {/* AI Guidance - Only Show if Pending/Analizado and Director */}
          {userRole === UserRole.DIRECTOR && (analysis.status === 'PENDIENTE_DIRECTOR' || analysis.status === 'ANALIZADO') && (
            <div className="bg-indigo-50 rounded-[2.5rem] p-8 border border-indigo-100">
              <div className="flex items-center gap-3 mb-4">
                <Sparkles className="text-indigo-600" />
                <h3 className="font-black uppercase tracking-widest text-sm text-indigo-900">Concepto IA Estefanía</h3>
              </div>
              {loadingAi ? (
                <div className="flex items-center gap-2 text-indigo-400">
                  <Loader2 className="animate-spin" size={16} /> Generando análisis...
                </div>
              ) : (
                <p className="text-indigo-800 text-sm leading-relaxed font-medium text-justify">{aiRec}</p>
              )}
            </div>
          )}
        </div>

        {/* Right Column: Actions & Summary */}
        <div className="lg:col-span-4 space-y-8">
          
          {/* Action Card */}
          <div className="bg-white rounded-[2.5rem] p-8 border-2 shadow-xl border-slate-100 sticky top-8">
            <h4 className="text-[10px] font-black uppercase tracking-widest mb-6 text-slate-400 border-b pb-2">Dictamen de Crédito</h4>
            
            <div className="space-y-6">
              {/* Only Director sees Suggestions */}
              {userRole === UserRole.DIRECTOR && analysis.cupo && (
                <div className="grid grid-cols-2 gap-2 mb-4">
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                    <p className="text-[9px] font-bold text-slate-500 uppercase mb-1">Conservador</p>
                    <p className="text-lg font-black text-slate-900">{formatCOP(analysis.cupo.cupoConservador || 0)}</p>
                  </div>
                  <div className="bg-red-50 p-3 rounded-xl border border-red-100">
                    <p className="text-[9px] font-bold text-red-500 uppercase mb-1">Liberal</p>
                    <p className="text-lg font-black text-red-900">{formatCOP(analysis.cupo.cupoLiberal || 0)}</p>
                  </div>
                </div>
              )}

              {analysis.status === 'APROBADO' ? (
                 <div className="p-6 rounded-3xl border-2 border-green-500 bg-green-50">
                    <label className="text-[9px] font-black uppercase mb-2 block text-green-700 tracking-widest">Cupo Otorgado</label>
                    <p className="text-3xl font-black text-green-900">{formatCOP(analysis.assignedCupo || 0)}</p>
                 </div>
              ) : analysis.status === 'NEGADO' ? (
                 <div className="p-6 rounded-3xl border-2 border-red-500 bg-red-50">
                    <p className="text-xl font-black text-red-700 uppercase">Solicitud Rechazada</p>
                 </div>
              ) : (
                <>
                  {userRole === UserRole.DIRECTOR ? (
                    <div className={`p-6 rounded-3xl border-2 transition-all ${isHighRisk ? 'border-red-500 bg-red-50' : 'border-slate-100 bg-slate-50'}`}>
                      <label className="text-[9px] font-black uppercase mb-2 block text-slate-500 tracking-widest">Cupo Aprobado (COP)</label>
                      <div className="flex items-center gap-2">
                        <span className="text-slate-400 font-bold">$</span>
                        <input 
                          type="number"
                          className="w-full bg-transparent text-2xl font-black outline-none text-slate-900"
                          value={manualCupo}
                          onChange={e => setManualCupo(Number(e.target.value))}
                        />
                      </div>
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
                   <p className="text-xs font-bold text-slate-500 mb-2">Plazo Sugerido</p>
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
              <button onClick={() => setShowReport(true)} className="w-full mt-8 py-4 bg-slate-900 text-white rounded-xl font-bold flex items-center justify-center gap-3 hover:bg-slate-800 transition-all text-xs uppercase tracking-widest">
                 <Printer size={16} /> Imprimir Informe Interno
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Confirmation Modal for High Risk */}
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
                onClick={() => onAction(analysis.id, 'APROBADO', manualCupo)} 
                className="flex-1 py-4 bg-red-600 text-white rounded-2xl font-black hover:bg-red-700 transition-colors uppercase text-xs tracking-widest shadow-lg shadow-red-200"
              >
                Sí, Proceder
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PDF Viewers (Internal Report or Welcome Letter) */}
      {(showReport || showWelcomeLetter) && (
        <div id="printable-report-container" className="fixed inset-0 bg-white z-[200] overflow-y-auto">
          {/* Correction: Use items-start to ensure it starts at top, remove vertical centering */}
          <div className="min-h-screen bg-slate-100 flex justify-center items-start pt-8 pb-8 no-print">
             <div className="fixed top-4 right-4 flex gap-2 z-50">
               <button onClick={() => window.print()} className="bg-slate-900 text-white px-6 py-3 rounded-full font-bold shadow-lg hover:bg-slate-800 flex items-center gap-2">
                 <Printer size={18} /> Imprimir / Guardar PDF
               </button>
               <button onClick={() => { setShowReport(false); setShowWelcomeLetter(false); }} className="bg-white text-slate-900 px-6 py-3 rounded-full font-bold shadow-lg hover:bg-slate-50">
                 Cerrar
               </button>
             </div>
          </div>
          
          <div className="bg-white max-w-[21cm] mx-auto min-h-[29.7cm] p-[1.5cm] shadow-2xl relative print-paper mt-8 no-print-margin">
             {showWelcomeLetter ? (
               <div dangerouslySetInnerHTML={{ __html: generateWelcomeLetterHTML(analysis) }} />
             ) : (
               <InternalReport analysis={analysis} manualCupo={manualCupo} />
             )}
          </div>
        </div>
      )}
    </div>
  );
};

// Extracted Internal Report Component to separate logic
const InternalReport = ({ analysis, manualCupo }: { analysis: CreditAnalysis, manualCupo: number }) => (
  <>
    <div className="flex justify-between items-start border-b-4 border-equitel-red pb-6 mb-8">
      <div className="flex items-center gap-4">
        <div className="bg-equitel-red text-white w-16 h-16 flex items-center justify-center font-black text-4xl rounded-lg print-force-bg-gray print-force-text-dark">E</div>
        <div>
          <h1 className="text-2xl font-black uppercase text-slate-900 leading-none">Informe de Crédito</h1>
          <p className="text-xs font-bold text-slate-500 uppercase mt-1">Organización Equitel S.A.</p>
        </div>
      </div>
      <div className="text-right">
        <p className="text-xs font-bold text-slate-400 uppercase">Referencia</p>
        <p className="text-sm font-black text-slate-900">{analysis.id}</p>
        <p className="text-xs font-bold text-slate-400 uppercase mt-2">Fecha</p>
        <p className="text-sm font-black text-slate-900">{new Date().toLocaleDateString()}</p>
      </div>
    </div>

    <div className="bg-slate-50 p-6 rounded-xl border border-slate-100 mb-8 flex justify-between items-center print-force-bg-gray">
      <div>
        <p className="text-[10px] font-black uppercase text-slate-400 mb-1">Razón Social</p>
        <p className="text-xl font-black text-slate-900">{analysis.clientName}</p>
      </div>
      <div className="text-right">
        <p className="text-[10px] font-black uppercase text-slate-400 mb-1">NIT</p>
        <p className="text-xl font-black text-slate-900">{analysis.nit}</p>
      </div>
    </div>

    <div className="space-y-8">
      {analysis.indicators && (
        <section>
          <h4 className="text-sm font-black uppercase text-slate-900 border-b-2 border-slate-100 pb-2 mb-4 flex items-center gap-2">
            <TrendingUp size={16} className="text-equitel-red" /> 1. Indicadores Financieros
          </h4>
          <FinancialIndicatorsTable indicators={analysis.indicators} compact />
        </section>
      )}

      {analysis.cupo && (
        <section className="avoid-break">
          <h4 className="text-sm font-black uppercase text-slate-900 border-b-2 border-slate-100 pb-2 mb-4 flex items-center gap-2">
            <DollarSign size={16} className="text-equitel-red" /> 2. Cálculo de Cupo Sugerido
          </h4>
          <CupoCalculationBreakdown cupo={analysis.cupo} />
        </section>
      )}

      <section className="avoid-break page-break">
        <h4 className="text-sm font-black uppercase text-slate-900 border-b-2 border-slate-100 pb-2 mb-4 flex items-center gap-2">
          <FileText size={16} className="text-equitel-red" /> 3. Análisis de Riesgo y Dictamen
        </h4>
        
        {analysis.indicators && (
          <div className="grid grid-cols-2 gap-6 mb-6">
            <div className="bg-slate-50 p-4 rounded-lg border border-slate-100 print-force-bg-gray">
              <p className="text-[10px] font-black uppercase text-slate-400 mb-2">Análisis Z-Altman</p>
              <p className="text-lg font-bold text-slate-800">{analysis.indicators.zAltman.toFixed(2)}</p>
              <p className="text-xs text-slate-500 mt-1">
                {analysis.indicators.zAltman > 2.6 ? "Zona Segura (Bajo Riesgo)" : analysis.indicators.zAltman < 1.1 ? "Zona de Peligro (Alto Riesgo)" : "Zona Gris (Riesgo Moderado)"}
              </p>
            </div>
            <div className="bg-slate-50 p-4 rounded-lg border border-slate-100 print-force-bg-gray">
              <p className="text-[10px] font-black uppercase text-slate-400 mb-2">Probabilidad de Mora</p>
              <p className="text-lg font-bold text-slate-800">{analysis.moraProbability || 'N/A'}</p>
            </div>
          </div>
        )}

        <div className="border-t-2 border-dashed border-slate-200 pt-8 mt-12">
          <div className="flex justify-between items-end">
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase mb-2">Cupo Aprobado</p>
              <p className="text-4xl font-black text-slate-900">{formatCOP(manualCupo)}</p>
              <p className="text-xs font-bold uppercase text-slate-500 mt-1">{numberToLetters(manualCupo)}</p>
            </div>
            <div className="text-right">
              <div className="w-64 border-b border-slate-900 mb-2"></div>
              <p className="text-xs font-black uppercase text-slate-900">John Deyver Campos Moya</p>
              <p className="text-[10px] font-bold text-slate-400 uppercase">Director Nacional de Cartera</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  </>
);

const FinancialIndicatorsTable = ({ indicators, compact = false }: { indicators: FinancialIndicators, compact?: boolean }) => {
  const rowClass = compact ? "py-2 px-4" : "py-3 px-6";
  const textClass = compact ? "text-xs" : "text-sm";
  
  const categories = [
    {
      title: "Liquidez",
      items: [
        { label: "Razón Corriente", value: indicators.razonCorriente.toFixed(2) },
        { label: "Prueba Ácida", value: indicators.pruebaAcida.toFixed(2) },
        { label: "KNT (Capital de Trabajo)", value: formatCOP(indicators.knt) },
      ]
    },
    {
      title: "Endeudamiento",
      items: [
        { label: "Nivel Endeudamiento Global", value: formatPercent(indicators.endeudamientoGlobal) },
        { label: "Endeudamiento Corto Plazo", value: formatPercent(indicators.endeudamientoCP) },
        { label: "Solvencia (Pasivo/Patrimonio)", value: formatPercent(indicators.solvencia) },
      ]
    },
    {
      title: "Rentabilidad & Márgenes",
      items: [
        { label: "ROA (Activo)", value: formatPercent(indicators.roa) },
        { label: "ROE (Patrimonio)", value: formatPercent(indicators.roe) },
        { label: "Margen Operacional", value: formatPercent(indicators.margenOperacional) },
        { label: "Margen Neto", value: formatPercent(indicators.margenNeto) },
      ]
    },
    {
      title: "Operación & Eficiencia",
      items: [
        { label: "EBITDA", value: formatCOP(indicators.ebitda) },
        { label: "Días Recuperación Cartera", value: `${indicators.diasCartera.toFixed(0)} días` },
        { label: "Días Rotación Inventario", value: `${indicators.diasInventario.toFixed(0)} días` },
        { label: "Ciclo Operacional", value: `${indicators.cicloOperacional.toFixed(0)} días` },
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
            <th className={`${rowClass} text-right`}>Resultado</th>
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
      <div className="mt-4 p-4 bg-slate-900 text-white rounded-xl flex justify-between items-center shadow-lg">
        <span className="font-bold uppercase text-xs tracking-widest">Resultado Promedio (6 Indicadores)</span>
        <span className="text-2xl font-black text-equitel-red">{formatCOP(cupo.resultadoPromedio)}</span>
      </div>
    </div>
  );
};

export default AnalysisDetailView;
