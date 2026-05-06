// src/components/LanguageBadge.jsx
// Small badge showing the language of a card

const LANGS = {
  japanese:            { label: '🇯🇵 Japanese',          cls: 'lang-badge--jp' },
  chinese_traditional: { label: '🇹🇼 Chinese (Trad.)',   cls: 'lang-badge--zh' },
  chinese_simplified:  { label: '🇨🇳 Chinese (Simp.)',   cls: 'lang-badge--zh' },
  korean:              { label: '🇰🇷 Korean',             cls: 'lang-badge--ko' },
  french:              { label: '🇫🇷 French',             cls: 'lang-badge--fr' },
  german:              { label: '🇩🇪 German',             cls: 'lang-badge--de' },
  spanish:             { label: '🇪🇸 Spanish',            cls: 'lang-badge--es' },
  italian:             { label: '🇮🇹 Italian',            cls: 'lang-badge--it' },
  portuguese:          { label: '🇧🇷 Portuguese',         cls: 'lang-badge--intl' },
  thai:                { label: '🇹🇭 Thai',               cls: 'lang-badge--intl' },
  indonesian:          { label: '🇮🇩 Indonesian',         cls: 'lang-badge--intl' },
  english:             { label: null, cls: null },
};

export default function LanguageBadge({ language }) {
  if (!language || language === 'english') return null;
  const lang = LANGS[language?.toLowerCase()];
  if (!lang || !lang.label) return null;
  return (
    <span className={`lang-badge ${lang.cls}`}>{lang.label}</span>
  );
}
