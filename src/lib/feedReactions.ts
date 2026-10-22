/**
 * Fast sæt af 5 reaktioner på forsidens fejringer og liga.
 * Gamle emojis i feed_reactions bevares i databasen og grupperes kun i visningen.
 */
export type ReactionKey = "clap" | "congrats" | "love" | "strong" | "funny";

export interface ReactionOption {
  key: ReactionKey;
  emoji: string;
  label: string;
}

export const REACTIONS: ReactionOption[] = [
  { key: "clap", emoji: "👏", label: "Godt gået" },
  { key: "congrats", emoji: "🎉", label: "Tillykke" },
  { key: "love", emoji: "❤️", label: "Elsker det" },
  { key: "strong", emoji: "💪", label: "Stærkt" },
  { key: "funny", emoji: "😄", label: "Sjovt" },
];

export const DEFAULT_REACTION: ReactionKey = "clap";

const LEGACY_MAP: Record<string, ReactionKey> = {
  "🎉": "congrats", "🥳": "congrats", "🎂": "congrats", "🙌": "congrats",
  "👏": "clap", "⭐": "clap", "🏆": "clap",
  "❤️": "love", "❤": "love",
  "💪": "strong", "🔥": "strong", "🚀": "strong",
  "😄": "funny",
};

/** Ukendte emojis tælles under 👏 Godt gået. */
export function reactionKeyForEmoji(emoji: string): ReactionKey {
  return LEGACY_MAP[emoji] ?? DEFAULT_REACTION;
}

export function reactionOption(key: ReactionKey): ReactionOption {
  return REACTIONS.find((r) => r.key === key) ?? REACTIONS[0];
}
