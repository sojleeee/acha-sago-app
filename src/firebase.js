import { initializeApp } from "firebase/app";
import {
  getFirestore,
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  getDoc,
  setDoc,
  onSnapshot,
  query,
  orderBy,
  where,
  getDocs,
} from "firebase/firestore";
import { getMessaging, getToken, onMessage, isSupported } from "firebase/messaging";

const firebaseConfig = {
  apiKey: "AIzaSyB3gvkt1Xi3DLGnK9IK8s3b4eLXSIstxnk",
  authDomain: "acha-sago.firebaseapp.com",
  projectId: "acha-sago",
  storageBucket: "acha-sago.firebasestorage.app",
  messagingSenderId: "843342964801",
  appId: "1:843342964801:web:ddc17feba7faa65044bec0",
};

const VAPID_KEY = "BG6MdqoALB9ha1F200gE-yIdF0vaMU1I0tQsY4wfn8NIv_Y9xTYGxrn2gu-fO7Snx1PRVi1iXlIA64iDJ4NFGVw";

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);

// 이 기기에서 처음 등록할 때 한 번 생성해서 계속 재사용하는 고유 ID
// (토큰 값이 바뀌어도 항상 같은 문서를 덮어써서, 기기당 알림 등록이 1개만 유지되도록)
function getDeviceId() {
  const KEY = "acha-device-id";
  let id = localStorage.getItem(KEY);
  if (!id) {
    id = `dev-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    localStorage.setItem(KEY, id);
  }
  return id;
}

// ── 푸시 알림(FCM) ──────────────────────────────────
let foregroundListenerRegistered = false; // onMessage 리스너 중복 등록 방지용

export async function registerForPush() {
  try {
    const supported = await isSupported();
    if (!supported) return { ok: false, reason: "이 브라우저는 푸시 알림을 지원하지 않아요." };

    if (typeof Notification === "undefined") return { ok: false, reason: "Notification API 자체가 없어요." };

    const permission = await Notification.requestPermission();
    if (permission !== "granted") return { ok: false, reason: `알림 권한이 "${permission}" 상태예요.` };

    let registration = await navigator.serviceWorker.register("/firebase-messaging-sw.js");
    // register()가 resolve돼도 아직 "활성화(active)" 전일 수 있어서(특히 최초 등록 시),
    // 활성화될 때까지 기다린다. navigator.serviceWorker.ready는 활성화된 워커를 보장한다.
    if (!registration.active) {
      registration = await navigator.serviceWorker.ready;
    }
    const messaging = getMessaging(app);
    const token = await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: registration,
    });

    if (!token) return { ok: false, reason: "토큰 발급에 실패했어요 (getToken이 빈 값 반환)." };

    const deviceId = getDeviceId();
    await setDoc(doc(db, "adminTokens", deviceId), {
      token,
      updatedAt: new Date().toISOString(),
    });
    // registerForPush()가 여러 번 호출돼도(자동 실행 + "알림 받기" 버튼 클릭 등)
    // 포그라운드 알림 리스너는 딱 한 번만 등록한다. 안 그러면 리스너가 중복 등록돼
    // 포그라운드에서 알림이 여러 번 뜬다.
    if (!foregroundListenerRegistered) {
      foregroundListenerRegistered = true;
      onMessage(messaging, (payload) => {
        // 앱이 켜져있을 때(포그라운드) 온 알림도 표시
        const title = payload.notification?.title || "아차사고 발굴";
        const body = payload.notification?.body || "새 신고가 접수되었습니다.";
        if (Notification.permission === "granted") {
          new Notification(title, { body, icon: "/icon-192.png" });
        }
      });
    }
    return { ok: true, token };
  } catch (e) {
    console.error("푸시 알림 등록 실패", e);
    return { ok: false, reason: `오류: ${e?.message || e}` };
  }
}

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

export async function getReport(id) {
  const snap = await getDoc(doc(db, "reports", id));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function deleteReport(id) {
  await deleteDoc(doc(db, "reports", id));
}

export async function getAllReports() {
  const snap = await getDocs(query(reportsCol));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

// 이름으로 아직 완료 안 한 "즉시 조치 가능" 신고를 찾습니다 (다른 기기에서 이어하기용)
export async function findActionReportsByName(name) {
  const q = query(reportsCol, where("reporterName", "==", name), where("status", "==", "action"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

// 디버그용: 서버(Cloud Function)가 마지막으로 알림을 시도했을 때 남긴 기록을 가져옵니다.
// Firestore 콘솔에 안 들어가도 앱 안에서 바로 확인할 수 있도록.
export async function getLastPushAttempt() {
  const snap = await getDoc(doc(db, "_debug", "lastPushAttempt"));
  return snap.exists() ? snap.data() : null;
}

// 디버그용: adminTokens 컬렉션에 지금 등록된 토큰이 몇 개인지 가져옵니다.
export async function getAdminTokenCount() {
  const snap = await getDocs(collection(db, "adminTokens"));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}
