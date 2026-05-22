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
        // Si la page cible n'a pas notre cadre de mise en page (ex. workout.html), charger normalement
        window.location.href = urlPath;
        return;
      }

      // Attendre la fin de la transition de fondu de sortie (150ms)
      setTimeout(() => {
        // Mettre à jour l'historique (sauf si popstate)
        if (!isPopstate) {
          window.history.pushState(null, '', urlPath);
        }

        // Mettre à jour le titre du document
        document.title = newDoc.title;

        // Remplacer le contenu du cadre principal
        layoutFrame.innerHTML = newFrame.innerHTML;

        // Réinitialiser la barre de lecture à 0%
        const progress = document.getElementById('reading-progress');
        if (progress) progress.style.width = '0%';

        // Ré-exécuter les scripts présents dans la nouvelle page
        const scripts = newFrame.querySelectorAll('script');
        scripts.forEach(oldScript => {
          const newScript = document.createElement('script');
          Array.from(oldScript.attributes).forEach(attr => {
            newScript.setAttribute(attr.name, attr.value);
          });
          if (oldScript.src) {
            newScript.src = oldScript.src;
          } else {
            newScript.textContent = oldScript.textContent;
          }
          oldScript.parentNode.replaceChild(newScript, oldScript);
        });

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
