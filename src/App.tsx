import React, { useState, useEffect } from "react";
import { 
  initializeFirestoreDefaults, 
  dbSavePaciente, 
  dbSaveLookupItem, 
  dbChangeLookupStatus, 
  dbDeletePaciente,
  dbClearAllPacientesOnCloud,
  dbClearAllLookupsOnCloud,
  dbClearSingleLookupOnCloud,
  dbDeleteLookupItem
} from "./dbService";
import { Paciente, LookupItem, LookupType, LOOKUPS_CONFIG } from "./types";
import { encryptText } from "./encryptUtils";
import { signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged, User } from "firebase/auth";
import { auth } from "./firebase";
import Dashboard from "./components/Dashboard";
import NuevoRegistro from "./components/NuevoRegistro";
import LookupManager from "./components/LookupManager";
import PatientsTable from "./components/PatientsTable";
import DataImporter from "./components/DataImporter";
import { 
  HeartPulse, 
  Activity, 
  UserPlus, 
  Database, 
  Layers, 
  Lock, 
  LogIn, 
  LogOut, 
  RefreshCw,
  Building2,
  Stethoscope,
  Map,
  Shield,
  HelpCircle,
  Clock,
  AlertTriangle,
  Menu,
  X,
  ChevronRight,
  ChevronLeft,
  Users
} from "lucide-react";

type MainTab = 
  | "dashboard"
  | "pacientes_grid"
  | "ingreso"
  | "importor"
  | "grupo_personal"
  | "grupo_sedes"
  | "grupo_coberturas"
  | "sector"
  | "pjs"
  | "ciudades"
  | "medicos"
  | "aseguradoras"
  | "instituciones"
  | "dispensaciones"
  | "distribuidores"
  | "indicaciones"
  | "dosis";

export default function App() {
  // Navigation State
  const [activeTab, setActiveTab ] = useState<MainTab>("dashboard");

  // Core Clinical State
  const [pacientes, setPacientes] = useState<Paciente[]>([]);
  const [lookups, setLookups] = useState<Record<LookupType, LookupItem[]>>({} as any);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  // Authentication State
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [guestMode, setGuestMode] = useState(true); // Default guest sandbox
  const [authLoading, setAuthLoading] = useState(true);

  // Custom Username/Password Authorization (mbraschi / Zafiro641)
  const [isAuthorized, setIsAuthorized] = useState<boolean>(() => {
    return localStorage.getItem("med_auth_authorized") === "true";
  });
  const [loginUser, setLoginUser] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState("");

  const handleCustomLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (loginUser.trim().toLowerCase() === "mbraschi" && loginPassword === "Zafiro641") {
      localStorage.setItem("med_auth_authorized", "true");
      setIsAuthorized(true);
      setLoginError("");
    } else {
      setLoginError("Usuario o clave incorrectos. Intente de nuevo.");
    }
  };

  // Client Cryptographic Key
  const [clinicalKey, setClinicalKey] = useState("Zafiro641");

  // Mobile sidebar states
  const [isSidebarMobileOpen, setIsSidebarMobileOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  // Load database structures on startup
  const fetchAllData = async () => {
    setSyncing(true);
    try {
      const res = await initializeFirestoreDefaults();
      
      // Strip any legacy "(Miembro)" suffix for clean display
      const cleanedPacientes = res.pacientes.map(p => ({
        ...p,
        pjsLabel: p.pjsLabel ? p.pjsLabel.replace(/\s*\(Miembro\)/gi, "").trim() : p.pjsLabel
      }));

      const cleanedLookups = { ...res.lookups };
      if (cleanedLookups.pjs) {
        cleanedLookups.pjs = cleanedLookups.pjs.map(item => ({
          ...item,
          nombre: item.nombre ? item.nombre.replace(/\s*\(Miembro\)/gi, "").trim() : item.nombre,
          apellido: item.apellido ? item.apellido.replace(/\s*\(Miembro\)/gi, "").trim() : item.apellido
        }));
      }

      setPacientes(cleanedPacientes);
      setLookups(cleanedLookups);
    } catch (e) {
      console.error("Critical loader issue: ", e);
    } finally {
      setLoading(false);
      setSyncing(false);
    }
  };

  useEffect(() => {
    // Listen to Firebase auth changes
    const unsub = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      if (user) {
        setGuestMode(false);
      }
      setAuthLoading(false);
    });

    // Run initial catalog sync
    fetchAllData();

    return () => unsub();
  }, []);

  // Google Sign-In helper
  const handleGoogleLogin = async () => {
    const provider = new GoogleAuthProvider();
    setAuthLoading(true);
    try {
      await signInWithPopup(auth, provider);
      await fetchAllData();
    } catch (err: any) {
      console.warn("Sign-in popup might be blocked or cancelled in this preview frame.", err);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    localStorage.removeItem("med_auth_authorized");
    setIsAuthorized(false);
    setGuestMode(true);
    await fetchAllData();
  };

  // Add a new patient record callback
  const handleAddPaciente = async (newPaciente: Paciente): Promise<boolean> => {
    const duplicate = pacientes.some(p => p.id.toLowerCase() === newPaciente.id.toLowerCase());
    if (duplicate) {
      return false;
    }

    try {
      const updated = await dbSavePaciente(newPaciente);
      setPacientes(prev => [...prev, updated]);
      return true;
    } catch (err) {
      return false;
    }
  };

  // Update an existing patient on Cloud
  const handleUpdatePaciente = async (updatedPaciente: Paciente): Promise<boolean> => {
    try {
      const updated = await dbSavePaciente(updatedPaciente);
      setPacientes(prev => prev.map(p => p.id === updated.id ? updated : p));
      return true;
    } catch (err) {
      console.error(err);
      return false;
    }
  };

  // Delete a patient record completely
  const handleDeletePaciente = async (id: string) => {
    try {
      await dbDeletePaciente(id);
      setPacientes(prev => prev.filter(p => p.id !== id));
    } catch (err) {
      console.error(err);
    }
  };

  // Clear all patient records completely (Cloud and local storage)
  const handleClearAllPacientes = async () => {
    try {
      setSyncing(true);
      await dbClearAllPacientesOnCloud();
      setPacientes([]);
    } catch (err) {
      console.error("Error clearing patient database: ", err);
      alert("Error al intentar borrar todos los registros.");
    } finally {
      setSyncing(false);
    }
  };

  // Clear all catalog lookup items completely (from cloud and local fallback)
  const handleClearAllLookups = async () => {
    try {
      setSyncing(true);
      await dbClearAllLookupsOnCloud();
      setLookups({
        pjs: [],
        ciudades: [],
        medicos: [],
        aseguradoras: [],
        instituciones: [],
        dispensaciones: [],
        distribuidores: [],
        indicaciones: [],
        dosis: []
      });
    } catch (err) {
      console.error("Error clearing lookups: ", err);
      alert("Error al limpiar las tablas de catálogo.");
    } finally {
      setSyncing(false);
    }
  };

  // Clear a single catalog lookup item list completely
  const handleClearSingleLookup = async (type: LookupType) => {
    try {
      setSyncing(true);
      await dbClearSingleLookupOnCloud(type);
      setLookups(prev => ({
        ...prev,
        [type]: []
      }));
    } catch (err) {
      console.error(`Error clearing lookup ${type}: `, err);
      alert(`Error al limpiar el catálogo.`);
    } finally {
      setSyncing(false);
    }
  };

  // Add or update lookup catalog item callback
  const handleSaveLookup = async (type: LookupType, item: LookupItem) => {
    try {
      const saved = await dbSaveLookupItem(type, item);
      setLookups(prev => {
        const currentList = prev[type] || [];
        const exists = currentList.some(i => i.id === saved.id);
        const newList = exists
          ? currentList.map(i => i.id === saved.id ? saved : i)
          : [...currentList, saved];
        return {
          ...prev,
          [type]: newList
        };
      });
    } catch (err) {
      console.error(err);
    }
  };

  // Delete a lookup item
  const handleDeleteLookup = async (type: LookupType, id: string) => {
    try {
      await dbDeleteLookupItem(type, id);
      setLookups(prev => ({
        ...prev,
        [type]: (prev[type] || []).filter(item => item.id !== id)
      }));
    } catch (err) {
      console.error(err);
    }
  };

  // Retire or deactivate a lookup item from dropdown selectors
  const handleChangeLookupStatus = async (type: LookupType, id: string, nextStatus: "activo" | "baja") => {
    try {
      await dbChangeLookupStatus(type, id, nextStatus);
      setLookups(prev => ({
        ...prev,
        [type]: (prev[type] || []).map(item => item.id === id ? { ...item, status: nextStatus } : item)
      }));
    } catch (err) {
      console.error(err);
    }
  };

  // Reassign all patients under one PJS to another existing or newly created PJS
  const handleReassignPjs = async (
    sourcePjsId: string,
    targetPjs: { id?: string; nombre: string; apellido?: string }
  ) => {
    try {
      let targetId = targetPjs.id;
      let targetLabel = "";

      // 1. If target ID is missing, save as a new lookup first!
      if (!targetId) {
        const generatedId = `pjs_${Date.now()}`;
        const newItem: LookupItem = {
          id: generatedId,
          nombre: targetPjs.nombre,
          apellido: targetPjs.apellido,
          status: "activo"
        };
        await dbSaveLookupItem("pjs", newItem);
        setLookups(prev => ({
          ...prev,
          pjs: [...(prev.pjs || []), newItem]
        }));
        targetId = generatedId;
        targetLabel = `${newItem.nombre} ${newItem.apellido || ""}`.trim();
      } else {
        const existing = lookups.pjs?.find(item => item.id === targetId);
        targetLabel = existing ? `${existing.nombre} ${existing.apellido || ""}`.trim() : targetPjs.nombre;
      }

      // 2. Identify and update all patients under sourcePjsId
      const patientsToUpdate = pacientes.filter(p => p.pjsId === sourcePjsId);
      
      const updatedList: Paciente[] = [];
      for (const p of patientsToUpdate) {
        const pUpdated: Paciente = {
          ...p,
          pjsId: targetId,
          pjsLabel: targetLabel
        };
        const saved = await dbSavePaciente(pUpdated);
        updatedList.push(saved);
      }

      // 3. Update top-level React state
      setPacientes(prev =>
        prev.map(p => {
          const updated = updatedList.find(ul => ul.id === p.id);
          return updated ? updated : p;
        })
      );
    } catch (err) {
      console.error("Error in PJS accounts reassignment flow: ", err);
      throw err;
    }
  };

  const menuGroups = [
    {
      title: "Principal",
      items: [
        { id: "dashboard", label: "Dashboard Diagnóstico", icon: Activity },
        { id: "pacientes_grid", label: "Tabla de Pacientes", icon: Layers },
        { id: "ingreso", label: "Ingreso Nuevo Registro", icon: UserPlus },
        { id: "importor", label: "Importar de Excel / Sheets", icon: Database, highlight: true },
      ]
    },
    {
      title: "Tablas de Catálogo",
      items: [
        { id: "grupo_personal", label: "Personal y Médicos", icon: Users },
        { id: "grupo_sedes", label: "Geografía y Canales", icon: Map },
        { id: "grupo_coberturas", label: "Tratamiento y Seguros", icon: Shield },
        { id: "sector", label: "Sector de Salud", icon: Building2 },
      ]
    }
  ];

  const getActiveTabLabel = () => {
    for (const group of menuGroups) {
      const match = group.items.find(item => item.id === activeTab);
      if (match) return match.label;
    }
    return "Consola Médica";
  };

  if (!isAuthorized && !currentUser) {
    return (
      <div className="min-h-screen w-screen bg-[#070b13] text-slate-100 flex items-center justify-center p-4 font-sans relative overflow-hidden" id="login-screen-root">
        {/* Abstract futuristic medical ambient elements */}
        <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-[400px] h-[400px] rounded-full bg-blue-500 blur-[120px] animate-pulse"></div>
          <div className="absolute bottom-1/4 right-1/4 w-[350px] h-[350px] rounded-full bg-emerald-500 blur-[100px] animate-pulse" style={{ animationDelay: '2s' }}></div>
        </div>

        <div className="w-full max-w-sm bg-[#0f172a] border border-slate-800 rounded-3xl p-8 shadow-2xl relative z-10 flex flex-col items-center">
          
          {/* Logo */}
          <div className="h-16 w-16 bg-[#1e293b] rounded-2xl flex items-center justify-center mb-6 shadow-inner border border-slate-800">
            <svg
              viewBox="0 0 128 128"
              className="h-10 w-10 shrink-0"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M59.32 15.5c-4.47 0-9.21 2.21-12.72 5.34-5.59 5.01-8.52 12.39-8.52 19.34 0 5.4 1.83 10.74 5.32 14.88 4.7 5.56 11.23 8.35 17.84 10.15 4.88 1.33 9.76 2.37 13.06 4.3 3.65 2.14 6.64 5.48 7.37 10.18 1.01 6.54-2.62 13.07-8.1 17.51L81 83.2c11.08-9.01 16.03-21.84 12.18-35.15-2.02-6.99-6.3-12.63-12.32-15.86-5.46-2.92-11.45-3.8-17.75-5.51-4.14-1.12-8.31-2.58-11.45-5.36-2.88-2.55-4.47-5.91-4.47-9.58 0-6.73 5.4-12.24 12.13-12.24 3.7 0 7.35 1.58 9.94 4.09l6.57-7.25c-4.12-4.04-10-6.34-15.8-6.34zm-22.1 43.1L12 91h15l14-25.2 6.5-11.7-6.78 4.5zM71 78.5s-4.3 3.9-9.8 4.4c-9.5.8-18.4-5.1-21.4-14.3-1.6-4.9-1.2-10 1.1-14.5l-12.7-7.6c-4.66 8.33-5.26 18.23-1.5 27 5.25 12.2 18.15 19.8 31.4 18.4 10.9-1.1 19.7-7.8 23.4-16.7l-10.5-6.7z"
                fill="#EEB709"
              />
            </svg>
          </div>

          <h1 className="text-xl font-bold tracking-tight text-white font-sans text-center">Registros de Pacientes</h1>
          <p className="text-slate-400 text-xs text-center mt-1 font-sans">Sistema de Control y Acceso AstraZeneca</p>

          <form onSubmit={handleCustomLogin} className="w-full mt-6 space-y-4">
            
            {loginError && (
              <div className="bg-rose-950/50 border border-rose-800/80 text-rose-200 text-xs px-4 py-3 rounded-xl flex items-center gap-2 font-medium">
                <AlertTriangle className="h-4 w-4 text-rose-500 shrink-0" />
                <span>{loginError}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5 font-sans">
                Usuario Autorizado
              </label>
              <input
                type="text"
                required
                value={loginUser}
                onChange={(e) => setLoginUser(e.target.value)}
                placeholder="mbraschi"
                className="w-full bg-slate-900 border border-slate-800 focus:border-blue-500 rounded-xl py-2.5 px-3.5 text-xs focus:outline-none transition-all placeholder:text-slate-600 text-white"
                id="login-username-input"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5 font-sans">
                Clave de Acceso
              </label>
              <div className="relative">
                <input
                  type="password"
                  required
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-slate-900 border border-slate-800 focus:border-blue-500 rounded-xl py-2.5 pl-3.5 pr-10 text-xs focus:outline-none transition-all placeholder:text-slate-600 text-white"
                  id="login-password-input"
                />
                <Lock className="absolute right-3 top-3 h-4 w-4 text-slate-600" />
              </div>
            </div>

            <button
              type="submit"
              className="w-full bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold py-3 rounded-xl transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer mt-2"
              id="login-submit-button"
            >
              <LogIn className="h-4 w-4" />
              Ingresar a la Consola
            </button>
          </form>

          {/* Separation Divider */}
          <div className="w-full flex items-center justify-between gap-3 my-5">
            <span className="h-px bg-slate-800 flex-1"></span>
            <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">O también</span>
            <span className="h-px bg-slate-800 flex-1"></span>
          </div>

          <button
            onClick={handleGoogleLogin}
            disabled={authLoading}
            className="w-full bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-200 text-xs font-semibold py-2.5 rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer"
            id="google-alternate-login-button"
          >
            {authLoading ? (
              <RefreshCw className="h-3.5 w-3.5 animate-spin text-blue-500" />
            ) : (
              <>
                <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l3.66-2.85z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.85c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                <span>Autenticar con Google</span>
              </>
            )}
          </button>

          <p className="text-[9px] text-center text-slate-500 leading-normal mt-6 w-full border-t border-slate-900/40 pt-4 font-sans">
            Acceso restringido a personal médico autorizado. Toda actividad es supervisada por las directivas de AstraZeneca.
          </p>

        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen bg-[#f8fafc] text-slate-850 flex overflow-hidden font-sans" id="medical-application-root">
      
      {/* 2. Responsive Mobile Drawer Overlays */}
      {isSidebarMobileOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/60 z-40 lg:hidden transition-opacity h-full w-full" 
          onClick={() => setIsSidebarMobileOpen(false)}
        />
      )}

      {/* 1. Sidebar Navigation - Desktop view & Mobile drawer wrapper */}
      <aside className={`
        fixed inset-y-0 left-0 bg-[#0f172a] text-white flex flex-col z-50 shadow-2xl transition-all duration-300 ease-in-out shrink-0 h-full
        lg:static lg:flex lg:shadow-xl
        ${isSidebarMobileOpen ? "translate-x-0 w-64" : "-translate-x-full lg:translate-x-0"}
        ${isSidebarCollapsed ? "lg:w-0 lg:opacity-0 lg:overflow-hidden lg:pointer-events-none" : "w-64 lg:w-64 lg:opacity-100"}
      `}>
        {/* Brand header */}
        <div className="p-6 flex items-center justify-between border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <svg
              viewBox="0 0 128 128"
              className="h-9 w-9 shrink-0"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M59.32 15.5c-4.47 0-9.21 2.21-12.72 5.34-5.59 5.01-8.52 12.39-8.52 19.34 0 5.4 1.83 10.74 5.32 14.88 4.7 5.56 11.23 8.35 17.84 10.15 4.88 1.33 9.76 2.37 13.06 4.3 3.65 2.14 6.64 5.48 7.37 10.18 1.01 6.54-2.62 13.07-8.1 17.51L81 83.2c11.08-9.01 16.03-21.84 12.18-35.15-2.02-6.99-6.3-12.63-12.32-15.86-5.46-2.92-11.45-3.8-17.75-5.51-4.14-1.12-8.31-2.58-11.45-5.36-2.88-2.55-4.47-5.91-4.47-9.58 0-6.73 5.4-12.24 12.13-12.24 3.7 0 7.35 1.58 9.94 4.09l6.57-7.25c-4.12-4.04-10-6.34-15.8-6.34zm-22.1 43.1L12 91h15l14-25.2 6.5-11.7-6.78 4.5zM71 78.5s-4.3 3.9-9.8 4.4c-9.5.8-18.4-5.1-21.4-14.3-1.6-4.9-1.2-10 1.1-14.5l-12.7-7.6c-4.66 8.33-5.26 18.23-1.5 27 5.25 12.2 18.15 19.8 31.4 18.4 10.9-1.1 19.7-7.8 23.4-16.7l-10.5-6.7z"
                fill="#EEB709"
              />
            </svg>
            <div>
              <h1 className="text-sm font-semibold tracking-tight text-slate-100 font-sans">Registros de Pacientes</h1>
              <p className="text-[10px] text-slate-400 font-mono mt-0.5 uppercase tracking-wider">AstraZeneca</p>
            </div>
          </div>
          {/* Close / Collapse controls inside sidebar */}
          <div className="flex items-center gap-1">
            <button 
              onClick={() => setIsSidebarCollapsed(true)} 
              className="hidden lg:flex p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-all active:scale-95 cursor-pointer"
              title="Colapsar menú (Ocultar)"
            >
              <ChevronLeft className="h-4.5 w-4.5" />
            </button>
            <button 
              onClick={() => setIsSidebarMobileOpen(false)} 
              className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Scrollable Nav elements list */}
        <nav className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
          {menuGroups.map((group, groupIdx) => (
            <div key={groupIdx} className="space-y-1">
              <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-2 mb-2 font-sans">
                {group.title}
              </div>
              {group.items.map((item) => {
                const isSelected = activeTab === item.id;
                const IconComponent = item.icon;
                const listSize = 
                  item.id === "grupo_personal"
                    ? ((lookups.pjs || []).filter(i => i.status === "activo").length + (lookups.medicos || []).filter(i => i.status === "activo").length)
                    : item.id === "grupo_sedes"
                    ? ((lookups.ciudades || []).filter(i => i.status === "activo").length + (lookups.instituciones || []).filter(i => i.status === "activo").length + (lookups.dispensaciones || []).filter(i => i.status === "activo").length)
                    : item.id === "grupo_coberturas"
                    ? ((lookups.aseguradoras || []).filter(i => i.status === "activo").length + (lookups.distribuidores || []).filter(i => i.status === "activo").length + (lookups.indicaciones || []).filter(i => i.status === "activo").length + (lookups.dosis || []).filter(i => i.status === "activo").length)
                    : null;

                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      setActiveTab(item.id as MainTab);
                      setIsSidebarMobileOpen(false);
                    }}
                    className={`
                      w-full flex items-center justify-between gap-3 px-3 py-2 text-xs font-semibold rounded-md transition-all cursor-pointer text-left font-sans
                      ${isSelected 
                        ? item.highlight 
                          ? "bg-emerald-600 text-white shadow-sm font-semibold" 
                          : "bg-blue-600 text-white shadow-sm font-semibold" 
                        : "text-slate-300 hover:bg-slate-800 hover:text-white"
                      }
                    `}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <IconComponent className={`h-4 w-4 shrink-0 ${isSelected ? "text-white" : "text-slate-400"}`} />
                      <span className="truncate">{item.label}</span>
                    </div>

                    {listSize !== null && (
                      <span className={`text-[9px] px-1.5 py-0.5 rounded-full ${
                        isSelected ? "bg-white/20 text-white font-bold" : "bg-slate-800 text-slate-400 font-mono"
                      }`}>
                        {listSize}
                      </span>
                    )}

                    {item.id === "ingreso" && (
                      <span className="bg-emerald-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded leading-none">Nuevo</span>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Sidebar Footer detailing doctor credentials and log out option */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/40 shrink-0">
          <div className="flex items-center gap-3 mb-4">
            {currentUser?.photoURL ? (
              <img 
                src={currentUser.photoURL} 
                alt="Clinician" 
                className="w-10 h-10 rounded-full border border-slate-700 object-cover"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="w-10 h-10 bg-slate-700 rounded-full flex items-center justify-center border border-slate-600 font-bold text-sm text-slate-200">
                {currentUser?.displayName ? currentUser.displayName.slice(0, 2).toUpperCase() : isAuthorized ? "MB" : "JD"}
              </div>
            )}
            <div className="text-xs min-w-0 font-sans">
              <p className="font-bold text-slate-100 truncate">
                {currentUser ? (currentUser.displayName || "Médico Clínico") : isAuthorized ? "mbraschi" : "Dr. Juan Delgado"}
              </p>
              <p className="text-slate-400 text-[10px] truncate">
                {currentUser ? "Administrador de Registros" : isAuthorized ? "Administrador de Registros" : "Médico Residente"}
              </p>
            </div>
          </div>
          
          {(currentUser || isAuthorized) ? (
            <button 
              onClick={handleLogout}
              className="w-full py-1.5 px-3 bg-slate-800 hover:bg-slate-700 hover:text-white text-slate-300 rounded text-xs transition-colors cursor-pointer text-center font-medium flex items-center justify-center gap-1.5"
            >
              <LogOut className="h-3.5 w-3.5" />
              Cerrar Sesión
            </button>
          ) : (
            <div className="space-y-1.5">
              <button 
                onClick={handleGoogleLogin}
                className="w-full py-1.5 px-3 bg-blue-600 hover:bg-blue-500 text-white rounded text-xs font-semibold transition-colors cursor-pointer text-center flex items-center justify-center gap-1.5"
              >
                <LogIn className="h-3.5 w-3.5 text-white" />
                Acceso Médico Google
              </button>
              <div className="text-center text-[9px] text-slate-500 font-sans">Invitado temporal habilitado</div>
            </div>
          )}
        </div>
      </aside>

      {/* 3. Right Main Content Frame */}
      <main className="flex-1 flex flex-col h-full overflow-hidden min-w-0 relative">
        
        {/* Top Header / Toolbar */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 shrink-0 shadow-xs">
          
          {/* Active indicator & Sidebar toggler (Mobile + Desktop) */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                if (window.innerWidth >= 1024) {
                  setIsSidebarCollapsed(!isSidebarCollapsed);
                } else {
                  setIsSidebarMobileOpen(true);
                }
              }}
              className="p-1.5 -ml-1 text-slate-600 hover:bg-indigo-50 hover:text-indigo-600 rounded-lg transition-all active:scale-95 cursor-pointer flex items-center justify-center gap-1"
              title={isSidebarCollapsed ? "Expandir menú" : "Colapsar menú"}
            >
              <Menu className={`h-5 w-5 transition-transform ${isSidebarCollapsed ? "text-indigo-600 scale-110" : ""}`} />
              {isSidebarCollapsed && (
                <span className="hidden lg:inline text-[10px] bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded-md font-bold transition-all">
                  Abrir menú
                </span>
              )}
            </button>

            <div className="flex items-center gap-2">
              <span className="hidden sm:inline-block w-1.5 h-1.5 rounded-full bg-blue-500" />
              <h2 className="font-bold text-slate-850 text-sm md:text-md uppercase tracking-tight font-sans">
                {getActiveTabLabel()}
              </h2>
            </div>
          </div>

          {/* Sync indicator + key shortcut details */}
          <div className="flex items-center gap-4">
            
            <div className="hidden md:flex items-center gap-3 bg-slate-50 border border-slate-200/50 px-3 py-1.5 rounded-xl text-xs text-slate-500">
              <span className="flex items-center gap-1.5 font-mono text-[10px]">
                🔑 Clave activa: <strong className="text-slate-700">{clinicalKey}</strong>
              </span>
            </div>

            {syncing ? (
              <span className="flex items-center gap-1.5 text-xs text-blue-600 bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-100 font-medium animate-pulse">
                <RefreshCw className="h-3.5 w-3.5 animate-spin text-blue-500" />
                <span className="hidden sm:inline">Guardando...</span>
              </span>
            ) : (
              <span className="flex items-center gap-1 text-[11px] text-emerald-600 bg-emerald-50 border border-emerald-100/60 px-2.5 py-1 rounded-lg font-mono">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block"></span>
                <span>Firebase Online</span>
              </span>
            )}
          </div>
        </header>

        {/* Content Scroll Area */}
        <div className="flex-1 p-4 md:p-8 overflow-y-auto min-h-0 bg-slate-100/30 custom-scrollbar">
          
          {loading ? (
            <div className="flex flex-col items-center justify-center py-24 text-slate-500 space-y-4 h-full">
              <svg className="animate-spin h-10 w-10 text-blue-600" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <div className="text-center">
                <p className="text-sm font-semibold text-slate-800">Cargando Sincronicidad Clínica...</p>
                <p className="text-xs text-slate-400 mt-1">Leyendo especificaciones en Google Firestore de manera ultrasegura</p>
              </div>
            </div>
          ) : (
            <div className="w-full space-y-6">
              
              {activeTab === "dashboard" && (
                <Dashboard pacientes={pacientes} lookups={lookups} />
              )}

              {activeTab === "pacientes_grid" && (
                <PatientsTable
                  pacientes={pacientes}
                  lookups={lookups}
                  onUpdatePaciente={handleUpdatePaciente}
                  onDeletePaciente={handleDeletePaciente}
                  onClearAllPacientes={handleClearAllPacientes}
                  encryptionKey={clinicalKey}
                  onSetEncryptionKey={setClinicalKey}
                  onNavigateToTab={setActiveTab}
                />
              )}

              {activeTab === "ingreso" && (
                <NuevoRegistro
                  lookups={lookups}
                  onAddPaciente={handleAddPaciente}
                  encryptionKey={clinicalKey}
                />
              )}

              {activeTab === "importor" && (
                <DataImporter
                  lookups={lookups}
                  pacientes={pacientes}
                  onRefreshData={fetchAllData}
                  onAddPaciente={handleAddPaciente}
                  onUpdatePaciente={handleUpdatePaciente}
                  onSaveLookup={handleSaveLookup}
                />
              )}

              {/* Unified Catalog Group views */}
              {activeTab === "grupo_personal" && (
                <LookupManager 
                  typesInGroup={["pjs", "medicos"]}
                  groupTitle="Personal PJS y Médicos"
                  lookups={lookups} 
                  onSaveItem={handleSaveLookup} 
                  onChangeStatus={handleChangeLookupStatus} 
                  onDeleteItem={handleDeleteLookup}
                  pacientes={pacientes}
                  onReassignPjs={handleReassignPjs}
                  onClearAllLookups={handleClearAllLookups}
                  onClearSingleLookup={handleClearSingleLookup}
                />
              )}

              {activeTab === "grupo_sedes" && (
                <LookupManager 
                  typesInGroup={["ciudades", "instituciones", "dispensaciones"]}
                  groupTitle="Sedes, Ciudades e Infraestructura"
                  lookups={lookups} 
                  onSaveItem={handleSaveLookup} 
                  onChangeStatus={handleChangeLookupStatus} 
                  onDeleteItem={handleDeleteLookup}
                  pacientes={pacientes}
                  onReassignPjs={handleReassignPjs}
                  onClearAllLookups={handleClearAllLookups}
                  onClearSingleLookup={handleClearSingleLookup}
                />
              )}

              {activeTab === "grupo_coberturas" && (
                <LookupManager 
                  typesInGroup={["aseguradoras", "distribuidores", "indicaciones", "dosis"]}
                  groupTitle="Tratamiento, Cobertura y Logística"
                  lookups={lookups} 
                  onSaveItem={handleSaveLookup} 
                  onChangeStatus={handleChangeLookupStatus} 
                  onDeleteItem={handleDeleteLookup}
                  pacientes={pacientes}
                  onReassignPjs={handleReassignPjs}
                  onClearAllLookups={handleClearAllLookups}
                  onClearSingleLookup={handleClearSingleLookup}
                />
              )}

              {/* SECTOR TAB - Detailed Overview Page */}
              {activeTab === "sector" && (
                <div className="bg-white rounded-2xl border border-slate-100 p-6 space-y-6 w-full animate-fade-in shadow-xs">
                  <div className="flex items-center gap-3 border-b border-slate-50 pb-4">
                    <Layers className="h-6 w-6 text-blue-600" />
                    <div>
                      <h2 className="text-lg font-bold text-slate-850 font-sans">Sectores de Salud en el Perú</h2>
                      <p className="text-xs text-slate-400 font-sans">Distribución normativa para expediente de resguardo clínico</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="p-5 bg-emerald-50/50 rounded-xl border border-emerald-100/50 flex flex-col justify-between">
                      <div>
                        <h3 className="font-bold text-sm text-emerald-800 mb-2">🏢 Sector Público</h3>
                        <p className="text-xs text-emerald-700 leading-relaxed">
                          Involucra entidades de salud estatales y previsión social centralizada tales como el Ministerio de Salud (MINSA), seguro social EsSalud, Fuerzas Armadas (FFAA) y Policía Nacional.
                        </p>
                      </div>
                      <div className="mt-4 pt-3 border-t border-emerald-200/50 flex justify-between items-center text-xs text-emerald-800 font-semibold font-mono">
                        <span>Total de Pacientes:</span>
                        <span className="text-sm font-bold">{pacientes.filter(p => p.sector === "Público").length}</span>
                      </div>
                    </div>

                    <div className="p-5 bg-blue-50/50 rounded-xl border border-blue-100/50 flex flex-col justify-between">
                      <div>
                        <h3 className="font-bold text-sm text-blue-800 mb-2">🏢 Sector Privado</h3>
                        <p className="text-xs text-blue-700 leading-relaxed">
                          Comprende clínicas privadas, laboratorios independientes, servicios con seguro particular (EPS) y provisión de salud financiada por mutuas o de manera particular por el paciente.
                        </p>
                      </div>
                      <div className="mt-4 pt-3 border-t border-blue-200/50 flex justify-between items-center text-xs text-blue-800 font-semibold font-mono">
                        <span>Total de Pacientes:</span>
                        <span className="text-sm font-bold">{pacientes.filter(p => p.sector === "Privado").length}</span>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 bg-slate-50/50 rounded-xl border border-slate-200/50 text-xs text-slate-500 leading-relaxed">
                    <span className="font-semibold text-slate-700 block mb-1">💡 Procedimiento administrativo</span>
                    Para asignar un sector específico a un paciente, diríjase a la pestaña de <strong>Ingreso de nuevo registro</strong> u ordene una corrección desde la <strong>Tabla de Pacientes</strong>. La categorización se actualiza automáticamente según las directivas.
                  </div>
                </div>
              )}

            </div>
          )}

          {/* Quick workspace footer */}
          <footer className="mt-16 pt-6 border-t border-slate-200/60 w-full flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-slate-400">
            <p>© 2026 Registros de Pacientes. Clínica Sante de Perú S.A.</p>
            <div className="flex items-center gap-3">
              <span className="h-2 w-2 rounded-full bg-emerald-500 inline-block animate-pulse"></span>
              <span className="font-mono text-[10px] uppercase tracking-wide">AES-256 Encriptación Hashing Asimétrica Activada</span>
            </div>
          </footer>

        </div>
      </main>

    </div>
  );
}
