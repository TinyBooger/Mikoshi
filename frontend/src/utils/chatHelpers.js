/**
 * Pure helper functions for chat operations.
 * All functions are standalone, testable, and have zero React dependencies.
 */

export const MAX_PINNED_MEMORIES = 10;
export const DEFAULT_BRANCH_ID = 'branch_main';

// ---------------------------------------------------------------------------
// Message ID helpers
// ---------------------------------------------------------------------------

export const generateMessageId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `msg_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
};

export const ensureMessageIds = (messageList = []) => {
  if (!Array.isArray(messageList)) return [];
  return messageList.map((message) => {
    if (!message || typeof message !== 'object') return message;
    if (message.role === 'system') return message;
    const hasValidId = typeof message.message_id === 'string' && message.message_id.trim();
    return {
      ...message,
      message_id: hasValidId ? message.message_id : generateMessageId(),
      is_pinned: !!message.is_pinned,
    };
  });
};

// ---------------------------------------------------------------------------
// Branch helpers
// ---------------------------------------------------------------------------

export const normalizeChatBranch = (branch, index = 0) => {
  const fallbackBranchId = index === 0 ? DEFAULT_BRANCH_ID : `branch_local_${index + 1}`;
  const branchId = typeof branch?.branch_id === 'string' && branch.branch_id.trim()
    ? branch.branch_id.trim()
    : fallbackBranchId;

  return {
    branch_id: branchId,
    parent_branch_id: typeof branch?.parent_branch_id === 'string' && branch.parent_branch_id.trim()
      ? branch.parent_branch_id.trim()
      : null,
    parent_message_id: typeof branch?.parent_message_id === 'string' && branch.parent_message_id.trim()
      ? branch.parent_message_id.trim()
      : null,
    label: typeof branch?.label === 'string' && branch.label.trim()
      ? branch.label.trim()
      : (index === 0 ? 'Main' : `Branch ${index + 1}`),
    created_at: branch?.created_at || null,
    last_updated: branch?.last_updated || null,
    messages: ensureMessageIds(Array.isArray(branch?.messages) ? branch.messages : []),
  };
};

export const normalizeChatEntry = (chat) => {
  if (!chat || typeof chat !== 'object') return null;

  const sourceBranches = Array.isArray(chat.branches) && chat.branches.length > 0
    ? chat.branches
    : [{ branch_id: DEFAULT_BRANCH_ID, label: 'Main', messages: chat.messages || [] }];
  const branches = sourceBranches.map((branch, index) => normalizeChatBranch(branch, index));

  const requestedActiveBranchId = typeof chat.active_branch_id === 'string' && chat.active_branch_id.trim()
    ? chat.active_branch_id.trim()
    : branches[0]?.branch_id || DEFAULT_BRANCH_ID;
  const activeBranch = branches.find((branch) => branch.branch_id === requestedActiveBranchId) || branches[0];

  return {
    ...chat,
    branches,
    active_branch_id: activeBranch?.branch_id || DEFAULT_BRANCH_ID,
    messages: activeBranch?.messages || [],
  };
};

export const getActiveBranch = (chat) => {
  const normalized = normalizeChatEntry(chat);
  if (!normalized) return null;
  return normalized.branches.find((branch) => branch.branch_id === normalized.active_branch_id) || normalized.branches[0] || null;
};

export const updateChatEntryBranchMessages = (chatEntry, branchId, nextMessages, extraFields = {}, makeActive = true) => {
  const normalized = normalizeChatEntry(chatEntry) || normalizeChatEntry({});
  const normalizedMessages = ensureMessageIds(nextMessages);
  const nextBranchId = branchId || normalized.active_branch_id || DEFAULT_BRANCH_ID;
  let branchFound = false;

  const branches = normalized.branches.map((branch) => {
    if (branch.branch_id !== nextBranchId) return branch;
    branchFound = true;
    return {
      ...branch,
      ...extraFields,
      messages: normalizedMessages,
    };
  });

  const finalBranches = branchFound
    ? branches
    : [
        ...branches,
        normalizeChatBranch({
          branch_id: nextBranchId,
          label: extraFields.label,
          parent_branch_id: extraFields.parent_branch_id,
          parent_message_id: extraFields.parent_message_id,
          created_at: extraFields.created_at || new Date().toISOString(),
          last_updated: extraFields.last_updated || new Date().toISOString(),
          messages: normalizedMessages,
        }, branches.length),
      ];

  const activeBranchId = makeActive ? nextBranchId : normalized.active_branch_id;
  const activeBranch = finalBranches.find((branch) => branch.branch_id === activeBranchId) || finalBranches[0];

  return {
    ...normalized,
    branches: finalBranches,
    active_branch_id: activeBranch?.branch_id || nextBranchId,
    messages: activeBranch?.messages || [],
  };
};

// ---------------------------------------------------------------------------
// Fork / Branch navigation
// ---------------------------------------------------------------------------

/**
 * Computes branch navigator info for each message that sits at a branch divergence point.
 * Returns a Map<messageId, { currentIdx, options: Branch[] }>
 */
export const computeForkNav = (allBranches, activeBranchId) => {
  if (!allBranches || allBranches.length <= 1) return new Map();
  const activeBranch = allBranches.find((b) => b.branch_id === activeBranchId);
  if (!activeBranch) return new Map();
  const result = new Map();

  // Case 1: active branch has direct children — show navigator at the fork-source message
  const childrenByParentMsg = {};
  for (const branch of allBranches) {
    if (branch.parent_branch_id === activeBranchId && branch.parent_message_id) {
      if (!childrenByParentMsg[branch.parent_message_id]) {
        childrenByParentMsg[branch.parent_message_id] = [];
      }
      childrenByParentMsg[branch.parent_message_id].push(branch);
    }
  }
  for (const [parentMsgId, children] of Object.entries(childrenByParentMsg)) {
    result.set(parentMsgId, { currentIdx: 0, options: [activeBranch, ...children] });
  }

  // Case 2: active branch is a child — show navigator at its first diverging message
  if (activeBranch.parent_message_id && activeBranch.parent_branch_id) {
    const parentBranch = allBranches.find((b) => b.branch_id === activeBranch.parent_branch_id);
    const siblings = allBranches.filter(
      (b) =>
        b.parent_branch_id === activeBranch.parent_branch_id &&
        b.parent_message_id === activeBranch.parent_message_id,
    );
    const options = parentBranch ? [parentBranch, ...siblings] : [...siblings];
    const currentIdx = options.findIndex((b) => b?.branch_id === activeBranchId);
    const parentMsgIds = new Set(
      (parentBranch?.messages || []).map((m) => m?.message_id).filter(Boolean),
    );
    let forkMessageId = null;
    for (const msg of activeBranch.messages || []) {
      if (msg?.message_id && !parentMsgIds.has(msg.message_id)) {
        forkMessageId = msg.message_id;
        break;
      }
    }
    if (forkMessageId && !result.has(forkMessageId)) {
      result.set(forkMessageId, { currentIdx, options });
    }
  }

  return result;
};

// ---------------------------------------------------------------------------
// Message preview
// ---------------------------------------------------------------------------

export const getMessagePreview = (content = '', max = 88) => {
  if (typeof content !== 'string') return '';
  const compact = content.replace(/\s+/g, ' ').trim();
  if (compact.length <= max) return compact;
  return `${compact.slice(0, max)}...`;
};
