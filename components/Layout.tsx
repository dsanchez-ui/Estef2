
import React, { useState } from 'react';
import { UserRole } from '../types';
import { LogOut, LayoutDashboard, FilePlus, ShieldCheck, Menu, X, FolderOpen, List } from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
  role: UserRole;
  currentView: string;
  onNavigate: (view: any) => void;
  onReset: () => void;
}

const LogoSVG = ({ className = "w-full h-full", color = "currentColor" }: { className?: string, color?: string }) => (
  <svg className={className} viewBox="0 0 200 60" fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* Outer Ring */}
    <circle cx="30" cy="30" r="25" stroke={color} strokeWidth="4" fill="none"/>
    
    {/* Rotated E Group */}
    <g transform="rotate(-30 30 30)">
      {/* Body of 'E' (The 'C' shape with rounded corners) */}
      <path 
        d="M 42 20 L 27 20 Q 20 20 20 27 L 20 33 Q 20 40 27 40 L 42 40" 
        stroke="#DA291C" 
        strokeWidth="5" 
        strokeLinecap="butt" 
        fill="none"
      />
      
      {/* Floating middle bar - Extended to 42 */}
      <path 
        d="M 27 30 L 42 30" 
        stroke="#DA291C" 
        strokeWidth="5" 
        strokeLinecap="butt"
      />
    </g>
    
    {/* Text EQUITEL */}
    <text x="65" y="38" fill={color} fontFamily="Inter, sans-serif" fontWeight="900" fontSize="24" letterSpacing="0.1em">EQUITEL</text>
  </svg>
);

const Layout: React.FC<LayoutProps> = ({ children, role, currentView, onNavigate, onReset }) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
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

  // Helper styles for active/inactive buttons
  const baseBtn = "w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-sm transition-all";
  const activeBtn = "bg-equitel-red text-white shadow-lg shadow-red-900/20";
  const inactiveBtn = "text-gray-400 hover:bg-gray-900 hover:text-white";

  const SidebarContent = () => (
    <>
      <div className="p-8 border-b border-gray-900">
        <div className="flex flex-col items-start gap-1 mb-2">
          <div className="w-full h-12 text-white">
             <LogoSVG color="white" />
          </div>
          <span className="text-[9px] font-bold text-gray-400 tracking-[0.3em] pl-1">CREDIT RISK</span>
        </div>
      </div>

      <nav className="flex-1 p-4 space-y-2 mt-4">
        {/* LOGIC FOR COMERCIAL */}
        {role === UserRole.COMERCIAL && (
          <>
            <button 
                onClick={() => onNavigate('LIST')}
                className={`${baseBtn} ${currentView !== 'NEW' ? activeBtn : inactiveBtn}`}
            >
              <List size={18} />
              <span>Mis Solicitudes</span>
            </button>
            <button 
                onClick={() => onNavigate('NEW')}
                className={`${baseBtn} ${currentView === 'NEW' ? activeBtn : inactiveBtn}`}
            >
              <FilePlus size={18} />
              <span>Nueva Solicitud</span>
            </button>
          </>
        )}

        {/* LOGIC FOR CARTERA */}
        {role === UserRole.CARTERA && (
           <button 
                onClick={() => onNavigate('LIST')}
                className={`${baseBtn} ${activeBtn}`} // Always active as it's the main view for Cartera
           >
             <FolderOpen size={18} />
             <span>Gestión Solicitudes</span>
           </button>
        )}

        {/* LOGIC FOR DIRECTOR */}
        {role === UserRole.DIRECTOR && (
           <button 
                onClick={() => onNavigate('LIST')}
                className={`${baseBtn} ${activeBtn}`} // Always active as it's the main dashboard for Director
           >
             <LayoutDashboard size={18} />
             <span>Tablero de Control</span>
           </button>
        )}
      </nav>

      <div className="p-6 border-t border-gray-900 bg-gray-950">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-gray-800 flex items-center justify-center border border-gray-700">
            <ShieldCheck size={18} className="text-gray-300" />
          </div>
          <div>
            <p className="text-sm font-bold text-white leading-none">{userProfile.name}</p>
            <p className="text-[10px] font-bold text-gray-500 uppercase mt-1">{userProfile.title}</p>
          </div>
        </div>
        <button 
          onClick={onReset}
          className="w-full flex items-center gap-2 text-gray-500 hover:text-white text-xs font-bold transition-colors pl-1"
        >
          <LogOut size={14} />
          <span>Cerrar Sesión</span>
        </button>
      </div>
    </>
  );

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden relative">
      {/* Sidebar Desktop */}
      <aside className="w-64 bg-black text-white hidden md:flex flex-col shadow-2xl z-20">
        <SidebarContent />
      </aside>

      {/* Mobile Sidebar Overlay */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/60 z-[100] md:hidden backdrop-blur-sm"
          onClick={() => setIsMobileMenuOpen(false)}
        >
          <aside 
            className="w-64 h-full bg-black flex flex-col animate-in slide-in-from-left duration-300"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex justify-end p-4">
              <button onClick={() => setIsMobileMenuOpen(false)} className="text-white">
                <X size={24} />
              </button>
            </div>
            <SidebarContent />
          </aside>
        </div>
      )}

      <main className="flex-1 overflow-y-auto bg-slate-50 relative">
        <header className="h-20 bg-white border-b border-slate-200 flex items-center justify-between px-6 md:px-8 sticky top-0 z-10 shadow-sm">
           <div className="flex items-center gap-4">
             <button 
               onClick={() => setIsMobileMenuOpen(true)}
               className="md:hidden p-2 text-slate-600 hover:bg-slate-100 rounded-lg"
             >
               <Menu size={24} />
             </button>
             <span className="text-[10px] md:text-sm font-black text-slate-900 uppercase tracking-widest truncate max-w-[150px] md:max-w-none">
               Grupo Equitel
             </span>
           </div>
           <div className="flex items-center gap-4">
             <div className="flex items-center gap-2 px-3 py-1 bg-green-50 rounded-full border border-green-100">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                <span className="hidden sm:inline text-[10px] font-bold uppercase tracking-widest text-green-700">Estefanía AI Active</span>
             </div>
           </div>
        </header>
        <div className="p-4 md:p-8 max-w-7xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
};

export default Layout;
