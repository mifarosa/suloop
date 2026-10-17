const SCRIPT_URL = 'https://accounts.google.com/gsi/client';

let loading = null;

/** Loads Google's sign-in script the first time it is needed. */
function loadGoogleScript() {
  loading ??= new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = SCRIPT_URL;
    script.async = true;
    script.onload = () => resolve(globalThis.google.accounts.id);
    script.onerror = () => {
      loading = null;
      reject(Object.assign(new Error('Google sign-in did not load'), { code: 'network' }));
    };
    document.head.append(script);
  });
  return loading;
}

/**
 * Draws Google's own "Sign in with Google" button in `element`. When the player signs in,
 * `onCredential` gets the ID token Google made for them (the server checks it).
 *
 * @param {HTMLElement} element
 * @param {{ clientId: string, locale: string, onCredential: (token: string) => void }} options
 */
export async function renderGoogleButton(element, { clientId, locale, onCredential }) {
  const id = await loadGoogleScript();
  id.initialize({
    client_id: clientId,
    callback: ({ credential }) => onCredential(credential),
    // The server sets the session itself; Google need not remember the choice.
    auto_select: false
  });
  element.replaceChildren();
  id.renderButton(element, { type: 'standard', theme: 'outline', size: 'large', locale });
}
