import { initializeApp } from "firebase/app";
import {
  getFirestore,
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  orderBy,
} from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyB3gvkt1Xi3DLGnK9IK8s3b4eLXSIstxnk",
  authDomain: "acha-sago.firebaseapp.com",
  projectId: "acha-sago",
  storageBucket: "acha-sago.firebasestorage.app",
  messagingSenderId: "843342964801",
  appId: "1:843342964801:web:ddc17feba7faa65044bec0",
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);

const reportsCol = collection(db, "reports");

// 실시간으로 신고 목록을 구독합니다. callback(reports) 형태로 최신 목록을 전달합니다.
export function subscribeReports(callback) {
  const q = query(reportsCol, orderBy("createdAt", "desc"));
  return onSnapshot(q, (snapshot) => {
    const reports = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
    callback(reports);
  });
}

export async function addReport(report) {
  const { id, ...data } = report;
  const ref = await addDoc(reportsCol, data);
  return ref.id;
}

export async function updateReport(id, patch) {
  await updateDoc(doc(db, "reports", id), patch);
}

export async function deleteReport(id) {
  await deleteDoc(doc(db, "reports", id));
}
