export interface Emoji {
  char: string;
  name: string;
}

export interface EmojiGroup {
  label: string;
  emoji: Emoji[];
}

function group(label: string, source: string): EmojiGroup {
  const emoji = source
    .trim()
    .split(/\s+/)
    .map((entry) => {
      const separator = entry.indexOf("|");
      const char = separator === -1 ? entry : entry.slice(0, separator);
      const name = separator === -1 ? entry : entry.slice(separator + 1);
      return { char, name };
    })
    .filter((item) => item.char.length > 0 && item.name.length > 0);
  return { label, emoji };
}

/**
 * Unicode emoji inserted into the comment. Bugzilla stores the character
 * itself; it does not convert :shortcodes:.
 */
export const EMOJI_GROUPS: EmojiGroup[] = [
  group(
    "Smileys",
    "😀|grin 😃|smiley 😄|smile 😁|beaming 😆|laughing 😅|sweat-smile 🤣|rofl 😂|joy 🙂|slight-smile 😉|wink 😊|blush 😍|heart-eyes 😘|kiss 😗|kissing 😙|kissing-smiling 😚|kissing-closed 😋|yum 😛|stuck-out 😜|wink-tongue 🤪|zany 😝|squinting 🤑|money 🤗|hugging 🤭|hand-over-mouth 🤫|shush 🤔|thinking 🤐|zipper 😐|neutral 😑|expressionless 😶|no-mouth 😏|smirk 😒|unamused 🙄|roll-eyes 😬|grimace 😌|relieved 😔|pensive 😪|sleepy 🤤|drool 😴|sleeping 😷|mask 🤒|sick 🤕|bandage 🤢|nauseated 🤮|vomit 🥵|hot 🥶|cold 🥴|woozy 😵|dizzy 🤯|exploding 🤠|cowboy 🥳|party 😎|sunglasses 🤓|nerd 🧐|monocle 😕|confused 😟|worried 🙁|frown ☹️|sad 😮|open-mouth 😯|hushed 😲|astonished 😳|flushed 🥺|pleading 😦|anguished-open 😧|anguished 😨|fearful 😰|anxious 😥|disappointed 😢|cry 😭|sob 😱|scream 😖|confounded 😣|persevere 😞|disappointed-face 😓|downcast 😩|weary 😫|tired 🥱|yawn",
  ),
  group(
    "Gestures",
    "👍|thumbsup 👎|thumbsdown 👌|ok ✌️|victory 🤞|crossed-fingers 🤟|love-you 🤘|rock 🤙|call-me 👋|wave 👏|clap 🙌|raised-hands 👐|open-hands 🤲|palms-up 🤝|handshake 🙏|pray ✍️|writing 💪|muscle 👀|eyes 👁️|eye",
  ),
  group(
    "Hearts and symbols",
    "❤️|heart 🧡|orange-heart 💛|yellow-heart 💚|green-heart 💙|blue-heart 💜|purple-heart 🖤|black-heart 💔|broken-heart ✨|sparkles ⭐|star 🌟|glow-star 💯|hundred ✅|check ❌|cross ⚠️|warning ❗|exclamation ❓|question 🔥|fire 💥|boom 🎉|tada 🎊|confetti 🚀|rocket 💡|idea 📌|pin 📎|paperclip 🔗|link 🐛|bug 🐞|lady-beetle 🧪|test 🛠️|tools 🔧|wrench 🔨|hammer ⚙️|gear 🔒|lock 🔓|unlock 📝|memo 📋|clipboard 📈|chart-up 📉|chart-down 🏁|flag 🎯|target",
  ),
];

export function searchEmoji(query: string): Emoji[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return [];
  const matches: Emoji[] = [];
  for (const emojiGroup of EMOJI_GROUPS) {
    for (const emoji of emojiGroup.emoji) {
      if (emoji.name.includes(needle) || emoji.char === needle) matches.push(emoji);
      if (matches.length >= 80) return matches;
    }
  }
  return matches;
}
