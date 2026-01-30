
import React, { useState } from 'react';
import { UserRole } from '../types';
import { Users, Briefcase, FileText, Lock, X, ArrowRight, AlertCircle, Loader2 } from 'lucide-react';
import { verifyRemotePIN } from '../services/server';

interface RoleSelectorProps {
  onSelect: (role: UserRole, email?: string) => void;
}

const CARTERA_WHITELIST = [
  "jcampos@equitel.com.co",
  "nhernandez@equitel.com.co",
  "pcartera@equitel.com.co",
  "cartera2@equitel.com.co"
];

const LogoSVG = ({ className = "w-full h-full", color = "black" }: { className?: string, color?: string }) => (
  <svg className={className} viewBox="0 0 200 60" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="30" cy="30" r="25" stroke={color} strokeWidth="4" fill="none"/>
    
    {/* Rotated E Group */}
    <g transform="rotate(-30 30 30)">
      <path 
        d="M 42 20 L 27 20 Q 20 20 20 27 L 20 33 Q 20 40 27 40 L 42 40" 
        stroke="#DA291C" 
        strokeWidth="5" 
        strokeLinecap="butt" 
        fill="none"
      />
      <path 
        d="M 27 30 L 42 30" 
        stroke="#DA291C" 
        strokeWidth="5" 
        strokeLinecap="butt"
      />
    </g>
    
    <text x="65" y="38" fill={color} fontFamily="Inter, sans-serif" fontWeight="900" fontSize="24" letterSpacing="0.1em">EQUITEL</text>
  </svg>
);

const RoleSelector: React.FC<RoleSelectorProps> = ({ onSelect }) => {
  const [showCarteraAuth, setShowCarteraAuth] = useState(false);
  const [email, setEmail] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleCarteraLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const cleanEmail = email.trim().toLowerCase();

    // 1. WhiteList Check
    if (!CARTERA_WHITELIST.includes(cleanEmail)) {
      setError("Acceso denegado. Correo no autorizado para el rol de Cartera.");
      setLoading(false);
      return;
    }

    // 2. PIN Validation Check (against Backend for this specific email)
    if (pin.length !== 6) {
        setError("El PIN debe tener 6 dígitos.");
        setLoading(false);
        return;
    }

    try {
        const isValid = await verifyRemotePIN(pin, cleanEmail);
        if (isValid) {
            onSelect(UserRole.CARTERA, cleanEmail);
        } else {
            setError("PIN incorrecto.");
        }
    } catch (e) {
        setError("Error de conexión validando credenciales.");
    } finally {
        setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center p-4 md:p-8 relative">
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

        {/* Analista Cartera - Restricted Access */}
        <button 
          onClick={() => { setShowCarteraAuth(true); setError(''); setEmail(''); setPin(''); }}
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

      {/* Cartera Authentication Modal */}
      {showCarteraAuth && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white w-full max-w-md p-8 rounded-[2rem] shadow-2xl relative border border-slate-100">
            <button 
                onClick={() => setShowCarteraAuth(false)}
                className="absolute top-6 right-6 text-slate-400 hover:text-slate-900 bg-slate-50 p-2 rounded-full hover:bg-slate-100 transition-colors"
            >
                <X size={20} />
            </button>

            <div className="flex flex-col items-center text-center mb-8">
                <div className="w-16 h-16 bg-slate-50 text-slate-900 rounded-2xl flex items-center justify-center mb-4 border border-slate-200">
                    <Lock size={32} />
                </div>
                <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Acceso Cartera</h3>
                <p className="text-slate-500 text-sm font-medium mt-1">Valide su identidad para continuar</p>
            </div>

            <form onSubmit={handleCarteraLogin} className="space-y-4">
                <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase ml-2 mb-1 block">Correo Corporativo</label>
                    <input 
                        type="email" 
                        autoFocus
                        placeholder="usuario@equitel.com.co"
                        className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 outline-none focus:ring-2 focus:ring-equitel-red placeholder:text-slate-300"
                        value={email}
                        onChange={e => { setEmail(e.target.value); setError(''); }}
                        disabled={loading}
                    />
                </div>
                
                <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase ml-2 mb-1 block">PIN de Seguridad (6 dígitos)</label>
                    <input 
                        type="password" 
                        maxLength={6}
                        placeholder="••••••"
                        className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 outline-none focus:ring-2 focus:ring-equitel-red placeholder:text-slate-300 tracking-[0.5em] text-center"
                        value={pin}
                        onChange={e => { setPin(e.target.value.replace(/\D/g,'')); setError(''); }}
                        disabled={loading}
                    />
                </div>
                
                {error && (
                    <div className="p-3 bg-red-50 text-red-600 text-xs font-bold rounded-xl flex items-center gap-2 border border-red-100 animate-in slide-in-from-top-1">
                        <AlertCircle size={16} /> {error}
                    </div>
                )}

                <button 
                    type="submit"
                    disabled={loading}
                    className="w-full py-4 bg-slate-900 text-white rounded-xl font-black uppercase tracking-widest hover:bg-slate-800 transition-colors flex items-center justify-center gap-2 shadow-lg disabled:opacity-50"
                >
                    {loading ? <Loader2 className="animate-spin" size={18} /> : <>Ingresar <ArrowRight size={18} /></>}
                </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default RoleSelector;
