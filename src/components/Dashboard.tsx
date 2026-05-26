import React, { useMemo } from "react";
import { Paciente, LookupItem, LookupType } from "../types";
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
  Briefcase
} from "lucide-react";

interface DashboardProps {
  pacientes: Paciente[];
  lookups: Record<LookupType, LookupItem[]>;
}

export default function Dashboard({ pacientes, lookups }: DashboardProps) {
  
  // Total stats with basic selectors
  const stats = useMemo(() => {
    const total = pacientes.length;
    const activos = pacientes.filter(p => p.status === "active").length;
    const publico = pacientes.filter(p => p.sector === "Público").length;
    const privado = pacientes.filter(p => p.sector === "Privado").length;
    
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
  }, [pacientes, lookups]);

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
    pacientes.forEach(p => {
      const city = p.ciudadLabel || "No Especificado";
      counts[city] = (counts[city] || 0) + 1;
    });
    const total = pacientes.length || 1;
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
  }, [pacientes]);

  // Compute insurer distribution for PieChart
  const insurerPieData = useMemo(() => {
    const counts: Record<string, number> = {};
    pacientes.forEach(p => {
      const label = p.aseguradoraLabel || "Sin Seguro / Particular";
      counts[label] = (counts[label] || 0) + 1;
    });
    const total = pacientes.length || 1;
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
  }, [pacientes]);

  // Compute PJS distribution for PieChart
  const pjsPieData = useMemo(() => {
    const counts: Record<string, number> = {};
    pacientes.forEach(p => {
      const label = p.pjsLabel || "Particular / Sin asociar";
      counts[label] = (counts[label] || 0) + 1;
    });
    const total = pacientes.length || 1;
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
  }, [pacientes]);

  // Compute Active vs Inactive Patients - KPI Suggestion for Retention rate
  const retentionKpiData = useMemo(() => {
    const activos = pacientes.filter(p => !p.fechaBaja).length;
    const bajas = pacientes.filter(p => p.fechaBaja).length;
    const total = pacientes.length || 1;
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
  }, [pacientes]);

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
    pacientes.forEach((p) => {
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
  }, [pacientes]);

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
        <div className="flex items-center gap-2 px-3 py-1 bg-slate-50 rounded-full border border-slate-100 self-start text-[11px] font-mono text-slate-600">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
          Resguardo Cloud Activo (Firestore)
        </div>
      </div>

      {/* KPI Stats Cards Block */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5" id="clinical-kpi-grid">
        {/* Total Patients */}
        <div className="bg-white p-3.5 rounded-xl border border-slate-100 shadow-xs hover:shadow-xs transition-shadow duration-200" id="kpi-card-total">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Pacientes Totales</span>
            <div className="h-8 w-8 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600">
              <Users className="h-4.5 w-4.5" />
            </div>
          </div>
          <div className="mt-2">
            <h3 className="text-xl font-semibold text-slate-800 tracking-tight">{stats.total}</h3>
            <p className="text-[10px] text-emerald-600 mt-0.5 flex items-center gap-1 font-medium">
              <TrendingUp className="h-3 w-3" />
              {stats.activos} activos
            </p>
          </div>
        </div>

        {/* Cities */}
        <div className="bg-white p-3.5 rounded-xl border border-slate-100 shadow-xs hover:shadow-xs transition-shadow duration-200" id="kpi-card-ciudades">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Ciudades</span>
            <div className="h-8 w-8 rounded-lg bg-sky-50 flex items-center justify-center text-sky-600">
              <MapPin className="h-4.5 w-4.5" />
            </div>
          </div>
          <div className="mt-2">
            <h3 className="text-xl font-semibold text-slate-800 tracking-tight">{stats.totalCiudades}</h3>
            <p className="text-[10px] text-sky-600 mt-0.5 font-medium">
              Sedes operativas
            </p>
          </div>
        </div>

        {/* Doctors */}
        <div className="bg-white p-3.5 rounded-xl border border-slate-100 shadow-xs hover:shadow-xs transition-shadow duration-200" id="kpi-card-medicos">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Médicos Activos</span>
            <div className="h-8 w-8 rounded-lg bg-purple-50 flex items-center justify-center text-purple-600">
              <Stethoscope className="h-4.5 w-4.5" />
            </div>
          </div>
          <div className="mt-2">
            <h3 className="text-xl font-semibold text-slate-800 tracking-tight">{stats.totalMedicos}</h3>
            <p className="text-[10px] text-purple-600 mt-0.5 font-medium">
              Especialistas
            </p>
          </div>
        </div>

        {/* Insurers */}
        <div className="bg-white p-3.5 rounded-xl border border-slate-100 shadow-xs hover:shadow-xs transition-shadow duration-200" id="kpi-card-aseguradoras">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Aseguradoras</span>
            <div className="h-8 w-8 rounded-lg bg-amber-50 flex items-center justify-center text-amber-600">
              <Building2 className="h-4.5 w-4.5" />
            </div>
          </div>
          <div className="mt-2">
            <h3 className="text-xl font-semibold text-slate-800 tracking-tight">{stats.totalAseguradoras}</h3>
            <p className="text-[10px] text-amber-600 mt-0.5 font-medium">
              Entidades de cobertura
            </p>
          </div>
        </div>
      </div>

      {/* Charts Grid Block */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4" id="charts-main-grid">
        
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
            <div className="flex-1 flex flex-col sm:flex-row items-center justify-between min-h-[140px]">
              <div className="w-full sm:w-1/2 h-32">
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
              <div className="w-full sm:w-1/2 space-y-1.5 px-4">
                {sectorData.map((item, i) => (
                  <div key={i} className="flex items-center justify-between border-b border-slate-50 pb-1">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }}></span>
                      <span className="text-[11px] font-medium text-slate-600">{item.name}</span>
                    </div>
                    <span className="text-[11px] font-semibold text-slate-800 font-mono">
                      {item.value} ({Math.round((item.value / stats.total) * 100)}%)
                    </span>
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
            <div className="flex-1 flex flex-col sm:flex-row items-center justify-between min-h-[140px]">
              <div className="w-full sm:w-1/2 h-32">
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
              <div className="w-full sm:w-1/2 space-y-1 overflow-hidden px-2">
                {cityPieData.map((item, i) => (
                  <div key={i} className="flex items-center justify-between border-b border-slate-50 pb-0.5 text-[10px]">
                    <div className="flex items-center gap-1 overflow-hidden">
                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }}></span>
                      <span className="font-medium text-slate-600 truncate">{item.name}</span>
                    </div>
                    <span className="font-semibold text-slate-800 font-mono flex-shrink-0">
                      {item.value} ({item.percentage}%)
                    </span>
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
            <div className="flex-1 flex flex-col sm:flex-row items-center justify-between min-h-[140px]">
              <div className="w-full sm:w-1/2 h-32">
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
              <div className="w-full sm:w-1/2 space-y-1 overflow-hidden px-2">
                {pjsPieData.map((item, i) => (
                  <div key={i} className="flex items-center justify-between border-b border-slate-50 pb-0.5 text-[10px]">
                    <div className="flex items-center gap-1 overflow-hidden">
                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }}></span>
                      <span className="font-medium text-slate-600 truncate">{item.name}</span>
                    </div>
                    <span className="font-semibold text-slate-800 font-mono flex-shrink-0">
                      {item.value} ({item.percentage}%)
                    </span>
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
            <div className="flex-1 flex flex-col sm:flex-row items-center justify-between min-h-[140px]">
              <div className="w-full sm:w-1/2 h-32">
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
              <div className="w-full sm:w-1/2 space-y-1 overflow-hidden px-2">
                {insurerPieData.map((item, i) => (
                  <div key={i} className="flex items-center justify-between border-b border-slate-50 pb-0.5 text-[10px]">
                    <div className="flex items-center gap-1 overflow-hidden">
                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }}></span>
                      <span className="font-medium text-slate-600 truncate">{item.name}</span>
                    </div>
                    <span className="font-semibold text-slate-800 font-mono flex-shrink-0">
                      {item.value} ({item.percentage}%)
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Recurrent Treatment KPI / Patient Retention Chart Replacement */}
        <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-xs flex flex-col lg:col-span-1" id="chart-panel-linea-tiempo">
          <div className="flex items-center justify-between mb-2.5 border-b border-slate-50 pb-2">
            <div className="flex items-center gap-2">
              <Activity className="h-4.5 w-4.5 text-purple-600" />
              <h4 className="font-semibold text-slate-700 text-xs text-left">Tasa de Sostenibilidad (Retención Clínica)</h4>
            </div>
            <span className="bg-purple-50 text-purple-700 text-[10px] font-bold px-1.5 py-0.5 rounded-full border border-purple-100 font-mono flex-shrink-0">
              KPI Sugerido
            </span>
          </div>

          <div className="flex-1 flex flex-col sm:flex-row items-center justify-between min-h-[140px]">
            <div className="w-full sm:w-1/2 h-32 relative flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={retentionKpiData.chart}
                    cx="50%"
                    cy="50%"
                    innerRadius={30}
                    outerRadius={45}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {retentionKpiData.chart.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ background: "#0f172a", borderRadius: "8px", border: "none", color: "#fff", fontSize: "10px" }}
                    itemStyle={{ color: "#fff" }}
                  />
                </PieChart>
              </ResponsiveContainer>
              {/* Inner overlay percentage text */}
              <div className="absolute text-center flex flex-col items-center">
                <span className="text-sm font-black text-slate-800 leading-none">{retentionKpiData.rate}%</span>
                <span className="text-[8px] text-slate-400 font-medium">Activos</span>
              </div>
            </div>

            <div className="w-full sm:w-1/2 space-y-2 px-3 self-center">
              <p className="text-[10px] text-slate-500 leading-normal">
                Mide la fidelización o continuidad del paciente en su tratamiento. Una tasa alta indica una sólida adherencia médica y menor deserción terapéutica.
              </p>
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[10px] font-semibold border-b border-slate-50 pb-1">
                  <span className="text-emerald-600 font-bold">Activos:</span>
                  <span className="font-mono text-slate-800">{retentionKpiData.activos} pac ({retentionKpiData.rate}%)</span>
                </div>
                <div className="flex items-center justify-between text-[10px] font-semibold">
                  <span className="text-rose-500 font-bold">De Baja:</span>
                  <span className="font-mono text-slate-800">{retentionKpiData.bajas} pac ({100 - retentionKpiData.rate}%)</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Days Elapsed Line Chart with trend line */}
        <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-xs flex flex-col lg:col-span-1" id="chart-panel-dias-transcurridos">
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
