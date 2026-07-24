import React, { useState, useMemo } from "react";
import { Paciente, LookupItem, LookupType, FilterState, getFilteredPacientes } from "../types";
import CompactFilters from "./CompactFilters";
import { decryptText, encryptText } from "../encryptUtils";
import { 
  Search, 
  Filter, 
  Edit3, 
  Trash2, 
  Download, 
  Lock, 
  Unlock, 
  Eye, 
  Check, 
  X,
  FileSpreadsheet,
  ChevronRight,
  Info,
  Database
} from "lucide-react";
import { jsPDF } from "jspdf";
import SearchableSelect from "./SearchableSelect";

export function formatDateToDMY(dateStr?: string): string {
  if (!dateStr) return "";
  
  // Clean off whitespaces and separators
  const trimmed = dateStr.trim();
  
  // If already in DD/MM/YYYY format
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(trimmed)) {
    return trimmed;
  }

  // Handle DD/MM/YY (2-digit year)
  const dmy2Match = trimmed.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2})$/);
  if (dmy2Match) {
    const dd = dmy2Match[1].padStart(2, '0');
    const mm = dmy2Match[2].padStart(2, '0');
    const yy = parseInt(dmy2Match[3], 10);
    const yyyy = yy > 50 ? 1900 + yy : 2000 + yy;
    return `${dd}/${mm}/${yyyy}`;
  }

  try {
    // Match YYYY-MM-DD
    const match = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) {
      return `${match[3]}/${match[2]}/${match[1]}`;
    }
    
    // Fallback: Parse with Date object
    const d = new Date(trimmed);
    if (!isNaN(d.getTime())) {
      const dd = String(d.getDate()).padStart(2, '0');
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const yyyy = d.getFullYear();
      return `${dd}/${mm}/${yyyy}`;
    }
  } catch (e) {
    // ignore
  }
  return trimmed;
}

export function formatDateToYMD(dateStr?: string): string {
  if (!dateStr) {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }
  // If already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return dateStr;
  }
  // If DD/MM/AAAA
  const match = dateStr.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (match) {
    return `${match[3]}-${match[2]}-${match[1]}`;
  }
  try {
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) {
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      return `${yyyy}-${mm}-${dd}`;
    }
  } catch (e) {}
  
  return dateStr;
}

export function parseDateToTime(dateStr?: string, fallbackCreatedAt?: string): number {
  const finalStr = dateStr || (typeof fallbackCreatedAt === "string" ? fallbackCreatedAt.split("T")[0] : null);
  if (!finalStr) return 0;
  
  const trimmed = finalStr.trim();
  
  // DD/MM/YYYY Match
  const dmyMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (dmyMatch) {
    const dd = parseInt(dmyMatch[1], 10);
    const mm = parseInt(dmyMatch[2], 10) - 1;
    const yyyy = parseInt(dmyMatch[3], 10);
    return new Date(yyyy, mm, dd).getTime();
  }

  // DD/MM/YY Match
  const dmy2Match = trimmed.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2})$/);
  if (dmy2Match) {
    const dd = parseInt(dmy2Match[1], 10);
    const mm = parseInt(dmy2Match[2], 10) - 1;
    const yy = parseInt(dmy2Match[3], 10);
    const yyyy = yy > 50 ? 1900 + yy : 2000 + yy;
    return new Date(yyyy, mm, dd).getTime();
  }

  // YYYY-MM-DD Match
  const ymdMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (ymdMatch) {
    const yyyy = parseInt(ymdMatch[1], 10);
    const mm = parseInt(ymdMatch[2], 10) - 1;
    const dd = parseInt(ymdMatch[3], 10);
    return new Date(yyyy, mm, dd).getTime();
  }

  const d = new Date(trimmed);
  if (!isNaN(d.getTime())) {
    return d.getTime();
  }

  return 0;
}

export function calculateMonthsElapsed(fechaStr?: string, createdAt?: string): string {
  const dateStr = fechaStr || (typeof createdAt === "string" ? createdAt.split("T")[0] : null);
  if (!dateStr) return "0";
  try {
    let year = 0;
    let month = 0;
    let day = 0;

    const trimmed = dateStr.trim();
    
    // 1. Check for Excel serial number (e.g. 45412)
    const num = Number(trimmed);
    if (!isNaN(num) && num > 30000 && num < 60000) {
      const date = new Date(Math.round((num - 25569) * 86400) * 1000);
      if (!isNaN(date.getTime())) {
        day = date.getDate();
        month = date.getMonth();
        year = date.getFullYear();
      }
    } else {
      // 2. Check for DD/MM/YYYY or D/M/YYYY or DD-MM-YYYY or DD.MM.YYYY
      const dmyMatch = trimmed.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/);
      if (dmyMatch) {
        day = parseInt(dmyMatch[1], 10);
        month = parseInt(dmyMatch[2], 10) - 1;
        year = parseInt(dmyMatch[3], 10);
      } else {
        // 3. Check for DD/MM/YY
        const dmy2Match = trimmed.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2})$/);
        if (dmy2Match) {
          day = parseInt(dmy2Match[1], 10);
          month = parseInt(dmy2Match[2], 10) - 1;
          const yy = parseInt(dmy2Match[3], 10);
          year = yy > 50 ? 1900 + yy : 2000 + yy;
        } else {
          // 4. Check for YYYY-MM-DD or YYYY/MM/DD
          const ymdMatch = trimmed.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
          if (ymdMatch) {
            year = parseInt(ymdMatch[1], 10);
            month = parseInt(ymdMatch[2], 10) - 1;
            day = parseInt(ymdMatch[3], 10);
          } else {
            // Fallback standard parsing
            const d = new Date(trimmed);
            if (isNaN(d.getTime())) return "0";
            year = d.getFullYear();
            month = d.getMonth();
            day = d.getDate();
          }
        }
      }
    }
    
    if (!year) return "0";

    const ingressDate = new Date(year, month, day);
    const today = new Date();
    
    const diffYears = today.getFullYear() - ingressDate.getFullYear();
    const diffMonths = today.getMonth() - ingressDate.getMonth();
    let months = diffYears * 12 + diffMonths;
    
    // Adjust if current day is before the enrollment day
    if (today.getDate() < ingressDate.getDate()) {
      months--;
    }
    
    return months < 0 ? "0" : String(months);
  } catch (e) {
    return "0";
  }
}

interface PatientsTableProps {
  pacientes: Paciente[];
  lookups: Record<LookupType, LookupItem[]>;
  filters: FilterState;
  onFilterChange: (filters: FilterState) => void;
  onUpdatePaciente: (paciente: Paciente) => Promise<boolean | void>;
  onDeletePaciente: (id: string) => Promise<void>;
  onClearAllPacientes: () => Promise<void>;
  encryptionKey: string;
  onSetEncryptionKey: (key: string) => void;
  onNavigateToTab?: (tab: any) => void;
}

export default function PatientsTable({
  pacientes,
  lookups,
  filters,
  onFilterChange,
  onUpdatePaciente,
  onDeletePaciente,
  onClearAllPacientes,
  encryptionKey,
  onSetEncryptionKey,
  onNavigateToTab
}: PatientsTableProps) {
  // Edit modal state
  const [editingPaciente, setEditingPaciente] = useState<Paciente | null>(null);
  const [tempPjsId, setTempPjsId] = useState("");
  const [tempCiudadId, setTempCiudadId] = useState("");
  const [tempMedicoId, setTempMedicoId] = useState("");
  const [tempAseguradoraId, setTempAseguradoraId] = useState("");
  const [tempSector, setTempSector] = useState<"Público" | "Privado">("Privado");
  const [tempInstitucionId, setTempInstitucionId] = useState("");
  const [tempDispensacionId, setTempDispensacionId] = useState("");
  const [tempDistribuidorId, setTempDistribuidorId] = useState("");
  const [tempIndicacionId, setTempIndicacionId] = useState("");
  const [tempDosisId, setTempDosisId] = useState("");
  const [tempLineaTratamiento, setTempLineaTratamiento] = useState("");
  const [tempFechaIngreso, setTempFechaIngreso] = useState("");
  const [tempFechaBaja, setTempFechaBaja] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);

  // Detail panel state for expandables
  const [expandedPacienteId, setExpandedPacienteId] = useState<string | null>(null);

  // Key visual unlock state
  const [showKeyInput, setShowKeyInput] = useState(false);
  const [inputKey, setInputKey] = useState(encryptionKey);

  // Clear all states and action handlers
  const [confirmClear, setConfirmClear] = useState(false);
  const [clearingInProgress, setClearingInProgress] = useState(false);

  const handleClearAllClick = async () => {
    if (!confirmClear) {
      setConfirmClear(true);
      return;
    }
    
    setClearingInProgress(true);
    try {
      await onClearAllPacientes();
      setConfirmClear(false);
    } catch (e) {
      console.error(e);
    } finally {
      setClearingInProgress(false);
    }
  };

  // Retrieve lookup details
  const getSelectedLabel = (type: LookupType, id: string): string => {
    const list = lookups[type] || [];
    const found = list.find(item => item.id === id);
    if (!found) return "";
    return found.apellido ? `${found.nombre} ${found.apellido}` : found.nombre;
  };

  // Helper to sort alphabetically
  const sortLookupList = (arr: LookupItem[]) => {
    return [...arr].sort((a, b) => {
      const nameA = `${a.nombre} ${a.apellido || ""}`.trim().toLowerCase();
      const nameB = `${b.nombre} ${b.apellido || ""}`.trim().toLowerCase();
      return nameA.localeCompare(nameB, "es", { sensitivity: "base" });
    });
  };

  // Filter lists (only active lookups for select dropdowns) & Sort alphabetically!
  const activePjs = useMemo(() => sortLookupList((lookups.pjs || []).filter(p => p.status === "activo")), [lookups]);
  const activeCiudades = useMemo(() => sortLookupList((lookups.ciudades || []).filter(c => c.status === "activo")), [lookups]);
  const activeMedicos = useMemo(() => sortLookupList((lookups.medicos || []).filter(m => m.status === "activo")), [lookups]);
  const activeAseguradoras = useMemo(() => sortLookupList((lookups.aseguradoras || []).filter(a => a.status === "activo")), [lookups]);
  const activeInstituciones = useMemo(() => sortLookupList((lookups.instituciones || []).filter(i => i.status === "activo")), [lookups]);
  const activeDispensaciones = useMemo(() => sortLookupList((lookups.dispensaciones || []).filter(d => d.status === "activo")), [lookups]);
  const activeDistribuidores = useMemo(() => sortLookupList((lookups.distribuidores || []).filter(d => d.status === "activo")), [lookups]);
  const activeIndicaciones = useMemo(() => sortLookupList((lookups.indicaciones || []).filter(i => i.status === "activo")), [lookups]);
  const activeDosis = useMemo(() => sortLookupList((lookups.dosis || []).filter(d => d.status === "activo")), [lookups]);

  // Apply search & filters
  const filteredPacientes = useMemo(() => {
    return getFilteredPacientes(pacientes, filters).sort((a, b) => {
      const timeA = parseDateToTime(a.fechaIngreso, a.createdAt);
      const timeB = parseDateToTime(b.fechaIngreso, b.createdAt);
      return timeB - timeA;
    });
  }, [pacientes, filters]);

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

  // Initiate edit flow
  const handleOpenEdit = (p: Paciente) => {
    setEditingPaciente(p);
    setTempPjsId(p.pjsId);
    setTempCiudadId(p.ciudadId);
    setTempMedicoId(p.medicoId);
    setTempAseguradoraId(p.aseguradoraId);
    setTempSector(p.sector);
    setTempInstitucionId(p.institucionId);
    setTempDispensacionId(p.dispensacionId);
    setTempDistribuidorId(p.distribuidorId);
    setTempIndicacionId(p.indicacionId);
    setTempDosisId(p.dosisId);
    setTempLineaTratamiento(p.lineaTratamiento || "1era Línea");
    setTempFechaIngreso(p.fechaIngreso ? formatDateToYMD(p.fechaIngreso) : "");
    setTempFechaBaja(p.fechaBaja ? formatDateToYMD(p.fechaBaja) : "");
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPaciente) return;
    setIsUpdating(true);

    const pack: Paciente = {
      ...editingPaciente,
      pjsId: tempPjsId,
      pjsLabel: getSelectedLabel("pjs", tempPjsId),
      ciudadId: tempCiudadId,
      ciudadLabel: getSelectedLabel("ciudades", tempCiudadId),
      medicoId: tempMedicoId,
      medicoLabel: getSelectedLabel("medicos", tempMedicoId),
      aseguradoraId: tempAseguradoraId,
      aseguradoraLabel: getSelectedLabel("aseguradoras", tempAseguradoraId),
      sector: tempSector,
      institucionId: tempInstitucionId,
      institucionLabel: getSelectedLabel("instituciones", tempInstitucionId),
      dispensacionId: tempDispensacionId,
      dispensacionLabel: getSelectedLabel("dispensaciones", tempDispensacionId),
      distribuidorId: tempDistribuidorId,
      distribuidorLabel: getSelectedLabel("distribuidores", tempDistribuidorId),
      indicacionId: tempIndicacionId,
      indicacionLabel: getSelectedLabel("indicaciones", tempIndicacionId),
      dosisId: tempDosisId,
      dosisLabel: getSelectedLabel("dosis", tempDosisId),
      lineaTratamiento: tempLineaTratamiento,
      fechaIngreso: formatDateToDMY(tempFechaIngreso),
      fechaBaja: tempFechaBaja ? formatDateToDMY(tempFechaBaja) : "",
      updatedAt: new Date().toISOString()
    };

    try {
      await onUpdatePaciente(pack);
      setEditingPaciente(null);
    } catch (e) {
      alert("Error al actualizar paciente.");
    } finally {
      setIsUpdating(false);
    }
  };

  // Update dynamic decryption key
  const handleApplyKey = (e: React.FormEvent) => {
    e.preventDefault();
    onSetEncryptionKey(inputKey);
    setShowKeyInput(false);
  };

  /**
   * Compact, Lightweight Porter A4 Executive Summary Report generator
   */
  const handleGeneratePDF = () => {
    const doc = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4" // 210 x 297 mm
    });

    const total = filteredPacientes.length;
    const activosList = filteredPacientes.filter(p => p.status !== "inactive" && (!p.fechaBaja || p.fechaBaja.trim() === "" || p.fechaBaja.trim().toLowerCase() === "no tiene"));
    const activos = activosList.length;
    const bajas = total - activos;
    const rateActivos = total > 0 ? Math.round((activos / total) * 100) : 0;
    const rateBajas = total > 0 ? Math.round((bajas / total) * 100) : 0;

    const publicoCount = activosList.filter(p => p.sector === "Público").length;
    const privadoCount = activosList.filter(p => p.sector === "Privado").length;
    const pubRate = activos > 0 ? Math.round((publicoCount / activos) * 100) : 0;
    const privRate = activos > 0 ? Math.round((privadoCount / activos) * 100) : 0;

    // Helper to extract top distributions
    const getTopItems = (fieldId: keyof Paciente, type: LookupType, max = 5) => {
      const counts: Record<string, number> = {};
      const lookupList = lookups[type] || [];
      
      activosList.forEach(p => {
        const val = p[fieldId] as string;
        if (val && val !== "Todos") {
          counts[val] = (counts[val] || 0) + 1;
        }
      });

      return Object.entries(counts)
        .map(([id, count]) => {
          const lItem = lookupList.find(item => item.id === id);
          const name = lItem ? (lItem.apellido ? `${lItem.nombre} ${lItem.apellido}` : lItem.nombre) : id;
          return { name, count };
        })
        .sort((a, b) => b.count - a.count)
        .slice(0, max);
    };

    const topCiudades = getTopItems("ciudadId", "ciudades", 10);
    const topMedicos = getTopItems("medicoId", "medicos", 10);
    const topAseguradoras = getTopItems("aseguradoraId", "aseguradoras", 10);
    const topIndicaciones = getTopItems("indicacionId", "indicaciones", 10);
    const topCanales = getTopItems("distribuidorId", "distribuidores", 5);

    // Helpers to draw tables & cards
    const PRIMARY_COLOR = [15, 23, 42]; // Slate 900
    const ACCENT_COLOR = [238, 183, 9]; // AstraZeneca Yellow

    // 1. Header Banner
    doc.setFillColor(PRIMARY_COLOR[0], PRIMARY_COLOR[1], PRIMARY_COLOR[2]);
    doc.rect(12, 10, 186, 20, "F");

    doc.setFillColor(ACCENT_COLOR[0], ACCENT_COLOR[1], ACCENT_COLOR[2]);
    doc.rect(12, 30, 186, 1.2, "F");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10.5);
    doc.setTextColor(255, 255, 255);
    doc.text("REPORTE EJECUTIVO - REGISTRO DE PACIENTES", 17, 17);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.text("AstraZeneca Perú — Medicamentos de Alta Especialidad", 17, 23);

    doc.setFontSize(7);
    doc.text(`Ficha: ${new Date().toLocaleDateString()}`, 160, 17);
    doc.text("Página 1 de 1 (Resumen)", 160, 23);

    // 2. Filter Summary Card
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.rect(12, 34, 186, 11, "FD");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.5);
    doc.setTextColor(51, 65, 85);
    doc.text("FILTROS ACTIVOS DE SELECCIÓN:", 16, 38);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.5);
    doc.setTextColor(100, 116, 139);
    const pjsName = filters.selectedPjs === "Todos" ? "Todos" : getSelectedLabel("pjs", filters.selectedPjs);
    const ciudadName = filters.selectedCiudad === "Todos" ? "Todas" : getSelectedLabel("ciudades", filters.selectedCiudad);
    const medicoName = filters.selectedMedico === "Todos" ? "Todos" : getSelectedLabel("medicos", filters.selectedMedico);
    const aseguradoraName = filters.selectedAseguradora === "Todos" ? "Todas" : getSelectedLabel("aseguradoras", filters.selectedAseguradora);

    doc.text(`Sector: ${filters.selectedSector}  |  PJS: ${pjsName.slice(0, 32)}  |  Ciudad: ${ciudadName.slice(0, 32)}`, 16, 42);
    doc.text(`Médico: ${medicoName.slice(0, 35)}  |  Aseguradora: ${aseguradoraName.slice(0, 35)}`, 110, 42);

    // 3. KPI Cards Group
    const cards = [
      { title: "PACIENTES ACTIVOS", value: `${activos}`, pct: `${rateActivos}%`, desc: "En tratamiento actual", bg: [236, 253, 245], border: [16, 185, 129], text: [6, 95, 70] },
      { title: "RETIRADOS / BAJAS", value: `${bajas}`, pct: `${rateBajas}%`, desc: "Suspensiones registradas", bg: [254, 242, 242], border: [239, 68, 68], text: [153, 27, 27] },
      { title: "TOTAL REGISTRADOS", value: `${total}`, pct: "100%", desc: "Población total calificada", bg: [248, 250, 252], border: [203, 213, 225], text: [15, 23, 42] }
    ];

    cards.forEach((card, idx) => {
      const cardX = 12 + idx * 63;
      const cardY = 48;
      const cardW = 60;
      const cardH = 15;

      doc.setFillColor(card.bg[0], card.bg[1], card.bg[2]);
      doc.setDrawColor(card.border[0], card.border[1], card.border[2]);
      doc.rect(cardX, cardY, cardW, cardH, "FD");

      doc.setFont("helvetica", "bold");
      doc.setFontSize(6);
      doc.setTextColor(100, 116, 139);
      doc.text(card.title, cardX + 4, cardY + 4);

      doc.setFont("helvetica", "bold");
      doc.setFontSize(9.5);
      doc.setTextColor(card.text[0], card.text[1], card.text[2]);
      doc.text(card.value, cardX + 4, cardY + 9);

      doc.setFont("helvetica", "bold");
      doc.setFontSize(7);
      doc.text(card.pct, cardX + cardW - 12, cardY + 9);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(5.5);
      doc.setTextColor(148, 163, 184);
      doc.text(card.desc, cardX + 4, cardY + 13);
    });

    // 4. Sector & Linel Treatment Row
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.rect(12, 66, 186, 10, "FD");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(6);
    doc.setTextColor(15, 23, 42);
    doc.text("DISTRIBUCIÓN OPERATIVA DE AFILIACIÓN Y LÍNEAS DE TRATAMIENTO:", 16, 70);

    const l1 = activosList.filter(p => !p.lineaTratamiento || p.lineaTratamiento.toLowerCase().includes("1")).length;
    const l2 = activosList.filter(p => p.lineaTratamiento && p.lineaTratamiento.toLowerCase().includes("2")).length;
    const l3 = activosList.filter(p => p.lineaTratamiento && p.lineaTratamiento.toLowerCase().includes("3")).length;
    const lOthers = activos - l1 - l2 - l3;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(6);
    doc.setTextColor(51, 65, 85);
    doc.text(`Sector Público: ${publicoCount} (${pubRate}%)  |  Privado: ${privadoCount} (${privRate}%)`, 16, 74);
    doc.text(`Líneas -> 1ª Línea: ${l1} (${activos > 0 ? Math.round((l1/activos)*100) : 0}%)  |  2ª Línea: ${l2} (${activos > 0 ? Math.round((l2/activos)*100) : 0}%)  |  Otras/Subsiguientes: ${lOthers}`, 110, 74);

    // Helpers to draw tables
    const drawTable = (x: number, y: number, w: number, title: string, items: { name: string, count: number }[], labelHeaders: [string, string]) => {
      // Header item
      doc.setFillColor(15, 23, 42);
      doc.rect(x, y, w, 4.5, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(6.5);
      doc.setTextColor(255, 255, 255);
      doc.text(title, x + 3, y + 3.2);

      // Subheaders table
      doc.setFillColor(241, 245, 249);
      doc.rect(x, y + 4.5, w, 4, "F");
      doc.setTextColor(100, 116, 139);
      doc.setFontSize(5.5);
      doc.text(labelHeaders[0], x + 3, y + 7.5);
      doc.text(labelHeaders[1], x + w - 16, y + 7.5);

      let rowY = y + 8.5;
      doc.setTextColor(30, 41, 59);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(6);

      for (let i = 0; i < 10; i++) {
        const item = items[i];
        if (i % 2 === 1) {
          doc.setFillColor(248, 250, 252);
          doc.rect(x, rowY, w, 3.5, "F");
        }
        
        doc.setDrawColor(241, 245, 249);
        doc.line(x, rowY + 3.5, x + w, rowY + 3.5);

        const nameLabel = item ? item.name : "—";
        const countLabel = item ? `${item.count} pac.` : "—";

        doc.text(nameLabel.slice(0, 32), x + 3, rowY + 2.5);
        doc.text(countLabel, x + w - 16, rowY + 2.5);
        rowY += 3.5;
      }
    };

    // 5. Draw Demographics Row 1 (Cities & Insurers)
    drawTable(12, 79, 91, "TOP 10 SEDES / CIUDADES", topCiudades, ["CIUDAD / SEDE", "PACIENTES"]);
    drawTable(107, 79, 91, "TOP 10 COBERTURA DE ASEGURADORAS", topAseguradoras, ["ASEGURADORA S.A.", "POBLACIÓN"]);

    // 6. Draw Demographics Row 2 (Doctors & Indications)
    drawTable(12, 126, 91, "TOP 10 MÉDICOS TRATANTES", topMedicos, ["ESPECIALISTA", "SOPORTE"]);
    drawTable(107, 126, 91, "TOP 10 INDICACIONES CLÍNICAS", topIndicaciones, ["DIAGNÓSTICO", "CASOS"]);

    // 7. Channels & Distribution details
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.rect(12, 173, 186, 11, "FD");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(6);
    doc.setTextColor(15, 23, 42);
    doc.text("DETALLE COOPERATIVO DE CANALES Y DISTRIBUIDORES:", 16, 177);

    const dispensacionesCounts = getTopItems("dispensacionId", "dispensaciones", 3);
    const dispLabel = dispensacionesCounts.map(d => `${d.name}: ${d.count}`).join("  |  ");
    const distLabel = topCanales.slice(0, 3).map(d => `${d.name}: ${d.count}`).join("  |  ");

    doc.setFont("helvetica", "normal");
    doc.setFontSize(6);
    doc.setTextColor(51, 65, 85);
    doc.text(`Canales de Dispensación Comunes:  ${dispLabel || "No registrados"}`, 16, 181);
    doc.text(`Distribuidores Clave de Abastecimiento:  ${distLabel || "No registrados" }`, 110, 181);

    // 8. Conclusions Narrative paragraphs
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(15, 23, 42);
    doc.text("CONCLUSIÓN DEL DIAGNÓSTICO DE LA POBLACIÓN:", 12, 189);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.5);
    doc.setTextColor(51, 65, 85);
    
    const conclusions = [
      `• La base de datos contiene un total consolidado de ${total} registros de pacientes evaluados según filtros activos de selección.`,
      `• Actualmente, la tasa de activos asciende al ${rateActivos}% de la población total consultada, consolidando el sector público como el mayor canal`,
      `  de cobertura con un ${pubRate}% de concentración de mercado activo versus el ${privRate}% cubierto mediante mecanismos de aseguradoras privadas.`,
      `• La ciudad de ${topCiudades[0] ? topCiudades[0].name : "de mayor concentración"} lidera el volumen nacional de pacientes de alta especialidad coordinados.`,
      `• Se sugiere estrechar la relación con los distribuidores clave (${topCanales[0] ? topCanales[0].name : "principales"}) con el fin de robustecer el flujo de entrega.`
    ];

    conclusions.forEach((line, lineIdx) => {
      doc.text(line, 12, 194 + lineIdx * 3.8);
    });

    // 9. Verification & signatures footer block
    doc.setDrawColor(226, 232, 240);
    doc.line(12, 217, 198, 217);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(6);
    doc.setTextColor(100, 116, 139);
    doc.text("Generado por: Auditoría Médica AstraZeneca", 12, 221);
    doc.text("Sistema de Gestión de Pacientes A4 v2.1 — Confidencial", 132, 221);

    // Save final document
    const now = new Date();
    const day = String(now.getDate()).padStart(2, '0');
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const year = now.getFullYear();
    doc.save(`Reporte Registro de Pacientes ${day}-${month}-${year}.pdf`);
  };

  // Helper for hex colors in jspdf
  const F_HEX = (hexStr: string) => hexStr;

  return (
    <div className="space-y-6 animate-fade-in" id="patients-data-explorer-panel">
      
      {/* Encryption toolbar block */}
      <div className="bg-slate-900 text-white p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 border border-slate-800">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-emerald-500/10 rounded-xl text-emerald-400">
            <Lock className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm font-semibold flex items-center gap-2">
              Seguridad de Registros Clínicos Cifrados
              <span className="bg-emerald-500/20 text-emerald-300 text-[10px] px-2 py-0.5 rounded font-mono font-medium">Zero-Trust</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Clave de desencriptado activa: <span className="font-mono text-emerald-300 font-bold">{encryptionKey}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {showKeyInput ? (
            <form onSubmit={handleApplyKey} className="flex gap-1.5 w-full sm:w-auto">
              <input
                type="text"
                value={inputKey}
                onChange={(e) => setInputKey(e.target.value)}
                placeholder="Ingresar nueva contraseña..."
                className="bg-slate-800 border border-slate-700 text-slate-100 rounded-lg px-2.5 py-1.5 text-xs focus:ring-1 focus:ring-emerald-400 focus:outline-none"
              />
              <button
                type="submit"
                className="bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer"
              >
                Aplicar
              </button>
              <button
                type="button"
                onClick={() => setShowKeyInput(false)}
                className="text-slate-400 hover:text-slate-200 px-2 py-1 text-xs cursor-pointer"
              >
                X
              </button>
            </form>
          ) : (
            <button
              onClick={() => {
                setInputKey(encryptionKey);
                setShowKeyInput(true);
              }}
              className="bg-slate-800 hover:bg-slate-700 hover:text-slate-50 border border-slate-700 text-slate-300 text-xs py-1.5 px-3.5 rounded-xl inline-flex items-center gap-1.5 font-medium cursor-pointer transition-colors"
            >
              <Unlock className="h-3.5 w-3.5" />
              Modificar Clave de Encriptado
            </button>
          )}
        </div>
      </div>

      {/* Dynamic Filters panel */}
      <div className="bg-white p-4 rounded-2xl border border-slate-150 shadow-xs space-y-3" id="filters-container">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-100 pb-2">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-emerald-600" />
            <h3 className="font-semibold text-slate-800 text-sm">Filtros y Búsqueda Avanzada</h3>
          </div>
          
          <div className="flex items-center gap-2 self-stretch sm:self-auto justify-end">
            <button
              onClick={handleGeneratePDF}
              className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl inline-flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Descargar reporte según filtros actuales"
            >
              <Download className="h-4 w-4 text-slate-600" />
              Descargar Reporte PDF
            </button>
          </div>
        </div>

        {/* Reusable compact filters shared with the dashboard */}
        <CompactFilters filters={filters} onChange={onFilterChange} lookups={lookups} />

        {/* Filters Summary */}
        <div className="flex items-center justify-between text-[11px] text-slate-400 bg-slate-50 p-2 rounded-lg border border-slate-100">
          <div className="flex items-center gap-1.5">
            <Info className="h-3.5 w-3.5 text-slate-400" />
            <span>Filtrado clínico activo</span>
          </div>
          <span>Mostrando <strong>{filteredPacientes.length}</strong> de <strong>{pacientes.length}</strong> registros totales</span>
        </div>
      </div>

      {/* Main Grid View of Patients - Mobile-first responsive card layout */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-xs overflow-hidden md:max-h-[calc(100vh-25rem)] md:min-h-[480px] overflow-y-auto custom-scrollbar" id="patients-data-grid-box">
        
        {pacientes.length === 0 ? (
          <div className="p-16 text-center flex flex-col items-center justify-center space-y-4 animate-fade-in" id="empty-database-guideline">
            <div className="bg-slate-50 border border-slate-150 border-dashed rounded-full h-14 w-14 flex items-center justify-center text-slate-400">
              <Database className="h-7 w-7 text-slate-450" />
            </div>
            <div className="space-y-1.5 max-w-md">
              <h3 className="font-bold text-slate-800 text-sm">Base de Datos de Pacientes Vacía</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Has vaciado todos los registros clínicos de pacientes con éxito. Puedes registrar un nuevo paciente manualmente o importar una base de datos de Google Sheets o Excel en unos segundos.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 pt-2 justify-center">
              {onNavigateToTab && (
                <button
                  type="button"
                  onClick={() => onNavigateToTab("importor")}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer border-0"
                >
                  <FileSpreadsheet className="h-4 w-4" />
                  Importar de Excel o Google Sheets
                </button>
              )}
              {onNavigateToTab && (
                <button
                  type="button"
                  onClick={() => onNavigateToTab("ingreso")}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-850 text-white text-xs font-semibold rounded-xl transition-colors cursor-pointer border-0"
                >
                  Registrar Individualmente
                </button>
              )}
            </div>
          </div>
        ) : (
          <>
            {/* Desktop View Table: hidden on mobile */}
            <div className="hidden lg:block overflow-x-auto w-full">
          {filteredPacientes.length === 0 ? (
            <div className="p-16 text-center text-slate-400">
              Ningún registro clínico coincide con los criterios de búsqueda elegidos.
            </div>
          ) : (
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50/95 border-b border-slate-100 text-[10px] font-semibold text-slate-400 uppercase tracking-tight sticky top-0 z-10 backdrop-blur-xs">
                <tr>
                  <th className="py-3.5 px-4 bg-slate-50/95">PJS</th>
                  <th className="py-3.5 px-4 bg-slate-50/95">Ciudad / Sede</th>
                  <th className="py-3.5 px-4 bg-slate-50/95">Médico</th>
                  <th className="py-3.5 px-4 bg-slate-50/95">Aseguradora</th>
                  <th className="py-3.5 px-4 bg-slate-50/95 font-bold text-slate-500">Sector</th>
                  <th className="py-3.5 px-4 bg-slate-50/95">Institución</th>
                  <th className="py-3.5 px-4 bg-slate-50/95">Dispensación</th>
                  <th className="py-3.5 px-4 bg-slate-50/95">Distribuidor</th>
                  <th className="py-3.5 px-4 bg-slate-50/95">Indicación</th>
                  <th className="py-3.5 px-4 bg-slate-50/95">Dosis</th>
                  <th className="py-3.5 px-4 bg-slate-50/95">Línea Tto.</th>
                  <th className="py-3.5 px-4 bg-slate-50/95">Ingreso / Baja</th>
                  <th className="py-3.5 px-4 bg-slate-50/95 text-center">Meses</th>
                  <th className="py-3.5 px-4 bg-slate-50/95 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredPacientes.map((p) => {
                  const isExpanded = expandedPacienteId === p.id;
                  return (
                    <React.Fragment key={p.id}>
                      <tr className="hover:bg-slate-50/50 transition-colors">
                        <td className="py-3 px-4 font-semibold text-slate-900">
                          {p.pjsLabel || <span className="text-slate-350">—</span>}
                        </td>
                        <td className="py-3 px-4 text-slate-600">
                          {p.ciudadLabel || <span className="text-slate-300">No asoc.</span>}
                        </td>
                        <td className="py-3 px-4 text-slate-600">
                          {p.medicoLabel || <span className="text-slate-300">No asoc.</span>}
                        </td>
                        <td className="py-3 px-4 text-slate-600">
                          {p.aseguradoraLabel || <span className="text-slate-300">No asoc.</span>}
                        </td>
                        <td className="py-3 px-4">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-medium leading-tight ${
                            p.sector === "Público" 
                              ? "bg-emerald-50 text-emerald-700 font-semibold" 
                              : "bg-sky-50 text-sky-700 font-semibold"
                          }`}>
                            {p.sector}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-600">
                          {p.institucionLabel || <span className="text-slate-300">—</span>}
                        </td>
                        <td className="py-3 px-4 text-slate-600">
                          {p.dispensacionLabel || <span className="text-slate-300">—</span>}
                        </td>
                        <td className="py-3 px-4 text-slate-600">
                          {p.distribuidorLabel || <span className="text-slate-300">—</span>}
                        </td>
                        <td className="py-3 px-4 text-slate-600">
                          {p.indicacionLabel || <span className="text-slate-300">—</span>}
                        </td>
                        <td className="py-3 px-4 text-slate-600 font-mono text-[10px]">
                          {p.dosisLabel || <span className="text-slate-305">—</span>}
                        </td>
                        <td className="py-3 px-4 text-slate-600 font-medium whitespace-nowrap">
                          {p.lineaTratamiento || "1era Línea"}
                        </td>
                        <td className="py-3 px-4 text-slate-600 font-mono text-[11px]">
                          <div className="flex flex-col gap-1 items-start">
                            <span className="bg-slate-50 border border-slate-150/60 rounded px-1.5 py-0.5 text-[10px] text-slate-700 inline-block font-semibold">
                              {p.fechaIngreso ? formatDateToDMY(p.fechaIngreso) : "—"}
                            </span>
                            {p.fechaBaja && (
                              <span className="bg-rose-50 border border-rose-200/80 text-rose-700 rounded px-1.5 py-0.5 text-[9px] inline-block font-extrabold whitespace-nowrap">
                                Baja: {formatDateToDMY(p.fechaBaja)}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-slate-600 text-center">
                          <span className="bg-indigo-50 border border-indigo-200/60 rounded px-2.5 py-0.5 text-[11px] text-indigo-700 inline-block font-sans font-bold tracking-normal leading-tight">
                            {calculateMonthsElapsed(p.fechaIngreso, p.createdAt)}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => setExpandedPacienteId(isExpanded ? null : p.id)}
                              className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded transition-colors cursor-pointer"
                              title="Ver ficha exhaustiva completa"
                            >
                              <Eye className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleOpenEdit(p)}
                              className="p-1 text-slate-400 hover:text-emerald-700 hover:bg-slate-100 rounded transition-colors cursor-pointer"
                              title="Editar registro clínico"
                            >
                              <Edit3 className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => {
                                if(confirm(`¿Está seguro de enviar a la papelera el registro [${p.id}]?`)) {
                                  onDeletePaciente(p.id);
                                }
                              }}
                              className="p-1 text-slate-400 hover:text-rose-600 hover:bg-slate-100 rounded transition-colors cursor-pointer"
                               title="Eliminar registro"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr className="bg-slate-50/50">
                          <td colSpan={13} className="py-4 px-6">
                            <div className="bg-white p-5 rounded-xl border border-slate-200 grid grid-cols-1 md:grid-cols-3 gap-6 text-xs text-slate-600 leading-normal">
                              
                              {/* Clinical Left block */}
                              <div className="space-y-2.5">
                                <h4 className="font-bold text-slate-800 uppercase tracking-tight text-[11px]">Filiación Científica</h4>
                                <p><strong>Código Registro:</strong> {p.id}</p>
                                <p><strong>Sede de Acción:</strong> {p.ciudadLabel || "No asignado"}</p>
                                <p><strong>Jurídico (PJS):</strong> {p.pjsLabel || "Particular / Sin asociar"}</p>
                                <p><strong>Fecha Ingreso:</strong> {p.fechaIngreso ? formatDateToDMY(p.fechaIngreso) : "No asignada"}</p>
                                {p.fechaBaja && (
                                  <p><strong>Fecha de Baja:</strong> <span className="text-rose-600 font-extrabold bg-rose-50 px-1.5 py-0.5 rounded border border-rose-100 font-mono text-[10px]">{formatDateToDMY(p.fechaBaja)}</span></p>
                                )}
                              </div>

                              {/* Clinical Center block */}
                              <div className="space-y-2.5">
                                <h4 className="font-bold text-slate-800 uppercase tracking-tight text-[11px]">Tratamiento Farmacológico</h4>
                                <p><strong>Médico Tratante:</strong> {p.medicoLabel || "No asignado"}</p>
                                <p><strong>Aseguradora:</strong> {p.aseguradoraLabel || "Sin seguro"}</p>
                                <p><strong>Sector:</strong> {p.sector}</p>
                                <p><strong>Institución:</strong> {p.institucionLabel || "No especificada"}</p>
                                <p><strong>Línea de Tratamiento:</strong> {p.lineaTratamiento || "1era Línea"}</p>
                              </div>

                              {/* Clinical Right block */}
                              <div className="space-y-2.5">
                                <h4 className="font-bold text-slate-800 uppercase tracking-tight text-[11px]">Abastecimiento & Logística</h4>
                                <p><strong>Dispensación:</strong> {p.dispensacionLabel || "—"}</p>
                                <p><strong>Distribuidor:</strong> {p.distribuidorLabel || "—"}</p>
                                <p><strong>Indicación clínica:</strong> {p.indicacionLabel || "—"}</p>
                                <p><strong>Dosis:</strong> {p.dosisLabel || "—"}</p>
                              </div>

                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Mobile View: Cards instead of tables */}
        <div className="block lg:hidden divide-y divide-slate-100">
          {filteredPacientes.length === 0 ? (
            <div className="p-12 text-center text-slate-400 text-xs">
              Ningún registro clínico coincide con la búsqueda.
            </div>
          ) : (
            filteredPacientes.map((p) => {
              const isExpanded = expandedPacienteId === p.id;
              return (
                <div key={p.id} className="p-4 space-y-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-semibold text-slate-900 text-sm">{p.pjsLabel || "Sin Jurídico / Particular"}</h4>
                    </div>
                    
                    <span className={`px-2 py-0.5 text-[10px] font-medium rounded ${
                      p.sector === "Público" ? "bg-emerald-50 text-emerald-700" : "bg-sky-50 text-sky-700"
                    }`}>
                      {p.sector}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs text-slate-600">
                    <div>
                      <span className="block text-[10px] font-medium text-slate-400">Ciudad</span>
                      {p.ciudadLabel || "No asignado"}
                    </div>
                    <div>
                      <span className="block text-[10px] font-medium text-slate-400">Fecha de Ingreso</span>
                      <span className="font-mono">{p.fechaIngreso ? formatDateToDMY(p.fechaIngreso) : "No asignada"}</span>
                      {p.fechaBaja && (
                        <div className="mt-0.5">
                          <span className="inline-block bg-rose-50 text-rose-700 text-[9px] font-extrabold px-1 rounded border border-rose-100">
                            Baja: {formatDateToDMY(p.fechaBaja)}
                          </span>
                        </div>
                      )}
                    </div>
                    <div>
                      <span className="block text-[10px] font-medium text-slate-400">Meses Transcurridos</span>
                      <span className="font-mono bg-indigo-50 text-indigo-700 font-bold px-1 py-0.5 rounded text-[10px]">{calculateMonthsElapsed(p.fechaIngreso, p.createdAt)} meses</span>
                    </div>
                    <div>
                      <span className="block text-[10px] font-medium text-slate-400">Aseguradora</span>
                      {p.aseguradoraLabel || "Particular"}
                    </div>
                    <div>
                      <span className="block text-[10px] font-medium text-slate-400">Indicación</span>
                      {p.indicacionLabel || "—"}
                    </div>
                  </div>

                  <div className="flex items-center justify-between border-t border-slate-50 pt-2.5">
                    <button 
                      onClick={() => setExpandedPacienteId(isExpanded ? null : p.id)}
                      className="text-xs text-emerald-600 font-semibold flex items-center gap-0.5 cursor-pointer"
                    >
                      {isExpanded ? "Ocultar Detalles" : "Ver Ficha Completa"}
                      <ChevronRight className={`h-3 w-3 transition-transform ${isExpanded ? "rotate-90" : ""}`} />
                    </button>
                    
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleOpenEdit(p)}
                        className="p-1 px-2.5 bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200 rounded text-[11px] font-medium cursor-pointer"
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => {
                          if(confirm(`¿Desea dar de baja permanentemente el registro [${p.id}]?`)) {
                            onDeletePaciente(p.id);
                          }
                        }}
                        className="p-1 text-rose-600 hover:bg-rose-50 rounded cursor-pointer"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-2.5 text-xs text-slate-600 animate-fade-in mt-1">
                      <p><strong>Médico:</strong> {p.medicoLabel || "No asignado"}</p>
                      <p><strong>Miembro PJS:</strong> {p.pjsLabel || "Particular"}</p>
                      <p><strong>Establecimiento:</strong> {p.institucionLabel || "No registrado"}</p>
                      <p><strong>Línea de Tratamiento:</strong> {p.lineaTratamiento || "1era Línea"}</p>
                      <p><strong>Dosis:</strong> {p.dosisLabel || "—"}</p>
                      <p><strong>Distribuidor:</strong> {p.distribuidorLabel || "—"}</p>
                      <p><strong>Dispensación:</strong> {p.dispensacionLabel || "—"}</p>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

      </>
    )}

      </div>

      {/* Edit Paciente Modal dialog */}
      {editingPaciente && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto animate-fade-in" id="edit-patient-overlay">
          <div className="bg-white rounded-2xl max-w-3xl w-full border border-slate-200 shadow-xl overflow-hidden animate-fade-in">
            <div className="bg-slate-50 px-5 border-b border-slate-150 py-4 flex items-center justify-between">
              <h3 className="font-bold text-slate-800 text-sm">
                Editar Expediente Médico: {editingPaciente.id}
              </h3>
              <button
                onClick={() => setEditingPaciente(null)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-full hover:bg-slate-200/50 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="p-6 space-y-5" id="patient-editing-form">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">

                {/* PJS */}
                <div>
                  <label className="block text-[11px] font-medium text-slate-500 mb-1">Miembro PJS</label>
                  <SearchableSelect
                    id="edit-pjs"
                    value={tempPjsId}
                    onChange={setTempPjsId}
                    options={sortLookupList(lookups.pjs || [])}
                    placeholder="-- Sin asociar --"
                  />
                </div>

                {/* Ciudad */}
                <div>
                  <label className="block text-[11px] font-medium text-slate-500 mb-1">Ciudad del Perú</label>
                  <SearchableSelect
                    id="edit-ciudad"
                    value={tempCiudadId}
                    onChange={setTempCiudadId}
                    options={sortLookupList(lookups.ciudades || [])}
                    placeholder="-- Sin asociar --"
                  />
                </div>

                {/* Medico */}
                <div>
                  <label className="block text-[11px] font-medium text-slate-500 mb-1">Médico Tratante</label>
                  <SearchableSelect
                    id="edit-medico"
                    value={tempMedicoId}
                    onChange={setTempMedicoId}
                    options={sortLookupList(lookups.medicos || [])}
                    placeholder="-- Sin asociar --"
                  />
                </div>

                {/* Aseguradora */}
                <div>
                  <label className="block text-[11px] font-medium text-slate-500 mb-1">Aseguradora</label>
                  <SearchableSelect
                    id="edit-aseguradora"
                    value={tempAseguradoraId}
                    onChange={setTempAseguradoraId}
                    options={sortLookupList(lookups.aseguradoras || [])}
                    placeholder="-- Sin asegurar --"
                  />
                </div>

                {/* Sector */}
                <div>
                  <label className="block text-[11px] font-medium text-slate-500 mb-1">Sector Salud</label>
                  <select
                    value={tempSector}
                    onChange={(e) => setTempSector(e.target.value as any)}
                    className="w-full text-slate-800 bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs focus:ring-1 focus:ring-emerald-500"
                  >
                    <option value="Público">Público</option>
                    <option value="Privado">Privado</option>
                  </select>
                </div>

                {/* Institucion */}
                <div>
                  <label className="block text-[11px] font-medium text-slate-500 mb-1">Institución</label>
                  <SearchableSelect
                    id="edit-institucion"
                    value={tempInstitucionId}
                    onChange={setTempInstitucionId}
                    options={sortLookupList(lookups.instituciones || [])}
                    placeholder="-- Sin asociar --"
                  />
                </div>

                {/* Dispensacion */}
                <div>
                  <label className="block text-[11px] font-medium text-slate-500 mb-1">Dispensación</label>
                  <SearchableSelect
                    id="edit-dispensacion"
                    value={tempDispensacionId}
                    onChange={setTempDispensacionId}
                    options={sortLookupList(lookups.dispensaciones || [])}
                    placeholder="-- Sin asociar --"
                  />
                </div>

                {/* Distribuidor */}
                <div>
                  <label className="block text-[11px] font-medium text-slate-500 mb-1">Distribuidor</label>
                  <SearchableSelect
                    id="edit-distribuidor"
                    value={tempDistribuidorId}
                    onChange={setTempDistribuidorId}
                    options={sortLookupList(lookups.distribuidores || [])}
                    placeholder="-- Sin asociar --"
                  />
                </div>

                {/* Indicacion */}
                <div>
                  <label className="block text-[11px] font-medium text-slate-500 mb-1">Indicación</label>
                  <SearchableSelect
                    id="edit-indicacion"
                    value={tempIndicacionId}
                    onChange={setTempIndicacionId}
                    options={sortLookupList(lookups.indicaciones || [])}
                    placeholder="-- Sin asociar --"
                  />
                </div>

                {/* Dosis */}
                <div>
                  <label className="block text-[11px] font-medium text-slate-500 mb-1">Dosis</label>
                  <SearchableSelect
                    id="edit-dosis"
                    value={tempDosisId}
                    onChange={setTempDosisId}
                    options={sortLookupList(lookups.dosis || [])}
                    placeholder="-- Sin asociar --"
                  />
                </div>

                {/* Línea de Tratamiento */}
                <div>
                  <label className="block text-[11px] font-medium text-slate-500 mb-1">Línea de Tratamiento *</label>
                  <select
                    id="edit-linea-tratamiento"
                    required
                    value={tempLineaTratamiento}
                    onChange={(e) => setTempLineaTratamiento(e.target.value)}
                    className="w-full text-slate-800 bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs focus:ring-1 focus:ring-emerald-500 cursor-pointer font-medium"
                  >
                    <option value="1era Línea">1era Línea (1L)</option>
                    <option value="2da Línea">2da Línea (2L)</option>
                    <option value="3era Línea">3era Línea (3L)</option>
                    <option value="Mantenimiento">Mantenimiento</option>
                    <option value="Adyuvancia / Neoadyuvancia">Adyuvancia / Neoadyuvancia</option>
                  </select>
                </div>

                {/* Fecha de Ingreso */}
                <div>
                  <label className="block text-[11px] font-medium text-slate-500 mb-1">Fecha de Ingreso *</label>
                  <input
                    type="date"
                    required
                    value={tempFechaIngreso}
                    onChange={(e) => setTempFechaIngreso(e.target.value)}
                    className="w-full text-slate-800 bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs focus:ring-1 focus:ring-emerald-500 cursor-pointer"
                  />
                </div>

                {/* Fecha de Baja */}
                <div>
                  <label className="block text-[11px] font-medium text-slate-500 mb-1">Fecha de Baja (Opcional)</label>
                  <input
                    type="date"
                    value={tempFechaBaja}
                    onChange={(e) => setTempFechaBaja(e.target.value)}
                    className="w-full text-slate-800 bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs focus:ring-1 focus:ring-emerald-500 cursor-pointer"
                  />
                </div>

              </div>

              {/* Actions footer */}
              <div className="flex justify-end gap-2 border-t border-slate-100 pt-4 mt-3">
                <button
                  type="button"
                  onClick={() => setEditingPaciente(null)}
                  className="px-4 py-2 border border-slate-250 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isUpdating}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg disabled:bg-slate-300 flex items-center gap-1 cursor-pointer"
                >
                  {isUpdating ? "Sincronizando..." : "Guardar Cambios"}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );
}
