import { useState, useEffect, useRef, useCallback } from "react";
import { subscribeReports, updateReport as fbUpdateReport, deleteReport as fbDeleteReport, registerForPush } from "./firebase";
import * as XLSX from "xlsx";
import {
  ClipboardList, Trophy, Camera, MapPin, User,
  Trash2, X, Loader2, Award, Medal, Sprout, ImageOff,
  ShieldCheck, RefreshCw, KeyRound, Lock, Search, Download, Calendar, SlidersHorizontal
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

  const deleteReport = (id) => fbUpdateReport(id, { deleted: true, deletedAt: new Date().toISOString() });
  const restoreReport = (id) => fbUpdateReport(id, { deleted: false, deletedAt: null });
  const permanentlyDelete = (id) => fbDeleteReport(id);
  const updateReport = (id, patch) => fbUpdateReport(id, patch);
  const load = () => setLastLoaded(new Date());

  const newCount = reports.filter((r) => !r.deleted && (r.status === "pending" || r.status === "deferred")).length;
  const trashCount = reports.filter((r) => r.deleted).length;

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
            ? <ReportList reports={reports.filter((r) => !r.deleted)} onDelete={deleteReport} onUpdate={updateReport} />
            : tab === "trash"
            ? <TrashList reports={reports.filter((r) => r.deleted)} onRestore={restoreReport} onPermanentDelete={permanentlyDelete} />
            : <Ranking reports={reports.filter((r) => !r.deleted)} />
          }
        </div>

        {/* 하단 탭 */}
        <div style={{ position: "sticky", bottom: 0, display: "flex", background: C.surface, borderTop: `1px solid ${C.line}` }}>
          {[
            { id: "list",    label: "신고 현황", icon: ClipboardList },
            { id: "ranking", label: "참여현황", icon: Trophy },
            { id: "trash",   label: "휴지통",   icon: Trash2, badge: trashCount },
          ].map(({ id, label, icon: Icon, badge }) => {
            const active = tab === id;
            return (
              <button key={id} onClick={() => setTab(id)} style={{ flex: 1, padding: "10px 0 12px", background: "transparent", border: "none", display: "flex", flexDirection: "column", alignItems: "center", gap: 4, cursor: "pointer", color: active ? C.blue : C.muted, borderTop: `2px solid ${active ? C.blue : "transparent"}`, marginTop: -1, position: "relative" }}>
                <div style={{ position: "relative" }}>
                  <Icon size={20} strokeWidth={active ? 2.4 : 2} />
                  {!!badge && (
                    <span style={{ position: "absolute", top: -6, right: -8, background: C.red, color: "#fff", fontSize: 9.5, fontWeight: 700, borderRadius: 20, padding: "1px 5px", lineHeight: 1.3 }}>{badge}</span>
                  )}
                </div>
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
  const [statusFilter, setStatusFilter] = useState("all"); // all | progress | deferred | done
  const [photoView, setPhotoView]   = useState(null);
  const [confirmDel, setConfirmDel] = useState(null);
  const [hazardFilter, setHazardFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  let filtered = reports;
  if (statusFilter === "progress") filtered = filtered.filter((r) => r.status === "pending" || r.status === "action");
  if (statusFilter === "deferred") filtered = filtered.filter((r) => r.status === "deferred");
  if (statusFilter === "done") filtered = filtered.filter((r) => r.status === "done");
  if (hazardFilter !== "all") filtered = filtered.filter((r) => r.hazard === hazardFilter);
  if (searchQuery.trim()) {
    const q = searchQuery.trim().toLowerCase();
    filtered = filtered.filter((r) =>
      (r.location || "").toLowerCase().includes(q) ||
      (r.reporterName || "").toLowerCase().includes(q) ||
      (r.dept || "").toLowerCase().includes(q) ||
      (r.desc || "").toLowerCase().includes(q)
    );
  }
  if (dateFrom) filtered = filtered.filter((r) => r.occurredAt && r.occurredAt >= dateFrom);
  if (dateTo) filtered = filtered.filter((r) => r.occurredAt && r.occurredAt <= `${dateTo}T23:59`);

  const sorted = [...filtered].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  const progressCount = reports.filter((r) => r.status === "pending" || r.status === "action").length;
  const deferredCount = reports.filter((r) => r.status === "deferred").length;
  const doneCount     = reports.filter((r) => r.status === "done").length;

  const handleExport = () => {
    const rows = sorted.map((r) => ({
      "위험유형": hazardLabel(r),
      "발생일시": fmtDateTime(r.occurredAt),
      "발생장소": r.location || "",
      "소속": r.dept || "",
      "이름": r.isAnonymous ? "익명" : (r.reporterName || ""),
      "상황설명": r.desc || "",
      "상태": (STATUS_META[r.status] || STATUS_META.pending).label,
      "조치내용": r.actionDesc || "",
      "조치일시": r.actionAt ? fmtDateTime(r.actionAt) : "",
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    ws["!cols"] = [
      { wch: 16 }, { wch: 18 }, { wch: 24 }, { wch: 12 }, { wch: 10 },
      { wch: 30 }, { wch: 12 }, { wch: 30 }, { wch: 18 },
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "신고현황");
    const today = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `아차사고_신고현황_${today}.xlsx`);
  };

  return (
    <div style={{ animation: "fadein .3s ease" }}>
      {/* 요약 배지 (클릭하면 필터로 동작) */}
      <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        <StatBadge label="전체" value={reports.length} color={C.blue} active={statusFilter === "all"} onClick={() => setStatusFilter("all")} />
        <StatBadge label="조치진행중" value={progressCount} color={C.orange} active={statusFilter === "progress"} onClick={() => setStatusFilter("progress")} />
        <StatBadge label="즉시조치불가" value={deferredCount} color={C.red} active={statusFilter === "deferred"} onClick={() => setStatusFilter("deferred")} />
        <StatBadge label="조치완료" value={doneCount} color={C.green} active={statusFilter === "done"} onClick={() => setStatusFilter("done")} />
      </div>

      {/* 검색 + 필터 토글 + 내보내기 */}
      <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
        <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 8, background: C.surface, border: `1px solid ${C.line}`, borderRadius: 10, padding: "0 12px" }}>
          <Search size={15} color={C.muted} style={{ flexShrink: 0 }} />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="장소, 이름, 소속, 내용 검색"
            style={{ flex: 1, background: "transparent", border: "none", color: C.text, fontSize: 13, padding: "9px 0", minWidth: 0 }}
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery("")} style={{ background: "transparent", border: "none", color: C.muted, cursor: "pointer", padding: 2, flexShrink: 0 }}>
              <X size={14} />
            </button>
          )}
        </div>
        <button
          onClick={() => setShowFilters((v) => !v)}
          style={{ display: "flex", alignItems: "center", gap: 5, background: (dateFrom || dateTo) ? `${C.blue}22` : C.surface, border: `1.5px solid ${(dateFrom || dateTo) ? C.blue : C.line}`, borderRadius: 10, padding: "0 12px", color: (dateFrom || dateTo) ? C.blue : C.muted, cursor: "pointer", flexShrink: 0 }}
        >
          <Calendar size={15} />
        </button>
        <button
          onClick={handleExport}
          disabled={sorted.length === 0}
          style={{ display: "flex", alignItems: "center", gap: 5, background: C.green, border: "none", borderRadius: 10, padding: "0 14px", color: C.bg, cursor: sorted.length === 0 ? "default" : "pointer", flexShrink: 0, opacity: sorted.length === 0 ? 0.5 : 1, fontWeight: 700, fontSize: 12.5 }}
        >
          <Download size={14} /> 엑셀
        </button>
      </div>

      {showFilters && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, background: C.surface, border: `1px solid ${C.line}`, borderRadius: 10, padding: 10, marginBottom: 10 }}>
          <span style={{ fontSize: 11.5, color: C.muted, flexShrink: 0 }}>기간</span>
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} style={{ flex: 1, background: C.surfaceAlt, border: `1px solid ${C.line}`, borderRadius: 6, color: C.text, fontSize: 12.5, padding: "6px 8px", minWidth: 0 }} />
          <span style={{ color: C.muted, fontSize: 12 }}>~</span>
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} style={{ flex: 1, background: C.surfaceAlt, border: `1px solid ${C.line}`, borderRadius: 6, color: C.text, fontSize: 12.5, padding: "6px 8px", minWidth: 0 }} />
          {(dateFrom || dateTo) && (
            <button onClick={() => { setDateFrom(""); setDateTo(""); }} style={{ background: "transparent", border: "none", color: C.muted, cursor: "pointer", padding: 2, flexShrink: 0 }}>
              <X size={14} />
            </button>
          )}
        </div>
      )}

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

/* ════════════════════════════ 휴지통 ════════════════════════════ */
function TrashList({ reports, onRestore, onPermanentDelete }) {
  const [confirmId, setConfirmId] = useState(null);
  const sorted = [...reports].sort((a, b) => new Date(b.deletedAt || 0) - new Date(a.deletedAt || 0));

  if (sorted.length === 0) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, padding: "60px 20px", color: C.muted, textAlign: "center" }}>
        <Trash2 size={30} strokeWidth={1.5} />
        <span style={{ fontSize: 13 }}>휴지통이 비어있어요.</span>
      </div>
    );
  }

  return (
    <div style={{ animation: "fadein .3s ease" }}>
      <p style={{ fontSize: 12, color: C.muted, marginBottom: 14, lineHeight: 1.6 }}>
        삭제된 신고는 여기서 복구하거나 완전히 지울 수 있어요.
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {sorted.map((r) => {
          const h = hazardOf(r.hazard);
          return (
            <div key={r.id} style={{ background: C.surface, borderRadius: 12, padding: 12, borderLeft: `4px solid ${C.line}`, opacity: 0.85 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                <span style={{ fontSize: 11.5, fontWeight: 700, color: h.color }}>{hazardLabel(r)}</span>
              </div>
              <div style={{ fontSize: 13.5, fontWeight: 600, display: "flex", alignItems: "center", gap: 5 }}>
                <MapPin size={12} color={C.muted} /> {r.location}
              </div>
              <div className="mono" style={{ fontSize: 11, color: C.muted, marginTop: 3 }}>
                {r.deletedAt ? `${fmtDateTime(r.deletedAt)} 삭제됨` : ""}
              </div>

              <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                <button onClick={() => onRestore(r.id)} style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 5, background: `${C.blue}18`, border: `1px solid ${C.blue}`, borderRadius: 8, padding: "7px 0", color: C.blue, fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}>
                  <RefreshCw size={12} /> 복구
                </button>
                <button onClick={() => setConfirmId(r.id)} style={{ flex: 1, background: "transparent", border: `1px solid ${C.line}`, borderRadius: 8, padding: "7px 0", color: C.muted, fontSize: 12.5, cursor: "pointer" }}>
                  완전 삭제
                </button>
              </div>

              {confirmId === r.id && (
                <div style={{ marginTop: 10, background: C.surfaceAlt, borderRadius: 8, padding: 10, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                  <span style={{ fontSize: 12, color: C.muted }}>영구 삭제할까요? 되돌릴 수 없어요.</span>
                  <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                    <button onClick={() => setConfirmId(null)} style={{ fontSize: 12, background: "transparent", border: `1px solid ${C.line}`, color: C.muted, borderRadius: 6, padding: "4px 10px", cursor: "pointer" }}>취소</button>
                    <button onClick={() => { onPermanentDelete(r.id); setConfirmId(null); }} style={{ fontSize: 12, background: C.red, border: "none", color: "#fff", borderRadius: 6, padding: "4px 10px", cursor: "pointer" }}>삭제</button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function StatBadge({ label, value, color, active, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1, background: active ? `${color}22` : C.surface, borderRadius: 9, padding: "8px 3px",
        textAlign: "center", border: `1.5px solid ${active ? color : C.line}`, cursor: "pointer", minWidth: 0,
      }}
    >
      <div className="mono" style={{ fontSize: 16, fontWeight: 700, color }}>{value}</div>
      <div style={{ fontSize: 9.5, color: active ? color : C.muted, marginTop: 2, fontWeight: active ? 700 : 400, whiteSpace: "nowrap" }}>{label}</div>
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
