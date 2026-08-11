import { useState, useEffect, useRef, useCallback } from "react";
import { addReport as fbAddReport, updateReport as fbUpdateReport, getReport, deleteReport as fbDeleteReport, getAllReports } from "./firebase";
import {
  AlertTriangle, Camera, MapPin, Clock, User,
  X, Loader2, Send, CheckCircle2, ChevronRight,
  Wrench, Clock3, CircleCheck, ClipboardList, Trophy, Search, Award, Medal, Sprout
} from "lucide-react";

// ── 팔레트 ──────────────────────────────────────────
const C = {
  bg: "#161D27", surface: "#212B38", surfaceAlt: "#2A3646",
  line: "#37455A", text: "#EDF1F5", muted: "#8FA0B3",
  yellow: "#FFC845", red: "#E85D4C", blue: "#5A9BE8",
  green: "#4CAF7D", orange: "#E8974C",
};

// ── 미완료 조치 로컬 저장 (이 기기에서 "즉시 조치 가능" 선택했지만 아직 완료 안 한 신고) ──
const PENDING_KEY = "acha-pending-actions";

function loadPendingIds() {
  try { return JSON.parse(localStorage.getItem(PENDING_KEY) || "[]"); }
  catch { return []; }
}
function addPendingId(id) {
  const ids = loadPendingIds();
  if (!ids.includes(id)) localStorage.setItem(PENDING_KEY, JSON.stringify([...ids, id]));
}
function removePendingId(id) {
  const ids = loadPendingIds().filter((x) => x !== id);
  localStorage.setItem(PENDING_KEY, JSON.stringify(ids));
}

const HAZARD_TYPES = [
  { id: "slip",     label: "🚶 넘어짐·미끄러짐·걸림", color: C.yellow },
  { id: "fall",     label: "🏗️ 낙하·비래",            color: C.orange },
  { id: "electric", label: "⚡ 전기",                  color: C.blue },
  { id: "fire",     label: "🔥 화재·폭발",             color: "#D93B3B" },
  { id: "machine",  label: "🚜 기계·설비",             color: "#9B84E8" },
  { id: "vehicle",  label: "🚗 차량·운반장비",         color: "#E8974C" },
  { id: "chemical", label: "🧪 화학물질",              color: "#4CAF7D" },
  { id: "ppe",      label: "🦺 보호구",                color: "#5A9BE8" },
  { id: "env",      label: "🚧 작업환경",              color: "#C77D4C" },
  { id: "etc",      label: "📋 기타",                  color: C.muted },
];

const hazardOf    = (id) => HAZARD_TYPES.find((h) => h.id === id) || HAZARD_TYPES.at(-1);
const hazardLabel = (r)  => (r.hazard === "etc" && r.hazardLabel) ? r.hazardLabel : hazardOf(r.hazard).label;

function nowLocalInput() {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

function compressImage(file, maxW = 900, quality = 0.62) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxW / img.width);
        const canvas = document.createElement("canvas");
        canvas.width  = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.onerror = () => reject(new Error("이미지 로드 실패"));
      img.src = e.target.result;
    };
    reader.onerror = () => reject(new Error("파일 읽기 실패"));
    reader.readAsDataURL(file);
  });
}

/* ════════════════════════════ ROOT ════════════════════════════ */
export default function ReportApp() {
  const [tab, setTab] = useState("report"); // report | myRank
  const [flow, setFlow] = useState(null);
  const [currentId, setCurrentId] = useState(null);
  const [currentReport, setCurrentReport] = useState(null);
  const [pendingReports, setPendingReports] = useState([]);
  const [pendingLoading, setPendingLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const ids = loadPendingIds();
      if (ids.length === 0) { setPendingLoading(false); return; }
      const ERROR = Symbol("error");
      const results = await Promise.all(ids.map((id) => getReport(id).catch(() => ERROR)));
      const stillPending = [];
      for (let i = 0; i < ids.length; i++) {
        const r = results[i];
        if (r === ERROR) continue; // 일시적 오류: 다음에 다시 시도하도록 목록에 그대로 둠
        if (r && r.status === "action") stillPending.push(r);
        else removePendingId(ids[i]); // 완료됐거나 실제로 삭제된 신고만 정리
      }
      setPendingReports(stillPending);
      setPendingLoading(false);
    })();
  }, []);

  const addReport = async (r) => {
    const { id: tempId, ...data } = r;
    const newId = await fbAddReport(r);
    setCurrentId(newId);
    setCurrentReport({ ...r, id: newId });
    setFlow({ reportId: newId, step: "choose" });
  };

  const updateReport = async (id, patch) => {
    await fbUpdateReport(id, patch);
    setCurrentReport((prev) => prev ? { ...prev, ...patch } : prev);
  };

  const handleChoose = (choice) => {
    if (choice === "immediate") {
      updateReport(currentId, { status: "action" });
      addPendingId(currentId);
      setPendingReports((prev) => prev.some((p) => p.id === currentId) ? prev : [...prev, { ...currentReport, status: "action" }]);
      setFlow((f) => ({ ...f, step: "action" }));
    } else {
      setFlow((f) => ({ ...f, step: "confirmDefer" }));
    }
  };

  const handleActionDone = async ({ actionDesc, actionPhoto }) => {
    await updateReport(currentId, { status: "done", actionDesc, actionPhoto: actionPhoto || null, actionAt: new Date().toISOString() });
    removePendingId(currentId);
    setPendingReports((prev) => prev.filter((p) => p.id !== currentId));
    setFlow((f) => ({ ...f, step: "done" }));
  };

  const handleDeferred = async () => {
    await updateReport(currentId, { status: "deferred" });
    setFlow((f) => ({ ...f, step: "deferred" }));
  };

  const handleFlowEnd = () => { setFlow(null); setCurrentId(null); setCurrentReport(null); };

  const handleBackToChoose = () => setFlow((f) => ({ ...f, step: "choose" }));

  const handleResume = (report) => {
    setCurrentId(report.id);
    setCurrentReport(report);
    setFlow({ reportId: report.id, step: "action" });
  };

  const handleRemoveAllPending = async (ids) => {
    await Promise.all(ids.map((id) => fbDeleteReport(id).catch(() => {})));
    ids.forEach(removePendingId);
    setPendingReports((prev) => prev.filter((p) => !ids.includes(p.id)));
  };

  return (
    <div style={{ background: C.bg, minHeight: "100vh", color: C.text, fontFamily: "'Inter', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Oswald:wght@500;600;700&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@500&display=swap');
        * { box-sizing: border-box; }
        .osw  { font-family: 'Oswald', sans-serif; letter-spacing: 0.02em; }
        .mono { font-family: 'JetBrains Mono', monospace; }
        input, select, textarea { font-family: 'Inter', sans-serif; }
        input:focus, select:focus, textarea:focus { outline: 2px solid ${C.yellow}; outline-offset: 1px; }
        button:focus-visible { outline: 2px solid ${C.yellow}; outline-offset: 2px; }
        ::placeholder { color: #5C6B7E; }
        @keyframes spin   { to { transform: rotate(360deg); } }
        @keyframes fadein { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
        @keyframes popin  { from { opacity:0; transform:scale(.92); } to { opacity:1; transform:scale(1); } }
      `}</style>

      <div style={{ maxWidth: 440, margin: "0 auto", minHeight: "100vh", display: "flex", flexDirection: "column" }}>
        {/* 헤더 */}
        <div style={{ background: C.surface, borderBottom: `3px solid ${C.yellow}`, padding: "18px 16px 14px", position: "sticky", top: 0, zIndex: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 38, height: 38, borderRadius: 10, background: C.yellow, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <AlertTriangle size={20} color={C.bg} strokeWidth={2.5} />
            </div>
            <div>
              <div className="osw" style={{ fontSize: 19, fontWeight: 700, lineHeight: 1.1 }}>아차사고 발굴</div>
              <div className="mono" style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>작은 발견이 큰 사고를 막아요.</div>
            </div>
          </div>
        </div>

        {/* 본문 */}
        <div style={{ flex: 1, padding: "16px 16px 96px", overflowY: "auto" }}>
          {flow ? (
            <ActionFlow
              flow={flow}
              report={currentReport}
              onChoose={handleChoose}
              onActionDone={handleActionDone}
              onDeferred={handleDeferred}
              onEnd={handleFlowEnd}
              onBackToChoose={handleBackToChoose}
            />
          ) : tab === "myRank" ? (
            <MyRank />
          ) : (
            <>
              {!pendingLoading && pendingReports.length > 0 && (
                <PendingActions reports={pendingReports} onResume={handleResume} onRemoveAll={handleRemoveAllPending} />
              )}
              <ReportForm onSubmit={addReport} />
            </>
          )}
        </div>

        {/* 하단 탭 */}
        {!flow && (
          <div style={{ position: "sticky", bottom: 0, background: C.surface, borderTop: `1px solid ${C.line}`, display: "flex" }}>
            <button onClick={() => setTab("report")} style={{ flex: 1, padding: "10px 0 12px", background: "transparent", border: "none", display: "flex", flexDirection: "column", alignItems: "center", gap: 4, cursor: "pointer", color: tab === "report" ? C.yellow : C.muted, borderTop: `2px solid ${tab === "report" ? C.yellow : "transparent"}`, marginTop: -1 }}>
              <AlertTriangle size={20} strokeWidth={tab === "report" ? 2.4 : 2} />
              <span style={{ fontSize: 11, fontWeight: tab === "report" ? 600 : 500 }}>발견하기</span>
            </button>
            <button onClick={() => setTab("myRank")} style={{ flex: 1, padding: "10px 0 12px", background: "transparent", border: "none", display: "flex", flexDirection: "column", alignItems: "center", gap: 4, cursor: "pointer", color: tab === "myRank" ? C.yellow : C.muted, borderTop: `2px solid ${tab === "myRank" ? C.yellow : "transparent"}`, marginTop: -1 }}>
              <Trophy size={20} strokeWidth={tab === "myRank" ? 2.4 : 2} />
              <span style={{ fontSize: 11, fontWeight: tab === "myRank" ? 600 : 500 }}>내 순위</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ════════════════════════════ 조치 플로우 ════════════════════════════ */
/* ════════════════════════════ 미완료 조치 이어하기 ════════════════════════════ */
function PendingActions({ reports, onResume, onRemoveAll }) {
  const [confirmOpen, setConfirmOpen] = useState(false);

  return (
    <div style={{ background: `${C.orange}14`, border: `1.5px solid ${C.orange}55`, borderRadius: 14, padding: 14, marginBottom: 18, animation: "fadein .3s ease" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Wrench size={16} color={C.orange} />
          <span style={{ fontSize: 13.5, fontWeight: 700, color: C.orange }}>완료하지 못한 조치가 있어요</span>
        </div>
        <button
          onClick={() => setConfirmOpen(true)}
          style={{ background: "transparent", border: "none", color: C.muted, cursor: "pointer", padding: 4 }}
          aria-label="목록 지우기"
        >
          <X size={16} />
        </button>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {reports.map((r) => (
          <button
            key={r.id}
            onClick={() => onResume(r)}
            style={{ display: "flex", alignItems: "center", gap: 10, background: C.surface, border: `1px solid ${C.line}`, borderRadius: 10, padding: "10px 12px", cursor: "pointer", textAlign: "left" }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{hazardLabel(r)}</div>
              <div style={{ fontSize: 11.5, color: C.muted, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.location}</div>
            </div>
            <span style={{ fontSize: 12, color: C.orange, fontWeight: 700, flexShrink: 0 }}>이어하기</span>
            <ChevronRight size={16} color={C.orange} style={{ flexShrink: 0 }} />
          </button>
        ))}
      </div>

      {confirmOpen && (
        <div onClick={() => setConfirmOpen(false)} style={{ position: "fixed", inset: 0, background: "rgba(10,14,20,0.85)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 24 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: C.surface, borderRadius: 16, padding: 24, width: "100%", maxWidth: 320, animation: "popin .2s ease" }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: C.text, marginBottom: 8 }}>목록에서 지울까요?</div>
            <p style={{ fontSize: 13, color: C.muted, marginBottom: 20, lineHeight: 1.6 }}>이 발견 기록이 삭제됩니다.</p>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => setConfirmOpen(false)} style={{ flex: 1, padding: "11px 0", background: "transparent", border: `1px solid ${C.line}`, borderRadius: 10, color: C.muted, cursor: "pointer", fontSize: 14 }}>취소</button>
              <button
                onClick={() => { onRemoveAll(reports.map((r) => r.id)); setConfirmOpen(false); }}
                style={{ flex: 2, padding: "11px 0", background: C.red, border: "none", borderRadius: 10, color: "#fff", cursor: "pointer", fontSize: 14, fontWeight: 700 }}
              >
                지우기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ════════════════════════════ 이름으로 미완료 조치 찾기 (다른 기기용) ════════════════════════════ */
/* ════════════════════════════ 내 순위 ════════════════════════════ */
function getTier(count) {
  if (count >= 11) return { label: "골드 파수꾼",   icon: Award,  color: C.yellow };
  if (count >= 6)  return { label: "실버 파수꾼",   icon: Medal,  color: "#C7CDD6" };
  if (count >= 3)  return { label: "브론즈 파수꾼", icon: Medal,  color: "#C77D4C" };
  return                   { label: "새싹 파수꾼",  icon: Sprout, color: C.green };
}

function MyRank() {
  const [name, setName] = useState("");
  const [searching, setSearching] = useState(false);
  const [result, setResult] = useState(null); // { rank, total, done, totalPeople } | "notfound" | null
  const [error, setError] = useState("");

  const handleSearch = async () => {
    if (!name.trim()) { setError("이름을 입력해주세요."); return; }
    setSearching(true);
    setError("");
    setResult(null);
    try {
      const reports = await getAllReports();
      const map = {};
      reports.filter((r) => !r.isAnonymous && r.reporterName).forEach((r) => {
        if (!map[r.reporterName]) map[r.reporterName] = { name: r.reporterName, total: 0, done: 0 };
        map[r.reporterName].total += 1;
        if (r.status === "done") map[r.reporterName].done += 1;
      });
      const ranked = Object.values(map).sort((a, b) => b.total - a.total);
      const idx = ranked.findIndex((p) => p.name === name.trim());
      if (idx === -1) {
        setResult("notfound");
      } else {
        setResult({ rank: idx + 1, total: ranked[idx].total, done: ranked[idx].done, totalPeople: ranked.length });
      }
    } catch {
      setError("조회 중 오류가 발생했어요. 다시 시도해주세요.");
    } finally {
      setSearching(false);
    }
  };

  return (
    <div style={{ animation: "fadein .3s ease" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
        <Trophy size={20} color={C.yellow} />
        <span className="osw" style={{ fontSize: 18, fontWeight: 700 }}>내 순위 확인하기</span>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
        <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 8, background: C.surface, border: `1px solid ${error ? C.red : C.line}`, borderRadius: 10, padding: "0 12px" }}>
          <User size={15} color={C.muted} style={{ flexShrink: 0 }} />
          <input
            value={name}
            onChange={(e) => { setName(e.target.value); setError(""); }}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            placeholder="이름을 입력하세요"
            style={{ flex: 1, background: "transparent", border: "none", color: C.text, fontSize: 14, padding: "10px 0", minWidth: 0 }}
          />
        </div>
        <button onClick={handleSearch} disabled={searching} style={{ background: C.yellow, border: "none", borderRadius: 10, padding: "0 18px", color: C.bg, fontWeight: 700, fontSize: 13, cursor: "pointer", opacity: searching ? 0.7 : 1, display: "flex", alignItems: "center", gap: 6 }}>
          {searching ? <Loader2 size={15} style={{ animation: "spin 1s linear infinite" }} /> : <Search size={15} />}
          확인
        </button>
      </div>
      {error && <div style={{ fontSize: 12, color: C.red, marginBottom: 8 }}>{error}</div>}

      {result === "notfound" && (
        <div style={{ background: C.surface, border: `1px solid ${C.line}`, borderRadius: 12, padding: 20, textAlign: "center", marginTop: 16 }}>
          <p style={{ fontSize: 13, color: C.muted, lineHeight: 1.6 }}>아직 등록된 발견이 없어요.<br />첫 발견을 등록해보세요!</p>
        </div>
      )}

      {result && result !== "notfound" && (() => {
        const tier = getTier(result.total);
        const TierIcon = tier.icon;
        return (
          <div style={{ background: C.surface, border: `1px solid ${C.line}`, borderRadius: 16, padding: 24, textAlign: "center", marginTop: 16, animation: "popin .3s ease" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, marginBottom: 4 }}>
              <TierIcon size={18} color={tier.color} />
              <span style={{ fontSize: 12.5, color: tier.color, fontWeight: 700 }}>{tier.label}</span>
            </div>
            <div className="mono" style={{ fontSize: 40, fontWeight: 700, color: C.yellow, margin: "8px 0" }}>{result.rank}<span style={{ fontSize: 18, color: C.muted }}>위</span></div>
            <p style={{ fontSize: 12.5, color: C.muted, marginBottom: 18 }}>전체 {result.totalPeople}명 중</p>
            <div style={{ display: "flex", gap: 8 }}>
              <div style={{ flex: 1, background: C.surfaceAlt, borderRadius: 10, padding: "10px 6px" }}>
                <div className="mono" style={{ fontSize: 18, fontWeight: 700, color: C.text }}>{result.total}</div>
                <div style={{ fontSize: 10.5, color: C.muted, marginTop: 2 }}>전체 발견</div>
              </div>
              <div style={{ flex: 1, background: C.surfaceAlt, borderRadius: 10, padding: "10px 6px" }}>
                <div className="mono" style={{ fontSize: 18, fontWeight: 700, color: C.green }}>{result.done}</div>
                <div style={{ fontSize: 10.5, color: C.muted, marginTop: 2 }}>조치 완료</div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

function ActionFlow({ flow, report, onChoose, onActionDone, onDeferred, onEnd, onBackToChoose }) {
  const steps = [
    { id: "choose",       label: "조치 선택" },
    { id: "action",       label: "조치 진행" },
    { id: "done",         label: "완료" },
  ];
  const stepIdx = ["choose","confirmDefer"].includes(flow.step) ? 0
    : flow.step === "action" ? 1
    : flow.step === "done"   ? 2 : 0;

  return (
    <div style={{ animation: "fadein .3s ease" }}>
      {/* 스텝 인디케이터 (deferred 제외) */}
      {flow.step !== "deferred" && (
        <div style={{ display: "flex", alignItems: "center", marginBottom: 24 }}>
          {steps.map((s, i) => {
            const past = i < stepIdx, current = i === stepIdx;
            return (
              <div key={s.id} style={{ display: "flex", alignItems: "center", flex: i < steps.length - 1 ? 1 : "unset" }}>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                  <div style={{ width: 28, height: 28, borderRadius: "50%", background: past ? C.green : current ? C.yellow : C.surfaceAlt, border: `2px solid ${past ? C.green : current ? C.yellow : C.line}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    {past ? <CheckCircle2 size={14} color={C.bg} /> : <span style={{ fontSize: 12, fontWeight: 700, color: current ? C.bg : C.muted }}>{i + 1}</span>}
                  </div>
                  <span style={{ fontSize: 10, color: current ? C.yellow : past ? C.green : C.muted, fontWeight: current ? 700 : 400, whiteSpace: "nowrap" }}>{s.label}</span>
                </div>
                {i < steps.length - 1 && <div style={{ flex: 1, height: 2, background: past ? C.green : C.line, margin: "0 6px", marginBottom: 18 }} />}
              </div>
            );
          })}
        </div>
      )}

      {flow.step === "choose"      && <StepChoose onChoose={onChoose} onBack={onEnd} />}
      {flow.step === "confirmDefer"&& <StepConfirmDefer onConfirm={onDeferred} onBack={onBackToChoose} />}
      {flow.step === "action"      && <StepAction onDone={onActionDone} onBack={onBackToChoose} />}
      {flow.step === "done"        && <StepDone report={report} onEnd={onEnd} />}
      {flow.step === "deferred"    && <StepDeferred onEnd={onEnd} />}
    </div>
  );
}

/* ── 조치 선택 ── */
function StepChoose({ onChoose, onBack }) {
  return (
    <div style={{ animation: "popin .25s ease" }}>
      <button onClick={onBack} style={{ background: "transparent", border: "none", color: C.muted, fontSize: 13, cursor: "pointer", marginBottom: 16, padding: 0 }}>← 발견으로 돌아가기</button>
      <div className="osw" style={{ fontSize: 17, fontWeight: 700, marginBottom: 6 }}>위험요소를 바로 조치할 수 있나요?</div>
      <p style={{ fontSize: 13, color: C.muted, marginBottom: 20, lineHeight: 1.6 }}>현장에서 바로 위험 요소를 제거하거나 조치할 수 있는지 선택해주세요.</p>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <button onClick={() => onChoose("immediate")} style={{ display: "flex", alignItems: "center", gap: 14, background: `${C.green}18`, border: `1.5px solid ${C.green}`, borderRadius: 14, padding: "16px 18px", cursor: "pointer", textAlign: "left" }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: `${C.green}30`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 22 }}>
            🔧
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: C.green }}>바로 조치 가능해요</div>
            <div style={{ fontSize: 12, color: C.muted, marginTop: 3 }}>지금 바로 조치 후 결과를 기록합니다</div>
          </div>
          <ChevronRight size={18} color={C.green} style={{ marginLeft: "auto" }} />
        </button>
        <button onClick={() => onChoose("deferred")} style={{ display: "flex", alignItems: "center", gap: 14, background: `${C.red}18`, border: `1.5px solid ${C.red}`, borderRadius: 14, padding: "16px 18px", cursor: "pointer", textAlign: "left" }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: `${C.red}30`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 22 }}>
            ⏰
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: C.red }}>조치가 필요해요</div>
            <div style={{ fontSize: 12, color: C.muted, marginTop: 3 }}>담당자에게 알림을 보냅니다</div>
          </div>
          <ChevronRight size={18} color={C.red} style={{ marginLeft: "auto" }} />
        </button>
      </div>
    </div>
  );
}

/* ── 즉시 조치 불가 확인 모달 ── */
function StepConfirmDefer({ onConfirm, onBack }) {
  return (
    <div style={{ animation: "popin .25s ease", display: "flex", flexDirection: "column", alignItems: "center", gap: 16, padding: "10px 0", textAlign: "center" }}>
      <div style={{ width: 60, height: 60, borderRadius: "50%", background: `${C.red}22`, border: `3px solid ${C.red}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28 }}>
        ❗
      </div>
      <div>
        <div className="osw" style={{ fontSize: 17, fontWeight: 700, color: C.red }}>담당자에게 조치를 요청할까요?</div>
        <p style={{ fontSize: 13, color: C.muted, marginTop: 8, lineHeight: 1.6 }}>등록한 위험요소가 담당자에게 전달됩니다.</p>
      </div>
      <div style={{ display: "flex", gap: 10, width: "100%" }}>
        <button onClick={onBack} style={{ flex: 1, padding: "13px 0", background: "transparent", border: `1.5px solid ${C.line}`, borderRadius: 12, color: C.muted, cursor: "pointer", fontSize: 14, fontWeight: 600 }}>돌아가기</button>
        <button onClick={onConfirm} className="osw" style={{ flex: 2, padding: "13px 0", background: C.red, border: "none", borderRadius: 12, color: "#fff", cursor: "pointer", fontSize: 15, fontWeight: 700 }}>조치 요청하기</button>
      </div>
    </div>
  );
}

/* ── 조치 내용 입력 ── */
function StepAction({ onDone, onBack }) {
  const [actionDesc, setActionDesc]   = useState("");
  const [actionPhoto, setActionPhoto] = useState(null);
  const [photoBusy, setPhotoBusy]     = useState(false);
  const [errors, setErrors]           = useState({});
  const [submitting, setSubmitting]   = useState(false);
  const fileRef = useRef(null);

  const handlePhoto = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoBusy(true);
    try   { setActionPhoto(await compressImage(file)); setErrors((p) => ({ ...p, photo: undefined })); }
    catch { setErrors((p) => ({ ...p, photo: "사진 처리에 실패했어요." })); }
    finally { setPhotoBusy(false); }
  };

  const handleSubmit = async () => {
    const e = {};
    if (!actionDesc.trim()) e.desc = "필수 작성입니다.";
    if (!actionPhoto)       e.photo = "필수 작성입니다.";
    setErrors(e);
    if (Object.keys(e).length > 0) return;
    setSubmitting(true);
    await onDone({ actionDesc: actionDesc.trim(), actionPhoto });
    setSubmitting(false);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, animation: "fadein .25s ease" }}>
      <button onClick={onBack} style={{ background: "transparent", border: "none", color: C.muted, fontSize: 13, cursor: "pointer", padding: 0, textAlign: "left" }}>← 조치 선택으로 돌아가기</button>
      <div className="osw" style={{ fontSize: 17, fontWeight: 700 }}>조치 내용을 기록해주세요</div>

      <div>
        <div style={{ fontSize: 12.5, fontWeight: 600, color: C.muted, marginBottom: 6 }}>조치 후 사진을 보여주세요</div>
        {actionPhoto ? (
          <div style={{ position: "relative", width: 130 }}>
            <img src={actionPhoto} alt="조치 사진" style={{ width: 130, height: 130, objectFit: "cover", borderRadius: 10, border: `1px solid ${C.line}` }} />
            <button onClick={() => { setActionPhoto(null); if (fileRef.current) fileRef.current.value = ""; }} style={{ position: "absolute", top: -8, right: -8, background: C.red, border: "none", borderRadius: "50%", width: 24, height: 24, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
              <X size={14} color="#fff" />
            </button>
          </div>
        ) : (
          <button onClick={() => fileRef.current?.click()} disabled={photoBusy} style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", background: C.surface, border: `1.5px dashed ${errors.photo ? C.red : C.line}`, borderRadius: 10, color: C.muted, cursor: "pointer", fontSize: 13 }}>
            {photoBusy ? <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} /> : <Camera size={16} />}
            {photoBusy ? "처리 중…" : "조치 후 사진 찍기"}
          </button>
        )}
        <input ref={fileRef} type="file" accept="image/*" onChange={handlePhoto} style={{ display: "none" }} />
        {errors.photo && <div style={{ fontSize: 12, color: C.red, marginTop: 5 }}>{errors.photo}</div>}
      </div>

      <div>
        <div style={{ fontSize: 12.5, fontWeight: 600, color: C.muted, marginBottom: 6 }}>어떤 조치를 취했는지 적어주세요</div>
        <textarea value={actionDesc} onChange={(e) => { setActionDesc(e.target.value); setErrors((p) => ({ ...p, desc: undefined })); }} placeholder={"예: 미끄럼 방지 테이프 부착, 안전 표지판 설치 등"} rows={4}
          style={{ width: "100%", background: C.surface, border: `1px solid ${errors.desc ? C.red : C.line}`, borderRadius: 10, color: C.text, fontSize: 14, padding: "10px 12px", resize: "vertical" }} />
        {errors.desc && <div style={{ fontSize: 12, color: C.red, marginTop: 5 }}>{errors.desc}</div>}
      </div>

      <button onClick={handleSubmit} disabled={submitting || photoBusy} className="osw"
        style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, background: C.green, color: C.bg, border: "none", borderRadius: 12, padding: "14px 0", fontSize: 15, fontWeight: 700, cursor: "pointer", opacity: submitting ? 0.7 : 1 }}>
        {submitting ? <Loader2 size={17} style={{ animation: "spin 1s linear infinite" }} /> : <CircleCheck size={17} />}
        등록
      </button>
    </div>
  );
}

/* ── 조치 완료 ── */
function StepDone({ report, onEnd }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16, padding: "20px 0", animation: "popin .3s ease", textAlign: "center" }}>
      <div style={{ width: 200, height: 200, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <img src="/icon-done.png" alt="" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
      </div>
      <div>
        <div className="osw" style={{ fontSize: 22, fontWeight: 700, color: C.green }}>조치 완료!</div>
        <p style={{ fontSize: 13, color: C.muted, marginTop: 8, lineHeight: 1.6 }}>안전한 현장을 만들어주셔서 감사합니다.</p>
      </div>
      <button onClick={onEnd} className="osw" style={{ width: "100%", background: C.yellow, color: C.bg, border: "none", borderRadius: 12, padding: "13px 0", fontSize: 15, fontWeight: 700, cursor: "pointer", marginTop: 4 }}>
        돌아가기
      </button>
    </div>
  );
}

/* ── 즉시 조치 불가 완료 ── */
function StepDeferred({ onEnd }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16, padding: "20px 0", animation: "popin .3s ease", textAlign: "center" }}>
      <div style={{ width: 90, height: 90, borderRadius: "50%", background: `${C.red}22`, border: `3px solid ${C.red}`, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
        <img src="/icon-undone.png" alt="" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
      </div>
      <div>
        <div className="osw" style={{ fontSize: 20, fontWeight: 700, color: C.red }}>조치를 요청했습니다!</div>
        <p style={{ fontSize: 13, color: C.muted, marginTop: 8, lineHeight: 1.6 }}>안전한 작업환경을 만드는 데<br />함께해 주셔서 감사합니다.</p>
      </div>
      <div style={{ width: "100%", background: `${C.red}12`, border: `1px solid ${C.red}40`, borderRadius: 12, padding: 14, textAlign: "left" }}>
        <div style={{ fontSize: 12.5, color: C.red, fontWeight: 600, marginBottom: 4 }}>⚠ 주의사항</div>
        <p style={{ fontSize: 12.5, color: C.muted, lineHeight: 1.6 }}>조치 전까지 해당 구역 접근을 제한하고,<br />주변 동료에게 위험 사실을 알려주세요.</p>
      </div>
      <button onClick={onEnd} className="osw" style={{ width: "100%", background: C.yellow, color: C.bg, border: "none", borderRadius: 12, padding: "13px 0", fontSize: 15, fontWeight: 700, cursor: "pointer", marginTop: 4 }}>
        돌아가기
      </button>
    </div>
  );
}

/* ════════════════════════════ 신고 폼 ════════════════════════════ */
function ReportForm({ onSubmit }) {
  const [hazard, setHazard]         = useState(HAZARD_TYPES[0].id);
  const [etcLabel, setEtcLabel]     = useState("");
  const [occurredAt, setOccurredAt] = useState(nowLocalInput());
  const [location, setLocation]     = useState("");
  const [dept, setDept]             = useState("");
  const [name, setName]             = useState("");
  const [desc, setDesc]             = useState("");
  const [photo, setPhoto]           = useState(null);
  const [photoBusy, setPhotoBusy]   = useState(false);
  const [errors, setErrors]         = useState({});
  const [submitting, setSubmitting] = useState(false);
  const fileRef = useRef(null);

  const handlePhoto = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoBusy(true);
    try   { setPhoto(await compressImage(file)); setErrors((p) => ({ ...p, photo: undefined })); }
    catch { setErrors((p) => ({ ...p, photo: "사진 처리 실패" })); }
    finally { setPhotoBusy(false); }
  };

  const validate = () => {
    const e = {};
    if (!occurredAt)           e.occurredAt = "필수 작성입니다.";
    if (!location.trim())      e.location   = "필수 작성입니다.";
    if (!dept.trim())          e.dept       = "필수 작성입니다.";
    if (!name.trim())          e.name       = "필수 작성입니다.";
    if (!desc.trim())          e.desc       = "필수 작성입니다.";
    if (!photo)                e.photo      = "필수 작성입니다.";
    if (hazard === "etc" && !etcLabel.trim()) e.etcLabel = "필수 작성입니다.";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setSubmitting(true);
    await onSubmit({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      reporterName: name.trim(), dept: dept.trim(),
      location: location.trim(), occurredAt,
      hazard, hazardLabel: hazard === "etc" ? etcLabel.trim() : null,
      desc: desc.trim(), photo, status: "pending",
      createdAt: new Date().toISOString(),
    });
    setSubmitting(false);
    setHazard(HAZARD_TYPES[0].id); setEtcLabel("");
    setOccurredAt(nowLocalInput()); setLocation("");
    setDept(""); setName(""); setDesc(""); setPhoto(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const iS = { flex: 1, background: "transparent", border: "none", color: C.text, fontSize: 14, padding: "10px 0", width: "100%" };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, animation: "fadein .3s ease" }}>

      {/* 1. 위험 유형 */}
      <Field label="1. 위험 유형" error={errors.etcLabel}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {HAZARD_TYPES.map((h) => (
            <button key={h.id} onClick={() => setHazard(h.id)} style={{ padding: "7px 12px", borderRadius: 8, fontSize: 12.5, fontWeight: 600, cursor: "pointer", border: `1.5px solid ${hazard === h.id ? h.color : C.line}`, background: hazard === h.id ? `${h.color}22` : C.surface, color: hazard === h.id ? h.color : C.muted }}>
              {h.label}
            </button>
          ))}
        </div>
        {hazard === "etc" && (
          <input value={etcLabel} onChange={(e) => { setEtcLabel(e.target.value); setErrors((p) => ({ ...p, etcLabel: undefined })); }}
            placeholder="위험 유형을 직접 입력해주세요"
            style={{ ...iS, marginTop: 10, border: `1px solid ${errors.etcLabel ? C.red : C.line}`, borderRadius: 10, padding: "9px 12px", background: C.surface }} />
        )}
      </Field>

      {/* 2. 언제 발견했나요? */}
      <Field label="2. 발견한 일시를 알려주세요" error={errors.occurredAt}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, background: C.surface, border: `1px solid ${C.line}`, borderRadius: 10, padding: "0 12px" }}>
          <Clock size={15} color={C.muted} />
          <input type="datetime-local" value={occurredAt} onChange={(e) => setOccurredAt(e.target.value)} style={iS} />
        </div>
      </Field>

      {/* 3. 어디서 봤나요? */}
      <Field label="3. 발견된 장소를 알려주세요" error={errors.location}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, background: C.surface, border: `1px solid ${C.line}`, borderRadius: 10, padding: "0 12px" }}>
          <MapPin size={15} color={C.muted} />
          <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="예: 제3매립장 침출수 처리시설 앞" style={iS} />
        </div>
      </Field>

      {/* 4. 소속 */}
      <Field label="4. 소속을 알려주세요" error={errors.dept}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, background: C.surface, border: `1px solid ${C.line}`, borderRadius: 10, padding: "0 12px" }}>
          <ClipboardList size={15} color={C.muted} />
          <input value={dept} onChange={(e) => setDept(e.target.value)} placeholder="예: 안전환경실" style={iS} />
        </div>
      </Field>

      {/* 5. 이름 */}
      <Field label="5. 이름을 알려주세요" error={errors.name}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, background: C.surface, border: `1px solid ${C.line}`, borderRadius: 10, padding: "0 12px" }}>
          <User size={15} color={C.muted} />
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="예: 홍길동" style={iS} />
        </div>
      </Field>

      {/* 6. 어떤 위험이었나요? */}
      <Field label="6. 어떤 상황이었나요?" error={errors.desc}>
        <textarea value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="어떤 점이 위험해 보였는지 알려주세요." rows={4}
          style={{ width: "100%", background: C.surface, border: `1px solid ${C.line}`, borderRadius: 10, color: C.text, fontSize: 14, padding: "10px 12px", resize: "vertical" }} />
      </Field>

      {/* 7. 사진 첨부 */}
      <Field label="7. 사진을 보여주세요" error={errors.photo}>
        {photo ? (
          <div style={{ position: "relative", width: 120 }}>
            <img src={photo} alt="첨부" style={{ width: 120, height: 120, objectFit: "cover", borderRadius: 10, border: `1px solid ${C.line}` }} />
            <button onClick={() => { setPhoto(null); if (fileRef.current) fileRef.current.value = ""; }} style={{ position: "absolute", top: -8, right: -8, background: C.red, border: "none", borderRadius: "50%", width: 24, height: 24, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
              <X size={14} color="#fff" />
            </button>
          </div>
        ) : (
          <button onClick={() => fileRef.current?.click()} disabled={photoBusy} style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", background: C.surface, border: `1.5px dashed ${errors.photo ? C.red : C.line}`, borderRadius: 10, color: C.muted, cursor: "pointer", fontSize: 13 }}>
            {photoBusy ? <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} /> : <Camera size={16} />}
            {photoBusy ? "처리 중…" : "사진 선택하기"}
          </button>
        )}
        <input ref={fileRef} type="file" accept="image/*" onChange={handlePhoto} style={{ display: "none" }} />
      </Field>

      <button onClick={handleSubmit} disabled={submitting || photoBusy} className="osw"
        style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, background: C.yellow, color: C.bg, border: "none", borderRadius: 12, padding: "14px 0", fontSize: 15, fontWeight: 700, cursor: "pointer", opacity: submitting || photoBusy ? 0.7 : 1, marginTop: 4 }}>
        {submitting ? <Loader2 size={17} style={{ animation: "spin 1s linear infinite" }} /> : <Send size={16} />}
        다음으로
      </button>
    </div>
  );
}

function Field({ label, error, children }) {
  return (
    <div>
      <div style={{ fontSize: 12.5, fontWeight: 600, color: C.muted, marginBottom: 6 }}>{label}</div>
      {children}
      {error && <div style={{ fontSize: 12, color: C.red, marginTop: 5 }}>{error}</div>}
    </div>
  );
}

function Spinner() {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "80px 0", color: C.muted, gap: 10 }}>
      <Loader2 size={26} style={{ animation: "spin 1s linear infinite" }} />
      <span style={{ fontSize: 13 }}>불러오는 중…</span>
    </div>
  );
}
