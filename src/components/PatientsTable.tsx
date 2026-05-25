import React, { useState, useMemo } from "react";
import { Paciente, LookupItem, LookupType } from "../types";
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
    
    // Check if it's in DD/MM/AAAA format first
    const dmyMatch = dateStr.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
    if (dmyMatch) {
      day = parseInt(dmyMatch[1], 10);
      month = parseInt(dmyMatch[2], 10) - 1;
      year = parseInt(dmyMatch[3], 10);
    } else {
      // Expect YYYY-MM-DD
      const ymdMatch = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (ymdMatch) {
        year = parseInt(ymdMatch[1], 10);
        month = parseInt(ymdMatch[2], 10) - 1;
        day = parseInt(ymdMatch[3], 10);
      } else {
        // Fallback standard parsing
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return "0";
        year = d.getFullYear();
        month = d.getMonth();
        day = d.getDate();
      }
    }
    
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
  onUpdatePaciente,
  onDeletePaciente,
  onClearAllPacientes,
  encryptionKey,
  onSetEncryptionKey,
  onNavigateToTab
}: PatientsTableProps) {
  // Filters & Searching state
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedSector, setSelectedSector] = useState<"Todos" | "Público" | "Privado">("Todos");
  const [selectedPjs, setSelectedPjs] = useState("Todos");
  const [selectedCiudad, setSelectedCiudad] = useState("Todos");
  const [selectedMedico, setSelectedMedico] = useState("Todos");
  const [selectedAseguradora, setSelectedAseguradora] = useState("Todos");
  const [selectedInstitucion, setSelectedInstitucion] = useState("Todos");
  const [selectedDispensacion, setSelectedDispensacion] = useState("Todos");
  const [selectedDistribuidor, setSelectedDistribuidor] = useState("Todos");
  const [selectedIndicacion, setSelectedIndicacion] = useState("Todos");
  const [selectedDosis, setSelectedDosis] = useState("Todos");

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
    return pacientes.filter((p) => {
      // 1. Search term match
      const query = searchTerm.toLowerCase().trim();
      const matchSearch = 
        p.id.toLowerCase().includes(query) ||
        p.nombre.toLowerCase().includes(query) ||
        p.apellido.toLowerCase().includes(query) ||
        (p.ciudadLabel && p.ciudadLabel.toLowerCase().includes(query)) ||
        (p.medicoLabel && p.medicoLabel.toLowerCase().includes(query));

      // 2. Sector match
      const matchSector = selectedSector === "Todos" || p.sector === selectedSector;

      // 3. Pjs match
      const matchPjs = selectedPjs === "Todos" || p.pjsId === selectedPjs;

      // 4. Ciudad match
      const matchCiudad = selectedCiudad === "Todos" || p.ciudadId === selectedCiudad;

      // 5. Medico match
      const matchMedico = selectedMedico === "Todos" || p.medicoId === selectedMedico;

      // 6. Insurance match
      const matchAseguradora = selectedAseguradora === "Todos" || p.aseguradoraId === selectedAseguradora;

      // 7. Institucion match
      const matchInstitucion = selectedInstitucion === "Todos" || p.institucionId === selectedInstitucion;

      // 8. Dispensacion match
      const matchDispensacion = selectedDispensacion === "Todos" || p.dispensacionId === selectedDispensacion;

      // 9. Distribuidor match
      const matchDistribuidor = selectedDistribuidor === "Todos" || p.distribuidorId === selectedDistribuidor;

      // 10. Indicacion match
      const matchIndicacion = selectedIndicacion === "Todos" || p.indicacionId === selectedIndicacion;

      // 11. Dosis match
      const matchDosis = selectedDosis === "Todos" || p.dosisId === selectedDosis;

      return (
        matchSearch &&
        matchSector &&
        matchPjs &&
        matchCiudad &&
        matchMedico &&
        matchAseguradora &&
        matchInstitucion &&
        matchDispensacion &&
        matchDistribuidor &&
        matchIndicacion &&
        matchDosis
      );
    }).sort((a, b) => {
      const timeA = parseDateToTime(a.fechaIngreso, a.createdAt);
      const timeB = parseDateToTime(b.fechaIngreso, b.createdAt);
      return timeB - timeA;
    });
  }, [
    pacientes,
    searchTerm,
    selectedSector,
    selectedPjs,
    selectedCiudad,
    selectedMedico,
    selectedAseguradora,
    selectedInstitucion,
    selectedDispensacion,
    selectedDistribuidor,
    selectedIndicacion,
    selectedDosis
  ]);

  // Check if any filter is active
  const isAnyFilterActive = useMemo(() => {
    return (
      searchTerm.trim() !== "" ||
      selectedSector !== "Todos" ||
      selectedPjs !== "Todos" ||
      selectedCiudad !== "Todos" ||
      selectedMedico !== "Todos" ||
      selectedAseguradora !== "Todos" ||
      selectedInstitucion !== "Todos" ||
      selectedDispensacion !== "Todos" ||
      selectedDistribuidor !== "Todos" ||
      selectedIndicacion !== "Todos" ||
      selectedDosis !== "Todos"
    );
  }, [
    searchTerm,
    selectedSector,
    selectedPjs,
    selectedCiudad,
    selectedMedico,
    selectedAseguradora,
    selectedInstitucion,
    selectedDispensacion,
    selectedDistribuidor,
    selectedIndicacion,
    selectedDosis
  ]);

  // Clean all filters
  const handleClearFilters = () => {
    setSearchTerm("");
    setSelectedSector("Todos");
    setSelectedPjs("Todos");
    setSelectedCiudad("Todos");
    setSelectedMedico("Todos");
    setSelectedAseguradora("Todos");
    setSelectedInstitucion("Todos");
    setSelectedDispensacion("Todos");
    setSelectedDistribuidor("Todos");
    setSelectedIndicacion("Todos");
    setSelectedDosis("Todos");
  };

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
   * PDF A4 Report Generation
   */
  const handleGeneratePDF = () => {
    const doc = new jsPDF({
      orientation: "landscape",
      unit: "mm",
      format: "a4" // 297 x 210 mm
    });

    // Color definitions
    const PRIMARY_COLOR = "#0f172a"; // Deep Slate
    const ACCENT_COLOR = "#eeb709";  // AstraZeneca Yellow
    const TEXT_BLACK = "#1e293b";    // Gray 800
    const TEXT_LIGHT = "#64748b";    // Gray 500

    // Coordinates configuration for columns with MESES included
    const COLUMNS = [
      { label: "PJS", x: 12.5, width: 28 },
      { label: "CIUDAD / SEDE", x: 40.5, width: 23 },
      { label: "MÉDICO", x: 63.5, width: 24 },
      { label: "ASEGURADORA", x: 87.5, width: 23 },
      { label: "SECTOR", x: 110.5, width: 14 },
      { label: "INSTITUCIÓN", x: 124.5, width: 23 },
      { label: "DISPENSACIÓN", x: 147.5, width: 23 },
      { label: "DISTRIBUIDOR", x: 170.5, width: 23 },
      { label: "INDICACIÓN", x: 193.5, width: 23 },
      { label: "DOSIS", x: 216.5, width: 18 },
      { label: "FECHA INGRESO", x: 234.5, width: 24 },
      { label: "MESES", x: 258.5, width: 26 }
    ];

    // Header section
    doc.setFillColor(F_HEX(PRIMARY_COLOR));
    doc.rect(0, 0, 297, 28, "F");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor("#ffffff");
    doc.text("REGISTRO DE PACIENTES - ASTRAZENECA", 14, 12);
    
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text("Reporte Consolidado de Actividad", 14, 19);
    doc.text(`Fecha de emisión: ${new Date().toLocaleDateString()}`, 242, 12);
    doc.text("Uso Oficial Confidencial", 242, 19);

    // Decorative band
    doc.setFillColor(F_HEX(ACCENT_COLOR));
    doc.rect(0, 28, 297, 2, "F");

    // Filter diagnostics summary
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(PRIMARY_COLOR);
    doc.text("CRITERIOS DE FILTRO ACTIVO", 12.5, 40);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(TEXT_LIGHT);
    doc.text(`Sec: ${selectedSector} | PJS: ${selectedPjs === "Todos" ? "Todos" : getSelectedLabel("pjs", selectedPjs).slice(0, 25)} | Ciud: ${selectedCiudad === "Todos" ? "Todas" : getSelectedLabel("ciudades", selectedCiudad).slice(0, 25)}`, 12.5, 46);
    doc.text(`Méd: ${selectedMedico === "Todos" ? "Todos" : getSelectedLabel("medicos", selectedMedico).slice(0, 25)} | Aseg: ${selectedAseguradora === "Todos" ? "Todas" : getSelectedLabel("aseguradoras", selectedAseguradora).slice(0, 25)}`, 12.5, 51);
    doc.text(`Registros calificados: ${filteredPacientes.length} pacientes (de ${pacientes.length} total)`, 212, 51);

    // Divider
    doc.setDrawColor("#e2e8f0");
    doc.line(12.5, 56, 284.5, 56);

    // Patients Grid Table Header
    doc.setFillColor("#f1f5f9");
    doc.rect(12.5, 62, 272, 7, "F");
    
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(PRIMARY_COLOR);
    COLUMNS.forEach(col => {
      doc.text(col.label, col.x + 1.5, 66.5);
    });

    let currentY = 74;

    // Print records loop
    filteredPacientes.forEach((p, idx) => {
      // Check page break boundary (Landscape max height is 210mm, so 185mm leaves adequate margin)
      if (currentY > 185) {
        doc.addPage();
        // Repaint mini header on page overflow
        doc.setFillColor(F_HEX(PRIMARY_COLOR));
        doc.rect(0, 0, 297, 15, "F");
        doc.setFont("helvetica", "bold");
        doc.setFontSize(10);
        doc.setTextColor("#ffffff");
        doc.text("REGISTRO DE PACIENTES - REPORTE DE ACTIVIDAD (CONTINUACIÓN)", 12.5, 10);

        // Repaint table column headers on subsequent pages
        doc.setFillColor("#f1f5f9");
        doc.rect(12.5, 22, 272, 7, "F");
        doc.setFont("helvetica", "bold");
        doc.setFontSize(7.5);
        doc.setTextColor(PRIMARY_COLOR);
        COLUMNS.forEach(col => {
          doc.text(col.label, col.x + 1.5, 26.5);
        });

        currentY = 34;
      }

      // Draw light back zebra
      if (idx % 2 === 1) {
        doc.setFillColor("#f8fafc");
        doc.rect(12.5, currentY - 5, 272, 7, "F");
      }

      // Collect cells matching precise headers list with MESES included
      const rowValues = [
        (p.pjsLabel || "Particular").slice(0, 18),
        (p.ciudadLabel || "—").slice(0, 15),
        (p.medicoLabel || "—").slice(0, 18),
        (p.aseguradoraLabel || "—").slice(0, 15),
        p.sector || "—",
        (p.institucionLabel || "—").slice(0, 15),
        (p.dispensacionLabel || "—").slice(0, 15),
        (p.distribuidorLabel || "—").slice(0, 15),
        (p.indicacionLabel || "—").slice(0, 18),
        (p.dosisLabel || "—").slice(0, 14),
        (p.fechaIngreso ? formatDateToDMY(p.fechaIngreso) : "—"),
        calculateMonthsElapsed(p.fechaIngreso, p.createdAt)
      ];

      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.setTextColor(TEXT_BLACK);

      rowValues.forEach((val, colIdx) => {
        const col = COLUMNS[colIdx];
        doc.text(val, col.x + 1.5, currentY);
      });

      currentY += 7.5;
    });

    // Save final report
    doc.save(`Reporte_Pacientes_A4_${new Date().toISOString().split("T")[0]}.pdf`);
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
      <div className="bg-white p-5 rounded-2xl border border-slate-150 shadow-xs space-y-4" id="filters-container">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-emerald-600" />
            <h3 className="font-semibold text-slate-800 text-sm">Filtros y Búsqueda Avanzada (Catálogos)</h3>
          </div>
          
          <div className="flex items-center gap-2 self-stretch sm:self-auto justify-end">
            {isAnyFilterActive && (
              <button
                onClick={handleClearFilters}
                className="px-4 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 hover:text-rose-800 text-xs font-semibold rounded-xl inline-flex items-center gap-1.5 transition-all duration-200 cursor-pointer border border-rose-100/50 animate-fade-in"
                title="Limpiar todos los filtros"
              >
                <X className="h-4 w-4" />
                Limpiar Filtros
              </button>
            )}
            
            <button
              onClick={handleGeneratePDF}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl inline-flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Descargar reporte según filtros actuales"
            >
              <Download className="h-4.5 w-4.5 text-slate-600" />
              Descargar Reporte PDF (A4)
            </button>

            {pacientes.length > 0 && (
              <div className="flex items-center gap-1.5 transition-all" id="database-clear-button-container">
                {confirmClear ? (
                  <div className="flex items-center gap-1 bg-red-50/80 border border-red-200 rounded-xl p-1 animate-fade-in">
                    <span className="text-[10px] text-red-700 font-bold px-2 hidden lg:inline">¿Eliminar {pacientes.length} registros? Irreversible.</span>
                    <button
                      type="button"
                      onClick={handleClearAllClick}
                      disabled={clearingInProgress}
                      className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-lg cursor-pointer transition-colors disabled:bg-slate-350"
                    >
                      {clearingInProgress ? "Eliminando..." : "Sí, borrar todo"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmClear(false)}
                      disabled={clearingInProgress}
                      className="px-2 py-1 text-slate-500 hover:text-slate-700 hover:bg-slate-100 text-xs font-semibold rounded-lg cursor-pointer"
                    >
                      Cancelar
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmClear(true)}
                    className="px-4 py-2 bg-red-50 hover:bg-red-105 text-red-600 border border-red-150/40 text-xs font-semibold rounded-xl inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                    title="Borrar todos los pacientes registrados de la base de datos"
                  >
                    <Trash2 className="h-4 w-4 text-red-500" />
                    Vaciar Pacientes
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3" id="filters-grid">
          {/* Search bar */}
          <div className="relative col-span-1 sm:col-span-2 md:col-span-2">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por ID, Ciudad, Médico..."
              className="w-full text-slate-800 bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-3 py-1.5 text-xs focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500 h-8"
            />
          </div>

          {/* Sector filtro */}
          <div>
            <select
              value={selectedSector}
              onChange={(e) => setSelectedSector(e.target.value as any)}
              className="w-full text-slate-800 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 h-8 cursor-pointer"
            >
              <option value="Todos">Sector: Todos</option>
              <option value="Público">Público</option>
              <option value="Privado">Privado</option>
            </select>
          </div>

          {/* PJS filtro */}
          <div>
            <select
              value={selectedPjs}
              onChange={(e) => setSelectedPjs(e.target.value)}
              className="w-full text-slate-800 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 h-8 cursor-pointer"
            >
              <option value="Todos">PJS: Todos</option>
              {activePjs.map(p => (
                <option key={p.id} value={p.id}>{p.nombre} {p.apellido || ""}</option>
              ))}
            </select>
          </div>

          {/* Ciudad filtro */}
          <div>
            <select
              value={selectedCiudad}
              onChange={(e) => setSelectedCiudad(e.target.value)}
              className="w-full text-slate-800 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 h-8 cursor-pointer"
            >
              <option value="Todos">Ciudad: Todas</option>
              {activeCiudades.map(c => (
                <option key={c.id} value={c.id}>{c.nombre}</option>
              ))}
            </select>
          </div>

          {/* Médico filtro */}
          <div>
            <select
              value={selectedMedico}
              onChange={(e) => setSelectedMedico(e.target.value)}
              className="w-full text-slate-800 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 h-8 cursor-pointer"
            >
              <option value="Todos">Médico: Todos</option>
              {activeMedicos.map(m => (
                <option key={m.id} value={m.id}>{m.nombre} {m.apellido || ""}</option>
              ))}
            </select>
          </div>

          {/* Aseguradora filtro */}
          <div>
            <select
              value={selectedAseguradora}
              onChange={(e) => setSelectedAseguradora(e.target.value)}
              className="w-full text-slate-800 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 h-8 cursor-pointer"
            >
              <option value="Todos">Aseguradora: Todas</option>
              {activeAseguradoras.map(a => (
                <option key={a.id} value={a.id}>{a.nombre}</option>
              ))}
            </select>
          </div>

          {/* Institución filtro */}
          <div>
            <select
              value={selectedInstitucion}
              onChange={(e) => setSelectedInstitucion(e.target.value)}
              className="w-full text-slate-800 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 h-8 cursor-pointer"
            >
              <option value="Todos">Institución: Todas</option>
              {activeInstituciones.map(i => (
                <option key={i.id} value={i.id}>{i.nombre}</option>
              ))}
            </select>
          </div>

          {/* Dispensación filtro */}
          <div>
            <select
              value={selectedDispensacion}
              onChange={(e) => setSelectedDispensacion(e.target.value)}
              className="w-full text-slate-800 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 h-8 cursor-pointer"
            >
              <option value="Todos">Dispensación: Todas</option>
              {activeDispensaciones.map(d => (
                <option key={d.id} value={d.id}>{d.nombre}</option>
              ))}
            </select>
          </div>

          {/* Distribuidor filtro */}
          <div>
            <select
              value={selectedDistribuidor}
              onChange={(e) => setSelectedDistribuidor(e.target.value)}
              className="w-full text-slate-800 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 h-8 cursor-pointer"
            >
              <option value="Todos">Distribuidor: Todos</option>
              {activeDistribuidores.map(d => (
                <option key={d.id} value={d.id}>{d.nombre}</option>
              ))}
            </select>
          </div>

          {/* Indicación filtro */}
          <div>
            <select
              value={selectedIndicacion}
              onChange={(e) => setSelectedIndicacion(e.target.value)}
              className="w-full text-slate-800 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 h-8 cursor-pointer"
            >
              <option value="Todos">Indicación: Todas</option>
              {activeIndicaciones.map(i => (
                <option key={i.id} value={i.id}>{i.nombre}</option>
              ))}
            </select>
          </div>

          {/* Dosis filtro */}
          <div>
            <select
              value={selectedDosis}
              onChange={(e) => setSelectedDosis(e.target.value)}
              className="w-full text-slate-800 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 h-8 cursor-pointer"
            >
              <option value="Todos">Dosis: Todas</option>
              {activeDosis.map(d => (
                <option key={d.id} value={d.id}>{d.nombre}</option>
              ))}
            </select>
          </div>
        </div>

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
