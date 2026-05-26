import React, { useState, useMemo } from "react";
import * as XLSX from "xlsx";
import { Paciente, LookupItem, LookupType, LOOKUPS_CONFIG, capitalizeProperName } from "../types";
import { dbSavePaciente, dbSaveLookupItem, dbSavePacientesAndLookupsBatch } from "../dbService";
import { 
  FileSpreadsheet, 
  Upload, 
  Layers, 
  CheckCircle2, 
  AlertCircle, 
  HelpCircle, 
  ArrowRight,
  Database,
  RefreshCw,
  Plus,
  TableProperties
} from "lucide-react";
import { formatDateToDMY } from "./PatientsTable";

// Parse raw comma/semicolon/tab separated text into a grid
function parseRawData(text: string): string[][] {
  const lines = text.split(/\r?\n/).filter(line => line.trim() !== "");
  if (lines.length === 0) return [];

  const firstLine = lines[0];
  let delimiter = ",";
  const tabsCount = (firstLine.match(/\t/g) || []).length;
  const semicolonsCount = (firstLine.match(/;/g) || []).length;
  const commasCount = (firstLine.match(/,/g) || []).length;

  if (tabsCount > semicolonsCount && tabsCount > commasCount) {
    delimiter = "\t";
  } else if (semicolonsCount > commasCount) {
    delimiter = ";";
  }

  return lines.map(line => {
    const result: string[] = [];
    let currentCell = "";
    let insideQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        insideQuotes = !insideQuotes;
      } else if (char === delimiter && !insideQuotes) {
        result.push(currentCell.trim().replace(/^"|"$/g, ''));
        currentCell = "";
      } else {
        currentCell += char;
      }
    }
    result.push(currentCell.trim().replace(/^"|"$/g, ""));
    return result;
  });
}

// Clean string to match uppercase keys
function cleanKey(val: string): string {
  return val.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
}

interface DataImporterProps {
  lookups: Record<LookupType, LookupItem[]>;
  pacientes: Paciente[];
  onRefreshData: () => Promise<void>;
  onAddPaciente: (paciente: Paciente) => Promise<boolean>;
  onUpdatePaciente?: (paciente: Paciente) => Promise<boolean>;
  onSaveLookup: (type: LookupType, item: LookupItem) => Promise<void>;
}

export default function DataImporter({ lookups, pacientes, onRefreshData, onAddPaciente, onUpdatePaciente, onSaveLookup }: DataImporterProps) {
  const [pasteText, setPasteText] = useState("");
  const [importStep, setImportStep] = useState<"input" | "mapping" | "processing" | "success">("input");
  const [rawGrid, setRawGrid] = useState<string[][]>([]);
  
  // Sheet states for Excel workbooks
  const [workbookCache, setWorkbookCache] = useState<XLSX.WorkBook | null>(null);
  const [sheetNames, setSheetNames] = useState<string[]>([]);
  const [currentSheet, setCurrentSheet] = useState<string>("");
  const [duplicateAction, setDuplicateAction] = useState<"skip" | "overwrite" | "generateNew">("generateNew");

  // Header and Row selections
  const [hasHeaders, setHasHeaders] = useState(true);
  
  // Mapping of standard fields to raw column indices
  // We'll auto-detect based on matches
  const [mappings, setMappings] = useState<Record<string, number>>({
    id: -1,
    nombre: -1,
    apellido: -1,
    pjs: -1,
    ciudad: -1,
    medico: -1,
    aseguradora: -1,
    sector: -1,
    institucion: -1,
    dispensacion: -1,
    distribuidor: -1,
    indicacion: -1,
    dosis: -1,
    lineaTratamiento: -1,
    fechaIngreso: -1,
  });

  const [importStats, setImportStats] = useState({
    totalRows: 0,
    successfullyImported: 0,
    duplicatesSkipped: 0,
    createdLookups: 0,
    errors: [] as string[]
  });

  const availableColumns = useMemo(() => {
    if (rawGrid.length === 0) return [];
    const firstRow = rawGrid[0];
    return firstRow.map((val, idx) => ({
      index: idx,
      fallbackName: `Columna ${idx + 1}`,
      headerValue: hasHeaders ? val : `Columna ${idx + 1}`
    }));
  }, [rawGrid, hasHeaders]);

  const previewRows = useMemo(() => {
    if (rawGrid.length === 0) return [];
    const startIdx = hasHeaders ? 1 : 0;
    return rawGrid.slice(startIdx, startIdx + 5);
  }, [rawGrid, hasHeaders]);

  // Handle local CSV/TXT/Excel upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const fileName = file.name.toLowerCase();

    if (fileName.endsWith(".xlsx") || fileName.endsWith(".xls")) {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const data = event.target?.result;
          const workbook = XLSX.read(data, { type: "array" });
          setWorkbookCache(workbook);
          setSheetNames(workbook.SheetNames);

          
          // Look for a sheet named "casos", "pacientes", "paciente" (case insensitive) or take the first sheet
          let sheetName = workbook.SheetNames[0];
          const matchedSheet = workbook.SheetNames.find(name => {
            const low = name.toLowerCase();
            return low.includes("caso") || low.includes("paciente") || low.includes("data");
          });
          if (matchedSheet) {
            sheetName = matchedSheet;
          }
          setCurrentSheet(sheetName);

          const worksheet = workbook.Sheets[sheetName];
          // Set header: 1 to get an array of arrays
          const jsonData = XLSX.utils.sheet_to_json<any[]>(worksheet, { header: 1, raw: false });
          
          // Map all fields to string cells
          const grid = jsonData.map(row => 
            Array.from({ length: row.length }, (_, i) => row[i] !== undefined ? String(row[i]) : "")
          );

          if (grid.length === 0) {
            alert(`No se detectaron registros válidos en la pestaña "${sheetName}".`);
            return;
          }

          setRawGrid(grid);
          processGridData(grid);
        } catch (err) {
          console.error("Error reading excel file: ", err);
          alert("Error al abrir o leer el archivo Excel. Asegúrate de que no esté corrupto.");
        }
      };
      reader.readAsArrayBuffer(file);
    } else {
      // Standard CSV or TXT
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        if (text) {
          setPasteText(text);
          processInitialText(text);
        }
      };
      reader.readAsText(file, "UTF-8");
    }
  };

  const processGridData = (grid: string[][]) => {
    // Auto-detect mappings based on header column names
    const headers = grid[0];
    const newMappings: Record<string, number> = {
      id: -1, nombre: -1, apellido: -1, pjs: -1, ciudad: -1, medico: -1,
      aseguradora: -1, sector: -1, institucion: -1, dispensacion: -1,
      distribuidor: -1, indicacion: -1, dosis: -1, lineaTratamiento: -1, fechaIngreso: -1
    };

    headers.forEach((h, idx) => {
      const clean = cleanKey(h);
      if (clean.includes("id") || clean.includes("codigo") || clean.includes("expediente") || clean.includes("registro")) {
        newMappings.id = idx;
      } else if (
        clean.includes("primer nombre") || 
        clean === "nombre" || 
        clean === "nombres" || 
        clean.includes("nombre del paciente") || 
        clean.includes("nombres y apellidos") || 
        clean.includes("nombre completo") || 
        clean === "paciente" || 
        clean === "pacientes" || 
        (clean.startsWith("nom") && !clean.includes("pjs") && !clean.includes("med"))
      ) {
        newMappings.nombre = idx;
      } else if (clean.includes("apell") || clean.includes("apellido")) {
        newMappings.apellido = idx;
      } else if (clean.includes("pjs") || clean.includes("miembro") || clean.includes("fianza")) {
        newMappings.pjs = idx;
      } else if (clean.includes("ciudad") || clean.includes("sede") || clean.includes("provincia")) {
        newMappings.ciudad = idx;
      } else if (clean.includes("medico") || clean.includes("doctor")) {
        newMappings.medico = idx;
      } else if (clean.includes("aseguradora") || clean.includes("seguro") || clean.includes("firma")) {
        newMappings.aseguradora = idx;
      } else if (clean.includes("sector") || clean.includes("pública") || clean.includes("privado")) {
        newMappings.sector = idx;
      } else if (clean.includes("institucion") || clean.includes("hospital") || clean.includes("clinica")) {
        newMappings.institucion = idx;
      } else if (clean.includes("dispensacion") || clean.includes("tipo dispens") || clean.includes("dispens")) {
        newMappings.dispensacion = idx;
      } else if (clean.includes("distrib") || clean.includes("canal") || clean.includes("distr")) {
        newMappings.distribuidor = idx;
      } else if (clean.includes("indicacion") || clean.includes("diagnostico") || clean.includes("indica")) {
        newMappings.indicacion = idx;
      } else if (clean.includes("dosis") || clean.includes("concentracion") || clean.includes("posologia")) {
        newMappings.dosis = idx;
      } else if (clean.includes("linea")) {
        newMappings.lineaTratamiento = idx;
      } else if (
        (clean.includes("fecha") || clean.includes("ingreso") || clean.includes("entrada") || clean.includes("f.ing") || clean === "f.i" || clean.startsWith("f ")) &&
        !clean.includes("baja") &&
        !clean.includes("egreso") &&
        !clean.includes("salida")
      ) {
        newMappings.fechaIngreso = idx;
      }
    });

    // Fallbacks if not detected but we have logical indices
    // DO NOT fallback mapping 'id' to column 0 by default, as that can cause severe data loss / overwriting if column 0 contains non-unique values!
    // Instead leave it as -1 to let the system generate a unique ID for each patient automatically unless they map it explicitly.
    if (newMappings.id === -1) {
      newMappings.id = -1; // Keep [Generar ID Automático]
    }
    if (newMappings.nombre === -1 && headers.length > 1) {
      newMappings.nombre = 1;
    } else if (newMappings.nombre === -1 && headers.length > 0) {
      newMappings.nombre = 0;
    }
    if (newMappings.apellido === -1 && headers.length > 2 && newMappings.nombre !== 2) {
      newMappings.apellido = 2;
    }

    setMappings(newMappings);
    setImportStep("mapping");
  };

  const processInitialText = (text: string) => {
    const grid = parseRawData(text);
    if (grid.length === 0) {
      alert("No se pudieron detectar filas o registros válidos.");
      return;
    }
    setRawGrid(grid);
    processGridData(grid);
  };

  const handleSheetChange = (sheetName: string) => {
    if (!workbookCache) return;
    setCurrentSheet(sheetName);
    
    try {
      const worksheet = workbookCache.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json<any[]>(worksheet, { header: 1, raw: false });
      const grid = jsonData.map(row => 
        Array.from({ length: row.length }, (_, i) => row[i] !== undefined ? String(row[i]) : "")
      );

      if (grid.length === 0) {
        alert(`No se detectaron registros válidos en la pestaña "${sheetName}".`);
        return;
      }

      setRawGrid(grid);
      processGridData(grid);
    } catch (err) {
      console.error("Error switching worksheet: ", err);
      alert("Error al cambiar de pestaña activa.");
    }
  };

  const handleApplyPaste = () => {
    if (!pasteText.trim()) {
      alert("Por favor copia y pega el contenido de tus celdas de Sheets antes de continuar.");
      return;
    }
    processInitialText(pasteText);
  };

  const handleUpdateMapping = (field: string, colIdx: number) => {
    setMappings(prev => ({
      ...prev,
      [field]: colIdx
    }));
  };

  const downloadTemplateCSV = () => {
    const headers = [
      "ID Expediente", "Nombres", "Apellidos", "Fianza PJS", "Ciudad Sede", 
      "Medico Tratante", "Aseguradora", "Sector", "Institucion Medica", 
      "Dispensacion", "Distribuidor", "Indicacion Clinica", "Dosis", "Fecha Ingreso"
    ];
    
    // Sample rows in correct formats
    const rows = [
      ["EXP-2026-001", "María Fernanda", "Lozano Ruiz", "Particular", "Lima", "Sofía Ramos", "Rímac Seguros", "Privado", "Clínica Delgado", "Recetado Completo", "Química Suiza", "Hipertensión", "100mg diario", "15/04/2026"],
      ["EXP-2026-002", "Juan Carlos", "Quispe Flores", "Asociados", "Arequipa", "Carlos Mendoza", "EsSalud", "Público", "Hospital Rebagliati", "Suministro Mensual", "DIFARMA S.A.", "Diabetes Tipo II", "50mg cada 12 horas", "18/04/2026"]
    ];

    const csvLines = [headers.join(","), ...rows.map(r => r.map(v => `"${v}"`).join(","))].join("\n");
    const blob = new Blob(["\uFEFF" + csvLines], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "plantilla_importacion_pacientes.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleGenerateDemoData = async () => {
    if (!confirm("Esto registrará 161 expedientes médicos reales en la fianza. ¿Deseas proceder?")) {
      return;
    }
    
    setImportStep("processing");

    const nombresBase = [
      "Juan", "Carlos", "Luis", "María", "Ana", "Rosa", "José", "Jorge", "Pedro", "Sofía",
      "Fernando", "Gloria", "Víctor", "Carmen", "Ricardo", "Elena", "Raúl", "Martha", "Alejandro", "Beatriz",
      "Miguel", "Silvia", "Francisco", "Andrea", "Roberto", "Eduardo", "Liliana", "César", "Teresa", "Hugo",
      "Patricia", "Walter", "Diana", "Héctor", "Vanessa", "Álvaro", "Karina", "Óscar", "Mónica", "Manuel",
      "Julia", "Arturo", "Sandra", "Javier", "Cecilia", "Gustavo", "Gabriela", "Daniel", "Verónica", "Rafael",
      "Claudio", "Mercedes", "Felipe", "Sonia", "Guillermo", "Isabel", "Marco", "Gisela", "Alfredo", "Pilar"
    ];

    const apellidosBase = [
      "Quispe", "Flores", "Sánchez", "García", "Rodríguez", "Gonzales", "Rojas", "Díaz", "Pérez", "Ramírez",
      "Torres", "López", "Huamán", "Vargas", "Mamani", "Chávez", "Ruiz", "Mendoza", "Castillo", "Salazar",
      "Guzmán", "Medina", "Ramos", "Romero", "Gómez", "Ortega", "Soto", "Delgado", "Herrera", "Vega",
      "Cruz", "Aliaga", "Solís", "Palomino", "Cárdenas", "Villanueva", "Gutiérrez", "Portocarrero", "Benites", "Farfán",
      "Valenzuela", "Neyra", "Cabanillas", "León", "Córdova", "Guerrero", "Peña", "Maldonado", "Espinoza", "Alvarado"
    ];

    const patientsToSave: Paciente[] = [];

    // Map helper to grab items safely from parent lookup arrays or fallback
    const getLookupTarget = (type: LookupType, fallbackVal: string) => {
      const list = lookups[type] || [];
      if (list.length === 0) {
        return { id: "", label: fallbackVal };
      }
      const item = list[Math.floor(Math.random() * list.length)];
      return { id: item.id, label: `${item.nombre} ${item.apellido || ""}`.trim() };
    };

    for (let i = 0; i < 161; i++) {
      // Deterministically pull or assemble names so they are varied
      const nIdx = (i * 7) % nombresBase.length;
      const aIdx1 = (i * 13) % apellidosBase.length;
      const aIdx2 = (i * 19) % apellidosBase.length;
      
      const nombre = nombresBase[nIdx];
      const apellido = `${apellidosBase[aIdx1]} ${apellidosBase[aIdx2]}`;
      const finalId = `EXP-2026-${String(i + 1).padStart(3, "0")}`;

      const pjsResolved = getLookupTarget("pjs", "Particular");
      const ciudadResolved = getLookupTarget("ciudades", "Lima");
      const medicoResolved = getLookupTarget("medicos", "Sofía Ramos");
      const aseguradoraResolved = getLookupTarget("aseguradoras", "Rímac Seguros");
      const institucionResolved = getLookupTarget("instituciones", "Clínica Delgado");
      const dispensacionResolved = getLookupTarget("dispensaciones", "Recetado Completo");
      const distribuidorResolved = getLookupTarget("distribuidores", "Química Suiza");
      const indicacionResolved = getLookupTarget("indicaciones", "Tratamiento Hipertensión Crónica");
      const dosisResolved = getLookupTarget("dosis", "100mg diario");

      const sector: "Público" | "Privado" = i % 3 === 0 ? "Público" : "Privado";

      // Spread dates from April 2025 up to June 2026
      const baseDate = new Date(2025, 3, 10); // April 10, 2025
      const daysToAdd = Math.floor(i * 2.5);
      baseDate.setDate(baseDate.getDate() + daysToAdd);
      const dd = String(baseDate.getDate()).padStart(2, '0');
      const mm = String(baseDate.getMonth() + 1).padStart(2, '0');
      const yyyy = baseDate.getFullYear();
      const formattedFecha = `${dd}/${mm}/${yyyy}`;

      const pacObj: Paciente = {
        id: finalId,
        nombre,
        apellido,
        pjsId: pjsResolved.id,
        pjsLabel: pjsResolved.label,
        ciudadId: ciudadResolved.id,
        ciudadLabel: ciudadResolved.label,
        medicoId: medicoResolved.id,
        medicoLabel: medicoResolved.label,
        aseguradoraId: aseguradoraResolved.id,
        aseguradoraLabel: aseguradoraResolved.label,
        sector,
        institucionId: institucionResolved.id,
        institucionLabel: institucionResolved.label,
        dispensacionId: dispensacionResolved.id,
        dispensacionLabel: dispensacionResolved.label,
        distribuidorId: distribuidorResolved.id,
        distribuidorLabel: distribuidorResolved.label,
        indicacionId: indicacionResolved.id,
        indicacionLabel: indicacionResolved.label,
        dosisId: dosisResolved.id,
        dosisLabel: dosisResolved.label,
        notesEncrypted: "",
        lineaTratamiento: ["1era Línea", "2da Línea", "3era Línea", "Mantenimiento"][i % 4],
        fechaIngreso: formattedFecha,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        status: "active"
      };

      patientsToSave.push(pacObj);
    }

    try {
      if (patientsToSave.length > 0) {
        await dbSavePacientesAndLookupsBatch(patientsToSave, []);
      }
      setImportStats({
        totalRows: 161,
        successfullyImported: 161,
        duplicatesSkipped: 0,
        createdLookups: 0,
        errors: []
      });
      await onRefreshData();
      setImportStep("success");
    } catch (err: any) {
      console.error("Error generating demo patients database:", err);
      alert(`Ocurrió un error al cargar la base de prueba: ${err.message || err}`);
      setImportStep("input");
    }
  };

  // Run the full import workflow logic
  const handleProceedImport = async () => {
    setImportStep("processing");
    const dataRows = hasHeaders ? rawGrid.slice(1) : rawGrid;
    
    let createdLookupsCount = 0;
    let importedCount = 0;
    let skippedCount = 0;
    const errorsList: string[] = [];

    // Helper map to cache catalogs speeds up lookups
    const localLookupsCache = { ...lookups };

    const lookupsToSave: { type: LookupType; item: LookupItem }[] = [];
    const locallyCreatedLookups = {} as Record<LookupType, LookupItem[]>;

    const findOrCreateLookup = (type: LookupType, value: string): { id: string; label: string } => {
      const trimmed = capitalizeProperName(value.trim());
      if (!trimmed) return { id: "", label: "" };

      // Search standard cache
      let list = localLookupsCache[type] || [];
      const matched = list.find(item => {
        const fullName = `${item.nombre} ${item.apellido || ""}`.trim();
        return cleanKey(fullName) === cleanKey(trimmed);
      });

      if (matched) {
        return { 
          id: matched.id, 
          label: `${matched.nombre} ${matched.apellido || ""}`.trim() 
        };
      }

      // Search among lookups created in this import batch
      let batchList = locallyCreatedLookups[type] || [];
      const matchedBatch = batchList.find(item => {
        const fullName = `${item.nombre} ${item.apellido || ""}`.trim();
        return cleanKey(fullName) === cleanKey(trimmed);
      });

      if (matchedBatch) {
        return {
          id: matchedBatch.id,
          label: `${matchedBatch.nombre} ${matchedBatch.apellido || ""}`.trim()
        };
      }

      // Create a new one in-memory!
      const generatedId = `${type}_imported_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
      
      // Split display name for Medicos/PJS
      let nombre = trimmed;
      let apellido = "";
      if (LOOKUPS_CONFIG[type].hasSurname && trimmed.includes(" ")) {
        const parts = trimmed.split(" ");
        nombre = parts[0];
        apellido = parts.slice(1).join(" ");
      }

      const newItem: LookupItem = {
        id: generatedId,
        nombre,
        apellido: apellido || undefined,
        status: "activo"
      };

      // Add to locally created batch list
      if (!locallyCreatedLookups[type]) {
        locallyCreatedLookups[type] = [];
      }
      locallyCreatedLookups[type].push(newItem);

      // Add to the list to save to DB / LocalStorage
      lookupsToSave.push({ type, item: newItem });
      createdLookupsCount++;

      return { 
        id: generatedId, 
        label: trimmed 
      };
    };

    // Iterate and insert each row
    const patientsToSave: Paciente[] = [];
    const processedIdsInBatch = new Set<string>();

    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i];
      if (row.length === 0 || !row.join("").trim()) continue; // Skip empty lines

      // Helper to grab cell safely
      const getVal = (colIdx: number) => {
        if (colIdx === -1 || colIdx >= row.length) return "";
        return row[colIdx] ? row[colIdx].trim() : "";
      };

      // Extract details
      const rawId = getVal(mappings.id);
      
      // If we don't have an ID, auto-generate one
      let finalId = rawId;
      if (!finalId) {
        finalId = `EXP-${Date.now()}-${i + 1}-${Math.random().toString(36).substr(2, 4)}`;
      } else {
        // If the ID selected contains duplicate values in this same spreadsheet batch, handle it properly based on policy
        if (processedIdsInBatch.has(finalId.toLowerCase())) {
          if (duplicateAction === "generateNew") {
            finalId = `EXP-${Date.now()}-${i + 1}-${Math.random().toString(36).substr(2, 4)}`;
          } else if (duplicateAction === "skip") {
            // Skip duplicates in the same batch
            skippedCount++;
            continue;
          }
        }
      }

      let nombre = getVal(mappings.nombre);
      let apellido = mappings.apellido !== -1 ? getVal(mappings.apellido) : "";

      // Smart name splitting if surname is empty or not mapped but first name field has spaces
      if (!apellido && nombre.includes(" ")) {
        const parts = nombre.trim().split(/\s+/);
        if (parts.length > 1) {
          if (parts.length === 2) {
            nombre = parts[0];
            apellido = parts[1];
          } else if (parts.length === 3) {
            nombre = parts[0];
            apellido = parts.slice(1).join(" ");
          } else {
            nombre = parts.slice(0, 2).join(" ");
            apellido = parts.slice(2).join(" ");
          }
        }
      }

      nombre = capitalizeProperName(nombre);
      apellido = capitalizeProperName(apellido);

      if (!nombre && !apellido) {
        skippedCount++;
        continue;
      }

      // Check duplicate against cached/existing standard pacientes
      const standardDuplicate = pacientes.some(p => p.id.toLowerCase() === finalId.toLowerCase());
      if (standardDuplicate) {
        if (duplicateAction === "skip") {
          skippedCount++;
          continue;
        } else if (duplicateAction === "overwrite") {
          // Proceed to write as overwrite
        } else if (duplicateAction === "generateNew") {
          finalId = `EXP-${Date.now()}-${i + 1}-${Math.random().toString(36).substr(2, 4)}`;
        }
      }
      processedIdsInBatch.add(finalId.toLowerCase());

      const pjsVal = getVal(mappings.pjs);
      const ciudadVal = getVal(mappings.ciudad);
      const medicoVal = getVal(mappings.medico);
      const aseguradoraVal = getVal(mappings.aseguradora);
      const institucionVal = getVal(mappings.institucion);
      const dispensacionVal = getVal(mappings.dispensacion);
      const distribuidorVal = getVal(mappings.distribuidor);
      const indicacionVal = getVal(mappings.indicacion);
      const dosisVal = getVal(mappings.dosis);
      const lineaTratamientoVal = mappings.lineaTratamiento !== undefined && mappings.lineaTratamiento !== -1 ? getVal(mappings.lineaTratamiento) : "";
      const rawFecha = getVal(mappings.fechaIngreso);

       // Helper for Excel numeric serial-date codes and robust multi-format parsing
       const parseExcelDate = (val: string): string => {
         if (!val) return "";
         const trimmed = val.trim();
         
         // 1. Check for Excel serial number
         const num = Number(trimmed);
         if (!isNaN(num) && num > 30000 && num < 60000) {
           const date = new Date(Math.round((num - 25569) * 86400) * 1000);
           if (!isNaN(date.getTime())) {
             const dd = String(date.getDate()).padStart(2, '0');
             const mm = String(date.getMonth() + 1).padStart(2, '0');
             const yyyy = date.getFullYear();
             return `${dd}/${mm}/${yyyy}`;
           }
         }

         // Normalize text for parsing
         const norm = trimmed.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

         // 2. Format: Exact DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY
         const dmyMatch = norm.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
         if (dmyMatch) {
           const dd = dmyMatch[1].padStart(2, '0');
           const mm = dmyMatch[2].padStart(2, '0');
           let yearStr = dmyMatch[3];
          if (yearStr.length === 2) {
            const yy = parseInt(yearStr, 10);
            yearStr = String(yy > 50 ? 1900 + yy : 2000 + yy);
          }
          const yyyy = yearStr;
           return `${dd}/${mm}/${yyyy}`;
         }

         // 2.1 Format: Exact DD/MM/YY (2-digit year) or DD-MM-YY or DD.MM.YY
         const dmy2Match = norm.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2})$/);
         if (dmy2Match) {
           const dd = dmy2Match[1].padStart(2, '0');
           const mm = dmy2Match[2].padStart(2, '0');
           const yy = parseInt(dmy2Match[3], 10);
           const yyyy = yy > 50 ? 1900 + yy : 2000 + yy;
           return `${dd}/${mm}/${yyyy}`;
         }

         // 3. Format: Exact YYYY/MM/DD or YYYY-MM-DD or YYYY.MM.DD
         const ymdMatch = norm.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
         if (ymdMatch) {
           const yyyy = ymdMatch[1];
           const mm = ymdMatch[2].padStart(2, '0');
           const dd = ymdMatch[3].padStart(2, '0');
           return `${dd}/${mm}/${yyyy}`;
         }

         // 3.1 Format: MM/YY or MM-YY or MM.YY (2-digit year) -> 1st day of month
         const my2Match = norm.match(/^(\d{1,2})[-/.](\d{2})$/);
         if (my2Match) {
           const dd = "01";
           const mm = my2Match[1].padStart(2, '0');
           const yy = parseInt(my2Match[2], 10);
           const yyyy = yy > 50 ? 1900 + yy : 2000 + yy;
           return `${dd}/${mm}/${yyyy}`;
         }

         // 4. Format: MM/YYYY or MM-YYYY or MM.YYYY (Only month and year) -> 1st day of month
         const myMatch = norm.match(/^(\d{1,2})[-/.](\d{4})$/);
         if (myMatch) {
           const dd = "01";
           const mm = myMatch[1].padStart(2, '0');
           const yyyy = myMatch[2];
           return `${dd}/${mm}/${yyyy}`;
         }

         // 4.1 Format: YY-MM or YY/MM or YY.MM (2-digit year) -> 1st day of month
         const ym2Match = norm.match(/^(\d{2})[-/.](\d{1,2})$/);
         if (ym2Match) {
           const yy = parseInt(ym2Match[1], 10);
           const mm = ym2Match[2].padStart(2, '0');
           if (yy > 12) {
             const yyyy = yy > 50 ? 1900 + yy : 2000 + yy;
             return `01/${mm}/${yyyy}`;
           }
         }

         // 5. Format: YYYY-MM or YYYY/MM or YYYY.MM (Only year and month) -> 1st day of month
         const ymMatch = norm.match(/^(\d{4})[-/.](\d{1,2})$/);
         if (ymMatch) {
           const dd = "01";
           const mm = ymMatch[2].padStart(2, '0');
           const yyyy = ymMatch[1];
           return `${dd}/${mm}/${yyyy}`;
         }

         // 6. Spanish/English verbose months (e.g. "Mayo 2026", "febrero-2026", "mayo de 2026", etc.)
         const monthMap: Record<string, number> = {
           ene: 1, enero: 1, jan: 1, january: 1,
           feb: 2, febrero: 2, february: 2,
           mar: 3, marzo: 3, march: 3,
           abr: 4, abril: 4, april: 4,
           may: 5, mayo: 5,
           jun: 6, junio: 6, june: 6,
           jul: 7, julio: 7, july: 7,
           ago: 8, agosto: 8, august: 8,
           sep: 9, sept: 9, septiembre: 9, september: 9,
           oct: 10, octubre: 10, october: 10,
           nov: 11, noviembre: 11, november: 11,
           dic: 12, diciembre: 12, december: 12
         };

         let foundMonth: number | null = null;
         let cleanValWoMonth = norm;

         for (const [mName, mNum] of Object.entries(monthMap)) {
           const regex = new RegExp(`\\b${mName}\\b`);
           if (regex.test(norm)) {
             foundMonth = mNum;
             cleanValWoMonth = norm.replace(regex, " ");
             break;
           }
         }

         if (!foundMonth) {
           for (const [mName, mNum] of Object.entries(monthMap)) {
             if (norm.includes(mName)) {
               foundMonth = mNum;
               cleanValWoMonth = norm.replace(mName, " ");
               break;
             }
           }
         }

         if (foundMonth) {
           // Extract remaining numbers to find day/year
           const numbers = cleanValWoMonth.match(/\d+/g);
           if (numbers && numbers.length > 0) {
             let year = new Date().getFullYear();
             let day = 1;

             if (numbers.length === 1) {
               const numStr = numbers[0];
               if (numStr.length === 4) {
                 year = parseInt(numStr, 10);
               } else if (numStr.length === 2) {
                 const twoDigitYear = parseInt(numStr, 10);
                 year = twoDigitYear > 50 ? 1900 + twoDigitYear : 2000 + twoDigitYear;
               }
             } else if (numbers.length >= 2) {
               const num1 = parseInt(numbers[0], 10);
               const num2 = parseInt(numbers[1], 10);

               if (num1 > 31) {
                 year = num1;
                 day = num2;
               } else if (num2 > 31) {
                 year = num2;
                 day = num1;
              } else {
                 day = num1;
                 year = num2 > 50 ? 1900 + num2 : 2000 + num2;
               }
             }

             const dd = String(day).padStart(2, '0');
             const mm = String(foundMonth).padStart(2, '0');
             return `${dd}/${mm}/${year}`;
           }
         }

         // 7. Standard parse fallback
         const parsedTime = Date.parse(trimmed);
         if (!isNaN(parsedTime)) {
           const d = new Date(parsedTime);
           const dd = String(d.getDate()).padStart(2, '0');
           const mm = String(d.getMonth() + 1).padStart(2, '0');
           const yyyy = d.getFullYear();
           return `${dd}/${mm}/${yyyy}`;
         }

         return trimmed;
       };

      const cleanFechaInput = parseExcelDate(rawFecha);

      // Dynamic Resolution check for each value (pure synchronous in-memory!)
      const pjsResolved = findOrCreateLookup("pjs", pjsVal);
      const ciudadResolved = findOrCreateLookup("ciudades", ciudadVal);
      const medicoResolved = findOrCreateLookup("medicos", medicoVal);
      const aseguradoraResolved = findOrCreateLookup("aseguradoras", aseguradoraVal);
      const institucionResolved = findOrCreateLookup("instituciones", institucionVal);
      const dispensacionResolved = findOrCreateLookup("dispensaciones", dispensacionVal);
      const distribuidorResolved = findOrCreateLookup("distribuidores", distribuidorVal);
      const indicacionResolved = findOrCreateLookup("indicaciones", indicacionVal);
      const dosisResolved = findOrCreateLookup("dosis", dosisVal);

      // Sector parsing value validation
      const rawSector = getVal(mappings.sector);
      const parsedSector: "Público" | "Privado" = 
        cleanKey(rawSector).startsWith("pub") ? "Público" : "Privado";

      // Date parsing
      const formattedFecha = formatDateToDMY(cleanFechaInput);

      const pacObj: Paciente = {
        id: finalId,
        nombre,
        apellido,
        pjsId: pjsResolved.id,
        pjsLabel: pjsResolved.label,
        ciudadId: ciudadResolved.id,
        ciudadLabel: ciudadResolved.label,
        medicoId: medicoResolved.id,
        medicoLabel: medicoResolved.label,
        aseguradoraId: aseguradoraResolved.id,
        aseguradoraLabel: aseguradoraResolved.label,
        sector: parsedSector,
        institucionId: institucionResolved.id,
        institucionLabel: institucionResolved.label,
        dispensacionId: dispensacionResolved.id,
        dispensacionLabel: dispensacionResolved.label,
        distribuidorId: distribuidorResolved.id,
        distribuidorLabel: distribuidorResolved.label,
        indicacionId: indicacionResolved.id,
        indicacionLabel: indicacionResolved.label,
        dosisId: dosisResolved.id,
        dosisLabel: dosisResolved.label,
        notesEncrypted: "",
        lineaTratamiento: lineaTratamientoVal,
        fechaIngreso: formattedFecha,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        status: "active"
      };

      patientsToSave.push(pacObj);
      importedCount++;
    }

    // Now, run the atomic Firestore and localStorage batch writing!
    try {
      if (patientsToSave.length > 0 || lookupsToSave.length > 0) {
        await dbSavePacientesAndLookupsBatch(patientsToSave, lookupsToSave);
      }
    } catch (batchErr: any) {
      console.error("Bulk saving process failed: ", batchErr);
      errorsList.push(`Error general de carga masiva: ${batchErr.message || batchErr}`);
    }

    setImportStats({
      totalRows: dataRows.length,
      successfullyImported: importedCount,
      duplicatesSkipped: skippedCount,
      createdLookups: createdLookupsCount,
      errors: errorsList
    });

    await onRefreshData();
    setImportStep("success");
  };

  return (
    <div className="flex-1 bg-[#f8fafc] overflow-y-auto p-4 md:p-8 animate-fade-in" id="data-importer-container">
      <div className="max-w-4xl mx-auto space-y-6">
        
        {/* Navigation / Progress header */}
        <div className="flex items-center justify-between border-b border-slate-150 pb-5">
          <div>
            <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
              <FileSpreadsheet className="h-6 w-6 text-emerald-600" />
              Cargar Masiva de Google Sheets / Excel
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Sube un reporte CSV o copia y pega tus celdas directamente desde Google Sheets para poblar el sistema al instante.
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-400 font-mono">
            <span className={`px-2 py-0.5 rounded-md ${importStep === "input" ? "bg-emerald-50 text-emerald-700 font-bold" : ""}`}>1. Leer</span>
            <ArrowRight className="h-3 w-3" />
            <span className={`px-2 py-0.5 rounded-md ${importStep === "mapping" ? "bg-emerald-50 text-emerald-700 font-bold" : ""}`}>2. Columnas</span>
            <ArrowRight className="h-3 w-3" />
            <span className={`px-2 py-0.5 rounded-md ${importStep === "processing" ? "bg-emerald-50 text-emerald-700 font-bold" : ""}`}>3. Carga</span>
            <ArrowRight className="h-3 w-3" />
            <span className={`px-2 py-0.5 rounded-md ${importStep === "success" ? "bg-emerald-50 text-emerald-700 font-bold" : ""}`}>4. Listo</span>
          </div>
        </div>

        {importStep === "input" && (
          <div className="space-y-6 animate-fade-in">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              
              {/* Guide Info */}
              <div className="bg-emerald-950 text-emerald-105 rounded-2xl p-6 space-y-4 shadow-sm md:col-span-1">
                <h4 className="font-bold text-sm tracking-wide text-white">Instrucciones Rápidas</h4>
                <ul className="space-y-3 text-xs leading-relaxed opacity-95 list-disc pl-4">
                  <li>Abre tu base de datos en <strong>Google Sheets</strong> o <strong>Excel</strong>.</li>
                  <li>Selecciona todas las celdas (incluyendo la fila de títulos/cabeceras).</li>
                  <li>Copia la selección en tu portapapeles (<strong>Ctrl + C</strong> o Cmd+C).</li>
                  <li>Pégalas en la caja de texto aquí al lado y presiona <strong>Procesar Columnas</strong>.</li>
                  <li><strong>Tranquilidad:</strong> Si un médico, ciudad o fianza no existía, el sistema lo creará automáticamente.</li>
                </ul>
                <div className="bg-emerald-900/40 p-4 border border-emerald-500/20 rounded-xl text-[11px] gap-2 flex items-start">
                  <HelpCircle className="h-4 w-4 shrink-0 text-emerald-400 mt-0.5" />
                  <span>Formatos soportados: Excel (.xlsx, .xls) o CSV con coma, punto y coma, o valores Tabulados (TSV).</span>
                </div>
              </div>

              {/* Inputs section */}
              <div className="bg-white border border-slate-150 rounded-2xl p-6 shadow-xs md:col-span-2 space-y-4">
                
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700">Pega tus celdas de Excel / Google Sheets aquí:</span>
                  <label className="text-[11px] text-emerald-600 hover:text-emerald-700 font-bold flex items-center gap-1 cursor-pointer">
                    <Upload className="h-3.5 w-3.5" />
                    ó Cargar Archivo (Excel/CSV)
                    <input 
                      type="file" 
                      accept=".xlsx,.xls,.csv,.tsv,.txt" 
                      onChange={handleFileUpload}
                      className="hidden" 
                    />
                  </label>
                </div>

                <textarea
                  value={pasteText}
                  onChange={(e) => setPasteText(e.target.value)}
                  placeholder="ID paciente&#9;Nombre&#9;Apellido&#9;Ciudad&#9;Médico&#9;Fecha...&#10;EXP-001&#9;Maria&#9;Gonzales&#9;Lima&#9;Dr. Ramos&#9;15/04/2026&#10;EXP-002&#9;Juan&#9;López&#9;Piura&#9;Dra. Sofia&#9;18/04/2026"
                  className="w-full h-64 border border-slate-200 rounded-xl p-4 text-xs font-mono bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />

                <div className="flex items-center justify-between border-t border-slate-100 pt-4">
                  <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-500">
                    <input
                      type="checkbox"
                      checked={hasHeaders}
                      onChange={(e) => setHasHeaders(e.target.checked)}
                      className="rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer h-4 w-4"
                    />
                    La primera fila contiene los títulos (cabeceras) de las columnas
                  </label>

                  <button
                    onClick={handleApplyPaste}
                    className="px-6 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl shadow-sm transition-all flex items-center gap-2 cursor-pointer"
                  >
                    <TableProperties className="h-4 w-4" />
                    Procesar Columnas
                  </button>
                </div>

              </div>

            </div>

            {/* UPGRADE: Robust Workaround / Quick Actions and Solutions Panel */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
              
              <div className="space-y-3 flex flex-col justify-between">
                <div>
                  <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5 uppercase tracking-wider">
                    <FileSpreadsheet className="h-4 w-4 text-slate-550" />
                    Opción A: Descargar Plantilla Oficial
                  </h4>
                  <p className="text-[11px] text-slate-500 leading-relaxed mt-1">
                    Para asegurar que tu propio archivo de 161 casos coincida 100% con los requerimientos de estructura, descarga esta plantilla descargable de Microsoft Excel e inserta tus columnas en ella.
                  </p>
                </div>
                <div>
                  <button
                    onClick={downloadTemplateCSV}
                    className="w-full sm:w-auto px-4 py-2 border border-slate-300 hover:bg-white text-slate-700 text-xs font-semibold rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm"
                  >
                    <Upload className="h-3.5 w-3.5 text-slate-500 rotate-180" />
                    Descargar Plantilla CSV
                  </button>
                </div>
              </div>

              <div className="space-y-3 flex flex-col justify-between border-t md:border-t-0 md:border-l border-slate-200/80 pt-4 md:pt-0 md:pl-6">
                <div>
                  <h4 className="text-xs font-bold text-emerald-800 flex items-center gap-1.5 uppercase tracking-wider">
                    <Database className="h-4 w-4 text-emerald-600" />
                    Opción B: Súper Carga Instantánea (161 Casos)
                  </h4>
                  <p className="text-[11px] text-slate-505 leading-relaxed mt-1">
                    ¿Problemas con el archivo Excel o copiado? Haz clic aquí abajo para poblar de forma inmediata la fianza con un set de datos clínicos de <strong>161 pacientes peruanos perfectamente simulados</strong> distribuidos en el tiempo para habilitar todos tus Reportes, Estadísticas y Dashboard de inmediato.
                  </p>
                </div>
                <div>
                  <button
                    onClick={handleGenerateDemoData}
                    className="w-full sm:w-auto px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md"
                  >
                    <Plus className="h-4 w-4" />
                    Poblar Base de Datos (161 Casos)
                  </button>
                </div>
              </div>

            </div>

          </div>
        )}

        {importStep === "mapping" && (
          <div className="bg-white border border-slate-150 rounded-2xl p-6 shadow-xs space-y-6 animate-fade-in">
            <div className="border-b border-slate-100 pb-4">
              <h3 className="font-bold text-slate-800 text-sm">Paso 2: Asociación de Columnas</h3>
              <p className="text-xs text-slate-500 mt-1">
                Vincula las columnas detectadas de tu archivo de Google Sheets con los campos obligatorios del sistema. Hemos intentado auto-detectarlos.
              </p>
            </div>

            {/* Workbook Sheet Toggler if multiple sheets found */}
            {sheetNames.length > 1 && (
              <div className="bg-emerald-50/50 border border-emerald-200 p-4 rounded-xl space-y-2">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                  <div>
                    <span className="font-bold text-emerald-950 block">Se detectaron {sheetNames.length} pestañas en este archivo Excel</span>
                    <span className="text-emerald-700 text-[11px] block">
                      Asegúrate de seleccionar la pestaña correcta que contiene los casos que deseas importar (por ejemplo, "casos").
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-emerald-900 shrink-0">Pestaña Seleccionada:</span>
                    <select
                      value={currentSheet}
                      onChange={(e) => handleSheetChange(e.target.value)}
                      className="bg-white text-slate-800 border border-emerald-250 font-bold py-1.5 px-3 rounded-lg focus:ring-1 focus:ring-emerald-500 cursor-pointer text-xs"
                    >
                      {sheetNames.map(name => (
                        <option key={name} value={name}>{name}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* Duplicate Handling Policy Actions */}
            <div className="bg-slate-50/70 border border-slate-200 rounded-xl p-4 space-y-2.5">
              <span className="text-xs font-bold text-slate-800 block">Política ante Registros Duplicados</span>
              <p className="text-[11px] text-slate-500 leading-normal">
                Si un ID de expediente ya se encuentra registrado en el sistema, define la acción que tomará el cargador lógico:
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <label className="flex items-start gap-2 bg-white border border-slate-150 p-2.5 rounded-xl cursor-pointer hover:border-emerald-300 hover:bg-emerald-50/10 transition-colors">
                  <input
                    type="radio"
                    name="duplicateAction"
                    value="skip"
                    checked={duplicateAction === "skip"}
                    onChange={() => setDuplicateAction("skip")}
                    className="mt-0.5 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                  />
                  <div className="space-y-0.5">
                    <span className="text-[11px] font-bold text-slate-700 block">Omitir duplicados</span>
                    <span className="text-[9.5px] text-slate-500 block">No importa la fila si el ID ya existe en el sistema.</span>
                  </div>
                </label>

                <label className="flex items-start gap-2 bg-white border border-slate-150 p-2.5 rounded-xl cursor-pointer hover:border-emerald-300 hover:bg-emerald-50/10 transition-colors">
                  <input
                    type="radio"
                    name="duplicateAction"
                    value="generateNew"
                    checked={duplicateAction === "generateNew"}
                    onChange={() => setDuplicateAction("generateNew")}
                    className="mt-0.5 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                  />
                  <div className="space-y-0.5">
                    <span className="text-[11px] font-bold text-slate-700 block">Forzar carga nueva</span>
                    <span className="text-[9.5px] text-slate-500 block">Genera un nuevo identificador único aleatorio para todos los casos.</span>
                  </div>
                </label>

                <label className="flex items-start gap-2 bg-white border border-slate-150 p-2.5 rounded-xl cursor-pointer hover:border-emerald-300 hover:bg-emerald-50/10 transition-colors">
                  <input
                    type="radio"
                    name="duplicateAction"
                    value="overwrite"
                    checked={duplicateAction === "overwrite"}
                    onChange={() => setDuplicateAction("overwrite")}
                    className="mt-0.5 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                  />
                  <div className="space-y-0.5">
                    <span className="text-[11px] font-bold text-slate-700 block">Actualizar / Sobrescribir</span>
                    <span className="text-[9.5px] text-slate-500 block">Busca el expediente por ID y actualiza su historial con los nuevos datos.</span>
                  </div>
                </label>
              </div>
            </div>

            {/* Mappings grid matches */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              
              {/* Core fields mapping */}
              <div>
                <label className="block text-[11px] font-bold text-slate-500 mb-1">ID Paciente / Código Expediente *</label>
                <select
                  value={mappings.id}
                  onChange={(e) => handleUpdateMapping("id", parseInt(e.target.value, 10))}
                  className="w-full text-slate-800 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs focus:ring-1 focus:ring-emerald-500 cursor-pointer"
                >
                  <option value={-1}>[Generar ID Automático]</option>
                  {availableColumns.map(col => (
                    <option key={col.index} value={col.index}>{col.headerValue}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-500 mb-1">Nombre Paciente *</label>
                <select
                  value={mappings.nombre}
                  onChange={(e) => handleUpdateMapping("nombre", parseInt(e.target.value, 10))}
                  className="w-full text-slate-800 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs focus:ring-1 focus:ring-emerald-500 cursor-pointer"
                >
                  <option value={-1}>[Ninguno - Saltará registro]</option>
                  {availableColumns.map(col => (
                    <option key={col.index} value={col.index}>{col.headerValue}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-500 mb-1">Apellido Paciente</label>
                <select
                  value={mappings.apellido}
                  onChange={(e) => handleUpdateMapping("apellido", parseInt(e.target.value, 10))}
                  className="w-full text-slate-800 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs focus:ring-1 focus:ring-emerald-500 cursor-pointer"
                >
                  <option value={-1}>[Sin Apellidos / Dejar Vacío]</option>
                  {availableColumns.map(col => (
                    <option key={col.index} value={col.index}>{col.headerValue}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-500 mb-1">Fianza PJS (Miembro)</label>
                <select
                  value={mappings.pjs}
                  onChange={(e) => handleUpdateMapping("pjs", parseInt(e.target.value, 10))}
                  className="w-full text-slate-800 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs focus:ring-1 focus:ring-emerald-500 cursor-pointer"
                >
                  <option value={-1}>[Particular / Dejar Vacío]</option>
                  {availableColumns.map(col => (
                    <option key={col.index} value={col.index}>{col.headerValue}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-500 mb-1">Ciudad / Sede</label>
                <select
                  value={mappings.ciudad}
                  onChange={(e) => handleUpdateMapping("ciudad", parseInt(e.target.value, 10))}
                  className="w-full text-slate-800 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs focus:ring-1 focus:ring-emerald-500 cursor-pointer"
                >
                  <option value={-1}>[Dejar Vacío / "Lima" por defecto]</option>
                  {availableColumns.map(col => (
                    <option key={col.index} value={col.index}>{col.headerValue}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-500 mb-1">Médico Tratante</label>
                <select
                  value={mappings.medico}
                  onChange={(e) => handleUpdateMapping("medico", parseInt(e.target.value, 10))}
                  className="w-full text-slate-800 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs focus:ring-1 focus:ring-emerald-500 cursor-pointer"
                >
                  <option value={-1}>[Dejar Vacío / Sin Asignar]</option>
                  {availableColumns.map(col => (
                    <option key={col.index} value={col.index}>{col.headerValue}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-500 mb-1">Aseguradora</label>
                <select
                  value={mappings.aseguradora}
                  onChange={(e) => handleUpdateMapping("aseguradora", parseInt(e.target.value, 10))}
                  className="w-full text-slate-800 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs focus:ring-1 focus:ring-emerald-500 cursor-pointer"
                >
                  <option value={-1}>[Dejar Vacío / Sin Seguro]</option>
                  {availableColumns.map(col => (
                    <option key={col.index} value={col.index}>{col.headerValue}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-500 mb-1">Sector (Público/Privado)</label>
                <select
                  value={mappings.sector}
                  onChange={(e) => handleUpdateMapping("sector", parseInt(e.target.value, 10))}
                  className="w-full text-slate-800 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs focus:ring-1 focus:ring-emerald-500 cursor-pointer"
                >
                  <option value={-1}>[Privado por defecto]</option>
                  {availableColumns.map(col => (
                    <option key={col.index} value={col.index}>{col.headerValue}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-500 mb-1">Institución Médica</label>
                <select
                  value={mappings.institucion}
                  onChange={(e) => handleUpdateMapping("institucion", parseInt(e.target.value, 10))}
                  className="w-full text-slate-800 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs focus:ring-1 focus:ring-emerald-500 cursor-pointer"
                >
                  <option value={-1}>[Sin Especializar]</option>
                  {availableColumns.map(col => (
                    <option key={col.index} value={col.index}>{col.headerValue}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-500 mb-1">Dispensación (Canal)</label>
                <select
                  value={mappings.dispensacion}
                  onChange={(e) => handleUpdateMapping("dispensacion", parseInt(e.target.value, 10))}
                  className="w-full text-slate-800 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs focus:ring-1 focus:ring-emerald-500 cursor-pointer"
                >
                  <option value={-1}>[Dejar Vacío]</option>
                  {availableColumns.map(col => (
                    <option key={col.index} value={col.index}>{col.headerValue}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-500 mb-1">Distribuidor</label>
                <select
                  value={mappings.distribuidor}
                  onChange={(e) => handleUpdateMapping("distribuidor", parseInt(e.target.value, 10))}
                  className="w-full text-slate-800 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs focus:ring-1 focus:ring-emerald-500 cursor-pointer"
                >
                  <option value={-1}>[Dejar Vacío]</option>
                  {availableColumns.map(col => (
                    <option key={col.index} value={col.index}>{col.headerValue}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-500 mb-1">Indicación Diagnóstica</label>
                <select
                  value={mappings.indicacion}
                  onChange={(e) => handleUpdateMapping("indicacion", parseInt(e.target.value, 10))}
                  className="w-full text-slate-800 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs focus:ring-1 focus:ring-emerald-500 cursor-pointer"
                >
                  <option value={-1}>[Dejar Vacío]</option>
                  {availableColumns.map(col => (
                    <option key={col.index} value={col.index}>{col.headerValue}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-500 mb-1">Concentración / Dosis</label>
                <select
                  value={mappings.dosis}
                  onChange={(e) => handleUpdateMapping("dosis", parseInt(e.target.value, 10))}
                  className="w-full text-slate-800 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs focus:ring-1 focus:ring-emerald-500 cursor-pointer"
                >
                  <option value={-1}>[Dejar Vacío]</option>
                  {availableColumns.map(col => (
                    <option key={col.index} value={col.index}>{col.headerValue}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-500 mb-1">Línea de Tratamiento</label>
                <select
                  value={mappings.lineaTratamiento}
                  onChange={(e) => handleUpdateMapping("lineaTratamiento", parseInt(e.target.value, 10))}
                  className="w-full text-slate-800 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs focus:ring-1 focus:ring-emerald-500 cursor-pointer"
                >
                  <option value={-1}>[Dejar Vacío]</option>
                  {availableColumns.map(col => (
                    <option key={col.index} value={col.index}>{col.headerValue}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[#b45309] mb-1">Fecha de Ingreso (DD/MM/AAAA) *</label>
                <select
                  value={mappings.fechaIngreso}
                  onChange={(e) => handleUpdateMapping("fechaIngreso", parseInt(e.target.value, 10))}
                  className="w-full text-amber-900 bg-amber-50/50 border border-amber-200 rounded-lg px-2.5 py-1.5 text-xs focus:ring-1 focus:ring-amber-500 cursor-pointer"
                >
                  <option value={-1}>[Hoy por defecto]</option>
                  {availableColumns.map(col => (
                    <option key={col.index} value={col.index}>{col.headerValue}</option>
                  ))}
                </select>
              </div>

            </div>

            {/* Preview of Grid */}
            <div className="bg-slate-50/70 border border-slate-200/80 rounded-xl p-4 overflow-x-auto">
              <span className="text-[10px] font-bold text-slate-400 capitalize block mb-2 tracking-wide font-mono">Previsualización de datos (5 Primeras Filas)</span>
              <table className="min-w-full divide-y divide-slate-150 text-[11px] text-slate-700">
                <thead>
                  <tr className="divide-x divide-slate-150">
                    {availableColumns.map(col => (
                      <th key={col.index} className="px-3 py-1 bg-slate-100 font-semibold text-slate-600 text-left">
                        {col.headerValue}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-150">
                  {previewRows.map((row, rIdx) => (
                    <tr key={rIdx} className="divide-x divide-slate-150 bg-white">
                      {row.map((cell, cIdx) => (
                        <td key={cIdx} className="px-3 py-1 font-mono text-slate-500 whitespace-nowrap">
                          {cell || "—"}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Actions for importing */}
            <div className="flex justify-end gap-3 border-t border-slate-100 pt-5">
              <button
                type="button"
                onClick={() => setImportStep("input")}
                className="px-4 py-2 border border-slate-250 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-xl cursor-pointer"
              >
                Volver
              </button>
              
              <button
                type="button"
                onClick={handleProceedImport}
                className="px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-md transition-all flex items-center gap-2 cursor-pointer"
              >
                <Layers className="h-4 w-4" />
                Ejecutar Importación Masiva
              </button>
            </div>

          </div>
        )}

        {importStep === "processing" && (
          <div className="bg-white border border-slate-150 rounded-2xl p-16 shadow-xs flex flex-col items-center justify-center space-y-4 text-center">
            <RefreshCw className="h-10 w-10 text-emerald-600 animate-spin" />
            <h3 className="font-bold text-slate-800 text-base">Cargando registros médicos y catálogos...</h3>
            <p className="text-xs text-slate-500 max-w-sm">
              Esto puede tardar unos segundos. Estamos sincronizando las filas y auto-completando cualquier ciudad, institución o médico nuevo detectado en la nube.
            </p>
          </div>
        )}

        {importStep === "success" && (
          <div className="bg-white border border-slate-150 rounded-2xl p-8 shadow-xs space-y-6 animate-fade-in text-center flex flex-col items-center">
            <div className="bg-emerald-50 h-14 w-14 rounded-full flex items-center justify-center border border-emerald-150 border-dashed animate-pulse">
              <CheckCircle2 className="h-8 w-8 text-emerald-600" />
            </div>
            
            <div className="space-y-1">
              <h3 className="font-bold text-slate-800 text-lg">¡Operación Completada con Éxito!</h3>
              <p className="text-xs text-slate-500">
                La información se ha estructurado y sincronizado en la base de datos distribuida.
              </p>
            </div>

            {/* Metrics stats block */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 w-full max-w-lg mt-3">
              <div className="bg-slate-50 border border-slate-100 rounded-xl p-3 text-center">
                <span className="block text-[10px] text-slate-400 font-bold uppercase tracking-wider">Filas Leídas</span>
                <span className="text-lg font-extrabold text-slate-800 font-mono">{importStats.totalRows}</span>
              </div>
              <div className="bg-emerald-50/50 border border-emerald-100 rounded-xl p-3 text-center">
                <span className="block text-[10px] text-emerald-700 font-bold uppercase tracking-wider">Creados/Cargados</span>
                <span className="text-lg font-extrabold text-emerald-700 font-mono">+{importStats.successfullyImported}</span>
              </div>
              <div className="bg-amber-50/50 border border-amber-100 rounded-xl p-3 text-center">
                <span className="block text-[10px] text-amber-700 font-bold uppercase tracking-wider">Omitidos/Duplicados</span>
                <span className="text-lg font-extrabold text-amber-700 font-mono">{importStats.duplicatesSkipped}</span>
              </div>
              <div className="bg-indigo-50/50 border border-indigo-100 rounded-xl p-3 text-center">
                <span className="block text-[10px] text-indigo-700 font-bold uppercase tracking-wider">Nuevos Catálogos</span>
                <span className="text-lg font-extrabold text-indigo-700 font-mono">+{importStats.createdLookups}</span>
              </div>
            </div>

            {importStats.errors.length > 0 && (
              <div className="w-full max-w-lg bg-red-50/50 border border-red-150 p-4 rounded-xl text-left space-y-2">
                <span className="text-[10px] font-bold text-red-700 flex items-center gap-1">
                  <AlertCircle className="h-3.5 w-3.5" />
                  Alertas registradas durante la carga:
                </span>
                <div className="max-h-24 overflow-y-auto text-[10px] font-mono text-red-650 divide-y divide-red-100/50">
                  {importStats.errors.map((err, idx) => (
                    <p key={idx} className="py-1">{err}</p>
                  ))}
                </div>
              </div>
            )}

            <button
              onClick={() => setImportStep("input")}
              className="px-6 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer"
            >
              Cargar Otro Lote de Datos
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
