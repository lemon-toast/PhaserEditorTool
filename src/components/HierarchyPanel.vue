<script setup lang="ts">
import { computed, ref } from 'vue';
import { activeInHierarchy, flatten, type Kind } from '../core/document';
import { add, duplicate, patchNode, remove, reorder, state } from '../editor/store';
const collapsed = ref(new Set<string>());
const rows = computed(() => {
  const result = [];
  let hiddenDepth = Infinity;
  for (const row of flatten(state.doc)) {
    if (row.depth <= hiddenDepth) hiddenDepth = Infinity;
    if (row.depth > hiddenDepth) continue;
    result.push(row);
    if (collapsed.value.has(row.node.id)) hiddenDepth = row.depth;
  }
  return result;
});
const icons: Record<Kind, string> = {
  group: '◇',
  image: '▧',
  spine: '♧',
  particle: '✧',
  text: 'T',
};
function toggle(id: string) {
  const next = new Set(collapsed.value);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  collapsed.value = next;
}
</script>
<template>
  <div class="panel hierarchy">
    <div class="panel-tools">
      <button @click="add('group')">＋ 그룹</button
      ><button :disabled="!state.selected" @click="duplicate">복제</button
      ><button :disabled="!state.selected" @click="remove">삭제</button>
    </div>
    <div class="caption">
      장면 구성 <span>{{ Object.keys(state.doc.nodes).length }}</span>
    </div>
    <div class="tree" role="tree">
      <div
        v-for="{ node, depth } in rows"
        :key="node.id"
        :data-node="node.id"
        class="tree-row"
        :class="{
          selected: state.selected === node.id,
          inactive: !activeInHierarchy(state.doc, node.id),
        }"
        :style="{ paddingLeft: `${10 + depth * 16}px` }"
        role="treeitem"
        :aria-selected="state.selected === node.id"
        tabindex="0"
        @click="state.selected = node.id"
        @keydown.enter="state.selected = node.id"
      >
        <button
          class="disclosure"
          :aria-label="`${node.name} 펼침 전환`"
          @click.stop="toggle(node.id)"
        >
          {{ node.children.length ? (collapsed.has(node.id) ? '▸' : '▾') : '·' }}
        </button>
        <input
          type="checkbox"
          :aria-label="`${node.name} 활성`"
          :checked="node.activeSelf"
          @click.stop
          @change="
            patchNode(node.id, (n) => (n.activeSelf = ($event.target as HTMLInputElement).checked))
          "
        />
        <span class="node-icon">{{ icons[node.kind] }}</span
        ><span class="tree-name">{{ node.name }}</span>
      </div>
    </div>
    <div class="panel-tools footer-tools">
      <button @click="reorder(-1)" :disabled="!state.selected">↑ 순서</button
      ><button @click="reorder(1)" :disabled="!state.selected">↓ 순서</button>
    </div>
    <p class="hint">부모를 꺼도 자식의 체크값은 유지됩니다.</p>
  </div>
</template>
