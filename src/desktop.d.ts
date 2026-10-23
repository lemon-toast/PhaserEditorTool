export {};
declare global {
  interface Window {
    editorDesktop?: {
      chooseProjectFolder: () => Promise<string | null>;
      onShowProjects: (callback: () => void) => () => void;
      reportUnsavedChanges: (dirty: boolean) => void;
    };
  }
}
