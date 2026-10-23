<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { replaceAsset, setNineSlice } from '../core/assetEditing';
import { edit, selected, state } from '../editor/store';

const search = ref('');
const error = ref('');
const enabled = ref(false);
const borders = ref([0, 0, 0, 0]);
const scale = ref(1);
const candidates = computed(() =>
  state.assets.filter(
    (a) =>
      a.kind === selected.value?.kind && a.file.toLowerCase().includes(search.value.toLowerCase()),
  ),
);
watch(
  () => [state.selected, selected.value?.slice, selected.value?.sliceScale],
  () => {
    enabled.value = !!selected.value?.slice;
    borders.value = [...(selected.value?.slice || [0, 0, 0, 0])];
    scale.value = selected.value?.sliceScale || 1;
    error.value = '';
  },
  { immediate: true },
);
watch(
  () => state.selected,
  () => {
    search.value = '';
  },
);
function changeAsset(event: Event) {
  const asset = state.assets.find(
    (a) => a.file === (event.target as HTMLSelectElement).value && a.kind === selected.value?.kind,
  );
  if (!asset) return;
  error.value = '';
  if (!edit((doc) => replaceAsset(doc.nodes[state.selected], asset)))
    error.value = '에셋을 바꾸지 못했습니다. 콘솔의 원인을 확인하세요.';
}
function applySlice() {
  error.value = '';
  if (
    !edit((doc) => {
      try {
        setNineSlice(
          doc.nodes[state.selected],
          enabled.value,
          borders.value.map(Number),
          Number(scale.value),
        );
      } catch (e) {
        error.value = (e as Error).message;
        throw e;
      }
    })
  )
    error.value ||= '변경하지 못했습니다. 콘솔의 원인을 확인하세요.';
}
</script>
<template>
  <section v-if="selected?.kind === 'image' || selected?.kind === 'spine'" aria-label="에셋 편집">
    <h3>에셋 교체</h3>
    <label
      >검색<input aria-label="교체 에셋 검색" v-model="search" placeholder="이름 또는 경로"
    /></label>
    <label
      >같은 종류 에셋<select
        aria-label="교체 에셋"
        :value="selected.asset || ''"
        @change="changeAsset"
      >
        <option :value="selected.asset || ''">현재: {{ selected.asset || '지정 안 됨' }}</option>
        <option
          v-for="a in candidates.filter((a) => a.file !== selected?.asset)"
          :key="a.file"
          :value="a.file"
        >
          {{ a.file }}
        </option>
      </select></label
    >
    <p
      v-if="!state.assets.some((a) => a.kind === selected?.kind && a.file === selected?.asset)"
      class="hint"
    >
      현재 참조가 에셋 목록에 없습니다. 프로젝트 연결과 파일 경로를 확인하세요.
    </p>
    <p v-if="selected.kind === 'spine'" class="asset-path">atlas: {{ selected.atlas || '없음' }}</p>
    <p class="hint">
      배치·크기는 유지합니다. Spine 교체 시 호환되지 않는 애니메이션·스킨은 기본값으로 변경합니다.
      교체·9-slice 수정은 현재 게임 적용 미지원입니다.
    </p>
    <template v-if="selected.kind === 'image'">
      <h3>9-slice</h3>
      <label class="inline"
        ><input aria-label="9-slice 사용" type="checkbox" v-model="enabled" />9-slice 사용</label
      >
      <div v-if="enabled" class="field-grid">
        <label v-for="(label, i) in ['위', '오른쪽', '아래', '왼쪽']" :key="label"
          >{{ label
          }}<input
            :aria-label="`9-slice ${label}`"
            type="number"
            min="0"
            max="8192"
            v-model="borders[i]"
        /></label>
        <label
          >경계 배율<input
            aria-label="9-slice 경계 배율"
            type="number"
            min="0.01"
            max="100"
            step="0.01"
            v-model="scale"
        /></label>
      </div>
      <button @click="applySlice">9-slice 적용</button>
      <p class="hint">
        경계는 원본 이미지 픽셀 기준이며 표시 크기는 유지합니다. 파일 로딩 후 원본보다 큰 경계는
        오류 자리표시자로 표시합니다.
      </p>
    </template>
    <p v-if="error" role="alert">{{ error }}</p>
  </section>
</template>
