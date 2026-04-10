/**
 * WSF Event Stream — maps SDKMessage variants to typed WSF events.
 *
 * Extends EventEmitter to provide a typed event bus. Includes:
 * - SDKMessage → WSFEvent mapping
 * - Transport management (subscribe/unsubscribe handlers)
 * - Per-session cost tracking with cumulative totals
 */

import { EventEmitter } from 'node:events';
import type {
  SDKMessage,
  SDKResultSuccess,
  SDKResultError,
  SDKAssistantMessage,
  SDKSystemMessage,
  SDKToolProgressMessage,
  SDKTaskNotificationMessage,
  SDKTaskStartedMessage,
  SDKTaskProgressMessage,
  SDKToolUseSummaryMessage,
  SDKRateLimitEvent,
  SDKAPIRetryMessage,
  SDKStatusMessage,
  SDKCompactBoundaryMessage,
  SDKPartialAssistantMessage,
} from '@anthropic-ai/claude-agent-sdk';
import {
  WSFEventType,
  type WSFEvent,
  type WSFSessionInitEvent,
  type WSFSessionCompleteEvent,
  type WSFSessionErrorEvent,
  type WSFAssistantTextEvent,
  type WSFToolCallEvent,
  type WSFToolProgressEvent,
  type WSFToolUseSummaryEvent,
  type WSFTaskStartedEvent,
  type WSFTaskProgressEvent,
  type WSFTaskNotificationEvent,
  type WSFCostUpdateEvent,
  type WSFAPIRetryEvent,
  type WSFRateLimitEvent as WSFRateLimitEventType,
  type WSFStatusChangeEvent,
  type WSFCompactBoundaryEvent,
  type WSFStreamEvent,
  type TransportHandler,
  type CostBucket,
  type CostTracker,
  type PhaseType,
} from './types.js';

// ─── Mapping context ─────────────────────────────────────────────────────────

export interface EventStreamContext {
  phase?: PhaseType;
  planName?: string;
}

// ─── WSFEventStream ──────────────────────────────────────────────────────────

export class WSFEventStream extends EventEmitter {
  private readonly transports: Set<TransportHandler> = new Set();
  private readonly costTracker: CostTracker = {
    sessions: new Map(),
    cumulativeCostUsd: 0,
  };

  constructor() {
    super();
    this.setMaxListeners(20);
  }

  // ─── Transport management ────────────────────────────────────────────

  /** Subscribe a transport handler to receive all events. */
  addTransport(handler: TransportHandler): void {
    this.transports.add(handler);
  }

  /** Unsubscribe a transport handler. */
  removeTransport(handler: TransportHandler): void {
    this.transports.delete(handler);
  }

  /** Close all transports. */
  closeAll(): void {
    for (const transport of this.transports) {
      try {
        transport.close();
      } catch {
        // Ignore transport close errors
      }
    }
    this.transports.clear();
  }

  // ─── Event emission ──────────────────────────────────────────────────

  /** Emit a typed WSF event to all listeners and transports. */
  emitEvent(event: WSFEvent): void {
    // Emit via EventEmitter for listener-based consumers
    this.emit('event', event);
    this.emit(event.type, event);

    // Deliver to all transports — wrap in try/catch to prevent
    // one bad transport from killing the stream
    for (const transport of this.transports) {
      try {
        transport.onEvent(event);
      } catch {
        // Silently ignore transport errors
      }
    }
  }

  // ─── SDKMessage mapping ──────────────────────────────────────────────

  /**
   * Map an SDKMessage to a WSFEvent.
   * Returns null for non-actionable message types (user messages, replays, etc.).
   */
  mapSDKMessage(msg: SDKMessage, context: EventStreamContext = {}): WSFEvent | null {
    const base = {
      timestamp: new Date().toISOString(),
      sessionId: 'session_id' in msg ? (msg.session_id as string) : '',
      phase: context.phase,
      planName: context.planName,
    };

    switch (msg.type) {
      case 'system':
        return this.mapSystemMessage(msg as SDKSystemMessage | SDKAPIRetryMessage | SDKStatusMessage | SDKCompactBoundaryMessage | SDKTaskStartedMessage | SDKTaskProgressMessage | SDKTaskNotificationMessage, base);

      case 'assistant':
        return this.mapAssistantMessage(msg as SDKAssistantMessage, base);

      case 'result':
        return this.mapResultMessage(msg as SDKResultSuccess | SDKResultError, base);

      case 'tool_progress':
        return this.mapToolProgressMessage(msg as SDKToolProgressMessage, base);

      case 'tool_use_summary':
        return this.mapToolUseSummaryMessage(msg as SDKToolUseSummaryMessage, base);

      case 'rate_limit_event':
        return this.mapRateLimitMessage(msg as SDKRateLimitEvent, base);

      case 'stream_event':
        return this.mapStreamEvent(msg as SDKPartialAssistantMessage, base);

      // Non-actionable message types — ignore
      case 'user':
      case 'auth_status':
      case 'prompt_suggestion':
        return null;

      default:
        return null;
    }
  }

  /**
   * Map an SDKMessage and emit the resulting event (if any).
   * Convenience method combining mapSDKMessage + emitEvent.
   */
  mapAndEmit(msg: SDKMessage, context: EventStreamContext = {}): WSFEvent | null {
    const event = this.mapSDKMessage(msg, context);
    if (event) {
      this.emitEvent(event);
    }
    return event;
  }

  // ─── Cost tracking ───────────────────────────────────────────────────

  /** Get current cost totals. */
  getCost(): { session: number; cumulative: number } {
    const activeId = this.costTracker.activeSessionId;
    const sessionCost = activeId
      ? (this.costTracker.sessions.get(activeId)?.costUsd ?? 0)
      : 0;

    return {
      session: sessionCost,
      cumulative: this.costTracker.cumulativeCostUsd,
    };
  }

  /** Update cost for a session. */
  private updateCost(sessionId: string, costUsd: number): void {
    const existing = this.costTracker.sessions.get(sessionId);
    const previousCost = existing?.costUsd ?? 0;
    const delta = costUsd - previousCost;

    const bucket: CostBucket = { sessionId, costUsd };
    this.costTracker.sessions.set(sessionId, bucket);
    this.costTracker.activeSessionId = sessionId;
    this.costTracker.cumulativeCostUsd += delta;
  }

  // ─── Private mappers ─────────────────────────────────────────────────

  private mapSystemMessage(
    msg: SDKSystemMessage | SDKAPIRetryMessage | SDKStatusMessage | SDKCompactBoundaryMessage | SDKTaskStartedMessage | SDKTaskProgressMessage | SDKTaskNotificationMessage,
    base: Omit<WSFEvent, 'type'>,
  ): WSFEvent | null {
    // All system messages have a subtype
    const subtype = (msg as { subtype: string }).subtype;

    switch (subtype) {
      case 'init': {
        const initMsg = msg as SDKSystemMessage;
        return {
          ...base,
          type: WSFEventType.SessionInit,
          model: initMsg.model,
          tools: initMsg.tools,
          cwd: initMsg.cwd,
        } as WSFSessionInitEvent;
      }

      case 'api_retry': {
        const retryMsg = msg as SDKAPIRetryMessage;
        return {
          ...base,
          type: WSFEventType.APIRetry,
          attempt: retryMsg.attempt,
          maxRetries: retryMsg.max_retries,
          retryDelayMs: retryMsg.retry_delay_ms,
          errorStatus: retryMsg.error_status,
        } as WSFAPIRetryEvent;
      }

      case 'status': {
        const statusMsg = msg as SDKStatusMessage;
        return {
          ...base,
          type: WSFEventType.StatusChange,
          status: statusMsg.status,
        } as WSFStatusChangeEvent;
      }

      case 'compact_boundary': {
        const compactMsg = msg as SDKCompactBoundaryMessage;
        return {
          ...base,
          type: WSFEventType.CompactBoundary,
          trigger: compactMsg.compact_metadata.trigger,
          preTokens: compactMsg.compact_metadata.pre_tokens,
        } as WSFCompactBoundaryEvent;
      }

      case 'task_started': {
        const taskMsg = msg as SDKTaskStartedMessage;
        return {
          ...base,
          type: WSFEventType.TaskStarted,
          taskId: taskMsg.task_id,
          description: taskMsg.description,
          taskType: taskMsg.task_type,
        } as WSFTaskStartedEvent;
      }

      case 'task_progress': {
        const progressMsg = msg as SDKTaskProgressMessage;
        return {
          ...base,
          type: WSFEventType.TaskProgress,
          taskId: progressMsg.task_id,
          description: progressMsg.description,
          totalTokens: progressMsg.usage.total_tokens,
          toolUses: progressMsg.usage.tool_uses,
          durationMs: progressMsg.usage.duration_ms,
          lastToolName: progressMsg.last_tool_name,
        } as WSFTaskProgressEvent;
      }

      case 'task_notification': {
        const notifMsg = msg as SDKTaskNotificationMessage;
        return {
          ...base,
          type: WSFEventType.TaskNotification,
          taskId: notifMsg.task_id,
          status: notifMsg.status,
          summary: notifMsg.summary,
        } as WSFTaskNotificationEvent;
      }

      // Non-actionable system subtypes
      case 'hook_started':
      case 'hook_progress':
      case 'hook_response':
      case 'local_command_output':
      case 'session_state_changed':
      case 'files_persisted':
      case 'elicitation_complete':
        return null;

      default:
        return null;
    }
  }

  private mapAssistantMessage(
    msg: SDKAssistantMessage,
    base: Omit<WSFEvent, 'type'>,
  ): WSFEvent | null {
    const events: WSFEvent[] = [];

    // Extract text blocks — content blocks are a discriminated union with a 'type' field
    const content = msg.message.content as Array<{ type: string; [key: string]: unknown }>;

    const textBlocks = content.filter(
      (b): b is { type: 'text'; text: string } => b.type === 'text',
    );
    if (textBlocks.length > 0) {
      const text = textBlocks.map(b => b.text).join('');
      if (text.length > 0) {
        events.push({
          ...base,
          type: WSFEventType.AssistantText,
          text,
        } as WSFAssistantTextEvent);
      }
    }

    // Extract tool_use blocks
    const toolUseBlocks = content.filter(
      (b): b is { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> } =>
        b.type === 'tool_use',
    );
    for (const block of toolUseBlocks) {
      events.push({
        ...base,
        type: WSFEventType.ToolCall,
        toolName: block.name,
        toolUseId: block.id,
        input: block.input as Record<string, unknown>,
      } as WSFToolCallEvent);
    }

    // Return the first event — for multi-event messages, emit the rest
    // via separate emitEvent calls. This preserves the single-return contract
    // while still handling multi-block messages.
    if (events.length === 0) return null;
    if (events.length === 1) return events[0]!;

    // For multi-event assistant messages, emit all but the last directly,
    // and return the last one for the caller to handle
    for (let i = 0; i < events.length - 1; i++) {
      this.emitEvent(events[i]!);
    }
    return events[events.length - 1]!;
  }

  private mapResultMessage(
    msg: SDKResultSuccess | SDKResultError,
    base: Omit<WSFEvent, 'type'>,
  ): WSFEvent {
    // Update cost tracking
    this.updateCost(msg.session_id, msg.total_cost_usd);

    if (msg.subtype === 'success') {
      const successMsg = msg as SDKResultSuccess;
      return {
        ...base,
        type: WSFEventType.SessionComplete,
        success: true,
        totalCostUsd: successMsg.total_cost_usd,
        durationMs: successMsg.duration_ms,
        numTurns: successMsg.num_turns,
        result: successMsg.result,
      } as WSFSessionCompleteEvent;
    }

    const errorMsg = msg as SDKResultError;
    return {
      ...base,
      type: WSFEventType.SessionError,
      success: false,
      totalCostUsd: errorMsg.total_cost_usd,
      durationMs: errorMsg.duration_ms,
      numTurns: errorMsg.num_turns,
      errorSubtype: errorMsg.subtype,
      errors: errorMsg.errors,
    } as WSFSessionErrorEvent;
  }

  private mapToolProgressMessage(
    msg: SDKToolProgressMessage,
    base: Omit<WSFEvent, 'type'>,
  ): WSFToolProgressEvent {
    return {
      ...base,
      type: WSFEventType.ToolProgress,
      toolName: msg.tool_name,
      toolUseId: msg.tool_use_id,
      elapsedSeconds: msg.elapsed_time_seconds,
    } as WSFToolProgressEvent;
  }

  private mapToolUseSummaryMessage(
    msg: SDKToolUseSummaryMessage,
    base: Omit<WSFEvent, 'type'>,
  ): WSFToolUseSummaryEvent {
    return {
      ...base,
      type: WSFEventType.ToolUseSummary,
      summary: msg.summary,
      toolUseIds: msg.preceding_tool_use_ids,
    } as WSFToolUseSummaryEvent;
  }

  private mapRateLimitMessage(
    msg: SDKRateLimitEvent,
    base: Omit<WSFEvent, 'type'>,
  ): WSFRateLimitEventType {
    return {
      ...base,
      type: WSFEventType.RateLimit,
      status: msg.rate_limit_info.status,
      resetsAt: msg.rate_limit_info.resetsAt,
      utilization: msg.rate_limit_info.utilization,
    } as WSFRateLimitEventType;
  }

  private mapStreamEvent(
    msg: SDKPartialAssistantMessage,
    base: Omit<WSFEvent, 'type'>,
  ): WSFStreamEvent {
    return {
      ...base,
      type: WSFEventType.StreamEvent,
      event: msg.event,
    } as WSFStreamEvent;
  }
}
