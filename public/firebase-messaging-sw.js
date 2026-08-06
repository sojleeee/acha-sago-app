importScripts("https://www.gstatic.com/firebasejs/10.13.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.13.0/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyB3gvkt1Xi3DLGnK9IK8s3b4eLXSIstxnk",
  authDomain: "acha-sago.firebaseapp.com",
  projectId: "acha-sago",
  storageBucket: "acha-sago.firebasestorage.app",
  messagingSenderId: "843342964801",
  appId: "1:843342964801:web:ddc17feba7faa65044bec0",
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const title = payload.notification?.title || "아차사고 발굴";
  const options = {
    body: payload.notification?.body || "새 신고가 접수되었습니다.",
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    data: payload.data || {},
  };
  self.registration.showNotification(title, options);
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    clients.openWindow("/admin")
  );
});
