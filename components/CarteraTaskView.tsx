
import React, { useState } from 'react';
import { CreditAnalysis } from '../types';
import { Upload, CheckCircle, ArrowRight, FileText, Send, Loader2 } from 'lucide-react';

interface CarteraTaskViewProps {
  analysis: CreditAnalysis;
  onAdvance: (updatedAnalysis: CreditAnalysis) => void;
  onBack: () => void;
}

const CarteraTaskView: React.FC<CarteraTaskViewProps> = ({ analysis, onAdvance, onBack }) => {
  const [loading, setLoading] = useState(false);
  const [riskFiles, setRiskFiles] = useState<{ datacredito: File | null; informa: File | null }>({
    datacredito: analysis.riskFiles?.datacredito || null,
    informa: analysis.riskFiles?.informa || null
  });

  const canAdvance = !!(riskFiles.datacredito && riskFiles.informa);

  const handleSubmit = async () => {
    setLoading(true);
    // Simulate processing
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    onAdvance({
      ...analysis,
      riskFiles: riskFiles,
      status: 'PENDIENTE_DIRECTOR'
    });
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <button onClick={onBack} className="text-slate-400 hover:text-slate-600 font-bold text-xs">← VOLVER</button>
        <h2 className="text-xl font-black uppercase text-slate-900">Gestión Analista de Cartera</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Left: Summary of Commercial Uploads (Read Only) */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200">
           <div className="flex items-center gap-3 mb-4 pb-4 border-b">
             <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center">
               <FileText size={20} className="text-slate-500" />
             </div>
             <div>
               <h3 className="font-bold text-slate-900 text-sm">Documentación Comercial</h3>
               <p className="text-[10px] text-slate-400">Cargado por {analysis.comercial.name}</p>
             </div>
           </div>
           
           <div className="grid grid-cols-2 gap-2">
             {Object.entries(analysis.commercialFiles).map(([key, file]) => (
               <div key={key} className="p-3 bg-slate-50 rounded-xl flex items-center gap-2 border border-slate-100">
                 <CheckCircle size={14} className="text-green-500" />
                 <span className="text-[10px] font-bold uppercase text-slate-600 truncate flex-1">
                   {key.replace(/([A-Z])/g, ' $1').trim()}
                 </span>
                 <span className="text-[9px] text-slate-400 bg-white px-2 rounded border">PDF</span>
               </div>
             ))}
           </div>
        </div>

        {/* Right: Risk Uploads (Action Required) */}
        <div className="bg-black p-8 rounded-3xl border border-slate-800 relative overflow-hidden text-white">
           <div className="absolute top-0 right-0 p-6 opacity-20 text-equitel-red">
             <Upload size={100} />
           </div>
           <h3 className="font-bold text-white text-sm mb-2 uppercase">Acción Requerida</h3>
           <p className="text-xs text-slate-400 mb-6">Cargar reportes de centrales de riesgo para completar el expediente.</p>
           
           <div className="space-y-4">
             <RiskFileDrop 
               label="Informe DataCrédito" 
               file={riskFiles.datacredito} 
               onSelect={(f: File) => setRiskFiles({...riskFiles, datacredito: f})} 
             />
             <RiskFileDrop 
               label="Informe Informa Colombia" 
               file={riskFiles.informa} 
               onSelect={(f: File) => setRiskFiles({...riskFiles, informa: f})} 
             />
           </div>

           <button 
             onClick={handleSubmit}
             disabled={!canAdvance || loading}
             className="w-full mt-8 py-4 bg-equitel-red text-white rounded-xl font-black uppercase text-xs tracking-widest hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-red-900/50"
           >
             {loading ? <Loader2 className="animate-spin" /> : <Send size={16} />}
             {loading ? "Procesando..." : "Avanzar a Director"}
           </button>
        </div>
      </div>
    </div>
  );
};

// IMPROVED RiskFileDrop: Label as container
const RiskFileDrop = ({ label, file, onSelect }: any) => (
  <label 
    htmlFor={label}
    className={`
      relative border-2 border-dashed rounded-xl p-4 transition-all text-center group cursor-pointer block
      ${file ? 'border-green-400 bg-green-900/20' : 'border-slate-700 bg-slate-900 hover:border-equitel-red'}
    `}
  >
     <input 
       type="file" 
       className="hidden" 
       id={label} 
       accept=".pdf" 
       onChange={e => e.target.files && onSelect(e.target.files[0])} 
     />
     
     {file ? (
       <div className="flex items-center justify-center gap-2 text-green-400">
         <CheckCircle size={16} />
         <span className="text-xs font-bold truncate max-w-[150px]">{file.name}</span>
       </div>
     ) : (
       <div className="flex items-center justify-center gap-2 text-slate-400 group-hover:text-white">
         <Upload size={16} />
         <span className="text-xs font-bold uppercase">{label}</span>
       </div>
     )}
  </label>
);

export default CarteraTaskView;
