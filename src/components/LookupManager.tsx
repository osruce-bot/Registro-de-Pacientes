import React, { useState } from "react";
import { LookupItem, LookupType, LOOKUPS_CONFIG, LookupConfig, Paciente, capitalizeProperName } from "../types";
import { Plus, Power, PowerOff, Sparkles, SlidersHorizontal, MapPin, Stethoscope, Briefcase, Hash, Trash2, AlertTriangle } from "lucide-react";

interface LookupManagerProps {
  typesInGroup: LookupType[];
  groupTitle: string;
  lookups: Record<LookupType, LookupItem[]>;
  onSaveItem: (type: LookupType, item: LookupItem) => Promise<void>;
  onChangeStatus: (type: LookupType, id: string, newStatus: "activo" | "baja") => Promise<void>;
  pacientes?: Paciente[];
  onReassignPjs?: (
    sourcePjsId: string,
    targetPjs: { id?: string; nombre: string; apellido?: string }
  ) => Promise<void>;
  onClearAllLookups?: () => Promise<void>;
  onClearSingleLookup?: (type: LookupType) => Promise<void>;
}

export default function LookupManager({ 
  typesInGroup, 
  groupTitle,
  lookups, 
  onSaveItem, 
  onChangeStatus,
  pacientes,
  onReassignPjs,
  onClearAllLookups,
  onClearSingleLookup
}: LookupManagerProps) {
  
  // Link activeTab directly to a local state from typesInGroup prop
  const [activeTab, setActiveTab] = useState<LookupType>(typesInGroup[0]);

  // Create state fields
  const [newNombre, setNewNombre] = useState("");
  const [newApellido, setNewApellido] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // States for reassignment tool
  const [sourcePjsId, setSourcePjsId] = useState("");
  const [targetChoice, setTargetChoice] = useState(""); // existing PJs ID or "NEW"
  const [newReassignNombre, setNewReassignNombre] = useState("");
  const [newReassignApellido, setNewReassignApellido] = useState("");
  const [reassignSuccess, setReassignSuccess] = useState("");
  const [reassignError, setReassignError] = useState("");
  const [isReassigning, setIsReassigning] = useState(false);

  // States for database clearing
  const [clearingAll, setClearingAll] = useState(false);
  const [clearingActive, setClearingActive] = useState(false);
  const [confirmClearAll, setConfirmClearAll] = useState(false);
  const [confirmClearActive, setConfirmClearActive] = useState(false);

  // Read config
  const currentConfig = LOOKUPS_CONFIG[activeTab];

  // Sort items alphabetically!
  const items = [...(lookups[activeTab] || [])].sort((a, b) => {
    const nameA = `${a.nombre} ${a.apellido || ""}`.trim().toLowerCase();
    const nameB = `${b.nombre} ${b.apellido || ""}`.trim().toLowerCase();
    return nameA.localeCompare(nameB, "es", { sensitivity: "base" });
  });

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");

    if (!newNombre.trim()) {
      setErrorMsg("El nombre o elemento es obligatorio.");
      return;
    }

    if (currentConfig.hasSurname && !newApellido.trim()) {
      setErrorMsg("El apellido es obligatorio para " + currentConfig.title + ".");
      return;
    }

    setIsSubmitting(true);
    const generatedId = `${activeTab}_${Date.now()}`;
    const newItem: LookupItem = {
      id: generatedId,
      nombre: capitalizeProperName(newNombre.trim()),
      apellido: currentConfig.hasSurname ? capitalizeProperName(newApellido.trim()) : undefined,
      status: "activo"
    };

    try {
      await onSaveItem(activeTab, newItem);
      setSuccessMsg(`[${newItem.nombre}] registrado exitosamente en ${currentConfig.title}.`);
      setNewNombre("");
      setNewApellido("");
    } catch (e) {
      setErrorMsg("No se pudo agregar el elemento en Firestore.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleStatus = async (item: LookupItem) => {
    const nextStatus = item.status === "activo" ? "baja" : "activo";
    try {
      await onChangeStatus(activeTab, item.id, nextStatus);
    } catch (err) {
      alert("Error al cambiar el estado.");
    }
  };

  const handleExecuteReassignment = async (e: React.FormEvent) => {
    e.preventDefault();
    setReassignSuccess("");
    setReassignError("");

    if (!sourcePjsId) {
      setReassignError("Por favor seleccione el miembro PJS de origen.");
      return;
    }

    if (!targetChoice) {
      setReassignError("Por favor seleccione un miembro PJS de destino o elija la opción de registrar uno nuevo.");
      return;
    }

    const isNew = targetChoice === "NEW";
    if (isNew) {
      if (!newReassignNombre.trim()) {
        setReassignError("El nombre para el nuevo PJS es obligatorio.");
        return;
      }
      if (!newReassignApellido.trim()) {
        setReassignError("El apellido para el nuevo PJS es obligatorio.");
        return;
      }
    } else {
      if (sourcePjsId === targetChoice) {
        setReassignError("El miembro PJS de destino no puede ser idéntico al de origen.");
        return;
      }
    }

    setIsReassigning(true);
    try {
      if (onReassignPjs) {
        const targetPayload = isNew 
          ? { nombre: capitalizeProperName(newReassignNombre.trim()), apellido: capitalizeProperName(newReassignApellido.trim()) }
          : { id: targetChoice, nombre: "" };
          
        await onReassignPjs(sourcePjsId, targetPayload);
        
        const count = pacientes ? pacientes.filter(p => p.pjsId === sourcePjsId).length : 0;
        setReassignSuccess(`¡Éxito! Se han reasignado las cuentas de ${count} pacientes correctamente.`);
        
        // Reset states
        setSourcePjsId("");
        setTargetChoice("");
        setNewReassignNombre("");
        setNewReassignApellido("");
      }
    } catch (err) {
      setReassignError("Hubo un error al reasignar las cuentas.");
    } finally {
      setIsReassigning(false);
    }
  };

  const handleClearActiveCategory = async () => {
    if (!onClearSingleLookup) return;
    setClearingActive(true);
    setErrorMsg("");
    setSuccessMsg("");
    try {
      await onClearSingleLookup(activeTab);
      setSuccessMsg(`Catálogo "${currentConfig.pluralLabel}" vaciado correctamente.`);
      setConfirmClearActive(false);
    } catch (err) {
      setErrorMsg("Ocurrió un error al intentar vaciar la tabla.");
    } finally {
      setClearingActive(false);
    }
  };

  const handleClearAllCategories = async () => {
    if (!onClearAllLookups) return;
    setClearingAll(true);
    setErrorMsg("");
    setSuccessMsg("");
    try {
      await onClearAllLookups();
      setSuccessMsg("¡Éxito! Todas las tablas de catálogo se han vaciado correctamente.");
      setConfirmClearAll(false);
    } catch (err) {
      setErrorMsg("Ocurrió un error al intentar vaciar todos los catálogos.");
    } finally {
      setClearingAll(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-xs p-6 animate-fade-in flex flex-col md:h-[calc(100vh-13rem)] md:min-h-[580px]" id="lookup-manager-wrapper">
      
      <div className="flex items-center gap-3 border-b border-slate-50 pb-4 mb-4 shrink-0">
        <SlidersHorizontal className="h-6 w-6 text-indigo-600" />
        <div>
          <h2 className="text-xl font-semibold text-slate-800">
            {groupTitle}
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Gestión simplificada de parámetros en {groupTitle.toLowerCase()}. Agregue registros o de de baja para optimizar sus formularios.
          </p>
        </div>
      </div>

      {/* Inline Subtabs to switch between tables in this group */}
      <div className="flex flex-wrap gap-1.5 mb-4 p-1 bg-slate-50 border border-slate-100 rounded-xl shrink-0">
        {typesInGroup.map((type) => {
          const config = LOOKUPS_CONFIG[type];
          const isSelected = activeTab === type;
          const count = (lookups[type] || []).filter(i => i.status === "activo").length;
          
          return (
            <button
              key={type}
              type="button"
              onClick={() => {
                setActiveTab(type);
                setErrorMsg("");
                setSuccessMsg("");
              }}
              className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                isSelected 
                  ? "bg-white text-indigo-700 shadow-xs border border-indigo-100/50" 
                  : "text-slate-500 hover:text-slate-850 hover:bg-white/40"
              }`}
            >
              <span>{config.pluralLabel}</span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono ${
                isSelected ? "bg-indigo-50 text-indigo-700 font-bold" : "bg-slate-200/50 text-slate-500"
              }`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Active Manager Panel */}
      <div className="flex-1 min-h-0 flex flex-col" id="lookup-grid-layout">
        
        <div className="w-full flex-1 min-h-0 flex flex-col space-y-4" id="lookup-tab-content">
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 shrink-0">
            <h3 className="font-semibold text-xs text-slate-700 mb-2 flex items-center gap-1.5">
              <Plus className="h-4 w-4 text-indigo-600" />
              Añadir nuevo registro a: {currentConfig.pluralLabel}
            </h3>

            {errorMsg && (
              <div className="mb-2.5 text-xs text-rose-700 bg-rose-50 p-2 rounded-lg border border-rose-100">
                {errorMsg}
              </div>
            )}
            {successMsg && (
              <div className="mb-2.5 text-xs text-emerald-700 bg-emerald-50 p-2 rounded-lg border border-emerald-100">
                {successMsg}
              </div>
            )}

            <form onSubmit={handleCreate} className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
              <div>
                <label className="block text-[11px] font-medium text-slate-500 mb-1">
                  {currentConfig.hasSurname ? "Nombre *" : "Entidad / Valor *"}
                </label>
                <input
                  type="text"
                  value={newNombre}
                  onChange={(e) => setNewNombre(e.target.value)}
                  placeholder={currentConfig.hasSurname ? "Ej. Carlos" : `Registrar ${currentConfig.title}`}
                  list="lookup-manager-names"
                  className="w-full text-slate-800 bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs focus:ring-1 focus:ring-indigo-500/30 focus:border-indigo-500 focus:outline-none"
                />
                <datalist id="lookup-manager-names">
                  {items.map((item) => (
                    <option key={item.id} value={item.nombre} />
                  ))}
                </datalist>
              </div>

              {currentConfig.hasSurname && (
                <div>
                  <label className="block text-[11px] font-medium text-slate-500 mb-1">
                    Apellido *
                  </label>
                  <input
                    type="text"
                    value={newApellido}
                    onChange={(e) => setNewApellido(e.target.value)}
                    placeholder="Ej. Mendoza"
                    list="lookup-manager-surnames"
                    className="w-full text-slate-800 bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs focus:ring-1 focus:ring-indigo-500/30 focus:border-indigo-500 focus:outline-none"
                  />
                  <datalist id="lookup-manager-surnames">
                    {items.filter(item => item.apellido).map((item) => (
                      <option key={item.id} value={item.apellido} />
                    ))}
                  </datalist>
                </div>
              )}

              <div>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium py-1.5 px-4 rounded-lg inline-flex items-center justify-center gap-1 transition-colors disabled:bg-slate-300 cursor-pointer h-[34px]"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Agregar Item
                </button>
              </div>
            </form>
          </div>

          {/* Current Elements List */}
          <div className="flex-1 min-h-0 flex flex-col">
            <div className="flex flex-wrap items-center justify-between mb-2 shrink-0 gap-2">
              <h4 className="font-semibold text-slate-700 text-xs uppercase tracking-wider">
                Catálogo actual ({items.length} totales)
              </h4>
              <div className="flex flex-wrap items-center gap-2">
                {items.length > 0 && onClearSingleLookup && (
                  <button
                    type="button"
                    onClick={() => {
                      setConfirmClearActive(true);
                      setConfirmClearAll(false);
                    }}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-rose-600 hover:text-white bg-rose-50 hover:bg-rose-600 border border-rose-100 px-2.5 py-1.5 rounded-xl transition-all cursor-pointer shadow-xs"
                  >
                    <Trash2 className="h-3 w-3" />
                    Vaciar {currentConfig.title}
                  </button>
                )}
                {onClearAllLookups && (
                  <button
                    type="button"
                    onClick={() => {
                      setConfirmClearAll(true);
                      setConfirmClearActive(false);
                    }}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-rose-700 hover:text-white bg-rose-100 hover:bg-rose-700 border border-rose-200 px-2.5 py-1.5 rounded-xl transition-all cursor-pointer shadow-xs"
                  >
                    <AlertTriangle className="h-3 w-3 text-rose-600" />
                    Vaciar Todos los Catálogos
                  </button>
                )}
              </div>
            </div>

            {confirmClearActive && (
              <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 mb-3 animate-fade-in text-xs text-rose-900 shrink-0">
                <div className="flex items-start gap-2.5">
                  <AlertTriangle className="h-4 w-4 text-rose-600 mt-0.5 shrink-0" />
                  <div className="space-y-1">
                    <strong className="font-bold block">¿Eliminar todos los registros de "{currentConfig.pluralLabel}"?</strong>
                    <p className="text-slate-600 leading-relaxed">
                      Esta acción borrará permanentemente de forma masiva este catálogo del sistema. Los pacientes existentes vinculados a este catálogo conservarán su información de texto en el historial clínico, pero los selectores se quedarán vacíos.
                    </p>
                    <div className="flex items-center gap-2 pt-2">
                      <button
                        type="button"
                        disabled={clearingActive}
                        onClick={handleClearActiveCategory}
                        className="bg-rose-600 hover:bg-rose-700 text-white font-bold px-3 py-1.5 rounded-lg border-0 cursor-pointer disabled:bg-slate-300 text-xs"
                      >
                        {clearingActive ? "Eliminando..." : "Sí, borrar catálogo"}
                      </button>
                      <button
                        type="button"
                        disabled={clearingActive}
                        onClick={() => setConfirmClearActive(false)}
                        className="bg-white hover:bg-slate-100 text-slate-700 font-semibold px-3 py-1.5 border border-slate-200 rounded-lg cursor-pointer text-xs"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {confirmClearAll && (
              <div className="bg-rose-50 border border-rose-205 rounded-xl p-4 mb-3 animate-fade-in text-xs text-rose-950 shrink-0">
                <div className="flex items-start gap-2.5">
                  <AlertTriangle className="h-4 w-4 text-rose-700 mt-0.5 shrink-0" />
                  <div className="space-y-1.5">
                    <strong className="font-bold block">💥 ¿Eliminar absolutamente TODOS los registros de catálogo de la base de datos?</strong>
                    <p className="text-slate-700 leading-relaxed">
                      Esta es una acción irreversible y crítica que eliminará permanentemente la totalidad de registros cargados en las 9 tablas de catálogo (Miembros PJS, Doctores, Ciudades, Aseguradoras, Clínicas, etc.). Esto dejará las tablas completamente en blanco para que puedas volver a cargarlas limpiamente.
                    </p>
                    <div className="flex items-center gap-2 pt-2">
                      <button
                        type="button"
                        disabled={clearingAll}
                        onClick={handleClearAllCategories}
                        className="bg-rose-700 hover:bg-rose-800 text-white font-bold px-4 py-1.5 rounded-lg border-0 cursor-pointer disabled:bg-slate-300 text-xs"
                      >
                        {clearingAll ? "Vaciando todo..." : "Sí, vaciar todas las tablas"}
                      </button>
                      <button
                        type="button"
                        disabled={clearingAll}
                        onClick={() => setConfirmClearAll(false)}
                        className="bg-white hover:bg-slate-100 text-slate-700 font-semibold px-4 py-1.5 border border-slate-200 rounded-lg cursor-pointer text-xs"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="border border-slate-100 rounded-xl overflow-hidden flex-1 min-h-0 overflow-y-auto bg-white custom-scrollbar">
              {items.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-400 bg-slate-50">
                  Ningún elemento configurado. Use el formulario de arriba para agregar uno.
                </div>
              ) : (
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#fcfdfe] border-b border-slate-100 text-[10px] font-semibold text-slate-400 uppercase tracking-tight sticky top-0 z-10">
                    <tr>
                      <th className="py-2.5 px-4 bg-[#fcfdfe]">Nombre / Entidad</th>
                      <th className="py-2.5 px-4 bg-[#fcfdfe]">Estado</th>
                      <th className="py-2.5 px-4 bg-[#fcfdfe] text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {items.map((item) => {
                      const isLow = item.status === "baja";
                      return (
                        <tr key={item.id} className={`hover:bg-slate-50/50 ${isLow ? "bg-slate-50/30 text-slate-400" : "text-slate-700"}`}>
                          <td className="py-2.5 px-4 font-medium">
                            {item.nombre} {item.apellido || ""}
                          </td>
                          <td className="py-2.5 px-4">
                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-medium leading-none inline-block ${
                              isLow 
                                ? "bg-rose-50 text-rose-600 border border-rose-100" 
                                : "bg-emerald-50 text-emerald-600 border border-emerald-100"
                            }`}>
                              {isLow ? "De Baja" : "Activo"}
                            </span>
                          </td>
                          <td className="py-2.5 px-4 text-right">
                            <button
                              onClick={() => handleToggleStatus(item)}
                              className={`inline-flex items-center gap-1 text-[10px] font-medium px-2 py-1 rounded transition-colors cursor-pointer ${
                                isLow 
                                  ? "bg-emerald-50 hover:bg-emerald-100 text-emerald-700" 
                                  : "bg-rose-50 hover:bg-rose-100 text-rose-700"
                              }`}
                            >
                              {isLow ? (
                                <>
                                  <Power className="h-3 w-3" />
                                  Dar Alta
                                </>
                              ) : (
                                <>
                                  <PowerOff className="h-3 w-3" />
                                  Dar Baja
                                </>
                              )}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* PJS Reassignment Tool Segment */}
          {activeTab === "pjs" && (
            <div className="bg-indigo-50/50 p-4 rounded-xl border border-indigo-100/70 shrink-0 mt-3" id="pjs-reassign-segment">
              <h3 className="font-semibold text-xs text-indigo-900 mb-1 flex items-center gap-1.5">
                <Briefcase className="h-4 w-4 text-indigo-650" />
                Herramienta de Reasignación de Pacientes PJS
              </h3>
              <p className="text-[11px] text-indigo-700 mb-2.5 leading-relaxed">
                Reasigne los pacientes vinculados a un miembro PJS hacia otro miembro existente o registrar uno nuevo manualmente.
              </p>

              {reassignError && (
                <div className="mb-2 text-xs text-rose-700 bg-rose-50 p-1.5 rounded-lg border border-rose-100">
                  {reassignError}
                </div>
              )}
              {reassignSuccess && (
                <div className="mb-2 text-xs text-emerald-700 bg-emerald-50 p-1.5 rounded-lg border border-emerald-100">
                  {reassignSuccess}
                </div>
              )}

              <form onSubmit={handleExecuteReassignment} className="grid grid-cols-1 md:grid-cols-4 gap-3.5 items-end">
                {/* Source PJS */}
                <div>
                  <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">
                    PJS Origen *
                  </label>
                  <select
                    value={sourcePjsId}
                    onChange={(e) => {
                      setSourcePjsId(e.target.value);
                      setReassignSuccess("");
                      setReassignError("");
                    }}
                    className="w-full text-slate-800 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs focus:ring-1 focus:ring-indigo-500/30 focus:border-indigo-500 focus:outline-none"
                  >
                    <option value="">-- Seleccionar origen --</option>
                    {items.map(item => {
                      const count = pacientes ? pacientes.filter(p => p.pjsId === item.id).length : 0;
                      return (
                        <option key={item.id} value={item.id}>
                          {item.nombre} {item.apellido || ""} ({count} pac.)
                        </option>
                      );
                    })}
                  </select>
                </div>

                {/* Target Selection */}
                <div>
                  <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">
                    PJS Destino *
                  </label>
                  <select
                    value={targetChoice}
                    onChange={(e) => {
                      setTargetChoice(e.target.value);
                      setReassignSuccess("");
                      setReassignError("");
                    }}
                    className="w-full text-slate-800 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs focus:ring-1 focus:ring-indigo-500/30 focus:border-indigo-500 focus:outline-none"
                  >
                    <option value="">-- Seleccionar destino --</option>
                    <option value="NEW" className="font-semibold text-indigo-700">+ Registrar nuevo manual...</option>
                    {items
                      .filter(item => item.id !== sourcePjsId)
                      .map(item => (
                        <option key={item.id} value={item.id}>
                          {item.nombre} {item.apellido || ""}
                        </option>
                      ))
                    }
                  </select>
                </div>

                {/* Manual fields for new target if selected */}
                {targetChoice === "NEW" ? (
                  <div className="grid grid-cols-2 gap-1 px-1.5">
                    <div>
                      <input
                        type="text"
                        placeholder="Nombre nuevo"
                        value={newReassignNombre}
                        onChange={(e) => setNewReassignNombre(e.target.value)}
                        className="w-full text-slate-800 bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs focus:ring-1 focus:ring-indigo-500/30 focus:border-indigo-500 focus:outline-none h-[34px]"
                      />
                    </div>
                    <div>
                      <input
                        type="text"
                        placeholder="Apellido"
                        value={newReassignApellido}
                        onChange={(e) => setNewReassignApellido(e.target.value)}
                        className="w-full text-slate-800 bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs focus:ring-1 focus:ring-indigo-500/30 focus:border-indigo-500 focus:outline-none h-[34px]"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="hidden md:block"></div>
                )}

                {/* Submit Action */}
                <div>
                  <button
                    type="submit"
                    disabled={isReassigning}
                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold py-1.5 px-4 rounded-lg inline-flex items-center justify-center gap-1 transition-colors disabled:bg-slate-350 cursor-pointer h-[34px]"
                  >
                    {isReassigning ? "Procesando..." : "Ejecutar Migración"}
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
