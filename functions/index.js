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
  if (tokens.length === 0) return;

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
    const invalid = [];
    response.responses.forEach((r, i) => {
      if (!r.success) invalid.push(tokens[i]);
    });
    await Promise.all(invalid.map((t) => db.collection("adminTokens").doc(t).delete()));
  } catch (e) {
    console.error("알림 발송 실패", e);
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
