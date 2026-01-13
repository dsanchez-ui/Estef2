
import React, { useMemo } from 'react';
import { CreditAnalysis, CommercialMember } from '../types';
import { Plus, Search, FileText, CheckCircle2, XCircle, Clock, ChevronRight } from 'lucide-react';
import { formatCOP } from '../utils/calculations';

interface CommercialDashboardProps {
  analyses: CreditAnalysis[];
  onNew: () => void;
  onSelect: (analysis: CreditAnalysis) => void;
}

const CommercialDashboard: React.FC<CommercialDashboardProps> = ({ analyses, onNew, onSelect }) => {
  // En un app real, filtraríamos por el ID del usuario logueado. 
  // Aquí mostramos todos para la demo, o podríamos filtrar si tuviéramos el user en contexto.
  
  const stats = useMemo(() => {
    return {
      total: analyses.length,
      approved: analyses.filter(a => a.status === 'APROBADO').length,
      pending: analyses.filter(a => a.status === 'PENDIENTE').length,
      rejected: analyses.filter(a => a.status === 'NEGADO').length
    };
  }, [analyses]);

  return (
    <div className="space-y-8">
      <div className="flex items-end justify-between">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight">Gestión Comercial</h2>
          <p className="text-slate-500">Mis solicitudes de crédito y estado de cuenta</p>
        </div>
        <button 
          onClick={onNew}
          className="px-6 py-3 bg-equitel-red text-white rounded-2xl font-bold flex items-center gap-2 hover:bg-red-700 shadow-xl shadow-red-100 transition-all"
        >
          <Plus size={20} />
          <span>Nueva Solicitud</span>
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center">
            <Clock size={24} />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase">En Estudio</p>
            <p className="text-2xl font-black text-slate-900">{stats.pending}</p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 bg-green-50 text-green-600 rounded-2xl flex items-center justify-center">
            <CheckCircle2 size={24} />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase">Aprobados</p>
            <p className="text-2xl font-black text-slate-900">{stats.approved}</p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 bg-red-50 text-red-600 rounded-2xl flex items-center justify-center">
            <XCircle size={24} />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase">Negados</p>
            <p className="text-2xl font-black text-slate-900">{stats.rejected}</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b bg-slate-50/50 flex items-center justify-between">
          <h3 className="font-bold text-slate-800 uppercase text-sm tracking-widest">Historial de Solicitudes</h3>
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input className="w-full pl-10 pr-4 py-2 bg-white border rounded-xl text-sm outline-none focus:ring-2 focus:ring-equitel-red" placeholder="Buscar por NIT o Cliente..." />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 text-[10px] font-black uppercase tracking-wider text-slate-400">
              <tr>
                <th className="px-6 py-4">Fecha</th>
                <th className="px-6 py-4">Cliente</th>
                <th className="px-6 py-4">Cupo</th>
                <th className="px-6 py-4">Estado</th>
                <th className="px-6 py-4 text-center">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {analyses.map(a => (
                <tr key={a.id} className="hover:bg-slate-50 cursor-pointer group" onClick={() => onSelect(a)}>
                  <td className="px-6 py-4 text-sm font-medium text-slate-600">
                    {a.date}
                  </td>
                  <td className="px-6 py-4">
                    <p className="font-bold text-slate-800">{a.clientName}</p>
                    <p className="text-xs text-slate-400">{a.nit}</p>
                  </td>
                  <td className="px-6 py-4 font-bold text-slate-700">
                    {/* Logic change: Commercials only see the assigned cupo if approved, otherwise 'En Estudio' or 0 */}
                    {a.status === 'APROBADO' ? formatCOP(a.assignedCupo || 0) : 
                     a.status === 'NEGADO' ? formatCOP(0) : 
                     <span className="text-slate-400 italic font-medium">En Estudio</span>}
                  </td>
                  <td className="px-6 py-4">
                    <StatusBadge status={a.status} />
                  </td>
                  <td className="px-6 py-4 text-center">
                    <button className="p-2 bg-slate-100 rounded-full hover:bg-slate-200 transition-colors">
                      <ChevronRight size={16} className="text-slate-600" />
                    </button>
                  </td>
                </tr>
              ))}
              {analyses.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-20 text-center text-slate-400">
                    <div className="flex flex-col items-center gap-4">
                      <FileText size={48} className="text-slate-200" />
                      <p>No has realizado ninguna solicitud aún.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

const StatusBadge = ({ status }: { status: string }) => {
  const styles: Record<string, string> = {
    'PENDIENTE': 'bg-blue-100 text-blue-700 border border-blue-200',
    'APROBADO': 'bg-green-100 text-green-700 border border-green-200',
    'NEGADO': 'bg-red-50 text-red-700 border border-red-100'
  };
  return <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wide ${styles[status]}`}>{status}</span>;
};

export default CommercialDashboard;
