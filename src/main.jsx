import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import ReportApp from "./ReportApp.jsx";
import AdminApp from "./AdminApp.jsx";
import "./index.css";

// acha-sago-admin.vercel.app 도메인에서는 "/" 자체가 바로 관리자 화면이 뜨도록 처리
// (iOS 홈 화면 추가 시 start_url이 "/"로 취급되는 문제를 도메인 분리로 근본 해결)
const isAdminDomain = typeof window !== "undefined" && window.location.hostname.startsWith("acha-sago-admin");

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      {isAdminDomain ? (
        <Routes>
          <Route path="*" element={<AdminApp />} />
        </Routes>
      ) : (
        <Routes>
          <Route path="/" element={<ReportApp />} />
          <Route path="/admin" element={<AdminApp />} />
        </Routes>
      )}
    </BrowserRouter>
  </React.StrictMode>
);
