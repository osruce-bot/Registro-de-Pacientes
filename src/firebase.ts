import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { 
  initializeFirestore, 
  persistentLocalCache, 
  persistentMultipleTabManager,
  doc, 
  getDocFromServer
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);

// Initialize Firestore with live server connection (no aggressive IndexedDB persistence to avoid stale browser caching across sessions)
export const db = initializeFirestore(app, {}, firebaseConfig.firestoreDatabaseId);

export const auth = getAuth();

/**
 * Validates connection to the Firestore backend.
 * Warns cleanly if backend is currently unreachable.
 */
export async function testFirestoreConnection(): Promise<boolean> {
  try {
    // Attempt a lightweight server-only read to check real-time online status
    await getDocFromServer(doc(db, '_connection_test_', 'ping'));
    return true;
  } catch (error) {
    if (error instanceof Error && (error.message.includes('offline') || error.message.includes('unavailable') || error.message.includes('Could not reach'))) {
      console.warn("Firestore service is currently operating in offline/cached fallback mode.", error.message);
    } else {
      console.warn("Firestore connection check noted alternative response status:", error);
    }
    return false;
  }
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
  }
}

/**
 * Standardized Firebase Error Handler required to catch permission gaps and quota blocks
 */
export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid || "guest_simulated",
      email: auth.currentUser?.email || "guest@clinica.pe",
      emailVerified: auth.currentUser?.emailVerified || false,
      isAnonymous: auth.currentUser?.isAnonymous || true,
    },
    operationType,
    path
  };
  console.error('Firestore Error Incident: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}
