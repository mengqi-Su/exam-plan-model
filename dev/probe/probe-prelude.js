/* 探针前置脚本：由 dev/probe/install.cjs 拷进 dist/，只在本机验证时存在。
   1) 语言从 ?lang= 拿，写进 localStorage，App 挂载时读它；
   2) 拦掉 /functions/v1/app/*，避免在本机 origin 上刷网络错误；
   3) 暴露 __probeSeed(plans) / __probeClearPlans()，直接写 IndexedDB 的 plans store。
   发布前 dist/ 里的探针文件要删干净（install.cjs 生成的一切都不该上线）。 */
(function () {
  var params = new URLSearchParams(location.search);
  var lang = params.get("lang") === "en" ? "en" : "zh";
  try {
    localStorage.setItem("exam_planner_language_preference", lang);
  } catch (e) { /* 存储被禁就直接跑，语言回落中文 */ }

  var realFetch = window.fetch ? window.fetch.bind(window) : null;
  window.fetch = function (input, init) {
    var url = String(typeof input === "string" ? input : (input && input.url) || "");
    if (url.indexOf("/functions/v1/app/") >= 0) {
      return Promise.resolve(new Response(JSON.stringify({ ok: true, data: null }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }));
    }
    return realFetch ? realFetch(input, init) : Promise.reject(new Error("no fetch"));
  };

  /* 与 src/lib/storage.ts 同一份库名/版本/store 定义；那边改了这里也要改。 */
  var DB_NAME = "exam_planner_local";
  var DB_VERSION = 3;

  function open() {
    return new Promise(function (resolve, reject) {
      var req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = function () {
        var db = req.result;
        if (!db.objectStoreNames.contains("plans")) db.createObjectStore("plans", { keyPath: "id" });
        if (!db.objectStoreNames.contains("practice_events")) db.createObjectStore("practice_events", { keyPath: "attemptId" });
        if (!db.objectStoreNames.contains("wizard_draft")) db.createObjectStore("wizard_draft", { keyPath: "id" });
      };
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(req.error); };
    });
  }

  window.__probeSeed = function (plans) {
    return open().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction("plans", "readwrite");
        var store = tx.objectStore("plans");
        store.clear();
        plans.forEach(function (p) { store.put(p); });
        tx.oncomplete = function () { db.close(); resolve(plans.length); };
        tx.onerror = function () { db.close(); reject(tx.error); };
      });
    });
  };

  window.__probeClearPlans = function () {
    return open().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction("plans", "readwrite");
        tx.objectStore("plans").clear();
        tx.oncomplete = function () { db.close(); resolve(0); };
        tx.onerror = function () { db.close(); reject(tx.error); };
      });
    });
  };
})();
