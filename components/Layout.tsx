
import React from 'react';
import { UserRole } from '../types';
import { LogOut, LayoutDashboard, FilePlus, ShieldCheck } from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
  role: UserRole;
  onReset: () => void;
}

const Layout: React.FC<LayoutProps> = ({ children, role, onReset }) => {
  
  // Dynamic User Profile based on Role
  const getUserProfile = () => {
    switch (role) {
      case UserRole.DIRECTOR:
        return { name: "John Deyver", title: "Director Nacional" };
      case UserRole.CARTERA:
        return { name: "Analista Cartera", title: "Operaciones" };
      case UserRole.COMERCIAL:
        return { name: "Asesor Comercial", title: "Ventas" };
      default:
        return { name: "Usuario", title: "Invitado" };
    }
  };

  const userProfile = getUserProfile();

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      <aside className="w-64 bg-slate-900 text-white hidden md:flex flex-col">
        <div className="p-8 border-b border-slate-800">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 bg-equitel-red rounded-lg flex items-center justify-center font-black">E</div>
            <span className="font-black tracking-tight text-lg">ESTEFANÍA 2.0</span>
          </div>
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Cartera Equitel</span>
        </div>

        <nav className="flex-1 p-4 space-y-2 mt-4">
          {role === UserRole.DIRECTOR && (
             <button className="w-full flex items-center gap-3 px-4 py-3 bg-equitel-red rounded-xl font-bold text-sm">
               <LayoutDashboard size={18} />
               <span>Dashboard</span>
             </button>
          )}
          <button className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-sm ${role === UserRole.CARTERA ? 'bg-equitel-red' : 'text-slate-400 hover:bg-slate-800'}`}>
            <FilePlus size={18} />
            <span>{role === UserRole.CARTERA ? 'Nueva Solicitud' : 'Estudios'}</span>
          </button>
        </nav>

        <div className="p-6 border-t border-slate-800">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center">
              <ShieldCheck size={16} className="text-slate-400" />
            </div>
            <div>
              <p className="text-xs font-bold text-white leading-none">{userProfile.name}</p>
              <p className="text-[8px] font-bold text-slate-500 uppercase mt-1">{userProfile.title}</p>
            </div>
          </div>
          <button 
            onClick={onReset}
            className="w-full flex items-center gap-2 text-slate-500 hover:text-white text-xs font-bold transition-colors"
          >
            <LogOut size={14} />
            <span>Cerrar Sesión</span>
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto bg-slate-50">
        <header className="h-16 bg-white border-b flex items-center justify-between px-8">
           <span className="text-sm font-bold text-slate-400">Organización Cummins de los Andes</span>
           <div className="flex items-center gap-4">
             <div className="w-2 h-2 bg-green-500 rounded-full"></div>
             <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Conectado a AI Studio</span>
           </div>
        </header>
        <div className="p-8">
          {children}
        </div>
      </main>
    </div>
  );
};

export default Layout;
