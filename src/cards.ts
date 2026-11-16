// The Rider-Waite-Smith deck as 68×120 pixel cards, stored at 2× on the ud-assets branch of this
// repo. Comments link to a fixed commit, so an old comment keeps showing the card it drew.

const BASE = "https://raw.githubusercontent.com/aglowinthefield/unconscious-development/766174f2763dfa691fa05ed432f69f3cf26c8a09/tarot";

export const CARDS = ["ace-of-cups", "ace-of-pentacles", "ace-of-swords", "ace-of-wands", "death", "eight-of-cups", "eight-of-pentacles", "eight-of-swords", "eight-of-wands", "five-of-cups", "five-of-pentacles", "five-of-swords", "five-of-wands", "four-of-cups", "four-of-pentacles", "four-of-swords", "four-of-wands", "judgement", "justice", "king-of-cups", "king-of-pentacles", "king-of-swords", "king-of-wands", "knight-of-cups", "knight-of-pentacles", "knight-of-swords", "knight-of-wands", "nine-of-cups", "nine-of-pentacles", "nine-of-swords", "nine-of-wands", "page-of-cups", "page-of-pentacles", "page-of-swords", "page-of-wands", "queen-of-cups", "queen-of-pentacles", "queen-of-swords", "queen-of-wands", "seven-of-cups", "seven-of-pentacles", "seven-of-swords", "seven-of-wands", "six-of-cups", "six-of-pentacles", "six-of-swords", "six-of-wands", "strength", "temperance", "ten-of-cups", "ten-of-pentacles", "ten-of-swords", "ten-of-wands", "the-chariot", "the-devil", "the-emperor", "the-empress", "the-fool", "the-hanged-man", "the-hermit", "the-hierophant", "the-high-priestess", "the-lovers", "the-magician", "the-moon", "the-star", "the-sun", "the-tower", "the-world", "three-of-cups", "three-of-pentacles", "three-of-swords", "three-of-wands", "two-of-cups", "two-of-pentacles", "two-of-swords", "two-of-wands", "wheel-of-fortune"] as const;

export interface Card { slug: string; name: string; url: string; html: string }

export function cardName(slug: string): string {
  return slug.split("-").map((w, i) => (i && w === "of" ? w : w[0].toUpperCase() + w.slice(1))).join(" ");
}

export function card(slug: string): Card {
  const name = cardName(slug);
  const url = `${BASE}/${slug}.png`;
  return { slug, name, url, html: `<img align="left" width="68" height="120" src="${url}" alt="${name}">` };
}

export const drawCard = (rng: () => number = Math.random): Card => card(CARDS[Math.floor(rng() * CARDS.length)]);
