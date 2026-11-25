export interface AppUser {
  id: string; // Document ID (e.g., usr_mbraschi or usr_123)
  username: string; // Unique login username (lowercase)
  password: string; // Password
  nombreCompleto: string; // Full display name
  rol: "admin" | "usuario"; // Admin (mbraschi) vs standard User
  status: "activo" | "inactivo";
  createdAt?: any;
  updatedAt?: any;
}

export interface Paciente {
  id: string; // Patient Document ID
  nombre: string;
  apellido: string;
  pjsId: string;
  pjsLabel: string;
  ciudadId: string;
  ciudadLabel: string;
  medicoId: string;
  medicoLabel: string;
  aseguradoraId: string;
  aseguradoraLabel: string;
  sector: "Público" | "Privado";
  institucionId: string;
  institucionLabel: string;
  dispensacionId: string;
  dispensacionLabel: string;
  distribuidorId: string;
  distribuidorLabel: string;
  indicacionId: string;
  indicacionLabel: string;
  dosisId: string;
  dosisLabel: string;
  notesEncrypted: string; // Obfuscated/encrypted clinical notes
  lineaTratamiento?: string; // Line of treatment
  fechaIngreso?: string; // Date of entry
  fechaBaja?: string; // Date of exit/withdrawal
  createdAt: any; // Firestore Timestamp or ISO string
  updatedAt: any;
  status: "active" | "inactive";
}

export interface LookupItem {
  id: string;
  nombre: string;
  apellido?: string; // Optional for Medicos / PJS
  status: "activo" | "baja";
  updatedAt?: any;
}

export type LookupType =
  | "pjs"
  | "ciudades"
  | "medicos"
  | "aseguradoras"
  | "instituciones"
  | "dispensaciones"
  | "distribuidores"
  | "indicaciones"
  | "dosis";

export interface LookupConfig {
  id: LookupType;
  title: string;
  pluralLabel: string;
  hasSurname: boolean;
  collectionName: string;
}

export const LOOKUPS_CONFIG: Record<LookupType, LookupConfig> = {
  pjs: {
    id: "pjs",
    title: "PJS",
    pluralLabel: "Miembros PJS",
    hasSurname: true,
    collectionName: "pjs",
  },
  ciudades: {
    id: "ciudades",
    title: "Ciudad del Perú",
    pluralLabel: "Ciudades del Perú",
    hasSurname: false,
    collectionName: "ciudades",
  },
  medicos: {
    id: "medicos",
    title: "Médico",
    pluralLabel: "Médicos",
    hasSurname: true,
    collectionName: "medicos",
  },
  aseguradoras: {
    id: "aseguradoras",
    title: "Aseguradora",
    pluralLabel: "Aseguradoras",
    hasSurname: false,
    collectionName: "aseguradoras",
  },
  instituciones: {
    id: "instituciones",
    title: "Institución",
    pluralLabel: "Instituciones",
    hasSurname: false,
    collectionName: "instituciones",
  },
  dispensaciones: {
    id: "dispensaciones",
    title: "Dispensación",
    pluralLabel: "Dispensaciones",
    hasSurname: false,
    collectionName: "dispensaciones",
  },
  distribuidores: {
    id: "distribuidores",
    title: "Distribuidor",
    pluralLabel: "Distribuidores",
    hasSurname: false,
    collectionName: "distribuidores",
  },
  indicaciones: {
    id: "indicaciones",
    title: "Indicación",
    pluralLabel: "Indicaciones",
    hasSurname: false,
    collectionName: "indicaciones",
  },
  dosis: {
    id: "dosis",
    title: "Dosis",
    pluralLabel: "Dosis",
    hasSurname: false,
    collectionName: "dosis",
  },
};

export interface FilterState {
  searchTerm: string;
  selectedSector: "Todos" | "Público" | "Privado";
  selectedPjs: string;
  selectedCiudad: string;
  selectedMedico: string;
  selectedAseguradora: string;
  selectedInstitucion: string;
  selectedDispensacion: string;
  selectedDistribuidor: string;
  selectedIndicacion: string;
  selectedDosis: string;
}

export const INITIAL_FILTERS: FilterState = {
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
};

export function getFilteredPacientes(pacientes: Paciente[], filters: FilterState): Paciente[] {
  return pacientes.filter((p) => {
    const query = filters.searchTerm.toLowerCase().trim();
    const matchSearch = 
      query === "" ||
      p.id.toLowerCase().includes(query) ||
      p.nombre.toLowerCase().includes(query) ||
      p.apellido.toLowerCase().includes(query) ||
      (p.ciudadLabel && p.ciudadLabel.toLowerCase().includes(query)) ||
      (p.medicoLabel && p.medicoLabel.toLowerCase().includes(query));

    const matchSector = filters.selectedSector === "Todos" || p.sector === filters.selectedSector;
    const matchPjs = filters.selectedPjs === "Todos" || p.pjsId === filters.selectedPjs;
    const matchCiudad = filters.selectedCiudad === "Todos" || p.ciudadId === filters.selectedCiudad;
    const matchMedico = filters.selectedMedico === "Todos" || p.medicoId === filters.selectedMedico;
    const matchAseguradora = filters.selectedAseguradora === "Todos" || p.aseguradoraId === filters.selectedAseguradora;
    const matchInstitucion = filters.selectedInstitucion === "Todos" || p.institucionId === filters.selectedInstitucion;
    const matchDispensacion = filters.selectedDispensacion === "Todos" || p.dispensacionId === filters.selectedDispensacion;
    const matchDistribuidor = filters.selectedDistribuidor === "Todos" || p.distribuidorId === filters.selectedDistribuidor;
    const matchIndicacion = filters.selectedIndicacion === "Todos" || p.indicacionId === filters.selectedIndicacion;
    const matchDosis = filters.selectedDosis === "Todos" || p.dosisId === filters.selectedDosis;

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
  });
}

export function capitalizeProperName(str: string): string {
  if (!str) return "";
  return str
    .split(" ")
    .map((word) => {
      if (!word) return "";
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(" ");
}

export function isPacienteActivo(p: Paciente): boolean {
  const statusVal = String(p.status || "").toLowerCase();
  const isInactive = statusVal === "inactive" || statusVal === "inactivo" || statusVal === "baja";
  const hasFechaBaja = Boolean(
    p.fechaBaja &&
    p.fechaBaja.trim() !== "" &&
    p.fechaBaja.trim().toLowerCase() !== "no tiene"
  );
  return !isInactive && !hasFechaBaja;
}


