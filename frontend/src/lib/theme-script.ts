export const THEME_STORAGE_KEY = "theme";

export const themeInitScript = `(function(){try{var stored=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});var system=window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";var theme=stored==="light"||stored==="dark"?stored:system;var root=document.documentElement;root.classList.remove("light","dark");root.classList.add(theme);root.style.colorScheme=theme;}catch(e){}})();`;
