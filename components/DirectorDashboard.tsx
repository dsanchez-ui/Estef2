
import React, { useState } from 'react';
import { CreditAnalysis } from '../types';
import { Settings, Lock, CheckCircle2, AlertCircle } from 'lucide-react';
import { updateStoredPIN } from '../utils/security';

interface DirectorDashboardProps {
  analyses: CreditAnalysis[];
  onSelect: (analysis: CreditAnalysis) => void;
  // Deprecated props removed, keeping interface clean or optional if needed elsewhere
  notificationEmails?: string;
  onUpdateEmails?: (emails: string) => void;
}

const DirectorDashboard: React.FC<DirectorDashboardProps> = ({ 
  analyses, 
  onSelect
}) => {
  const [showSettings, setShowSettings] = useState(false);
  
  // New PIN State
  const [newPin, setNewPin] = useState('');
  const [pinStatus, setPinStatus] = useState<{success: boolean, msg: string} | null>(null);

  // UPDATED FILTER: Include 'ANALIZADO' as it is waiting for Director decision
  const pending = analyses.filter(a => a.status === 'PENDIENTE_DIRECTOR' || a.status === 'ANALIZADO');
  const history = analyses.filter(a => a.status !== 'PENDIENTE_DIRECTOR' && a.status !== 'ANALIZADO' && a.status !== 'PENDIENTE_CARTERA');

  const handleChangePin = () => {
    if (newPin.length !== 6) {
        setPinStatus({ success: false, msg: "El PIN debe tener exactamente 6 dígitos." });
        return;
    }
    
    const success = updateStoredPIN(newPin);
    if (success) {
        setPinStatus({ success: true, msg: "PIN actualizado correctamente." });
        setNewPin('');
        setTimeout(() => {
            setShowSettings(false);
            setPinStatus(null);
        }, 2000);
    } else {
        setPinStatus({ success: false, msg: "Error al guardar. Use solo números." });
    }
  };

  return (
    <div className="space-y-8 relative">
      <div className="flex items-end justify-between">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight">Panel Director</h2>
          <p className="text-slate-500">Decisión de Crédito y Configuración</p>
        </div>
        <button 
          onClick={() => setShowSettings(!showSettings)}
          className="p-3 bg-white border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50 transition-colors"
        >
          <Settings size={20} />
        </button>
      </div>

      {showSettings && (
        <div className="bg-slate-900 text-white p-6 rounded-3xl animate-in slide-in-from-top-4 shadow-xl border border-slate-800">
          <h3 className="font-bold text-sm uppercase mb-4 flex items-center gap-2 text-slate-200">
            <Lock size={16} /> Seguridad: Cambiar PIN de Acceso
          </h3>
          <div className="flex flex-col md:flex-row gap-4 items-start md:items-center">
            <div className="flex-1 w-full">
                <input 
                  type="password"
                  value={newPin}
                  onChange={(e) => {
                      // Only allow numbers
                      const val = e.target.value.replace(/\D/g, '');
                      setNewPin(val);
                      setPinStatus(null);
                  }}
                  maxLength={6}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-lg font-mono text-white focus:ring-2 focus:ring-equitel-red outline-none tracking-[0.5em] text-center placeholder:tracking-normal placeholder:text-sm" 
                  placeholder="Nuevo PIN (6 dígitos)"
                />
            </div>
            <button 
              onClick={handleChangePin}
              disabled={newPin.length !== 6}
              className="w-full md:w-auto px-8 py-3 bg-equitel-red rounded-xl font-bold text-xs uppercase hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Actualizar
            </button>
          </div>
          
          {pinStatus && (
              <div className={`mt-4 p-3 rounded-xl flex items-center gap-2 text-xs font-bold ${pinStatus.success ? 'bg-green-900/50 text-green-400' : 'bg-red-900/50 text-red-400'}`}>
                  {pinStatus.success ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                  {pinStatus.msg}
              </div>
          )}
          
          <p className="text-[10px] text-slate-500 mt-4 border-t border-slate-800 pt-2">
             Nota: Este PIN se guarda localmente en este navegador. Si borra la caché, volverá al PIN por defecto (442502).
          </p>
        </div>
      )}

      {/* Pending Approval Section */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b bg-amber-50/50 flex items-center justify-between">
          <h3 className="font-bold text-amber-900 uppercase text-sm tracking-widest flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
            Pendientes de Decisión (Documentación Completa y Análisis Finalizado)
          </h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 text-[10px] font-black uppercase tracking-wider text-slate-400">
              <tr>
                <th className="px-6 py-4">Cliente / NIT</th>
                <th className="px-6 py-4">Solicitante</th>
                <th className="px-6 py-4">Estado</th>
                <th className="px-6 py-4 text-center">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {pending.map(a => (
                <tr key={a.id} className="hover:bg-slate-50 cursor-pointer group" onClick={() => onSelect(a)}>
                  <td className="px-6 py-4">
                    <span className="inline-block px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 text-[9px] font-black mb-1">
                      {a.id}
                    </span>
                    <p className="font-bold text-slate-800">{a.clientName}</p>
                    <p className="text-xs text-slate-400">{a.nit}</p>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600">
                    {a.comercial?.name || "Sin Asesor"}
                  </td>
                  <td className="px-6 py-4">
                    <span className="px-2 py-1 bg-amber-100 text-amber-700 rounded-full text-[9px] font-black uppercase">
                      LISTO PARA DECISIÓN
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <button className="px-4 py-2 bg-slate-900 text-white text-[10px] font-bold uppercase rounded-lg group-hover:bg-equitel-red transition-colors">
                      Revisar
                    </button>
                  </td>
                </tr>
              ))}
              {pending.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-12 text-center text-slate-400 italic text-sm">
                    No hay solicitudes listas para revisión.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* History Section */}
      <div className="opacity-60 hover:opacity-100 transition-opacity">
        <h3 className="font-bold text-slate-400 uppercase text-xs mb-4 ml-2">Historial Reciente</h3>
        <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden">
          <table className="w-full text-left">
            <tbody className="divide-y divide-slate-100">
              {history.map(a => (
                <tr key={a.id} className="hover:bg-slate-50" onClick={() => onSelect(a)}>
                  <td className="px-6 py-4 text-sm font-medium text-slate-600">
                    <span className="block text-[9px] font-black text-slate-400">{a.id}</span>
                    {a.clientName}
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-400">{a.date}</td>
                  <td className="px-6 py-4 text-right">
                    <StatusBadge status={a.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

const StatusBadge = ({ status }: { status: string }) => {
  const styles: Record<string, string> = {
    'APROBADO': 'bg-green-100 text-green-700',
    'NEGADO': 'bg-red-100 text-red-700',
    'ANALIZADO': 'bg-blue-100 text-blue-700'
  };
  return <span className={`px-2 py-1 rounded-full text-[9px] font-black uppercase ${styles[status] || 'bg-gray-100 text-gray-500'}`}>{status}</span>;
};

export default DirectorDashboard;
