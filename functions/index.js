const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const { getMessaging } = require("firebase-admin/messaging");

initializeApp();
const db = getFirestore();

exports.notifyOnNewReport = onDocumentCreated(
  { document: "reports/{reportId}", region: "asia-northeast3" },
  async (event) => {
    const report = event.data.data();

    const tokensSnap = await db.collection("adminTokens").get();
    const tokens = tokensSnap.docs.map((d) => d.id);
    if (tokens.length === 0) return;

    const hazardText = report.hazardLabel || report.hazard || "위험 상황";
    const message = {
      notification: {
        title: "아차사고 발굴 - 새 신고",
        body: `${hazardText} · ${report.location || ""}`,
      },
      data: {
        reportId: event.params.reportId,
      },
      tokens,
    };

    try {
      const response = await getMessaging().sendEachForMulticast(message);
      // 실패한(만료된) 토큰은 정리
      const invalid = [];
      response.responses.forEach((r, i) => {
        if (!r.success) invalid.push(tokens[i]);
      });
      await Promise.all(invalid.map((t) => db.collection("adminTokens").doc(t).delete()));
    } catch (e) {
      console.error("알림 발송 실패", e);
    }
  }
);
