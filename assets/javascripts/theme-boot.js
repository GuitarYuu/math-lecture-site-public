(function () {
  const config = window.SITE_CONFIG || {};
  const root = document.documentElement;
  root.dataset.siteTheme = config.theme || "material";
  if (config.course) root.dataset.course = config.course;
})();
