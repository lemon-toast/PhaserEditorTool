<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import type { EditorProject } from '../core/projects';
import { openProjectScene, state } from '../editor/store';
const projects = ref<EditorProject[]>([]),
  selectedRoot = ref(''),
  selectedScene = ref(''),
  loading = ref(true),
  opening = ref(false),
  error = ref(''),
  folder = ref(''),
  mode = ref<'original' | 'applied'>('original');
const project = computed(() => projects.value.find((p) => p.root === selectedRoot.value));
const scene = computed(() => project.value?.scenes.find((s) => s.id === selectedScene.value));
const isDesktop = !!window.editorDesktop;
function select(p: EditorProject) {
  selectedRoot.value = p.root;
  selectedScene.value = p.scenes[0]?.id || '';
  mode.value = 'original';
  error.value = '';
}
async function inspect(root: string) {
  const response = await fetch('/api/projects/inspect', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Editor-Request': '1' },
    body: JSON.stringify({ root }),
  });
  const value = await response.json();
  if (!response.ok) throw new Error(value.error);
  const index = projects.value.findIndex((p) => p.root === value.root);
  if (index >= 0) projects.value[index] = value;
  else projects.value.unshift(value);
  return value as EditorProject;
}
async function chooseFolder() {
  try {
    const path = window.editorDesktop
      ? await window.editorDesktop.chooseProjectFolder()
      : folder.value.trim();
    if (!path) return;
    loading.value = true;
    select(await inspect(path));
  } catch (e) {
    error.value = (e as Error).message;
  } finally {
    loading.value = false;
  }
}
async function open(example = false) {
  opening.value = true;
  error.value = '';
  try {
    await openProjectScene(project.value, scene.value, example ? 'example' : mode.value);
  } catch (e) {
    error.value = (e as Error).message;
  } finally {
    opening.value = false;
  }
}
onMounted(async () => {
  try {
    const response = await fetch('/api/projects');
    if (!response.ok) throw new Error('프로젝트 목록을 읽지 못했습니다.');
    projects.value = await response.json();
    let recent: string[] = [];
    try {
      const value = JSON.parse(localStorage.getItem('projects:recent') || '[]');
      if (Array.isArray(value)) recent = value.filter((p) => typeof p === 'string').slice(0, 8);
    } catch {}
    for (const root of recent)
      if (!projects.value.some((p) => p.root === root)) await inspect(root).catch(() => {});
    const current =
      projects.value.find((p) => p.root === state.activeProject?.root) ||
      projects.value.find((p) => p.root === recent[0]) ||
      projects.value[0];
    if (current) select(current);
  } catch (e) {
    error.value = (e as Error).message;
  } finally {
    loading.value = false;
  }
});
</script>
<template>
  <main class="project-home">
    <header class="home-header">
      <div class="brand-mark">P<span>e</span></div>
      <div>
        <strong>Phaser Editor</strong>
        <p>프로젝트와 화면을 선택하고 편집을 시작하세요.</p>
      </div>
      <span class="spacer"></span
      ><button v-if="state.hasOpenDocument" @click="state.projectPickerOpen = false">
        편집 화면으로 돌아가기
      </button>
    </header>
    <section class="home-content">
      <div class="home-intro">
        <span class="eyebrow">PROJECT WORKSPACE</span>
        <h1>어떤 화면을 작업할까요?</h1>
        <p>
          프로젝트를 열고, 작업할 레이아웃을 선택하세요.<br />게임 서버에 접속하지 않고
          이미지·Spine·파티클을 확인할 수 있습니다.
        </p>
      </div>
      <div class="project-columns">
        <section class="project-list">
          <div class="section-heading">
            <h2>프로젝트</h2>
            <button @click="chooseFolder" :disabled="loading || opening">
              ＋ 프로젝트 폴더 열기
            </button>
          </div>
          <form v-if="!isDesktop" class="folder-form" @submit.prevent="chooseFolder">
            <label
              >프로젝트 폴더 경로<input
                v-model="folder"
                aria-label="프로젝트 폴더 경로"
                placeholder="D:\WorkSpace\게임 프로젝트" /></label
            ><button type="submit" :disabled="loading || opening || !folder.trim()">추가</button>
          </form>
          <p v-if="loading" class="hint">프로젝트를 확인하고 있습니다…</p>
          <button
            v-for="p in projects"
            :key="p.root"
            class="project-card"
            :class="{ chosen: selectedRoot === p.root }"
            :aria-label="`프로젝트 ${p.name}`"
            :aria-pressed="selectedRoot === p.root"
            @click="select(p)"
            :disabled="opening"
          >
            <span class="project-symbol">{{
              p.kind === 'slot' ? '▦' : p.kind === 'template' ? '♠' : '▧'
            }}</span
            ><span
              ><strong>{{ p.name }}</strong
              ><small>{{ p.description }}</small
              ><code>{{ p.root }}</code></span
            ><b>{{ selectedRoot === p.root ? '✓' : '›' }}</b>
          </button>
          <p v-if="!loading && !projects.length" class="hint">프로젝트 폴더를 열어 추가하세요.</p>
        </section>
        <section class="scene-chooser">
          <div class="section-heading">
            <h2>작업할 화면</h2>
            <span>{{ project?.name || '프로젝트 선택 대기' }}</span>
          </div>
          <button
            v-for="s in project?.scenes"
            :key="s.id"
            class="scene-choice"
            :class="{ chosen: selectedScene === s.id }"
            :aria-label="`화면 ${s.name}`"
            :aria-pressed="selectedScene === s.id"
            @click="
              selectedScene = s.id;
              mode = 'original';
            "
            :disabled="opening"
          >
            <span class="scene-outline" :class="{ portrait: s.orientation === 'portrait' }"></span
            ><span
              ><strong>{{ s.name }}</strong
              ><small>{{ s.description }}</small></span
            >
          </button>
          <div v-if="scene?.kind === 'slot-layout'" class="open-mode">
            <label><input type="radio" value="original" v-model="mode" />기본 레이아웃</label
            ><label :class="{ muted: !scene.hasApplied }"
              ><input
                type="radio"
                value="applied"
                v-model="mode"
                :disabled="!scene.hasApplied"
              />게임에 저장한 적용본</label
            >
          </div>
          <p class="hint" v-if="project?.kind === 'template'">
            현재는 공용 에셋을 선택해 배치할 수 있습니다. 홀덤·맞고의 기존 게임 화면 가져오기는 연결
            예정입니다.
          </p>
          <div class="home-error" role="alert" v-if="error">{{ error }}</div>
          <button
            class="open-project-button"
            :disabled="!scene || opening || loading"
            @click="open()"
          >
            {{ opening ? '화면을 여는 중…' : '선택한 화면 열기 →' }}
          </button>
        </section>
      </div>
      <footer class="home-examples">
        <span>먼저 조작을 살펴보고 싶다면</span
        ><button :disabled="opening || loading" @click="open(true)">예제 연출 열기</button
        ><small>폭죽 · 팝업 · 획득 머니 이동</small>
      </footer>
    </section>
  </main>
</template>
