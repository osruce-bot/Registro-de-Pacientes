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

