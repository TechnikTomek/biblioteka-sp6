import { CATEGORIES } from "./books.js";
import { esc } from "./app.js";

const PALETTE = ["#8b3a14", "#1f4e5f", "#4a5d23", "#6b2d5c", "#7a5a12", "#2f3e6b", "#7b2e2e", "#285c4d"];

export function coverColor(id) {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return PALETTE[h % PALETTE.length];
}

export function bookCard(b, action = "") {
  return `<article class="book">
    <div class="book-cover" style="background:${coverColor(b.id)}">
      <span class="t">${esc(b.title)}</span><span class="a">${esc(b.author)}</span>
    </div>
    <div><span class="tag">${esc(CATEGORIES[b.category])}</span> ${b.isNew ? '<span class="tag new">Nowość</span>' : ""}</div>
    <div><strong>${esc(b.title)}</strong><div class="book-meta">${esc(b.author)} · ${b.year} · egz.: ${b.copies}</div></div>
    ${action}
  </article>`;
}
