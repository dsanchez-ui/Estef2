
import React, { useState, useEffect } from 'react';
import { CreditAnalysis, FinancialIndicators, UserRole } from '../types';
import { formatCOP, formatPercent, numberToLetters } from '../utils/calculations';
import { getAIGuidance } from '../services/gemini';
import { exportToDriveAndNotify } from '../services/server';
import { generateWelcomeLetterHTML, generateRejectionEmailText, generateCreditReportHTML } from '../utils/templates';
import { 
  ArrowLeft, Printer, Sparkles, AlertTriangle, Loader2, DollarSign, 
  TrendingUp, ShieldAlert, Activity, Mail, Download, Copy, CheckCircle,
  FileText, Send, ExternalLink, Cloud, Calendar
} from 'lucide-react';

interface AnalysisDetailViewProps {
  analysis: CreditAnalysis;
  userRole: UserRole;
  onBack: () => void;
  // Updated signature to accept Plazo
  onAction: (id: string, action: 'APROBADO' | 'NEGADO', manualCupo?: number, manualPlazo?: number, reason?: string) => void;
}

const LogoSVG = ({ className = "w-full h-full", color = "black" }: { className?: string, color?: string }) => (
  <svg
    version="1.1"
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 1043 835"
    className={className}
    preserveAspectRatio="xMidYMid meet"
  >
    <path d="M0 0 C44.33721594 41.8090267 69.11901497 98.87146096 71.10546875 159.64453125 C72.15665785 210.91164204 56.04937834 262.60416642 23.98046875 302.8203125 C22.92279297 304.16609375 22.92279297 304.16609375 21.84375 305.5390625 C-15.10499105 351.708405 -68.52904868 382.53171057 -127.46020508 390.04638672 C-188.89016079 396.47803465 -250.12443363 380.03904864 -298.3984375 341.125 C-312.23520911 329.7052697 -325.18103177 316.98251168 -335.79296875 302.49121094 C-337.00610691 300.83859996 -338.24492037 299.20806881 -339.48828125 297.578125 C-374.51375384 250.94674256 -388.40012152 189.85237867 -380.50048828 132.39160156 C-373.56131142 87.78151209 -354.86051452 46.47188792 -324.203125 13.19140625 C-322.69661391 11.55553464 -321.21072132 9.90051665 -319.7421875 8.23046875 C-315.12663669 2.9837315 -310.38246779 -1.71057372 -305.01953125 -6.1796875 C-304.21773438 -6.89253906 -303.4159375 -7.60539062 -302.58984375 -8.33984375 C-225.35169461 -75.62236743 -106.97316961 -79.21602666 0 0 Z M-278.01953125 38.8203125 C-278.79039062 39.51769531 -279.56125 40.21507812 -280.35546875 40.93359375 C-311.59385608 70.70568943 -330.02425966 115.65580826 -331.19921875 158.375 C-331.39713341 169.98279081 -330.94667312 181.36614468 -329.01953125 192.8203125 C-328.89594238 193.56168457 -328.77235352 194.30305664 -328.64501953 195.06689453 C-325.39182824 213.80133312 -319.08239884 231.13989164 -310.01953125 247.8203125 C-309.69871582 248.42568848 -309.37790039 249.03106445 -309.04736328 249.65478516 C-302.07731659 262.77716356 -293.23969415 274.06141233 -283.01953125 284.8203125 C-282.52501465 285.34737793 -282.03049805 285.87444336 -281.52099609 286.41748047 C-251.87597875 317.83743384 -209.62363693 337.98676174 -166.22436523 339.9465332 C-115.50746632 341.24760195 -70.0236411 324.70492311 -32.92578125 289.94921875 C-9.94233913 267.91605356 6.08619158 238.90233859 14.23046875 208.2578125 C14.47684082 207.33669678 14.72321289 206.41558105 14.97705078 205.46655273 C18.39358789 192.04714107 19.36039084 178.90728918 19.29296875 165.1328125 C19.2908136 164.33906219 19.28865845 163.54531189 19.28643799 162.72750854 C19.23478722 150.86529725 18.84304015 139.38633548 15.98046875 127.8203125 C15.78179199 126.99644043 15.58311523 126.17256836 15.37841797 125.32373047 C9.36687683 101.04791152 -0.85716053 78.6986355 -16.01953125 58.8203125 C-16.69242188 57.92183594 -17.3653125 57.02335937 -18.05859375 56.09765625 C-46.91036277 19.16961984 -88.72376319 -3.25686848 -134.82373047 -9.71240234 C-188.19135862 -16.23188081 -238.7903889 3.19830801 -278.01953125 38.8203125 Z " fill="#000000" transform="translate(677.01953125,96.1796875)"/>
    <path d="M0 0 C2.02169214 5.79913419 4.03359673 11.60153378 6.03637695 17.40722656 C6.71954495 19.38309859 7.40541139 21.35803971 8.09399414 23.33203125 C9.08144214 26.1642795 10.05923978 28.99969847 11.03515625 31.8359375 C11.34655045 32.72243988 11.65794464 33.60894226 11.97877502 34.52230835 C12.25914108 35.34300812 12.53950714 36.16370789 12.82836914 37.00927734 C13.07929825 37.73319672 13.33022736 38.45711609 13.58876038 39.20297241 C14 41 14 41 13 43 C11.33337402 43.75372314 11.33337402 43.75372314 9.13085938 44.47363281 C8.30058228 44.74920517 7.47030518 45.02477753 6.61486816 45.30870056 C5.70039917 45.60386063 4.78593018 45.89902069 3.84375 46.203125 C2.89222046 46.51701675 1.94069092 46.83090851 0.96032715 47.15431213 C-1.10498008 47.83482441 -3.1713979 48.51197305 -5.23876953 49.18618774 C-9.65390251 50.6264026 -14.06352222 52.08313702 -18.47338867 53.53938293 C-20.73111182 54.28492834 -22.98908974 55.02970263 -25.24731445 55.77372742 C-35.99379683 59.31724361 -46.70398495 62.96208349 -57.40542603 66.63897705 C-67.87516463 70.23597629 -78.35615422 73.7963525 -88.85479355 77.30817986 C-92.71852103 78.60165681 -96.58066228 79.89986484 -100.44283867 81.19796467 C-103.61421217 82.26332528 -106.78692337 83.3242504 -109.96166992 84.37954712 C-113.51234053 85.56013392 -117.05918685 86.75161872 -120.60546875 87.9453125 C-121.66920212 88.29580154 -122.73293549 88.64629059 -123.8289032 89.00740051 C-133.33985816 92.12806107 -133.33985816 92.12806107 -139.98779297 99.28540039 C-141.17140011 103.62900452 -140.64300757 106.32512331 -139.1953125 110.43359375 C-138.96143829 111.15727646 -138.72756409 111.88095917 -138.48660278 112.62657166 C-137.68165387 115.09298137 -136.84130716 117.54577157 -136 120 C-135.38488634 121.84862037 -134.77133765 123.69776205 -134.15917969 125.54736328 C-132.1003349 131.73145162 -129.99124313 137.89785753 -127.875 144.0625 C-126.73433467 147.38885996 -125.59385769 150.71528432 -124.45362854 154.04179382 C-123.69861667 156.2443651 -122.9431174 158.44676937 -122.18711853 160.64900208 C-119.95928085 167.15149618 -117.78312968 173.66826322 -115.65234375 180.203125 C-114.92916312 182.39640058 -114.20423359 184.58908707 -113.47833252 186.78146362 C-113.03958197 188.1198157 -112.60756253 189.46039601 -112.18280029 190.80325317 C-109.27356657 200.52138927 -109.27356657 200.52138927 -102 207 C-97.00986876 208.33252907 -93.85237425 207.63992098 -89.015625 205.96484375 C-88.340121 205.73544601 -87.664617 205.50604828 -86.96864319 205.2696991 C-84.72464768 204.50465557 -82.48762918 203.72094869 -80.25 202.9375 C-78.64918052 202.38835477 -77.04784956 201.84069856 -75.44604492 201.29443359 C-72.04409043 200.13328332 -68.64430116 198.96606206 -65.24560547 197.79541016 C-60.08210356 196.02207293 -54.90503004 194.291518 -49.72265625 192.57421875 C-48.86907028 192.29134003 -48.01548431 192.0084613 -47.1360321 191.7170105 C-45.40131892 191.14233574 -43.66657251 190.56776129 -41.93179321 189.99328613 C-26.78136551 184.97097469 -11.66344816 179.85647706 3.4375 174.6875 C9.19996648 172.7165986 14.9626567 170.74635136 20.72570801 168.77716064 C22.21852529 168.26704196 23.71128439 167.75675295 25.20397949 167.24627686 C29.73708268 165.69664946 34.27369719 164.15785359 38.8125 162.625 C39.90941162 162.24947998 41.00632324 161.87395996 42.13647461 161.48706055 C43.1291333 161.15359619 44.12179199 160.82013184 45.14453125 160.4765625 C45.99378174 160.18861816 46.84303223 159.90067383 47.71801758 159.60400391 C50 159 50 159 54 159 C55.85714582 164.49734921 57.70840233 169.99663258 59.55419922 175.49780273 C60.18311161 177.36944211 60.81363756 179.2405401 61.44580078 181.11108398 C62.35352269 183.79791235 63.25544777 186.48662629 64.15625 189.17578125 C64.44060913 190.01337479 64.72496826 190.85096832 65.01794434 191.71394348 C65.27821411 192.49452621 65.53848389 193.27510895 65.80664062 194.0793457 C66.03758423 194.76551468 66.26852783 195.45168365 66.50646973 196.15864563 C67 198 67 198 67 201 C38.36863344 210.7817714 9.71153998 220.48663016 -18.95602417 230.16170883 C-21.60377684 231.05533709 -24.25147813 231.94911741 -26.89916992 232.84292603 C-35.85719681 235.86674136 -44.81615052 238.88776588 -53.77709579 241.90292263 C-58.13737932 243.37066879 -62.4948686 244.84637886 -66.85058594 246.32763672 C-68.74150933 246.96720262 -70.63245708 247.60669649 -72.5234375 248.24609375 C-73.32802399 248.52211929 -74.13261047 248.79814484 -74.96157837 249.08253479 C-90.78299381 254.40966334 -107.73605124 253.21297047 -123.0234375 246.71484375 C-129.97311046 243.2205404 -135.57100919 238.5314246 -141 233 C-141.63808594 232.35804688 -142.27617187 231.71609375 -142.93359375 231.0546875 C-146.71897334 226.75503585 -148.985694 222.05627136 -151.015625 216.74609375 C-151.30888168 215.98462036 -151.60213837 215.22314697 -151.90428162 214.43859863 C-156.78601226 201.51318561 -160.99706492 188.33518855 -165.32928467 175.21813965 C-166.54763374 171.53236242 -167.77105842 167.84827122 -168.99414062 164.1640625 C-170.40813228 159.90407108 -171.82132055 155.64382271 -173.22998047 151.38206482 C-175.12919564 145.63661414 -177.03040327 139.89215414 -178.97070312 134.16040039 C-179.25215683 133.32690063 -179.53361053 132.49340088 -179.82359314 131.63464355 C-180.31348303 130.18725258 -180.80625366 128.74083069 -181.30299377 127.29577637 C-186.91868265 110.68481735 -186.27919624 93.03809795 -179 77 C-169.4714982 58.44013563 -155.3684986 51.6185916 -136.375 45.25 C-134.50306436 44.61049052 -132.63149247 43.96991546 -130.76025391 43.32836914 C-124.51492679 41.19466109 -118.25845177 39.09484799 -112 37 C-110.86981445 36.62131775 -109.73962891 36.2426355 -108.57519531 35.85247803 C-97.74517578 32.22501878 -86.91103944 28.60999562 -76.07104492 25.01245117 C-58.81272133 19.2842948 -41.58888539 13.46250416 -24.39001465 7.5584259 C-20.92740436 6.37015256 -17.46387579 5.18457834 -14 4 C-12.175896 3.37520752 -12.175896 3.37520752 -10.31494141 2.73779297 C-9.22745605 2.36928223 -8.1399707 2.00077148 -7.01953125 1.62109375 C-5.62311401 1.14627563 -5.62311401 1.14627563 -4.19848633 0.66186523 C-2 0 -2 0 0 0 Z " fill={color} transform="translate(608,217)"/>
  </svg>
);

const AnalysisDetailView: React.FC<AnalysisDetailViewProps> = ({ analysis, userRole, onBack, onAction }) => {
  const [showReport, setShowReport] = useState(false);
  const [showWelcomeLetter, setShowWelcomeLetter] = useState(false);
  const [aiRec, setAiRec] = useState<string>('');
  const [loadingAi, setLoadingAi] = useState(false);
  
  // States for Director Editing
  const [manualCupo, setManualCupo] = useState<number>(analysis.assignedCupo || analysis.cupo?.cupoConservador || 0);
  const [manualPlazo, setManualPlazo] = useState<number>(analysis.assignedPlazo || analysis.cupo?.plazoRecomendado || 30);
  
  const [showRiskConfirm, setShowRiskConfirm] = useState(false);
  
  // States for Email/Drive Workflow
  // UPDATED: Initialize empty to avoid pre-filling with comercial's email
  const [emailTo, setEmailTo] = useState('');
  const [processingAction, setProcessingAction] = useState(false);
  const [actionStatus, setActionStatus] = useState<{type: 'success' | 'error', msg: string} | null>(null);
  const [autoGenerating, setAutoGenerating] = useState(false);

  useEffect(() => {
    if (userRole === UserRole.DIRECTOR && analysis.status === 'ANALIZADO') {
      const fetchAiRec = async () => {
        setLoadingAi(true);
        const rec = await getAIGuidance(analysis);
        setAiRec(rec || '');
        setLoadingAi(false);
      };
      fetchAiRec();
    }
  }, [analysis, userRole]);

  const isHighRisk = analysis.cupo?.cupoLiberal ? manualCupo > analysis.cupo.cupoLiberal : false;

  const performApproval = async () => {
     setAutoGenerating(true);
     setShowRiskConfirm(false);
     
     try {
       // 1. Generate & Upload Credit Report PDF
       const reportHtml = generateCreditReportHTML(analysis, manualCupo, manualPlazo);
       await exportToDriveAndNotify({
          action: 'SAVE_REPORT',
          folderId: analysis.driveFolderId, 
          folderUrl: analysis.driveFolderUrl, 
          htmlContent: reportHtml,
          fileName: `Informe_Credito_${analysis.clientName}.pdf`
       });

       // 2. Generate & Upload Welcome Letter
       const welcomeHtml = generateWelcomeLetterHTML({...analysis, assignedCupo: manualCupo, assignedPlazo: manualPlazo});
       await exportToDriveAndNotify({
          action: 'SAVE_REPORT',
          folderId: analysis.driveFolderId, 
          folderUrl: analysis.driveFolderUrl, 
          htmlContent: welcomeHtml,
          fileName: `Carta_Bienvenida_${analysis.clientName}.pdf`
       });

       // 3. Finalize Action
       onAction(analysis.id, 'APROBADO', manualCupo, manualPlazo);
     } catch (e) {
       console.error("Auto generation failed", e);
       alert("Hubo un error generando los documentos automáticos, pero se aprobará el cupo.");
       onAction(analysis.id, 'APROBADO', manualCupo, manualPlazo);
     } finally {
       setAutoGenerating(false);
     }
  };

  const handleApproveClick = () => {
    if (isHighRisk) {
      setShowRiskConfirm(true);
    } else {
      performApproval();
    }
  };

  const handleReject = async () => {
    if (!confirm("¿Está seguro de negar esta solicitud?")) return;
    
    setAutoGenerating(true);
    const reason = `Inconsistencias financieras detectadas: ${analysis.flags?.red.map(f => f).join(', ') || 'N/A'}.`;
    
    try {
        // Generate Report even if rejected (with 0 cupo)
        const reportHtml = generateCreditReportHTML(analysis, 0, 0);
        await exportToDriveAndNotify({
            action: 'SAVE_REPORT',
            folderId: analysis.driveFolderId, 
            folderUrl: analysis.driveFolderUrl, 
            htmlContent: reportHtml,
            fileName: `Informe_Credito_RECHAZADO_${analysis.clientName}.pdf`
        });
        
        onAction(analysis.id, 'NEGADO', 0, 0, reason);
    } catch (e) {
        onAction(analysis.id, 'NEGADO', 0, 0, reason);
    } finally {
        setAutoGenerating(false);
    }
  };

  const handleSendRealEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailTo) return;

    setProcessingAction(true);
    setActionStatus(null);
    
    let subject = "";
    let body = "";
    let detalleLog = "";

    if (analysis.status === 'APROBADO') {
      subject = `Aprobación de Cupo Grupo Equitel - ${analysis.clientName}`;
      body = generateWelcomeLetterHTML(analysis);
      detalleLog = `Cupo: ${formatCOP(analysis.assignedCupo || 0)} - Plazo: ${analysis.assignedPlazo} días`;
    } else {
      subject = `Respuesta Solicitud Crédito - ${analysis.clientName}`;
      body = generateRejectionEmailText(analysis).replace(/\n/g, '<br>');
      detalleLog = "Solicitud Denegada";
    }

    const result = await exportToDriveAndNotify({
      action: 'SEND_EMAIL',
      emailData: { to: emailTo, subject, body },
      folderUrl: analysis.driveFolderUrl,
      // Metadata para el registro en Sheets
      logData: {
        clientId: analysis.id,
        clientName: analysis.clientName,
        nit: analysis.nit,
        comercialName: analysis.comercial.name,
        estado: analysis.status,
        detalle: detalleLog
      }
    });

    setProcessingAction(false);
    if (result.success) {
      setActionStatus({ type: 'success', msg: 'Correo enviado exitosamente.' });
    } else {
      setActionStatus({ type: 'error', msg: 'Error al enviar correo: ' + result.message });
    }
  };

  const handleManualSaveToDrive = async (type: 'REPORT' | 'WELCOME') => {
     setProcessingAction(true);
     try {
         const html = type === 'REPORT' 
            ? generateCreditReportHTML(analysis, manualCupo, manualPlazo)
            : generateWelcomeLetterHTML(analysis);
         
         const fileName = type === 'REPORT' ? `Informe_Credito` : `Carta_Bienvenida`;
         
         const result = await exportToDriveAndNotify({
            action: 'SAVE_REPORT',
            folderId: analysis.driveFolderId, 
            folderUrl: analysis.driveFolderUrl, 
            htmlContent: html,
            fileName: `${fileName}_${analysis.clientName}.pdf`
         });

         if (result.success) {
             alert("Guardado exitosamente.");
         } else {
             alert("Error guardando: " + result.message);
         }
     } catch (e) {
         alert("Error técnico.");
     } finally {
         setProcessingAction(false);
     }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert("Texto copiado al portapapeles");
  };

  // Helper to handle currency input change
  const handleCurrencyInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Remove all non-numeric chars except possibly for empty string handling
    const rawValue = e.target.value.replace(/\D/g, '');
    setManualCupo(rawValue ? parseInt(rawValue, 10) : 0);
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-24 relative">
      
      {autoGenerating && (
          <div className="fixed inset-0 bg-white/80 z-[300] flex flex-col items-center justify-center backdrop-blur-sm animate-in fade-in">
             <Loader2 className="animate-spin text-equitel-red mb-4" size={48} />
             <h2 className="text-xl font-black uppercase text-slate-900">Generando documentos y finalizando...</h2>
          </div>
      )}

      <div className="flex items-center justify-between no-print">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="flex items-center gap-2 text-slate-500 font-bold hover:text-black transition-colors">
            <ArrowLeft size={20} /> Volver
          </button>
          {analysis.driveFolderUrl && (
            <a 
              href={analysis.driveFolderUrl} 
              target="_blank" 
              rel="noreferrer" 
              className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:text-equitel-red hover:border-equitel-red transition-all shadow-sm"
            >
              <ExternalLink size={14} />
              Ver Carpeta Drive
            </a>
          )}
        </div>
        
        {userRole === UserRole.DIRECTOR && (analysis.status === 'PENDIENTE_DIRECTOR' || analysis.status === 'ANALIZADO') && (
          <div className="flex gap-4">
            <button onClick={handleReject} className="px-6 py-3 border-2 border-slate-200 text-slate-600 rounded-2xl font-black hover:bg-slate-50 transition-colors uppercase text-xs tracking-widest">
              Negar Solicitud
            </button>
            <button onClick={handleApproveClick} className="px-8 py-3 bg-equitel-red text-white rounded-2xl font-black shadow-xl hover:bg-red-700 transition-colors uppercase text-xs tracking-widest">
              Aprobar Cupo
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-8 space-y-8">
          <div className="bg-black rounded-[2.5rem] p-10 text-white relative overflow-hidden shadow-2xl">
             <div className="absolute top-0 right-0 p-10 opacity-20">
               <Activity size={120} className="text-equitel-red" />
             </div>
             
             {/* Header with Client Info and Request ID */}
             <div className="relative z-10 mb-4">
               <div className="flex items-baseline gap-3">
                 <h2 className="text-3xl font-black uppercase tracking-tight truncate">{analysis.clientName}</h2>
                 <span className="text-lg font-bold text-slate-500">{analysis.id}</span>
               </div>
             </div>

             <div className="flex flex-wrap gap-4 text-sm text-slate-400 font-medium relative z-10">
               <span className="bg-slate-900 border border-slate-800 px-3 py-1 rounded-lg">NIT: {analysis.nit}</span>
               <div className={`flex items-center gap-2 px-3 py-1 rounded-lg text-white font-black uppercase ${
                 analysis.status === 'APROBADO' ? 'bg-green-600' :
                 analysis.status === 'NEGADO' ? 'bg-red-600' : 
                 analysis.riskLevel === 'BAJO' ? 'bg-green-600' : 'bg-amber-500'
               }`}>
                 <ShieldAlert size={14} />
                 {(analysis.status === 'PENDIENTE_DIRECTOR' || analysis.status === 'PENDIENTE_CARTERA') ? `RIESGO ${analysis.riskLevel || '...'}` : analysis.status}
               </div>
             </div>
          </div>

          {/* VISIBLE TO ALL: APPROVED BLOCK */}
          {analysis.status === 'APROBADO' && (
            <div className="bg-green-50 rounded-[2.5rem] p-8 border border-green-100 animate-in fade-in">
              <div className="flex items-start gap-4">
                <div className="bg-green-100 p-3 rounded-full text-green-600">
                  <CheckCircle size={32} />
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-black uppercase text-green-900 mb-2">Solicitud Aprobada</h3>
                  <p className="text-green-800 mb-6">El cupo ha sido autorizado exitosamente. A continuación puede gestionar la formalización.</p>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-white p-6 rounded-3xl shadow-sm border border-green-100">
                      <h4 className="font-bold text-slate-900 uppercase text-xs mb-4 flex items-center gap-2">
                        <FileText size={16} /> Carta de Bienvenida
                      </h4>
                      <div className="flex gap-2">
                        <button 
                          onClick={() => setShowWelcomeLetter(true)}
                          className="flex-1 py-3 bg-black text-white rounded-xl font-bold text-xs uppercase flex items-center justify-center gap-2 hover:bg-slate-800"
                        >
                          <Printer size={16} /> Ver PDF
                        </button>
                      </div>
                    </div>

                    <div className="bg-white p-6 rounded-3xl shadow-sm border border-green-100">
                      <h4 className="font-bold text-slate-900 uppercase text-xs mb-4 flex items-center gap-2">
                        <Mail size={16} /> Enviar Notificación
                      </h4>
                      <form onSubmit={handleSendRealEmail} className="space-y-3">
                        <input 
                          type="email" 
                          placeholder="correo@ejemplo.com" 
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-sm font-medium text-slate-900 placeholder:text-slate-400"
                          value={emailTo}
                          onChange={e => setEmailTo(e.target.value)}
                          required
                        />
                        <button 
                          type="submit"
                          disabled={processingAction}
                          className="w-full py-3 bg-green-600 text-white rounded-xl font-bold text-xs uppercase flex items-center justify-center gap-2 hover:bg-green-700 disabled:opacity-50"
                        >
                          {processingAction ? <Loader2 className="animate-spin" /> : <Send size={16} />}
                          ENVIAR CORREO
                        </button>
                        {actionStatus && (
                          <p className={`text-[10px] font-bold ${actionStatus.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>
                            {actionStatus.msg}
                          </p>
                        )}
                      </form>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* VISIBLE TO ALL: DENIED BLOCK */}
          {analysis.status === 'NEGADO' && (
            <div className="bg-red-50 rounded-[2.5rem] p-8 border border-red-100 animate-in fade-in">
              <div className="flex items-start gap-4">
                 <div className="bg-red-100 p-3 rounded-full text-red-600">
                    <ShieldAlert size={32} />
                 </div>
                 <div className="w-full">
                   <h3 className="text-xl font-black uppercase text-red-900 mb-4">Solicitud Denegada</h3>
                   
                   <div className="bg-white p-6 rounded-2xl border border-red-100 shadow-sm w-full">
                     <div className="flex justify-between items-center mb-4">
                       <h4 className="font-bold text-slate-900 uppercase text-xs">Script de Comunicación</h4>
                       <button 
                         onClick={() => copyToClipboard(generateRejectionEmailText(analysis))}
                         className="text-slate-400 hover:text-slate-900 transition-colors"
                         title="Copiar texto"
                       >
                         <Copy size={16} />
                       </button>
                     </div>
                     <textarea 
                        readOnly
                        className="w-full h-48 bg-slate-50 p-4 rounded-xl text-sm text-slate-900 border-none resize-none font-mono"
                        value={generateRejectionEmailText(analysis)}
                     />
                     
                     <div className="mt-4 pt-4 border-t border-slate-100">
                        <h4 className="font-bold text-slate-900 uppercase text-xs mb-3 flex items-center gap-2">
                          <Mail size={14} /> Enviar Respuesta Directa
                        </h4>
                        <form onSubmit={handleSendRealEmail} className="flex gap-3 items-center">
                          <input 
                            type="email" 
                            placeholder="correo@ejemplo.com" 
                            className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-sm font-medium text-slate-900"
                            value={emailTo}
                            onChange={e => setEmailTo(e.target.value)}
                            required
                          />
                          <button 
                            type="submit"
                            disabled={processingAction}
                            className="px-6 py-2 bg-black text-white rounded-xl font-bold text-xs uppercase hover:bg-slate-800 disabled:opacity-50"
                          >
                            {processingAction ? <Loader2 className="animate-spin" /> : 'Enviar'}
                          </button>
                        </form>
                        {actionStatus && (
                          <p className={`text-[10px] font-bold mt-2 ${actionStatus.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>
                            {actionStatus.msg}
                          </p>
                        )}
                     </div>
                   </div>
                 </div>
              </div>
            </div>
          )}

          {analysis.indicators && (
            <div className="bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-sm">
              <h3 className="flex items-center gap-3 text-lg font-black uppercase text-slate-900 mb-6">
                <TrendingUp className="text-equitel-red" />
                Resumen de Indicadores Financieros
              </h3>
              <FinancialIndicatorsTable indicators={analysis.indicators} />
            </div>
          )}

          {userRole === UserRole.DIRECTOR && analysis.cupo && (
            <div className="bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-sm">
              <h3 className="flex items-center gap-3 text-lg font-black uppercase text-slate-900 mb-6">
                <DollarSign className="text-equitel-red" />
                Cálculo de Cupo Sugerido (Fórmula 6 Indicadores)
              </h3>
              <CupoCalculationBreakdown cupo={analysis.cupo} />
            </div>
          )}

          {userRole === UserRole.DIRECTOR && (analysis.status === 'PENDIENTE_DIRECTOR' || analysis.status === 'ANALIZADO') && (
            <div className="bg-indigo-50 rounded-[2.5rem] p-8 border border-indigo-100">
              <div className="flex items-center gap-3 mb-4">
                <Sparkles className="text-indigo-600" />
                <h3 className="font-black uppercase tracking-widest text-sm text-indigo-900">Concepto IA Estefanía</h3>
              </div>
              {loadingAi ? (
                <div className="flex items-center gap-2 text-indigo-400">
                  <Loader2 className="animate-spin" size={16} /> Generando análisis...
                </div>
              ) : (
                <div className="text-indigo-900 text-sm leading-relaxed font-medium text-justify whitespace-pre-line">
                  {aiRec}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="lg:col-span-4 space-y-8">
          <div className="bg-white rounded-[2.5rem] p-8 border-2 shadow-xl border-slate-100 sticky top-8">
            <h4 className="text-[10px] font-black uppercase tracking-widest mb-6 text-slate-400 border-b pb-2">Dictamen de Crédito</h4>
            
            <div className="space-y-6">
              {userRole === UserRole.DIRECTOR && analysis.cupo && (
                <div className="flex flex-col gap-4 mb-4">
                  <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200">
                    <p className="text-[10px] font-bold text-slate-500 uppercase mb-2">Conservador (50-40%)</p>
                    <p className="text-2xl md:text-3xl font-black text-slate-900 truncate tracking-tight">{formatCOP(analysis.cupo.cupoConservador || 0)}</p>
                  </div>
                  <div className="bg-red-50 p-6 rounded-2xl border border-red-100">
                    <p className="text-[10px] font-bold text-red-600 uppercase mb-2">Liberal (80-60%)</p>
                    <p className="text-2xl md:text-3xl font-black text-red-600 truncate tracking-tight">{formatCOP(analysis.cupo.cupoLiberal || 0)}</p>
                  </div>
                </div>
              )}

              {/* VISIBLE TO ALL: STATUS & APPROVED CUPO */}
              {analysis.status === 'APROBADO' ? (
                 <div className="p-6 rounded-3xl border-2 border-green-500 bg-green-50">
                    <div className="mb-4 border-b border-green-200 pb-4">
                        <label className="text-[9px] font-black uppercase mb-2 block text-green-700 tracking-widest">Cupo Otorgado</label>
                        <p className="text-3xl font-black text-green-900">{formatCOP(analysis.assignedCupo || 0)}</p>
                    </div>
                    <div>
                        <label className="text-[9px] font-black uppercase mb-2 block text-green-700 tracking-widest">Plazo Aprobado</label>
                        <p className="text-xl font-bold text-green-800">{analysis.assignedPlazo || analysis.cupo?.plazoRecomendado} Días</p>
                    </div>
                 </div>
              ) : analysis.status === 'NEGADO' ? (
                 <div className="p-6 rounded-3xl border-2 border-red-500 bg-red-50">
                    <p className="text-xl font-black text-red-700 uppercase">Solicitud Rechazada</p>
                 </div>
              ) : (
                <>
                  {userRole === UserRole.DIRECTOR ? (
                    <div className={`p-6 rounded-3xl border-2 transition-all ${isHighRisk ? 'border-red-500 bg-red-50' : 'border-slate-100 bg-slate-50'}`}>
                      <label className="text-[9px] font-black uppercase mb-2 block text-slate-500 tracking-widest">Cupo Aprobado (COP)</label>
                      <div className="flex items-center gap-2 mb-6">
                        <span className="text-slate-400 font-bold">$</span>
                        {/* UPDATED: Controlled text input for formatting */}
                        <input 
                          type="text"
                          className="w-full bg-transparent text-2xl font-black outline-none text-slate-900"
                          value={new Intl.NumberFormat('es-CO').format(manualCupo)}
                          onChange={handleCurrencyInputChange}
                        />
                      </div>
                      
                      {/* UPDATED: Plazo Editing with Infinite Granularity and Manual Input */}
                      <label className="text-[9px] font-black uppercase mb-2 block text-slate-500 tracking-widest">Plazo de Pago (Días)</label>
                      <div className="flex items-center gap-4 mb-2">
                        <input 
                          type="range" 
                          min="0" 
                          max="120" 
                          step="1" // Step 1 for infinite granularity
                          value={manualPlazo} 
                          onChange={e => setManualPlazo(Number(e.target.value))}
                          className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-equitel-red"
                        />
                        {/* UPDATED: Input box instead of div */}
                        <input
                           type="number"
                           min="0"
                           max="120"
                           className="w-16 bg-white rounded-lg border border-slate-200 p-1 font-bold text-center text-slate-900 outline-none focus:ring-2 focus:ring-equitel-red"
                           value={manualPlazo}
                           onChange={e => setManualPlazo(Number(e.target.value))}
                        />
                      </div>
                      <p className="text-[10px] text-slate-400 text-right">Sugerido IA: {analysis.cupo?.plazoRecomendado} días</p>

                      {isHighRisk && (
                        <div className="mt-4 flex items-center gap-2 text-red-600 animate-pulse">
                          <AlertTriangle size={14} />
                          <span className="text-[9px] font-black uppercase">Excede límite liberal</span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="p-6 rounded-3xl border-2 border-slate-100 bg-slate-50">
                       <p className="text-center font-bold text-slate-500">En proceso de estudio</p>
                       <p className="text-center text-xs text-slate-400 mt-1">El cupo será visible una vez aprobado.</p>
                    </div>
                  )}
                </>
              )}

              {userRole === UserRole.DIRECTOR && analysis.cupo && (
                <div className="pt-4 border-t border-slate-100">
                   <p className="text-xs font-bold text-slate-500 mb-2 flex items-center gap-2">
                     <Calendar size={14} /> Plazo Sugerido (Ciclo Operacional)
                   </p>
                   <div className="flex items-center gap-2">
                     <div className="h-2 flex-1 bg-slate-100 rounded-full overflow-hidden">
                       <div className="h-full bg-slate-900 w-1/2"></div>
                     </div>
                     <span className="font-black text-slate-900">{analysis.cupo.plazoRecomendado} Días</span>
                   </div>
                </div>
              )}
            </div>

            {userRole === UserRole.DIRECTOR && (
              <button onClick={() => setShowReport(true)} className="w-full mt-8 py-4 bg-black text-white rounded-xl font-bold flex items-center justify-center gap-3 hover:bg-slate-800 transition-all text-xs uppercase tracking-widest shadow-lg">
                 <Cloud size={16} /> Ver / Guardar Informe
              </button>
            )}
          </div>
        </div>
      </div>

      {showRiskConfirm && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[150] flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white rounded-[2.5rem] p-10 text-center shadow-2xl animate-in zoom-in duration-300">
            <div className="w-20 h-20 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-6">
              <AlertTriangle size={40} />
            </div>
            <h3 className="text-2xl font-black uppercase mb-4 text-slate-900">¿Confirmar Alto Riesgo?</h3>
            <p className="text-slate-500 text-sm mb-8">El cupo ingresado <strong>({formatCOP(manualCupo)})</strong> supera el límite técnico del modelo liberal. Esta acción quedará registrada bajo su responsabilidad.</p>
            <div className="flex gap-4">
              <button onClick={() => setShowRiskConfirm(false)} className="flex-1 py-4 font-bold text-slate-400 hover:text-slate-600 transition-colors uppercase text-xs tracking-widest">Cancelar</button>
              <button 
                onClick={performApproval} 
                className="flex-1 py-4 bg-red-600 text-white rounded-2xl font-black hover:bg-red-700 transition-colors uppercase text-xs tracking-widest shadow-lg shadow-red-200"
              >
                Sí, Proceder
              </button>
            </div>
          </div>
        </div>
      )}

      {(showReport || showWelcomeLetter) && (
        <div id="printable-report-container" className="fixed inset-0 bg-white z-[200] overflow-y-auto">
          <div className="min-h-screen bg-slate-100 flex flex-col items-center pt-8 pb-8">
             <div className="fixed top-4 right-4 flex gap-2 z-50">
               {/* UPDATED: Buttons now use manual generation logic */}
               <button 
                  onClick={() => handleManualSaveToDrive(showWelcomeLetter ? 'WELCOME' : 'REPORT')} 
                  disabled={processingAction}
                  className="bg-black text-white px-6 py-3 rounded-full font-bold shadow-lg hover:bg-slate-800 flex items-center gap-2"
               >
                 {processingAction ? <Loader2 className="animate-spin" /> : <Cloud size={18} />}
                 Guardar PDF en Drive
               </button>
               
               <button onClick={() => { setShowReport(false); setShowWelcomeLetter(false); }} className="bg-white text-slate-900 px-6 py-3 rounded-full font-bold shadow-lg hover:bg-slate-50">
                 Cerrar Vista Previa
               </button>
             </div>

             <div className="bg-white max-w-[21cm] w-full min-h-[29.7cm] p-[1.5cm] shadow-2xl relative print-paper">
                {showWelcomeLetter ? (
                  <div dangerouslySetInnerHTML={{ __html: generateWelcomeLetterHTML({...analysis, assignedCupo: manualCupo, assignedPlazo: manualPlazo}) }} />
                ) : (
                  <div dangerouslySetInnerHTML={{ __html: generateCreditReportHTML(analysis, manualCupo, manualPlazo) }} />
                )}
             </div>
          </div>
        </div>
      )}
    </div>
  );
};

const FinancialIndicatorsTable = ({ indicators, compact = false }: { indicators: FinancialIndicators, compact?: boolean }) => {
  const rowClass = compact ? "py-2 px-4" : "py-3 px-6";
  const textClass = compact ? "text-xs" : "text-sm";
  
  const categories = [
    {
      title: "Liquidez",
      items: [
        { label: "Razón Corriente", value: indicators.razonCorriente.toFixed(2) },
        { label: "Prueba Ácida", value: indicators.pruebaAcida.toFixed(2) },
        { label: "KNT (Capital de Trabajo)", value: formatCOP(indicators.knt) },
      ]
    },
    {
      title: "Endeudamiento",
      items: [
        { label: "Nivel Endeudamiento Global", value: formatPercent(indicators.endeudamientoGlobal) },
        { label: "Endeudamiento Corto Plazo", value: formatPercent(indicators.endeudamientoCP) },
        { label: "Solvencia (Pasivo/Patrimonio)", value: formatPercent(indicators.solvencia) },
      ]
    },
    {
      title: "Rentabilidad & Márgenes",
      items: [
        { label: "ROA (Activo)", value: formatPercent(indicators.roa) },
        { label: "ROE (Patrimonio)", value: formatPercent(indicators.roe) },
        { label: "Margen Operacional", value: formatPercent(indicators.margenOperacional) },
        { label: "Margen Neto", value: formatPercent(indicators.margenNeto) },
      ]
    },
    {
      title: "Operación & Eficiencia",
      items: [
        { label: "EBITDA", value: formatCOP(indicators.ebitda) },
        { label: "Días Recuperación Cartera", value: `${indicators.diasCartera.toFixed(0)} días` },
        { label: "Días Rotación Inventario", value: `${indicators.diasInventario.toFixed(0)} días` },
        { label: "Ciclo Operacional", value: `${indicators.cicloOperacional.toFixed(0)} días` },
      ]
    }
  ];

  return (
    <div className={`overflow-hidden border border-slate-200 rounded-xl ${compact ? 'text-xs' : ''}`}>
      <table className="w-full text-left border-collapse">
        <thead className="bg-slate-50 text-slate-800 font-bold uppercase text-[10px] print-force-bg-gray">
          <tr>
            <th className={rowClass}>Categoría</th>
            <th className={rowClass}>Indicador</th>
            <th className={`${rowClass} text-right`}>Resultado</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {categories.map((cat, idx) => (
            <React.Fragment key={idx}>
              {cat.items.map((item, itemIdx) => (
                <tr key={`${idx}-${itemIdx}`} className="hover:bg-slate-50/50">
                  {itemIdx === 0 && (
                    <td rowSpan={cat.items.length} className={`${rowClass} font-bold text-slate-400 border-r border-slate-100 bg-slate-50/20 align-top print-force-bg-gray`}>
                      {cat.title}
                    </td>
                  )}
                  <td className={`${rowClass} ${textClass} font-medium text-slate-700`}>{item.label}</td>
                  <td className={`${rowClass} ${textClass} font-bold text-slate-900 text-right`}>{item.value}</td>
                </tr>
              ))}
            </React.Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const CupoCalculationBreakdown = ({ cupo }: { cupo: any }) => {
  const items = [
    { label: "1. Datacrédito (Promedio 3p * 10%)", value: cupo.variables?.v1_weighted, desc: `Base: ${formatCOP(cupo.variables?.v1_datacredito_avg || 0)}` },
    { label: "2. OtorgA (Plataforma)", value: cupo.variables?.v2_otorga, desc: "Cupo directo score" },
    { label: "3. Opinión Crédito (Informa * 10%)", value: cupo.variables?.v3_weighted, desc: `Base: ${formatCOP(cupo.variables?.v3_informa_max || 0)}` },
    { label: "4. Utilidad Neta Mensual", value: cupo.variables?.v4_utilidad_mensual, desc: "Promedio mensual último año" },
    { label: "5. Ref. Comerciales (Promedio)", value: cupo.variables?.v5_referencias_avg, desc: "Validado en cartas" },
    { label: "6. Cupo Mensual (EBITDA/2)/12", value: cupo.variables?.v6_ebitda_monthly, desc: "Capacidad operativa ajustada" },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {items.map((item, idx) => (
          <div key={idx} className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex justify-between items-center group hover:border-equitel-red/30 transition-colors">
            <div>
              <p className="text-xs font-bold text-slate-600 uppercase mb-1">{item.label}</p>
              <p className="text-[10px] text-slate-400">{item.desc}</p>
            </div>
            <p className="text-lg font-black text-slate-900">{formatCOP(item.value || 0)}</p>
          </div>
        ))}
      </div>
      <div className="mt-4 p-4 bg-black text-white rounded-xl flex justify-between items-center shadow-lg">
        <span className="font-bold uppercase text-xs tracking-widest">Resultado Promedio (6 Indicadores)</span>
        <span className="text-2xl font-black text-equitel-red">{formatCOP(cupo.resultadoPromedio)}</span>
      </div>
    </div>
  );
};

export default AnalysisDetailView;
