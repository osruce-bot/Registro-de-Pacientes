import { 
  collection, 
  getDocs, 
  getDocsFromServer,
  setDoc, 
  doc, 
  updateDoc, 
  deleteDoc, 
  serverTimestamp,
  writeBatch,
  query,
  where
} from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "./firebase";
import { Paciente, LookupItem, LookupType, LOOKUPS_CONFIG, AppUser } from "./types";
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
 * Recursively removes any keys with `undefined` values from an object,
 * because Firestore writeBatch/setDoc crashes if any field is `undefined`.
 */
export function sanitizeForFirestore<T>(obj: T): T {
  if (obj === null || typeof obj !== "undefined" && typeof obj !== "object") {
    return obj;
  }
  if (obj === undefined) {
    return "" as unknown as T;
  }
  if (Array.isArray(obj)) {
    return obj.map(sanitizeForFirestore) as unknown as T;
  }
  const sanitized: any = {};
  for (const [key, value] of Object.entries(obj as Record<string, any>)) {
    if (value !== undefined) {
      sanitized[key] = sanitizeForFirestore(value);
    } else {
      sanitized[key] = "";
    }
  }
  return sanitized;
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
      let snap;
      try {
        snap = await getDocsFromServer(collection(db, path));
      } catch (e) {
        snap = await getDocs(collection(db, path));
      }

      if (!snap.empty) {
        // Cloud Firestore has lookups!
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

        // If Cloud only had markers and 0 real items, check local fallback
        if (items.length === 0) {
          const localItems = getLocalFallback<LookupItem[]>(`lookup_${type}`, []);
          const validLocal = localItems.filter(i => !i.id.startsWith("_"));
          if (validLocal.length > 0) {
            console.log(`Cloud Firestore lookups for ${type} was empty. Auto-pushing ${validLocal.length} local items to Cloud Firestore...`);
            const lookupsToSync = validLocal.map(item => ({ type, item }));
            await dbSavePacientesAndLookupsBatch([], lookupsToSync);
            items = validLocal;
          }
        }

        setLocalFallback(`lookup_${type}`, items);
      } else {
        // Cloud Firestore is empty for this lookup type. Populate default items on Cloud & Local.
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
            updatedAt: new Date().toISOString()
          });
          return node;
        });
        try {
          await batch.commit();
        } catch (batchErr) {
          console.warn(`Lookup defaults batch write failed for ${type}`, batchErr);
        }
        setLocalFallback(`lookup_${type}`, items);
      }
    } catch (err) {
      console.warn(`Firestore read failed for ${type}, utilizing localStorage fallback.`, err);
      items = getLocalFallback<LookupItem[]>(`lookup_${type}`, []);
    }

    lookupsData[type] = items.filter(item => !item.id.startsWith("_"));
  }

  // 2. Fetch Pacientes
  try {
    let snap;
    try {
      snap = await getDocsFromServer(collection(db, "pacientes"));
    } catch (e) {
      snap = await getDocs(collection(db, "pacientes"));
    }

    if (!snap.empty) {
      snap.forEach((doc) => {
        const d = doc.data();
        pacientesData.push({
          id: doc.id,
          nombre: d.nombre || "",
          apellido: d.apellido || "",
          pjsId: d.pjsId || "",
          pjsLabel: d.pjsLabel || d.pjs || "",
          ciudadId: d.ciudadId || "",
          ciudadLabel: d.ciudadLabel || d.ciudad || "",
          medicoId: d.medicoId || "",
          medicoLabel: d.medicoLabel || d.medico || "",
          aseguradoraId: d.aseguradoraId || "",
          aseguradoraLabel: d.aseguradoraLabel || d.aseguradora || d.seguro || "",
          sector: d.sector || "Privado",
          institucionId: d.institucionId || "",
          institucionLabel: d.institucionLabel || d.institucion || "",
          dispensacionId: d.dispensacionId || "",
          dispensacionLabel: d.dispensacionLabel || d.dispensacion || "",
          distribuidorId: d.distribuidorId || "",
          distribuidorLabel: d.distribuidorLabel || d.distribuidor || "",
          indicacionId: d.indicacionId || "",
          indicacionLabel: d.indicacionLabel || d.indicacion || "",
          dosisId: d.dosisId || "",
          dosisLabel: d.dosisLabel || d.dosis || "",
          notesEncrypted: d.notesEncrypted || "",
          lineaTratamiento: d.lineaTratamiento || d.lineaTto || d.linea_tratamiento || d.linea || "",
          fechaIngreso: d.fechaIngreso || d.fecha_ingreso || d.fecha || "",
          fechaBaja: d.fechaBaja || d.fecha_baja || "",
          createdAt: d.createdAt ? (d.createdAt.toDate ? d.createdAt.toDate().toISOString() : d.createdAt) : new Date().toISOString(),
          updatedAt: d.updatedAt ? (d.updatedAt.toDate ? d.updatedAt.toDate().toISOString() : d.updatedAt) : new Date().toISOString(),
          status: d.status || "active"
        });
      });

      // Update local storage only when Cloud Firestore returned actual patients!
      setLocalFallback("pacientes", pacientesData);
    } else {
      // Cloud Firestore is empty for patients. Check if local cache has patients to push to Cloud!
      const localPatients = getLocalFallback<Paciente[]>("pacientes", []);
      if (localPatients.length > 0) {
        console.log(`Cloud Firestore was empty for patients, but found ${localPatients.length} patients in local storage. Auto-pushing to Cloud Firestore...`);
        await dbSavePacientesAndLookupsBatch(localPatients, []);
        pacientesData = localPatients;
      } else {
        setLocalFallback("pacientes", []);
      }
    }
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
 * Synchronizes any locally cached patients and catalog lookups directly to Cloud Firestore.
 */
export async function dbSyncLocalStorageToCloud(): Promise<{ pacientesCount: number; lookupsCount: number }> {
  const localPatients = getLocalFallback<Paciente[]>("pacientes", []);
  const lookupsToSync: { type: LookupType; item: LookupItem }[] = [];

  const lookupKeys = Object.keys(LOOKUPS_CONFIG) as LookupType[];
  for (const type of lookupKeys) {
    const localItems = getLocalFallback<LookupItem[]>(`lookup_${type}`, []);
    localItems.forEach(item => {
      if (!item.id.startsWith("_")) {
        lookupsToSync.push({ type, item });
      }
    });
  }

  if (localPatients.length > 0 || lookupsToSync.length > 0) {
    console.log(`Syncing ${localPatients.length} local patients and ${lookupsToSync.length} lookups to Cloud Firestore...`);
    await dbSavePacientesAndLookupsBatch(localPatients, lookupsToSync);
  }

  return {
    pacientesCount: localPatients.length,
    lookupsCount: lookupsToSync.length
  };
}

/**
 * Saves multiple patients and lookups in Firestore using atomic batches.
 * Uses sanitizeForFirestore to prevent crashes on undefined field values.
 */
export async function dbSavePacientesAndLookupsBatch(
  newPacientes: Paciente[],
  newLookups: { type: LookupType; item: LookupItem }[]
): Promise<{ success: boolean; savedPacientes: Paciente[]; savedLookups: { type: LookupType; item: LookupItem }[] }> {
  const operations: { type: "paciente" | "lookup"; path: string; id: string; payload: any; metadata: any }[] = [];

  // Prepare patients payloads
  newPacientes.forEach(p => {
    const rawPayload = {
      ...p,
      createdAt: p.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    operations.push({
      type: "paciente",
      path: "pacientes",
      id: p.id,
      payload: sanitizeForFirestore(rawPayload),
      metadata: p
    });
  });

  // Prepare lookups payloads
  newLookups.forEach(l => {
    const config = LOOKUPS_CONFIG[l.type];
    const path = config.collectionName;
    const rawPayload = {
      nombre: l.item.nombre || "",
      apellido: l.item.apellido || "",
      status: l.item.status || "activo",
      updatedAt: new Date().toISOString()
    };
    operations.push({
      type: "lookup",
      path,
      id: l.item.id,
      payload: sanitizeForFirestore(rawPayload),
      metadata: l
    });
  });

  // Chunk operations into smaller groups of 100
  const chunkSize = 100;
  for (let i = 0; i < operations.length; i += chunkSize) {
    const chunk = operations.slice(i, i + chunkSize);
    const batch = writeBatch(db);

    chunk.forEach(op => {
      const docRef = doc(db, op.path, op.id);
      batch.set(docRef, op.payload);
    });

    try {
      await batch.commit();
      console.log(`Successfully committed batch of ${chunk.length} entries to Cloud Firestore.`);
    } catch (err) {
      console.warn("Firestore batch write failed. Attempting individual document writes...", err);
      // Fallback: Individual setDoc writes to ensure maximum resilience
      for (const op of chunk) {
        try {
          await setDoc(doc(db, op.path, op.id), op.payload);
        } catch (individualErr) {
          console.error(`Failed to write document ${op.path}/${op.id}:`, individualErr);
        }
      }
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
    const payload = sanitizeForFirestore({
      ...paciente,
      createdAt: paciente.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
    await setDoc(doc(db, path, docId), payload);
    console.log(`Saved Patient ${docId} successfully on Cloud Firestore.`);
  } catch (e) {
    console.warn("Firestore save failed, caching locally as fallback.", e);
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
    const payload = sanitizeForFirestore({
      nombre: item.nombre || "",
      apellido: item.apellido || "",
      status: item.status || "activo",
      updatedAt: new Date().toISOString()
    });
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
    let snap;
    try {
      snap = await getDocsFromServer(collection(db, "pacientes"));
    } catch (e) {
      snap = await getDocs(collection(db, "pacientes"));
    }
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
      let snap;
      try {
        snap = await getDocsFromServer(collection(db, path));
      } catch (e) {
        snap = await getDocs(collection(db, path));
      }
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
    let snap;
    try {
      snap = await getDocsFromServer(collection(db, path));
    } catch (e) {
      snap = await getDocs(collection(db, path));
    }
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

/**
 * Fetch all registered application users from Firestore with local fallback
 */
export async function dbGetAppUsers(): Promise<AppUser[]> {
  const DEFAULT_MASTER_ADMIN: AppUser = {
    id: "usr_mbraschi",
    username: "mbraschi",
    password: "Zafiro641",
    nombreCompleto: "Administrador (mbraschi)",
    rol: "admin",
    status: "activo",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  try {
    let snap;
    try {
      snap = await getDocsFromServer(collection(db, "app_users"));
    } catch (e) {
      snap = await getDocs(collection(db, "app_users"));
    }
    if (snap.empty) {
      // Seed master admin doc
      const docRef = doc(db, "app_users", DEFAULT_MASTER_ADMIN.id);
      await setDoc(docRef, {
        username: DEFAULT_MASTER_ADMIN.username,
        password: DEFAULT_MASTER_ADMIN.password,
        nombreCompleto: DEFAULT_MASTER_ADMIN.nombreCompleto,
        rol: DEFAULT_MASTER_ADMIN.rol,
        status: DEFAULT_MASTER_ADMIN.status,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      setLocalFallback("app_users", [DEFAULT_MASTER_ADMIN]);
      return [DEFAULT_MASTER_ADMIN];
    }

    const usersList: AppUser[] = [];
    snap.forEach((docSnap) => {
      const data = docSnap.data();
      usersList.push({
        id: docSnap.id,
        username: data.username || docSnap.id,
        password: data.password || "",
        nombreCompleto: data.nombreCompleto || data.username || "Usuario",
        rol: data.rol === "admin" ? "admin" : "usuario",
        status: data.status === "inactivo" ? "inactivo" : "activo",
        createdAt: data.createdAt ? (data.createdAt.toDate?.() || data.createdAt) : new Date().toISOString(),
        updatedAt: data.updatedAt ? (data.updatedAt.toDate?.() || data.updatedAt) : new Date().toISOString()
      });
    });

    // Ensure mbraschi master admin is always present in list
    const hasMaster = usersList.some(u => u.username.toLowerCase() === "mbraschi");
    if (!hasMaster) {
      usersList.unshift(DEFAULT_MASTER_ADMIN);
      dbSaveAppUser(DEFAULT_MASTER_ADMIN);
    }

    setLocalFallback("app_users", usersList);
    return usersList;
  } catch (err) {
    console.warn("Firestore fetch app_users failed, using local fallback", err);
    const local = getLocalFallback<AppUser[]>("app_users", [DEFAULT_MASTER_ADMIN]);
    if (!local.some(u => u.username.toLowerCase() === "mbraschi")) {
      local.unshift(DEFAULT_MASTER_ADMIN);
    }
    return local;
  }
}

/**
 * Save or update an app user in Firestore and local fallback
 */
export async function dbSaveAppUser(user: AppUser): Promise<AppUser> {
  const userDocId = user.id || `usr_${user.username.toLowerCase().trim()}`;
  const payload = {
    username: user.username.toLowerCase().trim(),
    password: user.password,
    nombreCompleto: user.nombreCompleto.trim(),
    rol: user.rol,
    status: user.status,
    updatedAt: serverTimestamp()
  };

  const updatedUser: AppUser = {
    ...user,
    id: userDocId,
    username: payload.username,
    nombreCompleto: payload.nombreCompleto,
    updatedAt: new Date().toISOString()
  };

  try {
    const docRef = doc(db, "app_users", userDocId);
    await setDoc(docRef, {
      ...payload,
      createdAt: user.createdAt || serverTimestamp()
    }, { merge: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `app_users/${userDocId}`);
  }

  // Sync local fallback
  const currentUsers = getLocalFallback<AppUser[]>("app_users", []);
  const idx = currentUsers.findIndex(u => u.id === userDocId || u.username.toLowerCase() === payload.username);
  if (idx >= 0) {
    currentUsers[idx] = updatedUser;
  } else {
    currentUsers.push(updatedUser);
  }
  setLocalFallback("app_users", currentUsers);

  return updatedUser;
}

/**
 * Delete an app user from Firestore and local fallback
 */
export async function dbDeleteAppUser(id: string, username?: string): Promise<void> {
  const cleanUsername = username ? username.toLowerCase().trim() : "";

  // 1. Delete from Firestore
  try {
    if (id) {
      await deleteDoc(doc(db, "app_users", id));
    }
    if (cleanUsername) {
      const altId = `usr_${cleanUsername}`;
      if (altId !== id) {
        try {
          await deleteDoc(doc(db, "app_users", altId));
        } catch (_) {}
      }
      try {
        const snap = await getDocs(collection(db, "app_users"));
        if (!snap.empty) {
          const batch = writeBatch(db);
          let count = 0;
          snap.forEach((d) => {
            const data = d.data();
            if (
              d.id === id || 
              d.id === altId || 
              (data.username && String(data.username).toLowerCase().trim() === cleanUsername)
            ) {
              batch.delete(d.ref);
              count++;
            }
          });
          if (count > 0) {
            await batch.commit();
          }
        }
      } catch (errSnap) {
        console.warn("Batch delete app_users warning:", errSnap);
      }
    }
  } catch (err) {
    console.warn("Firestore delete user note:", err);
  }

  // 2. Clean local fallback storage
  const currentUsers = getLocalFallback<AppUser[]>("app_users", []);
  const filtered = currentUsers.filter(
    (u) => u.id !== id && (!cleanUsername || u.username.toLowerCase().trim() !== cleanUsername)
  );
  setLocalFallback("app_users", filtered);
}



