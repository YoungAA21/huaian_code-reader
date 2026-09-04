'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity, AlertTriangle, Check, CheckCircle2, ChevronRight, CircleAlert,
  Clock3, Factory, LoaderCircle, Radio, RefreshCw, ScanLine, ShieldCheck,
  Thermometer, WifiOff, XCircle, Zap,
} from 'lucide-react';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogMedia,
  AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  type Alarm, type ManualTriggerBatch, type ManualTriggerResult,
  type ProductionStatus, type ReaderStatus, createProductionConnection,
  fetchActiveAlarms, fetchProductionStatus, fetchReaderStatus,
  getManualTriggerBatch, getManualTriggerResults, isDemoModeEnabled, startManualTrigger,
} from '@/lib/monitor-api';

type ConnectionState = 'connecting' | 'online' | 'offline';
type ReaderTone = 'online' | 'warning' | 'fault' | 'offline' | 'unknown';

const terminalBatchStatuses = new Set([3, 4, 5, 'Completed', 'Timeout', 'Failed']);
const successResultStatuses = new Set([2, 'ValidCode']);
const warningResultStatuses = new Set([3, 4, 'NoRead', 'DecodeFail']);
const wait = (milliseconds: number) => new Promise((resolve) => window.setTimeout(resolve, milliseconds));

function formatTime(value?: string | null, includeDate = false) {
  if (!value) return '暂无';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('zh-CN', {
    month: includeDate ? '2-digit' : undefined,
    day: includeDate ? '2-digit' : undefined,
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  }).format(date);
}

function readerTone(reader: ReaderStatus): ReaderTone {
  const status = String(reader.status).toLowerCase();
  if (!reader.enabled) return 'unknown';
  if (!reader.tcpConnected || status === '1' || status === 'offline') return 'offline';
  if (status === '5' || status === 'fault') return 'fault';
  if (status === '4' || status === 'warning') return 'warning';
  if (status === '3' || status === 'online') return 'online';
  return reader.pingOk ? 'online' : 'warning';
}

const readerToneText: Record<ReaderTone, string> = {
  online: '运行正常', warning: '需要关注', fault: '设备故障',
  offline: '连接断开', unknown: '状态未知',
};

function batchStatusText(status: ManualTriggerBatch['status']) {
  const labels: Record<string, string> = {
    '1': '指令已发送', '2': '等待读码结果', '3': '自检完成',
    '4': '自检超时', '5': '自检失败', CommandSent: '指令已发送',
    WaitingReaderResults: '等待读码结果', Completed: '自检完成',
    Timeout: '自检超时', Failed: '自检失败',
  };
  return labels[String(status)] ?? '处理中';
}

function resultStatusText(status: ManualTriggerResult['resultStatus']) {
  const labels: Record<string, string> = {
    '1': '等待结果', '2': '读码成功', '3': '未读到码', '4': '解析失败',
    '5': '读码器超时', '6': '触发指令超时', Waiting: '等待结果',
    ValidCode: '读码成功', NoRead: '未读到码', DecodeFail: '解析失败',
    ReaderTimeout: '读码器超时', TriggerCommandTimeout: '触发指令超时',
  };
  return labels[String(status)] ?? String(status);
}

export default function Home() {
  const [readers, setReaders] = useState<ReaderStatus[]>([]);
  const [alarms, setAlarms] = useState<Alarm[]>([]);
  const [production, setProduction] = useState<ProductionStatus | null>(null);
  const [connection, setConnection] = useState<ConnectionState>('connecting');
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [selfCheckRunning, setSelfCheckRunning] = useState(false);
  const [selfCheckBatch, setSelfCheckBatch] = useState<ManualTriggerBatch | null>(null);
  const [selfCheckResults, setSelfCheckResults] = useState<ManualTriggerResult[]>([]);
  const [selfCheckMessage, setSelfCheckMessage] = useState('尚未执行自检');
  const [demoMode, setDemoMode] = useState(false);
  const mountedRef = useRef(true);

  const refreshAll = useCallback(async (manual = false) => {
    if (manual) setRefreshing(true);
    try {
      const [readerData, alarmData, productionData] = await Promise.all([
        fetchReaderStatus(), fetchActiveAlarms(), fetchProductionStatus(),
      ]);
      if (!mountedRef.current) return;
      setReaders(readerData);
      setAlarms(alarmData);
      setProduction(productionData);
      setDemoMode(isDemoModeEnabled());
      setConnection('online');
      setLastUpdated(new Date());
      setErrorMessage('');
    } catch (error) {
      if (!mountedRef.current) return;
      setConnection('offline');
      setErrorMessage(error instanceof Error ? error.message : '无法连接监测服务');
    } finally {
      if (mountedRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    const initialRefresh = window.setTimeout(() => void refreshAll(), 0);
    const pollTimer = window.setInterval(() => void refreshAll(), 15000);
    const handleOnline = () => void refreshAll();
    const handleOffline = () => setConnection('offline');
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') void refreshAll();
    };
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    document.addEventListener('visibilitychange', handleVisibility);

    const hub = createProductionConnection({
      onState(snapshot) {
        if (!mountedRef.current) return;
        setProduction(snapshot);
        if (snapshot.readers) setReaders(snapshot.readers);
        if (snapshot.activeAlarms) setAlarms(snapshot.activeAlarms);
        setConnection('online');
        setLastUpdated(new Date());
        setErrorMessage('');
      },
      onConnectionChange(state) {
        if (mountedRef.current) setConnection(state);
      },
    });

    return () => {
      mountedRef.current = false;
      window.clearTimeout(initialRefresh);
      window.clearInterval(pollTimer);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      document.removeEventListener('visibilitychange', handleVisibility);
      void hub?.stop();
    };
  }, [refreshAll]);

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      void navigator.serviceWorker.register('/sw.js').catch(() => undefined);
    }

    const context = document.modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    void Promise.resolve(context.registerTool({
      name: 'get_reader_monitor_summary',
      title: '获取读码器监测概况',
      description: '刷新读码器状态、当前告警和产线状态，并返回最新概况。',
      inputSchema: { type: 'object', properties: {}, additionalProperties: false },
      annotations: { readOnlyHint: true, untrustedContentHint: false },
      async execute() {
        const [readerData, alarmData, productionData] = await Promise.all([
          fetchReaderStatus(), fetchActiveAlarms(), fetchProductionStatus(),
        ]);
        setReaders(readerData);
        setAlarms(alarmData);
        setProduction(productionData);
        setConnection('online');
        setLastUpdated(new Date());
        return {
          lineId: productionData.lineId,
          isProductionRunning: productionData.isProductionRunning,
          readerCount: readerData.length,
          activeAlarmCount: alarmData.length,
        };
      },
    }, { signal: lifecycle.signal })).catch(() => undefined);
    return () => lifecycle.abort();
  }, []);

  const counts = useMemo(() => {
    const result = { online: 0, warning: 0, offline: 0 };
    readers.forEach((reader) => {
      const tone = readerTone(reader);
      if (tone === 'online') result.online += 1;
      else if (tone === 'offline' || tone === 'unknown') result.offline += 1;
      else result.warning += 1;
    });
    return result;
  }, [readers]);

  const productionStopped = production ? !production.isProductionRunning : false;
  const selfCheckAllowed = productionStopped && connection === 'online' && !selfCheckRunning;

  const runSelfCheck = async () => {
    if (!selfCheckAllowed) return;
    setSelfCheckRunning(true);
    setSelfCheckBatch(null);
    setSelfCheckResults([]);
    setSelfCheckMessage('正在发送自检触发指令…');
    try {
      const started = await startManualTrigger({ requestedBy: 'mobile-operator', remark: '移动端一键自检' });
      const startedAt = Date.now();
      setSelfCheckMessage(started.message || '指令已发送，等待设备响应');
      while (Date.now() - startedAt < 25000 && mountedRef.current) {
        const [batch, resultResponse] = await Promise.all([
          getManualTriggerBatch(started.batchId), getManualTriggerResults(started.batchId),
        ]);
        setSelfCheckBatch(batch);
        setSelfCheckResults(resultResponse.items || []);
        setSelfCheckMessage(batch.errorMessage || batch.serialAckMessage || batchStatusText(batch.status));
        if (terminalBatchStatuses.has(batch.status)) return;
        await wait(800);
      }
      setSelfCheckMessage('查询等待超时，可稍后重新查看状态');
    } catch (error) {
      setSelfCheckMessage(error instanceof Error ? error.message : '自检请求失败');
    } finally {
      if (mountedRef.current) setSelfCheckRunning(false);
    }
  };

  const selfCheckProgress = selfCheckBatch?.expectedReaderCount
    ? Math.round((selfCheckBatch.receivedReaderCount / selfCheckBatch.expectedReaderCount) * 100)
    : selfCheckRunning ? 16 : 0;

  return (
    <main className="monitor-shell">
      <div className="top-accent" />
      <header className="app-header">
        <div className="brand-lockup">
          <div className="brand-mark"><ScanLine aria-hidden="true" /></div>
          <div><p>设备运维</p><h1>读码器监测</h1></div>
        </div>
        <button className={`connection-chip ${connection}`} onClick={() => void refreshAll(true)} aria-label="刷新连接状态">
          <span className="connection-dot" />
          {connection === 'online' ? '实时在线' : connection === 'connecting' ? '连接中' : '连接断开'}
        </button>
      </header>

      <section className="line-strip" aria-label="当前产线信息">
        <div className="line-identity"><Factory aria-hidden="true" /><div><span>当前产线</span><strong>{production?.lineId || '等待连接'}</strong></div></div>
        <div className={`run-state ${productionStopped ? 'stopped' : 'running'}`}>
          <span>{productionStopped ? '■' : '▶'}</span>
          {production ? (productionStopped ? '产线已停车' : '产线运行中') : '状态未知'}
        </div>
      </section>

      {demoMode && <div className="demo-banner"><CircleAlert aria-hidden="true" /> 演示数据模式</div>}
      {errorMessage && (
        <div className="connection-alert" role="alert">
          <WifiOff aria-hidden="true" />
          <div><strong>监测服务连接失败</strong><span>{errorMessage}</span></div>
          <Button variant="outline" size="sm" onClick={() => void refreshAll(true)}>重试</Button>
        </div>
      )}

      <Tabs defaultValue="status" className="monitor-tabs">
        <div className="content-scroll">
          <TabsContent value="status" className="tab-panel">
            <div className="section-heading">
              <div><p>实时状态</p><h2>设备运行概况</h2></div>
              <button className="refresh-button" onClick={() => void refreshAll(true)} disabled={refreshing} aria-label="刷新设备状态">
                <RefreshCw className={refreshing ? 'spin' : ''} />
              </button>
            </div>
            <div className="summary-grid">
              <article className="summary-card online"><span>在线</span><strong>{counts.online}</strong><small>台设备</small></article>
              <article className="summary-card warning"><span>异常</span><strong>{counts.warning}</strong><small>台设备</small></article>
              <article className="summary-card offline"><span>离线</span><strong>{counts.offline}</strong><small>台设备</small></article>
            </div>
            <div className="list-meta">
              <span>全部读码器 · {readers.length} 台</span>
              <span><Clock3 /> 更新于 {lastUpdated ? formatTime(lastUpdated.toISOString()) : '—'}</span>
            </div>
            <div className="reader-list">
              {loading && readers.length === 0 ? <LoadingCards /> : readers.length === 0 ? (
                <EmptyState icon={<Radio />} title="暂无设备数据" detail="请检查后端地址和网络连接" />
              ) : readers.map((reader, index) => {
                const tone = readerTone(reader);
                return (
                  <article className={`reader-card ${tone}`} key={reader.readerId}>
                    <div className="reader-index">{String(index + 1).padStart(2, '0')}</div>
                    <div className="reader-main">
                      <div className="reader-title-row">
                        <div><h3>{reader.name}</h3><span>{reader.readerId} · {reader.ip}</span></div>
                        <div className={`status-pill ${tone}`}><i />{readerToneText[tone]}</div>
                      </div>
                      <div className="reader-metrics">
                        <div><span>最近读码</span><strong>{formatTime(reader.lastValidCodeTime)}</strong></div>
                        <div><span>设备温度</span><strong><Thermometer />{reader.currentTemperature == null ? '—' : `${reader.currentTemperature.toFixed(1)}℃`}</strong></div>
                        <div><span>通信链路</span><strong>{reader.tcpConnected && reader.pingOk ? '正常' : '异常'}</strong></div>
                      </div>
                      {reader.message && <p className="reader-message">{reader.message}</p>}
                    </div>
                    <ChevronRight className="reader-chevron" aria-hidden="true" />
                  </article>
                );
              })}
            </div>
          </TabsContent>

          <TabsContent value="alarms" className="tab-panel">
            <div className="section-heading">
              <div><p>活动告警</p><h2>需要处理的问题</h2></div>
              <div className={`alarm-count ${alarms.length ? 'active' : ''}`}>{alarms.length}</div>
            </div>
            {alarms.length === 0 ? (
              <div className="all-clear">
                <div><ShieldCheck /></div><h3>当前没有活动告警</h3><p>所有读码器均未报告异常</p>
                <span>最后检查 {lastUpdated ? formatTime(lastUpdated.toISOString()) : '—'}</span>
              </div>
            ) : (
              <div className="alarm-list">
                {alarms.map((alarm) => {
                  const tone = alarm.level >= 2 ? 'critical' : 'warning';
                  return (
                    <article className={`alarm-card ${tone}`} key={alarm.id}>
                      <div className="alarm-icon">{tone === 'critical' ? <CircleAlert /> : <AlertTriangle />}</div>
                      <div className="alarm-body">
                        <div className="alarm-heading"><span>{tone === 'critical' ? '严重告警' : '一般告警'}</span><time>{formatTime(alarm.startTime, true)}</time></div>
                        <h3>{alarm.readerId || '产线设备'}</h3><p>{alarm.message}</p>
                        <div className="alarm-location">{alarm.lineId} · {alarm.workshopId}</div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </TabsContent>

          <TabsContent value="self-check" className="tab-panel self-check-panel">
            <div className="section-heading"><div><p>设备检测</p><h2>读码器一键自检</h2></div></div>
            <section className={`safety-card ${selfCheckAllowed ? 'ready' : 'blocked'}`}>
              <div className="safety-symbol">{selfCheckAllowed ? <ShieldCheck /> : <CircleAlert />}</div>
              <div>
                <span>执行条件</span>
                <h3>{selfCheckAllowed ? '当前允许执行自检' : selfCheckRunning ? '自检正在执行' : '当前不可执行自检'}</h3>
                <p>{selfCheckAllowed ? '产线已停车，监测服务连接正常' : production?.isProductionRunning ? '生产运行期间禁止触发设备自检' : connection !== 'online' ? '监测服务离线或状态未知' : '请等待当前自检结束'}</p>
              </div>
            </section>
            <section className="check-action-card">
              <div className={`pulse-orbit ${selfCheckRunning ? 'running' : ''}`}><div>{selfCheckRunning ? <LoaderCircle className="spin" /> : <Zap />}</div></div>
              <h3>{selfCheckRunning ? '正在执行自检' : '检查全部读码器'}</h3>
              <p>触发后将依次确认控制指令和每台读码器返回结果</p>
              <AlertDialog>
                <AlertDialogTrigger render={<Button className="self-check-button" disabled={!selfCheckAllowed} size="lg" />}>
                  <Zap data-icon="inline-start" />{selfCheckRunning ? '自检执行中…' : '开始一键自检'}
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogMedia className="dialog-warning"><AlertTriangle /></AlertDialogMedia>
                    <AlertDialogTitle>确认执行全部读码器自检？</AlertDialogTitle>
                    <AlertDialogDescription>当前产线已停车。自检将向现场控制设备发送触发指令，请确认设备周边无人作业。</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter><AlertDialogCancel>取消</AlertDialogCancel><AlertDialogAction onClick={() => void runSelfCheck()}>确认执行</AlertDialogAction></AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </section>
            {(selfCheckBatch || selfCheckRunning || selfCheckMessage !== '尚未执行自检') && (
              <section className="check-result-card" aria-live="polite">
                <div className="result-header">
                  <div><span>本次结果</span><h3>{selfCheckBatch ? batchStatusText(selfCheckBatch.status) : selfCheckMessage}</h3></div>
                  {selfCheckBatch && <strong>{selfCheckBatch.receivedReaderCount}/{selfCheckBatch.expectedReaderCount}</strong>}
                </div>
                <Progress value={selfCheckProgress} className="check-progress" />
                <p className="result-message">{selfCheckMessage}</p>
                {selfCheckBatch && <div className="batch-number">批次号 {selfCheckBatch.batchId}</div>}
                {selfCheckResults.length > 0 && (
                  <div className="result-list">
                    {selfCheckResults.map((result) => {
                      const success = successResultStatuses.has(result.resultStatus);
                      const warning = warningResultStatuses.has(result.resultStatus);
                      return (
                        <div className="result-row" key={`${result.batchId}-${result.readerId}`}>
                          <div className={success ? 'success' : warning ? 'warning' : 'danger'}>{success ? <Check /> : warning ? <AlertTriangle /> : <XCircle />}</div>
                          <span><strong>{result.readerName}</strong><small>{resultStatusText(result.resultStatus)}</small></span>
                          <time>{result.elapsedMs == null ? '—' : `${result.elapsedMs}ms`}</time>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            )}
          </TabsContent>
        </div>

        <TabsList className="bottom-navigation" aria-label="主要功能">
          <TabsTrigger value="status"><Activity /><span>状态</span></TabsTrigger>
          <TabsTrigger value="alarms"><div className="nav-icon"><AlertTriangle />{alarms.length > 0 && <b>{alarms.length}</b>}</div><span>告警</span></TabsTrigger>
          <TabsTrigger value="self-check"><CheckCircle2 /><span>自检</span></TabsTrigger>
        </TabsList>
      </Tabs>
    </main>
  );
}

function LoadingCards() {
  return <div className="loading-stack" aria-label="正在加载设备状态">{[0, 1, 2].map((item) => <div className="loading-card" key={item}><i /><div><span /><span /><span /></div></div>)}</div>;
}

function EmptyState({ icon, title, detail }: { icon: React.ReactNode; title: string; detail: string }) {
  return <div className="empty-state"><div>{icon}</div><h3>{title}</h3><p>{detail}</p></div>;
}
