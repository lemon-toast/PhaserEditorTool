<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';
import { addLayoutMode, ensureScreen } from '../core/document';
import { edit, log, selectLayoutMode, state, stop } from '../editor/store';

const width = ref(state.doc.designSize.width),
  height = ref(state.doc.designSize.height);
const ratio = ref(''),
  error = ref(''),
  dialog = ref<HTMLDialogElement>();
const modeName = ref(''),
  modeWidth = ref(720),
  modeHeight = ref(1280);
const modes = computed(
  () =>
    state.doc.screen?.modes || [
      { id: 'default', name: state.doc.designSize.width >= state.doc.designSize.height ? '가로' : '세로' },
    ],
);
const activeMode = computed(() => state.doc.screen?.activeMode || 'default');
const presets = [
  { name: 'HD · 1280 × 720', width: 1280, height: 720 },
  { name: 'FHD · 1920 × 1080', width: 1920, height: 1080 },
  { name: '세로 · 720 × 1280', width: 720, height: 1280 },
  { name: '세로 FHD · 1080 × 1920', width: 1080, height: 1920 },
  { name: '태블릿 · 1024 × 768', width: 1024, height: 768 },
  { name: '정사각형 · 1080 × 1080', width: 1080, height: 1080 },
];
const preset = computed(() =>
  presets.findIndex((p) => p.width === width.value && p.height === height.value),
);
function choosePreset(event: Event) {
  const size = presets[Number((event.target as HTMLSelectElement).value)];
  if (size) {
    width.value = size.width;
    height.value = size.height;
    ratio.value = '';
  }
}
function applyRatio() {
  if (!ratio.value) return;
  const [w, h] = ratio.value.split(':').map(Number);
  height.value = Math.round((Number(width.value) * h) / w);
}
function validSize(w: number, h: number) {
  return [w, h].every((n) => Number.isInteger(n) && n >= 1 && n <= 8192);
}
function applySize() {
  if (!validSize(width.value, height.value)) {
    error.value = '너비와 높이는 1~8192의 정수로 입력하세요.';
    return;
  }
  if (
    edit((doc) => {
      ensureScreen(doc);
      doc.designSize = { width: width.value, height: height.value };
    })
  ) {
    error.value = '';
    log('현재 모드의 기준 해상도를 변경했습니다. 오브젝트 좌표와 크기는 유지됩니다.');
  }
}
async function openAddMode() {
  modeName.value = '';
  modeWidth.value = state.doc.designSize.height;
  modeHeight.value = state.doc.designSize.width;
  error.value = '';
  await nextTick();
  dialog.value?.showModal();
}
function addMode() {
  if (!validSize(modeWidth.value, modeHeight.value) || !modeName.value.trim()) {
    error.value = '모드 이름과 1~8192의 정수 해상도를 입력하세요.';
    return;
  }
  stop();
  if (
    edit((doc) =>
      addLayoutMode(doc, modeName.value, { width: modeWidth.value, height: modeHeight.value }),
    )
  ) {
    state.selected = state.doc.roots[0] || '';
    state.animationId = state.doc.animations[0]?.id || '';
    dialog.value?.close();
    error.value = '';
    log('현재 배치를 복사해 새 모드를 만들었습니다. 각 모드는 독립적으로 편집됩니다.');
  } else error.value = state.logs.at(-1)?.message || '모드를 추가하지 못했습니다.';
}
watch(
  () => [
    state.doc.id,
    state.doc.screen?.activeMode,
    state.doc.designSize.width,
    state.doc.designSize.height,
  ],
  () => {
    width.value = state.doc.designSize.width;
    height.value = state.doc.designSize.height;
    ratio.value = '';
    error.value = '';
  },
);
</script>

<template>
  <div class="screen-controls">
    <form class="screen-size-form" @submit.prevent="applySize">
      <label
        >배치 모드
        <select
          aria-label="배치 모드"
          :value="activeMode"
          @change="selectLayoutMode(($event.target as HTMLSelectElement).value)"
        >
          <option v-for="mode in modes" :key="mode.id" :value="mode.id">{{ mode.name }}</option>
        </select>
      </label>
      <label
        >너비
        <input
          v-model.number="width"
          type="number"
          min="1"
          max="8192"
          step="1"
          required
          aria-label="화면 너비"
          @input="applyRatio"
      /></label>
      <span>×</span>
      <label
        >높이
        <input
          v-model.number="height"
          type="number"
          min="1"
          max="8192"
          step="1"
          required
          aria-label="화면 높이"
          @input="ratio = ''"
      /></label>
      <select aria-label="화면비" v-model="ratio" @change="applyRatio">
        <option value="">자유 비율</option>
        <option
          v-for="value in ['16:9', '9:16', '4:3', '3:4', '1:1', '21:9']"
          :key="value"
          :value="value"
        >
          {{ value }}
        </option>
      </select>
      <select aria-label="해상도 프리셋" :value="preset" @change="choosePreset">
        <option :value="-1">직접 입력</option>
        <option v-for="(p, index) in presets" :key="p.name" :value="index">{{ p.name }}</option>
      </select>
      <button type="submit">해상도 적용</button>
    </form>
    <button @click="openAddMode" :disabled="modes.length >= 8">모드 추가</button>
    <label
      >화면 구성
      <select
        aria-label="화면 구성"
        :value="state.doc.screen?.behavior || 'fixed'"
        @change="
          edit((doc) => {
            ensureScreen(doc).behavior = ($event.target as HTMLSelectElement).value as
              | 'fixed'
              | 'responsive';
          })
        "
      >
        <option value="fixed">고정 해상도</option>
        <option value="responsive">반응형 배치 세트</option>
      </select>
    </label>
    <span class="screen-note"
      >기준 해상도 · 배율/좌표 유지<span v-if="state.doc.screen?.behavior === 'responsive'">
        · 모드 수동 전환</span
      ></span
    >
    <p class="screen-error" role="alert" v-if="error && !dialog?.open">{{ error }}</p>
    <dialog
      ref="dialog"
      class="mode-dialog"
      aria-labelledby="mode-dialog-title"
      @cancel="error = ''"
    >
      <form @submit.prevent="addMode">
        <h2 id="mode-dialog-title">배치 모드 추가</h2>
        <p>
          현재 배치를 복사해 시작합니다. 에셋 파일은 공유하고 배치와 연출은 모드별로 저장합니다.
        </p>
        <label
          >모드 이름
          <input
            v-model="modeName"
            aria-label="새 모드 이름"
            placeholder="세로, 태블릿, 모바일 등"
            maxlength="40"
            required
            autofocus
        /></label>
        <div class="mode-dimensions">
          <label
            >너비
            <input
              v-model.number="modeWidth"
              aria-label="새 모드 너비"
              type="number"
              min="1"
              max="8192"
              step="1"
              required
          /></label>
          <label
            >높이
            <input
              v-model.number="modeHeight"
              aria-label="새 모드 높이"
              type="number"
              min="1"
              max="8192"
              step="1"
              required
          /></label>
        </div>
        <p>해상도를 바꿔도 오브젝트는 자동 재배치되지 않습니다. 새 모드에서 배치를 조정하세요.</p>
        <p class="screen-error" role="alert" v-if="error">{{ error }}</p>
        <footer>
          <button
            type="button"
            @click="
              dialog?.close();
              error = '';
            "
          >
            취소</button
          ><button class="accent" type="submit">모드 만들기</button>
        </footer>
      </form>
    </dialog>
  </div>
</template>
