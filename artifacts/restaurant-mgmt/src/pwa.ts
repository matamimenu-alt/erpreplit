// Progressive Web App registration + automatic-update handling.
//
// Installing this service worker makes the app installable on phones
// ("Add to Home Screen") and lets it run full-screen like a native app.
// Updates are delivered automatically: whenever a new build is deployed the
// worker picks it up and the running app reloads itself onto the new version,
// so users always run the latest code without reinstalling anything.
export function registerPWA() {
  if (typeof window === "undefined") return;
  if (!("serviceWorker" in navigator)) return;
  // Only register for real (https / localhost) origins — skip the dev server.
  if (!window.isSecureContext) return;

  let reloaded = false;

  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js")
      .then((reg) => {
        // A new worker was found — watch it until it is ready, then reload.
        reg.addEventListener("updatefound", () => {
          const nw = reg.installing;
          if (!nw) return;
          nw.addEventListener("statechange", () => {
            // `controller` is only set once a previous version was already in
            // control, so this branch fires for UPDATES, never the first install.
            if (nw.state === "installed" && navigator.serviceWorker.controller && !reloaded) {
              reloaded = true;
              window.location.reload();
            }
          });
        });

        // Proactively look for a newer deployment on launch, when the app
        // regains focus, and hourly while it stays open.
        const check = () => reg.update().catch(() => {});
        document.addEventListener("visibilitychange", () => {
          if (document.visibilityState === "visible") check();
        });
        window.setInterval(check, 60 * 60 * 1000);
      })
      .catch(() => {
        /* registration failures are non-fatal — the app still works online */
      });
  });
}
