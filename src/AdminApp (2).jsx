import { useState, useEffect, useRef, useCallback } from "react";
import { subscribeReports, updateReport as fbUpdateReport, deleteReport as fbDeleteReport, registerForPush } from "./firebase";
import {
  ClipboardList, Trophy, Camera, MapPin, User,
  Trash2, X, Loader2, Award, Medal, Sprout, ImageOff,
  ShieldCheck, RefreshCw, KeyRound, Lock
} from "lucide-react";

const C = {
  bg: "#161D27", surface: "#212B38", surfaceAlt: "#2A3646",
  line: "#37455A", text: "#EDF1F5", muted: "#8FA0B3",
  yellow: "#FFC845", red: "#E85D4C", blue: "#5A9BE8", green: "#4CAF7D", orange: "#E8974C",
};

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

const STATUS_META = {
  pending:  { label: "조치 대기",      color: C.yellow, bg: "#FFC84522" },
  action:   { label: "조치 진행 중",   color: C.orange, bg: "#E8974C22" },
  done:     { label: "조치 완료",      color: C.green,  bg: "#4CAF7D22" },
  deferred: { label: "즉시 조치 불가", color: C.red,    bg: "#E85D4C22" },
};

const hazardOf = (id) => HAZARD_TYPES.find((h) => h.id === id) || HAZARD_TYPES.at(-1);
const hazardLabel = (r) => (r.hazard === "etc" && r.hazardLabel) ? r.hazardLabel : hazardOf(r.hazard).label;

function fmtDateTime(v) {
  if (!v) return "";
  return new Date(v).toLocaleString("ko-KR", { month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function getTier(count) {
  if (count >= 11) return { label: "골드 파수꾼",   icon: Award,  color: C.yellow };
  if (count >= 6)  return { label: "실버 파수꾼",   icon: Medal,  color: "#C7CDD6" };
  if (count >= 3)  return { label: "브론즈 파수꾼", icon: Medal,  color: "#C77D4C" };
  return                   { label: "새싹 파수꾼",  icon: Sprout, color: C.green };
}

const ADMIN_PIN = "1234";

/* ════════════════════════════ ROOT ════════════════════════════ */
export default function AdminApp() {
  const [authed, setAuthed]   = useState(false);
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab]         = useState("list");
  const [lastLoaded, setLastLoaded] = useState(null);

  useEffect(() => {
    if (!authed) return;
    setLoading(true);
    const unsubscribe = subscribeReports((next) => {
      setReports(next);
      setLastLoaded(new Date());
      setLoading(false);
    });
    registerForPush();
    return () => unsubscribe();
  }, [authed]);

  const deleteReport = (id) => fbDeleteReport(id);
  const updateReport = (id, patch) => fbUpdateReport(id, patch);
  const load = () => setLastLoaded(new Date());

  const newCount = reports.filter((r) => r.status === "pending" || r.status === "deferred").length;

  if (!authed) return <PinScreen onSuccess={() => setAuthed(true)} />;

  return (
    <div style={{ background: C.bg, minHeight: "100vh", color: C.text, fontFamily: "'Inter', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Oswald:wght@500;600;700&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@500&display=swap');
        * { box-sizing: border-box; }
        .osw  { font-family: 'Oswald', sans-serif; letter-spacing: 0.02em; }
        .mono { font-family: 'JetBrains Mono', monospace; }
        input, select, textarea { font-family: 'Inter', sans-serif; }
        input:focus, select:focus, textarea:focus { outline: 2px solid ${C.blue}; outline-offset: 1px; }
        ::placeholder { color: #5C6B7E; }
        @keyframes spin   { to { transform: rotate(360deg); } }
        @keyframes fadein { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
      `}</style>

      <div style={{ maxWidth: 440, margin: "0 auto", minHeight: "100vh", display: "flex", flexDirection: "column" }}>
        {/* 헤더 */}
        <div style={{ background: C.surface, borderBottom: `3px solid ${C.blue}`, padding: "18px 16px 14px", position: "sticky", top: 0, zIndex: 10 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 38, height: 38, borderRadius: 10, background: C.blue, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <ShieldCheck size={20} color={C.bg} strokeWidth={2.5} />
              </div>
              <div>
                <div className="osw" style={{ fontSize: 19, fontWeight: 700, lineHeight: 1.1, display: "flex", alignItems: "center", gap: 8 }}>
                  관리자 대시보드
                  {newCount > 0 && (
                    <span style={{ background: C.red, color: "#fff", fontSize: 11, fontWeight: 700, borderRadius: 20, padding: "2px 7px" }}>
                      {newCount}
                    </span>
                  )}
                </div>
                <div className="mono" style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>
                  {lastLoaded ? `${lastLoaded.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })} 업데이트` : "로딩 중…"}
                </div>
              </div>
            </div>
            <button onClick={load} style={{ background: "transparent", border: `1px solid ${C.line}`, borderRadius: 8, padding: "6px 10px", color: C.muted, cursor: "pointer", display: "flex", alignItems: "center", gap: 5, fontSize: 12 }}>
              <RefreshCw size={13} /> 새로고침
            </button>
          </div>
        </div>

        {/* 탭 컨텐츠 */}
        <div style={{ flex: 1, padding: "16px 16px 96px", overflowY: "auto" }}>
          {loading ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "80px 0", color: C.muted, gap: 10 }}>
              <Loader2 size={26} style={{ animation: "spin 1s linear infinite" }} />
              <span style={{ fontSize: 13 }}>불러오는 중…</span>
            </div>
          ) : tab === "list"
            ? <ReportList reports={reports} onDelete={deleteReport} onUpdate={updateReport} />
            : <Ranking reports={reports} />
          }
        </div>

        {/* 하단 탭 */}
        <div style={{ position: "sticky", bottom: 0, display: "flex", background: C.surface, borderTop: `1px solid ${C.line}` }}>
          {[
            { id: "list",    label: "신고 현황", icon: ClipboardList },
            { id: "ranking", label: "참여현황", icon: Trophy },
          ].map(({ id, label, icon: Icon }) => {
            const active = tab === id;
            return (
              <button key={id} onClick={() => setTab(id)} style={{ flex: 1, padding: "10px 0 12px", background: "transparent", border: "none", display: "flex", flexDirection: "column", alignItems: "center", gap: 4, cursor: "pointer", color: active ? C.blue : C.muted, borderTop: `2px solid ${active ? C.blue : "transparent"}`, marginTop: -1 }}>
                <Icon size={20} strokeWidth={active ? 2.4 : 2} />
                <span style={{ fontSize: 11, fontWeight: active ? 600 : 500 }}>{label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════ 신고 목록 ════════════════════════════ */
function ReportList({ reports, onDelete, onUpdate }) {
  const [statusFilter, setStatusFilter] = useState("all"); // all | done | deferred | progress
  const [photoView, setPhotoView]   = useState(null);
  const [confirmDel, setConfirmDel] = useState(null);

  const [hazardFilter, setHazardFilter] = useState("all");
  let filtered = reports;
  if (statusFilter === "done") filtered = reports.filter((r) => r.status === "done");
  if (statusFilter === "deferred") filtered = reports.filter((r) => r.status === "deferred");
  if (statusFilter === "progress") filtered = reports.filter((r) => r.status === "pending" || r.status === "action");
  if (hazardFilter !== "all") filtered = filtered.filter((r) => r.hazard === hazardFilter);
  const sorted = [...filtered].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  const progressCount = reports.filter((r) => r.status === "pending" || r.status === "action").length;
  const deferredCount = reports.filter((r) => r.status === "deferred").length;
  const doneCount     = reports.filter((r) => r.status === "done").length;

  return (
    <div style={{ animation: "fadein .3s ease" }}>
      {/* 요약 배지 (클릭하면 필터로 동작) */}
      <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        <StatBadge label="전체" value={reports.length} color={C.blue} active={statusFilter === "all"} onClick={() => setStatusFilter("all")} />
        <StatBadge label="조치완료" value={doneCount} color={C.green} active={statusFilter === "done"} onClick={() => setStatusFilter("done")} />
        <StatBadge label="즉시조치불가" value={deferredCount} color={C.red} active={statusFilter === "deferred"} onClick={() => setStatusFilter("deferred")} />
        <StatBadge label="조치진행중" value={progressCount} color={C.orange} active={statusFilter === "progress"} onClick={() => setStatusFilter("progress")} />
      </div>

      {/* 위험유형 필터 */}
      <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 4, marginBottom: 14 }}>
        <Chip active={hazardFilter === "all"} onClick={() => setHazardFilter("all")} label="전체 유형" color={C.muted} />
        {HAZARD_TYPES.map((h) => (
          <Chip key={h.id} active={hazardFilter === h.id} onClick={() => setHazardFilter(h.id)} label={h.label} color={h.color} />
        ))}
      </div>

      {sorted.length === 0 ? (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, padding: "60px 20px", color: C.muted, textAlign: "center" }}>
          <ImageOff size={30} strokeWidth={1.5} />
          <span style={{ fontSize: 13 }}>해당 신고 내역이 없습니다.</span>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {sorted.map((r) => {
            const h  = hazardOf(r.hazard);
            const st = STATUS_META[r.status] || STATUS_META.pending;
            return (
              <div key={r.id} style={{ background: C.surface, borderRadius: 12, padding: 12, borderLeft: `4px solid ${h.color}` }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 11.5, fontWeight: 700, color: h.color }}>{hazardLabel(r)}</span>
                      <span style={{ fontSize: 11, fontWeight: 600, color: st.color, background: st.bg, padding: "2px 8px", borderRadius: 20 }}>{st.label}</span>
                    </div>
                    <div style={{ fontSize: 13.5, fontWeight: 600, display: "flex", alignItems: "center", gap: 5 }}>
                      <MapPin size={12} color={C.muted} /> {r.location}
                    </div>
                    <div className="mono" style={{ fontSize: 11, color: C.muted, marginTop: 3 }}>{fmtDateTime(r.occurredAt)}</div>
                  </div>
                  <button onClick={() => setConfirmDel(r.id)} style={{ background: "transparent", border: "none", color: C.muted, cursor: "pointer", padding: 4 }}>
                    <Trash2 size={15} />
                  </button>
                </div>

                <p style={{ fontSize: 13, color: "#C6D0DB", marginTop: 8, lineHeight: 1.5 }}>{r.desc}</p>

                {/* 조치 완료 내용 */}
                {r.status === "done" && r.actionDesc && (
                  <div style={{ marginTop: 10, background: `${C.green}12`, border: `1px solid ${C.green}40`, borderRadius: 8, padding: 10 }}>
                    <div style={{ fontSize: 11.5, color: C.green, fontWeight: 600, marginBottom: 4 }}>✓ 조치 완료 내용</div>
                    <p style={{ fontSize: 12.5, color: C.text, lineHeight: 1.5 }}>{r.actionDesc}</p>
                    {r.actionAt && <div className="mono" style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>{fmtDateTime(r.actionAt)}</div>}
                    {r.actionPhoto && (
                      <button onClick={() => setPhotoView(r.actionPhoto)} style={{ display: "flex", alignItems: "center", gap: 4, background: "transparent", border: "none", color: C.green, fontSize: 11.5, cursor: "pointer", marginTop: 6 }}>
                        <Camera size={12} /> 조치 사진 보기
                      </button>
                    )}
                  </div>
                )}

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 10 }}>
                  <span style={{ fontSize: 11.5, color: C.muted, display: "flex", alignItems: "center", gap: 4 }}>
                    <User size={11} /> {r.dept ? `${r.dept} · ` : ""}{r.reporterName}
                  </span>
                  {r.photo && (
                    <button onClick={() => setPhotoView(r.photo)} style={{ display: "flex", alignItems: "center", gap: 4, background: "transparent", border: "none", color: C.blue, fontSize: 11.5, cursor: "pointer" }}>
                      <Camera size={12} /> 신고 사진
                    </button>
                  )}
                </div>

                {confirmDel === r.id && (
                  <div style={{ marginTop: 10, background: C.surfaceAlt, borderRadius: 8, padding: 10, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                    <span style={{ fontSize: 12, color: C.muted }}>이 신고를 삭제할까요?</span>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button onClick={() => setConfirmDel(null)} style={{ fontSize: 12, background: "transparent", border: `1px solid ${C.line}`, color: C.muted, borderRadius: 6, padding: "4px 10px", cursor: "pointer" }}>취소</button>
                      <button onClick={() => { onDelete(r.id); setConfirmDel(null); }} style={{ fontSize: 12, background: C.red, border: "none", color: "#fff", borderRadius: 6, padding: "4px 10px", cursor: "pointer" }}>삭제</button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {photoView && (
        <div onClick={() => setPhotoView(null)} style={{ position: "fixed", inset: 0, background: "rgba(10,14,20,0.9)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 24 }}>
          <img src={photoView} alt="사진" style={{ maxWidth: "100%", maxHeight: "80vh", borderRadius: 12 }} />
          <button onClick={() => setPhotoView(null)} style={{ position: "absolute", top: 20, right: 20, background: C.surface, border: "none", borderRadius: "50%", width: 34, height: 34, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
            <X size={18} color={C.text} />
          </button>
        </div>
      )}
    </div>
  );
}

function StatBadge({ label, value, color, active, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1, background: active ? `${color}22` : C.surface, borderRadius: 10, padding: "10px 6px",
        textAlign: "center", border: `1.5px solid ${active ? color : C.line}`, cursor: "pointer", minWidth: 0,
      }}
    >
      <div className="mono" style={{ fontSize: 18, fontWeight: 700, color }}>{value}</div>
      <div style={{ fontSize: 10, color: active ? color : C.muted, marginTop: 2, fontWeight: active ? 700 : 400, whiteSpace: "nowrap" }}>{label}</div>
    </button>
  );
}

function Chip({ active, onClick, label, color }) {
  return (
    <button onClick={onClick} style={{ flexShrink: 0, padding: "6px 12px", borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: "pointer", border: `1px solid ${active ? color : C.line}`, background: active ? `${color}22` : "transparent", color: active ? color : C.muted }}>
      {label}
    </button>
  );
}

/* ════════════════════════════ 참여현황 ════════════════════════════ */
function Ranking({ reports }) {
  const named = reports.filter((r) => r.reporterName);

  // 신고자별 집계
  const map = {};
  named.forEach((r) => {
    if (!map[r.reporterName]) map[r.reporterName] = { name: r.reporterName, total: 0, done: 0 };
    map[r.reporterName].total += 1;
    if (r.status === "done") map[r.reporterName].done += 1;
  });
  const ranked = Object.values(map).sort((a, b) => b.total - a.total || b.done - a.done);

  const rankColor = (_i) => C.muted;
  const rankEmoji = (i) => `${i + 1}`;

  if (ranked.length === 0) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, padding: "60px 20px", color: C.muted, textAlign: "center" }}>
        <ImageOff size={30} strokeWidth={1.5} />
        <span style={{ fontSize: 13 }}>신고 데이터가 쌓이면 순위가 표시됩니다.</span>
      </div>
    );
  }

  return (
    <div style={{ animation: "fadein .3s ease" }}>
      {/* 헤더 */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
        <span style={{ fontSize: 20 }}>🏅</span>
        <span className="osw" style={{ fontSize: 18, fontWeight: 700 }}>참여 현황</span>
      </div>

      {/* 테이블 헤더 */}
      <div style={{ display: "flex", alignItems: "center", padding: "8px 14px", marginBottom: 6, borderBottom: `1px solid ${C.line}` }}>
        <span style={{ width: 36, fontSize: 11.5, fontWeight: 700, color: C.muted }}>순위</span>
        <span style={{ flex: 1, fontSize: 11.5, fontWeight: 700, color: C.muted }}>이름</span>
        <span style={{ width: 64, fontSize: 11.5, fontWeight: 700, color: C.muted, textAlign: "center" }}>신고</span>
        <span style={{ width: 64, fontSize: 11.5, fontWeight: 700, color: C.muted, textAlign: "center" }}>조치완료</span>
      </div>

      {/* 테이블 행 */}
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {ranked.map((p, i) => (
          <div key={p.name} style={{
            display: "flex", alignItems: "center", padding: "12px 14px",
            background: C.surface,
            borderRadius: 10,
            border: `1px solid ${C.line}`,
          }}>
            <span className="mono" style={{ width: 36, fontSize: 13, fontWeight: 700, color: C.muted }}>{rankEmoji(i)}</span>
            <span style={{ flex: 1, fontSize: 14, fontWeight: 600, color: C.text }}>{p.name}</span>
            <span className="mono" style={{ width: 64, fontSize: 15, fontWeight: 700, color: C.yellow, textAlign: "center" }}>{p.total}</span>
            <span className="mono" style={{ width: 64, fontSize: 15, fontWeight: 700, color: C.green, textAlign: "center" }}>{p.done}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ════════════════════════════ PIN 화면 ════════════════════════════ */
function PinScreen({ onSuccess }) {
  const [pin, setPin]     = useState("");
  const [error, setError] = useState("");
  const inputRef = useRef(null);
  useEffect(() => { setTimeout(() => inputRef.current?.focus(), 80); }, []);

  const check = () => {
    if (pin === ADMIN_PIN) onSuccess();
    else { setError("PIN이 올바르지 않습니다."); setPin(""); }
  };

  return (
    <div style={{ background: C.bg, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, fontFamily: "'Inter', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Oswald:wght@700&family=Inter:wght@400;500;600;700&display=swap');
        * { box-sizing: border-box; }
        .osw { font-family: 'Oswald', sans-serif; }
        @keyframes fadein { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
      `}</style>
      <div style={{ width: "100%", maxWidth: 320, animation: "fadein .3s ease" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16, marginBottom: 32 }}>
          <div style={{ width: 64, height: 64, borderRadius: 18, background: C.blue, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <ShieldCheck size={32} color={C.bg} />
          </div>
          <div style={{ textAlign: "center" }}>
            <div className="osw" style={{ fontSize: 22, fontWeight: 700, color: C.text }}>관리자 대시보드</div>
            <div style={{ fontSize: 13, color: C.muted, marginTop: 4 }}>PIN 번호를 입력해주세요</div>
          </div>
        </div>

        <div style={{ background: C.surface, borderRadius: 16, padding: 24 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, background: C.surfaceAlt, border: `1.5px solid ${error ? C.red : C.line}`, borderRadius: 12, padding: "0 16px", marginBottom: error ? 8 : 16 }}>
            <Lock size={16} color={C.muted} />
            <input
              ref={inputRef}
              type="password"
              inputMode="numeric"
              maxLength={8}
              value={pin}
              onChange={(e) => { setPin(e.target.value.replace(/\D/g, "")); setError(""); }}
              onKeyDown={(e) => e.key === "Enter" && check()}
              placeholder="● ● ● ●"
              style={{ flex: 1, background: "transparent", border: "none", color: C.text, fontSize: 20, letterSpacing: 8, textAlign: "center", padding: "14px 0", outline: "none" }}
            />
          </div>
          {error && <p style={{ fontSize: 12, color: C.red, marginBottom: 12, textAlign: "center" }}>{error}</p>}
          <button onClick={check} className="osw"
            style={{ width: "100%", padding: "13px 0", background: C.blue, border: "none", borderRadius: 12, color: "#fff", cursor: "pointer", fontSize: 16, fontWeight: 700 }}>
            확인
          </button>
        </div>
      </div>
    </div>
  );
}
