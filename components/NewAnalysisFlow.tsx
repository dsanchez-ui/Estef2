
import React, { useState } from 'react';
import { CreditAnalysis, CommercialMember, ValidationResult } from '../types';
import { INTEGRANTES_COMERCIALES } from '../constants';
import { 
  Upload, Loader2, Send, AlertCircle, CheckCircle, Sparkles, XCircle, Search, CloudUpload, ShieldAlert
} from 'lucide-react';
import { extractIdentityFromRUT, validateCommercialDocuments } from '../services/gemini';
import PINModal from './PINModal';

interface NewAnalysisFlowProps {
  onComplete: (analysis: CreditAnalysis) => Promise<void>; 
  onCancel?: () => void;
}

const NewAnalysisFlow: React.FC<NewAnalysisFlowProps> = ({ onComplete, onCancel }) => {
  const [validating, setValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [extractingId, setExtractingId] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [showOverridePin, setShowOverridePin] = useState(false);

  const [form, setForm] = useState({
    razonSocial: '',
    nit: '',
    integrante: null as CommercialMember | null
  });

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

  const isFormValid = React.useMemo(() => {
    const requiredFiles = { ...files };
    // @ts-ignore
    delete requiredFiles.extractos; 
    const areRequiredFilesUploaded = Object.values(requiredFiles).every(f => f !== null);
    return !!(form.razonSocial && form.nit && form.integrante && areRequiredFilesUploaded);
  }, [form, files]);

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
    } catch (error) {
      console.error("Error extracting identity from RUT", error);
    } finally {
      setExtractingId(false);
    }
  };

  // STEP 1: VALIDATE DOCUMENTS WITH AI
  const handleValidate = async () => {
    if (!isFormValid) return;
    setValidating(true);
    setValidationResult(null);
    setErrorMsg(null);

    try {
      const filesToValidate = Object.entries(files)
        .filter(([_, f]) => f !== null)
        .map(([_, f]) => f as File);

      const result = await validateCommercialDocuments(filesToValidate, form.razonSocial, form.nit);
      setValidationResult(result);

      if (!result.overallValid) {
        setErrorMsg("Se encontraron inconsistencias en la documentación. Revise el reporte abajo.");
      }
    } catch (error: any) {
      setErrorMsg("Error en la validación: " + error.message);
    } finally {
      setValidating(false);
    }
  };

  // STEP 2: UPLOAD TO CLOUD (Only enabled if Validated or Overridden)
  const handleUpload = async () => {
    setUploading(true);
    const newAnalysis: CreditAnalysis = {
      id: `SOL-${Date.now().toString().slice(-6)}`,
      clientName: form.razonSocial,
      nit: form.nit,
      comercial: form.integrante!,
      date: new Date().toLocaleDateString(),
      status: 'PENDIENTE_CARTERA',
      commercialFiles: files,
      riskFiles: { datacredito: null, informa: null },
      validationResult: validationResult || undefined
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
    <div className="max-w-4xl mx-auto bg-white rounded-[2.5rem] shadow-2xl overflow-hidden border border-slate-100">
      <div className="bg-slate-900 p-8 text-white flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-black uppercase">Nueva Solicitud</h2>
          <p className="text-slate-400 text-xs">Paso 1: Validación y Carga Comercial</p>
        </div>
        <div className="bg-equitel-red text-white text-[10px] font-bold px-3 py-1 rounded-full uppercase">
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
        <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <p className="text-xs font-bold text-slate-400 uppercase mb-2">1. Identificación Automática</p>
              <FileDrop 
                id="rut" 
                label="Cargar RUT (Autofill)" 
                file={files.rut} 
                onSelect={handleRutSelect} 
                icon={<Sparkles className="text-amber-500 mb-1" size={20} />}
              />
            </div>
            
            <div className="relative">
            <input 
              className="w-full p-4 bg-slate-50 border rounded-xl font-bold text-slate-900 placeholder-slate-400 pr-10" 
              placeholder="Razón Social" 
              required
              value={form.razonSocial}
              onChange={e => setForm({...form, razonSocial: e.target.value.toUpperCase()})}
              readOnly={extractingId}
            />
            {extractingId && <div className="absolute right-3 top-1/2 -translate-y-1/2"><Loader2 className="animate-spin text-equitel-red" /></div>}
          </div>
          <div className="relative">
            <input 
              className="w-full p-4 bg-slate-50 border rounded-xl font-bold text-slate-900 placeholder-slate-400 pr-10" 
              placeholder="NIT" 
              required
              value={form.nit}
              onChange={e => setForm({...form, nit: e.target.value})}
              readOnly={extractingId}
            />
          </div>
        </div>

        <div className="relative">
          <select 
            className="w-full p-4 bg-slate-50 border rounded-xl font-bold appearance-none text-slate-900"
            required
            onChange={e => setForm({...form, integrante: INTEGRANTES_COMERCIALES.find(i => i.email === e.target.value) || null})}
            value={form.integrante?.email || ""}
          >
            <option value="" className="text-slate-400">Seleccionar Integrante Comercial</option>
            {INTEGRANTES_COMERCIALES.map(i => <option key={i.email} value={i.email} className="text-slate-900">{i.name}</option>)}
          </select>
        </div>

        {/* Docs Section */}
        <div>
          <h3 className="text-xs font-black uppercase text-slate-400 tracking-widest mb-4 border-b pb-2">2. Documentación Financiera y Legal</h3>
          <div className="grid grid-cols-4 gap-4">
            <FileDrop id="ef" label="EE.FF Auditados" file={files.estadosFinancieros} onSelect={f => setFiles({...files, estadosFinancieros: f})} />
            <FileDrop id="cc" label="Cámara Comercio" file={files.camara} onSelect={f => setFiles({...files, camara: f})} />
            <FileDrop id="ref" label="Ref. Comercial" file={files.referenciaComercial} onSelect={f => setFiles({...files, referenciaComercial: f})} />
            <FileDrop id="cb" label="Cert. Bancaria" file={files.certificacionBancaria} onSelect={f => setFiles({...files, certificacionBancaria: f})} />
            <FileDrop id="renta" label="Decl. Renta" file={files.declaracionRenta} onSelect={f => setFiles({...files, declaracionRenta: f})} />
            <FileDrop id="cedula" label="Cédula RL" file={files.cedulaRL} onSelect={f => setFiles({...files, cedulaRL: f})} />
            <FileDrop id="comp" label="Comp. Accionaria" file={files.composicion} onSelect={f => setFiles({...files, composicion: f})} />
            <FileDrop id="ext" label="Extractos (Opcional)" file={files.extractos} onSelect={f => setFiles({...files, extractos: f})} optional={true} />
          </div>
        </div>

        {/* Validation Results Display */}
        {validationResult && (
          <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 animate-in fade-in">
            <h3 className="font-bold text-slate-900 uppercase text-xs mb-4 flex items-center gap-2">
              <Sparkles size={16} className="text-indigo-500" />
              Resultado de Validación Estefanía IA
            </h3>
            <div className="space-y-3">
              {validationResult.results.map((res, idx) => (
                 <div key={idx} className={`p-3 rounded-xl border flex items-center justify-between text-xs ${res.isValid ? 'bg-white border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
                    <div className="flex items-center gap-2">
                       {res.isValid ? <CheckCircle size={16} /> : <XCircle size={16} />}
                       <span className="font-bold truncate max-w-[200px]">{res.fileName}</span>
                    </div>
                    <div className="text-right">
                       <p className="font-bold">{res.issue || 'Documento Válido'}</p>
                       {res.detectedDate && <p className="text-[10px] opacity-70">Fecha: {res.detectedDate}</p>}
                    </div>
                 </div>
              ))}
            </div>
            <p className="mt-4 text-[10px] text-slate-400 italic text-center">{validationResult.summary}</p>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-4 pt-4 border-t">
          {/* STEP 1 Button: Validate */}
          {!validationResult?.overallValid ? (
             <div className="flex gap-2 w-full">
               <button 
                 type="button"
                 onClick={handleValidate}
                 disabled={validating || !isFormValid}
                 className="flex-1 py-4 bg-indigo-600 text-white rounded-2xl font-black hover:bg-indigo-700 disabled:bg-slate-200 transition-all uppercase text-xs flex items-center justify-center gap-2"
               >
                 {validating ? <Loader2 className="animate-spin" /> : <Search size={18} />}
                 <span>Validar Documentación (IA)</span>
               </button>
               
               {/* OVERRIDE BUTTON (Only appears after failed validation) */}
               {validationResult && !validationResult.overallValid && (
                  <button 
                    type="button"
                    onClick={() => setShowOverridePin(true)}
                    className="px-6 py-4 bg-red-100 text-red-600 rounded-2xl font-black hover:bg-red-200 transition-all uppercase text-xs flex items-center justify-center gap-2"
                  >
                    <ShieldAlert size={18} />
                    <span>Autorizar Excepción (Director)</span>
                  </button>
               )}
             </div>
          ) : (
            /* STEP 2 Button: Upload (Only if Valid) */
             <button 
               type="button"
               onClick={handleUpload}
               disabled={uploading}
               className="flex-1 py-4 bg-green-600 text-white rounded-2xl font-black hover:bg-green-700 disabled:bg-slate-200 transition-all uppercase text-xs flex items-center justify-center gap-2 shadow-xl shadow-green-100"
             >
               {uploading ? <Loader2 className="animate-spin" /> : <CloudUpload size={18} />}
               <span>Confirmar y Enviar a Drive</span>
             </button>
          )}
        </div>

        {validationResult?.overallValid && (
           <p className="text-center text-xs text-green-600 font-bold animate-pulse">
             ✓ Documentación validada correctamente. Puede proceder a la carga.
           </p>
        )}
      </div>

      {showOverridePin && (
        <PINModal 
          onSuccess={() => {
            setShowOverridePin(false);
            handleUpload(); // Force upload immediately after PIN success
          }} 
          onCancel={() => setShowOverridePin(false)} 
        />
      )}
    </div>
  );
};

const FileDrop = ({ label, file, onSelect, icon, optional = false }: any) => (
  <div className={`border-2 border-dashed p-4 rounded-2xl text-center cursor-pointer transition-all hover:bg-slate-50 relative overflow-hidden group h-24 flex flex-col items-center justify-center ${file ? 'border-green-500 bg-green-50' : 'border-slate-200 bg-white'} ${!file && optional ? 'opacity-70' : ''}`}>
    <input type="file" className="hidden" id={label} accept=".pdf,.png,.jpg,.jpeg" onChange={e => onSelect(e.target.files?.[0])} />
    <label htmlFor={label} className="cursor-pointer w-full h-full flex flex-col items-center justify-center">
      {file ? (
        <CheckCircle className="text-green-500 mb-1" size={20} />
      ) : (
        icon || <Upload className="text-slate-300 group-hover:scale-110 transition-transform mb-1" size={20} />
      )}
      <span className={`text-[8px] font-black uppercase truncate block max-w-full px-1 ${file ? 'text-green-700' : 'text-slate-500'}`}>
        {file ? file.name : label}
      </span>
    </label>
  </div>
);

export default NewAnalysisFlow;
