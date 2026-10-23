<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref, watch } from 'vue';
import {
  DockviewVue,
  themeDark,
  type DockviewApi,
  type DockviewReadyEvent,
  type SerializedDockview,
} from 'dockview-vue';
import HierarchyPanel from './components/HierarchyPanel.vue';
import InspectorPanel from './components/InspectorPanel.vue';
import AssetsPanel from './components/AssetsPanel.vue';
import AnimationPanel from './components/AnimationPanel.vue';
import ConsolePanel from './components/ConsolePanel.vue';
import ScenePanel from './components/ScenePanel.vue';
import ProjectHome from './components/ProjectHome.vue';
import {
  advance,
  download,
  importFile,
  downloadGamePackage,
  applyToSlotGame,
  importGamePackage,
  log,
  redo,
  state,
  undo,
} from './editor/store';
const titles: Record<string, string> = {
  hierarchy: '계층',
  scene: '화면',
  inspector: '속성',
  assets: '에셋',
  animation: '연출 / 타임라인',
  console: '콘솔',
};
let api: DockviewApi,
  disposeLayout: (() => void) | undefined,
  frame = 0,
  last = 0;
let disposeDesktop: (() => void) | undefined;
watch(
  () => state.dirty,
  (dirty) => window.editorDesktop?.reportUnsavedChanges(dirty),
  { immediate: true },
);
const fileInput = ref<HTMLInputElement>(),
  fileKind = ref<'work' | 'data'>('work'),
  panelChoice = ref(''),
  workspaceName = ref('기본 작업 배치'),
  presets = ref<string[]>([]);
function openPanel(id: string) {
  if (!titles[id]) return;
  const existing = api.getPanel(id);
  if (existing) existing.api.setActive();
  else api.addPanel({ id, component: id, title: titles[id], renderer: 'always' });
}
function defaults() {
  api.clear();
  api.addPanel({ id: 'scene', component: 'scene', title: titles.scene, renderer: 'always' });
  api.addPanel({
    id: 'hierarchy',
    component: 'hierarchy',
    title: titles.hierarchy,
    renderer: 'always',
    initialWidth: 250,
    position: { referencePanel: 'scene', direction: 'left' },
  });
  api.addPanel({
    id: 'inspector',
    component: 'inspector',
    title: titles.inspector,
    renderer: 'always',
    initialWidth: 280,
    position: { referencePanel: 'scene', direction: 'right' },
  });
  api.addPanel({
    id: 'assets',
    component: 'assets',
    title: titles.assets,
    renderer: 'always',
    initialHeight: 230,
    position: { referencePanel: 'scene', direction: 'below' },
  });
  api.addPanel({
    id: 'animation',
    component: 'animation',
    title: titles.animation,
    renderer: 'always',
    position: { referencePanel: 'assets', direction: 'within' },
    inactive: true,
  });
  api.addPanel({
    id: 'console',
    component: 'console',
    title: titles.console,
    renderer: 'always',
    position: { referencePanel: 'assets', direction: 'within' },
    inactive: true,
  });
}
function restore(value: unknown) {
  const data = value as SerializedDockview;
  if (
    !data ||
    !data.panels ||
    Object.keys(data.panels).length > 6 ||
    Object.entries(data.panels).some(([id, p]) => !titles[id] || p.contentComponent !== id)
  )
    throw new Error('지원하지 않는 배치입니다.');
  api.fromJSON(data);
}
function ready(e: DockviewReadyEvent) {
  disposeLayout?.();
  api = e.api;
  try {
    const raw = localStorage.getItem('workspace:last');
    if (raw) restore(JSON.parse(raw));
    else defaults();
  } catch {
    defaults();
    log('저장된 배치를 복원하지 못해 기본 배치를 열었습니다.', '오류');
  }
  const listener = api.onDidLayoutChange(() => {
    try {
      localStorage.setItem('workspace:last', JSON.stringify(api.toJSON()));
    } catch {
      log('배치 자동 저장에 실패했습니다.', '오류');
    }
  });
  disposeLayout = () => listener.dispose();
}
function floatActive() {
  const p = api.activePanel;
  if (p) api.addFloatingGroup(p, { width: 620, height: 420, position: { left: 90, top: 60 } });
}
function maximize() {
  if (api.hasMaximizedGroup()) api.exitMaximizedGroup();
  else if (api.activePanel) api.maximizeGroup(api.activePanel);
}
function saveWorkspace() {
  try {
    const name = workspaceName.value.trim();
    if (!name) return;
    localStorage.setItem(`workspace:preset:${name}`, JSON.stringify(api.toJSON()));
    listPresets();
    log(`배치 '${name}' 저장 완료`);
  } catch {
    log('배치를 저장할 수 없습니다.', '오류');
  }
}
function listPresets() {
  presets.value = Object.keys(localStorage)
    .filter((k) => k.startsWith('workspace:preset:'))
    .map((k) => k.slice(17));
}
function loadWorkspace(e: Event) {
  const name = (e.target as HTMLSelectElement).value;
  if (!name) return;
  try {
    restore(JSON.parse(localStorage.getItem(`workspace:preset:${name}`) || 'null'));
    workspaceName.value = name;
  } catch {
    log('배치를 불러올 수 없습니다.', '오류');
  }
}
function beforeUnload(e: BeforeUnloadEvent) {
  if (state.dirty) {
    e.preventDefault();
    e.returnValue = '';
  }
}
function keyboard(e: KeyboardEvent) {
  if (state.projectPickerOpen) return;
  if (!(e.ctrlKey || e.metaKey)) return;
  const key = e.key.toLowerCase();
  if (key === 's') {
    e.preventDefault();
    download();
  }
  if (key === 'z') {
    e.preventDefault();
    if (e.shiftKey) redo();
    else undo();
  }
}
onMounted(() => {
  disposeDesktop = window.editorDesktop?.onShowProjects(() => {
    state.projectPickerOpen = true;
  });
  try {
    listPresets();
  } catch {}
  window.addEventListener('beforeunload', beforeUnload);
  window.addEventListener('keydown', keyboard);
  const tick = (now: number) => {
    if (last && !state.projectPickerOpen) advance(Math.min(100, now - last));
    last = now;
    frame = requestAnimationFrame(tick);
  };
  frame = requestAnimationFrame(tick);
});
onBeforeUnmount(() => {
  cancelAnimationFrame(frame);
  disposeLayout?.();
  disposeDesktop?.();
  window.removeEventListener('beforeunload', beforeUnload);
  window.removeEventListener('keydown', keyboard);
});
</script>
<template>
  <ProjectHome v-if="state.projectPickerOpen" />
  <div v-else class="app-shell">
    <header class="app-header">
      <div class="brand-mark">P<span>e</span></div>
      <div class="brand-copy">
        <strong>Phaser Editor</strong><span>화면과 연출을 만드는 작업실</span>
      </div>
      <div class="header-divider"></div>
      <span class="document-name">{{ state.doc.name }}<b v-if="state.dirty"> ●</b></span
      ><span class="spacer"></span><span class="version-chip">개발 버전 0.1</span>
    </header>
    <nav class="main-toolbar">
      <button @click="state.projectPickerOpen = true">프로젝트 / 화면 선택</button>
      <span>작업</span>
      <button
        @click="
          fileKind = 'work';
          fileInput?.click();
        "
      >
        작업 불러오기</button
      ><button
        class="accent"
        @click="download"
        title="편집 문서를 .scene.json 파일로 저장 · Ctrl/⌘ S"
      >
        작업 저장</button
      ><input
        ref="fileInput"
        hidden
        type="file"
        accept=".json"
        @change="
          importFile(($event.target as HTMLInputElement).files?.[0], fileKind);
          ($event.target as HTMLInputElement).value = '';
        "
      />
      <span class="toolbar-separator"></span><span>데이터</span>
      <button
        @click="
          fileKind = 'data';
          fileInput?.click();
        "
      >
        데이터 Import
      </button>
      <button :disabled="!state.doc.source" @click="downloadGamePackage">데이터 Export</button>
      <button v-if="state.doc.source" @click="applyToSlotGame">슬롯에 적용</button>
      <button v-if="state.activeProject?.kind === 'slot'" @click="importGamePackage">
        게임 적용본</button
      ><span class="toolbar-separator"></span
      ><button @click="undo" :disabled="!state.canUndo" title="Ctrl/⌘ Z">↶ 실행 취소</button
      ><button @click="redo" :disabled="!state.canRedo" title="Ctrl/⌘ Shift Z">↷ 다시 실행</button
      ><span class="toolbar-separator"></span>
      <select
        aria-label="패널 열기"
        v-model="panelChoice"
        @change="
          openPanel(panelChoice);
          panelChoice = '';
        "
      >
        <option value="">패널 열기</option>
        <option v-for="(title, id) in titles" :key="id" :value="id">{{ title }}</option></select
      ><button @click="floatActive">패널 띄우기</button
      ><button @click="maximize">최대화 / 복원</button><button @click="defaults">기본 배치</button>
    </nav>
    <DockviewVue
      class="workspace"
      :theme="themeDark"
      @ready="ready"
      :floating-group-bounds="'boundedWithinViewport'"
    >
      <template #panel-hierarchy><HierarchyPanel /></template
      ><template #panel-scene><ScenePanel /></template
      ><template #panel-inspector><InspectorPanel /></template
      ><template #panel-assets><AssetsPanel /></template
      ><template #panel-animation><AnimationPanel /></template
      ><template #panel-console><ConsolePanel /></template>
    </DockviewVue>
    <footer class="status-bar">
      <span class="live-dot"></span
      ><span>{{ state.loading ? '에셋 연결 중…' : `${state.assets.length}개 에셋 연결` }}</span
      ><span class="status-message" :class="{ error: state.logs.at(-1)?.level === '오류' }">{{
        state.logs.at(-1)?.message || '준비됨'
      }}</span
      ><span class="spacer"></span><input aria-label="배치 이름" v-model="workspaceName" /><button
        @click="saveWorkspace"
      >
        배치 저장</button
      ><select aria-label="저장한 배치" @change="loadWorkspace">
        <option value="">배치 불러오기</option>
        <option v-for="p in presets" :key="p">{{ p }}</option>
      </select>
    </footer>
  </div>
</template>
