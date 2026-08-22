import { initializeApp, getApps, getApp } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  User as FirebaseUser
} from "firebase/auth";
import {
  getFirestore,
  doc,
  setDoc,
  deleteDoc,
  collection,
  onSnapshot,
  getDocFromServer,
  writeBatch
} from "firebase/firestore";
import firebaseConfig from "../../firebase-applet-config.json";
import { ExamStudyPlan, UserProfile } from "../types";

export const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: "select_account" });

export enum OperationType {
  CREATE = "create",
  UPDATE = "update",
  DELETE = "delete",
  LIST = "list",
  GET = "get",
  WRITE = "write",
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
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error("Firestore Error: ", JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export async function testFirestoreConnection() {
  try {
    if (auth.currentUser) {
      await getDocFromServer(doc(db, "users", auth.currentUser.uid));
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes("the client is offline")) {
      console.warn("Firestore client is offline, checking network configuration.");
    }
  }
}

export async function loginWithGoogle(): Promise<FirebaseUser> {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (error: any) {
    console.warn("Google sign in popup response:", error?.code || error?.message);
    throw error;
  }
}

export async function loginWithEmail(email: string, password: string): Promise<FirebaseUser> {
  try {
    const result = await signInWithEmailAndPassword(auth, email, password);
    return result.user;
  } catch (error: any) {
    console.warn("Firebase email login response:", error?.code || error?.message);
    throw error;
  }
}

export async function registerWithEmail(email: string, password: string, displayName?: string): Promise<FirebaseUser> {
  try {
    const result = await createUserWithEmailAndPassword(auth, email, password);
    if (displayName && result.user) {
      await updateProfile(result.user, { displayName });
    }
    return result.user;
  } catch (error: any) {
    console.warn("Firebase email register response:", error?.code || error?.message);
    throw error;
  }
}

export async function logoutUser(): Promise<void> {
  try {
    await signOut(auth);
  } catch (error: any) {
    console.error("Sign out failed:", error);
    throw error;
  }
}

export async function savePlanToCloud(userId: string, plan: ExamStudyPlan): Promise<void> {
  const planPath = `users/${userId}/plans/${plan.id}`;
  try {
    const planRef = doc(db, "users", userId, "plans", plan.id);
    const planData = {
      ...plan,
      userId,
      updatedAt: new Date().toISOString(),
    };
    await setDoc(planRef, planData, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, planPath);
  }
}

export async function deletePlanFromCloud(userId: string, planId: string): Promise<void> {
  const planPath = `users/${userId}/plans/${planId}`;
  try {
    const planRef = doc(db, "users", userId, "plans", planId);
    await deleteDoc(planRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, planPath);
  }
}

export async function saveUserProfileToCloud(userId: string, profile: UserProfile): Promise<void> {
  const userPath = `users/${userId}`;
  try {
    const userRef = doc(db, "users", userId);
    await setDoc(userRef, {
      ...profile,
      id: userId,
      updatedAt: new Date().toISOString(),
    }, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, userPath);
  }
}

export function subscribeToUserPlans(
  userId: string,
  onPlansChange: (plans: ExamStudyPlan[]) => void
): () => void {
  const plansCollectionPath = `users/${userId}/plans`;
  const plansCol = collection(db, "users", userId, "plans");

  const unsubscribe = onSnapshot(plansCol, (snapshot) => {
    const plans: ExamStudyPlan[] = [];
    snapshot.forEach((docSnap) => {
      plans.push(docSnap.data() as ExamStudyPlan);
    });

    plans.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
    onPlansChange(plans);
  }, (error) => {
    handleFirestoreError(error, OperationType.LIST, plansCollectionPath);
  });

  return unsubscribe;
}

export function subscribeToUserProfile(
  userId: string,
  onProfileChange: (profile: UserProfile) => void
): () => void {
  const userDocPath = `users/${userId}`;
  const userRef = doc(db, "users", userId);

  const unsubscribe = onSnapshot(userRef, (snapshot) => {
    if (snapshot.exists()) {
      onProfileChange(snapshot.data() as UserProfile);
    }
  }, (error) => {
    handleFirestoreError(error, OperationType.GET, userDocPath);
  });

  return unsubscribe;
}

export async function uploadLocalPlansToCloud(userId: string, plans: ExamStudyPlan[]): Promise<void> {
  if (!plans.length) return;
  const batch = writeBatch(db);
  for (const plan of plans) {
    const planRef = doc(db, "users", userId, "plans", plan.id);
    batch.set(planRef, {
      ...plan,
      userId,
      updatedAt: new Date().toISOString(),
    }, { merge: true });
  }
  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `users/${userId}/plans`);
  }
}
