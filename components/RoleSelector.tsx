
import React from 'react';
import { UserRole } from '../types';
import { ShieldAlert, Users, Briefcase, FileText } from 'lucide-react';

interface RoleSelectorProps {
  onSelect: (role: UserRole) => void;
}

const RoleSelector: React.FC<RoleSelectorProps> = ({ onSelect }) => {
  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="max-w-6xl w-full grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Comercial */}
        <button 
          onClick={() => onSelect(UserRole.COMERCIAL)}
          className="bg-slate-800 p-8 rounded-[3rem] border border-slate-700 hover:border-equitel-red transition-all group text-left flex flex-col h-full"
        >
          <div className="w-16 h-16 bg-slate-700 rounded-2xl flex items-center justify-center mb-6 group-hover:bg-equitel-red transition-colors">
            <Users className="text-white" size={32} />
          </div>
          <h2 className="text-2xl font-black text-white mb-4">Comercial</h2>
          <p className="text-slate-400 text-sm leading-relaxed mb-6 flex-1">Inicio de solicitud. Carga de documentos legales y financieros básicos.</p>
          <div className="text-[10px] font-bold text-slate-500 bg-slate-900/50 p-2 rounded-lg inline-block">
            RESTRICTED: Sin acceso a riesgo
          </div>
        </button>

        {/* Analista Cartera */}
        <button 
          onClick={() => onSelect(UserRole.CARTERA)}
          className="bg-slate-800 p-8 rounded-[3rem] border border-slate-700 hover:border-equitel-red transition-all group text-left flex flex-col h-full"
        >
          <div className="w-16 h-16 bg-slate-700 rounded-2xl flex items-center justify-center mb-6 group-hover:bg-equitel-red transition-colors">
            <FileText className="text-white" size={32} />
          </div>
          <h2 className="text-2xl font-black text-white mb-4">Analista Cartera</h2>
          <p className="text-slate-400 text-sm leading-relaxed mb-6 flex-1">Gestión de trámites. Carga de DataCrédito e Informa Colombia.</p>
          <div className="text-[10px] font-bold text-blue-400 bg-blue-900/20 p-2 rounded-lg inline-block">
            TRIGGER: Notificación Email
          </div>
        </button>

        {/* Director */}
        <button 
          onClick={() => onSelect(UserRole.DIRECTOR)}
          className="bg-slate-800 p-8 rounded-[3rem] border border-slate-700 hover:border-equitel-red transition-all group text-left flex flex-col h-full"
        >
          <div className="w-16 h-16 bg-slate-700 rounded-2xl flex items-center justify-center mb-6 group-hover:bg-equitel-red transition-colors">
            <Briefcase className="text-white" size={32} />
          </div>
          <h2 className="text-2xl font-black text-white mb-4">Director Nacional</h2>
          <p className="text-slate-400 text-sm leading-relaxed mb-6 flex-1">Aprobación final. Ejecución de análisis de IA y asignación de cupo.</p>
          <div className="text-[10px] font-bold text-red-400 bg-red-900/20 p-2 rounded-lg inline-block">
            SECURITY: PIN Required
          </div>
        </button>
      </div>
    </div>
  );
};

export default RoleSelector;
