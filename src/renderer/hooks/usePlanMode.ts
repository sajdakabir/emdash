import { useState, useEffect, useCallback, useRef } from 'react';
import { detectPlanModeSignal, extractPlanFileName } from '@/lib/planModeDetector';
import { makePtyId } from '@shared/ptyId';
import type { ProviderId } from '@shared/providers/registry';
import type { PlanAction } from '@/components/PlanOverlay';

interface UsePlanModeOptions {
  taskId: string;
  providerId: string;
  enabled: boolean;
}

interface PlanModeResult {
  isActive: boolean;
  planContent: string | null;
  onAction: (action: PlanAction, editMessage?: string) => void;
  onDismiss: () => void;
}

const DISMISS_COOLDOWN_MS = 5000;

const ARROW_DOWN = '\x1b[B';
const ENTER = '\r';

/**
 * Map a PlanAction to the key sequence Claude Code expects.
 *
 * Claude Code's ExitPlanMode prompt is a TUI selection list:
 *   ❯ Yes, clear context and auto-accept edits (shift+tab)   ← default
 *     Yes, auto-accept edits
 *     Yes, manually approve edits
 *     [text input: tell Claude what to change]
 *
 * Navigation: arrow-down to move, Enter to select.
 */
function actionToInput(action: PlanAction, editMessage?: string): string {
  switch (action) {
    case 'auto-accept-clear':
      // Default selection — just press Enter
      return ENTER;
    case 'auto-accept':
      // One down + Enter
      return `${ARROW_DOWN}${ENTER}`;
    case 'manual-approve':
      // Two down + Enter
      return `${ARROW_DOWN}${ARROW_DOWN}${ENTER}`;
    case 'edit':
      // Three down to reach text input, then type message + Enter
      return `${ARROW_DOWN}${ARROW_DOWN}${ARROW_DOWN}${editMessage ?? ''}${ENTER}`;
  }
}

export function usePlanMode(opts: UsePlanModeOptions): PlanModeResult {
  const { taskId, providerId, enabled } = opts;

  const [isActive, setIsActive] = useState(false);
  const [planContent, setPlanContent] = useState<string | null>(null);
  const dismissedAtRef = useRef<number>(0);
  const awaitingPlanRef = useRef(false);
  const targetFileRef = useRef<string | null>(null);

  const mainPtyId = makePtyId(providerId as ProviderId, 'main', taskId);

  const readPlan = useCallback(async (fileName?: string | null) => {
    const api = (window as any).electronAPI;
    if (!api?.planListFiles) return;

    try {
      let targetFile = fileName;

      if (!targetFile) {
        const result = await api.planListFiles();
        if (!result.success || !result.files?.length) return;
        targetFile = result.files[0].name;
      }

      const readResult = await api.planReadFile({ fileName: targetFile });
      if (readResult.success && readResult.content) {
        setPlanContent(readResult.content);
        const now = Date.now();
        if (now - dismissedAtRef.current > DISMISS_COOLDOWN_MS) {
          setIsActive(true);
        }
      }
    } catch {}
  }, []);

  useEffect(() => {
    if (!enabled) return;

    const api = (window as any).electronAPI;
    if (!api) return;

    api.planWatchStart?.();

    const offFileChanged = api.onPlanFileChanged?.((data: any) => {
      if (!awaitingPlanRef.current) return;
      const file = targetFileRef.current || data.fileName;
      readPlan(file);
    });

    const offData = api.onPtyData?.(mainPtyId, (chunk: string) => {
      try {
        const signal = detectPlanModeSignal(chunk);
        if (signal === 'plan_ready') {
          awaitingPlanRef.current = true;
          const extracted = extractPlanFileName(chunk);
          if (extracted) targetFileRef.current = extracted;
          readPlan(extracted);
        } else if (signal === 'plan_approved' || signal === 'plan_rejected') {
          awaitingPlanRef.current = false;
          targetFileRef.current = null;
          setIsActive(false);
          setPlanContent(null);
        }
      } catch {}
    });

    return () => {
      offFileChanged?.();
      offData?.();
      api.planWatchStop?.();
    };
  }, [enabled, taskId, providerId, mainPtyId, readPlan]);

  const onAction = useCallback(
    (action: PlanAction, editMessage?: string) => {
      const api = (window as any).electronAPI;
      const ptyWrite = (data: string) => api?.ptyInput?.({ id: mainPtyId, data });

      try {
        if (action === 'edit' && editMessage) {
          // Navigate to the text input field first
          ptyWrite(`${ARROW_DOWN}${ARROW_DOWN}${ARROW_DOWN}`);
          // Give the TUI time to render the text input, then type + submit
          setTimeout(() => {
            ptyWrite(`${editMessage}${ENTER}`);
          }, 150);
        } else {
          ptyWrite(actionToInput(action));
        }
      } catch {}
      awaitingPlanRef.current = false;
      targetFileRef.current = null;
      setIsActive(false);
      setPlanContent(null);
    },
    [mainPtyId]
  );

  const onDismiss = useCallback(() => {
    dismissedAtRef.current = Date.now();
    setIsActive(false);
  }, []);

  return {
    isActive: enabled && isActive,
    planContent,
    onAction,
    onDismiss,
  };
}
