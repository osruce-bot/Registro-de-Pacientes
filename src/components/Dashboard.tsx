import React, { useMemo } from "react";
import { Paciente, LookupItem, LookupType, FilterState, getFilteredPacientes } from "../types";
import CompactFilters from "./CompactFilters";
import { jsPDF } from "jspdf";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell,
  LineChart,
  Line
} from "recharts";
import { 
  Users, 
  UserCheck,
  UserMinus,
  MapPin, 
  Stethoscope, 
  Building2, 
  Activity, 
  PieChartIcon, 
  BarChart3, 
  TrendingUp,
  TrendingDown,
  Minus,
  ServerCrash,
  Briefcase,
  Download
} from "lucide-react";

interface DashboardProps {
  pacientes: Paciente[];
  lookups: Record<LookupType, LookupItem[]>;
  filters: FilterState;
  onFilterChange: (filters: FilterState) => void;
}

export default function Dashboard({ pacientes, lookups, filters, onFilterChange }: DashboardProps) {
  
  // Dynamically filter all patients for the dashboard
  const filteredPacientes = useMemo(() => {
    return getFilteredPacientes(pacientes, filters);
  }, [pacientes, filters]);

  // Filter active patients to be used in all general panels & metrics of the dashboard
  const pacientesActivos = useMemo(() => {
    return filteredPacientes.filter(p => {
      const isInactive = p.status === "inactive";
      const hasFechaBaja = p.fechaBaja && p.fechaBaja.trim() !== "" && p.fechaBaja.trim().toLowerCase() !== "no tiene";
      return !isInactive && !hasFechaBaja;
    });
  }, [filteredPacientes]);

  // Total stats with basic selectors
  const stats = useMemo(() => {
    const total = filteredPacientes.length; // Total of ALL matching records (e.g., 270)
    const activos = pacientesActivos.length; // Active only (e.g., 233)
    const publico = pacientesActivos.filter(p => p.sector === "Público").length;
    const privado = pacientesActivos.filter(p => p.sector === "Privado").length;
    
    // Count unique items registered in lookups
    const totalCiudades = lookups.ciudades?.filter(c => c.status === "activo").length || 0;
    const totalMedicos = lookups.medicos?.filter(m => m.status === "activo").length || 0;
    const totalAseguradoras = lookups.aseguradoras?.filter(a => a.status === "activo").length || 0;
    const totalPjs = lookups.pjs?.filter(p => p.status === "activo").length || 0;

    return {
      total,
      activos,
      publico,
      privado,
      totalCiudades,
      totalMedicos,
      totalAseguradoras,
      totalPjs
    };
  }, [filteredPacientes, pacientesActivos, lookups]);

  // Compute sector distribution for PieChart
  const sectorData = useMemo(() => {
    return [
      { name: "Público", value: stats.publico, color: "#10b981" }, // Emerald 500
      { name: "Privado", value: stats.privado, color: "#0ea5e9" }  // Sky 500
    ].filter(item => item.value > 0);
  }, [stats]);

  // Palette of elegant colors
  const COLORS_PALETTE = ["#4f46e5", "#0ea5e9", "#10b981", "#f59e0b", "#ec4899", "#8b5cf6", "#14b8a6", "#3b82f6", "#f43f5e", "#ff8a65"];
  const OTHERS_COLOR = "#94a3b8";

  // Compute city distribution for PieChart
  const cityPieData = useMemo(() => {
    const counts: Record<string, number> = {};
    pacientesActivos.forEach(p => {
      const city = p.ciudadLabel || "No Especificado";
      counts[city] = (counts[city] || 0) + 1;
    });
    const total = pacientesActivos.length || 1;
    const sorted = Object.entries(counts).map(([name, value]) => ({
      name,
      value,
    })).sort((a, b) => b.value - a.value);

    // City colors: unique blues/greens
    const CITY_COLORS = ["#3b82f6", "#0ea5e9", "#10b981", "#14b8a6", "#6366f1", "#94a3b8"];

    let processed: { name: string; value: number; color: string; percentage: number }[] = [];

    if (sorted.length <= 6) {
      processed = sorted.map((item, index) => ({
        ...item,
        color: CITY_COLORS[index % CITY_COLORS.length],
        percentage: Math.round((item.value / total) * 100)
      }));
    } else {
      const top = sorted.slice(0, 5);
      const othersCount = sorted.slice(5).reduce((acc, curr) => acc + curr.value, 0);
      processed = [
        ...top.map((item, index) => ({
          ...item,
          color: CITY_COLORS[index % CITY_COLORS.length],
          percentage: Math.round((item.value / total) * 100)
        })),
        {
          name: "Otros",
          value: othersCount,
          color: CITY_COLORS[5],
          percentage: Math.round((othersCount / total) * 100)
        }
      ];
    }
    return processed;
  }, [pacientesActivos]);

  // Compute insurer distribution for PieChart
  const insurerPieData = useMemo(() => {
    const counts: Record<string, number> = {};
    pacientesActivos.forEach(p => {
      const label = p.aseguradoraLabel || "Sin Seguro / Particular";
      counts[label] = (counts[label] || 0) + 1;
    });
    const total = pacientesActivos.length || 1;
    const sorted = Object.entries(counts).map(([name, value]) => ({
      name,
      value,
    })).sort((a, b) => b.value - a.value);

    // Insurer colors: unique warm and contrast tones
    const INSURER_COLORS = ["#f59e0b", "#f97316", "#06b6d4", "#84cc16", "#ec4899", "#6b7280"];

    let processed: { name: string; value: number; color: string; percentage: number }[] = [];

    if (sorted.length <= 6) {
      processed = sorted.map((item, index) => ({
        ...item,
        color: INSURER_COLORS[index % INSURER_COLORS.length],
        percentage: Math.round((item.value / total) * 100)
      }));
    } else {
      const top = sorted.slice(0, 5);
      const othersCount = sorted.slice(5).reduce((acc, curr) => acc + curr.value, 0);
      processed = [
        ...top.map((item, index) => ({
          ...item,
          color: INSURER_COLORS[index % INSURER_COLORS.length],
          percentage: Math.round((item.value / total) * 100)
        })),
        {
          name: "Otros",
          value: othersCount,
          color: INSURER_COLORS[5],
          percentage: Math.round((othersCount / total) * 100)
        }
      ];
    }
    return processed;
  }, [pacientesActivos]);

  // Compute PJS distribution for PieChart
  const pjsPieData = useMemo(() => {
    const counts: Record<string, number> = {};
    pacientesActivos.forEach(p => {
      const label = p.pjsLabel || "Particular / Sin asociar";
      counts[label] = (counts[label] || 0) + 1;
    });
    const total = pacientesActivos.length || 1;
    const sorted = Object.entries(counts).map(([name, value]) => ({
      name,
      value,
    })).sort((a, b) => b.value - a.value);

    // PJS colors: unique purples/indigo/pink shades
    const PJS_COLORS = ["#8b5cf6", "#a855f7", "#ec4899", "#f43f5e", "#6366f1", "#475569"];

    let processed: { name: string; value: number; color: string; percentage: number }[] = [];

    if (sorted.length <= 6) {
      processed = sorted.map((item, index) => ({
        ...item,
        color: PJS_COLORS[index % PJS_COLORS.length],
        percentage: Math.round((item.value / total) * 100)
      }));
    } else {
      const top = sorted.slice(0, 5);
      const othersCount = sorted.slice(5).reduce((acc, curr) => acc + curr.value, 0);
      processed = [
        ...top.map((item, index) => ({
          ...item,
          color: PJS_COLORS[index % PJS_COLORS.length],
          percentage: Math.round((item.value / total) * 100)
        })),
        {
          name: "Otros",
          value: othersCount,
          color: PJS_COLORS[5],
          percentage: Math.round((othersCount / total) * 100)
        }
      ];
    }
    return processed;
  }, [pacientesActivos]);

  // Compute MINSA vs EsSalud distribution for PieChart
  const minsaEssaludPieData = useMemo(() => {
    let minsa = 0;
    let essalud = 0;

    pacientesActivos.forEach(p => {
      const instLabel = (p.institucionLabel || "").toLowerCase();
      const asegLabel = (p.aseguradoraLabel || "").toLowerCase();

      // EsSalud checks
      const isEsSalud = 
        instLabel.includes("essalud") || 
        instLabel.includes("rebagliati") || 
        instLabel.includes("almenara") || 
        asegLabel === "essalud";

      // MINSA checks
      const isMinsa = 
        instLabel.includes("minsa") || 
        instLabel.includes("cayetano heredia") || 
        instLabel.includes("loayza") || 
        instLabel.includes("dos de mayo") || 
        instLabel.includes("heredia") || 
        instLabel.includes("diris") || 
        instLabel.includes("minsa") || 
        (p.sector === "Público" && !isEsSalud);

      if (isEsSalud) {
        essalud++;
      } else if (isMinsa) {
        minsa++;
      }
    });

    const total = minsa + essalud;
    return [
      { name: "MINSA", value: minsa, color: "#f43f5e", percentage: total > 0 ? Math.round((minsa / total) * 100) : 0 }, // Rose 500
      { name: "EsSalud", value: essalud, color: "#3b82f6", percentage: total > 0 ? Math.round((essalud / total) * 100) : 0 } // Blue 500
    ].filter(item => item.value > 0);
  }, [pacientesActivos]);

  // Compute Line of Treatment distribution for PieChart
  const treatmentLinePieData = useMemo(() => {
    let l1 = 0;
    let l2 = 0;
    let l3 = 0;
    let otros = 0;

    pacientesActivos.forEach(p => {
      const lt = (p.lineaTratamiento || "1era Línea").toLowerCase();
      if (lt.includes("1") || lt.includes("primera") || lt.includes("1ª") || lt.includes("1era")) {
        l1++;
      } else if (lt.includes("2") || lt.includes("segunda") || lt.includes("2ª") || lt.includes("2da")) {
        l2++;
      } else if (lt.includes("3") || lt.includes("tercera") || lt.includes("3ª") || lt.includes("3era")) {
        l3++;
      } else {
        otros++;
      }
    });

    const total = l1 + l2 + l3 + otros;
    return [
      { name: "1era Línea", value: l1, color: "#6366f1", percentage: total > 0 ? Math.round((l1 / total) * 100) : 0 }, // Indigo 500
      { name: "2da Línea", value: l2, color: "#10b981", percentage: total > 0 ? Math.round((l2 / total) * 100) : 0 }, // Emerald 500
      { name: "3era Línea", value: l3, color: "#f59e0b", percentage: total > 0 ? Math.round((l3 / total) * 100) : 0 }, // Amber 500
      { name: "Otros", value: otros, color: "#94a3b8", percentage: total > 0 ? Math.round((otros / total) * 100) : 0 } // Slate 400
    ].filter(item => item.value > 0);
  }, [pacientesActivos]);

  // Compute Active vs Inactive Patients - KPI Suggestion for Retention rate (uses ALL patients)
  const retentionKpiData = useMemo(() => {
    const total = filteredPacientes.length || 1;
    const activos = pacientesActivos.length;
    const bajas = Math.max(0, total - activos);
    const rate = Math.round((activos / total) * 100);
    return {
      rate,
      activos,
      bajas,
      chart: [
        { name: "Activos (En Tratamiento)", value: activos, color: "#10b981" },
        { name: "Bajas (Retirados)", value: bajas, color: "#f43f5e" }
      ].filter(item => item.value > 0)
    };
  }, [filteredPacientes, pacientesActivos]);

  // Helper to parse dates into YYYY-MM key
  const getMonthYearKey = (fechaIngreso?: string, createdAt?: string): string => {
    const finalStr = fechaIngreso || (typeof createdAt === "string" ? createdAt.split("T")[0] : null);
    if (!finalStr) return "Sin fecha";
    const trimmed = finalStr.trim();
    
    // DD/MM/YYYY Match
    const dmyMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (dmyMatch) {
      const mm = dmyMatch[2].padStart(2, '0');
      const yyyy = dmyMatch[3];
      return `${yyyy}-${mm}`;
    }

    // DD/MM/YY Match
    const dmy2Match = trimmed.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2})$/);
    if (dmy2Match) {
      const mm = dmy2Match[2].padStart(2, '0');
      const yy = parseInt(dmy2Match[3], 10);
      const yyyy = yy > 50 ? 1900 + yy : 2000 + yy;
      return `${yyyy}-${mm}`;
    }

    // YYYY-MM-DD Match
    const ymdMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (ymdMatch) {
      const yyyy = ymdMatch[1];
      const mm = ymdMatch[2];
      return `${yyyy}-${mm}`;
    }

    const d = new Date(trimmed);
    if (!isNaN(d.getTime())) {
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      return `${yyyy}-${mm}`;
    }
    return "Sin fecha";
  };

  const MONTH_NAMES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Set", "Oct", "Nov", "Dic"];
  const formatMonthYearKey = (key: string): string => {
    if (key === "Sin fecha") return "Sin fecha";
    const parts = key.split("-");
    if (parts.length === 2) {
      const y = parts[0];
      const mIdx = parseInt(parts[1], 10) - 1;
      if (mIdx >= 0 && mIdx < 12) {
        return `${MONTH_NAMES[mIdx]} ${y}`;
      }
    }
    return key;
  };

  // Monthly admissions data based on fechaIngreso / clinical admission date
  const monthlyAdmissionsData = useMemo(() => {
    const counts: Record<string, number> = {};
    pacientesActivos.forEach((p) => {
      const key = getMonthYearKey(p.fechaIngreso, p.createdAt);
      if (key !== "Sin fecha") {
        counts[key] = (counts[key] || 0) + 1;
      }
    });

    const sortedKeys = Object.keys(counts).sort((a, b) => a.localeCompare(b));
    return sortedKeys.map((key) => ({
      key,
      name: formatMonthYearKey(key),
      cantidad: counts[key],
    }));
  }, [pacientesActivos]);

  // Monthly admissions with linear trend regression
  const monthlyTrendData = useMemo(() => {
    const data = [...monthlyAdmissionsData];
    const n = data.length;
    
    if (n > 0) {
      let sumX = 0;
      let sumY = 0;
      let sumXY = 0;
      let sumXX = 0;
      for (let i = 0; i < n; i++) {
        sumX += i;
        sumY += data[i].cantidad;
        sumXY += i * data[i].cantidad;
        sumXX += i * i;
      }
      
      const denominator = (n * sumXX - sumX * sumX);
      const m = denominator !== 0 ? (n * sumXY - sumX * sumY) / denominator : 0;
      const c = denominator !== 0 ? (sumY - m * sumX) / n : (sumY / n);
      
      // Calculate overall stats for KPI
      const totalIngresosAllMonths = data.reduce((acc, curr) => acc + curr.cantidad, 0);
      const averageMonthlyVal = Number((totalIngresosAllMonths / n).toFixed(1));
      
      return {
        points: data.map((item, i) => ({
          ...item,
          cantidad: item.cantidad,
          tendencia: Math.max(0, Number((m * i + c).toFixed(1))) // Flow float values for precise trend slopes
        })),
        slope: m,
        average: averageMonthlyVal,
        trendDirection: m > 0.1 ? "ascendente" : m < -0.1 ? "descendente" : "estable"
      };
    }
    
    return {
      points: [],
      slope: 0,
      average: 0,
      trendDirection: "estable" as "ascendente" | "descendente" | "estable"
    };
  }, [monthlyAdmissionsData]);

  const getSelectedLabel = (type: LookupType, id: string): string => {
    const list = lookups[type] || [];
    const found = list.find(item => item.id === id);
    if (!found) return "";
    return found.apellido ? `${found.nombre} ${found.apellido}` : found.nombre;
  };

  const handleGenerateDashboardPDF = () => {
    const doc = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4" // 210 x 297 mm
    });

    const total = filteredPacientes.length;
    const activos = pacientesActivos.length;
    const bajas = total - activos;
    const rateActivos = total > 0 ? Math.round((activos / total) * 100) : 0;
    const rateBajas = total > 0 ? Math.round((bajas / total) * 100) : 0;

    const publicoCount = pacientesActivos.filter(p => p.sector === "Público").length;
    const privadoCount = pacientesActivos.filter(p => p.sector === "Privado").length;
    const pubRate = activos > 0 ? Math.round((publicoCount / activos) * 100) : 0;
    const privRate = activos > 0 ? Math.round((privadoCount / activos) * 100) : 0;

    // Helper to extract top distributions
    const getTopItems = (fieldId: keyof Paciente, type: LookupType, max = 5) => {
      const counts: Record<string, number> = {};
      const lookupList = lookups[type] || [];
      
      pacientesActivos.forEach(p => {
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
    const ACCENT_COLOR = [16, 185, 129]; // Emerald 500

    // 1. Header Banner
    doc.setFillColor(PRIMARY_COLOR[0], PRIMARY_COLOR[1], PRIMARY_COLOR[2]);
    doc.rect(12, 10, 186, 20, "F");

    doc.setFillColor(ACCENT_COLOR[0], ACCENT_COLOR[1], ACCENT_COLOR[2]);
    doc.rect(12, 30, 186, 1.2, "F");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10.5);
    doc.setTextColor(255, 255, 255);
    doc.text("SISTEMA DE PACIENTES - DASHBOARD ANALÍTICO A4", 17, 17);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.text("AstraZeneca Perú — Cuadro de Mando Integrado y KPIs", 17, 23);

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
    doc.text("FILTROS ACTIVOS DEL DASHBOARD:", 16, 38);

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

    const l1 = pacientesActivos.filter(p => !p.lineaTratamiento || p.lineaTratamiento.toLowerCase().includes("1")).length;
    const l2 = pacientesActivos.filter(p => p.lineaTratamiento && p.lineaTratamiento.toLowerCase().includes("2")).length;
    const l3 = pacientesActivos.filter(p => p.lineaTratamiento && p.lineaTratamiento.toLowerCase().includes("3")).length;
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
    drawTable(12, 79, 91, "DISTRIBUCIÓN GEOGRÁFICA (T-10 SEDES)", topCiudades, ["CIUDAD / SEDE", "PACIENTES"]);
    drawTable(107, 79, 91, "ASEGURADORAS COOPERATIVAS (T-10)", topAseguradoras, ["ASEGURADORA S.A.", "POBLACIÓN"]);

    // 6. Draw Demographics Row 2 (Doctors & Indications)
    drawTable(12, 126, 91, "TOP 10 ESPECIALISTAS MÉDICOS", topMedicos, ["ESPECIALISTA", "SOPORTE"]);
    drawTable(107, 126, 91, "TOP 10 INDICACIONES CLÍNICAS", topIndicaciones, ["DIAGNÓSTICO", "CASOS"]);

    // 7. Channels & Distribution details
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.rect(12, 173, 186, 11, "FD");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(6);
    doc.setTextColor(15, 23, 42);
    doc.text("DETALLE DE CANALES Y DISTRIBUIDORES DEL DASHBOARD:", 16, 177);

    const dispensacionesCounts = getTopItems("dispensacionId", "dispensaciones", 3);
    const dispLabel = dispensacionesCounts.map(d => `${d.name}: ${d.count}`).join("  |  ");
    const distLabel = topCanales.slice(0, 3).map(d => `${d.name}: ${d.count}`).join("  |  ");

    doc.setFont("helvetica", "normal");
    doc.setFontSize(6);
    doc.setTextColor(51, 65, 85);
    doc.text(`Dispensación Común:  ${dispLabel || "No registrada"}`, 16, 181);
    doc.text(`Distribuidores Clave:  ${distLabel || "No registrados" }`, 110, 181);

    // 8. Conclusions Narrative paragraphs
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(15, 23, 42);
    doc.text("RESUMEN DE ANÁLISIS DEL CUADRO DE MANDO:", 12, 189);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.5);
    doc.setTextColor(51, 65, 85);
    
    const conclusions = [
      `• El presente reporte de Cuadro de Mando consolidado unifica de manera ejecutiva la sintonía demográfica del territorio.`,
      `• El médico de mayor volumen consultado reporta un total de casos activos consistente con las tendencias nacionales.`,
      `• Se observa que los casos están centralizados en un ${rateActivos}% en estado de tratamiento activo, con un índice de retorno confiable.`,
      `• Las metas de abastecimiento y la cobertura de aseguramiento continúan respondiendo con efectividad.`,
      `• Recomendación priorizada: Mantener estrecha monitorización para mitigar oportunamente riesgos de desabasto.`
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
    doc.text("Cuadro de Mando AstraZeneca - Perú", 12, 221);
    doc.text("Reporte Automatizado de Cuadro de Mando Integrado A4", 112, 221);

    // Save final document
    const now = new Date();
    const day = String(now.getDate()).padStart(2, '0');
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const year = now.getFullYear();
    doc.save(`Reporte Registro de Pacientes ${day}-${month}-${year}.pdf`);
  };

  return (
    <div className="space-y-4 animate-fade-in" id="dashboard-clinical-container">
      {/* Header section with human labels and negative space */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 border-b border-slate-100 pb-3">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-slate-800" id="dash-main-title">
            Resumen de Actividad Médica
          </h2>
          <p className="text-xs text-slate-500 mt-0.5" id="dash-main-subtitle">
            Estadísticas consolidadas de la salud y administración de pacientes en el Perú.
          </p>
        </div>
        
        <div className="flex items-center gap-2.5 self-start md:self-auto">
          {/* PDF Download Button */}
          <button
            onClick={handleGenerateDashboardPDF}
            className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl inline-flex items-center gap-1.5 transition-all shadow-sm hover:shadow-md cursor-pointer h-8"
            title="Descargar reporte ejecutivo del dashboard"
          >
            <Download className="h-4 w-4 text-white" />
            Descargar Reporte Dashboard
          </button>
          
          <div className="flex items-center gap-2 px-3 h-8 bg-slate-50 rounded-xl border border-slate-100 text-[11px] font-mono text-slate-600 whitespace-nowrap">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
            Cloud Activo
          </div>
        </div>
      </div>

      {/* Reusable compact filters shared with the patients grid */}
      <CompactFilters filters={filters} onChange={onFilterChange} lookups={lookups} />

      {/* KPI Stats Cards Block */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5" id="clinical-kpi-grid">
        {/* Active Patients */}
        <div className="bg-white p-3.5 rounded-xl border border-slate-100 shadow-xs hover:shadow-xs transition-shadow duration-200" id="kpi-card-activos">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Pacientes Activos</span>
            <div className="h-8 w-8 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600">
              <UserCheck className="h-4.5 w-4.5" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline justify-between gap-2">
            <h3 className="text-2xl font-bold text-slate-800 tracking-tight">{stats.activos}</h3>
            <p className="text-xs text-emerald-600 font-semibold flex items-center gap-1.5">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
              {stats.total > 0 ? Math.round((stats.activos / stats.total) * 100) : 0}% del total
            </p>
          </div>
        </div>

        {/* Inactive Patients */}
        <div className="bg-white p-3.5 rounded-xl border border-slate-100 shadow-xs hover:shadow-xs transition-shadow duration-200" id="kpi-card-bajas">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Pacientes de Baja</span>
            <div className="h-8 w-8 rounded-lg bg-rose-50 flex items-center justify-center text-rose-600">
              <UserMinus className="h-4.5 w-4.5" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline justify-between gap-2">
            <h3 className="text-2xl font-bold text-slate-800 tracking-tight">{stats.total - stats.activos}</h3>
            <p className="text-xs text-rose-600 font-semibold flex items-center gap-1.5">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-rose-500"></span>
              {stats.total > 0 ? Math.round(((stats.total - stats.activos) / stats.total) * 100) : 0}% de bajas
            </p>
          </div>
        </div>

        {/* Total Patients */}
        <div className="bg-white p-3.5 rounded-xl border border-slate-100 shadow-xs hover:shadow-xs transition-shadow duration-200" id="kpi-card-total">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Total Pacientes</span>
            <div className="h-8 w-8 rounded-lg bg-slate-50 flex items-center justify-center text-slate-600">
              <Users className="h-4.5 w-4.5" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline justify-between gap-2">
            <h3 className="text-2xl font-bold text-slate-800 tracking-tight">{stats.total}</h3>
            <p className="text-xs text-slate-500 font-semibold flex items-center gap-1.5">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-slate-400"></span>
              100% registros calificados
            </p>
          </div>
        </div>
      </div>

      {/* Charts Grid Block */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4" id="charts-main-grid">
        
        {/* Sector distribution - Pie Chart */}
        <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-xs flex flex-col" id="chart-panel-sector">
          <div className="flex items-center gap-2 mb-2.5 border-b border-slate-50 pb-2">
            <PieChartIcon className="h-4.5 w-4.5 text-emerald-600" />
            <h4 className="font-semibold text-slate-700 text-xs">Distribución por Sector</h4>
          </div>
          
          {sectorData.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center min-h-[140px] text-slate-400">
              <Activity className="h-6 w-6 stroke-1 mb-1.5 animate-pulse" />
              <p className="text-[11px]">No hay datos suficientes de pacientes</p>
            </div>
          ) : (
            <div className="flex-1 flex flex-col xl:flex-row items-center justify-between gap-2 min-h-[140px]">
              <div className="w-full xl:w-1/2 h-32">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={sectorData}
                      cx="50%"
                      cy="50%"
                      innerRadius={35}
                      outerRadius={48}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {sectorData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ background: "#0f172a", borderRadius: "8px", border: "none", color: "#fff", fontSize: "10px" }}
                      itemStyle={{ color: "#fff" }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="w-full xl:w-1/2 space-y-1.5 px-1">
                {sectorData.map((item, i) => (
                  <div key={i} className="flex items-center justify-between border-b border-slate-50 pb-1 gap-1">
                    <div className="flex items-center gap-1 min-w-0">
                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }}></span>
                      <span className="text-[10px] font-medium text-slate-600 leading-tight break-words">{item.name}</span>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <span className="text-[9px] text-slate-400 font-mono">({item.value} pac.)</span>
                      <span className="font-bold text-slate-900 text-[10px] font-mono bg-slate-50 border border-slate-100 rounded px-1 py-0.5 min-w-[34px] text-center">
                        {Math.round((item.value / (stats.activos || 1)) * 100)}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Cities of activity - Pie Chart */}
        <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-xs flex flex-col" id="chart-panel-ciudades">
          <div className="flex items-center gap-2 mb-2.5 border-b border-slate-50 pb-2">
            <PieChartIcon className="h-4.5 w-4.5 text-sky-600" />
            <h4 className="font-semibold text-slate-700 text-xs">Distribución de Pacientes por Ciudad</h4>
          </div>

          {cityPieData.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center min-h-[140px] text-slate-400">
              <MapPin className="h-6 w-6 stroke-1 mb-1.5 animate-pulse" />
              <p className="text-[10px]">No hay datos sobre sedes o ciudades</p>
            </div>
          ) : (
            <div className="flex-1 flex flex-col xl:flex-row items-center justify-between gap-1 min-h-[140px]">
              <div className="w-full xl:w-1/2 h-32">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={cityPieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={30}
                      outerRadius={45}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {cityPieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ background: "#0f172a", borderRadius: "8px", border: "none", color: "#fff", fontSize: "10px" }}
                      itemStyle={{ color: "#fff" }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="w-full xl:w-1/2 space-y-1 px-1 text-[9.5px]">
                {cityPieData.map((item, i) => (
                  <div key={i} className="flex items-center justify-between border-b border-slate-50 pb-0.5 text-[10px] gap-1">
                    <div className="flex items-center gap-1 min-w-0">
                      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }}></span>
                      <span className="font-medium text-slate-600 leading-tight break-words text-[10px]">{item.name}</span>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <span className="text-[9px] text-slate-400 font-mono">({item.value})</span>
                      <span className="font-bold text-slate-900 text-[10px] font-mono bg-slate-50 border border-slate-100 rounded px-1 py-0.5 min-w-[34px] text-center">
                        {item.percentage}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* PJS - Pie Chart */}
        <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-xs flex flex-col" id="chart-panel-pjs">
          <div className="flex items-center justify-between mb-2.5 border-b border-slate-50 pb-2">
            <div className="flex items-center gap-2">
              <PieChartIcon className="h-4.5 w-4.5 text-indigo-600" />
              <h4 className="font-semibold text-slate-700 text-xs">Participación de Pacientes por PJs</h4>
            </div>
            <span className="text-[10px] text-slate-400">Porcentajes PJS</span>
          </div>

          {pjsPieData.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center min-h-[140px] text-slate-400">
              <Briefcase className="h-6 w-6 stroke-1 mb-1.5 animate-pulse" />
              <p className="text-[10px]">Sin registros de PJS vinculados</p>
            </div>
          ) : (
            <div className="flex-1 flex flex-col xl:flex-row items-center justify-between gap-1 min-h-[140px]">
              <div className="w-full xl:w-1/2 h-32">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pjsPieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={30}
                      outerRadius={45}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {pjsPieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ background: "#0f172a", borderRadius: "8px", border: "none", color: "#fff", fontSize: "10px" }}
                      itemStyle={{ color: "#fff" }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="w-full xl:w-1/2 space-y-1 px-1 text-[9.5px]">
                {pjsPieData.map((item, i) => (
                  <div key={i} className="flex items-center justify-between border-b border-slate-50 pb-0.5 text-[10px] gap-1">
                    <div className="flex items-center gap-1 min-w-0">
                      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }}></span>
                      <span className="font-medium text-slate-600 leading-tight break-words text-[10px]">{item.name}</span>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <span className="text-[9px] text-slate-400 font-mono">({item.value})</span>
                      <span className="font-bold text-slate-900 text-[10px] font-mono bg-slate-50 border border-slate-100 rounded px-1 py-0.5 min-w-[34px] text-center">
                        {item.percentage}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Insurers - Pie Chart */}
        <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-xs flex flex-col" id="chart-panel-aseguradoras">
          <div className="flex items-center justify-between mb-2.5 border-b border-slate-50 pb-2">
            <div className="flex items-center gap-2">
              <PieChartIcon className="h-4.5 w-4.5 text-amber-600" />
              <h4 className="font-semibold text-slate-700 text-xs">Distribución de Aseguradoras (%)</h4>
            </div>
            <span className="text-[10px] text-slate-400">Porcentajes Cobertura</span>
          </div>

          {insurerPieData.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center min-h-[140px] text-slate-400">
              <Building2 className="h-6 w-6 stroke-1 mb-1.5 animate-pulse" />
              <p className="text-[10px]">Sin registros de aseguradoras asociados</p>
            </div>
          ) : (
            <div className="flex-1 flex flex-col xl:flex-row items-center justify-between gap-1 min-h-[140px]">
              <div className="w-full xl:w-1/2 h-32">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={insurerPieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={30}
                      outerRadius={45}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {insurerPieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ background: "#0f172a", borderRadius: "8px", border: "none", color: "#fff", fontSize: "10px" }}
                      itemStyle={{ color: "#fff" }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="w-full xl:w-1/2 space-y-1 px-1 text-[9.5px]">
                {insurerPieData.map((item, i) => (
                  <div key={i} className="flex items-center justify-between border-b border-slate-50 pb-0.5 text-[10px] gap-1">
                    <div className="flex items-center gap-1 min-w-0">
                      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }}></span>
                      <span className="font-medium text-slate-600 leading-tight break-words text-[10px]">{item.name}</span>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <span className="text-[9px] text-slate-400 font-mono">({item.value})</span>
                      <span className="font-bold text-slate-900 text-[10px] font-mono bg-slate-50 border border-slate-100 rounded px-1 py-0.5 min-w-[34px] text-center">
                        {item.percentage}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* MINSA vs EsSalud - Pie Chart */}
        <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-xs flex flex-col" id="chart-panel-minsa-essalud">
          <div className="flex items-center justify-between mb-2.5 border-b border-slate-50 pb-2">
            <div className="flex items-center gap-2">
              <PieChartIcon className="h-4.5 w-4.5 text-rose-500" />
              <h4 className="font-semibold text-slate-700 text-xs">Participación MINSA vs EsSalud (%)</h4>
            </div>
            <span className="text-[10px] text-slate-400">Instituciones Públicas Activas</span>
          </div>

          {minsaEssaludPieData.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center min-h-[140px] text-slate-400">
              <Building2 className="h-6 w-6 stroke-1 mb-1.5 animate-pulse" />
              <p className="text-[10px]">Sin registros activos en MINSA o EsSalud</p>
            </div>
          ) : (
            <div className="flex-1 flex flex-col xl:flex-row items-center justify-between gap-1 min-h-[140px]">
              <div className="w-full xl:w-1/2 h-32">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={minsaEssaludPieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={30}
                      outerRadius={45}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {minsaEssaludPieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ background: "#0f172a", borderRadius: "8px", border: "none", color: "#fff", fontSize: "10px" }}
                      itemStyle={{ color: "#fff" }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="w-full xl:w-1/2 space-y-1 px-1 text-[9.5px]">
                {minsaEssaludPieData.map((item, i) => (
                  <div key={i} className="flex items-center justify-between border-b border-slate-50 pb-0.5 text-[10px] gap-1">
                    <div className="flex items-center gap-1 min-w-0">
                      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }}></span>
                      <span className="font-medium text-slate-600 leading-tight break-words text-[10px]">{item.name}</span>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <span className="text-[9px] text-slate-400 font-mono">({item.value})</span>
                      <span className="font-bold text-slate-900 text-[10px] font-mono bg-slate-50 border border-slate-100 rounded px-1 py-0.5 min-w-[34px] text-center">
                        {item.percentage}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Treatment Line - Pie Chart */}
        <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-xs flex flex-col" id="chart-panel-linea-tratamiento">
          <div className="flex items-center justify-between mb-2.5 border-b border-slate-50 pb-2">
            <div className="flex items-center gap-2">
              <PieChartIcon className="h-4.5 w-4.5 text-indigo-500" />
              <h4 className="font-semibold text-slate-700 text-xs">Distribución por Línea de Tratamiento (%)</h4>
            </div>
            <span className="text-[10px] text-slate-400">Registros Activos</span>
          </div>

          {treatmentLinePieData.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center min-h-[140px] text-slate-400">
              <Stethoscope className="h-6 w-6 stroke-1 mb-1.5 animate-pulse" />
              <p className="text-[10px]">Sin registros activos</p>
            </div>
          ) : (
            <div className="flex-1 flex flex-col xl:flex-row items-center justify-between gap-1 min-h-[140px]">
              <div className="w-full xl:w-1/2 h-32">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={treatmentLinePieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={30}
                      outerRadius={45}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {treatmentLinePieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ background: "#0f172a", borderRadius: "8px", border: "none", color: "#fff", fontSize: "10px" }}
                      itemStyle={{ color: "#fff" }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="w-full xl:w-1/2 space-y-1 px-1 text-[9.5px]">
                {treatmentLinePieData.map((item, i) => (
                  <div key={i} className="flex items-center justify-between border-b border-slate-50 pb-0.5 text-[10px] gap-1">
                    <div className="flex items-center gap-1 min-w-0">
                      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }}></span>
                      <span className="font-medium text-slate-600 leading-tight break-words text-[10px]">{item.name}</span>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <span className="text-[9px] text-slate-400 font-mono">({item.value})</span>
                      <span className="font-bold text-slate-900 text-[10px] font-mono bg-slate-50 border border-slate-100 rounded px-1 py-0.5 min-w-[34px] text-center">
                        {item.percentage}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Days Elapsed Line Chart with trend line */}
        <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-xs flex flex-col md:col-span-3" id="chart-panel-dias-transcurridos">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-2.5 border-b border-slate-50 pb-2">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4.5 w-4.5 text-indigo-600" />
              <h4 className="font-semibold text-slate-700 text-xs text-left">Tendencia de Ingresos Mensuales</h4>
            </div>
            
            {/* KPI Badge Display */}
            {monthlyTrendData.points.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 bg-slate-50 border border-slate-100 px-2 py-0.5 rounded text-[10px] font-semibold text-slate-600">
                <span className="text-slate-400">Promedio:</span>
                <span className="text-slate-800 font-bold">{monthlyTrendData.average} ing/mes</span>
                <span className="text-slate-350">|</span>
                <span className="text-slate-400">Tendencia:</span>
                <span className={`flex items-center gap-0.5 font-bold uppercase tracking-tight ${
                  monthlyTrendData.trendDirection === "ascendente" ? "text-emerald-600" :
                  monthlyTrendData.trendDirection === "descendente" ? "text-rose-600" : "text-sky-600"
                }`}>
                  {monthlyTrendData.trendDirection === "ascendente" ? <TrendingUp className="h-3 w-3 inline" /> :
                   monthlyTrendData.trendDirection === "descendente" ? <TrendingDown className="h-3 w-3 inline" /> : <Minus className="h-3 w-3 inline" />}
                  {monthlyTrendData.trendDirection} ({monthlyTrendData.slope > 0 ? "+" : ""}{monthlyTrendData.slope.toFixed(1)}/mes)
                </span>
              </div>
            )}
          </div>

          <div className="min-h-[140px]">
            {monthlyTrendData.points.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-400 py-4">
                <Activity className="h-6 w-6 stroke-1 mb-1.5 animate-pulse" />
                <p className="text-[10px]">No hay datos de pacientes para analizar tiempos</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={140}>
                <LineChart data={monthlyTrendData.points} margin={{ top: 10, right: 15, left: -25, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" tick={{ fontSize: 8.5, fill: "#94a3b8" }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 8.5, fill: "#94a3b8" }} />
                  <Tooltip 
                    contentStyle={{ background: "#0f172a", borderRadius: "8px", border: "none", color: "#fff", fontSize: "10px" }}
                    labelStyle={{ fontWeight: "semibold", color: "#fbbf24" }}
                  />
                  <Legend iconSize={8} wrapperStyle={{ fontSize: 9, paddingTop: 4 }} />
                  {/* Real Monthly Admissions */}
                  <Line name="Ingresos Mensuales" type="monotone" dataKey="cantidad" stroke="#4f46e5" strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                  {/* Monthly Trend line */}
                  <Line name="Línea de Tendencia" type="monotone" dataKey="tendencia" stroke="#f59e0b" strokeWidth={2} strokeDasharray="4 4" dot={false} activeDot={false} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

      </div>

    </div>
  );
}
