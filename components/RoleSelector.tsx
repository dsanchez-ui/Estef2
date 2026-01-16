
import React from 'react';
import { UserRole } from '../types';
import { Users, Briefcase, FileText } from 'lucide-react';

interface RoleSelectorProps {
  onSelect: (role: UserRole) => void;
}

const LogoSVG = ({ className = "w-full h-full", color = "black" }: { className?: string, color?: string }) => (
  <svg className={className} viewBox="0 0 200 60" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="30" cy="30" r="25" stroke={color} strokeWidth="4" fill="none"/>
    <path 
      d="M 42 20 L 27 20 Q 20 20 20 27 L 20 33 Q 20 40 27 40 L 42 40" 
      stroke="#DA291C" 
      strokeWidth="5" 
      strokeLinecap="butt" 
      fill="none"
    />
    <path 
      d="M 27 30 L 38 30" 
      stroke="#DA291C" 
      strokeWidth="5" 
      strokeLinecap="butt"
    />
    <text x="65" y="38" fill={color} fontFamily="Inter, sans-serif" fontWeight="900" fontSize="24" letterSpacing="0.1em">EQUITEL</text>
  </svg>
);

const RoleSelector: React.FC<RoleSelectorProps> = ({ onSelect }) => {
  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center p-4 md:p-8">
      {/* Header Logo */}
      <div className="w-64 h-24 mb-12 flex flex-col items-center">
        <LogoSVG color="black" />
        <span className="text-[10px] font-black text-slate-400 tracking-[0.4em] uppercase mt-2">Credit Risk Center</span>
      </div>

      <div className="max-w-6xl w-full grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Comercial */}
        <button 
          onClick={() => onSelect(UserRole.COMERCIAL)}
          className="bg-white p-10 rounded-[3rem] border-2 border-slate-100 hover:border-equitel-red transition-all group text-left flex flex-col h-full shadow-xl shadow-slate-200/50 hover:shadow-red-100"
        >
          <div className="w-16 h-16 bg-black rounded-2xl flex items-center justify-center mb-8 group-hover:bg-equitel-red transition-colors shadow-lg shadow-slate-200">
            <Users className="text-white" size={32} />
          </div>
          <h2 className="text-3xl font-black text-black mb-4 tracking-tight">Comercial</h2>
          <p className="text-slate-500 text-sm leading-relaxed mb-8 flex-1">Inicio de solicitud. Carga de documentos legales y financieros básicos.</p>
        </button>

        {/* Analista Cartera */}
        <button 
          onClick={() => onSelect(UserRole.CARTERA)}
          className="bg-white p-10 rounded-[3rem] border-2 border-slate-100 hover:border-equitel-red transition-all group text-left flex flex-col h-full shadow-xl shadow-slate-200/50 hover:shadow-red-100"
        >
          <div className="w-16 h-16 bg-black rounded-2xl flex items-center justify-center mb-8 group-hover:bg-equitel-red transition-colors shadow-lg shadow-slate-200">
            <FileText className="text-white" size={32} />
          </div>
          <h2 className="text-3xl font-black text-black mb-4 tracking-tight">Analista</h2>
          <p className="text-slate-500 text-sm leading-relaxed mb-8 flex-1">Gestión de trámites. Carga de DataCrédito e Informa Colombia.</p>
          <div className="text-[10px] font-black text-slate-900 bg-slate-50 p-3 rounded-xl inline-block uppercase tracking-widest border border-slate-200 group-hover:border-equitel-red/30">
            Workflow: Cartera
          </div>
        </button>

        {/* Director */}
        <button 
          onClick={() => onSelect(UserRole.DIRECTOR)}
          className="bg-white p-10 rounded-[3rem] border-2 border-slate-100 hover:border-equitel-red transition-all group text-left flex flex-col h-full shadow-xl shadow-slate-200/50 hover:shadow-red-100"
        >
          <div className="w-16 h-16 bg-black rounded-2xl flex items-center justify-center mb-8 group-hover:bg-equitel-red transition-colors shadow-lg shadow-slate-200">
            <Briefcase className="text-white" size={32} />
          </div>
          <h2 className="text-3xl font-black text-black mb-4 tracking-tight">Director</h2>
          <p className="text-slate-500 text-sm leading-relaxed mb-8 flex-1">Aprobación final. Ejecución de análisis de IA y asignación de cupo.</p>
          <div className="text-[10px] font-black text-equitel-red bg-red-50 p-3 rounded-xl inline-block uppercase tracking-widest border border-red-100">
            Requiere PIN Seguridad
          </div>
        </button>
      </div>

      <p className="mt-16 text-[10px] font-black text-slate-300 uppercase tracking-[0.5em]">Organización Equitel 2025</p>
    </div>
  );
};

export default RoleSelector;
