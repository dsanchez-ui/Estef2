
import React, { useState } from 'react';
import { CreditAnalysis, CommercialMember, DocumentValidation } from '../types';
import { INTEGRANTES_COMERCIALES } from '../constants';
import { 
  Upload, Loader2, Send, AlertCircle, CheckCircle, Sparkles, XCircle, Search, CloudUpload, ShieldAlert, Lock, FileText
} from 'lucide-react';
import { extractIdentityFromRUT, validateSingleDocument } from '../services/gemini';
import PINModal from './PINModal';

interface NewAnalysisFlowProps {
  onComplete: (analysis: CreditAnalysis) => Promise<void>; 
  onCancel?: () => void;
}

const NewAnalysisFlow: React.FC<NewAnalysisFlowProps> = ({ onComplete, onCancel }) => {
  const [extractingId, setExtractingId] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [showOverridePin, setShowOverridePin] = useState(false);

  const [form, setForm] = useState({
    razonSocial: '',
    nit: '',
    integrante: null as CommercialMember | null
  });

  // Individual file states
  const [files, setFiles] = useState<{ [key: string]: File | null }>({
    estadosFinancieros: null,
    camara: null,
    referenciaComercial: null,
    certificacionBancaria: null,
    rut: null,
    declaracionRenta: null,
    extractos: null, 
    cedulaRL: null,
    composicion: null
  });

  // Validation states per file
  const [fileValidation, setFileValidation] = useState<{ [key: string]: { checking: boolean, valid: boolean | null, msg?: string } }>({});

  // Computed state to lock UI
  const isLocked = Object.values(fileValidation).some(v => v.checking) || extractingId || uploading;

  const isBasicInfoValid = !!(form.razonSocial && form.nit && form.integrante);

  const isFormValid = React.useMemo(() => {
    // Basic form check
    if (!isBasicInfoValid) return false;
    
    // Check required files presence
    const requiredKeys = ['estadosFinancieros', 'camara', 'referenciaComercial', 'certificacionBancaria', 'rut', 'cedulaRL', 'composicion'];
    const allFilesUploaded = requiredKeys.every(k => files[k] !== null);
    if (!allFilesUploaded) return false;

    // Check if any validation failed (only if it has been checked and is invalid)
    const anyValidationFailed = Object.values(fileValidation).some(v => v.valid === false);
    if (anyValidationFailed) return false;

    return true;
  }, [form, files, fileValidation, isBasicInfoValid]);

  const handleRutSelect = async (file: File | undefined) => {
    if (!file) return;
    setFiles(prev => ({ ...prev, rut: file }));
    setExtractingId(true);
    try {
      const data = await extractIdentityFromRUT(file);
      if (data.razonSocial || data.nit) {
        setForm(prev => ({
          ...prev,
          razonSocial: data.razonSocial ? data.razonSocial.toUpperCase() : prev.razonSocial,
          nit: data.nit || prev.nit
        }));
      }
      
      // Perform standard validation check for RUT type too
      setFileValidation(prev => ({ ...prev, rut: { checking: true, valid: null } }));
      const val = await validateSingleDocument(file, 'RUT');
      setFileValidation(prev => ({ ...prev, rut: { checking: false, valid: val.isValid, msg: val.msg } }));

    } catch (error) {
      console.error("Error extracting identity from RUT", error);
      setFileValidation(prev => ({ ...prev, rut: { checking: false, valid: false, msg: "Error lectura RUT" } }));
    } finally {
      setExtractingId(false);
    }
  };

  const handleFileSelect = async (key: string, file: File | undefined) => {
    if (!file) return;
    setFiles(prev => ({ ...prev, [key]: file }));

    // START VALIDATION FOR THIS FILE
    setFileValidation(prev => ({ ...prev, [key]: { checking: true, valid: null } }));

    try {
        // Map UI key to expected Type
        let expectedType: any = 'OTRO';
        if (key === 'camara') expectedType = 'CAMARA';
        else if (key === 'certificacionBancaria') expectedType = 'BANCARIA';
        else if (key === 'referenciaComercial') expectedType = 'REFERENCIA';
        else if (key === 'estadosFinancieros') expectedType = 'FINANCIEROS';
        else if (key === 'declaracionRenta') expectedType = 'RENTA';
        else if (key === 'cedulaRL') expectedType = 'CEDULA';
        else if (key === 'composicion') expectedType = 'COMPOSICION';

        // Call Optimized Single Document Validator
        const result = await validateSingleDocument(file, expectedType);
        
        setFileValidation(prev => ({ 
            ...prev, 
            [key]: { checking: false, valid: result.isValid, msg: result.msg } 
        }));

    } catch (e) {
        setFileValidation(prev => ({ 
            ...prev, 
            [key]: { checking: false, valid: false, msg: "Error al validar" } 
        }));
    }
  };

  const handleUpload = async () => {
    if (!isBasicInfoValid) {
        setErrorMsg("Por favor complete la información del cliente y seleccione un asesor.");
        return;
    }

    setUploading(true);

    // Build Validation Results Payload for Email
    const results: DocumentValidation[] = [];
    const names: Record<string, string> = {
        estadosFinancieros: 'Estados Financieros',
        camara: 'Cámara de Comercio',
        referenciaComercial: 'Referencia Comercial',
        certificacionBancaria: 'Certificación Bancaria',
        rut: 'RUT',
        declaracionRenta: 'Declaración de Renta',
        extractos: 'Extractos Bancarios', 
        cedulaRL: 'Cédula Rep. Legal',
        composicion: 'Composición Accionaria'
    };

    Object.entries(files).forEach(([key, file]) => {
        if (!file) return;
        const val = fileValidation[key];
        const isValid = val?.valid === true; 
        
        results.push({
            fileName: names[key] || file.name,
            isValid: isValid,
            issue: val?.msg
        });
    });
    
    const newAnalysis: CreditAnalysis = {
      id: `SOL-PENDING`, 
      clientName: form.razonSocial,
      nit: form.nit,
      comercial: form.integrante!,
      date: new Date().toLocaleDateString(),
      status: 'PENDIENTE_CARTERA',
      commercialFiles: files,
      riskFiles: { datacredito: null, informa: null },
      validationResult: {
          overallValid: results.every(r => r.isValid),
          results: results,
          summary: showOverridePin ? "Carga autorizada con excepción de Director." : "Validación estándar exitosa."
      }
    };

    try {
        await onComplete(newAnalysis);
    } catch (error) {
        setErrorMsg("Error al subir a la nube. Intente nuevamente.");
    } finally {
        setUploading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto bg-white rounded-[2.5rem] shadow-2xl overflow-hidden border border-slate-100 pb-8 relative">
      
      {/* Visual Overlay when Locked */}
      {isLocked && (
        <div className="absolute inset-0 bg-white/50 z-50 cursor-not-allowed"></div>
      )}

      {/* Header */}
      <div className="bg-black p-8 text-white flex justify-between items-center relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-equitel-red opacity-20 rounded-full blur-3xl -mr-10 -mt-10"></div>
        <div className="relative z-10">
          <h2 className="text-2xl font-black uppercase tracking-tight">Nueva Solicitud</h2>
          <p className="text-slate-400 text-xs mt-1">Paso 1: Validación y Carga Comercial</p>
        </div>
        <div className="bg-equitel-red text-white text-[10px] font-bold px-4 py-1.5 rounded-full uppercase tracking-widest shadow-lg relative z-10">
          Rol Comercial
        </div>
      </div>

      <div className="p-10 space-y-8">
        {errorMsg && (
          <div className="p-4 bg-red-50 text-red-700 rounded-xl flex items-center gap-3 border border-red-100 animate-in slide-in-from-top-2">
            <AlertCircle /> <p className="text-sm font-bold">{errorMsg}</p>
          </div>
        )}

        {/* Identity Section */}
        <div className="grid grid-cols-2 gap-6">
            <div className="col-span-2">
              <p className="text-xs font-bold text-slate-400 uppercase mb-3">1. Identificación Automática</p>
              <FileDrop 
                id="rut" 
                label="Cargar RUT (Autofill)" 
                file={files.rut} 
                onSelect={handleRutSelect} 
                validation={fileValidation.rut}
                disabled={isLocked}
                icon={<Sparkles className="text-amber-500 mb-1" size={24} />}
              />
            </div>
            
            <div className="relative">
              <label className="text-[10px] font-bold text-slate-400 uppercase ml-2 mb-1 block">Razón Social</label>
              <input 
                className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-900 placeholder-slate-400 pr-10 focus:ring-2 focus:ring-equitel-red focus:border-transparent outline-none transition-all" 
                placeholder="Nombre de la empresa" 
                required
                value={form.razonSocial}
                onChange={e => setForm({...form, razonSocial: e.target.value.toUpperCase()})}
                readOnly={extractingId || isLocked}
                disabled={isLocked}
              />
              {extractingId && <div className="absolute right-4 top-9"><Loader2 className="animate-spin text-equitel-red" /></div>}
            </div>
            <div className="relative">
              <label className="text-[10px] font-bold text-slate-400 uppercase ml-2 mb-1 block">NIT</label>
              <input 
                className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-900 placeholder-slate-400 pr-10 focus:ring-2 focus:ring-equitel-red focus:border-transparent outline-none transition-all" 
                placeholder="000.000.000-0" 
                required
                value={form.nit}
                onChange={e => setForm({...form, nit: e.target.value})}
                readOnly={extractingId || isLocked}
                disabled={isLocked}
              />
            </div>
        </div>

        <div className="relative">
          <label className="text-[10px] font-bold text-slate-400 uppercase ml-2 mb-1 block">Asesor Responsable</label>
          <select 
            className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold appearance-none text-slate-900 focus:ring-2 focus:ring-equitel-red outline-none"
            required
            onChange={e => setForm({...form, integrante: INTEGRANTES_COMERCIALES.find(i => i.email === e.target.value) || null})}
            value={form.integrante?.email || ""}
            disabled={isLocked}
          >
            <option value="" className="text-slate-400">Seleccionar Integrante Comercial</option>
            {INTEGRANTES_COMERCIALES.map(i => <option key={i.email} value={i.email} className="text-slate-900">{i.name}</option>)}
          </select>
        </div>

        {/* Docs Section */}
        <div>
          <h3 className="text-xs font-black uppercase text-slate-400 tracking-widest mb-4 border-b pb-2 flex items-center gap-2">
            <CloudUpload size={14}/> 
            2. Documentación Financiera y Legal
          </h3>
          <div className="grid grid-cols-4 gap-4 relative">
            <FileDrop id="ef" label="EE.FF Auditados" file={files.estadosFinancieros} onSelect={f => handleFileSelect('estadosFinancieros', f)} validation={fileValidation.estadosFinancieros} disabled={isLocked} />
            <FileDrop id="cc" label="Cámara Comercio" file={files.camara} onSelect={f => handleFileSelect('camara', f)} validation={fileValidation.camara} disabled={isLocked} />
            <FileDrop id="ref" label="Ref. Comercial" file={files.referenciaComercial} onSelect={f => handleFileSelect('referenciaComercial', f)} validation={fileValidation.referenciaComercial} disabled={isLocked} />
            <FileDrop id="cb" label="Cert. Bancaria" file={files.certificacionBancaria} onSelect={f => handleFileSelect('certificacionBancaria', f)} validation={fileValidation.certificacionBancaria} disabled={isLocked} />
            <FileDrop id="renta" label="Decl. Renta" file={files.declaracionRenta} onSelect={f => handleFileSelect('declaracionRenta', f)} validation={fileValidation.declaracionRenta} disabled={isLocked} />
            <FileDrop id="cedula" label="Cédula RL" file={files.cedulaRL} onSelect={f => handleFileSelect('cedulaRL', f)} validation={fileValidation.cedulaRL} disabled={isLocked} />
            <FileDrop id="comp" label="Comp. Accionaria" file={files.composicion} onSelect={f => handleFileSelect('composicion', f)} validation={fileValidation.composicion} disabled={isLocked} />
            <FileDrop id="ext" label="Extractos (Opcional)" file={files.extractos} onSelect={f => handleFileSelect('extractos', f)} optional={true} validation={fileValidation.extractos} disabled={isLocked} />
          </div>
        </div>

        {/* Actions */}
        <div className="pt-8 border-t flex flex-col gap-4">
             <button 
               type="button"
               onClick={handleUpload}
               disabled={uploading || !isBasicInfoValid || isLocked || (!isFormValid && !showOverridePin)} 
               className="w-full py-5 bg-equitel-red text-white rounded-2xl font-black hover:bg-red-700 disabled:bg-slate-200 disabled:text-slate-400 transition-all uppercase text-xs flex items-center justify-center gap-2 shadow-xl shadow-red-100 tracking-widest z-10"
             >
               {uploading ? <Loader2 className="animate-spin" /> : <Send size={18} />}
               <span>{showOverridePin ? "Finalizar con Excepción (Director)" : "Finalizar y Enviar a Cartera"}</span>
             </button>
             
             {/* Subtle PIN Link */}
             {!isFormValid && isBasicInfoValid && !showOverridePin && !isLocked && (
               <button 
                 onClick={() => setShowOverridePin(true)}
                 className="mx-auto text-[10px] text-slate-300 hover:text-slate-500 underline decoration-slate-300 underline-offset-4 transition-colors font-medium flex items-center gap-1 z-10"
               >
                 <Lock size={10} /> Autorizar excepción de Director
               </button>
             )}
        </div>
      </div>

      {showOverridePin && (
        <PINModal 
          onSuccess={() => {
            setShowOverridePin(false); // Validated pin, but we keep state to allow upload
            handleUpload(); 
          }} 
          onCancel={() => setShowOverridePin(false)} 
        />
      )}
    </div>
  );
};

// IMPROVED FileDrop with Status Indicators & Locking
const FileDrop = ({ label, file, onSelect, icon, optional = false, validation, disabled }: any) => {
  const isInvalid = validation?.valid === false;
  const isValid = validation?.valid === true;
  const isChecking = validation?.checking === true;

  const handleClick = (e: React.MouseEvent) => {
    if (disabled || isChecking) {
      e.preventDefault();
    }
  };

  return (
    <label 
      htmlFor={label}
      onClick={handleClick}
      className={`
        border-2 border-dashed p-4 rounded-2xl text-center cursor-pointer transition-all relative overflow-hidden group h-36 flex flex-col items-center justify-center
        ${isInvalid ? 'border-red-400 bg-red-50' : isValid ? 'border-green-500 bg-green-50' : file ? 'border-blue-300 bg-blue-50' : 'border-slate-200 bg-white'} 
        ${!file && optional ? 'opacity-70' : ''}
        ${disabled ? 'opacity-50 cursor-not-allowed grayscale' : 'hover:bg-slate-50'}
      `}
    >
      <input 
        type="file" 
        className="hidden" 
        id={label} 
        disabled={disabled || isChecking}
        accept=".pdf,.png,.jpg,.jpeg" 
        onChange={e => onSelect(e.target.files?.[0])} 
      />
      
      {isChecking ? (
         <div className="flex flex-col items-center gap-2 text-slate-500 absolute inset-0 bg-white/90 justify-center z-20 p-2">
           <Loader2 className="animate-spin text-equitel-red" size={24} />
           <span className="text-[8px] font-bold uppercase animate-pulse">Verificando...</span>
           <p className="text-[7px] text-slate-400 leading-tight">Podría tardar varios segundos, no recargues la página</p>
         </div>
      ) : file ? (
        <>
          {isInvalid ? <XCircle className="text-red-500 mb-2" size={24} /> : 
           isValid ? <CheckCircle className="text-green-500 mb-2" size={24} /> :
           <FileText className="text-blue-500 mb-2" size={24} />
          }
          
          <span className={`text-[9px] font-black uppercase truncate w-full px-2 ${isInvalid ? 'text-red-700' : 'text-slate-700'}`}>
            {file.name}
          </span>
          
          {validation?.msg && (
             <span className="text-[8px] font-bold text-red-600 bg-red-100 px-2 py-0.5 rounded mt-1 animate-pulse leading-tight">
               {validation.msg}
             </span>
          )}
        </>
      ) : (
        <>
          {icon || <Upload className="text-slate-300 group-hover:text-equitel-red group-hover:scale-110 transition-all mb-2" size={24} />}
          <span className="text-[9px] font-black uppercase text-slate-500 group-hover:text-slate-700">
            {label}
          </span>
          {optional && <span className="text-[8px] text-slate-400 mt-1">(Opcional)</span>}
        </>
      )}
    </label>
  );
};

export default NewAnalysisFlow;
