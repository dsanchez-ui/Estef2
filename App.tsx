
import React, { useState, useEffect } from 'react';
import { UserRole, CreditAnalysis } from './types';
import RoleSelector from './components/RoleSelector';
import Layout from './components/Layout';
import NewAnalysisFlow from './components/NewAnalysisFlow'; // Comercial
import CarteraTaskView from './components/CarteraTaskView'; // Cartera
import DirectorDashboard from './components/DirectorDashboard'; // Director
import AnalysisDetailView from './components/AnalysisDetailView'; // Detail View
import PINModal from './components/PINModal';
import SuccessView from './components/SuccessView';
import { runFullCreditAnalysis } from './services/gemini';
import { sendEmail } from './services/email';
import CommercialDashboard from './components/CommercialDashboard';

// Mock Data for Demo
const MOCK_DB: CreditAnalysis[] = [];

const App: React.FC = () => {
  const [role, setRole] = useState<UserRole | null>(null);
  const [showPIN, setShowPIN] = useState(false);
  const [view, setView] = useState<'LIST' | 'NEW' | 'TASK' | 'DETAIL' | 'SUCCESS'>('LIST');
  const [analyses, setAnalyses] = useState<CreditAnalysis[]>(MOCK_DB);
  const [selectedAnalysis, setSelectedAnalysis] = useState<CreditAnalysis | null>(null);
  const [loadingAI, setLoadingAI] = useState(false);

  // Global Configuration State
  // Default set to requested email
  const [notificationEmails, setNotificationEmails] = useState("dsanchez@equitel.com.co");

  // Role Selection Logic
  const handleRoleSelect = (r: UserRole) => {
    if (r === UserRole.DIRECTOR) setShowPIN(true);
    else setRole(r);
  };

  // 1. Comercial Flow: Submit New Request -> Triggers Notification to Cartera
  const handleCommercialSubmit = async (newAnalysis: CreditAnalysis) => {
    setAnalyses(prev => [newAnalysis, ...prev]);
    
    // Trigger Email Notification to Cartera (dsanchez@equitel.com.co)
    const subject = `Nueva Solicitud de Crédito: ${newAnalysis.clientName}`;
    const body = `
      <h3>Nueva Solicitud Creada</h3>
      <p>El asesor comercial <strong>${newAnalysis.comercial.name}</strong> ha cargado una nueva solicitud.</p>
      <ul>
        <li><strong>Cliente:</strong> ${newAnalysis.clientName}</li>
        <li><strong>NIT:</strong> ${newAnalysis.nit}</li>
        <li><strong>Fecha:</strong> ${newAnalysis.date}</li>
      </ul>
      <p>Por favor ingrese al portal Estefanía 2.0 con el rol "Analista Cartera" para completar la documentación de riesgo.</p>
    `;

    // Fire and forget (don't block UI)
    sendEmail(notificationEmails, subject, body).catch(console.error);

    setView('SUCCESS');
  };

  // 2. Cartera Flow: Advance Request
  const handleCarteraAdvance = (updated: CreditAnalysis) => {
    setAnalyses(prev => prev.map(a => a.id === updated.id ? updated : a));
    setView('SUCCESS');
  };

  // 3. Director Flow: Run AI Analysis
  const handleDirectorOpen = async (analysis: CreditAnalysis) => {
    if (analysis.status === 'PENDIENTE_DIRECTOR' && !analysis.aiResult) {
      setLoadingAI(true);
      try {
        const allFiles = [
            ...Object.values(analysis.commercialFiles), 
            ...Object.values(analysis.riskFiles)
        ].filter(f => f !== null) as File[];

        const aiResult = await runFullCreditAnalysis(allFiles, analysis.clientName, analysis.nit);
        
        const analyzedAnalysis: CreditAnalysis = {
          ...analysis,
          status: 'ANALIZADO',
          indicators: aiResult.financialIndicators,
          cupo: { 
             resultadoPromedio: aiResult.suggestedCupo, 
             plazoRecomendado: aiResult.financialIndicators.cicloOperacional > 60 ? 45 : 30 
          },
          riskLevel: aiResult.scoreProbability > 0.5 ? 'ALTO' : 'BAJO',
          moraProbability: (aiResult.scoreProbability * 100).toFixed(1) + '%',
          flags: aiResult.flags,
          aiResult: aiResult
        };

        setAnalyses(prev => prev.map(a => a.id === analysis.id ? analyzedAnalysis : a));
        setSelectedAnalysis(analyzedAnalysis);
        setView('DETAIL');

      } catch (e: any) {
        alert("Error ejecutando IA: " + e.message);
      } finally {
        setLoadingAI(false);
      }
    } else {
      setSelectedAnalysis(analysis);
      setView('DETAIL');
    }
  };

  const handleFinalDecision = (id: string, action: 'APROBADO' | 'NEGADO', manualCupo?: number, reason?: string) => {
    setAnalyses(prev => prev.map(a => a.id === id ? { ...a, status: action, assignedCupo: manualCupo, rejectionReason: reason } : a));
    setView('LIST');
  };

  if (!role) {
    return (
      <>
        <RoleSelector onSelect={handleRoleSelect} />
        {showPIN && <PINModal onCancel={() => setShowPIN(false)} onSuccess={() => { setShowPIN(false); setRole(UserRole.DIRECTOR); }} />}
      </>
    );
  }

  const visibleAnalyses = role === UserRole.COMERCIAL 
    ? analyses 
    : role === UserRole.CARTERA 
    ? analyses.filter(a => a.status === 'PENDIENTE_CARTERA') 
    : analyses;

  return (
    <Layout role={role} onReset={() => { setRole(null); setView('LIST'); }}>
      
      {loadingAI && (
        <div className="fixed inset-0 bg-slate-900/80 z-[200] flex flex-col items-center justify-center text-white">
          <div className="w-16 h-16 border-4 border-equitel-red border-t-transparent rounded-full animate-spin mb-4"></div>
          <h2 className="text-2xl font-black uppercase tracking-widest">Ejecutando Análisis One-Shot</h2>
          <p className="text-slate-400 mt-2">Cruzando variables financieras y de riesgo...</p>
        </div>
      )}

      {view === 'LIST' && (
        <>
           {role === UserRole.COMERCIAL && (
             <CommercialDashboard 
               analyses={visibleAnalyses} 
               onNew={() => setView('NEW')} 
               onSelect={(a) => { setSelectedAnalysis(a); setView('DETAIL'); }} 
             />
           )}

           {role === UserRole.CARTERA && (
             <div className="space-y-6">
                <h2 className="text-2xl font-black text-slate-900">Bandeja de Entrada Cartera</h2>
                {visibleAnalyses.length === 0 ? <p className="text-slate-400 italic">No hay tareas pendientes.</p> : (
                   visibleAnalyses.map(a => (
                     <div key={a.id} onClick={() => { setSelectedAnalysis(a); setView('TASK'); }} className="bg-white p-6 rounded-2xl border border-slate-200 hover:border-blue-400 cursor-pointer shadow-sm group">
                        <div className="flex justify-between items-center">
                           <div>
                              <p className="font-bold text-slate-900">{a.clientName}</p>
                              <p className="text-xs text-slate-500">NIT: {a.nit}</p>
                           </div>
                           <button className="px-4 py-2 bg-blue-50 text-blue-600 rounded-lg text-xs font-bold uppercase group-hover:bg-blue-600 group-hover:text-white transition-colors">Gestionar</button>
                        </div>
                     </div>
                   ))
                )}
             </div>
           )}

           {role === UserRole.DIRECTOR && (
             <DirectorDashboard 
               analyses={analyses} 
               onSelect={handleDirectorOpen}
               notificationEmails={notificationEmails}
               onUpdateEmails={setNotificationEmails}
             />
           )}
        </>
      )}

      {view === 'NEW' && role === UserRole.COMERCIAL && (
        <NewAnalysisFlow onComplete={handleCommercialSubmit} onCancel={() => setView('LIST')} />
      )}

      {view === 'TASK' && role === UserRole.CARTERA && selectedAnalysis && (
        <CarteraTaskView 
          analysis={selectedAnalysis} 
          onAdvance={handleCarteraAdvance} 
          onBack={() => setView('LIST')} 
        />
      )}

      {view === 'DETAIL' && selectedAnalysis && (
        <AnalysisDetailView 
          analysis={selectedAnalysis} 
          userRole={role} 
          onBack={() => setView('LIST')} 
          onAction={handleFinalDecision} 
        />
      )}

      {view === 'SUCCESS' && (
        <SuccessView 
           id={selectedAnalysis?.id || ''} 
           onClose={() => setView('LIST')} 
        />
      )}

    </Layout>
  );
};

export default App;
