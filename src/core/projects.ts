export interface ProjectScene {
  id: string;
  name: string;
  description: string;
  assetRoot: string;
  kind: 'slot-layout' | 'assets';
  orientation: 'landscape' | 'portrait';
  hasApplied: boolean;
}
export interface EditorProject {
  id: string;
  name: string;
  root: string;
  kind: 'slot' | 'template' | 'assets';
  description: string;
  scenes: ProjectScene[];
}
