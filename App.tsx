
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
import { saveAnalysisToCloud, exportToDriveAndNotify } from './services/server'; // Added exportToDriveAndNotify
import { fileToBase64, redondearComercial, formatCOP } from './utils/calculations';
import CommercialDashboard from './components/CommercialDashboard';
import { FileText, CheckCircle2, XCircle, Clock, AlertCircle } from 'lucide-react';

// Mock Data for Demo
const MOCK_DB: CreditAnalysis[] = [];

const App: React.FC = () => {
  const [role, setRole] = useState<UserRole | null>(null);
  const [showPIN, setShowPIN] = useState(false);
  const [view, setView] = useState<'LIST' | 'NEW' | 'TASK' | 'DETAIL' | 'SUCCESS'>('LIST');
  const [successType, setSuccessType] = useState<'COMMERCIAL_CREATED' | 'CARTERA_UPDATED'>('COMMERCIAL_CREATED');
  const [analyses, setAnalyses] = useState<CreditAnalysis[]>(MOCK_DB);
  const [selectedAnalysis, setSelectedAnalysis] = useState<CreditAnalysis | null>(null);
  const [loadingAI, setLoadingAI] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Global Configuration State
  const [notificationEmails, setNotificationEmails] = useState("dsanchez@equitel.com.co");

  // Role Selection Logic
  const handleRoleSelect = (r: UserRole) => {
    if (r === UserRole.DIRECTOR) setShowPIN(true);
    else setRole(r);
  };

  // 1. Comercial Flow: Submit New Request -> Cloud Upload -> Notification
  const handleCommercialSubmit = async (newAnalysis: CreditAnalysis) => {
    setUploading(true);
    try {
      console.log("Iniciando carga en Nube (Comercial)...");

      // C. Prepare Files for Cloud (Convert to Base64)
      const filesToUpload = await Promise.all(
        Object.entries(newAnalysis.commercialFiles).map(async ([key, file]) => {
          if (!file || !(file instanceof File)) return null;
          return {
            nombre: `COMERCIAL_${key}_${file.name}`,
            mimeType: file.type,
            fileContent: await fileToBase64(file)
          };
        })
      );
      
      const cleanFilesToUpload = filesToUpload.filter(f => f !== null);

      // D. Construct Payload for GAS
      // Use the ID from the newAnalysis (which is "SOL-PENDING" at this point)
      const payload = {
        notificationType: 'COMERCIAL_UPLOAD', // Flag for First Email
        datosCliente: {
          id: newAnalysis.id, 
          clientName: newAnalysis.clientName,
          nit: newAnalysis.nit,
          comercialNombre: newAnalysis.comercial.name,
          comercialEmail: newAnalysis.comercial.email,
          fecha: newAnalysis.date,
          estado: newAnalysis.status
        },
        archivos: cleanFilesToUpload,
        validation: newAnalysis.validationResult
      };

      // E. Send to Cloud & Get Folder ID AND REAL ID
      const response = await saveAnalysisToCloud(payload);
      
      const analysisWithRealId = {
        ...newAnalysis,
        id: response.assignedId || newAnalysis.id, // Update with ID from Backend
        driveFolderId: response.folderId || undefined,
        driveFolderUrl: response.urlCarpeta || undefined // CAPTURE URL
      };

      // F. Update Local State 
      setAnalyses(prev => [analysisWithRealId, ...prev]);

      setSelectedAnalysis(analysisWithRealId);
      setSuccessType('COMMERCIAL_CREATED');
      setView('SUCCESS');

    } catch (error: any) {
      alert("Error crítico al subir: " + error.message);
      console.error(error);
    } finally {
      setUploading(false);
    }
  };

  // 2. Cartera Flow: Advance Request -> Upload Risk Files to SAME Folder -> Trigger Second Email
  const handleCarteraAdvance = async (updated: CreditAnalysis) => {
    setUploading(true);
    try {
        console.log("Iniciando carga en Nube (Cartera)...");

        // Prepare Risk Files
        const filesToUpload = await Promise.all(
            Object.entries(updated.riskFiles).map(async ([key, file]) => {
              if (!file || !(file instanceof File)) return null;
              return {
                nombre: `RIESGO_${key}_${file.name}`,
                mimeType: file.type,
                fileContent: await fileToBase64(file)
              };
            })
        );
        const cleanFilesToUpload = filesToUpload.filter(f => f !== null);

        // Construct Payload with existing Folder ID AND Notification Trigger
        const payload = {
            targetFolderId: updated.driveFolderId,
            notificationType: 'RIESGO_UPLOAD', // TRIGGER FOR SECOND EMAIL
            datosCliente: {
                id: updated.id,
                clientName: updated.clientName, 
                nit: updated.nit,
                estado: 'PENDIENTE_DIRECTOR'
            },
            archivos: cleanFilesToUpload
        };

        // Upload
        await saveAnalysisToCloud(payload);

        // Update Local State
        setAnalyses(prev => prev.map(a => a.id === updated.id ? { ...a, ...updated, status: 'PENDIENTE_DIRECTOR' } : a));
        setSelectedAnalysis(updated);
        setSuccessType('CARTERA_UPDATED');
        setView('SUCCESS');

    } catch (error: any) {
        alert("Error subiendo archivos de riesgo: " + error.message);
    } finally {
        setUploading(false);
    }
  };

  // 3. Director Flow: Run AI Analysis
  const handleDirectorOpen = async (analysis: CreditAnalysis) => {
    // PERSISTENCE CHECK:
    if (analysis.aiResult) {
       console.log("Cargando análisis existente de base de datos local...");
       
       const readyAnalysis: CreditAnalysis = {
         ...analysis,
         status: analysis.status === 'PENDIENTE_DIRECTOR' ? 'ANALIZADO' : analysis.status,
         indicators: analysis.indicators || analysis.aiResult.financialIndicators,
         cupo: analysis.cupo || { 
            variables: analysis.aiResult.cupoVariables, // FIX: Map variables correctly from persistent state
            resultadoPromedio: analysis.aiResult.suggestedCupo, 
            cupoConservador: redondearComercial(analysis.aiResult.suggestedCupo * (analysis.aiResult.scoreProbability > 0.5 ? 0.5 : 0.8)),
            cupoLiberal: redondearComercial(analysis.aiResult.suggestedCupo * (analysis.aiResult.scoreProbability > 0.5 ? 0.8 : 1.0)),
            plazoRecomendado: analysis.aiResult.financialIndicators.cicloOperacional > 60 ? 45 : 30 
         },
         riskLevel: analysis.riskLevel || (analysis.aiResult.scoreProbability > 0.5 ? 'ALTO' : 'BAJO'),
         moraProbability: analysis.moraProbability || (analysis.aiResult.scoreProbability * 100).toFixed(1) + '%',
         flags: analysis.flags || analysis.aiResult.flags
       };
       
       if (analysis.status === 'PENDIENTE_DIRECTOR') {
          setAnalyses(prev => prev.map(a => a.id === analysis.id ? readyAnalysis : a));
       }
       
       setSelectedAnalysis(readyAnalysis);
       setView('DETAIL');
       return;
    }

    // Run AI
    if (analysis.status === 'PENDIENTE_DIRECTOR' || analysis.status === 'ANALIZADO') {
      setLoadingAI(true);
      try {
        const allFiles = [
            ...Object.values(analysis.commercialFiles || {}), 
            ...Object.values(analysis.riskFiles || {})
        ].filter((f): f is File => f instanceof File);

        if (allFiles.length === 0) {
            throw new Error("No hay archivos cargados en memoria para analizar.");
        }

        const aiResult = await runFullCreditAnalysis(allFiles, analysis.clientName, analysis.nit);
        
        // Calculate ranges based on the average if AI doesn't give them explicit
        const riskFactor = aiResult.scoreProbability > 0.5 ? 0.5 : 0.8; // High Risk = 50% of avg, Low Risk = 80%
        const liberalFactor = aiResult.scoreProbability > 0.5 ? 0.8 : 1.0; 

        const analyzedAnalysis: CreditAnalysis = {
          ...analysis,
          status: 'ANALIZADO',
          indicators: aiResult.financialIndicators,
          cupo: { 
             variables: aiResult.cupoVariables, // FIX: Assign the new variables from AI to the state
             resultadoPromedio: aiResult.suggestedCupo, 
             cupoConservador: redondearComercial(aiResult.suggestedCupo * riskFactor), 
             cupoLiberal: redondearComercial(aiResult.suggestedCupo * liberalFactor),
             plazoRecomendado: aiResult.financialIndicators.cicloOperacional > 60 ? 45 : 30 
          },
          riskLevel: aiResult.scoreProbability > 0.5 ? 'ALTO' : 'BAJO',
          moraProbability: (aiResult.scoreProbability * 100).toFixed(1) + '%',
          flags: aiResult.flags,
          aiResult: aiResult // Save result for persistence
        };

        setAnalyses(prev => prev.map(a => a.id === analysis.id ? analyzedAnalysis : a));
        setSelectedAnalysis(analyzedAnalysis);
        setView('DETAIL');

      } catch (e: any) {
        alert("Error ejecutando IA: " + e.message);
        console.error(e);
      } finally {
        setLoadingAI(false);
      }
    } else {
      setSelectedAnalysis(analysis);
      setView('DETAIL');
    }
  };

  const handleFinalDecision = async (id: string, action: 'APROBADO' | 'NEGADO', manualCupo?: number, manualPlazo?: number, reason?: string) => {
    // 1. UPDATE LOCAL STATE
    setAnalyses(prev => prev.map(a => {
      if (a.id !== id) return a;
      
      const updated: CreditAnalysis = { 
        ...a, 
        status: action, 
        assignedCupo: manualCupo,
        assignedPlazo: manualPlazo, // Store the deadline
        rejectionReason: reason 
      };

      // Also update the nested cupo object for display consistency
      if (updated.cupo && manualPlazo) {
        updated.cupo = { ...updated.cupo, plazoRecomendado: manualPlazo };
      }

      return updated;
    }));

    // 2. IMMEDIATE SHEET UPDATE (Fire & Forget / Async)
    const analysis = analyses.find(a => a.id === id);
    if (analysis) {
       let detalleLog = "";
       if (action === 'APROBADO') {
          detalleLog = `Cupo: ${formatCOP(manualCupo || 0)} - Plazo: ${manualPlazo || 30} días`;
       } else {
          detalleLog = "Solicitud Denegada";
       }

       // We don't await this to keep UI snappy, but we log errors
       exportToDriveAndNotify({
         action: 'UPDATE_SHEET',
         logData: {
           clientId: id,
           clientName: analysis.clientName,
           nit: analysis.nit,
           comercialName: analysis.comercial.name,
           detalle: detalleLog,
           estado: action
         }
       }).catch(err => console.error("Failed to update sheet immediately:", err));
    }

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

  // Filter Logic:
  // Comercial: Sees all.
  // Director: Sees all.
  // Cartera: Now sees ALL too, but UI splits them into "Tasks" vs "History".
  const visibleAnalyses = analyses;

  return (
    <Layout role={role} onReset={() => { setRole(null); setView('LIST'); }}>
      
      {/* GLOBAL LOADING OVERLAYS */}
      {loadingAI && (
        <div className="fixed inset-0 bg-slate-900/80 z-[200] flex flex-col items-center justify-center text-white">
          <div className="w-16 h-16 border-4 border-equitel-red border-t-transparent rounded-full animate-spin mb-4"></div>
          <h2 className="text-2xl font-black uppercase tracking-widest">Ejecutando Análisis One-Shot</h2>
          <p className="text-slate-400 mt-2">Cruzando variables financieras y de riesgo...</p>
        </div>
      )}

      {uploading && (
        <div className="fixed inset-0 bg-slate-900/90 z-[200] flex flex-col items-center justify-center text-white">
          <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4"></div>
          <h2 className="text-2xl font-black uppercase tracking-widest">Sincronizando con la Nube</h2>
          <p className="text-blue-300 mt-2">Conectando con Google Drive & Gmail</p>
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
             <div className="space-y-8 animate-in fade-in">
                <div className="flex items-end justify-between">
                  <div>
                    <h2 className="text-3xl font-black text-slate-900 tracking-tight">Gestión Cartera</h2>
                    <p className="text-slate-500">Administración de expedientes y análisis de riesgo</p>
                  </div>
                </div>

                {/* 1. TAREAS PENDIENTES (Solo Pendiente Cartera) */}
                <div className="space-y-4">
                  <h3 className="font-bold text-slate-400 uppercase text-xs tracking-widest flex items-center gap-2">
                     <AlertCircle size={16} className="text-amber-500" />
                     Pendientes de Carga (Riesgo)
                  </h3>
                  
                  {visibleAnalyses.filter(a => a.status === 'PENDIENTE_CARTERA').length === 0 ? (
                     <div className="p-6 rounded-2xl border border-dashed border-slate-300 bg-slate-50 text-center text-slate-400 text-sm">
                       No hay tareas pendientes en este momento.
                     </div>
                  ) : (
                    visibleAnalyses.filter(a => a.status === 'PENDIENTE_CARTERA').map(a => (
                       <div key={a.id} onClick={() => { setSelectedAnalysis(a); setView('TASK'); }} className="bg-white p-6 rounded-2xl border border-slate-200 hover:border-blue-400 cursor-pointer shadow-sm group transition-all hover:shadow-md">
                          <div className="flex justify-between items-center">
                             <div className="flex items-center gap-4">
                                <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                                  {a.clientName.charAt(0)}
                                </div>
                                <div>
                                    <p className="font-bold text-slate-900">{a.clientName}</p>
                                    <p className="text-xs text-slate-500">NIT: {a.nit} • Solicitado: {a.date}</p>
                                </div>
                             </div>
                             <div className="flex items-center gap-4">
                                <span className="text-[10px] font-bold uppercase bg-amber-100 text-amber-700 px-3 py-1 rounded-full">Requiere Acción</span>
                                <button className="px-4 py-2 bg-slate-900 text-white rounded-lg text-xs font-bold uppercase group-hover:bg-equitel-red transition-colors">Gestionar</button>
                             </div>
                          </div>
                       </div>
                    ))
                  )}
                </div>

                {/* 2. HISTORIAL COMPLETO (Para ver resultados, cartas, etc) */}
                <div className="space-y-4 pt-4 border-t border-slate-200">
                  <h3 className="font-bold text-slate-400 uppercase text-xs tracking-widest flex items-center gap-2">
                     <Clock size={16} />
                     Historial y Consultas
                  </h3>
                  <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden">
                     <table className="w-full text-left">
                        <thead className="bg-slate-50 text-[10px] font-black uppercase tracking-wider text-slate-400">
                          <tr>
                            <th className="px-6 py-4">Cliente</th>
                            <th className="px-6 py-4">Estado</th>
                            <th className="px-6 py-4">Resultado</th>
                            <th className="px-6 py-4 text-center">Detalle</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                           {visibleAnalyses.filter(a => a.status !== 'PENDIENTE_CARTERA').map(a => (
                             <tr key={a.id} className="hover:bg-slate-50 cursor-pointer" onClick={() => { setSelectedAnalysis(a); setView('DETAIL'); }}>
                                <td className="px-6 py-4 text-sm font-bold text-slate-700">{a.clientName}</td>
                                <td className="px-6 py-4">
                                   <span className={`px-2 py-1 rounded-full text-[9px] font-black uppercase ${
                                      a.status === 'APROBADO' ? 'bg-green-100 text-green-700' :
                                      a.status === 'NEGADO' ? 'bg-red-100 text-red-700' :
                                      'bg-blue-100 text-blue-700'
                                   }`}>
                                      {a.status.replace('_', ' ')}
                                   </span>
                                </td>
                                <td className="px-6 py-4 text-xs font-bold text-slate-500">
                                   {a.status === 'APROBADO' ? `Cupo: ${formatCOP(a.assignedCupo || 0)}` : 
                                    a.status === 'NEGADO' ? 'Rechazado' : 'En Proceso'}
                                </td>
                                <td className="px-6 py-4 text-center">
                                   <FileText size={16} className="text-slate-400 mx-auto" />
                                </td>
                             </tr>
                           ))}
                           {visibleAnalyses.filter(a => a.status !== 'PENDIENTE_CARTERA').length === 0 && (
                             <tr><td colSpan={4} className="py-8 text-center text-xs text-slate-400">No hay historial disponible.</td></tr>
                           )}
                        </tbody>
                     </table>
                  </div>
                </div>
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

      {view === 'SUCCESS' && selectedAnalysis && (
        <SuccessView 
           id={selectedAnalysis.id} 
           type={successType}
           onClose={() => setView('LIST')} 
        />
      )}

    </Layout>
  );
};

export default App;
