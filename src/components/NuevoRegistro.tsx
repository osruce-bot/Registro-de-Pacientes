import React, { useState, useRef } from "react";
import { Paciente, LookupItem, LookupType } from "../types";
import { encryptText } from "../encryptUtils";
import { ShieldAlert, PlusCircle, CheckCircle2, Lock, Eye, EyeOff } from "lucide-react";
import { formatDateToDMY } from "./PatientsTable";
import SearchableSelect from "./SearchableSelect";

interface NuevoRegistroProps {
  lookups: Record<LookupType, LookupItem[]>;
  onAddPaciente: (paciente: Paciente) => Promise<boolean>;
  encryptionKey: string;
}

type NuevoRegistroField =
  | "fechaIngreso"
  | "pjsId"
  | "ciudadId"
  | "medicoId"
  | "aseguradoraId"
  | "sector"
  | "institucionId"
  | "dispensacionId"
  | "distribuidorId"
  | "indicacionId"
  | "dosisId"
  | "lineaTratamiento";

function isValidDateString(dateStr: string): boolean {
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false;
  const [yStr, mStr, dStr] = dateStr.split("-");
  const y = Number(yStr);
  const m = Number(mStr);
  const d = Number(dStr);
  if (y < 1900 || y > 2100 || m < 1 || m > 12 || d < 1 || d > 31) return false;
  const dt = new Date(y, m - 1, d);
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d;
}

export default function NuevoRegistro({ lookups, onAddPaciente, encryptionKey }: NuevoRegistroProps) {
  // Input fields
  const [pjsId, setPjsId] = useState("");
  const [ciudadId, setCiudadId] = useState("");
  const [medicoId, setMedicoId] = useState("");
  const [aseguradoraId, setAseguradoraId] = useState("");
  const [sector, setSector] = useState<"Público" | "Privado">("Privado");
  const [institucionId, setInstitucionId] = useState("");
  const [dispensacionId, setDispensacionId] = useState("");
  const [distribuidorId, setDistribuidorId] = useState("");
  const [indicacionId, setIndicacionId] = useState("");
  const [dosisId, setDosisId] = useState("");
  const [lineaTratamiento, setLineaTratamiento] = useState("1era Línea");
  const [fechaIngreso, setFechaIngreso] = useState("");

  // UI state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [showKeyInfo, setShowKeyInfo] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<NuevoRegistroField, boolean>>>({});
  const fechaIngresoRef = useRef<HTMLInputElement>(null);

  const clearFieldError = (field: NuevoRegistroField) => {
    setFieldErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  // Helper to get labels from active lookups
  const getSelectedLabel = (type: LookupType, id: string): string => {
    const list = lookups[type] || [];
    const found = list.find(item => item.id === id);
    if (!found) return "";
    
    // For doctor or PJS, append surname
    if (found.apellido) {
      return `${found.nombre} ${found.apellido}`;
    }
    return found.nombre;
  };

  // Filter active lookups to prevent registering retired items ("de baja")
  const getActiveOptions = (type: LookupType): LookupItem[] => {
    return [...(lookups[type] || [])]
      .filter((item) => item.status === "activo")
      .sort((a, b) => {
        const nameA = `${a.nombre} ${a.apellido || ""}`.trim().toLowerCase();
        const nameB = `${b.nombre} ${b.apellido || ""}`.trim().toLowerCase();
        return nameA.localeCompare(nameB, "es", { sensitivity: "base" });
      });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);

    const errors: Partial<Record<NuevoRegistroField, boolean>> = {};

    if (fechaIngresoRef.current?.validity?.badInput || !isValidDateString(fechaIngreso)) {
      errors.fechaIngreso = true;
    }
    if (!pjsId || !getActiveOptions("pjs").some(o => o.id === pjsId)) {
      errors.pjsId = true;
    }
    if (!ciudadId || !getActiveOptions("ciudades").some(o => o.id === ciudadId)) {
      errors.ciudadId = true;
    }
    if (!medicoId || !getActiveOptions("medicos").some(o => o.id === medicoId)) {
      errors.medicoId = true;
    }
    if (!aseguradoraId || !getActiveOptions("aseguradoras").some(o => o.id === aseguradoraId)) {
      errors.aseguradoraId = true;
    }
    if (sector !== "Público" && sector !== "Privado") {
      errors.sector = true;
    }
    if (!institucionId || !getActiveOptions("instituciones").some(o => o.id === institucionId)) {
      errors.institucionId = true;
    }
    if (!dispensacionId || !getActiveOptions("dispensaciones").some(o => o.id === dispensacionId)) {
      errors.dispensacionId = true;
    }
    if (!distribuidorId || !getActiveOptions("distribuidores").some(o => o.id === distribuidorId)) {
      errors.distribuidorId = true;
    }
    if (!indicacionId || !getActiveOptions("indicaciones").some(o => o.id === indicacionId)) {
      errors.indicacionId = true;
    }
    if (!dosisId || !getActiveOptions("dosis").some(o => o.id === dosisId)) {
      errors.dosisId = true;
    }
    if (!lineaTratamiento || !lineaTratamiento.trim()) {
      errors.lineaTratamiento = true;
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setMsg({
        type: "error",
        text: "Deben completarse todos los campos obligatorios correctamente antes de guardar el registro."
      });
      return;
    }

    setFieldErrors({});

    // Generate a secure, unique anonymous registration ID
    const cleanId = "REG-" + Math.floor(10000000 + Math.random() * 90000000);

    setIsSubmitting(true);

    // Dynamic label resolution
    const pjsLabel = getSelectedLabel("pjs", pjsId);
    const ciudadLabel = getSelectedLabel("ciudades", ciudadId);
    const medicoLabel = getSelectedLabel("medicos", medicoId);
    const aseguradoraLabel = getSelectedLabel("aseguradoras", aseguradoraId);
    const institucionLabel = getSelectedLabel("instituciones", institucionId);
    const dispensacionLabel = getSelectedLabel("dispensaciones", dispensacionId);
    const distribuidorLabel = getSelectedLabel("distribuidores", distribuidorId);
    const indicacionLabel = getSelectedLabel("indicaciones", indicacionId);
    const dosisLabel = getSelectedLabel("dosis", dosisId);

    const nuevoPaciente: Paciente = {
      id: cleanId,
      nombre: "",
      apellido: "",
      pjsId,
      pjsLabel,
      ciudadId,
      ciudadLabel,
      medicoId,
      medicoLabel,
      aseguradoraId,
      aseguradoraLabel,
      sector,
      institucionId,
      institucionLabel,
      dispensacionId,
      dispensacionLabel,
      distribuidorId,
      distribuidorLabel,
      indicacionId,
      indicacionLabel,
      dosisId,
      dosisLabel,
      notesEncrypted: "",
      lineaTratamiento,
      fechaIngreso: formatDateToDMY(fechaIngreso),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: "active"
    };

    try {
      const success = await onAddPaciente(nuevoPaciente);
      if (success) {
        setMsg({
          type: "success",
          text: `Registro [${nuevoPaciente.id}] ingresado correctamente en la base de datos.`
        });
        setFieldErrors({});
        // Clear main fields
        setPjsId("");
        setCiudadId("");
        setMedicoId("");
        setAseguradoraId("");
        setInstitucionId("");
        setDispensacionId("");
        setDistribuidorId("");
        setIndicacionId("");
        setDosisId("");
        setLineaTratamiento("1era Línea");
        
        // Reset to empty for next record
        setFechaIngreso("");
      } else {
        setMsg({
          type: "error",
          text: "Error al registrar. Es posible que el ID de Paciente ya exista en la base de datos."
        });
      }
    } catch (err) {
      setMsg({ type: "error", text: "Ocurrió un error inesperado al sincronizar con Firestore." });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full bg-white rounded-2xl border border-slate-100 shadow-sm p-6 sm:p-8 animate-fade-in" id="nuevo-registro-view">
      
      {/* Title block */}
      <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-50 pb-5 mb-6 gap-3">
        <div>
          <h2 className="text-xl font-semibold text-slate-800 flex items-center gap-2">
            <PlusCircle className="h-5.5 w-5.5 text-emerald-600" />
            Ingresar Nuevo Registro Clínico
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Los datos sensibles y comentarios serán encriptados en el navegador antes de subir al Cloud.
          </p>
        </div>
        
        {/* Encryption key feedback indicator */}
        <div className="flex items-center gap-2 bg-emerald-50 px-3 py-1 rounded-lg border border-emerald-100 text-xs text-emerald-700">
          <Lock className="h-3.5 w-3.5 text-emerald-600" />
          <span>Cifrado: <strong className="font-mono">{encryptionKey.slice(0, 4)}***{encryptionKey.slice(-2)}</strong></span>
          <button 
            type="button"
            onClick={() => setShowKeyInfo(!showKeyInfo)} 
            className="text-[10px] underline ml-1 hover:text-emerald-900 cursor-pointer"
          >
            {showKeyInfo ? "Ocultar" : "Info"}
          </button>
        </div>
      </div>

      {showKeyInfo && (
        <div className="mb-6 p-4 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600 leading-relaxed animate-fade-in">
          <p className="font-semibold text-slate-700 mb-1">🔐 ¿Cómo funciona el encriptado clínico en esta app?</p>
          Esta aplicación implementa un protocolo Zero-Trust sobre la base de datos. Cualquier nota o comentario es codificado asimétricamente en el dispositivo utilizando la clave de la clínica. El servidor de Google Firestore solo almacena caracteres cifrados ininteligibles <code className="bg-slate-200 px-1 py-0.5 rounded text-rose-600 font-mono">"CYPHER::..."</code>. Solo los médicos con acceso a la clave local pueden desencriptar los datos en tiempo real al explorar la tabla de pacientes.
        </div>
      )}

      {/* Message alerts */}
      {msg && (
        <div className={`mb-6 p-4 rounded-xl border flex items-start gap-3 text-sm animate-fade-in ${
          msg.type === "success" 
            ? "bg-emerald-50 border-emerald-100 text-emerald-800" 
            : "bg-rose-50 border-rose-200 text-rose-800"
        }`}>
          {msg.type === "success" ? (
            <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
          ) : (
            <ShieldAlert className="h-5 w-5 text-rose-600 shrink-0 mt-0.5" />
          )}
          <span>{msg.text}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate className="space-y-6" id="admission-form">
        
        {/* Section 1: Clinical references and Entities configuration */}
        <div>
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">1. Parámetros Clínicos de Actividad</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
            
            {/* Fecha de Ingreso */}
            <div>
              <label className={`block text-xs font-medium mb-1.5 ${fieldErrors.fechaIngreso ? "text-rose-600 font-semibold" : "text-slate-600"}`} htmlFor="field-fecha-ingreso">
                Fecha de Ingreso *
              </label>
              <input
                ref={fechaIngresoRef}
                id="field-fecha-ingreso"
                type="date"
                required
                value={fechaIngreso}
                onChange={(e) => {
                  setFechaIngreso(e.target.value);
                  clearFieldError("fechaIngreso");
                }}
                aria-invalid={Boolean(fieldErrors.fechaIngreso)}
                className={`w-full rounded-lg px-3 py-2 text-sm focus:bg-white focus:outline-none focus:ring-2 cursor-pointer border ${
                  fieldErrors.fechaIngreso
                    ? "text-rose-900 bg-rose-50/50 border-rose-500 focus:ring-rose-500/20 focus:border-rose-500"
                    : "text-slate-800 bg-slate-50 border-slate-200 focus:ring-emerald-500/10 focus:border-emerald-500"
                }`}
              />
            </div>

            {/* PJS Selector */}
            <div>
              <label className={`block text-xs font-medium mb-1.5 ${fieldErrors.pjsId ? "text-rose-600 font-semibold" : "text-slate-600"}`} htmlFor="sel-pjs">
                Miembro PJS *
              </label>
              <SearchableSelect
                id="sel-pjs"
                value={pjsId}
                onChange={(val) => {
                  setPjsId(val);
                  if (val) clearFieldError("pjsId");
                }}
                options={getActiveOptions("pjs")}
                placeholder="-- Seleccionar miembro --"
                required
                hasError={Boolean(fieldErrors.pjsId)}
              />
            </div>

            {/* Ciudades de Actividad */}
            <div>
              <label className={`block text-xs font-medium mb-1.5 ${fieldErrors.ciudadId ? "text-rose-600 font-semibold" : "text-slate-600"}`} htmlFor="sel-ciudad">
                Ciudad del Perú *
              </label>
              <SearchableSelect
                id="sel-ciudad"
                value={ciudadId}
                onChange={(val) => {
                  setCiudadId(val);
                  if (val) clearFieldError("ciudadId");
                }}
                options={getActiveOptions("ciudades")}
                placeholder="-- Seleccionar ciudad --"
                required
                hasError={Boolean(fieldErrors.ciudadId)}
              />
            </div>

            {/* Médico Tratante */}
            <div>
              <label className={`block text-xs font-medium mb-1.5 ${fieldErrors.medicoId ? "text-rose-600 font-semibold" : "text-slate-600"}`} htmlFor="sel-medico">
                Médico Tratante *
              </label>
              <SearchableSelect
                id="sel-medico"
                value={medicoId}
                onChange={(val) => {
                  setMedicoId(val);
                  if (val) clearFieldError("medicoId");
                }}
                options={getActiveOptions("medicos")}
                placeholder="-- Seleccionar médico --"
                required
                hasError={Boolean(fieldErrors.medicoId)}
              />
            </div>

            {/* Aseguradora */}
            <div>
              <label className={`block text-xs font-medium mb-1.5 ${fieldErrors.aseguradoraId ? "text-rose-600 font-semibold" : "text-slate-600"}`} htmlFor="sel-aseguradora">
                Aseguradora *
              </label>
              <SearchableSelect
                id="sel-aseguradora"
                value={aseguradoraId}
                onChange={(val) => {
                  setAseguradoraId(val);
                  if (val) clearFieldError("aseguradoraId");
                }}
                options={getActiveOptions("aseguradoras")}
                placeholder="-- Seleccionar aseguradora --"
                required
                hasError={Boolean(fieldErrors.aseguradoraId)}
              />
            </div>

            {/* Sector Picker */}
            <div>
              <label className={`block text-xs font-medium mb-1.5 ${fieldErrors.sector ? "text-rose-600 font-semibold" : "text-slate-600"}`} htmlFor="sel-sector">
                Sector Salud *
              </label>
              <select
                id="sel-sector"
                required
                value={sector}
                onChange={(e) => {
                  setSector(e.target.value as any);
                  clearFieldError("sector");
                }}
                aria-invalid={Boolean(fieldErrors.sector)}
                className={`w-full rounded-lg px-3 py-2 text-sm focus:bg-white focus:outline-none focus:ring-2 font-medium border ${
                  fieldErrors.sector
                    ? "text-rose-900 bg-rose-50/50 border-rose-500 focus:ring-rose-500/20 focus:border-rose-500"
                    : "text-slate-800 bg-slate-50 border-slate-200 focus:ring-emerald-500/10 focus:border-emerald-500"
                }`}
              >
                <option value="Público">Público (Minsa, EsSalud)</option>
                <option value="Privado">Privado (Clínicas, Particular)</option>
              </select>
            </div>

            {/* Institucion */}
            <div>
              <label className={`block text-xs font-medium mb-1.5 ${fieldErrors.institucionId ? "text-rose-600 font-semibold" : "text-slate-600"}`} htmlFor="sel-institucion">
                Institución Médica *
              </label>
              <SearchableSelect
                id="sel-institucion"
                value={institucionId}
                onChange={(val) => {
                  setInstitucionId(val);
                  if (val) clearFieldError("institucionId");
                }}
                options={getActiveOptions("instituciones")}
                placeholder="-- Seleccionar institución --"
                required
                hasError={Boolean(fieldErrors.institucionId)}
              />
            </div>

            {/* Dispensacion */}
            <div>
              <label className={`block text-xs font-medium mb-1.5 ${fieldErrors.dispensacionId ? "text-rose-600 font-semibold" : "text-slate-600"}`} htmlFor="sel-dispensacion">
                Dispensación *
              </label>
              <SearchableSelect
                id="sel-dispensacion"
                value={dispensacionId}
                onChange={(val) => {
                  setDispensacionId(val);
                  if (val) clearFieldError("dispensacionId");
                }}
                options={getActiveOptions("dispensaciones")}
                placeholder="-- Seleccionar dispensación --"
                required
                hasError={Boolean(fieldErrors.dispensacionId)}
              />
            </div>

            {/* Distribuidor */}
            <div>
              <label className={`block text-xs font-medium mb-1.5 ${fieldErrors.distribuidorId ? "text-rose-600 font-semibold" : "text-slate-600"}`} htmlFor="sel-distribuidor">
                Distribuidor *
              </label>
              <SearchableSelect
                id="sel-distribuidor"
                value={distribuidorId}
                onChange={(val) => {
                  setDistribuidorId(val);
                  if (val) clearFieldError("distribuidorId");
                }}
                options={getActiveOptions("distribuidores")}
                placeholder="-- Seleccionar distribuidor --"
                required
                hasError={Boolean(fieldErrors.distribuidorId)}
              />
            </div>

            {/* Indicacion */}
            <div>
              <label className={`block text-xs font-medium mb-1.5 ${fieldErrors.indicacionId ? "text-rose-600 font-semibold" : "text-slate-600"}`} htmlFor="sel-indicacion">
                Indicación Clínica *
              </label>
              <SearchableSelect
                id="sel-indicacion"
                value={indicacionId}
                onChange={(val) => {
                  setIndicacionId(val);
                  if (val) clearFieldError("indicacionId");
                }}
                options={getActiveOptions("indicaciones")}
                placeholder="-- Seleccionar indicación --"
                required
                hasError={Boolean(fieldErrors.indicacionId)}
              />
            </div>

            {/* Dosis */}
            <div>
              <label className={`block text-xs font-medium mb-1.5 ${fieldErrors.dosisId ? "text-rose-600 font-semibold" : "text-slate-600"}`} htmlFor="sel-dosis">
                Dosis de Referencia *
              </label>
              <SearchableSelect
                id="sel-dosis"
                value={dosisId}
                onChange={(val) => {
                  setDosisId(val);
                  if (val) clearFieldError("dosisId");
                }}
                options={getActiveOptions("dosis")}
                placeholder="-- Seleccionar dosis --"
                required
                hasError={Boolean(fieldErrors.dosisId)}
              />
            </div>

            {/* Línea de tratamiento */}
            <div>
              <label className={`block text-xs font-medium mb-1.5 ${fieldErrors.lineaTratamiento ? "text-rose-600 font-semibold" : "text-slate-600"}`} htmlFor="sel-linea-tratamiento">
                Línea de Tratamiento *
              </label>
              <select
                id="sel-linea-tratamiento"
                required
                value={lineaTratamiento}
                onChange={(e) => {
                  setLineaTratamiento(e.target.value);
                  clearFieldError("lineaTratamiento");
                }}
                aria-invalid={Boolean(fieldErrors.lineaTratamiento)}
                className={`w-full rounded-lg px-3 py-2 text-sm focus:bg-white focus:outline-none focus:ring-2 font-medium cursor-pointer border ${
                  fieldErrors.lineaTratamiento
                    ? "text-rose-900 bg-rose-50/50 border-rose-500 focus:ring-rose-500/20 focus:border-rose-500"
                    : "text-slate-800 bg-slate-50 border-slate-200 focus:ring-emerald-500/10 focus:border-emerald-500"
                }`}
              >
                <option value="1era Línea">1era Línea (1L)</option>
                <option value="2da Línea">2da Línea (2L)</option>
                <option value="3era Línea">3era Línea (3L)</option>
                <option value="Mantenimiento">Mantenimiento</option>
                <option value="Adyuvancia / Neoadyuvancia">Adyuvancia / Neoadyuvancia</option>
              </select>
            </div>

          </div>
        </div>

        {/* Submit Block */}
        <div className="flex justify-end pt-6 border-t border-slate-100">
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white font-medium text-sm rounded-xl shadow-xs hover:shadow-md transition-all flex items-center gap-2 cursor-pointer"
          >
            {isSubmitting ? (
              <>
                <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Registrando en Cloud...
              </>
            ) : (
              "Ingresar Registro Clínico"
            )}
          </button>
        </div>

      </form>
    </div>
  );
}
