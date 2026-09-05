(function () {
  // Resolve the font directory relative to this script so MathJax never
  // depends on an external CDN (its bundled default is cdn.jsdelivr.net,
  // which is unreachable from many networks and browser kernels).
  var script =
    document.currentScript ||
    (function () {
      var scripts = document.getElementsByTagName('script');
      return scripts[scripts.length - 1];
    })();
  var scriptBase = String(script.src).replace(/mathjax-config\.js.*$/, '');

  function renderPendingMath() {
    if (!window.MathJax || !window.MathJax.typesetPromise) return Promise.resolve();

    const pending = Array.from(document.querySelectorAll('.arithmatex')).filter(
      (element) => !element.querySelector('mjx-container')
    );
    if (pending.length === 0) return Promise.resolve();

    return window.MathJax.typesetPromise(pending).catch((error) => {
      console.warn('MathJax render failed:', error);
    });
  }

  function renderAfterStartup() {
    return window.MathJax.startup.promise.then(renderPendingMath);
  }

  window.MathJax = {
    tex: {
      inlineMath: [['$', '$'], ['\\(', '\\)']],
      displayMath: [['$$', '$$'], ['\\[', '\\]']],
      processEscapes: true,
      processEnvironments: true,
      tags: 'ams'
    },
    options: {
      ignoreHtmlClass: '.*|',
      processHtmlClass: 'arithmatex',
      chtml: {
        fontURL: scriptBase + 'vendor/mathjax/output/chtml/fonts/woff-v2'
      }
    },
    startup: {
      typeset: false,
      ready: () => {
        window.MathJax.startup.defaultReady();
        renderAfterStartup();

        if (window.document$ && typeof window.document$.subscribe === 'function') {
          window.document$.subscribe(renderAfterStartup);
        }
      }
    }
  };
})();
