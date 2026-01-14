
import React from 'react';
import { CheckCircle, ArrowRight, Share2 } from 'lucide-react';

interface SuccessViewProps {
  id: string;
  onClose: () => void;
}

const SuccessView: React.FC<SuccessViewProps> = ({ id, onClose }) => {
  return (
    <div className="min-h-[80vh] flex items-center justify-center p-4 animate-in fade-in zoom-in duration-500">
      <div className="max-w-md w-full bg-white rounded-[3rem] shadow-2xl border border-slate-100 p-10 text-center space-y-8">
        <div className="relative mx-auto w-24 h-24 bg-green-100 rounded-full flex items-center justify-center">
          <CheckCircle size={48} className="text-green-600 animate-bounce" />
          <div className="absolute inset-0 bg-green-400 rounded-full animate-ping opacity-20"></div>
        </div>

        <div className="space-y-4">
          <h2 className="text-3xl font-black text-slate-900 uppercase tracking-tight">Proceso Iniciado</h2>
          <div className="bg-slate-50 py-4 px-6 rounded-2xl border border-slate-100">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">ID del Análisis</p>
            <p className="text-2xl font-black text-equitel-red tracking-wider">{id}</p>
          </div>
          
          <div className="py-4 space-y-2">
            <p className="text-slate-700 font-bold text-lg">
              Solicitud creada exitosamente.
            </p>
            <p className="text-slate-500 text-sm leading-relaxed">
              El caso ha sido transferido al equipo de <span className="font-bold text-slate-700">Cartera</span>, quienes completarán la documentación (Centrales de Riesgo) para avanzar el caso hacia el análisis financiero.
            </p>
          </div>
        </div>

        <button 
          onClick={onClose}
          className="w-full py-5 bg-slate-900 text-white rounded-2xl font-black flex items-center justify-center gap-3 hover:bg-slate-800 transition-all shadow-xl shadow-slate-200"
        >
          <span>Volver al Inicio</span>
          <ArrowRight size={18} />
        </button>
        
        <div className="flex items-center justify-center gap-2 pt-2">
          <Share2 size={12} className="text-slate-300" />
          <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Organización Equitel</span>
        </div>
      </div>
    </div>
  );
};

export default SuccessView;
