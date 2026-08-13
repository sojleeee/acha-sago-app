const { onDocumentCreated, onDocumentUpdated } = require("firebase-functions/v2/firestore");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const { getMessaging } = require("firebase-admin/messaging");

initializeApp();
const db = getFirestore();

async function sendToAdmins(report, statusLabel) {
  const tokensSnap = await db.collection("adminTokens").get();
  const tokens = tokensSnap.docs.map((d) => d.id);

  // Firestore에 이번 발송 시도의 결과를 남긴다. Firestore 콘솔에서 바로 눈으로
  // 확인할 수 있어서, Cloud Logging(로그 탐색기)보다 훨씬 확인하기 쉽다.
  const debugRef = db.collection("_debug").doc("lastPushAttempt");

  if (tokens.length === 0) {
    await debugRef.set({
      attemptedAt: new Date().toISOString(),
      statusLabel,
      tokenCount: 0,
      note: "adminTokens 컬렉션이 비어있어서 아무것도 보내지 않음",
    });
    return;
  }

  const hazardText = report.hazardLabel || report.hazard || "위험 상황";
  const message = {
    notification: {
      title: `아차사고 발굴 - ${statusLabel}`,
      body: `${hazardText} · ${report.location || ""}`,
    },
    tokens,
  };

  try {
    const response = await getMessaging().sendEachForMulticast(message);
    const results = response.responses.map((r, i) => ({
      token: tokens[i].slice(0, 12) + "...", // 토큰 전체는 길어서 앞부분만
      success: r.success,
      errorCode: r.error?.code || null,
      errorMessage: r.error?.message || null,
    }));

    const invalid = [];
    response.responses.forEach((r, i) => {
      if (!r.success) invalid.push(tokens[i]);
    });

    await debugRef.set({
      attemptedAt: new Date().toISOString(),
      statusLabel,
      tokenCount: tokens.length,
      successCount: response.successCount,
      failureCount: response.failureCount,
      results,
    });

    // "등록되지 않은 토큰"으로 확실히 판정된 경우에만 삭제한다.
    // 그 외 에러(예: messaging/invalid-argument, 일시적 네트워크/서버 오류,
    // messaging/quota-exceeded 등)는 토큰 자체가 무효라는 증거가 아니므로
    // 함부로 지우지 않는다 — 잘못 지우면 멀쩡한 기기가 알림을 영영 못 받게 됨.
    const toDelete = [];
    response.responses.forEach((r, i) => {
      if (!r.success && r.error?.code === "messaging/registration-token-not-registered") {
        toDelete.push(tokens[i]);
      }
    });

    for (const t of toDelete) {
      console.log(
        `토큰 삭제: ${t.slice(0, 12)}... / 사유: messaging/registration-token-not-registered (기기에서 구독이 해제되어 더 이상 유효하지 않음)`
      );
    }
    await Promise.all(toDelete.map((t) => db.collection("adminTokens").doc(t).delete()));
  } catch (e) {
    await debugRef.set({
      attemptedAt: new Date().toISOString(),
      statusLabel,
      tokenCount: tokens.length,
      fatalError: `${e?.code || ""} ${e?.message || e}`,
    });
  }
}

// 새 신고가 접수되는 순간(문서 생성): 바로 알림
exports.notifyOnNewReport = onDocumentCreated(
  { document: "reports/{reportId}", region: "asia-northeast3" },
  async (event) => {
    const report = event.data.data();
    await sendToAdmins(report, "신규 접수");
  }
);

// - "즉시 조치 불가(deferred)"로 바뀌는 순간: 바로 알림
// - "조치 완료(done)"로 바뀌는 순간: 알림 (즉시 조치 가능 경로는 완료 시점에 알림)
exports.notifyOnStatusChange = onDocumentUpdated(
  { document: "reports/{reportId}", region: "asia-northeast3" },
  async (event) => {
    const before = event.data.before.data();
    const after = event.data.after.data();

    if (before.status === after.status) return;

    if (after.status === "deferred" && before.status !== "deferred") {
      await sendToAdmins(after, "즉시 조치 불가");
    } else if (after.status === "done" && before.status !== "done") {
      await sendToAdmins(after, "조치 완료");
    }
  }
);

// 매일 새벽 3시, 휴지통에 30일 넘게 있는 신고를 자동으로 완전 삭제합니다.
exports.cleanupTrash = onSchedule(
  { schedule: "0 3 * * *", timeZone: "Asia/Seoul", region: "asia-northeast3" },
  async () => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 30);
    const cutoffISO = cutoff.toISOString();

    const snap = await db.collection("reports").where("deleted", "==", true).get();
    const targets = snap.docs.filter((d) => {
      const deletedAt = d.data().deletedAt;
      return deletedAt && deletedAt < cutoffISO;
    });

    await Promise.all(targets.map((d) => d.ref.delete()));
    console.log(`휴지통 정리: ${targets.length}건 완전 삭제`);
  }
);
