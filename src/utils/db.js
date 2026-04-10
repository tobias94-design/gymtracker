import {
  collection, doc, setDoc, getDoc, getDocs,
  query, where, orderBy, deleteDoc, updateDoc, addDoc, serverTimestamp,
} from 'firebase/firestore';
import { db } from '../firebase';

// ─── Schedules ───────────────────────────────────────────────

export async function saveSchedule(userId, schedule) {
  const ref = doc(collection(db, 'users', userId, 'schedules'));
  await setDoc(ref, {
    ...schedule,
    createdAt: serverTimestamp(),
    active: true,
  });
  return ref.id;
}

export async function getSchedules(userId) {
  const q = query(
    collection(db, 'users', userId, 'schedules'),
    orderBy('createdAt', 'desc')
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function getSchedule(userId, scheduleId) {
  const snap = await getDoc(doc(db, 'users', userId, 'schedules', scheduleId));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function deleteSchedule(userId, scheduleId) {
  await deleteDoc(doc(db, 'users', userId, 'schedules', scheduleId));
}

// ─── Sessions (logged workouts) ───────────────────────────────

export async function saveSession(userId, session) {
  const ref = doc(collection(db, 'users', userId, 'sessions'));
  await setDoc(ref, {
    ...session,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function getSessions(userId) {
  const q = query(
    collection(db, 'users', userId, 'sessions'),
    orderBy('date', 'desc')
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function updateSession(userId, sessionId, data) {
  await updateDoc(doc(db, 'users', userId, 'sessions', sessionId), data);
}

export async function deleteSession(userId, sessionId) {
  await deleteDoc(doc(db, 'users', userId, 'sessions', sessionId));
}

// ─── User Profile ─────────────────────────────────────────────

export async function saveUserProfile(userId, data) {
  await setDoc(doc(db, 'users', userId), data, { merge: true });
}

export async function getUserProfile(userId) {
  const snap = await getDoc(doc(db, 'users', userId));
  return snap.exists() ? snap.data() : {};
}
