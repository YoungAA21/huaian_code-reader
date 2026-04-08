<template>
  <div class="alarm-bar" :class="{ show: alarms.length > 0 }">
    <div class="icon">
      <span>⚠️</span>
      <span class="count">{{ alarms.length }}</span>
    </div>
    <div class="scroll">
      <div class="messages">
        <div v-for="alarm in alarms" :key="alarm.id" class="message" :class="alarm.level">
          <span class="time">{{ alarm.time }}</span>
          <span class="detector">{{ alarm.detectorName }}</span>
          <span>{{ alarm.message }}</span>
        </div>
      </div>
    </div>
    <button class="clear" @click="$emit('clear')">清空</button>
  </div>
</template>

<script setup lang="ts">
defineProps<{ alarms: any[] }>()
defineEmits<{ clear: [] }>()
</script>

<style scoped>
.alarm-bar {
  position: fixed; bottom: 0; left: 0; right: 0;
  background: linear-gradient(90deg, #1a1a2a, #0f0f1a);
  border-top: 1px solid rgba(255,68,68,0.3);
  padding: 14px 28px;
  display: flex; align-items: center; gap: 20px;
  z-index: 100;
  transform: translateY(100%);
  transition: transform 0.3s;
}
.alarm-bar.show { transform: translateY(0); }

.icon { display: flex; align-items: center; gap: 8px; background: rgba(255,68,68,0.2); padding: 6px 16px; border-radius: 28px; font-size: 18px; }
.icon .count { font-weight: bold; color: #ff4444; font-size: 18px; }

.scroll { flex: 1; overflow: hidden; height: 44px; }
.messages { animation: scroll 20s linear infinite; white-space: nowrap; }
@keyframes scroll { 0% { transform: translateX(100%); } 100% { transform: translateX(-100%); } }

.message { display: inline-block; margin-right: 48px; padding: 8px 16px; border-radius: 24px; font-size: 16px; }
.message.warning { background: rgba(255,170,0,0.2); border-left: 3px solid #ffaa00; }
.message.danger { background: rgba(255,68,68,0.2); border-left: 3px solid #ff4444; }
.message .time { font-family: monospace; margin-right: 16px; color: #88aabb; font-size: 14px; }
.message .detector { font-weight: bold; margin-right: 12px; font-size: 16px; }

.clear { background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); padding: 6px 16px; border-radius: 24px; color: #fff; cursor: pointer; font-size: 16px; }
.clear:hover { background: rgba(255,68,68,0.3); border-color: #ff4444; }
</style>