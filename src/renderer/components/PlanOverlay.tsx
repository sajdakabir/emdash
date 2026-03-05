import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { MarkdownRenderer } from './ui/markdown-renderer';
import { Button } from './ui/button';

export type PlanAction = 'auto-accept-clear' | 'auto-accept' | 'manual-approve' | 'edit';

interface PlanOverlayProps {
  planContent: string;
  onAction: (action: PlanAction, editMessage?: string) => void;
  onDismiss: () => void;
  taskPath?: string | null;
}

export const PlanOverlay: React.FC<PlanOverlayProps> = ({
  planContent,
  onAction,
  onDismiss,
  taskPath,
}) => {
  const [editMessage, setEditMessage] = useState('');
  const [showEditInput, setShowEditInput] = useState(false);

  const handleEdit = useCallback(() => {
    if (editMessage.trim()) {
      onAction('edit', editMessage.trim());
    }
  }, [editMessage, onAction]);

  const handleEditKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleEdit();
      }
    },
    [handleEdit]
  );

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 24 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        className="absolute inset-0 z-50 flex flex-col overflow-hidden rounded-md border border-border bg-background"
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center rounded-md bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
              Plan Mode
            </span>
            <span className="text-xs text-muted-foreground">Review the plan before proceeding</span>
          </div>
          <button
            onClick={onDismiss}
            className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          <div className="mx-auto max-w-3xl">
            <MarkdownRenderer
              content={planContent}
              variant="full"
              rootPath={taskPath ?? undefined}
              className="text-sm"
            />
          </div>
        </div>

        <div className="border-t border-border px-4 py-3">
          <p className="mb-2.5 text-sm font-medium text-foreground">Would you like to proceed?</p>
          <div className="flex flex-col gap-1.5">
            <button
              onClick={() => onAction('auto-accept-clear')}
              className="flex items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-sm text-foreground transition-colors hover:bg-muted"
            >
              <span className="text-muted-foreground">1.</span>
              Yes, clear context and auto-accept edits
            </button>
            <button
              onClick={() => onAction('auto-accept')}
              className="flex items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-sm text-foreground transition-colors hover:bg-muted"
            >
              <span className="text-muted-foreground">2.</span>
              Yes, auto-accept edits
            </button>
            <button
              onClick={() => onAction('manual-approve')}
              className="flex items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-sm text-foreground transition-colors hover:bg-muted"
            >
              <span className="text-muted-foreground">3.</span>
              Yes, manually approve edits
            </button>
            {showEditInput ? (
              <div className="flex items-center gap-2 px-2.5">
                <span className="text-sm text-muted-foreground">4.</span>
                <input
                  type="text"
                  value={editMessage}
                  onChange={(e) => setEditMessage(e.target.value)}
                  onKeyDown={handleEditKeyDown}
                  placeholder="Type here to tell Claude what to change"
                  autoFocus
                  className="flex-1 rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                />
                <Button size="sm" onClick={handleEdit} disabled={!editMessage.trim()}>
                  Send
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setShowEditInput(false);
                    setEditMessage('');
                  }}
                >
                  Cancel
                </Button>
              </div>
            ) : (
              <button
                onClick={() => setShowEditInput(true)}
                className="flex items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <span>4.</span>
                Type here to tell Claude what to change
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
