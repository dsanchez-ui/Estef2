
import React, { useState } from 'react';
import { CreditAnalysis, CommercialMember } from '../types';
import { INTEGRANTES_COMERCIALES } from '../constants';
import { 
  Upload, Loader2, Send, AlertCircle, CheckCircle, Sparkles
} from 'lucide-react';
import { extractIdentityFromRUT } from '../services/gemini';

interface NewAnalysisFlowProps {
  onComplete: (analysis: CreditAnalysis) => Promise<void>; // Updated to Promise for async waiting
  onCancel?: () => void;
}

const NewAnalysisFlow: React.FC<NewAnalysisFlowProps> = ({ onComplete, onCancel }) => {
  const [loading, setLoading] = useState(false);
  const [extractingId, setExtractingId] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [form, setForm] = useState({
    razonSocial: '',
    nit: '',
    integrante: null as CommercialMember | null
  });

  // COMMERCIAL BUCKET ONLY - No Risk Files
  const [files, setFiles] = useState<{ [key: string]: File | null }>({
    estadosFinancieros: null,
    camara: null,
    referenciaComercial: null,
    certificacionBancaria: null,
    rut: null,
    declaracionRenta: null,
    extractos: null, // This is now OPTIONAL
    cedulaRL: null,
    composicion: null
  });

  // Validation Logic: Check all files EXCEPT 'extractos'
  const isFormValid = React.useMemo(() => {
    const requiredFiles = { ...files };
    // @ts-ignore
    delete requiredFiles.extractos; // Remove extractos from required check
    
    const areRequiredFilesUploaded = Object.values(requiredFiles).every(f => f !== null);
    
    return !!(
      form.razonSocial && 
      form.nit && 
      form.integrante && 
      areRequiredFilesUploaded
    );
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFormValid) return;

    setLoading(true);
    
    // Create the object in 'PENDIENTE_CARTERA' state
    const newAnalysis: CreditAnalysis = {
      id: `SOL-${Date.now().toString().slice(-6)}`,
      clientName: form.razonSocial,
      nit: form.nit,
      comercial: form.integrante!,
      date: new Date().toLocaleDateString(),
      status: 'PENDIENTE_CARTERA',
      commercialFiles: files,
      riskFiles: { datacredito: null, informa: null }
    };

    try {
        // Wait for the parent to process AI and Cloud Upload
        await onComplete(newAnalysis);
    } catch (error) {
        setErrorMsg("Error al procesar la solicitud. Intente nuevamente.");
        console.error(error);
    } finally {
        setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto bg-white rounded-[2.5rem] shadow-2xl overflow-hidden border border-slate-100">
      <div className="bg-slate-900 p-8 text-white flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-black uppercase">Nueva Solicitud</h2>
          <p className="text-slate-400 text-xs">Paso 1: Documentación Comercial</p>
        </div>
        <div className="bg-equitel-red text-white text-[10px] font-bold px-3 py-1 rounded-full uppercase">
          Rol Comercial
        </div>
      </div>

      <div className="p-10 space-y-8">
        {errorMsg && (
          <div className="p-4 bg-red-50 text-red-700 rounded-xl flex items-center gap-3">
            <AlertCircle /> <p>{errorMsg}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-8">
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
              
              {/* Extractos Bancarios (OPCIONAL) */}
              <FileDrop 
                id="ext" 
                label="Extractos (Opcional)" 
                file={files.extractos} 
                onSelect={f => setFiles({...files, extractos: f})} 
                optional={true}
              />
            </div>
          </div>

          <div className="bg-amber-50 p-4 rounded-xl border border-amber-100 text-amber-800 text-xs font-medium">
            Nota: Los extractos bancarios no son obligatorios en esta etapa. La documentación de riesgo será cargada por Cartera.
          </div>

          <button 
            disabled={loading || !isFormValid}
            className="w-full py-5 bg-slate-900 text-white rounded-2xl font-black hover:bg-slate-800 disabled:bg-slate-200 transition-all uppercase tracking-widest text-xs flex items-center justify-center gap-3 shadow-lg disabled:shadow-none mt-8"
          >
            {loading ? <div className="flex items-center gap-2"><Loader2 className="animate-spin" /> <span>Analizando & Subiendo...</span></div> : <div className="flex items-center gap-2"><Send size={18} /> <span>Finalizar y Notificar</span></div>}
          </button>
        </form>
      </div>
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
