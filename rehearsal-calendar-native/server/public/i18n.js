const translations = {
  en: {
    lang: 'en',
    header: {
      logo: 'Rehearsly',
      download: 'Download',
    },
    hero: {
      badge: 'Less admin. More art.',
      title1: 'Your call sheet',
      title2: 'doesn\'t belong in a group chat.',
      subtitle: 'WhatsApp threads. Google Sheets nobody updates.<br>Half the cast didn\'t get the memo.<br>Rehearsly gets you back to the work.',
      cta: 'Try Rehearsly free',
      ctaSecondary: 'See how it works',
    },
    problem: {
      title: 'You\'re running a production.<br>Managing a spreadsheet.',
      text: 'Schedules get buried in messages.<br>Availability lives in people\'s heads.<br>And you\'re chasing everyone down.',
      line1: 'Cast hears call times from each other.',
      line2: 'You coordinate more than you create.',
      line3: 'Double bookings kill your session.',
    },
    solution: {
      title: 'One place. Entire production.',
      line1: 'Schedule sessions in seconds.',
      line2: 'See who\'s free before you book.',
      line3: 'No conflicts. No "Wait, I\'ve got a thing."',
      line4: 'Everyone confirms with one tap.',
      tagline: 'Back to the room. Back to the work.',
    },
    useCases: {
      title: 'Built for people who make things.',
      cards: [
        {
          title: 'Freelance directors',
          text: 'New cast every project. Everyone\'s availability, zero group chats.',
        },
        {
          title: 'Choreographers',
          text: 'Tight studio slots, rotating dancers. Instant headcount.',
        },
        {
          title: 'Indie companies',
          text: 'No admin team. No SM budget. Run your own schedule.',
        },
        {
          title: 'Freelance performers',
          text: 'Three gigs at once? Set your availability once. Done.',
        },
      ],
    },
    final: {
      title: 'Get back to creating.',
      subtitle: 'Let Rehearsly handle the schedule.',
      cta: 'Download Rehearsly',
      platforms: 'Available on iOS & Android.',
    },
  },

  ru: {
    lang: 'ru',
    header: {
      logo: 'Rehearsly',
      download: 'Скачать',
    },
    hero: {
      badge: 'Меньше рутины. Больше творчества.',
      title1: 'Расписание реп не должно',
      title2: 'жить в групповом чате.',
      subtitle: 'Бесконечные чаты в WhatsApp. Таблицы, которые никто не обновляет.<br>Половина труппы не в курсе.<br>Rehearsly возвращает вас к работе.',
      cta: 'Попробовать бесплатно',
      ctaSecondary: 'Как это работает',
    },
    problem: {
      title: 'Вы делаете проект.<br>И мотаете ленту чата.',
      text: 'Рабочий чат тонет в сообщениях.<br>Кто когда свободен — знает только он сам.<br>А вы пытаетесь достучаться до каждого.',
      line1: 'Труппа узнаёт про прогон друг от друга.',
      line2: 'Вы больше координируете, чем создаёте.',
      line3: 'Накладки срывают весь процесс.',
    },
    solution: {
      title: 'Одно место. Весь продакшн.',
      line1: 'Ставьте слоты за секунды.',
      line2: 'Видите, кто свободен, до того как забить время.',
      line3: 'Никаких накладок. Никаких «ой, у меня там че-то».',
      line4: 'Все подтверждают одним тапом.',
      tagline: 'Творите, не администрируйте.',
    },
    useCases: {
      title: 'Для тех, кто творит.',
      cards: [
        {
          title: 'Фриланс-режиссёры',
          text: 'Новый состав каждый проект. Вся доступность без 40 сообщений.',
        },
        {
          title: 'Хореографы',
          text: 'Плотный график студий, текучка исполнителей. Видите кто придёт.',
        },
        {
          title: 'Инди-театры',
          text: 'Ни помрежа, ни админа в штате. Ведите расписание сами.',
        },
        {
          title: 'Фриланс-артисты',
          text: 'Жонглируете проектами? Синхронизируйте с календарём и всё.',
        },
      ],
    },
    final: {
      title: 'Занимайтесь творчеством.',
      subtitle: 'Пусть расписанием занимается Rehearsly.',
      cta: 'Скачать Rehearsly',
      platforms: 'Доступно для iOS и Android.',
    },
  },
};

function getNestedValue(obj, path) {
  return path.split('.').reduce((acc, key) => acc && acc[key], obj);
}

function setLanguage(lang) {
  const t = translations[lang];
  if (!t) return;

  document.documentElement.lang = lang;

  // Update all data-i18n elements
  document.querySelectorAll('[data-i18n]').forEach((el) => {
    const key = el.getAttribute('data-i18n');
    const value = getNestedValue(t, key);
    if (value !== undefined) {
      el.innerHTML = typeof value === 'string' ? value : value;
    }
  });

  // Update use-case cards (only title + text, icons stay)
  document.querySelectorAll('[data-i18n-card]').forEach((card) => {
    const index = parseInt(card.getAttribute('data-i18n-card'), 10);
    const cardData = t.useCases.cards[index];
    if (cardData) {
      card.querySelector('.card-title').textContent = cardData.title;
      card.querySelector('.card-text').textContent = cardData.text;
    }
  });

  // Update toggle buttons
  document.querySelectorAll('.lang-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.lang === lang);
  });

  localStorage.setItem('rehearsly-lang', lang);
}

function detectLanguage() {
  const saved = localStorage.getItem('rehearsly-lang');
  if (saved && translations[saved]) return saved;

  const browserLang = navigator.language || navigator.userLanguage;
  if (browserLang && browserLang.startsWith('ru')) return 'ru';

  return 'en';
}

document.addEventListener('DOMContentLoaded', () => {
  // Init Lucide icons
  if (window.lucide) {
    lucide.createIcons();
  }

  // Init AOS
  if (window.AOS) {
    AOS.init({
      duration: 700,
      easing: 'ease-out-cubic',
      once: true,
      offset: 80,
    });
  }

  // Set language
  setLanguage(detectLanguage());

  // Language toggle
  document.querySelectorAll('.lang-btn').forEach((btn) => {
    btn.addEventListener('click', () => setLanguage(btn.dataset.lang));
  });

  // Show header download button on scroll
  const header = document.querySelector('.header');
  window.addEventListener('scroll', () => {
    if (window.scrollY > 300) {
      header.classList.add('header--scrolled');
    } else {
      header.classList.remove('header--scrolled');
    }
  }, { passive: true });
});
