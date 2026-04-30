import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import * as Icons from 'lucide-react';
import { executeViewportCommand } from '@/features/viewport-tools/command-dispatcher';
import type { ViewportTool } from '@/features/viewport-tools/types';

interface Props {
  tool: ViewportTool;
  disabled?: boolean;
}

/**
 * SegmentToolButton — pure presentation. Click ALWAYS goes through the
 * dispatcher; never executes inline logic. Safety-critical tools get a
 * red ring to surface intent in the UI.
 */
export default function SegmentToolButton({ tool, disabled }: Props) {
  const Icon = tool.icon ? (Icons as Record<string, unknown>)[tool.icon] as React.ComponentType<{ className?: string }> | undefined : undefined;

  const onClick = () => {
    const res = executeViewportCommand(tool);
    if (!res.ok) {
      // eslint-disable-next-line no-console
      console.warn('[viewport-tools] command rejected', tool.command, res.reason);
    }
  };

  const button = (
    <Button
      variant="ghost"
      size="sm"
      disabled={disabled}
      onClick={onClick}
      className={
        'h-8 px-2 gap-1.5 text-xs font-medium border border-transparent hover:border-cyan-500/40 ' +
        (tool.safetyCritical ? 'ring-1 ring-red-500/40 ' : '')
      }
    >
      {Icon ? <Icon className="h-3.5 w-3.5" /> : null}
      <span>{tool.label}</span>
    </Button>
  );

  if (!tool.hint) return button;
  return (
    <TooltipProvider delayDuration={350}>
      <Tooltip>
        <TooltipTrigger asChild>{button}</TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs text-xs">
          {tool.hint}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
