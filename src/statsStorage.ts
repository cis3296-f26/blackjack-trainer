import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "./firebase";
import {
  emptyAccountStats,
  normalizeAccountStats,
  type AccountStats,
} from "./engine/stat";

// One document per account: userStats/{uid}
const statsDoc = (uid: string) => doc(db, "userStats", uid);

// A new account has no document yet, so it starts with empty stats
export async function loadStats(uid: string): Promise<AccountStats> {
  const snapshot = await getDoc(statsDoc(uid));
  return snapshot.exists()
    ? normalizeAccountStats(snapshot.data())
    : emptyAccountStats;
}

// Writes the whole stats document; updatedAt is set by the Firestore server
export function saveStats(uid: string, stats: AccountStats): Promise<void> {
  return setDoc(statsDoc(uid), { ...stats, updatedAt: serverTimestamp() });
}
