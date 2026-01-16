
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
import { saveAnalysisToCloud, exportToDriveAndNotify, getAnalysesFromCloud, saveAnalysisState, loadAnalysisState, fetchProjectFiles } from './services/server'; // Updated imports
import { fileToBase64, redondearComercial, formatCOP } from './utils/calculations';
import CommercialDashboard from './components/CommercialDashboard';
import { FileText, CheckCircle2, XCircle, Clock, AlertCircle, RefreshCw } from 'lucide-react';

// Global Loading Overlay Component
const LoadingOverlay = ({ visible, message }: { visible: boolean, message: string }) => {
    if (!visible) return null;
    return (
        <div className="fixed inset-0 bg-slate-950/90 z-[9999] flex flex-col items-center justify-center text-white backdrop-blur-sm animate-in fade-in duration-300">
          <div className="w-20 h-20 border-4 border-equitel-red border-t-transparent rounded-full animate-spin mb-6"></div>
          <h2 className="text-2xl font-black uppercase tracking-widest text-center max-w-md leading-tight">{message}</h2>
          <p className="text-slate-400 mt-4 text-sm font-bold uppercase tracking-wide animate-pulse">Por favor NO recargues la página</p>
        </div>
    );
};

const App: React.FC = () => {
  const [role, setRole] = useState<UserRole | null>(null);
  const [showPIN, setShowPIN] = useState(false);
  const [view, setView] = useState<'LIST' | 'NEW' | 'TASK' | 'DETAIL' | 'SUCCESS'>('LIST');
  const [successType, setSuccessType] = useState<'COMMERCIAL_CREATED' | 'CARTERA_UPDATED'>('COMMERCIAL_CREATED');
  const [analyses, setAnalyses] = useState<CreditAnalysis[]>([]); // Empty initially
  const [selectedAnalysis, setSelectedAnalysis] = useState<CreditAnalysis | null>(null);
  
  // Consolidated Loading State
  const [globalLoading, setGlobalLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState("");
  const [isSyncing, setIsSyncing] = useState(false);

  // Global Configuration State
  const [notificationEmails, setNotificationEmails] = useState("dsanchez@equitel.com.co");

  // --- PERSISTENCE LOGIC START ---
  const hydrateData = async () => {
    setIsSyncing(true);
    try {
      const rawData = await getAnalysesFromCloud();
      
      const mappedAnalyses: CreditAnalysis[] = rawData.map((row: any) => {
        // Parse Cupo Detail if exists (e.g. "Cupo: $50M - Plazo: 30 días")
        let assignedCupo = 0;
        let assignedPlazo = 0;
        
        if (row.cupoInfo) {
           const cupoMatch = row.cupoInfo.match(/Cupo:\s*\$\s*([\d\.,]+)/);
           if (cupoMatch) assignedCupo = parseInt(cupoMatch[1].replace(/\./g, '').replace(/,/g, ''));
           
           const plazoMatch = row.cupoInfo.match(/Plazo:\s*(\d+)/);
           if (plazoMatch) assignedPlazo = parseInt(plazoMatch[1]);
        }

        return {
          id: row.id,
          clientName: row.clientName,
          nit: row.nit,
          comercial: { name: row.comercialName, email: '' }, // Email is transient in this view
          date: new Date(row.date).toLocaleDateString(),
          status: row.status as any,
          driveFolderUrl: row.driveUrl,
          // Empty buckets because files are not downloadable securely to browser memory
          // This relies on Cartera re-uploading risk files for AI, or AI logic adapting.
          commercialFiles: {}, 
          riskFiles: {},
          assignedCupo,
          assignedPlazo
        } as CreditAnalysis;
      });

      setAnalyses(mappedAnalyses);
    } catch (e) {
      console.error("Error hydrating data", e);
    } finally {
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    hydrateData();
  }, []);
  // --- PERSISTENCE LOGIC END ---

  // LOAD FULL STATE ON SELECTION
  const handleSelectAnalysis = async (basicAnalysis: CreditAnalysis) => {
      setGlobalLoading(true);
      setLoadingMessage("Recuperando expediente completo desde la nube...");
      
      try {
          if (basicAnalysis.driveFolderUrl) {
              const fullData = await loadAnalysisState(basicAnalysis.driveFolderUrl);
              
              if (fullData) {
                  // Merge basic list data (which is authoritative for status) with deep detail data
                  const merged = { 
                      ...fullData,
                      status: basicAnalysis.status, // Trust Sheet status
                      id: basicAnalysis.id // Trust Sheet ID
                  };
                  setSelectedAnalysis(merged);
              } else {
                  // Fallback if no JSON exists (legacy or just created)
                  setSelectedAnalysis(basicAnalysis);
              }
          } else {
              setSelectedAnalysis(basicAnalysis);
          }
          setView('DETAIL');
      } catch (e) {
          console.error("Error loading deep state", e);
          setSelectedAnalysis(basicAnalysis);
          setView('DETAIL');
      } finally {
          setGlobalLoading(false);
      }
  };

  // Role Selection Logic
  const handleRoleSelect = (r: UserRole) => {
    if (r === UserRole.DIRECTOR) setShowPIN(true);
    else setRole(r);
  };

  // 1. Comercial Flow: Submit New Request -> Cloud Upload -> Notification
  const handleCommercialSubmit = async (newAnalysis: CreditAnalysis) => {
    setGlobalLoading(true);
    setLoadingMessage("Sincronizando documentos comerciales con la Nube...");
    
    try {
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

      // Save Initial JSON State
      if (analysisWithRealId.driveFolderUrl) {
          await saveAnalysisState(analysisWithRealId.driveFolderUrl, analysisWithRealId);
      }

      // F. Update Local State 
      setAnalyses(prev => [analysisWithRealId, ...prev]);

      setSelectedAnalysis(analysisWithRealId);
      setSuccessType('COMMERCIAL_CREATED');
      setView('SUCCESS');

    } catch (error: any) {
      alert("Error crítico al subir: " + error.message);
      console.error(error);
    } finally {
      setGlobalLoading(false);
    }
  };

  // 2. Cartera Flow: Advance Request -> Upload -> EXECUTE AI -> Save Result
  const handleCarteraAdvance = async (updated: CreditAnalysis) => {
    setGlobalLoading(true);
    
    try {
        // STEP A: Prepare Files for Upload (Risk Only)
        setLoadingMessage("Subiendo documentos de riesgo a Google Drive...");
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

        // STEP B: Gather Files for AI Analysis
        // CRITICAL UPDATE: If commercialFiles are empty (reloaded page), fetch them from Drive
        setLoadingMessage("Recuperando Estados Financieros de Drive para análisis IA...");
        
        let aiFiles: any[] = [
            ...Object.values(updated.riskFiles || {}).filter(f => f instanceof File)
        ];

        // Check if we need to fetch remote files
        const hasLocalFinancials = Object.values(updated.commercialFiles || {}).some(f => f instanceof File);
        
        if (!hasLocalFinancials && updated.driveFolderId) {
             console.log("Fetching remote files for AI context...");
             try {
                const remoteFiles = await fetchProjectFiles(updated.driveFolderId);
                // Convert remote format to what runFullCreditAnalysis expects
                const formattedRemoteFiles = remoteFiles.map((rf: any) => ({
                    name: rf.name,
                    inlineData: {
                        data: rf.data,
                        mimeType: rf.mimeType
                    }
                }));
                aiFiles = [...aiFiles, ...formattedRemoteFiles];
                console.log(`Fetched ${remoteFiles.length} remote files for AI.`);
             } catch (e) {
                 console.warn("Failed to fetch remote files, AI will run with limited context", e);
             }
        } else {
             aiFiles = [...aiFiles, ...Object.values(updated.commercialFiles || {}).filter(f => f instanceof File)];
        }

        // STEP C: Run AI Analysis
        setLoadingMessage("Ejecutando Análisis Financiero Estefanía IA...");
        const aiResult = await runFullCreditAnalysis(aiFiles, updated.clientName, updated.nit);
        
        // Calculate ranges based on the average if AI doesn't give them explicit
        const riskFactor = aiResult.scoreProbability > 0.5 ? 0.5 : 0.8; 
        const liberalFactor = aiResult.scoreProbability > 0.5 ? 0.8 : 1.0; 

        // Enriched Object
        const analyzedAnalysis: CreditAnalysis = {
          ...updated,
          status: 'ANALIZADO', // Ready for Director immediately
          indicators: aiResult.financialIndicators,
          cupo: { 
             variables: aiResult.cupoVariables, 
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

        // STEP D: Upload & Trigger Notification
        setLoadingMessage("Guardando resultados y notificando a Dirección...");
        const payload = {
            targetFolderId: updated.driveFolderId,
            notificationType: 'RIESGO_UPLOAD', // TRIGGER FOR SECOND EMAIL
            datosCliente: {
                id: updated.id,
                clientName: updated.clientName, 
                nit: updated.nit,
                estado: 'PENDIENTE_DIRECTOR' // Email says "Ready for Director"
            },
            archivos: cleanFilesToUpload
        };

        await saveAnalysisToCloud(payload);

        // ** CRITICAL: SAVE FULL JSON STATE **
        if (analyzedAnalysis.driveFolderUrl) {
            await saveAnalysisState(analyzedAnalysis.driveFolderUrl, analyzedAnalysis);
        }

        // Update Local State
        setAnalyses(prev => prev.map(a => a.id === updated.id ? analyzedAnalysis : a));
        setSelectedAnalysis(analyzedAnalysis);
        setSuccessType('CARTERA_UPDATED');
        setView('SUCCESS');

    } catch (error: any) {
        alert("Error en proceso Cartera: " + error.message);
        console.error(error);
    } finally {
        setGlobalLoading(false);
    }
  };

  // 3. Director Flow: Just Open (AI is already done)
  // This just uses handleSelectAnalysis logic now

  const handleFinalDecision = async (id: string, action: 'APROBADO' | 'NEGADO', manualCupo?: number, manualPlazo?: number, reason?: string) => {
    // CRITICAL FIX: Use selectedAnalysis (which holds the full AI data) as the base for the update.
    // The 'analyses' array typically only holds shallow summary data from Sheets.
    // If we only updated the array and saved that, we would lose 'aiResult', 'indicators', etc.
    
    if (!selectedAnalysis || selectedAnalysis.id !== id) {
        alert("Error de sincronización: El análisis seleccionado no coincide. Por favor recargue.");
        return;
    }

    // 1. Create the fully enriched object to save to Drive
    const fullUpdatedAnalysis: CreditAnalysis = {
        ...selectedAnalysis, // Keep all deep data (AI, flags, etc.)
        status: action,
        assignedCupo: manualCupo,
        assignedPlazo: manualPlazo,
        rejectionReason: reason
    };

    if (fullUpdatedAnalysis.cupo && manualPlazo) {
        fullUpdatedAnalysis.cupo = { ...fullUpdatedAnalysis.cupo, plazoRecomendado: manualPlazo };
    }

    // 2. Update Local State (List View)
    // We update the list with the summary info so the UI reflects the change immediately
    const updatedAnalyses = analyses.map(a => {
      if (a.id !== id) return a;
      return { 
          ...a, 
          status: action, 
          assignedCupo: manualCupo, 
          assignedPlazo: manualPlazo 
      };
    });

    setAnalyses(updatedAnalyses);
    setSelectedAnalysis(fullUpdatedAnalysis);

    // 3. PERSIST FULL JSON STATE (With AI Data)
    if (fullUpdatedAnalysis.driveFolderUrl) {
        // We don't await this to keep UI snappy, but it runs in background
        saveAnalysisState(fullUpdatedAnalysis.driveFolderUrl, fullUpdatedAnalysis).catch(console.error);
    }

    // 4. IMMEDIATE SHEET UPDATE (Fire & Forget / Async)
    let detalleLog = "";
    if (action === 'APROBADO') {
        detalleLog = `Cupo: ${formatCOP(manualCupo || 0)} - Plazo: ${manualPlazo || 30} días`;
    } else {
        detalleLog = "Solicitud Denegada";
    }

    exportToDriveAndNotify({
        action: 'UPDATE_SHEET',
        logData: {
        clientId: id,
        clientName: fullUpdatedAnalysis.clientName,
        nit: fullUpdatedAnalysis.nit,
        comercialName: fullUpdatedAnalysis.comercial.name,
        detalle: detalleLog,
        estado: action
        }
    }).catch(err => console.error("Failed to update sheet immediately:", err));
  };

  if (!role) {
    return (
      <>
        <RoleSelector onSelect={handleRoleSelect} />
        {showPIN && <PINModal onCancel={() => setShowPIN(false)} onSuccess={() => { setShowPIN(false); setRole(UserRole.DIRECTOR); }} />}
      </>
    );
  }

  const visibleAnalyses = analyses;

  return (
    <Layout role={role} onReset={() => { setRole(null); setView('LIST'); }}>
      
      <LoadingOverlay visible={globalLoading} message={loadingMessage} />

      {view === 'LIST' && (
        <>
           <div className="flex justify-end mb-4 -mt-16 mr-20 relative z-30">
              <button 
                onClick={hydrateData} 
                disabled={isSyncing}
                className="flex items-center gap-2 px-3 py-2 bg-white rounded-lg text-xs font-bold text-slate-500 hover:text-equitel-red transition-colors shadow-sm"
              >
                <RefreshCw size={14} className={isSyncing ? "animate-spin" : ""} />
                {isSyncing ? "Sincronizando..." : "Actualizar Datos"}
              </button>
           </div>

           {role === UserRole.COMERCIAL && (
             <CommercialDashboard 
               analyses={visibleAnalyses} 
               onNew={() => setView('NEW')} 
               onSelect={handleSelectAnalysis} 
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

                {/* 1. TAREAS PENDIENTES */}
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
                       <div key={a.id} onClick={() => handleSelectAnalysis(a).then(() => setView('TASK'))} className="bg-white p-6 rounded-2xl border border-slate-200 hover:border-blue-400 cursor-pointer shadow-sm group transition-all hover:shadow-md">
                          <div className="flex justify-between items-center">
                             <div className="flex items-center gap-4">
                                <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                                  {a.clientName.charAt(0)}
                                </div>
                                <div>
                                    <div className="flex items-center gap-2 mb-1">
                                      <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded text-[10px] font-black border border-slate-200">{a.id}</span>
                                      <p className="font-bold text-slate-900">{a.clientName}</p>
                                    </div>
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

                {/* 2. HISTORIAL COMPLETO */}
                <div className="space-y-4 pt-4 border-t border-slate-200">
                  <h3 className="font-bold text-slate-400 uppercase text-xs tracking-widest flex items-center gap-2">
                     <Clock size={16} />
                     Historial y Consultas
                  </h3>
                  <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden">
                     <table className="w-full text-left">
                        <thead className="bg-slate-50 text-[10px] font-black uppercase tracking-wider text-slate-400">
                          <tr>
                            <th className="px-6 py-4">Radicado</th>
                            <th className="px-6 py-4">Cliente</th>
                            <th className="px-6 py-4">Estado</th>
                            <th className="px-6 py-4">Resultado</th>
                            <th className="px-6 py-4 text-center">Detalle</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                           {visibleAnalyses.filter(a => a.status !== 'PENDIENTE_CARTERA').map(a => (
                             <tr key={a.id} className="hover:bg-slate-50 cursor-pointer" onClick={() => handleSelectAnalysis(a)}>
                                <td className="px-6 py-4">
                                  <span className="inline-block px-2 py-1 rounded bg-slate-100 text-slate-600 text-[10px] font-black border border-slate-200">
                                    {a.id}
                                  </span>
                                </td>
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
                             <tr><td colSpan={5} className="py-8 text-center text-xs text-slate-400">No hay historial disponible.</td></tr>
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
               onSelect={handleSelectAnalysis}
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
