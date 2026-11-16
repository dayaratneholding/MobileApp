import type { MessageReaction } from '../../types/chat';

export const REACTION_EMOJIS = ['👍', '❤️', '😂'] as const;

export type ReactionEmoji = (typeof REACTION_EMOJIS)[number];

export function reactionGroups(reactions: MessageReaction[] | undefined): [string, string[]][] {
  const groups = new Map<string, string[]>();
  for (const reaction of reactions ?? []) {
    const names = groups.get(reaction.emoji) ?? [];
    names.push(reaction.userId);
    groups.set(reaction.emoji, names);
  }
  return [...groups.entries()];
}
