const { onDocumentUpdated } = require("firebase-functions/v2/firestore");
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

// 신고 상태가 "즉시 조치 가능(action)" 또는 "즉시 조치 불가(deferred)"로 바뀌는
// 그 순간에 알림을 보냅니다. (신고 접수 시점이나 조치 완료 시점이 아님)
exports.notifyOnStatusChange = onDocumentUpdated(
  { document: "reports/{reportId}", region: "asia-northeast3" },
  async (event) => {
    const before = event.data.before.data();
    const after = event.data.after.data();

    if (before.status === after.status) return;

    if (after.status === "action" && before.status !== "action") {
      await sendToAdmins(after, "즉시 조치 진행 중");
    } else if (after.status === "deferred" && before.status !== "deferred") {
      await sendToAdmins(after, "즉시 조치 불가");
    }
  }
);
