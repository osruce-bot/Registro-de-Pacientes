import React, { useState, useMemo } from "react";
import { FilterState, LookupItem, LookupType } from "../types";
import { Search, SlidersHorizontal, X, ChevronDown, ChevronUp } from "lucide-react";

interface CompactFiltersProps {
  filters: FilterState;
  onChange: (updatedFilters: FilterState) => void;
  lookups: Record<LookupType, LookupItem[]>;
}

export default function CompactFilters({ filters, onChange, lookups }: CompactFiltersProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Helper to sort lookup lists alphabetically
  const sortLookupList = (arr: LookupItem[] = []) => {
    return [...arr].sort((a, b) => {
      const nameA = `${a.nombre} ${a.apellido || ""}`.trim().toLowerCase();
      const nameB = `${b.nombre} ${b.apellido || ""}`.trim().toLowerCase();
      return nameA.localeCompare(nameB, "es", { sensitivity: "base" });
    });
  };

  const activePjs = useMemo(() => sortLookupList((lookups.pjs || []).filter(p => p.status === "activo")), [lookups]);
  const activeCiudades = useMemo(() => sortLookupList((lookups.ciudades || []).filter(c => c.status === "activo")), [lookups]);
  const activeMedicos = useMemo(() => sortLookupList((lookups.medicos || []).filter(m => m.status === "activo")), [lookups]);
  const activeAseguradoras = useMemo(() => sortLookupList((lookups.aseguradoras || []).filter(a => a.status === "activo")), [lookups]);
  const activeInstituciones = useMemo(() => sortLookupList((lookups.instituciones || []).filter(i => i.status === "activo")), [lookups]);
  const activeDispensaciones = useMemo(() => sortLookupList((lookups.dispensaciones || []).filter(d => d.status === "activo")), [lookups]);
  const activeDistribuidores = useMemo(() => sortLookupList((lookups.distribuidores || []).filter(d => d.status === "activo")), [lookups]);
  const activeIndicaciones = useMemo(() => sortLookupList((lookups.indicaciones || []).filter(i => i.status === "activo")), [lookups]);
  const activeDosis = useMemo(() => sortLookupList((lookups.dosis || []).filter(d => d.status === "activo")), [lookups]);

  // Check if any filter is active
  const isAnyFilterActive = useMemo(() => {
    return (
      filters.searchTerm.trim() !== "" ||
      filters.selectedSector !== "Todos" ||
      filters.selectedPjs !== "Todos" ||
      filters.selectedCiudad !== "Todos" ||
      filters.selectedMedico !== "Todos" ||
      filters.selectedAseguradora !== "Todos" ||
      filters.selectedInstitucion !== "Todos" ||
      filters.selectedDispensacion !== "Todos" ||
      filters.selectedDistribuidor !== "Todos" ||
      filters.selectedIndicacion !== "Todos" ||
      filters.selectedDosis !== "Todos"
    );
  }, [filters]);

  // Count active advanced filters
  const advancedFiltersCount = useMemo(() => {
    let count = 0;
    if (filters.selectedPjs !== "Todos") count++;
    if (filters.selectedCiudad !== "Todos") count++;
    if (filters.selectedMedico !== "Todos") count++;
    if (filters.selectedAseguradora !== "Todos") count++;
    if (filters.selectedInstitucion !== "Todos") count++;
    if (filters.selectedDispensacion !== "Todos") count++;
    if (filters.selectedDistribuidor !== "Todos") count++;
    if (filters.selectedIndicacion !== "Todos") count++;
    if (filters.selectedDosis !== "Todos") count++;
    return count;
  }, [filters]);

  const handleClearFilters = () => {
    onChange({
      searchTerm: "",
      selectedSector: "Todos",
      selectedPjs: "Todos",
      selectedCiudad: "Todos",
      selectedMedico: "Todos",
      selectedAseguradora: "Todos",
      selectedInstitucion: "Todos",
      selectedDispensacion: "Todos",
      selectedDistribuidor: "Todos",
      selectedIndicacion: "Todos",
      selectedDosis: "Todos",
    });
  };

  const updateKey = <K extends keyof FilterState>(key: K, value: FilterState[K]) => {
    onChange({
      ...filters,
      [key]: value,
    });
  };

  return (
    <div className="bg-white border border-slate-150 rounded-xl p-2.5 shadow-xs whitespace-nowrap transition-all duration-200" id="filters-container">
      {/* Top compact row */}
      <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center justify-between">
        <div className="flex flex-1 flex-col sm:flex-row gap-1.5 items-stretch sm:items-center">
          {/* Search bar */}
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              value={filters.searchTerm}
              onChange={(e) => updateKey("searchTerm", e.target.value)}
              placeholder="Buscar por ID, Ciudad, Médico..."
              className="w-full text-slate-700 bg-slate-50 border border-slate-200 rounded-lg pl-8.5 pr-2.5 py-1.5 text-xs focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500 h-8 font-medium placeholder-slate-400"
            />
          </div>

          {/* Sector filter */}
          <div className="w-full sm:w-32">
            <select
              value={filters.selectedSector}
              onChange={(e) => updateKey("selectedSector", e.target.value as any)}
              className="w-full text-slate-700 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 h-8 cursor-pointer font-medium"
            >
              <option value="Todos">Sector: Todos</option>
              <option value="Público">Público</option>
              <option value="Privado">Privado</option>
            </select>
          </div>

          {/* Toggle advanced filters */}
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className={`flex items-center justify-center gap-1.5 px-2.5 h-8 text-xs font-semibold rounded-lg border transition-all cursor-pointer ${
              isExpanded 
                ? "bg-slate-100 border-slate-305 text-slate-800" 
                : "bg-white hover:bg-slate-50 border-slate-200 text-slate-600"
            }`}
          >
            <SlidersHorizontal className="h-3.5 w-3.5 shrink-0" />
            <span>Filtros Catálogos</span>
            {advancedFiltersCount > 0 && (
              <span className="bg-emerald-600 text-white text-[9px] px-1.5 py-0.5 rounded-full font-bold ml-1 animate-pulse">
                {advancedFiltersCount}
              </span>
            )}
            {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </button>
        </div>

        {/* Clear filters button */}
        {isAnyFilterActive && (
          <button
            onClick={handleClearFilters}
            className="h-8 px-3 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 hover:text-rose-800 text-xs font-semibold rounded-lg inline-flex items-center gap-1.5 transition-all duration-200 cursor-pointer border border-rose-100/50"
            title="Limpiar todos los filtros"
          >
            <X className="h-3.5 w-3.5" />
            <span>Limpiar Filtros</span>
          </button>
        )}
      </div>

      {/* Advanced Collapsible filters (9 custom dropdowns in compact mode) */}
      {isExpanded && (
        <div className="mt-2.5 pt-2.5 border-t border-slate-100 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 xl:grid-cols-9 gap-2 animate-fade-in">
          {/* PJS */}
          <div>
            <select
              value={filters.selectedPjs}
              onChange={(e) => updateKey("selectedPjs", e.target.value)}
              className="w-full text-slate-700 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-[11px] h-7.5 focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer font-medium"
            >
              <option value="Todos">PJS: Todos</option>
              {activePjs.map(p => (
                <option key={p.id} value={p.id}>{p.nombre} {p.apellido || ""}</option>
              ))}
            </select>
          </div>

          {/* Sede / Ciudad */}
          <div>
            <select
              value={filters.selectedCiudad}
              onChange={(e) => updateKey("selectedCiudad", e.target.value)}
              className="w-full text-slate-700 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-[11px] h-7.5 focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer font-medium"
            >
              <option value="Todos">Ciudad: Todas</option>
              {activeCiudades.map(c => (
                <option key={c.id} value={c.id}>{c.nombre}</option>
              ))}
            </select>
          </div>

          {/* Médico */}
          <div>
            <select
              value={filters.selectedMedico}
              onChange={(e) => updateKey("selectedMedico", e.target.value)}
              className="w-full text-slate-700 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-[11px] h-7.5 focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer font-medium"
            >
              <option value="Todos">Médico: Todos</option>
              {activeMedicos.map(m => (
                <option key={m.id} value={m.id}>{m.nombre} {m.apellido || ""}</option>
              ))}
            </select>
          </div>

          {/* Aseguradora */}
          <div>
            <select
              value={filters.selectedAseguradora}
              onChange={(e) => updateKey("selectedAseguradora", e.target.value)}
              className="w-full text-slate-700 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-[11px] h-7.5 focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer font-medium"
            >
              <option value="Todos">Aseguradora: Todas</option>
              {activeAseguradoras.map(a => (
                <option key={a.id} value={a.id}>{a.nombre}</option>
              ))}
            </select>
          </div>

          {/* Institución */}
          <div>
            <select
              value={filters.selectedInstitucion}
              onChange={(e) => updateKey("selectedInstitucion", e.target.value)}
              className="w-full text-slate-700 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-[11px] h-7.5 focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer font-medium"
            >
              <option value="Todos">Institución: Todas</option>
              {activeInstituciones.map(i => (
                <option key={i.id} value={i.id}>{i.nombre}</option>
              ))}
            </select>
          </div>

          {/* Dispensación */}
          <div>
            <select
              value={filters.selectedDispensacion}
              onChange={(e) => updateKey("selectedDispensacion", e.target.value)}
              className="w-full text-slate-700 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-[11px] h-7.5 focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer font-medium"
            >
              <option value="Todos">Dispensación: Todas</option>
              {activeDispensaciones.map(d => (
                <option key={d.id} value={d.id}>{d.nombre}</option>
              ))}
            </select>
          </div>

          {/* Distribuidor */}
          <div>
            <select
              value={filters.selectedDistribuidor}
              onChange={(e) => updateKey("selectedDistribuidor", e.target.value)}
              className="w-full text-slate-700 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-[11px] h-7.5 focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer font-medium"
            >
              <option value="Todos">Distribuidor: Todos</option>
              {activeDistribuidores.map(d => (
                <option key={d.id} value={d.id}>{d.nombre}</option>
              ))}
            </select>
          </div>

          {/* Indicación */}
          <div>
            <select
              value={filters.selectedIndicacion}
              onChange={(e) => updateKey("selectedIndicacion", e.target.value)}
              className="w-full text-slate-700 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-[11px] h-7.5 focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer font-medium"
            >
              <option value="Todos">Indicación: Todas</option>
              {activeIndicaciones.map(i => (
                <option key={i.id} value={i.id}>{i.nombre}</option>
              ))}
            </select>
          </div>

          {/* Dosis */}
          <div>
            <select
              value={filters.selectedDosis}
              onChange={(e) => updateKey("selectedDosis", e.target.value)}
              className="w-full text-slate-700 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-[11px] h-7.5 focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer font-medium"
            >
              <option value="Todos">Dosis: Todas</option>
              {activeDosis.map(d => (
                <option key={d.id} value={d.id}>{d.nombre}</option>
              ))}
            </select>
          </div>
        </div>
      )}
    </div>
  );
}
