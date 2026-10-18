import { texts } from './texts.js';

/**
 * The account section of the settings dialog: signing in with Google, choosing a username,
 * the state of the sync, signing out and deleting the account. It shows what it is given and
 * reports what the player does.
 */
export class AccountPanel {
  #elements;
  #actions = {
    onSignIn: () => {},
    onSignOut: () => {},
    onDelete: () => {},
    onSaveName: () => {},
    onRetry: () => {}
  };

  /** @param {ParentNode} root */
  constructor(root) {
    const find = (selector) => root.querySelector(selector);
    this.#elements = {
      section: find('#account'),
      signedOut: find('#account-out'),
      signedIn: find('#account-in'),
      note: find('#account-note'),
      signIn: find('#account-signin'),
      who: find('#account-who'),
      nameForm: find('#account-name-form'),
      nameInput: find('#account-name-input'),
      status: find('#account-status'),
      signOut: find('#account-signout'),
      delete: find('#account-delete'),
      error: find('#account-error')
    };
    const { signIn, nameForm, nameInput, signOut, delete: remove, status } = this.#elements;
    signIn.addEventListener('click', () => this.#actions.onSignIn());
    signOut.addEventListener('click', () => this.#actions.onSignOut());
    remove.addEventListener('click', () => this.#actions.onDelete());
    status.addEventListener('click', () => this.#actions.onRetry());
    nameForm.addEventListener('submit', (event) => {
      event.preventDefault();
      this.#actions.onSaveName(nameInput.value);
    });
  }

  /**
   * @param {object} actions
   * @param {() => void} actions.onSignIn
   * @param {() => void} actions.onSignOut
   * @param {() => void} actions.onDelete
   * @param {(name: string) => void} actions.onSaveName
   * @param {() => void} actions.onRetry asked by tapping a failed sync
   */
  bindActions(actions) {
    this.#actions = actions;
  }

  /** Shows the section; it stays hidden when the game has no account service. */
  enable() {
    this.#elements.section.hidden = false;
  }

  /**
   * @param {import('../cloud/account.js').AccountState} account
   * @param {import('../cloud/cloudSync.js').SyncStatus} sync
   * @param {string | null} [message] what to tell the player, e.g. about a name that is taken
   */
  render(account, sync, message = null) {
    const elements = this.#elements;
    const signedIn = account.user !== null;
    elements.signedOut.hidden = signedIn;
    elements.signedIn.hidden = !signedIn;
    elements.note.textContent = texts.accountSignedOut;
    elements.signIn.disabled = account.status === 'signingIn';

    const needsName = account.status === 'needsName';
    elements.nameForm.hidden = !needsName;
    if (signedIn) {
      const name = account.username ? `@${account.username}` : (account.user.name ?? '');
      elements.who.textContent = name ? texts.accountSignedInAs(name) : texts.accountSignedIn;
      elements.status.textContent = needsName
        ? texts.accountNeedsName
        : texts.accountSyncStatus(sync);
      elements.status.classList.toggle('retry', sync === 'failed');
    }

    const text = message ?? (account.error ? texts.accountError(account.error) : '');
    elements.error.textContent = text;
    elements.error.hidden = text === '';
  }

  focusName() {
    this.#elements.nameInput.focus({ preventScroll: true });
  }
}
