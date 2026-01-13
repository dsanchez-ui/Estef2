
import React, { useState } from 'react';
import { CreditAnalysis } from '../types';
import { Search, Plus, ChevronRight, Settings, Mail } from 'lucide-react';
import { formatCOP } from '../utils/calculations';

interface DirectorDashboardProps {
  analyses: CreditAnalysis[];
  onSelect: (analysis: CreditAnalysis) => void;
  // New props for config management
  notificationEmails?: string;
  onUpdateEmails?: (emails: string) => void;
}

const DirectorDashboard: React.FC<DirectorDashboardProps> = ({ 
  analyses, 
  onSelect,
  notificationEmails = "", 
  onUpdateEmails 
}) => {
  const [showSettings, setShowSettings] = useState(false);
  // Local state for the input field to avoid excessive re-renders on App
  const [localEmails, setLocalEmails] = useState(notificationEmails);

  const pending = analyses.filter(a => a.status === 'PENDIENTE_DIRECTOR');
  const history = analyses.filter(a => a.status !== 'PENDIENTE_DIRECTOR' && a.status !== 'PENDIENTE_CARTERA');

  const handleSaveSettings = () => {
    if (onUpdateEmails) {
      onUpdateEmails(localEmails);
      alert("Configuración guardada exitosamente.");
      setShowSettings(false);
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
        <div className="bg-slate-800 text-white p-6 rounded-3xl animate-in slide-in-from-top-4 shadow-xl">
          <h3 className="font-bold text-sm uppercase mb-4 flex items-center gap-2">
            <Mail size={16} /> Configuración de Notificaciones (Cartera)
          </h3>
          <div className="flex gap-4">
            <input 
              value={localEmails}
              onChange={(e) => setLocalEmails(e.target.value)}
              className="flex-1 bg-slate-700 border-none rounded-xl px-4 py-3 text-sm font-mono text-slate-300 focus:ring-1 focus:ring-equitel-red outline-none" 
              placeholder="correo1@equitel.com, correo2@equitel.com"
            />
            <button 
              onClick={handleSaveSettings}
              className="px-6 py-2 bg-equitel-red rounded-xl font-bold text-xs uppercase hover:bg-red-700 transition-colors"
            >
              Guardar
            </button>
          </div>
          <p className="text-[10px] text-slate-500 mt-2">Separe los correos con comas. Estos usuarios recibirán alerta cuando Comercial finalice una carga.</p>
        </div>
      )}

      {/* Pending Approval Section */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b bg-amber-50/50 flex items-center justify-between">
          <h3 className="font-bold text-amber-900 uppercase text-sm tracking-widest flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
            Pendientes de Decisión (Documentación Completa)
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
                    <p className="font-bold text-slate-800">{a.clientName}</p>
                    <p className="text-xs text-slate-400">{a.nit}</p>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600">
                    {a.comercial.name}
                  </td>
                  <td className="px-6 py-4">
                    <span className="px-2 py-1 bg-amber-100 text-amber-700 rounded-full text-[9px] font-black uppercase">
                      LISTO PARA IA
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <button className="px-4 py-2 bg-slate-900 text-white text-[10px] font-bold uppercase rounded-lg group-hover:bg-equitel-red transition-colors">
                      Ejecutar Análisis
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
                  <td className="px-6 py-4 text-sm font-medium text-slate-600">{a.clientName}</td>
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
