document.addEventListener('DOMContentLoaded', () => {
  const supportHistory = window.history && window.history.pushState;
  if (!supportHistory) return;

  const layoutFrame = document.querySelector('.hermes-layout-frame');
  if (!layoutFrame) return;

  // Intercepter les clics sur les liens locaux
  document.addEventListener('click', (e) => {
    const link = e.target.closest('a');
    if (!link) return;

    const href = link.getAttribute('href');
    if (!href) return;

    // Ignorer les liens externes, ancres, protocoles spéciaux, téléchargements, etc.
    if (
      link.target === '_blank' ||
      link.hasAttribute('download') ||
      href.startsWith('#') ||
      href.startsWith('mailto:') ||
      href.startsWith('tel:') ||
      href.startsWith('javascript:')
    ) {
      return;
    }

    // Vérifier si le lien pointe vers le même domaine
    try {
      const url = new URL(link.href);
      if (url.origin !== window.location.origin) return;

      e.preventDefault();
      loadPage(url.pathname + url.search + url.hash);
    } catch (err) {
      // Ignorer les erreurs d'analyse d'URL
    }
  });

  // Gérer le retour et l'avance dans l'historique du navigateur
  window.addEventListener('popstate', () => {
    loadPage(window.location.pathname + window.location.search + window.location.hash, true);
  });

  async function mergeHeadAndLoadScripts(newDoc) {
    const currentHead = document.head;
    const newHead = newDoc.head;

    // Update theme-color meta if exists
    const currentMetaColor = currentHead.querySelector('meta[name="theme-color"]');
    const newMetaColor = newHead.querySelector('meta[name="theme-color"]');
    if (currentMetaColor && newMetaColor) {
      currentMetaColor.setAttribute('content', newMetaColor.getAttribute('content'));
    }

    const elements = newHead.querySelectorAll('link, style, script');
    const scriptPromises = [];

    elements.forEach(elem => {
      let exists = false;
      if (elem.tagName === 'LINK') {
        const href = elem.getAttribute('href');
        if (href) exists = !!currentHead.querySelector(`link[href="${href}"]`);
      } else if (elem.tagName === 'SCRIPT') {
        const src = elem.getAttribute('src');
        if (src) {
          exists = !!currentHead.querySelector(`script[src="${src}"]`);
        } else {
          // Compare inline script content
          const inlineScripts = currentHead.querySelectorAll('script:not([src])');
          for (let s of inlineScripts) {
            if (s.textContent === elem.textContent) {
              exists = true;
              break;
            }
          }
        }
      } else if (elem.tagName === 'STYLE') {
        const inlineStyles = currentHead.querySelectorAll('style');
        for (let s of inlineStyles) {
          if (s.textContent === elem.textContent) {
            exists = true;
            break;
          }
        }
      }

      if (!exists) {
        const clone = document.createElement(elem.tagName);
        Array.from(elem.attributes).forEach(attr => {
          clone.setAttribute(attr.name, attr.value);
        });
        clone.textContent = elem.textContent;

        if (elem.tagName === 'SCRIPT' && elem.getAttribute('src')) {
          const promise = new Promise((resolve) => {
            clone.onload = resolve;
            clone.onerror = resolve; // Continue even if load fails
          });
          scriptPromises.push(promise);
        }

        currentHead.appendChild(clone);
      }
    });

    await Promise.all(scriptPromises);
  }

  async function loadPage(urlPath, isPopstate = false) {
    // Lancer la transition de fondu de sortie
    layoutFrame.classList.add('transitioning');

    try {
      const response = await fetch(urlPath);
      if (!response.ok) throw new Error('Échec du chargement de la page');

      const htmlText = await response.text();

      // Parser le HTML récupéré
      const parser = new DOMParser();
      const newDoc = parser.parseFromString(htmlText, 'text/html');

      const newFrame = newDoc.querySelector('.hermes-layout-frame');
      if (!newFrame) {
        // Si la page cible n'a pas notre cadre de mise en page, charger normalement
        window.location.href = urlPath;
        return;
      }

      // Fusionner les balises head et charger les dépendances scripts
      await mergeHeadAndLoadScripts(newDoc);

      // Attendre la fin de la transition de fondu de sortie (150ms)
      setTimeout(() => {
        // Mettre à jour l'historique (sauf si popstate)
        if (!isPopstate) {
          window.history.pushState(null, '', urlPath);
        }

        // Mettre à jour le titre du document
        document.title = newDoc.title;

        // Synchroniser les classes et styles de body (critique pour le background et layout)
        document.body.className = newDoc.body.className;
        document.body.style.cssText = newDoc.body.style.cssText;

        // Remplacer le contenu du cadre principal
        layoutFrame.innerHTML = newFrame.innerHTML;

        // Réinitialiser la barre de lecture à 0%
        const progress = document.getElementById('reading-progress');
        if (progress) progress.style.width = '0%';

        // Ré-exécuter les scripts présents dans la nouvelle page.
        // IMPORTANT: on requête depuis layoutFrame (DOM actif), pas newFrame
        // (document DOMParser inactif) — les scripts dans un doc inactif ne s'exécutent jamais.
        // On sépare les scripts externes (src) des scripts inline pour les charger dans l'ordre.
        const allScripts = Array.from(layoutFrame.querySelectorAll('script'));
        const externalScripts = allScripts.filter(s => s.src);
        const inlineScripts   = allScripts.filter(s => !s.src);

        // Charge les scripts externes en séquence, puis exécute les inline
        function runInlineScripts() {
          inlineScripts.forEach(oldScript => {
            const newScript = document.createElement('script');
            Array.from(oldScript.attributes).forEach(attr => newScript.setAttribute(attr.name, attr.value));
            newScript.textContent = oldScript.textContent;
            oldScript.parentNode.replaceChild(newScript, oldScript);
          });
        }

        if (externalScripts.length === 0) {
          runInlineScripts();
        } else {
          // Charge chaque script externe dans l'ordre, puis lance les inline
          let chain = Promise.resolve();
          externalScripts.forEach(oldScript => {
            chain = chain.then(() => new Promise((resolve) => {
              const newScript = document.createElement('script');
              Array.from(oldScript.attributes).forEach(attr => newScript.setAttribute(attr.name, attr.value));
              newScript.src = oldScript.src;
              newScript.onload  = resolve;
              newScript.onerror = resolve; // continue even on failure
              oldScript.parentNode.replaceChild(newScript, oldScript);
            }));
          });
          chain.then(runInlineScripts);
        }

        // Relancer MathJax si présent
        if (window.MathJax && typeof window.MathJax.typesetPromise === 'function') {
          window.MathJax.typesetPromise().catch((err) => console.error(err));
        }

        // Relancer Mermaid si présent
        window.dispatchEvent(new Event('mermaid-render'));

        // Gérer le défilement (ancre ou haut de page)
        const hash = window.location.hash;
        if (hash) {
          const targetElem = document.querySelector(hash);
          if (targetElem) {
            targetElem.scrollIntoView({ behavior: 'smooth' });
          } else {
            window.scrollTo(0, 0);
          }
        } else {
          window.scrollTo(0, 0);
        }

        // Enlever la classe de transition pour le fondu d'entrée
        layoutFrame.classList.remove('transitioning');
      }, 150);

    } catch (err) {
      console.warn('Seamless transition failed, falling back to direct load:', err);
      window.location.href = urlPath;
    }
  }
});
