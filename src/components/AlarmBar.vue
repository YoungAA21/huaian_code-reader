<!-- AlarmBar.vue - 报警栏优化 -->
<template>
  <div class="alarm-bar" :class="{ 'has-alarms': alarms.length > 0 }">
    <div class="alarm-icon">
      <span class="icon">⚠️</span>
      <span class="count" v-if="alarms.length">{{ alarms.length }}</span>
    </div>
    <div class="alarm-scroll" v-if="alarms.length">
      <div class="alarm-track">
        <div v-for="alarm in alarms" :key="alarm.id" class="alarm-message" :class="alarm.level">
          <span class="msg-time">{{ alarm.time }}</span>
          <span class="msg-device">{{ alarm.detectorName }}</span>
          <span class="msg-content">{{ alarm.message }}</span>
        </div>
      </div>
    </div>
    <div class="alarm-empty" v-else>
      <span>系统运行正常</span>
    </div>
    <button class="clear-btn" @click="$emit('clear')" v-if="alarms.length">清空</button>
  </div>
</template>

<script setup lang="ts">
defineProps<{ alarms: any[] }>()
defineEmits<{ clear: [] }>()
</script>

<style scoped>
.alarm-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  background: var(--bg-card);
  border-top: 1px solid var(--border-light);
  padding: 14px 28px;
  display: flex;
  align-items: center;
  gap: 16px;
  z-index: 100;
  transform: translateY(100%);
  transition: transform 0.3s ease;
}

.alarm-bar.has-alarms {
  transform: translateY(0);
  box-shadow: var(--shadow-sm);
}

.alarm-icon {
  display: flex;
  align-items: center;
  gap: 6px;
  background: rgba(230, 160, 23, 0.1);
  padding: 8px 18px;
  border-radius: 20px;
  flex-shrink: 0;
}

.alarm-icon .icon {
  font-size: 18px;
}

.alarm-icon .count {
  font-size: 17px;
  font-weight: 600;
  color: var(--warning);
}

.alarm-scroll {
  flex: 1;
  overflow: hidden;
  height: 48px;
}

.alarm-track {
  display: flex;
  animation: scrollAlarm 20s linear infinite;
  white-space: nowrap;
}

@keyframes scrollAlarm {
  0% {
    transform: translateX(100%);
  }
  100% {
    transform: translateX(-100%);
  }
}

.alarm-message {
  display: inline-flex;
  align-items: center;
  gap: 12px;
  padding: 10px 20px;
  margin-right: 24px;
  border-radius: 20px;
  font-size: 16px;
}

.alarm-message.warning {
  background: rgba(230, 160, 23, 0.1);
}

.alarm-message.danger {
  background: rgba(220, 53, 69, 0.1);
}

.msg-time {
  font-family: monospace;
  font-size: 14px;
  color: var(--text-muted);
}

.msg-device {
  font-weight: 600;
  font-size: 15px;
  color: var(--text-primary);
}

.msg-device::after {
  content: ':';
  margin-left: 2px;
}

.msg-content {
  color: var(--text-secondary);
  font-size: 15px;
}

.alarm-message.danger .msg-content {
  color: var(--danger);
}

.alarm-message.warning .msg-content {
  color: var(--warning);
}

.alarm-empty {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 8px;
}

.alarm-empty::before {
  content: '●';
  color: var(--success);
  font-size: 10px;
}

.alarm-empty span {
  font-size: 16px;
  color: var(--text-muted);
}

.clear-btn {
  background: none;
  border: 1px solid var(--border-light);
  padding: 8px 20px;
  border-radius: 20px;
  font-size: 15px;
  cursor: pointer;
  color: var(--text-secondary);
  transition: var(--transition);
  flex-shrink: 0;
}

.clear-btn:hover {
  background: rgba(220, 53, 69, 0.1);
  border-color: var(--danger);
  color: var(--danger);
}

@media (max-width: 768px) {
  .alarm-bar {
    padding: 12px 18px;
  }
  .alarm-message {
    padding: 8px 14px;
  }
  .msg-device, .msg-content {
    font-size: 14px;
  }
}
</style>