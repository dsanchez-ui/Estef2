
import React, { useState } from 'react';
import { Lock, Loader2, AlertCircle } from 'lucide-react';
import { verifyRemotePIN } from '../services/server';

interface PINModalProps {
  onSuccess: () => void;
  onCancel: () => void;
}

const PINModal: React.FC<PINModalProps> = ({ onSuccess, onCancel }) => {
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pin.length !== 6) return;

    setLoading(true);
    setError(false);
    
    try {
        const isValid = await verifyRemotePIN(pin);
        if (isValid) {
            onSuccess();
        } else {
            setError(true);
            setPin('');
        }
    } catch (e) {
        setError(true);
        console.error("PIN Check failed", e);
    } finally {
        setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950 flex items-center justify-center z-[100] p-4">
      <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-[2.5rem] p-10 text-center shadow-2xl">
        <div className="w-20 h-20 bg-equitel-red/20 text-equitel-red rounded-3xl flex items-center justify-center mx-auto mb-8">
          <Lock size={40} />
        </div>
        <h2 className="text-2xl font-black text-white mb-2 uppercase">Acceso Restringido</h2>
        <p className="text-slate-500 text-sm mb-8">Director Nacional: Ingrese su PIN de seguridad (6 dígitos).</p>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <input 
            type="password" 
            autoFocus
            maxLength={6}
            disabled={loading}
            className={`w-full text-center text-4xl tracking-[0.5em] py-4 bg-slate-800 border-2 rounded-2xl outline-none transition-all ${
              error ? 'border-red-500 text-red-500' : 'border-slate-700 text-white focus:border-equitel-red'
            }`}
            value={pin}
            onChange={e => {
              setError(false);
              setPin(e.target.value);
            }}
          />
          {error && <p className="text-red-500 text-xs font-bold flex items-center justify-center gap-2"><AlertCircle size={12}/> PIN Incorrecto</p>}
          
          <div className="flex gap-4">
            <button type="button" onClick={onCancel} className="flex-1 py-4 text-slate-400 font-bold hover:text-white transition-colors" disabled={loading}>CANCELAR</button>
            <button 
              type="submit" 
              className="flex-1 py-4 bg-equitel-red text-white rounded-2xl font-bold hover:bg-red-700 transition-colors flex items-center justify-center gap-2"
              disabled={loading}
            >
              {loading && <Loader2 className="animate-spin" size={18} />}
              {loading ? "VERIFICANDO..." : "VERIFICAR"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PINModal;
