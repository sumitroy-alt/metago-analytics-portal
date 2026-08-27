/* Bridges the portal UI to real MetaGo SSO (window.__ME__ injected by the server).
   Replaces the prototype's mock sign-in and local "current user" with the verified
   identity + this app's access record. Runs after the portal's own scripts. */
(function () {
  var ME = window.__ME__;
  if (!ME) return;

  // Real signed-in identity → the portal's access model.
  window.__resetCU__ = function () {
    window.CU = { role: ME.role, dash: ME.dashboards || [], dl: !!ME.download, email: ME.email, name: ME.name };
  };
  window.__resetCU__();

  function boot() {
    // Skip the prototype login screen — the server already authenticated us.
    var login = document.getElementById('view-login');
    var app = document.getElementById('view-app');
    if (login) login.classList.add('hidden');
    if (app) app.classList.remove('hidden');
    if (typeof goPortal === 'function') goPortal();
    if (typeof applyAccess === 'function') applyAccess();

    // Header: initials, who's signed in, and real sign-out.
    var av = document.querySelector('.topbar .avatar');
    if (av) av.textContent = (ME.name || ME.email).replace(/[^A-Za-z ]/g, '').split(' ').map(function (s) { return s[0]; }).join('').slice(0, 2).toUpperCase() || ME.email.slice(0, 2).toUpperCase();
    var sub = document.querySelector('.brand small');
    if (sub) sub.textContent = 'Signed in as ' + ME.email;
    window.signOut = function () { location.href = '/api/auth/logout'; };
    window.signIn = function () { boot(); };

    // Not a preview any more.
    var rib = document.querySelector('.ribbon');
    if (rib) rib.style.display = 'none';

    // Pending users (approved-but-no-access) see a friendly message instead of a blank portal.
    if (ME.status === 'pending' && ME.role !== 'admin') {
      var cards = document.getElementById('cards');
      if (cards) cards.innerHTML = '<div style="padding:26px;color:var(--ink-3);font-size:13px">Your account is awaiting access approval from an admin.</div>';
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
