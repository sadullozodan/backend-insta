// Реаксияҳои иҷозатдодашуда (4.4) — монанди Facebook/Instagram
const REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '😡'];

// Палитраи ранги воқеии Instagram (4.1) — фронтенд метавонад
// онро аз GET /api/meta/theme гирад, то ранги placeholder истифода нашавад.
const INSTAGRAM_THEME = {
  gradient: ['#feda75', '#fa7e1e', '#d62976', '#962fbf', '#4f5bd5'], // сторис
  primary: '#0095F6',      // тугмаи асосӣ / линк
  primaryHover: '#1877F2',
  like: '#ED4956',         // ранги дил/лайк
  background: '#FFFFFF',
  backgroundDark: '#000000',
  surface: '#FAFAFA',
  surfaceDark: '#121212',
  textPrimary: '#262626',
  textSecondary: '#8E8E8E',
  border: '#DBDBDB',
  online: '#2ECC71',       // нуқтаи сабзи онлайн
  badge: '#FF3040',        // badge-и сурхи notification
  bubbleIncoming: '#EFEFEF',
  bubbleOutgoing: '#3797F0',
  seenTick: '#34B7F1',     // ду галочкаи кабуд
};

module.exports = { REACTIONS, INSTAGRAM_THEME };
