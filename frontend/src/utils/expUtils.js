/**
 * expUtils.js
 * Utility functions for awarding and tracking EXP on the frontend
 */

/**
 * Award EXP to a user
 * @param {string} action - The action that earned EXP (e.g., 'create_character', 'daily_chat')
 * @param {object} [target] - Optional target object with { type: 'character', id: number }
 * @param {string} sessionToken - The user's session token
 * @param {object} [options] - Optional { onLevelUp: (data) => void }
 * @returns {Promise<object>} - Returns exp data from server
 */
export async function awardExp(action, target = null, sessionToken, options = {}) {
  const payload = { action };
  if (target) {
    payload.target_type = target.type;
    payload.target_id = target.id;
  }

  try {
    const res = await fetch(`${window.API_BASE_URL}/api/exp/gain`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': sessionToken,
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      console.warn('Failed to award EXP:', await res.text());
      return null;
    }

    const data = await res.json();
    
    // Call onLevelUp callback if provided and user leveled up
    if (data.leveled_up && options.onLevelUp) {
      options.onLevelUp(data);
    }

    return data;
  } catch (err) {
    console.error('Error awarding EXP:', err);
    return null;
  }
}

/**
 * Silent EXP gain (doesn't show UI notification, just updates behind the scenes)
 * @param {string} action
 * @param {object} [target]
 * @param {string} sessionToken
 * @param {object} [options] - Optional { onLevelUp: (data) => void }
 */
export async function silentExpGain(action, target, sessionToken, options = {}) {
  return awardExp(action, target, sessionToken, options);
}

/**
 * EXP rewards lookup (synced with backend)
 */
export const EXP_REWARDS = {
  create_character: 30,
  create_scene: 15,
  create_persona: 15,
  character_liked: 5,
  forked: 10,
  paid_char_sold: 50,
  daily_chat: 20,  // Updated from 10 to 20
};

/**
 * Daily action limits
 */
export const DAILY_ACTION_LIMITS = {
  daily_chat: 1,
  create_character: 2,
  create_scene: 2,
  create_persona: 2,
  character_liked: 20,
  forked: null,  // No hard cap
  paid_char_sold: null,  // No cap
};

export default {
  awardExp,
  silentExpGain,
  EXP_REWARDS,
  DAILY_ACTION_LIMITS,
};
