import type { Action, ResolvedToolCallTrigger } from "./context.js";
import { isToolCallTrigger } from "./context.js";

export type ActionRegistry = {
  readonly actions: readonly Action[];
  readonly toolCallTriggers: readonly ResolvedToolCallTrigger[];
  registerAction(action: Action): void;
  getAction(name: string): Action | undefined;
  getToolCallTrigger(name: string): ResolvedToolCallTrigger | undefined;
};

export function createActionRegistry(): ActionRegistry {
  const actions = new Map<string, Action>();
  const toolCallTriggers = new Map<string, ResolvedToolCallTrigger>();

  return {
    get actions() {
      return [...actions.values()];
    },
    get toolCallTriggers() {
      return [...toolCallTriggers.values()];
    },
    registerAction(action) {
      if (actions.has(action.name)) {
        throw new Error(`Duplicate action name: ${action.name}`);
      }

      const toolTriggers = action.triggers.filter(isToolCallTrigger);
      if (action.ownerOnly && toolTriggers.length > 0) {
        throw new Error(
          `Owner-only action cannot expose tool calls: ${action.name}`,
        );
      }

      actions.set(action.name, action);

      try {
        for (const trigger of toolTriggers) {
          registerToolCallTrigger(toolCallTriggers, action, trigger);
        }
      } catch (error) {
        actions.delete(action.name);
        for (const [name, entry] of toolCallTriggers) {
          if (entry.action.name === action.name) toolCallTriggers.delete(name);
        }
        throw error;
      }
    },
    getAction(name) {
      return actions.get(name);
    },
    getToolCallTrigger(name) {
      return toolCallTriggers.get(name);
    },
  };
}

function registerToolCallTrigger(
  triggers: Map<string, ResolvedToolCallTrigger>,
  action: Action,
  trigger: ResolvedToolCallTrigger["trigger"],
): void {
  const existing = triggers.get(trigger.name);
  if (existing) {
    throw new Error(
      `Duplicate tool-call trigger name: ${trigger.name} (${existing.action.name}, ${action.name})`,
    );
  }
  triggers.set(trigger.name, { action, trigger });
}

export const actionRegistry = createActionRegistry();

export function registerAction(action: Action): void {
  actionRegistry.registerAction(action);
}
