import { 
  collection, 
  getDocs, 
  setDoc, 
  doc, 
  updateDoc, 
  deleteDoc, 
  serverTimestamp,
  writeBatch
} from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "./firebase";
import { Paciente, LookupItem, LookupType, LOOKUPS_CONFIG } from "./types";
import { 
  DEFAULT_ASEGURADORAS, 
  DEFAULT_CIUDADES, 
  DEFAULT_DISPENSACIONES, 
  DEFAULT_DISTRIBUIDORES, 
  DEFAULT_DOSIS, 
  DEFAULT_INDICACIONES, 
  DEFAULT_INSTITUCIONES, 
  DEFAULT_MEDICOS, 
  DEFAULT_PJS 
} from "./data";

// Fallback key-value storage in localStorage if Cloud Firestore is blocked or loading
const LOCAL_STORAGE_PREFIX = "registros_pacientes_";

export function getLocalFallback<T>(key: string, defaultValue: T): T {
  try {
    const data = localStorage.getItem(LOCAL_STORAGE_PREFIX + key);
    return data ? JSON.parse(data) : defaultValue;
  } catch (e) {
    return defaultValue;
  }
}

export function setLocalFallback<T>(key: string, value: T): void {
  try {
    localStorage.setItem(LOCAL_STORAGE_PREFIX + key, JSON.stringify(value));
  } catch (e) {}
}

/**
 * Checks if lookups exist. If not, populates Firestore with elegant default Peru data.
 */
export async function initializeFirestoreDefaults(): Promise<{
  pacientes: Paciente[];
  lookups: Record<LookupType, LookupItem[]>;
}> {
  const lookupsData: Record<LookupType, LookupItem[]> = {} as any;
  let pacientesData: Paciente[] = [];

  // 1. Fetch lookups
  for (const type of Object.keys(LOOKUPS_CONFIG) as LookupType[]) {
    const config = LOOKUPS_CONFIG[type];
    const path = config.collectionName;
    let items: LookupItem[] = [];

    try {
      const snap = await getDocs(collection(db, path));
      if (snap.empty) {
        // Populating defaults
        console.log(`Populating defaults for lookup: ${type}`);
        let defaults: any[] = [];
        if (type === "ciudades") defaults = DEFAULT_CIUDADES;
        else if (type === "medicos") defaults = DEFAULT_MEDICOS;
        else if (type === "pjs") defaults = DEFAULT_PJS;
        else if (type === "aseguradoras") defaults = DEFAULT_ASEGURADORAS;
        else if (type === "instituciones") defaults = DEFAULT_INSTITUCIONES;
        else if (type === "dispensaciones") defaults = DEFAULT_DISPENSACIONES;
        else if (type === "distribuidores") defaults = DEFAULT_DISTRIBUIDORES;
        else if (type === "indicaciones") defaults = DEFAULT_INDICACIONES;
        else if (type === "dosis") defaults = DEFAULT_DOSIS;

        const batch = writeBatch(db);
        items = defaults.map((item, idx) => {
          const id = `${type}_default_${idx}`;
          const isObject = typeof item === "object";
          const node: any = {
            id,
            nombre: isObject ? item.nombre : String(item),
            status: "activo",
            updatedAt: new Date().toISOString()
          };
          if (isObject && item.apellido) {
            node.apellido = item.apellido;
          }
          
          const docRef = doc(db, path, id);
          batch.set(docRef, {
            nombre: node.nombre,
            apellido: node.apellido || "",
            status: "activo",
            updatedAt: serverTimestamp()
          });
          return node;
        });
        await batch.commit();
      } else {
        snap.forEach((doc) => {
          if (doc.id.startsWith("_")) return; // Skip internal system markers
          const d = doc.data();
          items.push({
            id: doc.id,
            nombre: d.nombre || "",
            apellido: d.apellido || "",
            status: d.status || "activo",
            updatedAt: d.updatedAt ? (d.updatedAt.toDate ? d.updatedAt.toDate().toISOString() : d.updatedAt) : new Date().toISOString()
          });
        });
      }

      // Merge with local fallback to preserve any unsynced lookup items
      const local = getLocalFallback<LookupItem[]>(`lookup_${type}`, []);
      const mergedLookupMap = new Map<string, LookupItem>();
      local.forEach(item => mergedLookupMap.set(item.id, item));
      items.forEach(item => mergedLookupMap.set(item.id, item));
      const combinedItems = Array.from(mergedLookupMap.values());
      
      setLocalFallback(`lookup_${type}`, combinedItems);
      items = combinedItems;
    } catch (err) {
      console.warn(`Firestore read failed for ${type}, utilizing localStorage fallback.`, err);
      // Fallback to local
      const local = getLocalFallback<LookupItem[]>(`lookup_${type}`, []);
      if (local.length === 0) {
        // Generate defaults locally
        let defaults: any[] = [];
        if (type === "ciudades") defaults = DEFAULT_CIUDADES;
        else if (type === "medicos") defaults = DEFAULT_MEDICOS;
        else if (type === "pjs") defaults = DEFAULT_PJS;
        else if (type === "aseguradoras") defaults = DEFAULT_ASEGURADORAS;
        else if (type === "instituciones") defaults = DEFAULT_INSTITUCIONES;
        else if (type === "dispensaciones") defaults = DEFAULT_DISPENSACIONES;
        else if (type === "distribuidores") defaults = DEFAULT_DISTRIBUIDORES;
        else if (type === "indicaciones") defaults = DEFAULT_INDICACIONES;
        else if (type === "dosis") defaults = DEFAULT_DOSIS;

        items = defaults.map((item, idx) => {
          const isObject = typeof item === "object";
          return {
            id: `${type}_default_${idx}`,
            nombre: isObject ? item.nombre : String(item),
            apellido: isObject ? item.apellido : undefined,
            status: "activo",
            updatedAt: new Date().toISOString()
          };
        });
        setLocalFallback(`lookup_${type}`, items);
      } else {
        items = local;
      }
    }
    lookupsData[type] = items.filter(item => !item.id.startsWith("_"));
  }

  // 2. Fetch Pacientes
  try {
    const snap = await getDocs(collection(db, "pacientes"));
    snap.forEach((doc) => {
      const d = doc.data();
      pacientesData.push({
        id: doc.id,
        nombre: d.nombre || "",
        apellido: d.apellido || "",
        pjsId: d.pjsId || "",
        pjsLabel: d.pjsLabel || "",
        ciudadId: d.ciudadId || "",
        ciudadLabel: d.ciudadLabel || "",
        medicoId: d.medicoId || "",
        medicoLabel: d.medicoLabel || "",
        aseguradoraId: d.aseguradoraId || "",
        aseguradoraLabel: d.aseguradoraLabel || "",
        sector: d.sector || "Privado",
        institucionId: d.institucionId || "",
        institucionLabel: d.institucionLabel || "",
        dispensacionId: d.dispensacionId || "",
        dispensacionLabel: d.dispensacionLabel || "",
        distribuidorId: d.distribuidorId || "",
        distribuidorLabel: d.distribuidorLabel || "",
        indicacionId: d.indicacionId || "",
        indicacionLabel: d.indicacionLabel || "",
        dosisId: d.dosisId || "",
        dosisLabel: d.dosisLabel || "",
        notesEncrypted: d.notesEncrypted || "",
        fechaIngreso: d.fechaIngreso || "",
        fechaBaja: d.fechaBaja || "",
        createdAt: d.createdAt ? (d.createdAt.toDate ? d.createdAt.toDate().toISOString() : d.createdAt) : new Date().toISOString(),
        updatedAt: d.updatedAt ? (d.updatedAt.toDate ? d.updatedAt.toDate().toISOString() : d.updatedAt) : new Date().toISOString(),
        status: d.status || "active"
      });
    });

    // Save fetched/merged to local for hybrid offline resilience
    const localPatients = getLocalFallback<Paciente[]>("pacientes", []);
    const mergedMap = new Map<string, Paciente>();
    localPatients.forEach(p => mergedMap.set(p.id, p));
    pacientesData.forEach(p => mergedMap.set(p.id, p));
    
    const finalList = Array.from(mergedMap.values());
    setLocalFallback("pacientes", finalList);
    pacientesData = finalList;
  } catch (err) {
    console.warn("Firestore patient retrieval failed, fetching cached local registers.", err);
    pacientesData = getLocalFallback<Paciente[]>("pacientes", []);
  }

  return {
    pacientes: pacientesData,
    lookups: lookupsData
  };
}

/**
 * Saves multiple patients and lookups in Firestore using atomic batches.
 * This resolves the severe visual bottleneck of saving 160+ items sequentially.
 */
export async function dbSavePacientesAndLookupsBatch(
  newPacientes: Paciente[],
  newLookups: { type: LookupType; item: LookupItem }[]
): Promise<{ success: boolean; savedPacientes: Paciente[]; savedLookups: { type: LookupType; item: LookupItem }[] }> {
  const operations: { type: "paciente" | "lookup"; path: string; id: string; payload: any; metadata: any }[] = [];

  // Prepare patients payloads
  newPacientes.forEach(p => {
    const payload = {
      ...p,
      createdAt: p.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    operations.push({
      type: "paciente",
      path: "pacientes",
      id: p.id,
      payload,
      metadata: p
    });
  });

  // Prepare lookups payloads
  newLookups.forEach(l => {
    const config = LOOKUPS_CONFIG[l.type];
    const path = config.collectionName;
    const payload = {
      nombre: l.item.nombre,
      apellido: l.item.apellido || "",
      status: l.item.status || "activo",
      updatedAt: new Date().toISOString()
    };
    operations.push({
      type: "lookup",
      path,
      id: l.item.id,
      payload,
      metadata: l
    });
  });

  // Chunk operations into groups of 300 to respect Firestore batch limit and network budgets
  const chunkSize = 300;
  for (let i = 0; i < operations.length; i += chunkSize) {
    const chunk = operations.slice(i, i + chunkSize);
    const batch = writeBatch(db);

    chunk.forEach(op => {
      const docRef = doc(db, op.path, op.id);
      batch.set(docRef, op.payload);
    });

    try {
      await batch.commit();
      console.log(`Successfully committed batch of ${chunk.length} entries to Firestore.`);
    } catch (err) {
      console.warn("Firestore batch commission failed, falling back locally.", err);
    }
  }

  // Update localStorage in parallel for local fallbacks to sustain hybrid offline consistency
  if (newPacientes.length > 0) {
    const localPatients = getLocalFallback<Paciente[]>("pacientes", []);
    const mergedPatientsMap = new Map<string, Paciente>();
    localPatients.forEach(p => mergedPatientsMap.set(p.id, p));
    newPacientes.forEach(p => {
      const updatedItem = {
        ...p,
        createdAt: p.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      mergedPatientsMap.set(p.id, updatedItem);
    });
    setLocalFallback("pacientes", Array.from(mergedPatientsMap.values()));
  }

  // Update local lookups
  const lookupsUpdatedGroup: Record<LookupType, LookupItem[]> = {} as any;
  newLookups.forEach(l => {
    if (!lookupsUpdatedGroup[l.type]) {
      lookupsUpdatedGroup[l.type] = getLocalFallback<LookupItem[]>(`lookup_${l.type}`, []);
    }
    const list = lookupsUpdatedGroup[l.type];
    const idx = list.findIndex(item => item.id === l.item.id);
    const updatedCatalogItem = {
      ...l.item,
      updatedAt: new Date().toISOString()
    };
    if (idx >= 0) {
      list[idx] = updatedCatalogItem;
    } else {
      list.push(updatedCatalogItem);
    }
  });

  // Commit updated lookups to localStorage
  Object.keys(lookupsUpdatedGroup).forEach(typeKey => {
    setLocalFallback(`lookup_${typeKey}`, lookupsUpdatedGroup[typeKey as LookupType]);
  });

  return {
    success: true,
    savedPacientes: newPacientes,
    savedLookups: newLookups
  };
}

/**
 * Saves a patient medical entry to Firestore with rollback fallback
 */
export async function dbSavePaciente(paciente: Paciente): Promise<Paciente> {
  const path = "pacientes";
  const docId = paciente.id;

  try {
    const payload = {
      ...paciente,
      createdAt: paciente.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    await setDoc(doc(db, path, docId), payload);
    console.log(`Saved Patient ${docId} successfully on Cloud Firestore.`);
  } catch (e) {
    console.warn("Firestore save failed, caching locally as fallback.", e);
    // Explicitly handle & trace firestore error according to security rule requirements
    try {
      handleFirestoreError(e, OperationType.WRITE, `${path}/${docId}`);
    } catch (handledError) {
      console.error("Firestore specific diagnostic info: ", handledError);
    }
  }

  // Always update locally for hybrid consistency
  const list = getLocalFallback<Paciente[]>("pacientes", []);
  const index = list.findIndex(p => p.id === docId);
  const updatedItem = {
    ...paciente,
    createdAt: paciente.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  
  if (index >= 0) {
    list[index] = updatedItem;
  } else {
    list.push(updatedItem);
  }
  setLocalFallback("pacientes", list);
  return updatedItem;
}

/**
 * Updates a lookup item's state or is used to create one in Cloud Firestore
 */
export async function dbSaveLookupItem(
  type: LookupType, 
  item: LookupItem
): Promise<LookupItem> {
  const config = LOOKUPS_CONFIG[type];
  const path = config.collectionName;
  const docId = item.id;

  try {
    const payload: any = {
      nombre: item.nombre,
      status: item.status,
      updatedAt: serverTimestamp()
    };
    if (item.apellido !== undefined) {
      payload.apellido = item.apellido;
    }
    await setDoc(doc(db, path, docId), payload);
  } catch (e) {
    console.warn(`Firestore lookup write failed for ${type}. Saving local fallback copy.`, e);
    try {
      handleFirestoreError(e, OperationType.WRITE, `${path}/${docId}`);
    } catch (h) {}
  }

  // Local fallback
  const list = getLocalFallback<LookupItem[]>(`lookup_${type}`, []);
  const index = list.findIndex(i => i.id === docId);
  const updatedItem = {
    ...item,
    updatedAt: new Date().toISOString()
  };

  if (index >= 0) {
    list[index] = updatedItem;
  } else {
    list.push(updatedItem);
  }
  setLocalFallback(`lookup_${type}`, list);
  return updatedItem;
}

/**
 * Changes lookup state (deactivates / retires it "Dar de baja")
 */
export async function dbChangeLookupStatus(
  type: LookupType,
  id: string,
  newStatus: "activo" | "baja"
): Promise<void> {
  const config = LOOKUPS_CONFIG[type];
  const path = config.collectionName;

  try {
    await updateDoc(doc(db, path, id), {
      status: newStatus,
      updatedAt: serverTimestamp()
    });
  } catch (e) {
    console.warn(`Firestore update status failed for ${type}, editing local storage state.`, e);
    try {
      handleFirestoreError(e, OperationType.UPDATE, `${path}/${id}`);
    } catch (h) {}
  }

  // Local state sync
  const list = getLocalFallback<LookupItem[]>(`lookup_${type}`, []);
  const index = list.findIndex(item => item.id === id);
  if (index >= 0) {
    list[index].status = newStatus;
    list[index].updatedAt = new Date().toISOString();
    setLocalFallback(`lookup_${type}`, list);
  }
}

/**
 * Deletes a lookup item entirely from Cloud and local storage
 */
export async function dbDeleteLookupItem(
  type: LookupType,
  id: string
): Promise<void> {
  const config = LOOKUPS_CONFIG[type];
  const path = config.collectionName;

  try {
    await deleteDoc(doc(db, path, id));
  } catch (e) {
    console.warn(`Firestore delete failed for ${type} ID ${id}. Synchronizing local mirror state.`, e);
    try {
      handleFirestoreError(e, OperationType.DELETE, `${path}/${id}`);
    } catch (h) {}
  }

  // Local state sync
  const list = getLocalFallback<LookupItem[]>(`lookup_${type}`, []);
  const filtered = list.filter(item => item.id !== id);
  setLocalFallback(`lookup_${type}`, filtered);
}

/**
 * Remove patient record entirely from Cloud
 */
export async function dbDeletePaciente(id: string): Promise<void> {
  try {
    await deleteDoc(doc(db, "pacientes", id));
  } catch (e) {
    console.warn(`Firestore delete doc failed for Patient ID ${id}. Synchronizing local mirror state.`, e);
    try {
      handleFirestoreError(e, OperationType.DELETE, `pacientes/${id}`);
    } catch (h) {}
  }

  // Local
  const list = getLocalFallback<Paciente[]>("pacientes", []);
  const filtered = list.filter(p => p.id !== id);
  setLocalFallback("pacientes", filtered);
}

/**
 * Remove ALL patient records entirely from Cloud (with server-side query and batch delete) and local fallback
 */
export async function dbClearAllPacientesOnCloud(): Promise<void> {
  try {
    const snap = await getDocs(collection(db, "pacientes"));
    const batch = writeBatch(db);
    snap.forEach((docSnap) => {
      batch.delete(doc(db, "pacientes", docSnap.id));
    });
    await batch.commit();
    console.log("All patients deleted from Cloud Firestore successfully.");
  } catch (e) {
    console.warn("Firestore collection batch delete failed, running manual deletes on local list.", e);
  }

  // Clear local mirror
  setLocalFallback("pacientes", []);
}

/**
 * Remove ALL lookup records entirely from Cloud and local storage for all catalog tables
 */
export async function dbClearAllLookupsOnCloud(): Promise<void> {
  const types = Object.keys(LOOKUPS_CONFIG) as LookupType[];
  for (const type of types) {
    const config = LOOKUPS_CONFIG[type];
    const path = config.collectionName;
    try {
      const snap = await getDocs(collection(db, path));
      const batch = writeBatch(db);
      snap.forEach((docSnap) => {
        batch.delete(doc(db, path, docSnap.id));
      });
      // Write system marker doc to prevent auto-repopulating defaults on next reload
      const markerRef = doc(db, path, "_database_initialized_marker_");
      batch.set(markerRef, {
        nombre: "SYSTEM_MARKER",
        status: "activo",
        updatedAt: serverTimestamp()
      });
      await batch.commit();
      console.log(`All items for lookup type ${type} deleted from Firestore (marker placed).`);
    } catch (e) {
      console.warn(`Firestore batch delete for lookup type ${type} failed.`, e);
    }
    // Clear local mirror with marker for consistency
    const markerItem: LookupItem = {
      id: "_database_initialized_marker_",
      nombre: "SYSTEM_MARKER",
      status: "activo",
      updatedAt: new Date().toISOString()
    };
    setLocalFallback(`lookup_${type}`, [markerItem]);
  }
}

/**
 * Remove ALL records for a single lookup category from Cloud and local storage
 */
export async function dbClearSingleLookupOnCloud(type: LookupType): Promise<void> {
  const config = LOOKUPS_CONFIG[type];
  const path = config.collectionName;
  try {
    const snap = await getDocs(collection(db, path));
    const batch = writeBatch(db);
    snap.forEach((docSnap) => {
      batch.delete(doc(db, path, docSnap.id));
    });
    // Write system marker doc to prevent auto-repopulating defaults on next reload
    const markerRef = doc(db, path, "_database_initialized_marker_");
    batch.set(markerRef, {
      nombre: "SYSTEM_MARKER",
      status: "activo",
      updatedAt: serverTimestamp()
    });
    await batch.commit();
    console.log(`Successfully cleared lookup ${type} from Firestore (marker placed).`);
  } catch (e) {
    console.warn(`Firestore batch delete for lookup type ${type} failed.`, e);
  }

  // Clear local mirror with marker for consistency
  const markerItem: LookupItem = {
    id: "_database_initialized_marker_",
    nombre: "SYSTEM_MARKER",
    status: "activo",
    updatedAt: new Date().toISOString()
  };
  setLocalFallback(`lookup_${type}`, [markerItem]);
}


